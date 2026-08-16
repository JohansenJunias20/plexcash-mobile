import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Dimensions, ActivityIndicator, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import QRCodeInput from './QRCodeInput';
import PINLogin from './PINLogin';

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
  const [showManualInput, setShowManualInput] = useState(false);
  const [showPINLogin, setShowPINLogin] = useState(false);

  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const device = backDevice || frontDevice;

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (scanned || isLoading || codes.length === 0) return;
      handleBarCodeScanned(codes[0].value || '');
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

  const handleBarCodeScanned = async (data: string) => {
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
          { text: 'Login Kode PIN', onPress: () => setShowPINLogin(true) },
          { text: 'Enter Manually', onPress: () => setShowManualInput(true) },
          { text: 'Cancel', onPress: onCancel }
        ]);
      }
    } catch (error) {
      console.error('QR Code authentication error:', error);
      Alert.alert('Error', 'Failed to authenticate. Please try again.', [
        { text: 'Try Again', onPress: () => { setScanned(false); setIsLoading(false); } },
        { text: 'Login Kode PIN', onPress: () => setShowPINLogin(true) },
        { text: 'Enter Manually', onPress: () => setShowManualInput(true) },
        { text: 'Cancel', onPress: onCancel }
      ]);
    }
  };

  if (showPINLogin) {
    return <PINLogin onCancel={() => setShowPINLogin(false)} />;
  }

  if (showManualInput) {
    return <QRCodeInput onScanSuccess={onScanSuccess} onCancel={() => setShowManualInput(false)} />;
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-off" size={64} color="#FFD700" />
        <Text style={styles.errorText}>No Access to Camera</Text>
        <Text style={styles.errorSubText}>Camera permission is needed to scan QR codes. You can also enter the QR code text manually.</Text>
        <TouchableOpacity style={styles.cancelButton} onPress={requestPermission}>
          <Text style={styles.cancelButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { marginTop: 10, backgroundColor: '#10B981' }]} onPress={() => setShowPINLogin(true)}>
          <Text style={[styles.cancelButtonText, { color: 'white' }]}>Login Kode PIN Web</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { marginTop: 10, backgroundColor: '#6366F1' }]} onPress={() => setShowManualInput(true)}>
          <Text style={[styles.cancelButtonText, { color: 'white' }]}>Input QR Code Manual</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={onCancel}>
          <Text style={[styles.cancelButtonText, { color: 'white' }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Ionicons name="videocam-off-outline" size={64} color="#FFD700" style={{ marginBottom: 16 }} />
        <Text style={styles.errorText}>Kamera Tidak Terdeteksi</Text>
        <Text style={styles.errorSubText}>Perangkat ini tidak terdeteksi memiliki pemindai kamera standar. Silakan gunakan Kode PIN atau Input Manual.</Text>
        <TouchableOpacity style={[styles.cancelButton, { marginTop: 24, backgroundColor: '#10B981' }]} onPress={() => setShowPINLogin(true)}>
          <Text style={[styles.cancelButtonText, { color: 'white' }]}>Login Kode PIN Web</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { marginTop: 12, backgroundColor: '#6366F1' }]} onPress={() => setShowManualInput(true)}>
          <Text style={[styles.cancelButtonText, { color: 'white' }]}>Input QR Code Manual</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={onCancel}>
          <Text style={[styles.cancelButtonText, { color: 'white' }]}>Kembali</Text>
        </TouchableOpacity>
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
          <TouchableOpacity style={styles.manualHeaderButton} onPress={() => setShowManualInput(true)}>
            <Ionicons name="create-outline" size={22} color="#FFD700" />
          </TouchableOpacity>
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

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {scanned && !isLoading && (
              <TouchableOpacity style={styles.rescanButton} onPress={() => setScanned(false)}>
                <Text style={styles.rescanButtonText}>Scan Lagi</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.rescanButton, { backgroundColor: '#10B981' }]} onPress={() => setShowPINLogin(true)}>
              <Text style={[styles.rescanButtonText, { color: 'white' }]}>Kode PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.rescanButton, { backgroundColor: '#6366F1' }]} onPress={() => setShowManualInput(true)}>
              <Text style={[styles.rescanButtonText, { color: 'white' }]}>Input Manual</Text>
            </TouchableOpacity>
          </View>
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
  manualHeaderButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 },
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
  subInstructionText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  rescanButton: { backgroundColor: '#FFD700', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  rescanButtonText: { color: 'black', fontSize: 15, fontWeight: 'bold' },
  loadingText: { color: 'white', fontSize: 16, marginTop: 10 },
  errorText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  errorSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 10, marginHorizontal: 40, lineHeight: 20 },
  cancelButton: { backgroundColor: '#FFD700', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 30 },
  cancelButtonText: { color: 'black', fontSize: 16, fontWeight: 'bold' },
});

export default QRCodeScanner;


