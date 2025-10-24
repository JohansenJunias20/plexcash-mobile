import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

interface Props {
  onScanSuccess: (user: any, token: string) => void;
  onCancel: () => void;
}

const QRCodeInput = ({ onScanSuccess, onCancel }: Props): JSX.Element => {
  const { authorizeDeviceWithQRCode } = useAuth();
  const [qrData, setQrData] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!qrData.trim()) { Alert.alert('Error', 'Please enter QR code data'); return; }
    setIsLoading(true);
    try {
      const result = await authorizeDeviceWithQRCode(qrData.trim());
      if (result.success) {
        Alert.alert('Device Authorized Successfully!', result.message || 'Your device has been permanently authorized. You will stay logged in until you manually sign out.', [
          { text: 'OK', onPress: () => onScanSuccess({}, '') }
        ]);
      } else {
        Alert.alert('Device Authorization Failed', result.message || 'Invalid QR code or device authorization failed', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('QR Code authentication error:', error);
      Alert.alert('Error', 'Failed to authenticate. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestData = () => {
    const testData = `plexcash-auth:test-session-${Date.now()}:${Date.now()}:test@plexseller.com`;
    setQrData(testData);
  };

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onCancel}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Enter QR Code</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Manual QR Code Entry</Text>
            <Text style={styles.subtitle}>Enter the QR code data from the web application</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>QR Code Data:</Text>
              <TextInput style={styles.textInput} value={qrData} onChangeText={setQrData} placeholder="plexcash-auth:session:timestamp:email" placeholderTextColor="#9CA3AF" multiline numberOfLines={4} textAlignVertical="top" />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={handleSubmit} disabled={isLoading || !qrData.trim()}>
                {isLoading ? (<ActivityIndicator color="white" />) : (<><Ionicons name="log-in" size={20} color="white" /><Text style={styles.buttonText}>Authenticate</Text></>)}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.testButton]} onPress={handleTestData} disabled={isLoading}>
                <Ionicons name="flask" size={20} color="white" />
                <Text style={styles.buttonText}>Insert Test Data</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>How to use:</Text>
              <Text style={styles.infoText}>1. Open PlexCash web application{`\n`}2. Generate QR code for mobile login{`\n`}3. Copy the QR code data{`\n`}4. Paste it in the text field above{`\n`}5. Tap "Authenticate" to login</Text>
            </View>

            <View style={styles.formatContainer}>
              <Text style={styles.formatTitle}>Expected Format:</Text>
              <Text style={styles.formatText}>plexcash-auth:[session]:[timestamp]:[email]</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { padding: 10 },
  headerText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  placeholder: { width: 44 },
  scrollContainer: { flex: 1 },
  formContainer: { padding: 20 },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center', marginBottom: 30 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: 15, fontSize: 14, color: '#1F2937', minHeight: 100, fontFamily: 'monospace' },
  buttonContainer: { gap: 12, marginBottom: 30 } as any,
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 12, gap: 8 },
  submitButton: { backgroundColor: '#10B981' },
  testButton: { backgroundColor: '#6366F1' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  infoContainer: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, marginBottom: 20 },
  infoTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  infoText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20 },
  formatContainer: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 15 },
  formatTitle: { color: 'white', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  formatText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace' },
});

export default QRCodeInput;

