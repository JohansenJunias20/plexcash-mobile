import React, { useState, useEffect } from 'react';
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
  onSelect: (item: DPBeliItem) => void;
}

export default function SearchDPBeliModal({
  visible,
  onClose,
  onSelect,
}: SearchDPBeliModalProps) {
  const [items, setItems] = useState<DPBeliItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<DPBeliItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Interval defaults to 1 month ago to 1 day ahead (like web)
  const [dateStart, setDateStart] = useState(moment().subtract(1, 'months').format('YYYY-MM-DD'));
  const [dateEnd, setDateEnd] = useState(moment().add(1, 'days').format('YYYY-MM-DD'));

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, dateStart, dateEnd]);

  useEffect(() => {
    if (search) {
      const lowerSearch = search.toLowerCase();
      setFilteredItems(
        items.filter((item) =>
          item.nama.toLowerCase().includes(lowerSearch) ||
          item.id.toString().includes(lowerSearch) ||
          (item.keterangan || '').toLowerCase().includes(lowerSearch)
        )
      );
    } else {
      setFilteredItems(items);
    }
  }, [search, items]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) return;

      const res = await fetch(
        `${API_BASE_URL}/get/dpbeli/interval/${dateStart}/${dateEnd}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
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
  };

  const renderItem = ({ item }: { item: DPBeliItem }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => onSelect(item)}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemId}>ID: {item.id}</Text>
        <Text style={styles.itemDate}>{moment(item.tanggal).format('DD MMM YYYY')}</Text>
      </View>
      <Text style={styles.itemSupplier}>{item.nama}</Text>
      <View style={styles.itemRow}>
        <Text style={styles.itemText}>DP: Rp {Number(item.dp).toLocaleString('id-ID')}</Text>
        <Text style={styles.itemText}>Terpakai: Rp {Number(item.terpakai).toLocaleString('id-ID')}</Text>
      </View>
      {!!item.keterangan && (
        <Text style={styles.itemDesc}>{item.keterangan}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Cari DP Beli</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.dateFilterContainer}>
            <TextInput
              style={styles.dateInput}
              value={dateStart}
              onChangeText={setDateStart}
              placeholder="YYYY-MM-DD"
            />
            <Text style={styles.dateDash}>-</Text>
            <TextInput
              style={styles.dateInput}
              value={dateEnd}
              onChangeText={setDateEnd}
              placeholder="YYYY-MM-DD"
            />
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchData}>
              <Ionicons name="refresh" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari ID, Supplier, Keterangan..."
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} />
          ) : (
            <FlatList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={(item, index) => item.id.toString() + index}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Tidak ada data DP Beli</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeBtn: {
    padding: 5,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    gap: 10,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  dateDash: {
    fontSize: 16,
    color: '#6B7280',
  },
  refreshBtn: {
    backgroundColor: '#f59e0b',
    padding: 10,
    borderRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  loader: {
    marginTop: 50,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  itemContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemId: {
    fontSize: 14,
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
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemText: {
    fontSize: 14,
    color: '#4B5563',
  },
  itemDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 15,
    color: '#9CA3AF',
  },
});
