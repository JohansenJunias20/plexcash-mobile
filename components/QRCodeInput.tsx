import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
    const cleanData = qrData.trim();
    if (!cleanData) { Alert.alert('Error', 'Silakan masukkan teks data QR Code'); return; }
    setIsLoading(true);
    try {
      const result = await authorizeDeviceWithQRCode(cleanData);
      if (result.success) {
        Alert.alert('Perangkat Berhasil Diotorisasi!', result.message || 'Perangkat Anda telah diotorisasi secara permanen.', [
          { text: 'OK', onPress: () => onScanSuccess({}, '') }
        ]);
      } else {
        Alert.alert('Otorisasi Perangkat Gagal', result.message || 'Teks QR Code tidak valid atau otorisasi gagal', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('QR Code authentication error:', error);
      Alert.alert('Error', 'Gagal melakukan autentikasi. Silakan coba lagi.', [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setQrData(text.trim());
      } else {
        Alert.alert('Clipboard Kosong', 'Tidak ada teks yang disalin pada clipboard.');
      }
    } catch (e) {
      console.warn('Failed to read clipboard:', e);
    }
  };

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onCancel}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Input QR Code Manual</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Input QR Code Manual</Text>
            <Text style={styles.subtitle}>Masukkan atau salin data QR Code dari aplikasi web PlexCash</Text>

            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Data QR Code:</Text>
                <TouchableOpacity style={styles.pasteButton} onPress={handlePasteClipboard}>
                  <Ionicons name="clipboard-outline" size={16} color="#FFD700" />
                  <Text style={styles.pasteButtonText}>Paste</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.textInput} value={qrData} onChangeText={setQrData} placeholder="plexcash-auth:session:timestamp:email" placeholderTextColor="#9CA3AF" multiline numberOfLines={4} textAlignVertical="top" />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={handleSubmit} disabled={isLoading || !qrData.trim()}>
                {isLoading ? (<ActivityIndicator color="white" />) : (<><Ionicons name="log-in" size={20} color="white" /><Text style={styles.buttonText}>Autentikasi</Text></>)}
              </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>Cara penggunaan di Huawei Tab:</Text>
              <Text style={styles.infoText}>1. Buka aplikasi web PlexCash di browser{`\n`}2. Klik "Generate QR Code for Mobile Login"{`\n`}3. Salin/copy teks QR code yang tertera{`\n`}4. Tekan tombol "Paste" di atas{`\n`}5. Tekan "Autentikasi" untuk login</Text>
            </View>

            <View style={styles.formatContainer}>
              <Text style={styles.formatTitle}>Format yang diharapkan:</Text>
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
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  inputContainer: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  inputLabel: { color: 'white', fontSize: 16, fontWeight: '600' },
  pasteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, gap: 4 },
  pasteButtonText: { color: '#FFD700', fontSize: 13, fontWeight: '600' },
  textInput: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 15, fontSize: 14, color: '#1F2937', minHeight: 100, fontFamily: 'monospace' },
  buttonContainer: { gap: 12, marginBottom: 25 } as any,
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 12, gap: 8 },
  submitButton: { backgroundColor: '#10B981' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  infoContainer: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, marginBottom: 20 },
  infoTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  infoText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
  formatContainer: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 15 },
  formatTitle: { color: 'white', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  formatText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace' },
});

export default QRCodeInput;


