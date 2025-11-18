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

export interface BaganAkunItem {
  kode: string;
  nama: string;
  kode_induk?: string;
  depth?: number;
}

interface SearchBaganAkunModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: BaganAkunItem) => void;
  title?: string;
  shows?: string[]; // Filter by kode_induk (e.g., ["111"] for cash accounts)
}

const SearchBaganAkunModal: React.FC<SearchBaganAkunModalProps> = ({
  visible,
  onClose,
  onSelect,
  title = 'Cari Bagan Akun',
  shows = [],
}) => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BaganAkunItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setItems([]);
      loadBaganAkun();
    }
  }, [visible]);

  const loadBaganAkun = async (searchQuery: string = '') => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const url = `${API_BASE_URL}/get/baganakun`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.status) {
        let accounts = data.data.map((item: any) => ({
          kode: item.kode,
          nama: item.nama,
          kode_induk: item.kode_induk,
          depth: item.depth || 0,
        }));

        // Filter by shows (kode_induk)
        if (shows.length > 0) {
          accounts = accounts.filter((acc: BaganAkunItem) =>
            shows.some(show => acc.kode_induk?.startsWith(show))
          );
        }

        // Filter by search query
        if (searchQuery.trim()) {
          const lowerQuery = searchQuery.toLowerCase();
          accounts = accounts.filter((acc: BaganAkunItem) =>
            acc.kode.toLowerCase().includes(lowerQuery) ||
            acc.nama.toLowerCase().includes(lowerQuery)
          );
        }
        
        setItems(accounts);
      } else {
        console.warn('Load bagan akun error:', data.reason);
        setItems([]);
      }
    } catch (error) {
      console.error('Load bagan akun error:', error);
      Alert.alert('Error', 'Failed to load chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadBaganAkun(query);
  };

  const handleItemPress = (item: BaganAkunItem) => {
    onSelect(item);
    onClose();
  };

  const renderItem = ({ item }: { item: BaganAkunItem }) => {
    const indentWidth = (item.depth || 0) * 12;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handleItemPress(item)}
      >
        <View style={{ flex: 1, paddingLeft: indentWidth }}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemKode}>{item.kode}</Text>
            {item.depth !== undefined && item.depth > 0 && (
              <View style={styles.depthBadge}>
                <Text style={styles.depthText}>L{item.depth}</Text>
              </View>
            )}
          </View>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.nama}
          </Text>
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
                placeholder="Cari kode atau nama akun..."
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); loadBaganAkun(); }}>
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
                <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {query.trim() === ''
                    ? 'Tidak ada bagan akun'
                    : 'Tidak ada bagan akun ditemukan'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.kode}
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
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  itemKode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    fontFamily: 'monospace',
  },
  depthBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  depthText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3730A3',
  },
  itemName: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
});

export default SearchBaganAkunModal;

