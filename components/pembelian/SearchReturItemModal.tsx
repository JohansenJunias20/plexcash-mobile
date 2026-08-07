import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';
import moment from 'moment';

export interface ReturSearchItem {
  id: number;
  tanggal: string;
  keterangan: string;
  total: number | string;
  bayar: number | string;
  sisa: number;
}

interface SearchReturItemModalProps {
  visible: boolean;
  supplierId: number;
  existingIds: number[];
  onClose: () => void;
  onSelect: (item: ReturSearchItem) => void;
}

export default function SearchReturItemModal({
  visible,
  supplierId,
  existingIds,
  onClose,
  onSelect,
}: SearchReturItemModalProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ReturSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && supplierId > 0) {
      setQuery('');
      loadRetur();
    }
  }, [visible, supplierId]);

  const loadRetur = async () => {
    try {
      setLoading(true);

      const res = await ApiService.getReturPembelianBySupplier(supplierId);

      if (res.status && Array.isArray(res.data)) {
        const parsedList: ReturSearchItem[] = [];
        for (const item of res.data) {
          const itemId = parseInt(String(item.id));
          if (existingIds.includes(itemId)) continue;

          const totalNum = parseFloat(String(item.total || 0));
          const bayarNum = parseFloat(String(item.bayar || 0));
          const sisa = totalNum - bayarNum;

          if (sisa > 0) {
            parsedList.push({
              id: itemId,
              tanggal: item.tanggal || '',
              keterangan: item.keterangan || '',
              total: totalNum,
              bayar: bayarNum,
              sisa: sisa,
            });
          }
        }
        setItems(parsedList);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading retur search items:', error);
      Alert.alert('Error', 'Gagal memuat data Retur Pembelian');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.id.toString().includes(q) ||
      (item.keterangan && item.keterangan.toLowerCase().includes(q)) ||
      (item.tanggal && item.tanggal.toLowerCase().includes(q))
    );
  });

  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="refresh-circle-outline" size={22} color="#EF4444" />
              <Text style={styles.title}>Tambah Item Retur Pembelian</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari ID Retur, Keterangan..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#EF4444" />
              <Text style={styles.loadingText}>Memuat data retur...</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Tidak ada retur pembelian yang tersedia</Text>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.itemCard} onPress={() => onSelect(item)}>
                  <View style={styles.itemHeader}>
                    <View style={styles.badgeRed}>
                      <Text style={styles.badgeRedText}>RETUR/{item.id}</Text>
                    </View>
                    <Text style={styles.itemDate}>
                      {item.tanggal ? moment(item.tanggal).format('DD MMM YYYY') : '-'}
                    </Text>
                  </View>

                  {item.keterangan ? (
                    <Text style={styles.itemKeterangan} numberOfLines={2}>
                      {item.keterangan}
                    </Text>
                  ) : null}

                  <View style={styles.itemFooter}>
                    <View>
                      <Text style={styles.labelSmall}>Sisa Retur (Pemotong)</Text>
                      <Text style={styles.sisaText}>-{formatRupiah(item.sisa)}</Text>
                    </View>
                    <View style={styles.selectBtn}>
                      <Text style={styles.selectBtnText}>Pilih</Text>
                      <Ionicons name="chevron-forward" size={16} color="#FFF" />
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    minHeight: '50%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 8,
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRedText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  itemDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemKeterangan: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  labelSmall: {
    fontSize: 11,
    color: '#6B7280',
  },
  sisaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  selectBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
