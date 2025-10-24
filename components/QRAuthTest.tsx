import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../services/api';

type TestResult = { test: string; result: 'PASS' | 'FAIL' | 'ERROR' | 'TESTING'; details: string; timestamp: string };

const QRAuthTest = (): JSX.Element => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addTestResult = (test: string, result: TestResult['result'], details = '') => {
    setTestResults(prev => [...prev, { test, result, details, timestamp: new Date().toLocaleTimeString() }]);
  };

  const testQRCodeAuthentication = async () => {
    setIsLoading(true);
    setTestResults([]);

    try {
      const validQRData = `plexcash-auth:test-session-${Date.now()}:${Date.now()}:test@plexseller.com`;
      addTestResult('QR Code Format', 'TESTING', `Testing with: ${validQRData.substring(0, 50)}...`);
      const response = await ApiService.authorizeDevice(validQRData);
      if (response.success) addTestResult('QR Code Authentication', 'PASS', 'Authentication successful');
      else addTestResult('QR Code Authentication', 'FAIL', response.message || 'Unknown error');
    } catch (error: any) {
      addTestResult('QR Code Authentication', 'ERROR', error.message);
    }

    try {
      const invalidQRData = 'invalid-qr-code-data';
      addTestResult('Invalid QR Format', 'TESTING', 'Testing with invalid format');
      const response = await ApiService.authorizeDevice(invalidQRData);
      if (!response.success) addTestResult('Invalid QR Format', 'PASS', 'Correctly rejected invalid format');
      else addTestResult('Invalid QR Format', 'FAIL', 'Should have rejected invalid format');
    } catch (error) {
      addTestResult('Invalid QR Format', 'PASS', 'Correctly threw error for invalid format');
    }

    try {
      const expiredTimestamp = Date.now() - (10 * 60 * 1000);
      const expiredQRData = `plexcash-auth:expired-session:${expiredTimestamp}:test@plexseller.com`;
      addTestResult('Expired QR Code', 'TESTING', 'Testing with expired timestamp');
      const response = await ApiService.authorizeDevice(expiredQRData);
      if (!response.success && (response.message || '').includes('expired')) addTestResult('Expired QR Code', 'PASS', 'Correctly rejected expired QR code');
      else addTestResult('Expired QR Code', 'FAIL', 'Should have rejected expired QR code');
    } catch (error: any) {
      addTestResult('Expired QR Code', 'ERROR', error.message);
    }

    setIsLoading(false);
  };

  const clearResults = () => setTestResults([]);

  const getResultColor = (result: TestResult['result']) => {
    switch (result) {
      case 'PASS': return '#10B981';
      case 'FAIL': return '#EF4444';
      case 'ERROR': return '#F59E0B';
      case 'TESTING': return '#6B7280';
      default: return '#6B7280';
    }
  };

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>QR Code Authentication Test</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.testButton]} onPress={testQRCodeAuthentication} disabled={isLoading}>
            <Text style={styles.buttonText}>{isLoading ? 'Running Tests...' : 'Run QR Auth Tests'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearResults}>
            <Text style={styles.buttonText}>Clear Results</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultsContainer}>
          {testResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Text style={styles.testName}>{result.test}</Text>
                <Text style={[styles.resultStatus, { color: getResultColor(result.result) }]}>{result.result}</Text>
              </View>
              <Text style={styles.resultDetails}>{result.details}</Text>
              <Text style={styles.timestamp}>{result.timestamp}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Test Information:</Text>
          <Text style={styles.infoText}>
            • Tests QR code format validation{`\n`}• Tests authentication with valid data{`\n`}• Tests rejection of invalid formats{`\n`}• Tests expiration handling{`\n`}• Requires backend server to be running
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 30 },
  buttonContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  testButton: { backgroundColor: '#10B981' },
  clearButton: { backgroundColor: '#6B7280' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  resultsContainer: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: 15, marginBottom: 20 },
  resultItem: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#E5E7EB' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  testName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  resultStatus: { fontSize: 14, fontWeight: 'bold' },
  resultDetails: { fontSize: 14, color: '#6B7280', marginBottom: 5 },
  timestamp: { fontSize: 12, color: '#9CA3AF' },
  infoContainer: { backgroundColor: 'rgba(255,255,255,0.9)', padding: 15, borderRadius: 12 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
});

export default QRAuthTest;

