import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import * as Clipboard from 'expo-clipboard';

interface Props {
  open: boolean;
  onClose: () => void;
  id_ecommerce: number;
  onConfirm: (appId: string, apiKey: string, apiSecret: string) => void;
}

export default function ModalTokopediaApiKey({ open, onClose, id_ecommerce, onConfirm }: Props) {
  const [appId, setAppId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && id_ecommerce > 0) {
      fetchApiKey();
    }
  }, [open, id_ecommerce]);

  const fetchApiKey = async () => {
    try {
      setLoading(true);
      const response = await ApiService.get(`/get/tokopedia/apikey?id_ecommerce=${id_ecommerce}`);
      if (response.status && response.data) {
        setAppId(response.data.app_id || '');
        setApiKey(response.data.key || '');
        setApiSecret(response.data.secret || '');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyIpAddress = async () => {
    await Clipboard.setStringAsync('45.32.116.20');
    Alert.alert('Disalin', 'IP Address 45.32.116.20 berhasil disalin.');
  };

  return (
    <Modal visible={open} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>API KEY Tokopedia</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {loading ? (
              <ActivityIndicator size="large" color="#f59e0b" style={{ marginVertical: 20 }} />
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="APP ID"
                  value={appId}
                  onChangeText={setAppId}
                />
                <TextInput
                  style={styles.input}
                  placeholder="API Key"
                  value={apiKey}
                  onChangeText={setApiKey}
                />
                <TextInput
                  style={styles.input}
                  placeholder="API Secret"
                  value={apiSecret}
                  onChangeText={setApiSecret}
                  secureTextEntry
                />

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={24} color="#0284c7" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoText}>
                      Harap konfigurasi <Text style={{ fontWeight: 'bold' }}>IP Address Whitelist</Text>{' '}
                      pada akun Tokopedia Anda dengan IP Address berikut:
                    </Text>
                    <TouchableOpacity onPress={copyIpAddress} style={styles.ipButton}>
                      <Text style={styles.ipText}>45.32.116.20</Text>
                      <Ionicons name="copy-outline" size={16} color="#0284c7" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => onConfirm(appId, apiKey, apiSecret)}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>SUBMIT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    color: '#0369a1',
    lineHeight: 18,
  },
  ipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 4,
  },
  ipText: {
    fontWeight: 'bold',
    color: '#0284c7',
    marginRight: 6,
    fontSize: 14,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
