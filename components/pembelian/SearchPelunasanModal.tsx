import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import ApiService from '../../services/api';
import IntervalDatePicker from './IntervalDatePicker';

export interface PelunasanEksisItem {
  id: number | string;
  tanggal: string;
  id_supplier: number;
  nama_supplier?: string;
  nama?: string;
  kodeBA?: string;
  keterangan?: string;
  total?: number | string;
}

interface SearchPelunasanModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: PelunasanEksisItem) => void;
}

export default function SearchPelunasanModal({
  visible,
  onClose,
  onSelect,
}: SearchPelunasanModalProps) {
  const [step, setStep] = useState<'interval' | 'list'>('interval');
  const [items, setItems] = useState<PelunasanEksisItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    if (visible) {
      setStep('interval');
      setItems([]);
      setSearch('');
      setDateStart('');
      setDateEnd('');
    }
  }, [visible]);

  const fetchData = useCallback(async (start: string, end: string) => {
    try {
      setLoading(true);
      const res = await ApiService.getPelunasanPembelianInterval(start, end);
      if (res.status && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error fetching pelunasan interval:', error);
      Alert.alert('Error', 'Gagal memuat data pelunasan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleIntervalConfirm = (start: string, end: string) => {
    setDateStart(start);
    setDateEnd(end);
    setStep('list');
    fetchData(start, end);
  };

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const lower = search.toLowerCase();
    const supplierName = item.nama_supplier || item.nama || '';
    return (
      item.id.toString().includes(lower) ||
      supplierName.toLowerCase().includes(lower) ||
      (item.keterangan && item.keterangan.toLowerCase().includes(lower))
    );
  });

  return (
    <>
      {/* Step 1: Date Range Picker */}
      {visible && step === 'interval' && (
        <IntervalDatePicker
          visible={visible}
          onOK={handleIntervalConfirm}
          onCancel={onClose}
          defaultStart={moment().subtract(30, 'days').format('YYYY-MM-DD')}
          defaultEnd={moment().add(1, 'days').format('YYYY-MM-DD')}
        />
      )}

      {/* Step 2: List Modal */}
      {visible && step === 'list' && (
        <Modal visible={true} animationType="slide" transparent={true} onRequestClose={onClose}>
          <View style={styles.overlay}>
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <TouchableOpacity onPress={() => setStep('interval')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.title}>Cari Pelunasan Pembelian</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Date Badge */}
              <TouchableOpacity style={styles.dateBadge} onPress={() => setStep('interval')}>
                <Ionicons name="calendar-outline" size={14} color="#059669" />
                <Text style={styles.dateBadgeText}>
                  Periode: {dateStart} s/d {dateEnd}
                </Text>
                <Ionicons name="pencil" size={12} color="#059669" />
              </TouchableOpacity>

              {/* Search input */}
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari ID, Supplier, Keterangan..."
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Body List */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#059669" />
                  <Text style={styles.loadingText}>Memuat transaksi pelunasan...</Text>
                </View>
              ) : filteredItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Tidak ada transaksi pelunasan pada periode ini</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item }) => {
                    const supplierName = item.nama_supplier || item.nama || 'Supplier #';
                    return (
                      <TouchableOpacity style={styles.itemCard} onPress={() => onSelect(item)}>
                        <View style={styles.itemHeader}>
                          <View style={styles.badgeGreen}>
                            <Text style={styles.badgeGreenText}>#{item.id}</Text>
                          </View>
                          <Text style={styles.itemDate}>
                            {item.tanggal ? moment(item.tanggal).format('DD MMM YYYY HH:mm') : '-'}
                          </Text>
                        </View>

                        <Text style={styles.supplierText}>{supplierName}</Text>

                        {item.keterangan ? (
                          <Text style={styles.keteranganText} numberOfLines={2}>
                            {item.keterangan}
                          </Text>
                        ) : null}

                        <View style={styles.itemFooter}>
                          {item.kodeBA ? (
                            <Text style={styles.baText}>Akun: {item.kodeBA}</Text>
                          ) : (
                            <View />
                          )}
                          <View style={styles.selectBtn}>
                            <Text style={styles.selectBtnText}>Buka</Text>
                            <Ionicons name="chevron-forward" size={16} color="#FFF" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
      )}
    </>
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
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
    gap: 6,
    alignSelf: 'flex-start',
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 10,
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
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeGreen: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGreenText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  itemDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  supplierText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginVertical: 2,
  },
  keteranganText: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 6,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  baText: {
    fontSize: 12,
    color: '#6B7280',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
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
