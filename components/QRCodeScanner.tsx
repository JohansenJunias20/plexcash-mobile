import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Dimensions, ActivityIndicator, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

interface Props {
  onScanSuccess: (user: any, token: string) => void;
  onCancel: () => void;
}

const QRCodeScanner = ({ onScanSuccess, onCancel }: Props): JSX.Element => {
  const { authorizeDeviceWithQRCode } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (scanned || codes.length === 0) return;
      handleBarCodeScanned(codes[0].value || '');
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

  const handleBarCodeScanned = async (data: string) => {
    if (scanned) return;

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
      <View style={styles.container}>
        <Ionicons name="camera-off" size={64} color="#FFD700" />
        <Text style={styles.errorText}>No access to camera</Text>
        <Text style={styles.errorSubText}>Please enable camera permissions in your device settings to scan QR codes.</Text>
        <TouchableOpacity style={styles.cancelButton} onPress={requestPermission}>
          <Text style={styles.cancelButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { marginTop: 10 }]} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
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
      <LinearGradient colors={['rgba(0,0,0,0.8)', 'transparent', 'rgba(0,0,0,0.8)']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onCancel}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Scan QR Code</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.scannerContainer}>
          <Camera style={styles.scanner} device={device} isActive={!scanned && !isLoading} codeScanner={codeScanner} />

          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.loadingText}>Authenticating...</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.instructionText}>Position the QR code within the frame to scan</Text>
          <Text style={styles.subInstructionText}>Make sure the QR code is clearly visible and well-lit</Text>

          {scanned && !isLoading && (
            <TouchableOpacity style={styles.rescanButton} onPress={() => setScanned(false)}>
              <Text style={styles.rescanButtonText}>Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  gradient: { flex: 1, width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { padding: 10 },
  headerText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  placeholder: { width: 44 },
  scannerContainer: { flex: 1, position: 'relative' },
  scanner: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanArea: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#FFD700' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  footer: { padding: 30, alignItems: 'center' },
  instructionText: { color: 'white', fontSize: 16, textAlign: 'center', marginBottom: 8 },
  subInstructionText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  rescanButton: { backgroundColor: '#FFD700', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  rescanButtonText: { color: 'black', fontSize: 16, fontWeight: 'bold' },
  loadingText: { color: 'white', fontSize: 16, marginTop: 10 },
  errorText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  errorSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 10, marginHorizontal: 40, lineHeight: 20 },
  cancelButton: { backgroundColor: '#FFD700', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 30 },
  cancelButtonText: { color: 'black', fontSize: 16, fontWeight: 'bold' },
});

export default QRCodeScanner;

