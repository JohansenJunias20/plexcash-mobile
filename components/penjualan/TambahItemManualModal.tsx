import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ManualItemData {
  nama: string;
  hargajual: string;
  qty: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: ManualItemData) => void;
}

export default function TambahItemManualModal({ visible, onClose, onAdd }: Props) {
  const [nama, setNama] = useState('');
  const [hargajual, setHargajual] = useState('');
  const [qty, setQty] = useState('1');

  const handleAdd = () => {
    if (!nama.trim()) {
      Alert.alert('Error', 'Nama item wajib diisi');
      return;
    }
    if (!hargajual || parseFloat(hargajual) <= 0) {
      Alert.alert('Error', 'Harga jual harus lebih dari 0');
      return;
    }
    if (!qty || parseInt(qty) <= 0) {
      Alert.alert('Error', 'Qty harus lebih dari 0');
      return;
    }

    onAdd({ nama, hargajual, qty });
    
    // Reset form
    setNama('');
    setHargajual('');
    setQty('1');
    onClose();
  };

  const handleClose = () => {
    setNama('');
    setHargajual('');
    setQty('1');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Tambah Item Manual</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nama Item *</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan nama item"
                value={nama}
                onChangeText={setNama}
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Harga Jual *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={hargajual}
                onChangeText={setHargajual}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Qty *</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={qty}
                onChangeText={setQty}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Tambahkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

