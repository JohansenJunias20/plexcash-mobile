import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import QRCodeInput from './QRCodeInput';

interface Props {
  onScanSuccess: (user: any, token: string) => void;
  onCancel: () => void;
  onSwitchToManual?: () => void;
}

const SimpleQRScanner = ({ onScanSuccess, onCancel, onSwitchToManual }: Props): JSX.Element => {
  const { authorizeDeviceWithQRCode } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const device = backDevice || frontDevice;

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (scanned || isLoading || codes.length === 0) return;
      handleBarcodeScanned(codes[0].value || '');
    },
  });

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const status = await Camera.getCameraPermissionStatus();
      if (status !== 'granted') {
        const newStatus = await Camera.requestCameraPermission();
        setHasPermission(newStatus === 'granted');
      } else {
        setHasPermission(true);
      }
    } catch (e) {
      console.warn('Camera permission check failed:', e);
      setHasPermission(false);
    }
  };

  const requestPermission = async () => {
    try {
      const status = await Camera.requestCameraPermission();
      if (status === 'denied') {
        await Linking.openSettings();
      }
      setHasPermission(status === 'granted');
    } catch (e) {
      console.warn('Request camera permission failed:', e);
    }
  };

  const handleBarcodeScanned = async (data: string) => {
    if (scanned || isLoading) return;
    setScanned(true);
    setIsLoading(true);

    try {
      const result = await authorizeDeviceWithQRCode(data);
      if (result.success) {
        Alert.alert('Device Authorized Successfully!', result.message || 'Your device has been permanently authorized. You will stay logged in until you manually sign out.', [
          { text: 'OK', onPress: () => onScanSuccess({}, '') }
        ]);
      } else {
        Alert.alert('Device Authorization Failed', result.message || 'Invalid QR code or device authorization failed', [
          { text: 'Try Again', onPress: () => { setScanned(false); setIsLoading(false); } },
          { text: 'Enter Manually', onPress: () => setShowManualInput(true) },
          { text: 'Cancel', onPress: onCancel }
        ]);
      }
    } catch (error) {
      console.error('QR Code authentication error:', error);
      Alert.alert('Error', 'Failed to authenticate. Please try again.', [
        { text: 'Try Again', onPress: () => { setScanned(false); setIsLoading(false); } },
        { text: 'Enter Manually', onPress: () => setShowManualInput(true) },
        { text: 'Cancel', onPress: onCancel }
      ]);
    }
  };

  if (showManualInput) {
    return <QRCodeInput onScanSuccess={onScanSuccess} onCancel={() => setShowManualInput(false)} />;
  }

  if (!hasPermission) {
    return (
      <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="white" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>We need access to your camera to scan QR codes for authentication.</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualButton} onPress={() => setShowManualInput(true)}>
            <Ionicons name="keypad-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.manualButtonText}>Input QR Code Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (device == null) {
    return (
      <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="videocam-off-outline" size={64} color="white" />
          <Text style={styles.permissionTitle}>Kamera Tidak Terdeteksi</Text>
          <Text style={styles.permissionText}>
            Perangkat ini tidak mendukung akses pemindai kamera standar. Silakan gunakan opsi Input QR Code Manual.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => setShowManualInput(true)}>
            <Ionicons name="create-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.permissionButtonText}>Input QR Code Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onCancel}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan QR Code</Text>
        <TouchableOpacity style={styles.manualHeaderButton} onPress={() => setShowManualInput(true)}>
          <Ionicons name="create-outline" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <Camera style={styles.camera} device={device} isActive={!scanned && !isLoading} codeScanner={codeScanner} />
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.instructionText}>Arahkan kamera ke QR Code web app</Text>
        </View>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Authenticating...</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerButtonGroup}>
          <TouchableOpacity style={styles.resetButton} onPress={() => { setScanned(false); setIsLoading(false); }} disabled={isLoading}>
            <Ionicons name="refresh" size={18} color="white" />
            <Text style={styles.resetButtonText}>Reset Scanner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualFooterButton} onPress={() => setShowManualInput(true)}>
            <Ionicons name="keypad-outline" size={18} color="#FFD700" />
            <Text style={styles.manualFooterButtonText}>Input Manual</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.8)' },
  backButton: { padding: 10 },
  headerText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  manualHeaderButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanArea: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#FFD700', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  instructionText: { color: 'white', fontSize: 15, textAlign: 'center', marginTop: 30, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'white', fontSize: 16, marginTop: 10 },
  footer: { padding: 20, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center' },
  footerButtonGroup: { flexDirection: 'row', gap: 12 },
  resetButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  resetButtonText: { color: 'white', fontSize: 14, marginLeft: 6 },
  manualFooterButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.3)', borderWidth: 1, borderColor: '#FFD700', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  manualFooterButtonText: { color: '#FFD700', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  permissionTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 20, marginBottom: 15 },
  permissionText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 25 },
  permissionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 25, marginBottom: 12 },
  permissionButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  manualButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366F1', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 25, marginBottom: 12 },
  manualButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 25 },
  cancelButtonText: { color: 'white', fontSize: 16 },
});

export default SimpleQRScanner;


