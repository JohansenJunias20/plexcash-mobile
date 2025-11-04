import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';

// Types aligned with web Item interface (subset used for list)
export interface Item {
  id: number;
  nama: string;
  sku: string;
  kategori: string;
  merk: string;
  satuan: string;
  stok: number;
  hargajual: number;
  hargajual2: number;
  hpp: number;
  dpp: number;
  jumlah_online: number;
  sync_stock: boolean;
}

type Nav = NativeStackNavigationProp<AppStackParamList, 'BarangList'>;

export default function BarangListScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const { signOut } = (require('../../context/AuthContext') as any).useAuth?.() || {};
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchBy, setSearchBy] = useState<'nama' | 'sku'>('nama');
  const [filters, setFilters] = useState<{ merk?: string; kategori?: string; uploadFilter?: 'all' | 'not_uploaded' | 'uploaded'; jumlah_online?: number | null }>({ uploadFilter: 'all', jumlah_online: null });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const PAGE_SIZE = 30;

  const fetchItems = async (reset = false) => {
    if (reset) {
      setPage(0);
      setHasMore(true);
      setItems([]);
    }
    if (!hasMore && !reset) return;

    const start = reset ? 0 : page * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    const qs = new URLSearchParams();
    qs.set('start', String(start));
    qs.set('end', String(end));

    const sku = searchBy === 'sku' ? query : '';
    const nama = searchBy === 'nama' ? query : '';

    qs.set('sku', sku);
    qs.set('nama', nama);
    qs.set('merk', filters.merk || '');
    qs.set('kategori', filters.kategori || '');

    try {
      console.log('📋 [BARANG] Starting data fetch');
      setLoading(true);
      const token = await getTokenAuth();
      console.log('📋 [BARANG] Token retrieved for API call:', token ? 'Present' : 'Missing');

      // Decode JWT to see what's inside (for debugging)
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('🔍 [BARANG] JWT payload:', JSON.stringify(payload, null, 2));
          }
        } catch (e) {
          console.warn('⚠️ [BARANG] Could not decode JWT:', e);
        }
      }

      if (!token) {
        console.log('❌ [BARANG] No token found, showing session expired alert');
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }
      const url = `${API_BASE_URL}/get/masterbarang/search?${qs.toString()}`;
      console.log('📋 [BARANG] Fetching from URL:', url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📋 [BARANG] Response status:', res.status, res.statusText);

      const responseText = await res.text();
      console.log('📋 [BARANG] Response text (first 200 chars):', responseText.substring(0, 200));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ [BARANG] JSON parse error. Full response:', responseText);
        Alert.alert('Error', `Server returned invalid response: ${responseText.substring(0, 100)}`);
        return;
      }

      if (data.status) {
        const newItems: Item[] = data.data.map((it: any) => ({
          id: it.id,
          nama: it.nama,
          sku: it.sku,
          kategori: it.kategori,
          merk: it.merk,
          satuan: it.satuan,
          stok: Number(it.stok) || 0,
          hargajual: Number(it.hargajual) || 0,
          hargajual2: Number(it.hargajual2) || 0,
          hpp: Number(it.hpp) || 0,
          dpp: Number(it.dpp) || 0,
          jumlah_online: Number(it.jumlah_online) || 0,
          sync_stock: Boolean(it.sync_stock),
        }));

        setItems(prev => (reset ? newItems : [...prev, ...newItems]));
        setHasMore(newItems.length >= PAGE_SIZE);
        setPage(prev => (reset ? 1 : prev + 1));
      } else {
        console.warn('Fetch error:', data.reason);
      }
    } catch (e) {
      console.error('Fetch items error', e);
    } finally {
      setLoading(false);
      if (refreshing) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems(true);
  }, [searchBy]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems(true);
  };

  const handleActionSheet = (item: Item) => {
    setSelectedItem(item);
    setShowActionSheet(true);
  };

  const handleKartuStok = () => {
    if (selectedItem) {
      setShowActionSheet(false);
      navigation.navigate('Kartustok', { id: selectedItem.id });
    }
  };

  const handleOnline = () => {
    if (selectedItem) {
      setShowActionSheet(false);
      navigation.navigate('NewOnline', { id: selectedItem.id });
    }
  };

  const handleSyncStock = async () => {
    if (selectedItem) {
      setShowActionSheet(false);
      // TODO: Implement sync stock functionality
      Alert.alert('Sync Stock', `Sync stock untuk ${selectedItem.nama}`);
    }
  };

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BarangEdit', { id: item.id })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.nama}</Text>
        <Text style={styles.subtitle}>{item.sku} • {item.merk}</Text>
        <View style={styles.row}>
          <Text style={styles.badge}>Stok: {item.stok}</Text>
          {item.hpp > 0 && <Text style={styles.badgeHpp}>HPP: {item.hpp.toLocaleString('id-ID')}</Text>}
          <Text style={styles.badge}>HJ1: {item.hargajual.toLocaleString('id-ID')}</Text>
          <Text style={styles.badge}>HJ2: {item.hargajual2.toLocaleString('id-ID')}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.kebab} onPress={() => handleActionSheet(item)}>
        <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const ListFooter = () => (
    <View style={{ paddingVertical: 12 }}>
      {loading && <ActivityIndicator />}
      {!loading && hasMore && (
        <TouchableOpacity style={styles.loadMore} onPress={() => fetchItems(false)}>
          <Text style={{ color: '#2563eb' }}>Load More</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.input}
          placeholder={`Search by ${searchBy}`}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => fetchItems(true)}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => setSearchBy(prev => (prev === 'nama' ? 'sku' : 'nama'))}>
          <Text style={styles.toggle}>{searchBy.toUpperCase()}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {/* open filter sheet */}}>
          <Ionicons name="filter" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<ListFooter />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('BarangEdit') /* open add new */}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionSheet(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>{selectedItem?.nama}</Text>
              <Text style={styles.actionSheetSubtitle}>SKU: {selectedItem?.sku}</Text>
            </View>
            
            <TouchableOpacity style={styles.actionItem} onPress={handleKartuStok}>
              <Ionicons name="receipt-outline" size={22} color="#2563eb" />
              <Text style={styles.actionText}>Kartu Stok</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleOnline}>
              <Ionicons name="cloud-upload-outline" size={22} color="#059669" />
              <Text style={styles.actionText}>Online</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleSyncStock}>
              <Ionicons name="sync-outline" size={22} color="#d97706" />
              <Text style={styles.actionText}>Sync Stock</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionItem, styles.cancelItem]} onPress={() => setShowActionSheet(false)}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8 as any, padding: 12, backgroundColor: 'white' },
  input: { flex: 1, paddingHorizontal: 8, height: 40 },
  toggle: { marginHorizontal: 8, color: '#6B7280', fontWeight: '600' },
  card: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 12, marginVertical: 6, padding: 12, borderRadius: 10, elevation: 2 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8 as any, marginTop: 6, flexWrap: 'wrap' },
  badge: { backgroundColor: '#eef2ff', color: '#3730a3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12 },
  badgeHpp: { backgroundColor: '#fef3c7', color: '#92400e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, fontWeight: '600' },
  kebab: { paddingHorizontal: 8, justifyContent: 'center' },
  loadMore: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  actionSheetHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  actionSheetTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  actionSheetSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 12 as any },
  actionText: { fontSize: 16, color: '#111827' },
  cancelItem: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 },
  cancelText: { fontSize: 16, color: '#dc2626', fontWeight: '600', textAlign: 'center', flex: 1 },
});

