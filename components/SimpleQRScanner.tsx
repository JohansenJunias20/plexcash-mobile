import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

interface Props {
  onScanSuccess: (user: any, token: string) => void;
  onCancel: () => void;
}

const SimpleQRScanner = ({ onScanSuccess, onCancel }: Props): JSX.Element => {
  const { authorizeDeviceWithQRCode } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const device = useCameraDevice('back');

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
    const status = await Camera.getCameraPermissionStatus();
    if (status !== 'granted') {
      const newStatus = await Camera.requestCameraPermission();
      setHasPermission(newStatus === 'granted');
    } else {
      setHasPermission(true);
    }
  };

  const requestPermission = async () => {
    const status = await Camera.requestCameraPermission();
    if (status === 'denied') {
      await Linking.openSettings();
    }
    setHasPermission(status === 'granted');
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
          { text: 'Cancel', onPress: onCancel }
        ]);
      }
    } catch (error) {
      console.error('QR Code authentication error:', error);
      Alert.alert('Error', 'Failed to authenticate. Please try again.', [
        { text: 'Try Again', onPress: () => { setScanned(false); setIsLoading(false); } },
        { text: 'Cancel', onPress: onCancel }
      ]);
    }
  };

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
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onCancel}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan QR Code</Text>
        <View style={styles.placeholder} />
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
          <Text style={styles.instructionText}>Point your camera at the QR code</Text>
        </View>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Authenticating...</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.resetButton} onPress={() => { setScanned(false); setIsLoading(false); }} disabled={isLoading}>
          <Ionicons name="refresh" size={20} color="white" />
          <Text style={styles.resetButtonText}>Reset Scanner</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.8)' },
  backButton: { padding: 10 },
  headerText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  placeholder: { width: 44 },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanArea: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#FFD700', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  instructionText: { color: 'white', fontSize: 16, textAlign: 'center', marginTop: 30, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 5 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'white', fontSize: 16, marginTop: 10 },
  footer: { padding: 20, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center' },
  resetButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  resetButtonText: { color: 'white', fontSize: 16, marginLeft: 8 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  permissionTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 20, marginBottom: 15 },
  permissionText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  permissionButton: { backgroundColor: '#10B981', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25, marginBottom: 15 },
  permissionButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25 },
  cancelButtonText: { color: 'white', fontSize: 16 },
});

export default SimpleQRScanner;

