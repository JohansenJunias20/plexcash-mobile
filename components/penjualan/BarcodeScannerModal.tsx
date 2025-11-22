import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScannerModal({ visible, onClose, onScan }: Props) {
  const [mode, setMode] = useState<'manual' | 'camera'>('manual');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  const device = useCameraDevice('back');

  // Request camera permission
  useEffect(() => {
    const checkPermission = async () => {
      const status = await Camera.getCameraPermissionStatus();
      setHasPermission(status === 'granted');
      setPermissionChecked(true);
    };

    if (visible && mode === 'camera') {
      checkPermission();
    }
  }, [visible, mode]);

  const requestPermission = async () => {
    const permission = await Camera.requestCameraPermission();
    if (permission === 'denied') {
      Alert.alert(
        'Camera Permission',
        'Camera permission is required to scan barcodes. Please enable it in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
    setHasPermission(permission === 'granted');
  };

  // Code scanner configuration
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'code-93', 'upc-a', 'upc-e'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        const barcode = codes[0].value;
        onScan(barcode);
        setBarcodeInput('');
        onClose();
      }
    },
  });

  const handleScan = async () => {
    const code = barcodeInput.trim();
    if (!code) {
      Alert.alert('Error', 'Barcode tidak boleh kosong');
      return;
    }

    try {
      setScanning(true);
      const token = await getTokenAuth();
      if (!token) return;

      // Query masterbarang by barcode
      const url = `${API_BASE_URL}/get/masterbarang/condition/and/0/1?query=barcode:equal:${encodeURIComponent(code)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!json.status) {
        Alert.alert('Error', `Gagal mencari barcode: ${code}`);
        return;
      }

      const rows: any[] = json.data || [];
      if (!rows.length) {
        Alert.alert('Tidak Ditemukan', `Barcode tidak ditemukan: ${code}`);
        return;
      }

      const row = rows[0];
      if (row.stok === 0) {
        Alert.alert('Stok Habis', `Stok ${row.sku} habis`);
        return;
      }

      // Call parent callback with barcode data
      onScan(code);
      setBarcodeInput('');
      onClose();
    } catch (error) {
      console.error('Barcode scan error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat scan barcode');
    } finally {
      setScanning(false);
    }
  };

  const handleClose = () => {
    setBarcodeInput('');
    setMode('manual');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, mode === 'camera' && styles.containerFullScreen]}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan Barcode</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
              onPress={() => setMode('manual')}
            >
              <Ionicons
                name="keypad-outline"
                size={20}
                color={mode === 'manual' ? '#fff' : '#666'}
              />
              <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
                Manual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'camera' && styles.modeButtonActive]}
              onPress={() => setMode('camera')}
            >
              <Ionicons
                name="camera-outline"
                size={20}
                color={mode === 'camera' ? '#fff' : '#666'}
              />
              <Text style={[styles.modeButtonText, mode === 'camera' && styles.modeButtonTextActive]}>
                Camera
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'manual' ? (
            <View style={styles.content}>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={24} color="#2563eb" />
                <Text style={styles.infoText}>
                  Masukkan barcode secara manual atau gunakan scanner eksternal
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Barcode</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Scan atau ketik barcode..."
                  value={barcodeInput}
                  onChangeText={setBarcodeInput}
                  onSubmitEditing={handleScan}
                  autoFocus
                  returnKeyType="search"
                />
              </View>

              <TouchableOpacity
                style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
                onPress={handleScan}
                disabled={scanning}
              >
                {scanning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="barcode-outline" size={20} color="#fff" />
                    <Text style={styles.scanButtonText}>Cari Barang</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              {!permissionChecked ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.loadingText}>Checking camera permission...</Text>
                </View>
              ) : !hasPermission ? (
                <View style={styles.permissionContainer}>
                  <Ionicons name="camera-off" size={64} color="#666" />
                  <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                  <Text style={styles.permissionText}>
                    Please grant camera permission to scan barcodes
                  </Text>
                  <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                  </TouchableOpacity>
                </View>
              ) : !device ? (
                <View style={styles.permissionContainer}>
                  <Ionicons name="camera-off" size={64} color="#666" />
                  <Text style={styles.permissionTitle}>No Camera Found</Text>
                  <Text style={styles.permissionText}>
                    Unable to access camera device
                  </Text>
                </View>
              ) : (
                <>
                  <Camera
                    style={styles.camera}
                    device={device}
                    isActive={visible && mode === 'camera'}
                    codeScanner={codeScanner}
                  />
                  <View style={styles.cameraOverlay}>
                    {/* Back Button */}
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setMode('manual')}
                    >
                      <Ionicons name="arrow-back" size={24} color="#fff" />
                      <Text style={styles.backButtonText}>Kembali</Text>
                    </TouchableOpacity>

                    <View style={styles.scanFrame} />
                    <Text style={styles.cameraHint}>
                      Position barcode within the frame
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  containerFullScreen: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modeToggle: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#f8f9fa',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1e40af',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  scanButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  scanButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cameraHint: {
    marginTop: 24,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

