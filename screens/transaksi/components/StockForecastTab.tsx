import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';
import KartuStokModal from '../../../components/KartuStokModal';

export interface ForecastItem {
  id: number;
  sku: string;
  nama: string;
  merk: string;
  kategori: string;
  gambar?: string | null;
  lead_time_supplier: number;
  lead_time_source?: 'History' | 'Supplier' | 'Product' | 'Default';
  avg_daily_demand: number;
  active_days?: number;
  total_sales_30d?: number;
  ready_stock: number;
  incoming_po: number;
  reserved_stock: number;
  effective_stock: number;
  safety_stock: number;
  rop: number;
  days_of_inventory: string;
  status: 'Aman' | 'Siapkan PO' | 'Order Sekarang' | 'Terlambat';
  qty_pesan: number;
}

interface PendingPO {
  id: number;
  tanggal_po: string;
  supplier_nama?: string;
  qty: number;
  tanggal_perkiraan_sampai?: string | null;
}

interface StockForecastTabProps {
  refreshing: boolean;
  onRefresh: () => void;
  /** Called after an item is successfully ordered, so the parent can refresh other tabs */
  onOrdered?: () => void;
}

const PAGE_SIZE = 50;

const STATUS_FILTERS = ['Semua', 'Terlambat', 'Order Sekarang', 'Siapkan PO', 'Aman'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

// Same colour semantics as the web Stock Forecast tab
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  'Terlambat': { bg: '#fee2e2', fg: '#ef4444' },
  'Order Sekarang': { bg: '#ffedd5', fg: '#f97316' },
  'Siapkan PO': { bg: '#fef9c3', fg: '#a16207' },
  'Aman': { bg: '#dcfce7', fg: '#16a34a' },
};

const LEAD_TIME_SOURCE_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  History: { label: 'Riwayat PO', bg: '#e0f2fe', fg: '#0369a1' },
  Supplier: { label: 'Supplier', bg: '#f3e8ff', fg: '#6b21a8' },
  Product: { label: 'Barang', bg: '#e0e7ff', fg: '#3730a3' },
  Default: { label: 'Default', bg: '#f3f4f6', fg: '#374151' },
};

const STATUS_HINT: Record<string, string> = {
  'Aman': 'Stok masih di atas batas wajar (ROP).',
  'Siapkan PO': 'Stok hampir mencapai batas wajar. Cek harga supplier.',
  'Order Sekarang': 'Stok sudah menyentuh batas kritis. Segera lakukan pesanan.',
  'Terlambat': 'Stok efektif negatif atau barang kosong namun ada kebutuhan.',
};

