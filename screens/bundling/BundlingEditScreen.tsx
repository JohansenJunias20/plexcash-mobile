import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import SearchBarangModal, { BarangItem } from '../../components/SearchBarangModal';

type Nav = NativeStackNavigationProp<AppStackParamList, 'BundlingEdit'>;
type RouteParams = RouteProp<AppStackParamList, 'BundlingEdit'>;

interface BundlingItemDetail {
  id: number;
  id_masterbarang: number;
  nama: string;
  sku: string;
  qty_required: number;
}

export default function BundlingEditScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const bundlingId = route.params?.id;
  const isEditMode = bundlingId !== undefined;

  // Form fields
  const [sku, setSku] = useState('');
  const [nama, setNama] = useState('');
  const [label, setLabel] = useState('');
  const [hargaJual, setHargaJual] = useState('');

  // Auto-calculated fields
  const [berat, setBerat] = useState(0);
  const [stok, setStok] = useState(0);
  const [hpp, setHpp] = useState(0);

  // Items in bundling
  const [items, setItems] = useState<BundlingItemDetail[]>([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchBundlingDetail();
    } else {
      // Set default title for create mode
      navigation.setOptions({ title: 'Bundling Baru' });
    }
  }, [bundlingId]);

  const fetchBundlingDetail = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Error', 'Session expired');
        navigation.goBack();
        return;
      }

      const url = `${API_BASE_URL}/get/bundling?id=${bundlingId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const response = await res.json();

      if (response.status) {
        const data = response.data;
        setSku(data.sku || '');
        setNama(data.nama || '');
        setLabel(data.label || '');
        setHargaJual(String(data.harga || data.hargajual || 0));
        setBerat(Number(data.berat) || 0);
        setStok(Number(data.stok) || 0);
        setHpp(Number(data.hpp) || 0);

        // Map items
        if (data.items && Array.isArray(data.items)) {
          setItems(
            data.items.map((item: any) => ({
              id: item.id,
              id_masterbarang: item.id_masterbarang || item.id,
              nama: item.nama,
              sku: item.sku,
              qty_required: Number(item.qty_required) || 0,
            }))
          );
        }

        navigation.setOptions({ title: 'Edit Bundling' });
      } else {
        Alert.alert('Error', response.reason || 'Failed to load bundling');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Fetch bundling detail error:', error);
      Alert.alert('Error', 'Failed to load bundling data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAddItems = (selectedItems: BarangItem[]) => {
    // Filter out items that are already in the list
    const existingIds = items.map((item) => item.id_masterbarang);
    const newItems = selectedItems
      .filter((item) => !existingIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        id_masterbarang: item.id,
        nama: item.nama,
        sku: item.sku,
        qty_required: 1, // Default quantity
      }));

    setItems([...items, ...newItems]);
  };

  const handleRemoveItem = (id_masterbarang: number) => {
    setItems(items.filter((item) => item.id_masterbarang !== id_masterbarang));
  };

  const handleQtyChange = (id_masterbarang: number, qty: string) => {
    const qtyNum = parseInt(qty) || 0;
    setItems(
      items.map((item) =>
        item.id_masterbarang === id_masterbarang
          ? { ...item, qty_required: qtyNum }
          : item
      )
    );
  };

  const validateForm = (): boolean => {
    if (!nama.trim()) {
      Alert.alert('Validasi', 'Silahkan isi nama bundling');
      return false;
    }

    if (items.length === 0) {
      Alert.alert('Validasi', 'Silahkan pilih minimal 1 item');
      return false;
    }

    const invalidItem = items.find((item) => item.qty_required <= 0);
    if (invalidItem) {
      Alert.alert('Validasi', 'Qty required tidak boleh <= 0');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Error', 'Session expired');
        return;
      }

      const payload = {
        nama,
        sku,
        label,
        harga_jual: parseFloat(hargaJual) || 0,
        items: items.map((item) => ({
          id: item.id_masterbarang,
          qty_required: item.qty_required,
        })),
      };

      const url = `${API_BASE_URL}/bundling`;
      const method = isEditMode ? 'PATCH' : 'POST';

      // Add id for edit mode
      const body = isEditMode
        ? { ...payload, id: bundlingId }
        : payload;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const response = await res.json();

      if (response.status) {
        Alert.alert(
          'Sukses',
          isEditMode
            ? 'Bundling berhasil diupdate'
            : 'Bundling berhasil dibuat',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.reason || 'Failed to save bundling');
      }
    } catch (error) {
      console.error('Save bundling error:', error);
      Alert.alert('Error', 'Failed to save bundling');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: BundlingItemDetail }) => (
    <View style={styles.itemCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.nama}
        </Text>
        <Text style={styles.itemSku}>{item.sku}</Text>
      </View>
      <View style={styles.qtyContainer}>
        <TextInput
          style={styles.qtyInput}
          value={String(item.qty_required)}
          onChangeText={(text) => handleQtyChange(item.id_masterbarang, text)}
          keyboardType="number-pad"
          selectTextOnFocus
        />
        <Text style={styles.qtyLabel}>qty</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item.id_masterbarang)}
      >
        <Ionicons name="close-circle" size={24} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Form Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Bundling</Text>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>SKU Bundling</Text>
              <TextInput
                style={styles.input}
                value={sku}
                onChangeText={setSku}
                placeholder="ex: PB1"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Nama Bundling <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={nama}
              onChangeText={setNama}
              placeholder="ex: Paket Beli 1 Gratis 1"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Label (Opsional)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="ex: Bundling Paket 1"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Harga Jual <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={hargaJual}
              onChangeText={setHargaJual}
              placeholder="ex: 50000"
              keyboardType="numeric"
            />
          </View>

          {/* Auto-calculated fields */}
          <View style={styles.formRow}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Berat Total (gr)</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={String(berat)}
                editable={false}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Stok</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={String(stok)}
                editable={false}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>HPP Total</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={String(hpp)}
                editable={false}
              />
            </View>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Items ({items.length})
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowSearchModal(true)}
            >
              <Ionicons name="add-circle" size={20} color="#f59e0b" />
              <Text style={styles.addButtonText}>Tambah Item</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Belum ada item</Text>
              <Text style={styles.emptySubtext}>
                Tap "Tambah Item" untuk menambahkan
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => String(item.id_masterbarang)}
              renderItem={renderItem}
              scrollEnabled={false}
              contentContainerStyle={styles.itemsList}
            />
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Batal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditMode ? 'Update' : 'Simpan'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Modal */}
      <SearchBarangModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelect={handleAddItems}
        multiSelect={true}
        excludeIds={items.map((item) => item.id_masterbarang)}
        title="Pilih Barang untuk Bundling"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    borderRadius: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
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
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f59e0b',
  },
  emptyItems: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  itemSku: {
    fontSize: 12,
    color: '#6B7280',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  qtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'white',
  },
  qtyLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
});
