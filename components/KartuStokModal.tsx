import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../services/api';
import { getTokenAuth } from '../services/token';

type TabType = 'Pembelian' | 'ReturPembelian' | 'Penjualan' | 'ReturPenjualan' | 'Booking' | 'Gabungan';

interface KartuStokModalProps {
  visible: boolean;
  itemId: number | null;
  itemNama?: string;
  onClose: () => void;
}

const TABS: { key: TabType; label: string }[] = [
  { key: 'Pembelian', label: 'Pembelian' },
  { key: 'ReturPembelian', label: 'Retur Beli' },
  { key: 'Penjualan', label: 'Penjualan' },
  { key: 'ReturPenjualan', label: 'Retur Jual' },
  { key: 'Booking', label: 'Booking' },
  { key: 'Gabungan', label: 'Gabungan' },
];

function getUrl(tab: TabType, itemId: number): string {
  switch (tab) {
    case 'Pembelian':
      return `${API_BASE_URL}/get/kartustok/detailpembelian/join/pembelian/${itemId}`;
    case 'ReturPembelian':
      return `${API_BASE_URL}/get/kartustok/detailreturpembelian/join/returpembelian/${itemId}`;
    case 'Penjualan':
      return `${API_BASE_URL}/get/kartustok/detailpenjualan/join/penjualan/${itemId}`;
    case 'ReturPenjualan':
      return `${API_BASE_URL}/get/kartustok/detailreturpenjualan/join/returpenjualan/${itemId}`;
    case 'Booking':
      return `${API_BASE_URL}/get/kartustok/booking/${itemId}`;
    case 'Gabungan':
      return `${API_BASE_URL}/get/kartustok/gabungan/${itemId}`;
  }
}

const formatCurrency = (value: any): string => {
  const num = Number(value);
  if (!num) return 'Rp 0';
  return `Rp ${num.toLocaleString('id-ID')}`;
};

const formatDate = (value: any): string => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(value);
  }
};

// ─── Per-tab table renderers ───────────────────────────────────────────────

function PembelianTable({ data }: { data: any[] }) {
  return (
    <View style={tableStyles.container}>
      <View style={tableStyles.headerRow}>
        <Text style={[tableStyles.th, { flex: 0.5 }]}>ID</Text>
        <Text style={[tableStyles.th, { flex: 1.2 }]}>Tanggal</Text>
        <Text style={[tableStyles.th, { flex: 0.7 }]}>Qty</Text>
        <Text style={[tableStyles.th, { flex: 1.6 }]}>Harga Beli</Text>
      </View>
      {data.map((item, i) => (
        <View key={i} style={[tableStyles.row, i % 2 === 0 && tableStyles.rowEven]}>
          <Text style={[tableStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tableStyles.td, { flex: 0.7 }]}>{item.qty ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.6 }]}>{formatCurrency(item.harga_beli)}</Text>
        </View>
      ))}
    </View>
  );
}

function ReturPembelianTable({ data }: { data: any[] }) {
  return (
    <View style={tableStyles.container}>
      <View style={tableStyles.headerRow}>
        <Text style={[tableStyles.th, { flex: 0.5 }]}>ID</Text>
        <Text style={[tableStyles.th, { flex: 1.2 }]}>Tanggal</Text>
        <Text style={[tableStyles.th, { flex: 0.7 }]}>Qty Retur</Text>
        <Text style={[tableStyles.th, { flex: 1.6 }]}>Harga Beli</Text>
      </View>
      {data.map((item, i) => (
        <View key={i} style={[tableStyles.row, i % 2 === 0 && tableStyles.rowEven]}>
          <Text style={[tableStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tableStyles.td, { flex: 0.7 }]}>{item.qty_retur ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.6 }]}>{formatCurrency(item.harga_beli)}</Text>
        </View>
      ))}
    </View>
  );
}

