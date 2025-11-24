import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';

export interface CustomerItem {
  id: number;
  nama: string;
  notelp?: string;
  alamat?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerItem) => void;
}

export default function SearchCustomerModal({ visible, onClose, onSelect }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCustomers();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(
        (customer) =>
          customer.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.notelp?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.alamat?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCustomers(filtered);
    }
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/get/customer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.status && data.data) {
        setCustomers(data.data);
        setFilteredCustomers(data.data);
      }
    } catch (error) {
      console.error('Load customers error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (customer: CustomerItem) => {
    onSelect(customer);
    onClose();
    setSearchQuery('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Pilih Customer</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari customer (nama, telp, alamat)..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#dc2626" style={styles.loader} />
          ) : (
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemName}>{item.nama}</Text>
                    {item.notelp && <Text style={styles.itemDetail}>📞 {item.notelp}</Text>}
                    {item.alamat && <Text style={styles.itemDetail}>📍 {item.alamat}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Tidak ada customer ditemukan</Text>
              }
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  loader: {
    marginTop: 40,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
});

