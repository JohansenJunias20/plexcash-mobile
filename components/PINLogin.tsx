import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

interface Props {
  onCancel: () => void;
}

const PINLogin = ({ onCancel }: Props): JSX.Element => {
  const { authorizePIN } = useAuth();
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePINLogin = async () => {
    // Validate input
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!pinCode.trim()) {
      Alert.alert('Error', 'Please enter the PIN code');
      return;
    }

    if (!/^\d{10}$/.test(pinCode.trim())) {
      Alert.alert('Error', 'PIN code must be exactly 10 digits');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authorizePIN(email.trim(), pinCode.trim());

      if (result.success) {
        // Success! AuthContext will handle navigation
        console.log('PIN login successful!');
      } else {
        Alert.alert('Login Failed', result.message || 'Invalid email or PIN code');
      }
    } catch (error) {
      console.error('PIN login error:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
          </TouchableOpacity>
          <Text style={styles.title}>Login with PIN</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="keypad" size={80} color="#f59e0b" />
          </View>

          <Text style={styles.instructions}>
            Enter your email and the 10-digit PIN code generated from the web app
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="10-Digit PIN Code"
              placeholderTextColor="#9ca3af"
              value={pinCode}
              onChangeText={setPinCode}
              keyboardType="number-pad"
              maxLength={10}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handlePINLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="white" style={styles.buttonIcon} />
                <Text style={styles.loginButtonText}>Login</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#f59e0b" />
            <Text style={styles.infoText}>
              PIN codes expire after 5 minutes. Generate a new PIN from the web app if needed.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  instructions: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: '#1f2937',
  },
  loginButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
});

export default PINLogin;

