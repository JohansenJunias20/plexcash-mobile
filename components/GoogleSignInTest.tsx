import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import GoogleAuthService from '../services/googleAuth';

const GoogleSignInTest = (): JSX.Element => {
  const testGoogleConfiguration = () => {
    const configStatus = GoogleAuthService.getConfigurationStatus();
    Alert.alert('Google Sign-In Configuration Status', `Status: ${configStatus.configured ? 'Configured ✅' : 'Needs Configuration ⚠️'}\n\nMessage: ${configStatus.message}\n\n${configStatus.instructions ? `Instructions:\n${configStatus.instructions.join('\n')}` : 'Ready to use!'}`, [{ text: 'OK' }]);
  };

  const testGoogleSignIn = async () => {
    try {
      Alert.alert('Testing Google Sign-In', 'Starting Google Sign-In test...');
      const result = await GoogleAuthService.signInWithGoogle();
      if (result.success) {
        Alert.alert('Google Sign-In Success! 🎉', `User: ${result.user.email}\nDisplay Name: ${result.user.displayName}\nEmail Verified: ${result.user.emailVerified}`);
      } else {
        Alert.alert('Google Sign-In Result', result.error || 'Sign-in failed', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `Google Sign-In test failed: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Google Sign-In Test</Text>
      <Text style={styles.subtitle}>Test your Google Sign-In configuration for the Plexcash Mobile app</Text>
      <TouchableOpacity style={styles.button} onPress={testGoogleConfiguration}>
        <Text style={styles.buttonText}>Check Configuration Status</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={testGoogleSignIn}>
        <Text style={styles.buttonText}>Test Google Sign-In</Text>
      </TouchableOpacity>
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Project Information:</Text>
        <Text style={styles.infoText}>• Project ID: plex-seller-id</Text>
        <Text style={styles.infoText}>• Sender ID: 227685404880</Text>
        <Text style={styles.infoText}>• Same Firebase project as web app</Text>
      </View>
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Quick Setup:</Text>
        <Text style={styles.instructionsText}>1. Get Web Client ID from Firebase Console{`\n`}2. Update GOOGLE_CLIENT_ID in services/googleAuth.js{`\n`}3. Set ENABLE_GOOGLE_SIGNIN to true{`\n`}4. Configure redirect URI in Google Cloud Console</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#333' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 30, color: '#666', lineHeight: 22 },
  button: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 8, marginBottom: 15, alignItems: 'center' },
  googleButton: { backgroundColor: '#4285F4' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  infoContainer: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 8, marginTop: 20, marginBottom: 15 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#1976d2' },
  infoText: { fontSize: 14, color: '#1565c0', marginBottom: 4 },
  instructionsContainer: { backgroundColor: '#fff3e0', padding: 15, borderRadius: 8 },
  instructionsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#f57c00' },
  instructionsText: { fontSize: 14, color: '#ef6c00', lineHeight: 20 },
});

export default GoogleSignInTest;

