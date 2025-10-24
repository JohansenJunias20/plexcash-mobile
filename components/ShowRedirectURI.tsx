import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as AuthSession from 'expo-auth-session';

const ShowRedirectURI = (): JSX.Element => {
  const [redirectUri, setRedirectUri] = useState('');

  useEffect(() => {
    const uri = AuthSession.makeRedirectUri({ useProxy: true, preferLocalhost: true });
    setRedirectUri(uri);
  }, []);

  const copyToClipboard = () => {
    Alert.alert('Redirect URI untuk Firebase', `Copy URI ini ke Firebase Console:\n\n${redirectUri}`, [{ text: 'OK', style: 'default' }]);
  };

  const showInstructions = () => {
    Alert.alert('Cara Menambahkan ke Firebase', '1. Buka Firebase Console\n2. Pilih project: plex-seller-id\n3. Go to Authentication > Sign-in method\n4. Click Google provider\n5. Tambahkan domain: auth.expo.io\n6. Atau go to Google Cloud Console > Credentials\n7. Edit OAuth 2.0 Client\n8. Tambahkan Authorized redirect URI', [{ text: 'OK' }]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Redirect URI Configuration</Text>
      
      <View style={styles.uriContainer}>
        <Text style={styles.label}>Redirect URI yang digunakan:</Text>
        <Text style={styles.uri}>{redirectUri}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={copyToClipboard}>
        <Text style={styles.buttonText}>Show URI untuk Copy</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.instructionButton]} onPress={showInstructions}>
        <Text style={styles.buttonText}>Cara Konfigurasi Firebase</Text>
      </TouchableOpacity>

      <View style={styles.domainsContainer}>
        <Text style={styles.domainsTitle}>Authorized Domains yang perlu ditambahkan:</Text>
        <Text style={styles.domain}>• auth.expo.io</Text>
        <Text style={styles.domain}>• localhost</Text>
        <Text style={styles.domain}>• 127.0.0.1</Text>
      </View>

      <View style={styles.noteContainer}>
        <Text style={styles.noteTitle}>Catatan:</Text>
        <Text style={styles.noteText}>
          • Tambahkan redirect URI di Google Cloud Console {'>'} APIs & Services {'>'} Credentials
          {'\n'}• Edit OAuth 2.0 Client yang sesuai dengan Web Client ID Anda
          {'\n'}• Atau konfigurasi Authorized domains di Firebase Console
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  uriContainer: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 8, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#1976d2' },
  uri: { fontSize: 12, color: '#1565c0', fontFamily: 'monospace', backgroundColor: '#fff', padding: 10, borderRadius: 4 },
  button: { backgroundColor: '#4285F4', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  instructionButton: { backgroundColor: '#f59e0b' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  domainsContainer: { backgroundColor: '#fff3e0', padding: 15, borderRadius: 8, marginTop: 20, marginBottom: 15 },
  domainsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#f57c00' },
  domain: { fontSize: 14, color: '#ef6c00', marginBottom: 4 },
  noteContainer: { backgroundColor: '#f3e5f5', padding: 15, borderRadius: 8 },
  noteTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#7b1fa2' },
  noteText: { fontSize: 14, color: '#6a1b9a', lineHeight: 20 },
});

export default ShowRedirectURI;

