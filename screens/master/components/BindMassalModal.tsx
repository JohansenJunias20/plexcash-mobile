import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showMessage } from 'react-native-flash-message';
import ApiService from '../../../services/api';

interface BindMassalModalProps {
  visible: boolean;
  selectedIds: (number | string)[];
  idEcommerce: number;
  onClose: () => void;
  onSuccess: () => void;
}

const BindMassalModal: React.FC<BindMassalModalProps> = ({
  visible,
  selectedIds,
  idEcommerce,
  onClose,
  onSuccess,
}) => {
  const [bindType, setBindType] = useState<'barang' | 'bundling'>('barang');
  const [isBinding, setIsBinding] = useState(false);

  const handleBind = async () => {
    if (selectedIds.length === 0) {
      showMessage({
        message: 'Peringatan',
        description: 'Tidak ada produk yang dipilih',
        type: 'warning',
      });
      return;
    }

    setIsBinding(true);

    try {
      const endpoint = bindType === 'barang' ? '/bind-barang-massal' : '/bind-bundling-massal';

      const response = await ApiService.post(endpoint, {
        ids: selectedIds,
        id_ecommerce: idEcommerce,
      });

      if (response?.success) {
        const data = response.data;
        const successCount = data?.success || 0;
        const failedCount = data?.failed || 0;

        showMessage({
          message: 'Berhasil',
          description: `Bind berhasil: ${successCount}, Gagal: ${failedCount}`,
          type: 'success',
          duration: 4000,
        });

        onSuccess();
      } else {
        throw new Error(response?.message || 'Bind gagal');
      }
    } catch (error: any) {
      console.error('Error binding products:', error);
      showMessage({
        message: 'Error',
        description: error.message || 'Gagal melakukan bind',
        type: 'danger',
        duration: 4000,
      });
    } finally {
      setIsBinding(false);
    }
  };

  const handleClose = () => {
    if (!isBinding) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Bind Massal</Text>
            <TouchableOpacity onPress={handleClose} disabled={isBinding}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={24} color="#3b82f6" />
              <Text style={styles.infoText}>
                Sistem akan mencocokkan SKU produk dari marketplace dengan SKU di PlexSeller.
                {'\n\n'}
                Produk yang dipilih: <Text style={styles.infoBold}>{selectedIds.length}</Text>
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bind ke:</Text>

              <TouchableOpacity
                style={[styles.radioOption, bindType === 'barang' && styles.radioOptionSelected]}
                onPress={() => setBindType('barang')}
                disabled={isBinding}
              >
                <Ionicons
                  name={bindType === 'barang' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={bindType === 'barang' ? '#fbbf24' : '#9ca3af'}
                />
                <View style={styles.radioContent}>
                  <Text style={styles.radioLabel}>Master Barang</Text>
                  <Text style={styles.radioDescription}>Bind produk ke master barang utama</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.radioOption, bindType === 'bundling' && styles.radioOptionSelected]}
                onPress={() => setBindType('bundling')}
                disabled={isBinding}
              >
                <Ionicons
                  name={bindType === 'bundling' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={bindType === 'bundling' ? '#fbbf24' : '#9ca3af'}
                />
                <View style={styles.radioContent}>
                  <Text style={styles.radioLabel}>Bundling</Text>
                  <Text style={styles.radioDescription}>Bind produk ke bundling</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={isBinding}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.bindButton, isBinding && styles.buttonDisabled]} onPress={handleBind} disabled={isBinding}>
              {isBinding ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.bindButtonText}>Bind Sekarang</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  content: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  radioOptionSelected: {
    borderColor: '#fbbf24',
    backgroundColor: '#fef3c7',
  },
  radioContent: {
    flex: 1,
    gap: 4,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  radioDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  bindButton: {
    backgroundColor: '#fbbf24',
  },
  bindButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default BindMassalModal;
