import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import BottomActionSheet, { ActionSheetAction } from '../../components/BottomActionSheet';
import DaftarBarangModal, { ProductItem } from '../../components/DaftarBarangModal';


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
  print?: boolean;
  print_timestamp?: string;
  scanned?: boolean;
  scan_timestamp?: string | null;
  no_resi?: string;
  items?: any[];
  warehouse?: string;
  isBookingOrder?: boolean;
};

export type EcommerceShop = { id: number; name: string; platform: string; status?: string };

type Nav = NativeStackNavigationProp<AppStackParamList, 'OrdersList'>;

const PAGE_SIZE = 30;
const STATUS_CHIPS = ['SEMUA', 'PESANAN BARU', 'DIPROSES', 'PERJALANAN', 'DIBATALKAN', 'SELESAI'];
const DIBUAT_CHIPS = ['SEMUA', 'BELUM DIBUAT', 'TELAH DIBUAT'];
const PRINT_CHIPS = ['SEMUA', 'BELUM CETAK', 'SUDAH CETAK'];

export default function OrdersListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [access, setAccess] = useState<{ actions?: { create?: boolean } } | undefined>();
  const [shops, setShops] = useState<EcommerceShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number>(0); // 0 = all
  const [status, setStatus] = useState<string>('SEMUA');
  const [dibuatFilter, setDibuatFilter] = useState<string>('SEMUA');
  const [printFilter, setPrintFilter] = useState<string>('SEMUA');
  const [query, setQuery] = useState('');
  const [dateStart, setDateStart] = useState<Date>(() => new Date(Date.now() - 5 * 24 * 3600 * 1000)); // Changed from 7 to 5 days
  const [dateEnd, setDateEnd] = useState<Date>(() => new Date());

  const [allItems, setAllItems] = useState<OrderCard[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDaftarBarang, setShowDaftarBarang] = useState(false);
  const [daftarBarangItems, setDaftarBarangItems] = useState<ProductItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

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
      const res = await ApiService.authenticatedRequest(`/get/ecommerce/order/date/${start}/${end}?id_ecommerce=${shop}&mode=cepat&timestamp=${Math.floor(Date.now()/1000)}`);
      if (res?.status) {
        const standardOrders = Array.isArray(res.data) ? res.data : [];
        const bookingOrders = Array.isArray(res.bookings) ? res.bookings : [];

        const mappedStandard: OrderCard[] = standardOrders.map((rd: any) => {
          const isBookingOrder = rd.from === 'SHOPEE' && rd.booking_sn ? true : false;
          const orderType = isBookingOrder ? 'Standard by Booking' : (rd.orderType || 'Standard');

          // Extract warehouse info from items
          let warehouse = '';
          if (rd.items && Array.isArray(rd.items) && rd.items.length > 0) {
            const warehouseIds = new Set(
              rd.items
                .map((it: any) => it.product_location_id)
                .filter((id: any) => id !== undefined && id !== null && String(id).length > 0)
            );
            if (warehouseIds.size > 0) {
              warehouse = warehouseIds.size === 1 ? `WH-${Array.from(warehouseIds)[0]}` : `${warehouseIds.size} warehouses`;
            }
          }

          return {
            id: String(rd.id || rd.order_id || rd.ordersn || rd.order_sn || ''),
            id_ecommerce: Number(rd.id_ecommerce || rd.ecommerce_id || rd.shop_id || selectedShopId || 0),
            platform: String(rd.from || rd.platform || '').toUpperCase(),
            ecommerce_name: rd.ecommerce_name || shops.find(s => s.id === (rd.id_ecommerce || selectedShopId))?.name,
            date: rd.date || rd.tanggal_order || undefined,
            invoice: rd.invoice,
            status: rd.status,
            total_price: rd.total_price,
            ekspedisi: rd.ekspedisi,
            orderType,
            booking_sn: rd.booking_sn,
            retur: (rd.status || '').toUpperCase().includes('RETUR') || false,
            dibuat: rd.dibuat === true || rd.dibuat === 1 || rd.dibuat === '1',
            dikirim: !!(rd.ekspedisi || (rd.status || '').toUpperCase().includes('PERJALANAN')),
            print: rd.print === true || rd.print === 1 || rd.print === '1',
            print_timestamp: rd.print_timestamp || undefined,
            scanned: rd.scanned === true || rd.scanned === 1 || rd.scanned === '1',
            scan_timestamp: rd.scan_timestamp || null,
            no_resi: rd.no_resi || rd.tracking_number || undefined,
            items: rd.items || [],
            warehouse,
            isBookingOrder,
          };
        });

        const mappedBookings: OrderCard[] = bookingOrders.map((rd: any) => {
          return {
            id: String(rd.order_sn || rd.booking_sn || ''),
            id_ecommerce: Number(rd.id_ecommerce || selectedShopId || 0),
            platform: String(rd.platform || 'SHOPEE').toUpperCase(),
            ecommerce_name: shops.find(s => s.id === rd.id_ecommerce)?.name || rd.platform || 'SHOPEE',
            date: rd.create_time || rd.tanggal_order || undefined,
            invoice: undefined,
            status: rd.booking_status || 'BOOKING',
            total_price: undefined,
            ekspedisi: rd.shipping_carrier,
            orderType: 'Standard by Booking',
            booking_sn: rd.booking_sn,
            retur: false,
            dibuat: false,
            dikirim: !!(rd.shipping_carrier || (rd.booking_status || '').toUpperCase().includes('SHIPPED')),
            print: rd.print === true || rd.print === 1 || rd.print === '1',
            print_timestamp: rd.print_timestamp || undefined,
            scanned: rd.scanned === true || rd.scanned === 1 || rd.scanned === '1',
            scan_timestamp: rd.scan_timestamp || null,
            no_resi: rd.booking_sn || undefined,
            items: (rd.items || []).map((it: any) => ({
              sku: it.sku || '-',
              name: it.name || '-',
              qty: it.qty || 1,
              price: 0,
            })),
            warehouse: '',
            isBookingOrder: true,
          };
        });

        const combined = [...mappedStandard, ...mappedBookings];
        setAllItems(combined);
        setPage(1);
      } else {
        setAllItems([]);
        setPage(1);
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
    if (loading) return;
    setPage(prev => prev + 1);
  };

  // Filter all items first, then paginate
  const filteredAll = useMemo(() => {
    let result = allItems;

    // Filter by status
    if (status !== 'SEMUA') {
      result = result.filter(it => {
        const itemStatus = (it.status || '').toUpperCase();
        if (status === 'PESANAN BARU') return itemStatus === 'PESANAN BARU' || itemStatus === 'READY_TO_SHIP';
        if (status === 'DIPROSES') return itemStatus === 'DIPROSES' || itemStatus === 'PROCESSED';
        if (status === 'PERJALANAN') return itemStatus === 'PERJALANAN' || itemStatus === 'SHIPPED';
        if (status === 'DIBATALKAN') return itemStatus === 'DIBATALKAN' || itemStatus === 'CANCELLED';
        if (status === 'SELESAI') return itemStatus === 'SELESAI' || itemStatus === 'COMPLETED';
        return itemStatus === status;
      });
    }

    // Filter by dibuat status
    if (dibuatFilter === 'BELUM DIBUAT') {
      result = result.filter(it => !it.dibuat);
    } else if (dibuatFilter === 'TELAH DIBUAT') {
      result = result.filter(it => it.dibuat);
    }

    // Filter by print status
    if (printFilter === 'BELUM CETAK') {
      result = result.filter(it => !it.print);
    } else if (printFilter === 'SUDAH CETAK') {
      result = result.filter(it => it.print);
    }

    // Filter by search query (ID, invoice, shop name, tracking number, courier)
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(it =>
        it.id.toLowerCase().includes(q) ||
        (it.invoice || '').toLowerCase().includes(q) ||
        (it.ecommerce_name || '').toLowerCase().includes(q) ||
        (it.no_resi || '').toLowerCase().includes(q) ||
        (it.ekspedisi || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [query, allItems, status, dibuatFilter, printFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status, dibuatFilter, printFilter, query]);

  // Paginate filtered items
  const filtered = useMemo(() => {
    return filteredAll.slice(0, page * PAGE_SIZE);
  }, [filteredAll, page]);

  const hasMore = filtered.length < filteredAll.length;

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      // Exit selection mode if no items selected
      if (newSet.size === 0) {
        setSelectionMode(false);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = new Set(filtered.map((item) => item.id));
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const enterSelectionMode = (id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const statusChip = (label: string) => (
    <TouchableOpacity key={label} style={[styles.chip, status === label && styles.chipActive]} onPress={() => setStatus(label)}>
      <Text style={[styles.chipText, status === label && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const changePreset = (days: number) => {
    setDateStart(new Date(Date.now() - days * 24 * 3600 * 1000));
    setDateEnd(new Date());
    setLoading(true);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const renderItem = ({ item }: { item: OrderCard }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          } else {
            navigation.navigate('OrderDetail', {
              id: item.id,
              id_ecommerce: item.id_ecommerce,
              scan_timestamp: item.scan_timestamp,
              print_timestamp: item.print_timestamp,
              scanned: item.scanned,
            });
          }
        }}
        onLongPress={() => {
          if (!selectionMode) {
            enterSelectionMode(item.id);
          }
        }}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <View style={styles.checkbox}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={isSelected ? '#fbbf24' : '#9CA3AF'}
            />
          </View>
        )}

        <View style={{ flex: 1 }}>
          {/* Header row with shop name and status */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={styles.title} numberOfLines={1}>
              {item.ecommerce_name || item.platform}
            </Text>
            <Text style={styles.statusBadge}>{(item.status || '').toUpperCase()}</Text>
          </View>

          {/* Order type badge */}
          {item.isBookingOrder && (
            <View style={styles.orderTypeBadge}>
              <Text style={styles.orderTypeText}>BOOKING</Text>
            </View>
          )}

          {/* ID and invoice */}
          <Text style={styles.subtitle} numberOfLines={1}>
            ID: {item.id} • {item.invoice || 'No Invoice'}
          </Text>

          {/* Date */}
          {item.date && (
            <Text style={styles.dateText} numberOfLines={1}>
              📅 {formatDate(item.date)}
            </Text>
          )}

          {/* Platform, total, warehouse */}
          <Text style={styles.meta} numberOfLines={1}>
            {item.platform} • Total: {item.total_price || '-'}
            {item.warehouse && ` • ${item.warehouse}`}
          </Text>

          {/* Ekspedisi */}
          {item.ekspedisi && (
            <Text style={styles.ekspedisi} numberOfLines={1}>
              📦 {item.ekspedisi}
            </Text>
          )}

          {/* Tags */}
          <View style={{ flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' }}>
            {item.retur && <Text style={styles.tagWarning}>RETUR</Text>}
            {item.dibuat && <Text style={styles.tagInfo}>DIBUAT</Text>}
            {item.dikirim && <Text style={styles.tagSuccess}>DIKIRIM</Text>}
            {item.print && <Text style={styles.tagPrint}>PRINTED</Text>}
            {item.scanned && <Text style={styles.tagScanned}>SCANNED</Text>}
          </View>

          {/* Print and Scan Timestamps */}
          {(item.print_timestamp || item.scan_timestamp) && (
            <View style={{ marginTop: 4 }}>
              {item.print_timestamp && (
                <Text style={styles.timestampText} numberOfLines={1}>
                  🖨️ Cetak: {formatDate(item.print_timestamp)}
                </Text>
              )}
              {item.scan_timestamp && (
                <Text style={styles.timestampText} numberOfLines={1}>
                  📱 Scan: {formatDate(item.scan_timestamp)}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Kebab menu (only when not in selection mode) */}
        {!selectionMode && (
          <TouchableOpacity style={styles.kebab} onPress={() => onOpenActions(item)}>
            <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const onOpenActions = (item: OrderCard) => {
    const canCreate = !!access?.actions?.create;
    const itemStatus = (item.status || '').toUpperCase();
    const isCancelled = itemStatus.includes('BATAL') || itemStatus.includes('CANCEL') || itemStatus === 'IN_CANCEL';

    const buttons: any[] = [
      { text: 'View Details', onPress: () => navigation.navigate('OrderDetail', {
        id: item.id,
        id_ecommerce: item.id_ecommerce,
        scan_timestamp: item.scan_timestamp,
        print_timestamp: item.print_timestamp,
        scanned: item.scanned,
      }) },
      ...(isCancelled
        ? [{ text: 'Terima Pembatalan', onPress: () => terimaPembatalan(item), style: canCreate ? 'destructive' as const : 'cancel' as const }]
        : [
            { text: 'Create Sales', onPress: () => createSales(item), style: canCreate ? 'default' as const : 'cancel' as const },
            { text: 'Print Label', onPress: () => printLabel(item), style: canCreate ? 'default' as const : 'cancel' as const },
          ]
      ),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    if (!canCreate) {
      Alert.alert('Actions', 'You can view details only (no permission to create).', [{ text: 'OK' }]);
      return;
    }
    Alert.alert('Actions', `Order ${item.id}`, buttons);
  };

  const terimaPembatalan = async (item: OrderCard) => {
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
        update_stok: true,
      }];
      const res = await ApiService.authenticatedRequest('/ecommerce/pembatalan', { method: 'POST', body: JSON.stringify(body) });
      if (res?.status) {
        Alert.alert('Sukses', 'Pembatalan pesanan berhasil diterima.');
        fetchOrders();
      } else {
        const reason = res?.reason || res?.message || 'Gagal memproses pembatalan';
        Alert.alert('Gagal', reason);
      }
    } catch (e: any) {
      console.error('terimaPembatalan error', e);
      Alert.alert('Error', e?.message || 'Gagal memproses pembatalan');
    }
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
      
      const list = Array.isArray(res.data) ? res.data : [res];

      // Fetch recipe details if Shopee orders are present
      const shopeeOrders = list.filter((it: any) => !it.error && it.data && it.platform === 'SHOPEE' && it.type === 'data');
      let recipesMap: any = {};
      if (shopeeOrders.length > 0) {
        try {
          const orderIds = shopeeOrders.map((it: any) => it.order_id);
          const recipeRes = await ApiService.authenticatedRequest('/resi_recipe_details', {
            method: 'POST',
            body: JSON.stringify({ order_ids: orderIds }),
          });
          if (recipeRes?.status && Array.isArray(recipeRes.data)) {
            recipesMap = recipeRes.data.reduce((acc: any, row: any) => {
              const orderId = String(row.online_id || row.booking_sn || row.raw_online_id);
              if (!acc[orderId]) acc[orderId] = {};
              const recipeSku = String(row.recipe_sku);
              if (!acc[orderId][recipeSku]) acc[orderId][recipeSku] = [];
              
              const existing = acc[orderId][recipeSku].find((c: any) => c.component_sku === row.component_sku && c.stock_type === row.stock_type && c.warehouse_name === row.warehouse_name);
              if (existing) {
                existing.component_qty += row.component_qty;
              } else {
                acc[orderId][recipeSku].push({
                  recipe_nama: row.recipe_nama,
                  component_nama: row.component_nama,
                  component_sku: row.component_sku,
                  component_qty: row.component_qty,
                  warehouse_name: row.warehouse_name,
                  stock_type: row.stock_type
                });
              }
              return acc;
            }, {});
          }
        } catch (recipeErr) {
          console.warn('Failed to fetch recipe details for labels:', recipeErr);
        }
      }

      const { processShippingLabels } = require('../../utils/printHelper');
      const processed = processShippingLabels(list, recipesMap);
      
      if (processed.error) {
        Alert.alert('Failed', processed.error);
        return;
      }
      
      navigation.navigate('LabelPreview', { 
        html: processed.html, 
        pdfUrl: processed.pdfUrl, 
        title: `${item.platform} Label` 
      });
    } catch (e: any) {
      console.error('printLabel error', e);
      Alert.alert('Error', e?.message || 'Failed to print label');
    }
  };

  // Bulk actions
  const bulkCreateSales = async () => {
    if (!access?.actions?.create) {
      Alert.alert('Permission', 'You do not have permission');
      return;
    }

    const selectedOrders = allItems.filter((item) => selectedIds.has(item.id));
    if (selectedOrders.length === 0) {
      Alert.alert('No Selection', 'Please select orders first');
      return;
    }

    setBulkProcessing(true);
    setShowActionSheet(false);

    try {
      // Process in chunks of 5
      const CHUNK_SIZE = 5;
      const chunks = [];
      for (let i = 0; i < selectedOrders.length; i += CHUNK_SIZE) {
        chunks.push(selectedOrders.slice(i, i + CHUNK_SIZE));
      }

      let successCount = 0;
      let failCount = 0;

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        // Fetch details for each order in chunk
        const chunkData = await Promise.all(
          chunk.map(async (order) => {
            try {
              const detail = await ApiService.authenticatedRequest(
                `/get/ecommerce/order?id=${order.id}&id_ecommerce=${order.id_ecommerce}`
              );
              if (!detail?.status) return null;
              const d = detail.data;
              return {
                platform: d.from,
                id: d.id,
                barang: (d.items || []).map((it: any) => ({
                  price: it.price_after_discount ?? it.price ?? 0,
                  name: it.name,
                  sku: it.sku,
                  qty: it.qty,
                  id_online: it.id_online,
                  id_parent: it.id_parent,
                })),
                id_ecommerce: d.id_ecommerce || order.id_ecommerce,
                date: typeof d.date === 'string' ? d.date : new Date().toISOString(),
                invoice: d.invoice,
                from_import: false,
                booking_sn: d.booking_sn,
                orderType: d.orderType,
                isBookingOrder: !!d.booking_sn,
              };
            } catch {
              return null;
            }
          })
        );

        const validData = chunkData.filter((d) => d !== null);
        if (validData.length === 0) continue;

        const res = await ApiService.authenticatedRequest('/ecommerce/pesanan', {
          method: 'POST',
          body: JSON.stringify(validData),
        });

        if (res?.status) {
          successCount += validData.length;
        } else {
          failCount += validData.length;
        }
      }

      Alert.alert(
        'Bulk Create Sales',
        `Success: ${successCount}\nFailed: ${failCount}`,
        [{ text: 'OK', onPress: () => fetchOrders() }]
      );
      clearSelection();
    } catch (e: any) {
      console.error('bulkCreateSales error', e);
      Alert.alert('Error', e?.message || 'Bulk create sales failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkPrintLabels = async () => {
    if (!access?.actions?.create) {
      Alert.alert('Permission', 'You do not have permission');
      return;
    }

    const selectedOrders = allItems.filter((item) => selectedIds.has(item.id));
    if (selectedOrders.length === 0) {
      Alert.alert('No Selection', 'Please select orders first');
      return;
    }

    setBulkProcessing(true);
    setShowActionSheet(false);

    try {
      const payload = selectedOrders.map((order) => ({
        id_ecommerce: order.id_ecommerce,
        order_id: order.id,
        booking_sn: order.booking_sn,
        A6: true,
      }));

      const res = await ApiService.authenticatedRequest('/ecommerce/ship_label', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res || res.status === false) {
        Alert.alert('Failed', res?.reason || 'Failed to get labels');
        return;
      }

      const list = Array.isArray(res.data) ? res.data : [res];

      // Fetch recipe details if Shopee orders are present
      const shopeeOrders = list.filter((it: any) => !it.error && it.data && it.platform === 'SHOPEE' && it.type === 'data');
      let recipesMap: any = {};
      if (shopeeOrders.length > 0) {
        try {
          const orderIds = shopeeOrders.map((it: any) => it.order_id);
          const recipeRes = await ApiService.authenticatedRequest('/resi_recipe_details', {
            method: 'POST',
            body: JSON.stringify({ order_ids: orderIds }),
          });
          if (recipeRes?.status && Array.isArray(recipeRes.data)) {
            recipesMap = recipeRes.data.reduce((acc: any, row: any) => {
              const orderId = String(row.online_id || row.booking_sn || row.raw_online_id);
              if (!acc[orderId]) acc[orderId] = {};
              const recipeSku = String(row.recipe_sku);
              if (!acc[orderId][recipeSku]) acc[orderId][recipeSku] = [];
              
              const existing = acc[orderId][recipeSku].find((c: any) => c.component_sku === row.component_sku && c.stock_type === row.stock_type && c.warehouse_name === row.warehouse_name);
              if (existing) {
                existing.component_qty += row.component_qty;
              } else {
                acc[orderId][recipeSku].push({
                  recipe_nama: row.recipe_nama,
                  component_nama: row.component_nama,
                  component_sku: row.component_sku,
                  component_qty: row.component_qty,
                  warehouse_name: row.warehouse_name,
                  stock_type: row.stock_type
                });
              }
              return acc;
            }, {});
          }
        } catch (recipeErr) {
          console.warn('Failed to fetch recipe details for labels:', recipeErr);
        }
      }

      const { processShippingLabels } = require('../../utils/printHelper');
      const processed = processShippingLabels(list, recipesMap);

      if (processed.error) {
        Alert.alert('Failed', processed.error);
        return;
      }

      navigation.navigate('LabelPreview', {
        html: processed.html,
        pdfUrl: processed.pdfUrl,
        title: `${selectedOrders.length} Labels`,
      });
      clearSelection();
    } catch (e: any) {
      console.error('bulkPrintLabels error', e);
      Alert.alert('Error', e?.message || 'Failed to print labels');
    } finally {
      setBulkProcessing(false);
    }
  };

  const showDaftarBarangModal = async () => {
    const selectedOrders = allItems.filter((item) => selectedIds.has(item.id));
    if (selectedOrders.length === 0) {
      Alert.alert('No Selection', 'Please select orders first');
      return;
    }

    setShowActionSheet(false);

    // Aggregate items from all selected orders
    const items: ProductItem[] = [];
    selectedOrders.forEach((order) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          items.push({
            name: item.name || '',
            sku: item.sku || '',
            qty: Number(item.qty) || 0,
            varian: item.varian || item.variation_name || '',
            image_url: item.image_url || item.image || '',
          });
        });
      }
    });

    setDaftarBarangItems(items);
    setShowDaftarBarang(true);
  };

  // Action sheet actions
  const actionSheetActions: ActionSheetAction[] = [
    {
      label: `Create Sales (${selectedIds.size} orders)`,
      icon: 'add-circle-outline',
      onPress: bulkCreateSales,
      disabled: selectedIds.size === 0 || bulkProcessing,
      variant: 'primary',
    },
    {
      label: `Print Labels (${selectedIds.size} orders)`,
      icon: 'print-outline',
      onPress: bulkPrintLabels,
      disabled: selectedIds.size === 0 || bulkProcessing,
      variant: 'default',
    },
    {
      label: `View Products (${selectedIds.size} orders)`,
      icon: 'list-outline',
      onPress: showDaftarBarangModal,
      disabled: selectedIds.size === 0,
      variant: 'default',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header with Hamburger Menu */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pesanan</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Selection mode bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={clearSelection} style={styles.selectionButton}>
            <Ionicons name="close" size={20} color="#111827" />
            <Text style={styles.selectionText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={selectAll} style={styles.selectionButton}>
            <Text style={styles.selectionText}>Select All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput style={styles.input} placeholder="Search ID / Resi / Kurir / Shop" value={query} onChangeText={setQuery} />
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <TouchableOpacity style={styles.filterPill} onPress={() => changePreset(1)}>
          <Ionicons name="today-outline" size={16} color="#111827" />
          <Text style={styles.filterText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill} onPress={() => changePreset(7)}>
          <Ionicons name="calendar-outline" size={16} color="#111827" />
          <Text style={styles.filterText}>7d</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill} onPress={() => changePreset(30)}>
          <Ionicons name="calendar" size={16} color="#111827" />
          <Text style={styles.filterText}>30d</Text>
        </TouchableOpacity>
      </View>

      {/* Status chips */}
      <View style={styles.chipsRow}>
        <FlatList
          data={STATUS_CHIPS}
          horizontal
          keyExtractor={(s) => s}
          renderItem={({ item }) => statusChip(item)}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Dibuat filter chips */}
      <View style={styles.chipsRow}>
        <FlatList
          data={DIBUAT_CHIPS}
          horizontal
          keyExtractor={(s) => s}
          renderItem={({ item }) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, dibuatFilter === item && styles.chipActive]}
              onPress={() => setDibuatFilter(item)}
            >
              <Text style={[styles.chipText, dibuatFilter === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Print filter chips */}
      <View style={styles.chipsRow}>
        <FlatList
          data={PRINT_CHIPS}
          horizontal
          keyExtractor={(s) => s}
          renderItem={({ item }) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, printFilter === item && styles.chipActive]}
              onPress={() => setPrintFilter(item)}
            >
              <Text style={[styles.chipText, printFilter === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Orders */}
      <FlatList
        data={filtered}
        keyExtractor={(it) => `${it.id}-${it.id_ecommerce}`}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListFooterComponent={
          <View style={{ paddingVertical: 12 }}>{loading && <ActivityIndicator />}</View>
        }
      />

      {/* Shop quick toggles */}
      {!selectionMode && (
        <View style={[styles.shopBar, { paddingBottom: Math.max(insets.bottom, 12), paddingTop: 12 }]}>
          <FlatList
            data={[{ id: 0, name: 'All', platform: 'ALL' } as EcommerceShop, ...shops]}
            keyExtractor={(s) => String(s.id)}
            horizontal
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.shopChip, selectedShopId === item.id && styles.shopChipActive]}
                onPress={() => setSelectedShopId(item.id)}
              >
                <Text style={[styles.shopChipText, selectedShopId === item.id && styles.shopChipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* FAB for bulk actions */}
      {!selectionMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            if (filtered.length === 0) {
              Alert.alert('No Orders', 'No orders to select');
              return;
            }
            setSelectionMode(true);
          }}
        >
          <Ionicons name="checkmark-done" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Bulk action button (when in selection mode) */}
      {selectionMode && selectedIds.size > 0 && (
        <TouchableOpacity
          style={styles.bulkActionButton}
          onPress={() => setShowActionSheet(true)}
          disabled={bulkProcessing}
        >
          {bulkProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="flash" size={20} color="#FFFFFF" />
              <Text style={styles.bulkActionText}>Actions ({selectedIds.size})</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Bottom Action Sheet */}
      <BottomActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        title="Bulk Actions"
        subtitle={`${selectedIds.size} orders selected`}
        actions={actionSheetActions}
      />

      {/* Daftar Barang Modal */}
      <DaftarBarangModal
        visible={showDaftarBarang}
        onClose={() => setShowDaftarBarang(false)}
        items={daftarBarangItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  hamburgerButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  input: { flex: 1, paddingHorizontal: 8, height: 40 },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterText: { color: '#111827' },
  chipsRow: { paddingHorizontal: 8, paddingBottom: 8 },
  chip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  chipActive: { backgroundColor: '#111827' },
  chipText: { color: '#111827', fontSize: 12 },
  chipTextActive: { color: 'white' },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    borderRadius: 10,
    elevation: 2,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#fbbf24',
    backgroundColor: '#FFFBEB',
  },
  checkbox: {
    marginRight: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  dateText: { fontSize: 11, color: '#059669', marginTop: 2, fontWeight: '500' },
  meta: { fontSize: 12, color: '#374151', marginTop: 4 },
  ekspedisi: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  statusBadge: {
    backgroundColor: '#EEF2FF',
    color: '#3730a3',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  orderTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  tagWarning: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagInfo: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagSuccess: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagPrint: {
    backgroundColor: '#E0E7FF',
    color: '#3730A3',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagScanned: {
    backgroundColor: '#FDE68A',
    color: '#78350F',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  kebab: { paddingHorizontal: 8, justifyContent: 'center' },
  shopBar: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  shopChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  shopChipActive: { backgroundColor: '#111827' },
  shopChipText: { color: '#111827', fontSize: 12 },
  shopChipTextActive: { color: 'white' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bulkActionButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bulkActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

