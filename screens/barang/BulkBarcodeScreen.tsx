import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';

interface ScanRow { code: string; id?: number; sku?: string; nama?: string; }

export default function BulkBarcodeScreen(): JSX.Element {
  const [hasPermission, setHasPermission] = useState(false);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [scanning, setScanning] = useState(true);
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'code-93'],
    onCodeScanned: (codes) => {
      if (!scanning || codes.length === 0) return;
      onBarcodeScanned(codes[0].value || '');
    },
  });

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const status = await Camera.getCameraPermissionStatus();
    setHasPermission(status === 'granted');
  };

  const requestPermission = async () => {
    const status = await Camera.requestCameraPermission();
    if (status === 'denied') {
      await Linking.openSettings();
    }
    setHasPermission(status === 'granted');
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}><Text style={{ color: 'white' }}>Grant Permission</Text></TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text>Loading camera...</Text>
      </View>
    );
  }

  const onBarcodeScanned = (data: string) => {
    if (!scanning) return;
    setScanning(false);
    setScans(prev => [...prev, { code: data }]);
    setTimeout(() => setScanning(true), 500);
  };

  const save = async () => {
    const payload = scans.filter(r => r.id && r.code).map(r => ({ id: r.id!, barcode: r.code }));
    if (payload.length === 0) { Alert.alert('Nothing to save'); return; }
    const token = await getTokenAuth();
    const { signOut } = (require('../../context/AuthContext') as any).useAuth?.() || {};
    if (!token) { Alert.alert('Session expired', 'Please login'); signOut && (await signOut()); return; }
    const res = await fetch(`${API_BASE_URL}/bulk/masterbarang/barcode`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: payload }) });
    const json = await res.json();
    if (json.status) Alert.alert('Success', `Saved ${json.updated?.length || 0} barcodes`);
    else Alert.alert('Error', json.reason || 'Failed to save');
  };

  return (
    <View style={{ flex: 1 }}>
      <Camera style={{ flex: 1 }} device={device} isActive={scanning} codeScanner={codeScanner}>
        <View style={styles.overlay}><Text style={{ color: 'white' }}>Scan barcodes</Text></View>
      </Camera>
      <FlatList
        data={scans}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.meta}>{item.sku || ''} {item.nama || ''}</Text>
          </View>
        )}
      />
      <TouchableOpacity style={styles.button} onPress={save}><Text style={{ color: 'white' }}>Save</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center' },
  row: { padding: 12, borderBottomColor: '#E5E7EB', borderBottomWidth: 1 },
  code: { fontWeight: '600', color: '#111827' },
  meta: { color: '#6B7280' },
  button: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
});

