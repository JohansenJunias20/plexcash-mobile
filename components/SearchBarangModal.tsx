import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../services/api';
import { getTokenAuth } from '../services/token';

export interface BarangItem {
  id: number;
  nama: string;
  sku: string;
  kategori?: string;
  merk?: string;
  satuan?: string;
  stok?: number;
  hargajual?: number;
  hpp?: number;
}

interface SearchBarangModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (items: BarangItem[]) => void;
  multiSelect?: boolean;
  excludeIds?: number[]; // IDs to exclude from search results
  title?: string;
}

const SearchBarangModal: React.FC<SearchBarangModalProps> = ({
  visible,
  onClose,
  onSelect,
  multiSelect = false,
  excludeIds = [],
  title = 'Cari Barang',
}) => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BarangItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<BarangItem[]>([]);
  const [searchBy, setSearchBy] = useState<'nama' | 'sku'>('nama');

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setQuery('');
      setItems([]);
      setSelectedItems([]);
      setSearchBy('nama');
    }
  }, [visible]);

  const searchItems = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const qs = new URLSearchParams();
      qs.set('start', '0');
      qs.set('end', '50'); // Limit to 50 results for performance
      
      if (searchBy === 'sku') {
        qs.set('sku', searchQuery);
        qs.set('nama', '');
      } else {
        qs.set('nama', searchQuery);
        qs.set('sku', '');
      }

      const url = `${API_BASE_URL}/get/masterbarang/search?${qs.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.status) {
        // Filter out excluded items
        const filteredItems = data.data
          .filter((item: any) => !excludeIds.includes(item.id))
          .map((item: any) => ({
            id: item.id,
            nama: item.nama,
            sku: item.sku,
            kategori: item.kategori,
            merk: item.merk,
            satuan: item.satuan,
            stok: Number(item.stok) || 0,
            hargajual: Number(item.hargajual) || 0,
            hpp: Number(item.hpp) || 0,
          }));
        
        setItems(filteredItems);
      } else {
        console.warn('Search error:', data.reason);
        setItems([]);
      }
    } catch (error) {
      console.error('Search items error:', error);
      Alert.alert('Error', 'Failed to search items');
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (item: BarangItem) => {
    if (multiSelect) {
      const isSelected = selectedItems.some((i) => i.id === item.id);
      if (isSelected) {
        setSelectedItems(selectedItems.filter((i) => i.id !== item.id));
      } else {
        setSelectedItems([...selectedItems, item]);
      }
    } else {
      // Single select - immediately return and close
      onSelect([item]);
      onClose();
    }
  };

  const handleDone = () => {
    if (selectedItems.length === 0) {
      Alert.alert('Info', 'Pilih minimal 1 barang');
      return;
    }
    onSelect(selectedItems);
    onClose();
  };

  const renderItem = ({ item }: { item: BarangItem }) => {
    const isSelected = selectedItems.some((i) => i.id === item.id);

    return (
      <TouchableOpacity
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => handleItemPress(item)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.nama}
          </Text>
          <Text style={styles.itemSku}>
            {item.sku} • {item.merk || 'No Brand'}
          </Text>
          <View style={styles.itemDetails}>
            <Text style={styles.itemBadge}>Stok: {item.stok || 0}</Text>
            {item.hargajual && item.hargajual > 0 && (
              <Text style={styles.itemBadge}>
                Rp {item.hargajual.toLocaleString('id-ID')}
              </Text>
            )}
          </View>
        </View>
        {multiSelect && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
          </View>
        )}
      </TouchableOpacity>
    );
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
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder={`Cari berdasarkan ${searchBy}...`}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => searchItems()}
                returnKeyType="search"
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.searchActions}>
              <TouchableOpacity
                style={[
                  styles.searchByButton,
                  searchBy === 'nama' && styles.searchByButtonActive,
                ]}
                onPress={() => setSearchBy('nama')}
              >
                <Text
                  style={[
                    styles.searchByText,
                    searchBy === 'nama' && styles.searchByTextActive,
                  ]}
                >
                  Nama
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.searchByButton,
                  searchBy === 'sku' && styles.searchByButtonActive,
                ]}
                onPress={() => setSearchBy('sku')}
              >
                <Text
                  style={[
                    styles.searchByText,
                    searchBy === 'sku' && styles.searchByTextActive,
                  ]}
                >
                  SKU
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => searchItems()}
                disabled={loading}
              >
                <Text style={styles.searchButtonText}>Cari</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Results */}
          <View style={styles.resultsContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>Mencari...</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {query.trim() === ''
                    ? 'Masukkan kata kunci untuk mencari'
                    : 'Tidak ada barang ditemukan'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>

          {/* Footer - Only show for multi-select */}
          {multiSelect && (
            <View style={styles.footer}>
              <Text style={styles.selectedCount}>
                {selectedItems.length} item dipilih
              </Text>
              <TouchableOpacity
                style={[
                  styles.doneButton,
                  selectedItems.length === 0 && styles.doneButtonDisabled,
                ]}
                onPress={handleDone}
                disabled={selectedItems.length === 0}
              >
                <Text style={styles.doneButtonText}>Selesai</Text>
              </TouchableOpacity>
            </View>
          )}
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
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#111827',
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchByButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  searchByButtonActive: {
    backgroundColor: '#FEF3C7',
  },
  searchByText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  searchByTextActive: {
    color: '#D97706',
  },
  searchButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  itemCardSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  itemDetails: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemBadge: {
    backgroundColor: '#EEF2FF',
    color: '#3730A3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  doneButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  doneButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  doneButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default SearchBarangModal;
