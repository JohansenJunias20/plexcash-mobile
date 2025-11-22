import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';

export type Customer = { id: number; nama: string; notelp: string; alamat: string };

type Nav = NativeStackNavigationProp<AppStackParamList, 'CustomerList'>;

type Access = { access?: { actions?: { create?: boolean; delete?: boolean } } };

const PAGE_SIZE = 30;

export default function CustomerListScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Customer[]>([]);
  const [visibleItems, setVisibleItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [access, setAccess] = useState<Access['access']>();

  const fetchAccess = useCallback(async () => {
    try { const res = await ApiService.authenticatedRequest('/access'); if (res?.status) setAccess(res.access); } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const start = 0; const end = PAGE_SIZE;
      const res = await ApiService.authenticatedRequest(`/get/customer?start=${start}&end=${end}`);
      if (res?.status && Array.isArray(res.data)) {
        const data: Customer[] = res.data.map((it: any) => ({ id: Number(it.id), nama: String(it.nama || ''), notelp: String(it.notelp || ''), alamat: String(it.alamat || '') }));
        setItems(data);
        setVisibleItems(data.slice(0, PAGE_SIZE));
        setPage(1);
        setHasMore(data.length >= PAGE_SIZE);
      } else { setItems([]); setVisibleItems([]); setHasMore(false); }
    } catch (e) { console.error('Customer fetch error', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAccess(); fetchAll(); }, [fetchAccess, fetchAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = visibleItems;
    if (!q) return base;
    return base.filter(it => it.nama.toLowerCase().includes(q) || it.notelp.toLowerCase().includes(q));
  }, [query, visibleItems]);

  const onRefresh = () => { setRefreshing(true); setPage(0); fetchAll(); };

  const loadMore = async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const start = page * PAGE_SIZE; const end = start + PAGE_SIZE;
      const res = await ApiService.authenticatedRequest(`/get/customer?start=${start}&end=${end}`);
      if (res?.status && Array.isArray(res.data)) {
        const more: Customer[] = res.data.map((it: any) => ({ id: Number(it.id), nama: String(it.nama || ''), notelp: String(it.notelp || ''), alamat: String(it.alamat || '') }));
        if (more.length === 0) setHasMore(false); else {
          const merged = [...items, ...more];
          setItems(merged);
          setVisibleItems(merged.slice(0, end));
          setPage(p => p + 1);
          setHasMore(more.length >= PAGE_SIZE);
        }
      } else setHasMore(false);
    } catch (e) { console.error('Customer load more error', e); }
    finally { setLoading(false); }
  };

  const confirmDelete = (item: Customer) => {
    const canDelete = !!access?.actions?.delete;
    if (item.id <= 4) {
      Alert.alert('Delete Customer', 'This record cannot be deleted (id <= 4).', [{ text: 'OK' }]);
      return;
    }
    Alert.alert(
      'Delete Customer',
      canDelete ? `Are you sure you want to delete ${item.nama}?` : 'You do not have permission to delete.',
      [ { text: 'Cancel', style: 'cancel' }, canDelete ? { text: 'Delete', style: 'destructive', onPress: () => doDelete(item) } : { text: 'OK' } ]
    );
  };

  const doDelete = async (item: Customer) => {
    try {
      const res = await ApiService.authenticatedRequest('/customer', {
        method: 'DELETE',
        body: JSON.stringify({ data: [{ id: item.id }] })
      });
      if (res?.status) {
        const updated = items.filter(it => it.id !== item.id);
        setItems(updated);
        setVisibleItems(updated.slice(0, page * PAGE_SIZE));
      }
    } catch (e) { console.error('Delete customer error', e); }
  };

  const renderItem = ({ item }: { item: Customer }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.nama}</Text>
        <Text style={styles.subtitle}>{item.notelp || '-'}</Text>
        <Text style={styles.badge}>{item.alamat || '-'}</Text>
      </View>
      <TouchableOpacity style={styles.kebab} onPress={() => confirmDelete(item)}>
        <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Hamburger Menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput style={styles.input} placeholder={'Search customer'} value={query} onChangeText={setQuery} returnKeyType="search" />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        ListFooterComponent={<View style={{ paddingVertical: 12 }}>{loading && <ActivityIndicator />}</View>}
      />

      <TouchableOpacity
        style={[styles.fab, !access?.actions?.create && styles.fabDisabled]}
        onPress={() => access?.actions?.create ? navigation.navigate('CustomerEdit', undefined) : Alert.alert('Permission', 'You do not have permission to create')}
        activeOpacity={access?.actions?.create ? 0.7 : 1}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  hamburgerButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
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

