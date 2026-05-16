import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import * as Clipboard from 'expo-clipboard';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (idEcommerce: number) => void;
  platform: string;
  shop_id: string;
}

export default function ModalMarketplace({ open, onClose, onSuccess, platform, shop_id }: Props) {
  const [shopDomain, setShopDomain] = useState('');
  const [shopName, setShopName] = useState('');
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [appId, setAppId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [blibliAPIKey, setBliBliAPIKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (platform === 'TOKOPEDIA' && !shopDomain) {
      Alert.alert('Error', 'Harap isi shop domain');
      return;
    }
    if (platform === 'BLIBLI') {
      if (!shopDomain) {
        Alert.alert('Error', 'Harap isi Kode Toko');
        return;
      }
      if (!blibliAPIKey) {
        Alert.alert('Error', 'Harap isi Kata sandi API');
        return;
      }
    }
    if (!shopName) {
      Alert.alert('Error', 'Harap isi nama toko');
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.post('/shop/add', {
        domain: shopDomain,
        platform,
        name: shopName,
        shop_id,
        app_id: appId,
        api_key: apiKey,
        api_secret: apiSecret,
        blibli_api_key: blibliAPIKey,
      });

      if (response.status) {
        if (onSuccess && response.id_ecommerce) {
          onSuccess(response.id_ecommerce);
        } else {
          onClose();
        }
      } else {
        Alert.alert('Error', response.reason || 'Gagal menambahkan toko');
        onClose();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Terjadi kesalahan jaringan');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Disalin', 'ID API berhasil disalin ke clipboard');
  };

  return (
    <Modal visible={open} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tambah Toko</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.description}>
              Masukkan nama toko baru untuk <Text style={{ fontWeight: 'bold' }}>{shop_id}</Text>{' '}
              dari marketplace <Text style={{ fontWeight: 'bold' }}>{platform}</Text>
            </Text>

            {platform === 'TOKOPEDIA' && (
              <View style={styles.section}>
                {/* Images in RN need remote uri or local require, we will skip images for now 
                    or use placeholders since it's just examples. Let's just use text help. */}
                <Text style={styles.helpText}>Domain dapat dilihat pada URL toko Anda.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Shop Code (Contoh: lovelyshop)"
                  value={shopDomain}
                  onChangeText={setShopDomain}
                />
              </View>
            )}

            {platform === 'BLIBLI' && (
              <View style={styles.section}>
                <Text style={styles.helpText}>
                  Profile &gt; Pengaturan Seller API &gt; Kode Toko
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Kode Toko (Contoh: HFW-120)"
                  value={shopDomain}
                  onChangeText={setShopDomain}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Kata Sandi API"
                  value={blibliAPIKey}
                  onChangeText={setBliBliAPIKey}
                  secureTextEntry
                />
                <View style={styles.alertBox}>
                  <Text style={styles.alertText}>
                    Silahkan masukkan{' '}
                    <Text style={{ fontWeight: 'bold' }}>mta-api-plexselleromnich-3d691</Text> ke ID
                    API klien di menu Pengaturan Seller API.
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard('mta-api-plexselleromnich-3d691')}
                    style={styles.copyButton}
                  >
                    <Ionicons name="copy-outline" size={20} color="#1f2937" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Shop Name (Opsional)"
              value={shopName}
              onChangeText={setShopName}
            />

            {platform === 'TOKOPEDIA' && (
              <View style={styles.section}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Punya API Key Tokopedia sendiri?</Text>
                  <Switch value={useOwnKey} onValueChange={setUseOwnKey} />
                </View>

                {useOwnKey && (
                  <View style={styles.ownKeyContainer}>
                    <Text style={styles.helpText}>Masukkan API key Anda:</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="App ID"
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
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>SUBMIT</Text>
              )}
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
    maxHeight: '80%',
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
  description: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 16,
    lineHeight: 20,
  },
  section: {
    marginBottom: 16,
  },
  helpText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
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
  alertBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    marginRight: 8,
    lineHeight: 18,
  },
  copyButton: {
    padding: 8,
    backgroundColor: '#fde68a',
    borderRadius: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  ownKeyContainer: {
    marginTop: 8,
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
