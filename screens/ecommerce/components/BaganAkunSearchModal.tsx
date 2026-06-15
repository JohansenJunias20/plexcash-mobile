import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';

interface BaganAkun {
  kodeba: string;
  nama: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (item: { kodeba: string; nama: string }) => void;
  parent: string;
  title: string;
}

export default function BaganAkunSearchModal({ open, onClose, onSelect, parent, title }: Props) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<BaganAkun[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      fetchBaganAkun();
      setSearchQuery('');
    }
  }, [open, parent]);

  const fetchBaganAkun = async () => {
    try {
      setLoading(true);
      const res = await ApiService.get(`/get/baganakun?getStop=1&id_parent=${parent}`);
      if (res && res.status && Array.isArray(res.data)) {
        setAccounts(res.data);
      } else {
        setAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching baganakun:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.kodeba.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: BaganAkun }) => (
    <TouchableOpacity
      style={styles.accountItem}
      onPress={() => {
        onSelect(item);
        onClose();
      }}
    >
      <View style={styles.accountIconContainer}>
        <Ionicons name="card-outline" size={20} color="#4f46e5" />
      </View>
      <View style={styles.accountInfo}>
        <Text style={styles.accountCode}>{item.kodeba}</Text>
        <Text style={styles.accountName}>{item.nama}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <Modal visible={open} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="search" size={24} color="#fff" />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerSubtitle}>Parent Akun: {parent}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={18} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari berdasarkan kode atau nama..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
                <Ionicons name="close-circle" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text style={styles.loadingText}>Memuat Bagan Akun...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredAccounts}
              keyExtractor={(item) => item.kodeba}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
                  <Text style={styles.emptyText}>Tidak ada bagan akun ditemukan</Text>
                </View>
              }
            />
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    height: '80%',
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#1f2937',
    fontSize: 14,
  },
  clearIcon: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  accountIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4f46e5',
  },
  accountName: {
    fontSize: 15,
    color: '#1f2937',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  footer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  closeButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
});