function PenjualanTable({ data }: { data: any[] }) {
  return (
    <View style={tableStyles.container}>
      <View style={tableStyles.headerRow}>
        <Text style={[tableStyles.th, { flex: 0.5 }]}>ID</Text>
        <Text style={[tableStyles.th, { flex: 1.2 }]}>Tanggal</Text>
        <Text style={[tableStyles.th, { flex: 0.7 }]}>Qty</Text>
        <Text style={[tableStyles.th, { flex: 1.6 }]}>Harga Jual</Text>
      </View>
      {data.map((item, i) => (
        <View key={i} style={[tableStyles.row, i % 2 === 0 && tableStyles.rowEven]}>
          <Text style={[tableStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tableStyles.td, { flex: 0.7 }]}>{item.qty ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.6 }]}>{formatCurrency(item.harga_jual)}</Text>
        </View>
      ))}
    </View>
  );
}

function ReturPenjualanTable({ data }: { data: any[] }) {
  return (
    <View style={tableStyles.container}>
      <View style={tableStyles.headerRow}>
        <Text style={[tableStyles.th, { flex: 0.5 }]}>ID</Text>
        <Text style={[tableStyles.th, { flex: 1.2 }]}>Tanggal</Text>
        <Text style={[tableStyles.th, { flex: 0.7 }]}>Qty Retur</Text>
        <Text style={[tableStyles.th, { flex: 1.6 }]}>Harga Jual</Text>
      </View>
      {data.map((item, i) => (
        <View key={i} style={[tableStyles.row, i % 2 === 0 && tableStyles.rowEven]}>
          <Text style={[tableStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tableStyles.td, { flex: 0.7 }]}>{item.qty_retur ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.6 }]}>{formatCurrency(item.harga_jual)}</Text>
        </View>
      ))}
    </View>
  );
}

function BookingTable({ data }: { data: any[] }) {
  return (
    <View style={tableStyles.container}>
      <View style={tableStyles.headerRow}>
        <Text style={[tableStyles.th, { flex: 1.2 }]}>Tanggal</Text>
        <Text style={[tableStyles.th, { flex: 1 }]}>Movement</Text>
        <Text style={[tableStyles.th, { flex: 0.6 }]}>Keluar</Text>
        <Text style={[tableStyles.th, { flex: 0.6 }]}>Masuk</Text>
        <Text style={[tableStyles.th, { flex: 0.8 }]}>Booking ID</Text>
        <Text style={[tableStyles.th, { flex: 0.8 }]}>Platform</Text>
      </View>
      {data.map((item, i) => (
        <View key={i} style={[tableStyles.row, i % 2 === 0 && tableStyles.rowEven]}>
          <Text style={[tableStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tableStyles.td, { flex: 1 }]}>{item.movement ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.6 }]}>{item.qty_out ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.6 }]}>{item.qty_in ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.8 }]}>{item.booking_id ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.8 }]}>{item.platform ?? '-'}</Text>
        </View>
      ))}
    </View>
  );
}

function GabunganTable({ data }: { data: any[] }) {
  return (
    <View style={tableStyles.container}>
      <View style={tableStyles.headerRow}>
        <Text style={[tableStyles.th, { flex: 1.1 }]}>Tanggal</Text>
        <Text style={[tableStyles.th, { flex: 0.8 }]}>From</Text>
        <Text style={[tableStyles.th, { flex: 0.5 }]}>ID</Text>
        <Text style={[tableStyles.th, { flex: 0.6 }]}>Masuk</Text>
        <Text style={[tableStyles.th, { flex: 0.6 }]}>Keluar</Text>
        <Text style={[tableStyles.th, { flex: 0.7 }]}>Total Qty</Text>
        <Text style={[tableStyles.th, { flex: 1.3 }]}>Harga</Text>
      </View>
      {data.map((item, i) => (
        <View key={i} style={[tableStyles.row, i % 2 === 0 && tableStyles.rowEven]}>
          <Text style={[tableStyles.td, { flex: 1.1 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tableStyles.td, { flex: 0.8 }]}>{item.from ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.6 }]}>{item.masuk ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.6 }]}>{item.keluar ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 0.7 }]}>{item.totalqty ?? '-'}</Text>
          <Text style={[tableStyles.td, { flex: 1.3 }]}>{formatCurrency(item.harga)}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────

