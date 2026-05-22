import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import IntervalDatePicker from '../../../components/pembelian/IntervalDatePicker';

interface JurnalItem {
  id: number;
  tanggal: string;
  keterangan: string;
  totalDebit: number;
  totalKredit: number;
}

export default function JurnalSearchScreen() {
  const navigation = useNavigation<any>();

  // Date interval state
  const [showIntervalPicker, setShowIntervalPicker] = useState(true);
  const [intervalDate, setIntervalDate] = useState({ start: '', end: '' });

  // Data state
  const [items, setItems] = useState<JurnalItem[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<JurnalItem>>({});

  // Loading state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (start: string, end: string, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/get/jurnal/interval/${start}/${end}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      if (data.status) {
        const sortedData = data.data.sort((a: any, b: any) => {
          return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
        });
        
        const mappedItems = sortedData.map((item: any) => ({
          id: item.id,
          tanggal: item.tanggal.replace(' ', 'T'),
          keterangan: item.keterangan || '',
          totalDebit: item.totalDebit || 0,
          totalKredit: item.totalKredit || 0,
        }));

        setItems(mappedItems);
      } else {
        Alert.alert('Error', data.reason || 'Failed to load data');
      }
    } catch (error) {
      console.error('Load data error:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleIntervalOK = (start: string, end: string) => {
    setIntervalDate({ start, end });
    setShowIntervalPicker(false);
    loadData(start, end);
  };

  const handleRefresh = () => {
    if (intervalDate.start && intervalDate.end) {
      loadData(intervalDate.start, intervalDate.end, true);
    }
  };

  const handleEdit = (index: number) => {
    const item = filteredItems[index];
    setEditingIndex(index);
    setEditData({
      tanggal: item.tanggal,
      keterangan: item.keterangan,
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditData({});
  };

  const handleSaveEdit = async (index: number) => {
    const item = filteredItems[index];

    try {
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const payload = {
        id: item.id,
        tanggal: (editData.tanggal || item.tanggal).replace('T', ' '),
        keterangan: editData.keterangan || item.keterangan,
      };

      const res = await fetch(`${API_BASE_URL}/jurnal`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status) {
        Alert.alert('Sukses', 'Data berhasil diupdate');
        setEditingIndex(null);
        setEditData({});
        handleRefresh();
      } else {
        Alert.alert('Error', 'Failed to update data');
      }
    } catch (error) {
      console.error('Save edit error:', error);
      Alert.alert('Error', 'Failed to update data');
    }
  };

  const handleDelete = (item: JurnalItem) => {
    Alert.alert(
      'Hapus Jurnal',
      `Apakah Anda yakin ingin menghapus jurnal #${item.id}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getTokenAuth();
              if (!token) {
                Alert.alert('Error', 'Session expired. Please login again.');
                return;
              }

              const res = await fetch(`${API_BASE_URL}/jurnal`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: item.id }),
              });

              const data = await res.json();

              if (data.status) {
                Alert.alert('Sukses', 'Jurnal berhasil dihapus');
                setItems(items.filter((i) => i.id !== item.id));
              } else {
                Alert.alert('Error', data.reason || 'Failed to delete');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleNavigateToDetail = (id: number) => {
    navigation.navigate('JurnalRincian', { id });
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (searchQuery === '') return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      item.id.toString().includes(searchLower) ||
      item.tanggal.toLowerCase().includes(searchLower) ||
      item.keterangan.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('id-ID');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('id-ID', options);
  };

  const renderItem = ({ item, index }: { item: JurnalItem; index: number }) => {
    const isEditing = editingIndex === index;

    if (isEditing) {
      // Edit Mode
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardId}>#{item.id}</Text>
          </View>

          {/* Edit Form */}
          <View style={styles.editForm}>
            <View style={styles.formGroup}>
              <Text style={styles.editLabel}>Tanggal</Text>
              <TextInput
                style={styles.editInput}
                value={editData.tanggal || item.tanggal}
                onChangeText={(val) => setEditData({ ...editData, tanggal: val })}
                placeholder="YYYY-MM-DDTHH:mm:ss"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.editLabel}>Keterangan</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editData.keterangan || item.keterangan}
                onChangeText={(val) => setEditData({ ...editData, keterangan: val })}
                placeholder="Keterangan"
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          {/* Edit Actions */}
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.editActionButton, styles.cancelButton]}
              onPress={handleCancelEdit}
            >
              <Ionicons name="close" size={18} color="#6B7280" />
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editActionButton, styles.saveEditButton]}
              onPress={() => handleSaveEdit(index)}
            >
              <Ionicons name="checkmark" size={18} color="white" />
              <Text style={styles.saveEditButtonText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Normal Mode
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardId}>#{item.id}</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{formatDate(item.tanggal)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={2}>
              {item.keterangan || '-'}
            </Text>
          </View>

          <View style={styles.amountRow}>
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Total Debit</Text>
              <Text style={[styles.amountValue, { color: '#059669' }]}>Rp {formatCurrency(item.totalDebit)}</Text>
            </View>
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Total Kredit</Text>
              <Text style={[styles.amountValue, { color: '#DC2626' }]}>Rp {formatCurrency(item.totalKredit)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(index)}
          >
            <Ionicons name="create-outline" size={18} color="#3B82F6" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <Text style={styles.deleteButtonText}>Hapus</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.infoButton]}
            onPress={() => handleNavigateToDetail(item.id)}
          >
            <Ionicons name="information-circle-outline" size={18} color="#f59e0b" />
            <Text style={styles.infoButtonText}>Detail</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (showIntervalPicker) {
    return (
      <IntervalDatePicker
        visible={showIntervalPicker}
        onOK={handleIntervalOK}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Jurnal Biaya</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerSubtitle}>
              {formatDate(intervalDate.start)} - {formatDate(intervalDate.end)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.changeDateButton}
            onPress={() => setShowIntervalPicker(true)}
          >
            <Ionicons name="calendar" size={20} color="#f59e0b" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari kode atau keterangan..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>Tidak ada data</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Tidak ada hasil yang sesuai dengan pencarian'
              : 'Belum ada transaksi jurnal pada periode ini'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#f59e0b']} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  hamburgerButton: { padding: 5 },
  topHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  changeDateButton: {
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  searchContainer: {
    marginBottom: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardContent: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  amountRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 16,
  },
  amountItem: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  editButton: {
    backgroundColor: '#EFF6FF',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  infoButton: {
    backgroundColor: '#FEF3C7',
  },
  infoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f59e0b',
  },
  // Edit Form Styles
  editForm: {
    gap: 12,
    marginBottom: 16,
  },
  formGroup: {
    gap: 6,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  editInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  editTextArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveEditButton: {
    backgroundColor: '#10B981',
  },
  saveEditButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});
