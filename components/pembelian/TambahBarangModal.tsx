import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';

export interface NewBarangData {
  id: number;
  nama: string;
  merk: string;
  satuan: string;
  kategori: string;
  harga_jual: string;
  berat: string;
  sku: string;
  barcode: string;
}

interface TambahBarangModalProps {
  visible: boolean;
  onClose: () => void;
  onDone: (data: NewBarangData) => void;
  title?: string;
}

const TambahBarangModal: React.FC<TambahBarangModalProps> = ({
  visible,
  onClose,
  onDone,
  title = 'Tambah Barang Baru',
}) => {
  const [nama, setNama] = useState('');
  const [merk, setMerk] = useState('');
  const [satuan, setSatuan] = useState('');
  const [kategori, setKategori] = useState('');
  const [hargaJual, setHargaJual] = useState('');
  const [berat, setBerat] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setNama('');
    setMerk('');
    setSatuan('');
    setKategori('');
    setHargaJual('');
    setBerat('');
    setSku('');
    setBarcode('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    // Validation
    if (!nama.trim()) {
      Alert.alert('Error', 'Nama barang harus diisi');
      return;
    }

    try {
      setSaving(true);
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const payload = {
        data: [{
          stok_online: 0,
          nama: nama.trim(),
          merk: merk.trim(),
          satuan: satuan.trim(),
          kategori: kategori.trim(),
          hargajual: hargaJual === '' ? 0 : parseFloat(hargaJual),
          hargajual2: 0,
          hargabeli: 0,
          stok: 0,
          minstok: 0,
          pesan: false,
          berat: berat === '' ? 0 : parseFloat(berat),
          sku: sku.trim(),
          barcode: barcode.trim(),
          hpp: 0,
          dpp: 0,
        }]
      };

      const res = await fetch(`${API_BASE_URL}/masterbarang`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status) {
        const newBarang: NewBarangData = {
          id: data.id[0],
          nama: nama.trim(),
          merk: merk.trim(),
          satuan: satuan.trim(),
          kategori: kategori.trim(),
          harga_jual: hargaJual,
          berat,
          sku: sku.trim(),
          barcode: barcode.trim(),
        };
        
        Alert.alert('Sukses', 'Barang berhasil ditambahkan');
        onDone(newBarang);
        resetForm();
        onClose();
      } else {
        Alert.alert('Error', data.reason?.message || 'Gagal menambahkan barang');
      }
    } catch (error) {
      console.error('Save barang error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan barang');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nama Barang <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan nama barang"
                value={nama}
                onChangeText={setNama}
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Merk</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan merk"
                value={merk}
                onChangeText={setMerk}
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Kategori</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan kategori"
                value={kategori}
                onChangeText={setKategori}
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Satuan</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan satuan (pcs, box, dll)"
                value={satuan}
                onChangeText={setSatuan}
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>SKU</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan SKU"
                value={sku}
                onChangeText={setSku}
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Barcode</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan barcode"
                value={barcode}
                onChangeText={setBarcode}
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Harga Jual</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={hargaJual}
                onChangeText={setHargaJual}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Berat (gram)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={berat}
                onChangeText={setBerat}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Simpan</Text>
              )}
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
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: 'white',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: '#f59e0b',
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default TambahBarangModal;

