import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';

// Types
export type OrderCard = {
  id: string;
  id_ecommerce: number;
  platform: 'SHOPEE' | 'LAZADA' | 'TOKOPEDIA' | string;
  ecommerce_name?: string;
  date?: string;
  invoice?: string;
  status?: string;
  total_price?: string | number;
  ekspedisi?: string;
  orderType?: string;
  booking_sn?: string;
  retur?: boolean;
  dibuat?: boolean;
  dikirim?: boolean;
};

export type EcommerceShop = { id: number; name: string; platform: string; status?: string };

type Nav = NativeStackNavigationProp<AppStackParamList, 'OrdersList'>;

const PAGE_SIZE = 30;
const STATUS_CHIPS = ['SEMUA', 'PESANAN BARU', 'DIPROSES', 'PERJALANAN', 'DIBATALKAN', 'SELESAI'];

export default function OrdersListScreen() {
  const navigation = useNavigation<Nav>();

  const [access, setAccess] = useState<{ actions?: { create?: boolean } } | undefined>();
  const [shops, setShops] = useState<EcommerceShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number>(0); // 0 = all
  const [status, setStatus] = useState<string>('SEMUA');
  const [query, setQuery] = useState('');
  const [dateStart, setDateStart] = useState<Date>(() => new Date(Date.now() - 7 * 24 * 3600 * 1000));
  const [dateEnd, setDateEnd] = useState<Date>(() => new Date());

  const [allItems, setAllItems] = useState<OrderCard[]>([]);
  const [visibleItems, setVisibleItems] = useState<OrderCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAccess = useCallback(async () => {
    try { const res = await ApiService.authenticatedRequest('/access'); if (res?.status) setAccess(res.access); } catch {}
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const res = await ApiService.authenticatedRequest('/get/ecommerce?shop_id_tiktok=1');
      if (res?.status && Array.isArray(res.data)) {
        const approved = res.data.filter((s: any) => s.status === 'APPROVED').map((s: any) => ({ id: s.id, name: s.name || s.shop_name || `Shop ${s.id}`, platform: s.platform, status: s.status }));
        setShops(approved);
      }
    } catch (e) { console.error('fetchShops error', e); }
  }, []);

  const unix = (d: Date) => Math.floor(d.getTime() / 1000);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const start = unix(dateStart); const end = unix(dateEnd);
      const shop = selectedShopId || 0;
      const res = await ApiService.authenticatedRequest(`/get/ecommerce/order/date/${start}/${end}?id_ecommerce=${shop}&mode=normal&timestamp=${Math.floor(Date.now()/1000)}`);
      if (res?.status && Array.isArray(res.data)) {
        const mapped: OrderCard[] = res.data.map((rd: any) => ({
          id: String(rd.id || rd.order_id || rd.ordersn || rd.order_sn || ''),
          id_ecommerce: Number(rd.id_ecommerce || selectedShopId || 0),
          platform: String(rd.from || rd.platform || '').toUpperCase(),
          ecommerce_name: rd.ecommerce_name || shops.find(s => s.id === (rd.id_ecommerce || selectedShopId))?.name,
          date: rd.date || rd.tanggal_order || undefined,
          invoice: rd.invoice,
          status: rd.status,
          total_price: rd.total_price,
          ekspedisi: rd.ekspedisi,
          orderType: rd.orderType,
          booking_sn: rd.booking_sn,
          retur: (rd.status || '').toUpperCase().includes('RETUR') || false,
          dibuat: !!rd.dibuat,
          dikirim: !!(rd.ekspedisi || (rd.status || '').toUpperCase().includes('PERJALANAN')),
        }));
        setAllItems(mapped);
        const initial = mapped.slice(0, PAGE_SIZE);
        setVisibleItems(initial);
        setPage(1);
        setHasMore(mapped.length > PAGE_SIZE);
      } else {
        setAllItems([]);
        setVisibleItems([]);
        setHasMore(false);
      }
    } catch (e) {
      console.error('fetchOrders error', e);
      Alert.alert('Error', 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateStart, dateEnd, selectedShopId, shops]);

  useEffect(() => { fetchAccess(); fetchShops(); }, [fetchAccess, fetchShops]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const loadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    const nextSlice = allItems.slice(0, nextPage * PAGE_SIZE);
    setVisibleItems(nextSlice);
    setPage(nextPage);
    setHasMore(allItems.length > nextPage * PAGE_SIZE);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = visibleItems.filter(it => status === 'SEMUA' ? true : (it.status || '').toUpperCase() === status);
    if (!q) return base;
    return base.filter(it =>
      it.id.toLowerCase().includes(q) ||
      (it.invoice || '').toLowerCase().includes(q) ||
      (it.ecommerce_name || '').toLowerCase().includes(q)
    );
  }, [query, visibleItems, status]);

  const statusChip = (label: string) => (
    <TouchableOpacity key={label} style={[styles.chip, status === label && styles.chipActive]} onPress={() => setStatus(label)}>
      <Text style={[styles.chipText, status === label && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const changePreset = (days: number) => {
    setDateStart(new Date(Date.now() - days * 24 * 3600 * 1000));
    setDateEnd(new Date());
  };

  const renderItem = ({ item }: { item: OrderCard }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('OrderDetail', { id: item.id, id_ecommerce: item.id_ecommerce })}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.title} numberOfLines={1}>{item.ecommerce_name || item.platform}</Text>
          <Text style={styles.statusBadge}>{(item.status || '').toUpperCase()}</Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>ID: {item.id} • {item.invoice || 'No Invoice'}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.platform} • {item.orderType || 'STANDARD'} • Total: {item.total_price || '-'}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          {item.retur && <Text style={styles.tagWarning}>RETUR</Text>}
          {item.dibuat && <Text style={styles.tagInfo}>DIBUAT</Text>}
          {item.dikirim && <Text style={styles.tagSuccess}>DIKIRIM</Text>}
        </View>
      </View>
      <TouchableOpacity style={styles.kebab} onPress={() => onOpenActions(item)}>
        <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const onOpenActions = (item: OrderCard) => {
    const canCreate = !!access?.actions?.create;
    const buttons: any[] = [
      { text: 'View Details', onPress: () => navigation.navigate('OrderDetail', { id: item.id, id_ecommerce: item.id_ecommerce }) },
      { text: 'Create Sales', onPress: () => createSales(item), style: canCreate ? 'default' : 'cancel' },
      { text: 'Print Label', onPress: () => printLabel(item), style: canCreate ? 'default' : 'cancel' },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    if (!canCreate) {
      Alert.alert('Actions', 'You can view details only (no permission to create).', [{ text: 'OK' }]);
      return;
    }
    Alert.alert('Actions', `Order ${item.id}`, buttons);
  };

  const createSales = async (item: OrderCard) => {
    if (!access?.actions?.create) { Alert.alert('Permission', 'You do not have permission'); return; }
    try {
      const detail = await ApiService.authenticatedRequest(`/get/ecommerce/order?id=${item.id}&id_ecommerce=${item.id_ecommerce}`);
      if (!detail?.status) throw new Error(detail?.reason || 'Failed to load order');
      const d = detail.data;
      const barang = (d.items || []).map((it: any) => ({
        price: it.price_after_discount ?? it.price ?? 0,
        name: it.name,
        sku: it.sku,
        qty: it.qty,
        id_online: it.id_online,
        id_parent: it.id_parent,
      }));
      const body = [{
        platform: d.from,
        id: d.id,
        barang,
        id_ecommerce: d.id_ecommerce || item.id_ecommerce,
        date: typeof d.date === 'string' ? d.date : new Date().toISOString(),
        invoice: d.invoice,
        from_import: false,
        booking_sn: d.booking_sn,
        orderType: d.orderType,
        isBookingOrder: !!d.booking_sn,
      }];
      const res = await ApiService.authenticatedRequest('/ecommerce/pesanan', { method: 'POST', body: JSON.stringify(body) });
      if (res?.status) {
        Alert.alert('Success', 'Sales created.');
        fetchOrders();
      } else {
        const reason = res?.reason || 'Failed to create sales';
        Alert.alert('Failed', reason);
      }
    } catch (e: any) {
      console.error('createSales error', e);
      Alert.alert('Error', e?.message || 'Create sales failed');
    }
  };

  const printLabel = async (item: OrderCard) => {
    if (!access?.actions?.create) { Alert.alert('Permission', 'You do not have permission'); return; }
    try {
      const payload = [{ id_ecommerce: item.id_ecommerce, order_id: item.id, A6: true }];
      const res = await ApiService.authenticatedRequest('/ecommerce/ship_label', { method: 'POST', body: JSON.stringify(payload) });
      if (!res || res.status === false) { Alert.alert('Failed', res?.reason || 'Failed to get label'); return; }
      // Response may be array or object; normalize to array
      const list = Array.isArray(res.data) ? res.data : res;
      // Find first HTML_ENCODED label to preview
      const htmlItem = list.find((x: any) => x?.type === 'HTML_ENCODED' && x.data);
      if (htmlItem) {
        navigation.navigate('LabelPreview', { html: String(htmlItem.data), title: `${item.platform} Label` });
        return;
      }
      Alert.alert('Not supported', 'Label format is not supported on mobile yet. Please print from the web app.');
    } catch (e: any) {
      console.error('printLabel error', e);
      Alert.alert('Error', e?.message || 'Failed to print label');
    }
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput style={styles.input} placeholder="Search id/invoice/shop" value={query} onChangeText={setQuery} />
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <TouchableOpacity style={styles.filterPill} onPress={() => changePreset(1)}>
          <Ionicons name="today-outline" size={16} color="#111827" /><Text style={styles.filterText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill} onPress={() => changePreset(7)}>
          <Ionicons name="calendar-outline" size={16} color="#111827" /><Text style={styles.filterText}>7d</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill} onPress={() => changePreset(30)}>
          <Ionicons name="calendar" size={16} color="#111827" /><Text style={styles.filterText}>30d</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill} onPress={() => setSelectedShopId(0)}>
          <Ionicons name="storefront-outline" size={16} color="#111827" /><Text style={styles.filterText}>All Shops</Text>
        </TouchableOpacity>
      </View>

      {/* Status chips */}
      <View style={styles.chipsRow}>
        <FlatList data={STATUS_CHIPS} horizontal keyExtractor={(s)=>s} renderItem={({item}) => statusChip(item)} showsHorizontalScrollIndicator={false} />
      </View>

      {/* Orders */}
      <FlatList
        data={filtered}
        keyExtractor={(it) => `${it.id}-${it.id_ecommerce}`}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListFooterComponent={<View style={{ paddingVertical: 12 }}>{loading && <ActivityIndicator />}</View>}
      />

      {/* Shop quick toggles */}
      <View style={styles.shopBar}>
        <FlatList
          data={[{ id: 0, name: 'All', platform: 'ALL' } as EcommerceShop, ...shops]}
          keyExtractor={(s) => String(s.id)}
          horizontal
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.shopChip, selectedShopId === item.id && styles.shopChipActive]} onPress={() => setSelectedShopId(item.id)}>
              <Text style={[styles.shopChipText, selectedShopId === item.id && styles.shopChipTextActive]}>{item.name}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8 as any, padding: 12, backgroundColor: 'white' },
  input: { flex: 1, paddingHorizontal: 8, height: 40 },
  filtersRow: { flexDirection: 'row', gap: 8 as any, paddingHorizontal: 12, paddingBottom: 8 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6 as any, backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  filterText: { color: '#111827' },
  chipsRow: { paddingHorizontal: 8, paddingBottom: 8 },
  chip: { backgroundColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginHorizontal: 4 },
  chipActive: { backgroundColor: '#111827' },
  chipText: { color: '#111827', fontSize: 12 },
  chipTextActive: { color: 'white' },
  card: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 12, marginVertical: 6, padding: 12, borderRadius: 10, elevation: 2 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  meta: { fontSize: 12, color: '#374151', marginTop: 4 },
  statusBadge: { backgroundColor: '#EEF2FF', color: '#3730a3', fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagWarning: { backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 6 },
  tagInfo: { backgroundColor: '#DBEAFE', color: '#1E40AF', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 6 },
  tagSuccess: { backgroundColor: '#D1FAE5', color: '#065F46', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  kebab: { paddingHorizontal: 8, justifyContent: 'center' },
  shopBar: { paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', backgroundColor: 'white' },
  shopChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  shopChipActive: { backgroundColor: '#111827' },
  shopChipText: { color: '#111827', fontSize: 12 },
  shopChipTextActive: { color: 'white' },
});

