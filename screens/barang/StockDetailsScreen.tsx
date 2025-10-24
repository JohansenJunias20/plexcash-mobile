import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, FlatList, Alert } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';

interface WarehouseDetail { warehouse_id: number; warehouse_name: string; warehouse_type: string; on_hand: number; reserved: number; available: number; }

export default function StockDetailsScreen(): JSX.Element {
  const route = useRoute<RouteProp<AppStackParamList, 'StockDetails'>>();
  const id = route.params.id;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ total: number; reserved: number; available: number } | null>(null);
  const [rows, setRows] = useState<WarehouseDetail[]>([]);

  useEffect(() => { (async () => {
    try {
      const token = await getTokenAuth();
      const { signOut } = (require('../../context/AuthContext') as any).useAuth?.() || {};
      if (!token) { Alert.alert('Session expired', 'Please login'); signOut && (await signOut()); return; }
      const res = await fetch(`${API_BASE_URL}/get/masterbarang/warehouse-details/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.status) {
        const details: WarehouseDetail[] = json.data.details || [];
        const total = Number(json.data.total_warehouse_stock) || 0;
        const reserved = Number(json.data.total_warehouse_reserved) || 0;
        const available = Number(json.data.available_warehouse_stock) || 0;
        setSummary({ total, reserved, available });
        setRows(details);
      }
    } finally { setLoading(false); }
  })(); }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1 }}>
      {summary && (
        <View style={styles.summary}>
          <Text style={styles.sumText}>Total: {summary.total}</Text>
          <Text style={styles.sumText}>Reserved: {summary.reserved}</Text>
          <Text style={styles.sumText}>Available: {summary.available}</Text>
        </View>
      )}
      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.cell}>{item.warehouse_name} ({item.warehouse_type})</Text>
            <Text style={styles.cell}>On hand: {item.on_hand} • Reserved: {item.reserved} • Avail: {item.available}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summary: { padding: 12, backgroundColor: 'white', margin: 12, borderRadius: 10, elevation: 2 },
  sumText: { color: '#111827', marginBottom: 4 },
  row: { backgroundColor: 'white', marginHorizontal: 12, marginVertical: 6, padding: 12, borderRadius: 10, elevation: 2 },
  cell: { color: '#374151' },
});

