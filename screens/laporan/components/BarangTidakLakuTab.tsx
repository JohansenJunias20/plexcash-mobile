import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import ApiService from '../../../services/api';

const currency = (num: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
};

function formatTanggal(tgl: string | null | undefined): string {
  if (!tgl || tgl === '1970-01-01' || tgl === '1970-01-01T00:00:00.000Z') return 'Belum pernah terjual';
  return moment(tgl).format('DD MMM YYYY');
}

export default function BarangTidakLakuTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [minStok, setMinStok] = useState('1');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ApiService.get(`/get/laporan/barang-tidak-laku?min_stok=${minStok}&limit=2000`);
      if (response && response.status && response.data) {
        setData(response.data);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching barang tidak laku:', error);
    } finally {
      setLoading(false);
    }
  }, [minStok]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isNeverSold = !item.terakhir_terjual || moment(item.terakhir_terjual).year() === 1970;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.nama}</Text>
            <Text style={styles.itemSku}>SKU: {item.sku}</Text>
          </View>
          <View style={styles.stokBadge}>
            <Text style={styles.stokText}>{item.stok} {item.satuan}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Kategori/Merk</Text>
            <Text style={styles.value}>{item.kategori || '-'} / {item.merk || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Harga Jual</Text>
            <Text style={styles.value}>{currency(item.hargajual)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>HPP</Text>
            <Text style={styles.value}>{currency(item.hpp)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tgl Order Terakhir</Text>
            <Text style={styles.value}>
              {!item.terakhir_dibeli || moment(item.terakhir_dibeli).year() === 1970
                ? 'Belum pernah beli'
                : formatTanggal(item.terakhir_dibeli)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Terakhir Terjual</Text>
            <Text style={[styles.value, isNeverSold && { color: '#dc2626' }]}>
              {isNeverSold ? 'Belum pernah terjual' : formatTanggal(item.terakhir_terjual)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Lama Tidak Terjual</Text>
            <Text style={[styles.value, { fontWeight: 'bold' }]}>
              {item.hari_tidak_terjual >= 3650 
                ? 'Belum pernah terjual' 
                : `${item.hari_tidak_terjual} hari`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const totalStok = data.reduce((sum, r) => sum + (r.stok || 0), 0);
  const totalNilai = data.reduce((sum, r) => sum + ((r.stok || 0) * (r.hpp || 0)), 0);
  const neverSold = data.filter(r => !r.terakhir_terjual || moment(r.terakhir_terjual).year() === 1970).length;

  return (
    <View style={styles.container}>
      {/* Filter Header */}
      <View style={styles.filterContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Min Stok:</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={minStok}
            onChangeText={setMinStok}
          />
        </View>
        <TouchableOpacity style={styles.btnTampilkan} onPress={fetchData}>
          <Ionicons name="refresh" size={18} color="white" />
          <Text style={styles.btnText}>Tampilkan</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Total Produk</Text>
          <Text style={styles.summaryValue}>{data.length}</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.summaryTitle}>Belum Pernah Terjual</Text>
          <Text style={[styles.summaryValue, { color: '#d97706' }]}>{neverSold}</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.summaryTitle}>Nilai Stok Tertahan</Text>
          <Text style={[styles.summaryValue, { color: '#dc2626' }]}>{currency(totalNilai)}</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data barang tidak laku.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputLabel: {
    marginRight: 8,
    fontWeight: 'bold',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
    textAlign: 'center',
  },
  btnTampilkan: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#dbeafe',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 10,
    color: '#4b5563',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1d4ed8',
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  itemName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#111827',
  },
  itemSku: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  stokBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  stokText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#374151',
  },
  cardBody: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
  },
  value: {
    fontSize: 12,
    color: '#374151',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
  },
});
