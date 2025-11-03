import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';

export interface BundlingItem {
  id: number;
  nama: string;
  sku: string;
  label: string | null;
  hargajual: number;
  stok?: number;
  hpp?: number;
  berat?: number;
}

type Nav = NativeStackNavigationProp<AppStackParamList, 'BundlingList'>;

export default function BundlingListScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<BundlingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchBundling = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const url = `${API_BASE_URL}/get/bundling`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.status) {
        const bundlingItems: BundlingItem[] = data.data.map((item: any) => ({
          id: item.id,
          nama: item.nama,
          sku: item.sku,
          label: item.label,
          hargajual: Number(item.hargajual) || 0,
          stok: Number(item.stok) || 0,
          hpp: Number(item.hpp) || 0,
          berat: Number(item.berat) || 0,
        }));
        setItems(bundlingItems);
      } else {
        console.warn('Fetch bundling error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to fetch bundling');
      }
    } catch (error) {
      console.error('Fetch bundling error:', error);
      Alert.alert('Error', 'Failed to fetch bundling data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBundling();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchBundling();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBundling();
  };

  const handleDelete = async (id: number, nama: string) => {
    Alert.alert(
      'Konfirmasi Hapus',
      `Apakah Anda yakin ingin menghapus bundling "${nama}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getTokenAuth();
              if (!token) {
                Alert.alert('Error', 'Session expired');
                return;
              }

              const res = await fetch(`${API_BASE_URL}/bundling`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify([id]),
              });

              const data = await res.json();

              if (data.status) {
                Alert.alert('Sukses', 'Bundling berhasil dihapus');
                setItems(items.filter((item) => item.id !== id));
              } else {
                Alert.alert('Error', data.reason || 'Failed to delete bundling');
              }
            } catch (error) {
              console.error('Delete bundling error:', error);
              Alert.alert('Error', 'Failed to delete bundling');
            }
          },
        },
      ]
    );
  };

  const filteredItems = items.filter(
    (item) =>
      item.nama.toLowerCase().includes(query.toLowerCase()) ||
      item.sku.toLowerCase().includes(query.toLowerCase()) ||
      (item.label && item.label.toLowerCase().includes(query.toLowerCase()))
  );

  const renderItem = ({ item }: { item: BundlingItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('BundlingEdit', { id: item.id })}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {item.nama}
        </Text>
        {item.label && (
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        )}
        <Text style={styles.subtitle}>{item.sku}</Text>
        <View style={styles.row}>
          <Text style={styles.badgePrice}>
            Rp {item.hargajual.toLocaleString('id-ID')}
          </Text>
          {item.stok !== undefined && (
            <Text style={styles.badge}>Stok: {item.stok}</Text>
          )}
          {item.berat !== undefined && item.berat > 0 && (
            <Text style={styles.badge}>Berat: {item.berat}g</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id, item.nama)}
      >
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="albums-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyText}>Belum ada bundling</Text>
      <Text style={styles.emptySubtext}>
        Tap tombol + untuk membuat bundling baru
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.input}
          placeholder="Cari bundling..."
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={<ListEmpty />}
          contentContainerStyle={
            filteredItems.length === 0 && { flex: 1 }
          }
        />
      )}

      {/* FAB - Create New */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('BundlingEdit', undefined)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    height: 40,
    fontSize: 15,
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
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    color: '#3730A3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  badgePrice: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
