import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ItemDetail {
  id: string;
  nama: string;
  merk: string;
  kategori: string;
  qty: number;
  qty_print: string;
  hargabeli: string;
  hargabeli_exppn: string;
  price_list: string;
}

interface EditItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (item: ItemDetail) => void;
  item: ItemDetail | null;
  usePPN: boolean;
  ppnRate: number;
}

const EditItemModal: React.FC<EditItemModalProps> = ({
  visible,
  onClose,
  onSave,
  item,
  usePPN,
  ppnRate,
}) => {
  const [editedItem, setEditedItem] = useState<ItemDetail | null>(item);

  React.useEffect(() => {
    setEditedItem(item);
  }, [item]);

  if (!editedItem) return null;

  const handleSave = () => {
    onSave(editedItem);
    onClose();
  };

  const calculateHargaBeli = () => {
    if (usePPN) {
      const dpp = parseFloat(editedItem.hargabeli_exppn || '0');
      return (dpp * (1 + ppnRate / 100)).toFixed(2);
    } else {
      const priceList = parseFloat(editedItem.price_list || '0');
      return priceList.toFixed(2);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Edit Item</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            {/* ID (Read-only) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>ID Barang</Text>
              <TextInput
                style={[styles.input, styles.inputReadonly]}
                value={editedItem.id}
                editable={false}
              />
            </View>

            {/* Nama Barang */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nama Barang</Text>
              <TextInput
                style={styles.input}
                value={editedItem.nama}
                onChangeText={(val) => setEditedItem({ ...editedItem, nama: val })}
                placeholder="Nama barang"
              />
            </View>

            {/* Qty */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Qty</Text>
              <TextInput
                style={styles.input}
                value={String(editedItem.qty)}
                onChangeText={(val) => setEditedItem({ ...editedItem, qty: parseFloat(val) || 0 })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            {/* Qty Print */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Qty Print</Text>
              <TextInput
                style={styles.input}
                value={editedItem.qty_print}
                onChangeText={(val) => setEditedItem({ ...editedItem, qty_print: val })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            {/* Price List / DPP */}
            {usePPN ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>DPP (Exclude PPN)</Text>
                <TextInput
                  style={styles.input}
                  value={editedItem.hargabeli_exppn}
                  onChangeText={(val) => {
                    const dpp = parseFloat(val) || 0;
                    const inclPPN = dpp * (1 + ppnRate / 100);
                    setEditedItem({
                      ...editedItem,
                      hargabeli_exppn: val,
                      hargabeli: inclPPN.toFixed(2),
                    });
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Price List</Text>
                <TextInput
                  style={styles.input}
                  value={editedItem.price_list}
                  onChangeText={(val) => {
                    setEditedItem({
                      ...editedItem,
                      price_list: val,
                      hargabeli: val,
                    });
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
            )}

            {/* Harga Beli (Calculated) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {usePPN ? 'Harga Incl PPN' : 'Harga Beli'}
              </Text>
              <TextInput
                style={[styles.input, styles.inputReadonly]}
                value={calculateHargaBeli()}
                editable={false}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Simpan</Text>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
  inputReadonly: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default EditItemModal;