export default function KartuStokModal({ visible, itemId, itemNama, onClose }: KartuStokModalProps) {
  const [tab, setTab] = useState<TabType>('Pembelian');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [itemInfo, setItemInfo] = useState<{
    sku: string; nama: string; merk: string; kategori: string; stok: number;
  } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => {
    if (visible && itemId) {
      setTab('Pembelian');
      setRows([]);
      fetchItemInfo(itemId);
      fetchData('Pembelian', itemId);
    }
    if (!visible) {
      setItemInfo(null);
      setRows([]);
    }
  }, [visible, itemId]);

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
    if (itemId) fetchData(newTab, itemId);
  };

  const fetchItemInfo = async (id: number) => {
    setLoadingInfo(true);
    try {
      const token = await getTokenAuth();
      if (!token) return;
      const res = await fetch(
        `${API_BASE_URL}/get/masterbarang/condition/and/id:equal:${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (json.status && json.data && json.data.length > 0) {
        const item = json.data[0];
        setItemInfo({
          sku: item.sku || '',
          nama: item.nama || '',
          merk: item.merk || '',
          kategori: item.kategori || '',
          stok: Number(item.stok) || 0,
        });
      }
    } catch (e) {
      console.error('Error fetching item info:', e);
    } finally {
      setLoadingInfo(false);
    }
  };

  const fetchData = async (currentTab: TabType, id: number) => {
    setLoading(true);
    setRows([]);
    try {
      const token = await getTokenAuth();
      if (!token) return;
      const url = getUrl(currentTab, id);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setRows(json.data || []);
    } catch (e) {
      console.error('Error fetching kartu stok:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = () => {
    if (rows.length === 0) return null;
    switch (tab) {
      case 'Pembelian': return <PembelianTable data={rows} />;
      case 'ReturPembelian': return <ReturPembelianTable data={rows} />;
      case 'Penjualan': return <PenjualanTable data={rows} />;
      case 'ReturPenjualan': return <ReturPenjualanTable data={rows} />;
      case 'Booking': return <BookingTable data={rows} />;
      case 'Gabungan': return <GabunganTable data={rows} />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="receipt-outline" size={20} color="#f59e0b" />
              <Text style={styles.headerTitle}>Kartu Stok</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* ── Item Info Card ── */}
          {loadingInfo ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color="#f59e0b" />
          ) : itemInfo ? (
            <View style={styles.itemCard}>
              <View style={styles.infoGrid}>
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>NAMA BARANG</Text>
                  <Text style={styles.infoCellValue} numberOfLines={2}>{itemInfo.nama}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>SKU</Text>
                  <Text style={styles.infoCellValue}>{itemInfo.sku}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>MERK</Text>
                  <Text style={styles.infoCellValue}>{itemInfo.merk || '-'}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>KATEGORI</Text>
                  <Text style={styles.infoCellValue}>{itemInfo.kategori || '-'}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>STOK BARANG</Text>
                  <Text style={[styles.infoCellValue, styles.stockValue]}>{itemInfo.stok}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Tab Bar ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBar}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.tabItem, tab === key && styles.tabItemActive]}
                onPress={() => handleTabChange(key)}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Data Table ── */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#f59e0b" size="large" />
              <Text style={styles.loadingText}>Memuat data...</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="document-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Tidak ada data</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              horizontal
              contentContainerStyle={{ minWidth: '100%' }}
            >
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
                {renderTable()}
              </ScrollView>
            </ScrollView>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Table styles (shared) ─────────────────────────────────────────────────
const tableStyles = StyleSheet.create({
  container: {
    margin: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  rowEven: {
    backgroundColor: '#fafafa',
  },
  td: {
    fontSize: 12,
    color: '#1f2937',
    paddingHorizontal: 6,
  },
});

// ─── Modal styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    minHeight: '60%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeBtn: {
    padding: 4,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12 as any,
  },
  infoCell: {
    minWidth: '40%',
    flex: 1,
  },
  infoCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoCellValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  stockValue: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 15,
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 48,
    marginTop: 8,
  },
  tabBarContent: {
    paddingHorizontal: 8,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 2,
  },
  tabItemActive: {
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1f2937',
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#9ca3af',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
