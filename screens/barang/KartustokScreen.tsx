import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';

type Route = RouteProp<AppStackParamList, 'Kartustok'>;

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

export default function KartustokScreen(): JSX.Element {
  const route = useRoute<Route>();
  const id = route.params.id;
  const [tab, setTab] = useState<'Pembelian'|'ReturPembelian'|'Penjualan'|'ReturPenjualan'|'Booking'|'Gabungan'>('Pembelian');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [itemInfo, setItemInfo] = useState<{ sku: string; nama: string; merk: string; kategori: string; stok: number } | null>(null);

  useEffect(() => { fetchItemInfo(); }, []);
  useEffect(() => { fetchData(); }, [tab]);

  const fetchItemInfo = async () => {
    try {
      const token = await getTokenAuth();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/get/masterbarang/condition/and/id:equal:${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setRows([]);
    try {
      let url = '';
      if (tab === 'Pembelian') url = `${API_BASE_URL}/get/kartustok/detailpembelian/join/pembelian/${id}`;
      else if (tab === 'ReturPembelian') url = `${API_BASE_URL}/get/kartustok/detailreturpembelian/join/returpembelian/${id}`;
      else if (tab === 'Penjualan') url = `${API_BASE_URL}/get/kartustok/detailpenjualan/join/penjualan/${id}`;
      else if (tab === 'ReturPenjualan') url = `${API_BASE_URL}/get/kartustok/detailreturpenjualan/join/returpenjualan/${id}`;
      else if (tab === 'Booking') url = `${API_BASE_URL}/get/kartustok/booking/${id}`;
      else url = `${API_BASE_URL}/get/kartustok/gabungan/${id}`;
      const token = await getTokenAuth();
      if (!token) return;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setRows(json.data || []);
    } finally {
      setLoading(false);
    }
  };

  const TAB_LABELS: Record<string, string> = {
    Pembelian: 'Pembelian',
    ReturPembelian: 'Retur Beli',
    Penjualan: 'Penjualan',
    ReturPenjualan: 'Retur Jual',
    Booking: 'Booking',
    Gabungan: 'Gabungan',
  };

  const renderTable = () => {
    if (rows.length === 0) return null;
    if (tab === 'Pembelian') {
      const renderItem = ({ item, index }: any) => (
        <View style={[tStyles.row, index % 2 === 0 && tStyles.rowEven]}>
          <Text style={[tStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tStyles.td, { flex: 0.6 }]}>{item.qty ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.7 }]}>{formatCurrency(item.harga_beli)}</Text>
        </View>
      );
      return (
        <View style={[tStyles.container, { flex: 1 }]}>
          <View style={tStyles.headerRow}>
            <Text style={[tStyles.th, { flex: 0.5 }]}>ID</Text>
            <Text style={[tStyles.th, { flex: 1.2 }]}>Tanggal</Text>
            <Text style={[tStyles.th, { flex: 0.6 }]}>Qty</Text>
            <Text style={[tStyles.th, { flex: 1.7 }]}>Harga Beli</Text>
          </View>
          <FlatList data={rows} keyExtractor={(_, i) => i.toString()} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 16 }} />
        </View>
      );
    }
    if (tab === 'ReturPembelian') {
      const renderItem = ({ item, index }: any) => (
        <View style={[tStyles.row, index % 2 === 0 && tStyles.rowEven]}>
          <Text style={[tStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tStyles.td, { flex: 0.8 }]}>{item.qty_retur ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.5 }]}>{formatCurrency(item.harga_beli)}</Text>
        </View>
      );
      return (
        <View style={[tStyles.container, { flex: 1 }]}>
          <View style={tStyles.headerRow}>
            <Text style={[tStyles.th, { flex: 0.5 }]}>ID</Text>
            <Text style={[tStyles.th, { flex: 1.2 }]}>Tanggal</Text>
            <Text style={[tStyles.th, { flex: 0.8 }]}>Qty Retur</Text>
            <Text style={[tStyles.th, { flex: 1.5 }]}>Harga Beli</Text>
          </View>
          <FlatList data={rows} keyExtractor={(_, i) => i.toString()} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 16 }} />
        </View>
      );
    }
    if (tab === 'Penjualan') {
      const renderItem = ({ item, index }: any) => (
        <View style={[tStyles.row, index % 2 === 0 && tStyles.rowEven]}>
          <Text style={[tStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tStyles.td, { flex: 0.6 }]}>{item.qty ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.7 }]}>{formatCurrency(item.harga_jual)}</Text>
        </View>
      );
      return (
        <View style={[tStyles.container, { flex: 1 }]}>
          <View style={tStyles.headerRow}>
            <Text style={[tStyles.th, { flex: 0.5 }]}>ID</Text>
            <Text style={[tStyles.th, { flex: 1.2 }]}>Tanggal</Text>
            <Text style={[tStyles.th, { flex: 0.6 }]}>Qty</Text>
            <Text style={[tStyles.th, { flex: 1.7 }]}>Harga Jual</Text>
          </View>
          <FlatList data={rows} keyExtractor={(_, i) => i.toString()} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 16 }} />
        </View>
      );
    }
    if (tab === 'ReturPenjualan') {
      const renderItem = ({ item, index }: any) => (
        <View style={[tStyles.row, index % 2 === 0 && tStyles.rowEven]}>
          <Text style={[tStyles.td, { flex: 0.5 }]}>{item.id ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.2 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tStyles.td, { flex: 0.8 }]}>{item.qty_retur ?? '-'}</Text>
          <Text style={[tStyles.td, { flex: 1.5 }]}>{formatCurrency(item.harga_jual)}</Text>
        </View>
      );
      return (
        <View style={[tStyles.container, { flex: 1 }]}>
          <View style={tStyles.headerRow}>
            <Text style={[tStyles.th, { flex: 0.5 }]}>ID</Text>
            <Text style={[tStyles.th, { flex: 1.2 }]}>Tanggal</Text>
            <Text style={[tStyles.th, { flex: 0.8 }]}>Qty Retur</Text>
            <Text style={[tStyles.th, { flex: 1.5 }]}>Harga Jual</Text>
          </View>
          <FlatList data={rows} keyExtractor={(_, i) => i.toString()} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 16 }} />
        </View>
      );
    }
    if (tab === 'Booking') {
      const renderItem = ({ item, index }: any) => (
        <View style={[tStyles.row, index % 2 === 0 && tStyles.rowEven]}>
          <Text style={[tStyles.td, { width: 100 }]}>{formatDate(item.tanggal)}</Text>
          <Text style={[tStyles.td, { width: 90 }]}>{item.movement ?? '-'}</Text>
          <Text style={[tStyles.td, { width: 60 }]}>{item.qty_out ?? '-'}</Text>
          <Text style={[tStyles.td, { width: 60 }]}>{item.qty_in ?? '-'}</Text>
          <Text style={[tStyles.td, { width: 80 }]}>{item.booking_id ?? '-'}</Text>
          <Text style={[tStyles.td, { width: 80 }]}>{item.platform ?? '-'}</Text>
        </View>
      );
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={[tStyles.container, { flex: 1, minWidth: 470 }]}>
            <View style={tStyles.headerRow}>
              <Text style={[tStyles.th, { width: 100 }]}>Tanggal</Text>
              <Text style={[tStyles.th, { width: 90 }]}>Movement</Text>
              <Text style={[tStyles.th, { width: 60 }]}>Keluar</Text>
              <Text style={[tStyles.th, { width: 60 }]}>Masuk</Text>
              <Text style={[tStyles.th, { width: 80 }]}>Booking ID</Text>
              <Text style={[tStyles.th, { width: 80 }]}>Platform</Text>
            </View>
            <FlatList data={rows} keyExtractor={(_, i) => i.toString()} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 16 }} />
          </View>
        </ScrollView>
      );
    }
    // Gabungan
    const renderItem = ({ item, index }: any) => (
      <View style={[tStyles.row, index % 2 === 0 && tStyles.rowEven]}>
        <Text style={[tStyles.td, { width: 100 }]}>{formatDate(item.tanggal)}</Text>
        <Text style={[tStyles.td, { width: 80 }]}>{item.from ?? '-'}</Text>
        <Text style={[tStyles.td, { width: 50 }]}>{item.id ?? '-'}</Text>
        <Text style={[tStyles.td, { width: 60 }]}>{item.masuk ?? '-'}</Text>
        <Text style={[tStyles.td, { width: 60 }]}>{item.keluar ?? '-'}</Text>
        <Text style={[tStyles.td, { width: 70 }]}>{item.totalqty ?? '-'}</Text>
        <Text style={[tStyles.td, { width: 110 }]}>{formatCurrency(item.harga)}</Text>
        {/* DPP Hidden */}
        <Text style={[tStyles.td, { width: 110 }]}>{formatCurrency(item.hpp)}</Text>
      </View>
    );
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={[tStyles.container, { flex: 1, minWidth: 640 }]}>
          <View style={tStyles.headerRow}>
            <Text style={[tStyles.th, { width: 100 }]}>Tanggal</Text>
            <Text style={[tStyles.th, { width: 80 }]}>From</Text>
            <Text style={[tStyles.th, { width: 50 }]}>ID</Text>
            <Text style={[tStyles.th, { width: 60 }]}>Masuk</Text>
            <Text style={[tStyles.th, { width: 60 }]}>Keluar</Text>
            <Text style={[tStyles.th, { width: 70 }]}>Total Qty</Text>
            <Text style={[tStyles.th, { width: 110 }]}>Harga</Text>
            {/* DPP Hidden */}
            <Text style={[tStyles.th, { width: 110 }]}>HPP</Text>
          </View>
          <FlatList data={rows} keyExtractor={(_, i) => i.toString()} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 16 }} />
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Item Info Card */}
      {itemInfo && (
        <View style={styles.itemInfoCard}>
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
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {(['Pembelian','ReturPembelian','Penjualan','ReturPenjualan','Booking','Gabungan'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{TAB_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Tidak ada data</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {renderTable()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemInfoCard: {
    backgroundColor: 'white',
    margin: 12,
    padding: 14,
    borderRadius: 10,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10 as any,
  },
  infoCell: {
    minWidth: '44%',
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
  tabs: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', maxHeight: 48 },
  tab: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: '#f59e0b' },
  tabText: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#111827', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  loadingText: { marginTop: 8, fontSize: 14, color: '#9ca3af' },
  emptyText: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },
});

const tStyles = StyleSheet.create({
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
    paddingVertical: 9,
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

