import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';

type Route = RouteProp<AppStackParamList, 'Kartustok'>;

export default function KartustokScreen(): JSX.Element {
  const route = useRoute<Route>();
  const id = route.params.id;
  const [tab, setTab] = useState<'Pembelian'|'ReturPembelian'|'Penjualan'|'ReturPenjualan'|'Booking'|'Gabungan'>('Pembelian');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [itemInfo, setItemInfo] = useState<{ sku: string; nama: string; stok: number } | null>(null);

  useEffect(() => { fetchItemInfo(); }, []);
  useEffect(() => { fetchData(); }, [tab]);

  const fetchItemInfo = async () => {
    try {
      const token = await getTokenAuth();
      const { signOut } = (require('../../context/AuthContext') as any).useAuth?.() || {};
      if (!token) { Alert.alert('Session expired', 'Please login'); signOut && (await signOut()); return; }
      const res = await fetch(`${API_BASE_URL}/get/masterbarang/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.status && json.data) {
        setItemInfo({
          sku: json.data.sku || '',
          nama: json.data.nama || '',
          stok: Number(json.data.stok) || 0,
        });
      }
    } catch (e) {
      console.error('Error fetching item info:', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = '';
      if (tab === 'Pembelian') url = `${API_BASE_URL}/get/kartustok/detailpembelian/join/pembelian/${id}`;
      else if (tab === 'ReturPembelian') url = `${API_BASE_URL}/get/kartustok/returpembelian/${id}`;
      else if (tab === 'Penjualan') url = `${API_BASE_URL}/get/kartustok/detailpenjualan/join/penjualan/${id}`;
      else if (tab === 'ReturPenjualan') url = `${API_BASE_URL}/get/kartustok/returpenjualan/${id}`;
      else if (tab === 'Booking') url = `${API_BASE_URL}/get/kartustok/booking/${id}`;
      else url = `${API_BASE_URL}/get/kartustok/${id}`;
      const token = await getTokenAuth();
      const { signOut } = (require('../../context/AuthContext') as any).useAuth?.() || {};
      if (!token) { Alert.alert('Session expired', 'Please login'); signOut && (await signOut()); return; }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setRows(json.data || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Item Info Card */}
      {itemInfo && (
        <View style={styles.itemInfoCard}>
          <View style={styles.itemInfoRow}>
            <Text style={styles.itemInfoLabel}>SKU:</Text>
            <Text style={styles.itemInfoValue}>{itemInfo.sku}</Text>
          </View>
          <View style={styles.itemInfoRow}>
            <Text style={styles.itemInfoLabel}>Nama Barang:</Text>
            <Text style={styles.itemInfoValue}>{itemInfo.nama}</Text>
          </View>
          <View style={styles.itemInfoRow}>
            <Text style={styles.itemInfoLabel}>Stok Saat Ini:</Text>
            <Text style={[styles.itemInfoValue, styles.itemInfoStock]}>{itemInfo.stok}</Text>
          </View>
        </View>
      )}

      <View style={styles.tabs}>
        {(['Pembelian','ReturPembelian','Penjualan','ReturPenjualan','Booking','Gabungan'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : (
        <FlatList
          data={rows}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {Object.entries(item).slice(0,5).map(([k,v]) => (
                <Text key={k} style={styles.cell}>{k}: {String(v)}</Text>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemInfoCard: { 
    backgroundColor: 'white', 
    margin: 12, 
    padding: 16, 
    borderRadius: 10, 
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  itemInfoRow: { 
    flexDirection: 'row', 
    marginBottom: 8,
    alignItems: 'center',
  },
  itemInfoLabel: { 
    fontSize: 14, 
    color: '#6B7280', 
    fontWeight: '600',
    width: 120,
  },
  itemInfoValue: { 
    fontSize: 14, 
    color: '#111827',
    flex: 1,
  },
  itemInfoStock: { 
    fontWeight: '700',
    fontSize: 16,
    color: '#059669',
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap' },
  tab: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: '#2563eb' },
  tabText: { color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  row: { backgroundColor: 'white', marginHorizontal: 12, marginVertical: 6, padding: 12, borderRadius: 10, elevation: 2 },
  cell: { color: '#374151' },
});

