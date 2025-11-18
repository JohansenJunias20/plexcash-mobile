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
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';

export interface SupplierItem {
  id: number;
  nama: string;
  notelp?: string;
  nokantor?: string;
  email?: string;
  alamat?: string;
}

interface SearchSupplierModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (supplier: SupplierItem) => void;
  title?: string;
}

const SearchSupplierModal: React.FC<SearchSupplierModalProps> = ({
  visible,
  onClose,
  onSelect,
  title = 'Cari Supplier',
}) => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setQuery('');
      setItems([]);
      // Auto-load all suppliers when modal opens
      loadSuppliers();
    }
  }, [visible]);

  const loadSuppliers = async (searchQuery: string = '') => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const url = `${API_BASE_URL}/get/supplier`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.status) {
        let suppliers = data.data.map((item: any) => ({
          id: item.id,
          nama: item.nama,
          notelp: item.notelp,
          nokantor: item.nokantor,
          email: item.email,
          alamat: item.alamat,
        }));

        // Filter by search query if provided
        if (searchQuery.trim()) {
          const lowerQuery = searchQuery.toLowerCase();
          suppliers = suppliers.filter((s: SupplierItem) =>
            s.nama.toLowerCase().includes(lowerQuery) ||
            s.id.toString().includes(lowerQuery) ||
            (s.notelp && s.notelp.includes(lowerQuery)) ||
            (s.email && s.email.toLowerCase().includes(lowerQuery))
          );
        }
        
        setItems(suppliers);
      } else {
        console.warn('Load suppliers error:', data.reason);
        setItems([]);
      }
    } catch (error) {
      console.error('Load suppliers error:', error);
      Alert.alert('Error', 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadSuppliers(query);
  };

  const handleItemPress = (item: SupplierItem) => {
    onSelect(item);
    onClose();
  };

  const renderItem = ({ item }: { item: SupplierItem }) => {
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handleItemPress(item)}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.nama}
            </Text>
            <Text style={styles.itemId}>ID: {item.id}</Text>
          </View>
          {(item.notelp || item.email) && (
            <View style={styles.itemDetails}>
              {item.notelp && (
                <View style={styles.detailRow}>
                  <Ionicons name="call-outline" size={12} color="#6B7280" />
                  <Text style={styles.detailText}>{item.notelp}</Text>
                </View>
              )}
              {item.email && (
                <View style={styles.detailRow}>
                  <Ionicons name="mail-outline" size={12} color="#6B7280" />
                  <Text style={styles.detailText} numberOfLines={1}>{item.email}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
                placeholder="Cari nama, ID, telepon, atau email..."
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); loadSuppliers(); }}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={loading}
            >
              <Text style={styles.searchButtonText}>Cari</Text>
            </TouchableOpacity>
          </View>

          {/* Results */}
          <View style={styles.resultsContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>Memuat...</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {query.trim() === ''
                    ? 'Tidak ada supplier'
                    : 'Tidak ada supplier ditemukan'}
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
    flexDirection: 'row',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
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
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  itemId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
});

export default SearchSupplierModal;

