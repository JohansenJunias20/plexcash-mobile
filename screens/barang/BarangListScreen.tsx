import React, { useEffect, useMemo, useState } from 'react';
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
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import { AppStackParamList } from '../../navigation/RootNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService, { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';
import NewOnlineModal from '../../components/NewOnlineModal';
import KartuStokModal from '../../components/KartuStokModal';

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

// Type for sync result per marketplace
interface SyncPlatformResult {
  platform: string;
  shop_id: string;
  shop_name: string;
  success: boolean;
  error?: string;
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
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [showKartuStok, setShowKartuStok] = useState(false);
  const [kartuStokItemId, setKartuStokItemId] = useState<number | null>(null);
  const [kartuStokItemNama, setKartuStokItemNama] = useState<string>('');

  // Sync settings from server
  const [syncStockEnabled, setSyncStockEnabled] = useState(false);
  const [syncPriceEnabled, setSyncPriceEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Sync result modal state
  const [showSyncResultModal, setShowSyncResultModal] = useState(false);
  const [syncResultLoading, setSyncResultLoading] = useState(false);
  const [syncResultProductName, setSyncResultProductName] = useState('');
  const [syncResultData, setSyncResultData] = useState<SyncPlatformResult[] | null>(null);
  const [syncResultDisabled, setSyncResultDisabled] = useState(false);
  const [syncResultDisabledReason, setSyncResultDisabledReason] = useState('');
  const [syncPriceResult, setSyncPriceResult] = useState<{ success: boolean; error?: string } | null>(null);

  const PAGE_SIZE = 30;

  // Determine sync button label based on settings
  const syncButtonLabel = useMemo(() => {
    if (syncStockEnabled && syncPriceEnabled) return 'Sync Stok & Harga';
    if (syncStockEnabled) return 'Sync Stok';
    if (syncPriceEnabled) return 'Sync Harga';
    return null; // both disabled → hide button
  }, [syncStockEnabled, syncPriceEnabled]);

  // Load sync settings from server
  const loadSyncSettings = async () => {
    try {
      const data = await ApiService.get('/get/settings');
      if (data && data.status && Array.isArray(data.data)) {
        const settings = data.data;
        const stockSetting = settings.find((s: any) => s.setting === 'sync_stock');
        const priceSetting = settings.find((s: any) => s.setting === 'sync_price');
        setSyncStockEnabled(stockSetting?.value === 'true');
        setSyncPriceEnabled(priceSetting?.value === 'true');
      }
    } catch (e) {
      console.warn('[BARANG] Failed to load sync settings:', e);
    } finally {
      setSettingsLoaded(true);
    }
  };

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
      console.log('📋 [BARANG] Starting data fetch via ApiService');
      setLoading(true);
      const endpoint = `/get/masterbarang/search?${qs.toString()}`;
      const data = await ApiService.get(endpoint);

      if (data && typeof data === 'object' && data.status) {
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
        const reason = typeof data === 'object' ? data?.reason : String(data);
        console.warn('Fetch error:', reason);
      }
    } catch (e: any) {
      console.error('Fetch items error', e);
      if (e?.message !== 'Forbidden' && e?.message !== 'Unauthorized') {
        Alert.alert('Error', 'Gagal mengambil data barang. Silakan periksa koneksi Anda.');
      }
    } finally {
      setLoading(false);
      if (refreshing) setRefreshing(false);
    }
  };

  // Reload sync settings every time screen comes into focus (e.g. after changing settings)
  useFocusEffect(
    React.useCallback(() => {
      loadSyncSettings();
    }, [])
  );

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

  const openKartuStokInline = (item: Item) => {
    setKartuStokItemId(item.id);
    setKartuStokItemNama(item.nama);
    setShowKartuStok(true);
  };

  const handleOnline = () => {
    if (selectedItem) {
      setShowActionSheet(false);
      setShowOnlineModal(true);
    }
  };

  const handleSyncStock = async () => {
    if (!selectedItem) return;
    setShowActionSheet(false);

    // Reset result state and show modal
    setSyncResultProductName(selectedItem.nama || selectedItem.sku);
    setSyncResultData(null);
    setSyncResultDisabled(false);
    setSyncResultDisabledReason('');
    setSyncPriceResult(null);
    setSyncResultLoading(true);
    setShowSyncResultModal(true);

    try {
      const token = await getTokenAuth();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const body = JSON.stringify([{ id_barang: selectedItem.id }]);

      // Sync stock if enabled
      if (syncStockEnabled) {
        try {
          const stockRes = await fetch(`${API_BASE_URL}/ecommerce/sync/stock`, {
            method: 'POST',
            headers,
            body,
          });
          const stockData = await stockRes.json();

          if (stockData.status) {
            const syncData = stockData.data;
            if (syncData?.disabled) {
              setSyncResultDisabled(true);
              setSyncResultDisabledReason(syncData.reason || 'Sync stok dinonaktifkan di pengaturan.');
              setSyncResultData([]);
            } else {
              setSyncResultData(syncData?.platforms || []);
            }
          } else {
            setSyncResultData([
              {
                platform: 'ERROR',
                shop_id: '',
                shop_name: 'System',
                success: false,
                error: stockData.reason || 'Sync stok gagal',
              },
            ]);
          }
        } catch (err) {
          setSyncResultData([
            {
              platform: 'ERROR',
              shop_id: '',
              shop_name: 'System',
              success: false,
              error: String(err),
            },
          ]);
        }
      }

      // Sync price if enabled
      if (syncPriceEnabled) {
        try {
          const priceRes = await fetch(`${API_BASE_URL}/ecommerce/sync/price`, {
            method: 'POST',
            headers,
            body,
          });
          const priceData = await priceRes.json();
          setSyncPriceResult({ success: priceData.status, error: priceData.status ? undefined : (priceData.reason || 'Sync harga gagal') });
        } catch (err) {
          setSyncPriceResult({ success: false, error: String(err) });
        }
      }
    } finally {
      setSyncResultLoading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null || value === 0) return 'Rp 0';
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BarangEdit', { id: item.id })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.nama}</Text>
        <Text style={styles.subtitle}>{item.sku} • {item.merk}</Text>
        <View style={styles.row}>
          <Text style={styles.badge}>Stok: {item.stok}</Text>
          <Text style={styles.badgeHpp}>HPP: {formatCurrency(item.hpp)}</Text>
          {/* DPP Hidden as requested */}
          <Text style={styles.badge}>HJ1: {formatCurrency(item.hargajual)}</Text>
          <Text style={styles.badge}>HJ2: {formatCurrency(item.hargajual2)}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        {/* Kartu Stok info button */}
        <TouchableOpacity
          style={styles.infoBtn}
          onPress={() => openKartuStokInline(item)}
        >
          <Ionicons name="information-circle" size={22} color="#3b82f6" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.kebab} onPress={() => handleActionSheet(item)}>
          <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>
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

  // Render per-platform row in sync result modal
  const renderPlatformRow = (p: SyncPlatformResult, idx: number) => (
    <View key={idx} style={[styles.platformRow, p.success ? styles.platformRowSuccess : styles.platformRowError]}>
      <View style={styles.platformRowLeft}>
        <View style={[styles.platformBadge, { backgroundColor: getPlatformColor(p.platform) }]}>
          <Text style={styles.platformBadgeText}>{p.platform}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>{p.shop_name || p.shop_id || '-'}</Text>
          {!p.success && p.error && (
            <Text style={styles.errorText} numberOfLines={2}>{p.error}</Text>
          )}
        </View>
      </View>
      <View style={[styles.statusBadge, p.success ? styles.statusSuccess : styles.statusError]}>
        <Ionicons
          name={p.success ? 'checkmark-circle' : 'close-circle'}
          size={18}
          color={p.success ? '#059669' : '#dc2626'}
        />
        <Text style={[styles.statusText, { color: p.success ? '#059669' : '#dc2626' }]}>
          {p.success ? 'Berhasil' : 'Gagal'}
        </Text>
      </View>
    </View>
  );

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      SHOPEE: '#ee4d2d',
      TOKOPEDIA: '#42b549',
      LAZADA: '#0f146d',
      TIKTOK: '#010101',
      BLIBLI: '#0095da',
      ERROR: '#6b7280',
    };
    return colors[platform?.toUpperCase()] || '#6b7280';
  };

  // Calculate summary counts
  const successCount = syncResultData?.filter(p => p.success).length ?? 0;
  const failCount = syncResultData?.filter(p => !p.success).length ?? 0;

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
        <Text style={styles.headerTitle}>Barang</Text>
        <View style={styles.headerRight} />
      </View>

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
            <View style={styles.actionSheetHandle} />
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

            {/* Sync button — only show if at least one sync setting is enabled */}
            {settingsLoaded && syncButtonLabel && (
              <TouchableOpacity style={styles.actionItem} onPress={handleSyncStock}>
                <Ionicons name="sync-outline" size={22} color="#d97706" />
                <Text style={styles.actionText}>{syncButtonLabel}</Text>
              </TouchableOpacity>
            )}

            {/* Show skeleton/loading while settings load */}
            {!settingsLoaded && (
              <View style={[styles.actionItem, { opacity: 0.4 }]}>
                <Ionicons name="sync-outline" size={22} color="#d97706" />
                <Text style={styles.actionText}>Sync...</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.actionItem, styles.cancelItem]} onPress={() => setShowActionSheet(false)}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Sync Result Modal */}
      <Modal
        visible={showSyncResultModal}
        transparent
        animationType="slide"
        onRequestClose={() => !syncResultLoading && setShowSyncResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.syncResultSheet}>
            {/* Header */}
            <View style={styles.syncResultHeader}>
              <View style={styles.syncResultHeaderIcon}>
                <Ionicons name="sync" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.syncResultTitle}>
                  {syncStockEnabled && syncPriceEnabled
                    ? 'Sync Stok & Harga'
                    : syncStockEnabled
                    ? 'Sync Stok'
                    : 'Sync Harga'}
                </Text>
                <Text style={styles.syncResultProductName} numberOfLines={1}>
                  {syncResultProductName}
                </Text>
              </View>
              {!syncResultLoading && (
                <TouchableOpacity onPress={() => setShowSyncResultModal(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.syncResultBody} showsVerticalScrollIndicator={false}>
              {/* Loading State */}
              {syncResultLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#f59e0b" />
                  <Text style={styles.loadingText}>Sedang sinkronisasi ke marketplace...</Text>
                </View>
              )}

              {/* Disabled State */}
              {!syncResultLoading && syncResultDisabled && (
                <View style={styles.disabledContainer}>
                  <Ionicons name="warning-outline" size={32} color="#d97706" />
                  <Text style={styles.disabledTitle}>Sync Stok Dinonaktifkan</Text>
                  <Text style={styles.disabledText}>{syncResultDisabledReason}</Text>
                </View>
              )}

              {/* Stock Sync Results */}
              {!syncResultLoading && !syncResultDisabled && syncStockEnabled && syncResultData !== null && (
                <View>
                  {/* Summary bar */}
                  {syncResultData.length > 0 && (
                    <View style={styles.summaryBar}>
                      <View style={styles.summaryItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#059669" />
                        <Text style={[styles.summaryCount, { color: '#059669' }]}>{successCount} Berhasil</Text>
                      </View>
                      {failCount > 0 && (
                        <View style={styles.summaryItem}>
                          <Ionicons name="close-circle" size={16} color="#dc2626" />
                          <Text style={[styles.summaryCount, { color: '#dc2626' }]}>{failCount} Gagal</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={styles.sectionLabel}>
                    {syncStockEnabled ? '📦 Hasil Sync Stok' : ''}
                  </Text>

                  {syncResultData.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="storefront-outline" size={28} color="#9ca3af" />
                      <Text style={styles.emptyText}>Tidak ada marketplace yang terdaftar</Text>
                    </View>
                  ) : (
                    syncResultData.map((p, idx) => renderPlatformRow(p, idx))
                  )}
                </View>
              )}

              {/* Price Sync Result */}
              {!syncResultLoading && syncPriceEnabled && syncPriceResult !== null && (
                <View style={styles.priceResultSection}>
                  <Text style={styles.sectionLabel}>💰 Hasil Sync Harga</Text>
                  <View style={[
                    styles.priceResultRow,
                    syncPriceResult.success ? styles.platformRowSuccess : styles.platformRowError,
                  ]}>
                    <View style={styles.platformRowLeft}>
                      <Ionicons
                        name={syncPriceResult.success ? 'checkmark-circle' : 'close-circle'}
                        size={22}
                        color={syncPriceResult.success ? '#059669' : '#dc2626'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.shopName, { color: syncPriceResult.success ? '#059669' : '#dc2626' }]}>
                          {syncPriceResult.success ? 'Harga berhasil disinkronisasi ke semua marketplace' : 'Sync harga gagal'}
                        </Text>
                        {!syncPriceResult.success && syncPriceResult.error && (
                          <Text style={styles.errorText}>{syncPriceResult.error}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Done state spacer */}
              {!syncResultLoading && <View style={{ height: 16 }} />}
            </ScrollView>

            {/* Footer */}
            {!syncResultLoading && (
              <TouchableOpacity
                style={styles.syncDoneBtn}
                onPress={() => setShowSyncResultModal(false)}
              >
                <Text style={styles.syncDoneBtnText}>Tutup</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Online Product Management Modal */}
      <NewOnlineModal
        visible={showOnlineModal}
        productId={selectedItem?.id || null}
        onClose={() => setShowOnlineModal(false)}
      />

      {/* Kartu Stok Inline Modal */}
      <KartuStokModal
        visible={showKartuStok}
        itemId={kartuStokItemId}
        itemNama={kartuStokItemNama}
        onClose={() => setShowKartuStok(false)}
      />
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
  toggle: { marginHorizontal: 8, color: '#6B7280', fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 12, marginVertical: 6, padding: 12, borderRadius: 10, elevation: 2 },
  cardActions: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 as any },
  infoBtn: { padding: 4 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8 as any, marginTop: 6, flexWrap: 'wrap' },
  badge: { backgroundColor: '#eef2ff', color: '#3730a3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12 },
  badgeDpp: { backgroundColor: '#dbeafe', color: '#1e40af', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, fontWeight: '600' },
  badgeHpp: { backgroundColor: '#fef3c7', color: '#92400e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, fontWeight: '600' },
  kebab: { paddingHorizontal: 8, justifyContent: 'center' },
  loadMore: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', elevation: 4 },

  // Modal overlay
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },

  // Action Sheet
  actionSheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28 },
  actionSheetHandle: { width: 36, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  actionSheetHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  actionSheetTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  actionSheetSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 12 as any },
  actionText: { fontSize: 16, color: '#111827' },
  cancelItem: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 },
  cancelText: { fontSize: 16, color: '#dc2626', fontWeight: '600', textAlign: 'center', flex: 1 },

  // Sync Result Modal
  syncResultSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 8,
  },
  syncResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12 as any,
  },
  syncResultHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncResultTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  syncResultProductName: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  closeBtn: { padding: 4 },
  syncResultBody: { padding: 16, flexGrow: 1 },

  // Loading
  loadingContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 as any },
  loadingText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },

  // Disabled
  disabledContainer: { alignItems: 'center', paddingVertical: 28, gap: 10 as any },
  disabledTitle: { fontSize: 15, fontWeight: '600', color: '#d97706' },
  disabledText: { fontSize: 13, color: '#6b7280', textAlign: 'center' },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    gap: 16 as any,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 as any },
  summaryCount: { fontSize: 13, fontWeight: '600' },

  // Section label
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 24, gap: 8 as any },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

  // Platform row
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  platformRowSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  platformRowError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  platformRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 as any, flex: 1 },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  platformBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  shopName: { fontSize: 13, fontWeight: '500', color: '#111827' },
  errorText: { fontSize: 11, color: '#dc2626', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 as any, paddingLeft: 8 },
  statusSuccess: {},
  statusError: {},
  statusText: { fontSize: 12, fontWeight: '600' },

  // Price result
  priceResultSection: { marginTop: 16 },
  priceResultRow: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },

  // Done button
  syncDoneBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  syncDoneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
