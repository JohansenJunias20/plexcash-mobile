import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import IntervalDatePicker from './IntervalDatePicker';

export interface DPBeliItem {
  id: string;
  tanggal: string;
  id_supplier: number;
  nama: string; // supplier name
  kodeBA: string;
  dp: string | number;
  terpakai: string | number;
  keterangan: string;
}

interface SearchDPBeliModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Called after the user selects an item AND the detail endpoint confirms status == true.
   * If status == false the handler will NOT be called, matching R10.
   */
  onSelect: (item: DPBeliItem) => void;
}

/**
 * Two-step search modal, mirroring the web SearchPelunasan / IntervalDate flow:
 *   Step 1 → IntervalDatePicker  (shown first when modal opens)
 *   Step 2 → List of DP Beli records with nama-only real-time filter
 */
export default function SearchDPBeliModal({
  visible,
  onClose,
  onSelect,
}: SearchDPBeliModalProps) {
  // --- Step control ---
  // 'interval' = showing date-range picker
  // 'list'     = showing the results list
  const [step, setStep] = useState<'interval' | 'list'>('interval');

  const [items, setItems] = useState<DPBeliItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<DPBeliItem[]>([]);
  // search by nama supplier only (R8)
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Reset to step 1 every time modal opens (so user picks fresh date range)
  useEffect(() => {
    if (visible) {
      setStep('interval');
      setItems([]);
      setFilteredItems([]);
      setSearch('');
      setDateStart('');
      setDateEnd('');
    }
  }, [visible]);

  // Re-filter whenever search text or items change — filter by nama only (R8)
  useEffect(() => {
    if (search.trim() === '') {
      setFilteredItems(items);
    } else {
      const lower = search.toLowerCase();
      setFilteredItems(
        items.filter((item) =>
          item.nama.toLowerCase().includes(lower)
        )
      );
    }
  }, [search, items]);

  const fetchData = useCallback(async (start: string, end: string) => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) return;

      const res = await fetch(
        `${API_BASE_URL}/get/dpbeli/interval/${start}/${end}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.status && data.data) {
        setItems(data.data);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error fetching dp beli:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Called when user confirms date range in IntervalDatePicker
  const handleDateRangeOK = (start: string, end: string) => {
    setDateStart(start);
    setDateEnd(end);
    setStep('list');
    fetchData(start, end);
  };

  // Called when user taps an item in the list — check detail endpoint (R10)
  const handleItemSelect = async (item: DPBeliItem) => {
    if (selecting) return;
    try {
      setSelecting(true);
      const token = await getTokenAuth();
      if (!token) return;

      const res = await fetch(
        `${API_BASE_URL}/get/detailpelunasanhutang/condition/and/id_pelunasan:equal:${item.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const result = await res.json();
      console.log('detailpelunasanhutang result', result);

      // R10: only call onSelect if status == true
      if (result.status) {
        onSelect(item);
        // modal will be closed by parent via onSelect handler
      }
      // If false — do nothing, modal stays open
    } catch (error) {
      console.error('Error checking detail pelunasan:', error);
    } finally {
      setSelecting(false);
    }
  };

  const renderItem = ({ item }: { item: DPBeliItem }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => handleItemSelect(item)}
      disabled={selecting}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemId}>ID: {item.id}</Text>
        <Text style={styles.itemDate}>
          {moment(item.tanggal).format('DD/MM/YYYY HH:mm')}
        </Text>
      </View>
      <Text style={styles.itemSupplier}>{item.nama}</Text>
      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>DP:</Text>
        <Text style={styles.itemValue}>
          Rp {Number(item.dp).toLocaleString('id-ID')}
        </Text>
        <Text style={styles.itemLabel}>  Terpakai:</Text>
        <Text style={styles.itemValue}>
          Rp {Number(item.terpakai).toLocaleString('id-ID')}
        </Text>
      </View>
      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>Kode BA:</Text>
        <Text style={styles.itemValue}>{item.kodeBA}</Text>
      </View>
      {!!item.keterangan && (
        <Text style={styles.itemDesc}>{item.keterangan}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Step 1: Interval Date Picker */}
      {step === 'interval' && (
        <IntervalDatePicker
          visible={true}
          onOK={handleDateRangeOK}
          onCancel={onClose}
        />
      )}

      {/* Step 2: List of DP Beli */}
      {step === 'list' && (
        <View style={styles.modalOverlay}>
          {/* Tap-outside closes modal without changing form (R12) */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setStep('interval')}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={22} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.title}>Cari DP Beli</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Date range display */}
            <View style={styles.dateRangeBar}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.dateRangeText}>
                {moment(dateStart).format('DD/MM/YYYY')} —{' '}
                {moment(dateEnd).format('DD/MM/YYYY')}
              </Text>
              <TouchableOpacity
                onPress={() => fetchData(dateStart, dateEnd)}
                style={styles.refreshBtn}
              >
                <Ionicons name="refresh" size={16} color="#f59e0b" />
              </TouchableOpacity>
            </View>

            {/* Search bar — filters by nama supplier only (R8) */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color="#9CA3AF"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama supplier..."
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#f59e0b"
                style={styles.loader}
              />
            ) : (
              <FlatList
                data={filteredItems}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons
                      name="search-outline"
                      size={48}
                      color="#D1D5DB"
                    />
                    <Text style={styles.emptyText}>
                      Tidak ada data DP Beli
                    </Text>
                  </View>
                }
              />
            )}

            {selecting && (
              <View style={styles.selectingOverlay}>
                <ActivityIndicator size="small" color="#f59e0b" />
                <Text style={styles.selectingText}>Memuat detail...</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: 'white',
    height: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  closeBtn: {
    padding: 4,
  },
  dateRangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
    gap: 6,
  },
  dateRangeText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  refreshBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
  },
  loader: {
    marginTop: 50,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  itemDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemSupplier: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  itemLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 4,
  },
  itemValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  itemDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#9CA3AF',
  },
  selectingOverlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    gap: 8,
  },
  selectingText: {
    fontSize: 14,
    color: '#374151',
  },
});
