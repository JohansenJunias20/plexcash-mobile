import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth } from '../config/firebase';
import ApiService from '../services/api';

const AuthTest = (): JSX.Element => {
  const testFirebaseConnection = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        Alert.alert('Firebase Status', `Connected as: ${user.email}`);
      } else {
        Alert.alert('Firebase Status', 'Not authenticated');
      }
    } catch (error: any) {
      Alert.alert('Firebase Error', error.message);
    }
  };

  const testBackendConnection = async () => {
    try {
      const result = await ApiService.checkAuthStatus();
      Alert.alert('Backend Status', JSON.stringify(result));
    } catch (error) {
      Alert.alert('Backend Error', 'Backend connection test failed (expected until URL is configured)');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Auth Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={testFirebaseConnection}>
        <Text style={styles.buttonText}>Test Firebase Connection</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={testBackendConnection}>
        <Text style={styles.buttonText}>Test Backend Connection</Text>
      </TouchableOpacity>
      
      <Text style={styles.info}>
        This component helps test the Firebase authentication setup.
        Remove this component once authentication is working properly.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, color: '#333' },
  button: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginBottom: 15, minWidth: 200 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  info: { marginTop: 30, fontSize: 14, color: '#666', textAlign: 'center', fontStyle: 'italic' },
});

export default AuthTest;

