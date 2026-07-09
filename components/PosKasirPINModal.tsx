import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';

interface Props {
  visible: boolean;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}

const PosKasirPINModal = ({ visible, onSuccess, onCancel }: Props): JSX.Element => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleValidatePIN = async () => {
    // Validate input
    if (!pin.trim()) {
      Alert.alert('Error', 'Silakan masukkan PIN');
      return;
    }

    setIsLoading(true);

    try {
      const result = await ApiService.validatePosKasirPIN(pin.trim());

      if (result.status) {
        // Success! Close modal and proceed, passing the validated PIN
        const validatedPin = pin.trim();
        setPin('');
        onSuccess(validatedPin);
      } else {
        Alert.alert('PIN Salah', result.reason || result.message || 'PIN tidak valid');
      }
    } catch (error) {
      console.error('PIN validation error:', error);
      Alert.alert('Error', 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setPin('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={48} color="#f59e0b" />
            <Text style={styles.title}>Otorisasi POS Kasir</Text>
            <Text style={styles.subtitle}>
              Masukkan PIN untuk membuka layar POS Kasir
            </Text>
          </View>

          <View style={styles.content}>
            <View style={styles.inputContainer}>
              <Ionicons name="keypad" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Masukkan PIN"
                placeholderTextColor="#9ca3af"
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                editable={!isLoading}
                autoFocus
                onSubmitEditing={handleValidatePIN}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton, isLoading && styles.buttonDisabled]}
                onPress={handleValidatePIN}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Validasi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#1f2937',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    backgroundColor: '#f59e0b',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default PosKasirPINModal;
