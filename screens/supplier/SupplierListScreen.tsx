import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';

export type Supplier = {
  id: number;
  nama: string;
  notelp: string;
  nokantor: string;
  email: string;
};

type Nav = NativeStackNavigationProp<AppStackParamList, 'SupplierList'>;

type Access = { access?: { actions?: { create?: boolean; read?: boolean; update?: boolean; delete?: boolean } } };

const PAGE_SIZE = 30;

export default function SupplierListScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Supplier[]>([]);
  const [visibleItems, setVisibleItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [access, setAccess] = useState<Access['access']>();

  const fetchAccess = useCallback(async () => {
    try {
      const res = await ApiService.authenticatedRequest('/access');
      if (res?.status) setAccess(res.access);
    } catch (e) {
      // no-op; unauthorized handled globally
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer server-side pagination if available; include start/end as query.
      // Server may ignore and return all; we handle both cases.
      const start = 0; const end = PAGE_SIZE;
      const res = await ApiService.authenticatedRequest(`/get/supplier?start=${start}&end=${end}`);
      if (res?.status && Array.isArray(res.data)) {
        const data: Supplier[] = res.data.map((it: any) => ({
          id: Number(it.id),
          nama: String(it.nama || ''),
          notelp: String(it.notelp || ''),
          nokantor: String(it.nokantor || ''),
          email: String(it.email || ''),
        }));
        setItems(data);
        setPage(1);
        setHasMore(data.length >= PAGE_SIZE);
        setVisibleItems(data.slice(0, PAGE_SIZE));
      } else {
        setItems([]);
        setVisibleItems([]);
        setHasMore(false);
      }
    } catch (e) {
      console.error('Supplier fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAccess(); fetchAll(); }, [fetchAccess, fetchAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = visibleItems;
    if (!q) return base;
    return base.filter(it =>
      it.nama.toLowerCase().includes(q) ||
      it.email.toLowerCase().includes(q) ||
      it.notelp.toLowerCase().includes(q) ||
      String(it.id).includes(q)
    );
  }, [query, visibleItems]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(0);
    fetchAll();
  };

  const loadMore = async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const start = page * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const res = await ApiService.authenticatedRequest(`/get/supplier?start=${start}&end=${end}`);
      if (res?.status && Array.isArray(res.data)) {
        const more: Supplier[] = res.data.map((it: any) => ({
          id: Number(it.id), nama: String(it.nama || ''), notelp: String(it.notelp || ''), nokantor: String(it.nokantor || ''), email: String(it.email || ''),
        }));
        if (more.length === 0) {
          setHasMore(false);
        } else {
          // If server returned full list again, slice locally
          const merged = [...items, ...more];
          setItems(merged);
          setVisibleItems(merged.slice(0, end));
          setPage(p => p + 1);
          setHasMore(more.length >= PAGE_SIZE);
        }
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error('Supplier load more error', e);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (item: Supplier) => {
    const canDelete = !!access?.actions?.delete;
    Alert.alert(
      'Delete Supplier',
      canDelete ? `Are you sure you want to delete ${item.nama}?` : 'You do not have permission to delete.',
      [
        { text: 'Cancel', style: 'cancel' },
        canDelete
          ? { text: 'Delete', style: 'destructive', onPress: () => doDelete(item) }
          : { text: 'OK' },
      ]
    );
  };

  const doDelete = async (item: Supplier) => {
    try {
      const res = await ApiService.authenticatedRequest('/supplier', {
        method: 'DELETE',
        body: JSON.stringify({ data: [{ id: item.id }] }),
      });
      if (res?.status) {
        const updated = items.filter(it => it.id !== item.id);
        setItems(updated);
        setVisibleItems(updated.slice(0, page * PAGE_SIZE));
      }
    } catch (e) { console.error('Delete supplier error', e); }
  };

  const renderItem = ({ item }: { item: Supplier }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SupplierEdit', { id: item.id })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.nama}</Text>
        <Text style={styles.subtitle}>{item.email || '-'} • {item.notelp || '-'}</Text>
        <Text style={styles.badge}>ID: {item.id}</Text>
      </View>
      <TouchableOpacity style={styles.kebab} onPress={() => confirmDelete(item)}>
        <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.input}
          placeholder={'Search supplier'}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        ListFooterComponent={
          <View style={{ paddingVertical: 12 }}>{loading && <ActivityIndicator />}</View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, !access?.actions?.create && styles.fabDisabled]}
        onPress={() => access?.actions?.create ? navigation.navigate('SupplierEdit', undefined) : Alert.alert('Permission', 'You do not have permission to create')}
        activeOpacity={access?.actions?.create ? 0.7 : 1}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8 as any, padding: 12, backgroundColor: 'white' },
  input: { flex: 1, paddingHorizontal: 8, height: 40 },
  card: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 12, marginVertical: 6, padding: 12, borderRadius: 10, elevation: 2 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { backgroundColor: '#eef2ff', color: '#3730a3', marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12 },
  kebab: { paddingHorizontal: 8, justifyContent: 'center' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabDisabled: { opacity: 0.4 },
});

