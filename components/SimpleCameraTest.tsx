import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';

interface Props { onClose: () => void }

const SimpleCameraTest = ({ onClose }: Props): JSX.Element => {
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      if (codes.length > 0) {
        const code = codes[0];
        console.log('Barcode scanned:', { type: code.type, data: code.value });
        alert(`QR Code scanned: ${code.value}`);
      }
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
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission not granted</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Camera Test</Text>
      </View>

      <Camera style={styles.camera} device={device} isActive={true} codeScanner={codeScanner} />

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>Point camera at QR code</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.8)' },
  closeButton: { padding: 10 },
  headerText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 20 },
  camera: { flex: 1 },
  overlay: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
  overlayText: { color: 'white', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 5 },
  text: { color: 'white', fontSize: 16, textAlign: 'center', margin: 20 },
  button: { backgroundColor: '#FFD700', padding: 15, margin: 20, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'black', fontSize: 16, fontWeight: 'bold' },
});

export default SimpleCameraTest;