export default function StockForecastTab({ refreshing, onRefresh, onOrdered }: StockForecastTabProps) {
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Semua');
  const [targetDays, setTargetDays] = useState(30);
  const [targetDaysInput, setTargetDaysInput] = useState('30');

  const [supplierModalItem, setSupplierModalItem] = useState<ForecastItem | null>(null);
  const [kartuStokItem, setKartuStokItem] = useState<ForecastItem | null>(null);

  const [poModalItem, setPoModalItem] = useState<ForecastItem | null>(null);
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Guards against out-of-order responses when filters change while a fetch is in flight
  const fetchIdRef = useRef(0);

  // Load the saved target days once, mirroring the web tab's `forecast_target_days` setting
  useEffect(() => {
    (async () => {
      try {
        const res = await ApiService.get('/get/settings');
        if (res?.status && Array.isArray(res.data)) {
          const found = res.data.find((s: any) => s.setting === 'forecast_target_days');
          const parsed = parseInt(found?.value, 10);
          if (!isNaN(parsed) && parsed > 0) {
            setTargetDays(parsed);
            setTargetDaysInput(String(parsed));
          }
        }
      } catch (e) {
        console.log('[StockForecast] Error loading settings:', e);
      }
    })();
  }, []);

  const fetchData = useCallback(
    async (pageToLoad: number, append: boolean) => {
      const thisFetchId = ++fetchIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', String(pageToLoad));
        params.set('pageSize', String(PAGE_SIZE));
        params.set('targetDays', String(targetDays));

        const filters: { field: string; filter: string }[] = [];
        const term = search.trim();
        if (term) filters.push({ field: 'nama', filter: term });
        if (statusFilter !== 'Semua') filters.push({ field: 'status', filter: statusFilter });
        if (filters.length > 0) params.set('filter', JSON.stringify({ items: filters }));

        const res = await ApiService.get(
          `/get/masterbarang/stock-forecast/paged?${params.toString()}`
        );

        // A newer request has started - discard this (stale) response
        if (thisFetchId !== fetchIdRef.current) return;

        if (res?.status && res.data) {
          const rows: ForecastItem[] = (res.data.rows || []).map((r: any) => ({
            ...r,
            avg_daily_demand: parseFloat(r.avg_daily_demand) || 0,
            ready_stock: parseInt(r.ready_stock, 10) || 0,
            incoming_po: parseInt(r.incoming_po, 10) || 0,
            reserved_stock: parseInt(r.reserved_stock, 10) || 0,
            effective_stock: parseInt(r.effective_stock, 10) || 0,
            safety_stock: parseInt(r.safety_stock, 10) || 0,
            rop: parseInt(r.rop, 10) || 0,
            lead_time_supplier: parseInt(r.lead_time_supplier, 10) || 0,
            qty_pesan: parseInt(r.qty_pesan, 10) || 0,
          }));
          setItems(prev => (append ? [...prev, ...rows] : rows));
          setTotal(res.data.total || 0);
          setPage(pageToLoad);
        } else if (!append) {
          setItems([]);
          setTotal(0);
        }
      } catch (error) {
        console.error('[StockForecast] Error fetching data:', error);
        if (thisFetchId === fetchIdRef.current && !append) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (thisFetchId === fetchIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [targetDays, search, statusFilter]
  );

  // Debounce search so typing doesn't fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => fetchData(1, false), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  const handleRefresh = () => {
    onRefresh();
    fetchData(1, false);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore) return;
    if (items.length >= total) return;
    fetchData(page + 1, true);
  };

  const commitTargetDays = () => {
    const parsed = Math.max(1, parseInt(targetDaysInput, 10) || 1);
    setTargetDaysInput(String(parsed));
    if (parsed === targetDays) return;

    setTargetDays(parsed);
    // Persist to the same setting the web tab uses
    ApiService.post('/settings', { forecast_target_days: String(parsed) }).catch(err =>
      console.log('[StockForecast] Error saving target days:', err)
    );
  };

  const handleQtyChange = (id: number, value: string) => {
    const qty = parseInt(value, 10) || 0;
    setItems(prev => prev.map(it => (it.id === id ? { ...it, qty_pesan: Math.max(0, qty) } : it)));
  };

  const openPendingPO = async (item: ForecastItem) => {
    setPoModalItem(item);
    setPendingPOs([]);
    setLoadingPOs(true);
    try {
      const res = await ApiService.get(`/get/masterbarang/stock-forecast/${item.id}/pending-po`);
      if (res?.status) setPendingPOs(res.data || []);
    } catch (e) {
      console.error('[StockForecast] Error fetching pending PO:', e);
    } finally {
      setLoadingPOs(false);
    }
  };

  const handleSupplierSelected = async (supplier: SupplierItem) => {
    const item = supplierModalItem;
    setSupplierModalItem(null);
    if (!item) return;

    try {
      const res = await ApiService.patch(`/masterbarang/pesan/${item.id}`, {
        id_supplier: supplier.id,
        qty_pesan: item.qty_pesan,
      });

      if (res?.status) {
        Alert.alert('Berhasil', `"${item.nama}" dipesan ke ${supplier.nama} sebanyak ${item.qty_pesan}.`);
        // Item moves to the "Sudah Pesan" tab, so drop it from this list
        setItems(prev => prev.filter(it => it.id !== item.id));
        setTotal(prev => Math.max(0, prev - 1));
        onOrdered?.();
      } else {
        Alert.alert('Error', res?.reason || 'Gagal menandai barang sebagai dipesan');
      }
    } catch (e) {
      console.error('[StockForecast] Error ordering item:', e);
      Alert.alert('Error', 'Gagal menandai barang sebagai dipesan');
    }
  };

  const handleOrderPress = (item: ForecastItem) => {
    if (!item.qty_pesan || item.qty_pesan <= 0) {
      Alert.alert('Qty belum diisi', 'Isi Qty Pesan terlebih dahulu (harus lebih dari 0).');
      return;
    }
    setSupplierModalItem(item);
  };

  const renderMetric = (label: string, value: React.ReactNode, valueStyle?: any) => (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueStyle]}>{value}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: ForecastItem }) => {
    const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS['Aman'];
    const leadSource = LEAD_TIME_SOURCE_LABEL[item.lead_time_source || 'Default'];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.nama}
            </Text>
            <Text style={styles.productSku}>
              {item.sku || '-'}
              {item.merk ? ` · ${item.merk}` : ''}
              {item.kategori ? ` · ${item.kategori}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.infoBtn} onPress={() => setKartuStokItem(item)}>
            <Ionicons name="information-circle" size={22} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Alert.alert(item.status, STATUS_HINT[item.status] || '')}
          style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}
        >
          <Text style={[styles.statusText, { color: statusColor.fg }]}>{item.status}</Text>
        </TouchableOpacity>

        <View style={styles.metricsGrid}>
          {renderMetric('Ready Stock', item.ready_stock)}
          {renderMetric(
            'Incoming PO',
            item.incoming_po > 0 ? (
              <Text style={styles.linkText} onPress={() => openPendingPO(item)}>
                {item.incoming_po}
              </Text>
            ) : (
              item.incoming_po
            )
          )}
          {renderMetric('Reserved', item.reserved_stock)}
          {renderMetric(
            'Efektif',
            item.effective_stock,
            item.effective_stock < 0 ? styles.negativeValue : undefined
          )}
          {renderMetric('ROP', item.rop)}
          {renderMetric('Safety Stock', item.safety_stock)}
          {renderMetric('Avg/Hari', item.avg_daily_demand.toFixed(2))}
          {renderMetric('Days of Inv', item.days_of_inventory)}
        </View>

        <View style={styles.leadTimeRow}>
          <Text style={styles.metricLabel}>Lead Time</Text>
          <View style={styles.leadTimeValue}>
            <Text style={styles.metricValue}>{item.lead_time_supplier} Hari</Text>
            <View style={[styles.sourceBadge, { backgroundColor: leadSource.bg }]}>
              <Text style={[styles.sourceBadgeText, { color: leadSource.fg }]}>{leadSource.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.qtyContainer}>
            <Text style={styles.qtyLabel}>Qty Pesan:</Text>
            <TextInput
              style={styles.qtyInput}
              value={String(item.qty_pesan)}
              onChangeText={text => handleQtyChange(item.id, text)}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
          <TouchableOpacity style={styles.orderButton} onPress={() => handleOrderPress(item)}>
            <Ionicons name="cart" size={18} color="#ffffff" />
            <Text style={styles.orderButtonText}>Pesan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="analytics-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyText}>Tidak ada data forecast</Text>
        <Text style={styles.emptySubtext}>
          {search || statusFilter !== 'Semua'
            ? 'Coba ubah kata kunci atau filter status'
            : 'Belum ada barang yang bisa dihitung forecast-nya'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search + target days */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama barang..."
            placeholderTextColor="#9ca3af"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.targetDaysBox}>
          <Text style={styles.targetDaysLabel}>Target</Text>
          <TextInput
            style={styles.targetDaysInput}
            value={targetDaysInput}
            onChangeText={setTargetDaysInput}
            onEndEditing={commitTargetDays}
            onSubmitEditing={commitTargetDays}
            keyboardType="numeric"
          />
          <Text style={styles.targetDaysLabel}>hari</Text>
        </View>
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.listContent, items.length === 0 && styles.listContentEmpty]}
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={styles.totalText}>
                Menampilkan {items.length} dari {total} barang
              </Text>
            ) : null
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color="#f59e0b" />
              </View>
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#f59e0b']} />
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Pending PO detail */}
      <Modal
        visible={!!poModalItem}
        transparent
        animationType="fade"
        onRequestClose={() => setPoModalItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                Incoming PO: {poModalItem?.nama}
              </Text>
              <TouchableOpacity onPress={() => setPoModalItem(null)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {loadingPOs ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} color="#f59e0b" />
            ) : pendingPOs.length === 0 ? (
              <Text style={styles.modalEmpty}>Tidak ada data PO pending.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {pendingPOs.map((po, idx) => (
                  <View key={`${po.id}-${idx}`} style={styles.poRow}>
                    <View style={styles.poRowHeader}>
                      <Text style={styles.poId}>PO #{po.id}</Text>
                      <Text style={styles.poQty}>Qty: {po.qty}</Text>
                    </View>
                    <Text style={styles.poMeta}>Supplier: {po.supplier_nama || '-'}</Text>
                    <Text style={styles.poMeta}>
                      Tanggal PO: {po.tanggal_po ? String(po.tanggal_po).slice(0, 10) : '-'}
                    </Text>
                    <Text style={styles.poMeta}>
                      Perkiraan tiba:{' '}
                      {po.tanggal_perkiraan_sampai ? String(po.tanggal_perkiraan_sampai).slice(0, 10) : '-'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <SearchSupplierModal
        visible={!!supplierModalItem}
        onClose={() => setSupplierModalItem(null)}
        onSelect={handleSupplierSelected}
        title="Pilih Supplier"
      />

      <KartuStokModal
        visible={!!kartuStokItem}
        itemId={kartuStokItem?.id ?? null}
        itemNama={kartuStokItem?.nama}
        onClose={() => setKartuStokItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
  },
  targetDaysBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  targetDaysLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  targetDaysInput: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    padding: 0,
  },
  filterBar: {
    maxHeight: 44,
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  filterText: {
    fontSize: 13,
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
    paddingTop: 0,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  totalText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardHeaderText: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  productSku: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  infoBtn: {
    padding: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  metric: {
    width: '25%',
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  negativeValue: {
    color: '#ef4444',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  leadTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  leadTimeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  qtyInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 70,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
  },
  orderButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  footerLoading: {
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalEmpty: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 24,
  },
  poRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  poRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  poId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  poQty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  poMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
});
