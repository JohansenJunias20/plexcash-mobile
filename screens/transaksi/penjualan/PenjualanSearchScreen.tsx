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
import SearchCustomerModal, { CustomerItem } from '../../../components/penjualan/SearchCustomerModal';

interface PenjualanItem {
  id: number;
  tanggal: string;
  id_customer: number;
  customer: string;
  keterangan: string;
  total: string;
  bayar: string;
  biaya_service: string;
  service: boolean;
  shop_name?: string;
  online_id?: string;
  online_platform?: string;
  invoice_tokped?: string;
  no_po?: string;
  no_sj?: string;
  faktur_pajak?: string;
  no_invoice?: string;
  lunas?: boolean;
  changed?: boolean;
  ppn?: number;
  useppn?: number;
  kodeBAbayar?: string;
}

interface Customer {
  id: number;
  nama: string;
}

interface Ecommerce {
  id: number;
  name: string;
  status: string;
}

export default function PenjualanSearchScreen() {
  const navigation = useNavigation();

  // Date interval state
  const [showIntervalPicker, setShowIntervalPicker] = useState(true);
  const [intervalDate, setIntervalDate] = useState({ start: '', end: '' });

  // Data state
  const [items, setItems] = useState<PenjualanItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ecommerces, setEcommerces] = useState<Ecommerce[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'S' | 'L' | 'B'>('S'); // S=Semua, L=Lunas, B=Belum Lunas

  // Edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<PenjualanItem>>({});

  // Modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);

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

      // Fetch penjualan data
      const penjualanRes = await fetch(
        `${API_BASE_URL}/get/penjualan/interval/${start}/${end}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const penjualanData = await penjualanRes.json();

      // Fetch customers
      const customerRes = await fetch(`${API_BASE_URL}/get/customer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const customerData = await customerRes.json();

      // Fetch ecommerce data
      const ecommerceRes = await fetch(`${API_BASE_URL}/get/ecommerce`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ecommerceData = await ecommerceRes.json();

      // Fetch detail penjualan for no_po and no_sj
      const id_pj = penjualanData.data?.map((item: any) => item.id) || [];
      let detailData: any = { status: false, data: [] };

      if (id_pj.length > 0) {
        const detailRes = await fetch(`${API_BASE_URL}/get/detailpenjualan`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id_penjualan: id_pj }),
        });
        detailData = await detailRes.json();
      }

      if (penjualanData.status && customerData.status) {
        setCustomers(customerData.data);

        // Filter approved ecommerces
        const approvedEcommerces = ecommerceData.status
          ? ecommerceData.data.filter((ec: Ecommerce) => ec.status === 'APPROVED')
          : [];
        setEcommerces(approvedEcommerces);

        const mappedItems = penjualanData.data.map((item: any) => {
          const customer = customerData.data.find((c: Customer) => c.id === item.id_customer);
          const ecommerce = approvedEcommerces.find((ec: Ecommerce) => ec.id === item.id_ecommerce);

          // Get no_po and no_sj from detail
          const no_po = detailData.data
            ?.filter((dt: any) => dt.id_penjualan === item.id && !!dt.no_po)
            .map((dt: any) => dt.no_po)
            .join(',') || '';

          const no_sj = detailData.data
            ?.filter((dt: any) => dt.id_penjualan === item.id && !!dt.no_sj)
            .map((dt: any) => dt.no_sj)
            .join(',') || '';

          return {
            id: item.id,
            tanggal: item.tanggal.replace(' ', 'T'),
            id_customer: item.id_customer,
            customer: customer ? customer.nama : '',
            keterangan: item.keterangan,
            total: item.total,
            bayar: item.bayar,
            biaya_service: item.biaya_service || '0',
            service: item.service || false,
            shop_name: ecommerce?.name || '',
            online_id: item.online_id || '',
            online_platform: item.online_platform || '',
            invoice_tokped: item.invoice_tokped || '',
            no_po,
            no_sj,
            faktur_pajak: item.faktur_pajak || '',
            no_invoice: item.no_invoice || '',
            lunas: parseFloat(item.bayar) >= (parseFloat(item.total) + parseFloat(item.biaya_service || '0')),
            changed: false,
            ppn: item.ppn || 0,
            useppn: item.useppn || 0,
            kodeBAbayar: item.kodeBAbayar || '',
          };
        });

        setItems(mappedItems);
      } else {
        Alert.alert('Error', 'Failed to load data');
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
      id_customer: item.id_customer,
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
        id: { key: 'id', value: item.id },
        data: [{
          tanggal: editData.tanggal || item.tanggal,
          id_customer: editData.id_customer || item.id_customer,
          keterangan: editData.keterangan || item.keterangan,
          bayar: item.bayar,
        }],
      };

      const res = await fetch(`${API_BASE_URL}/penjualan`, {
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

  const handleDelete = (item: PenjualanItem) => {
    Alert.alert(
      'Hapus Penjualan',
      `Apakah Anda yakin ingin menghapus penjualan #${item.id}?`,
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

              const res = await fetch(`${API_BASE_URL}/penjualan`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: [{ id: item.id }] }),
              });

              const data = await res.json();

              if (data.status) {
                Alert.alert('Sukses', 'Penjualan berhasil dihapus');
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

  const handleCustomerSelect = (customer: CustomerItem) => {
    if (currentEditIndex !== null) {
      setEditData({ ...editData, id_customer: customer.id });
    }
    setShowCustomerModal(false);
    setCurrentEditIndex(null);
  };

  const handleNavigateToDetail = (id: number) => {
    // Navigate to PenjualanRincianScreen
    navigation.navigate('PenjualanRincian' as never, { id } as never);
  };

  // Filter items
  const filteredItems = items
    .filter((item) => {
      // Search filter
      if (searchQuery === '') return true;
      const searchLower = searchQuery.toLowerCase();
      return (
        item.id.toString().includes(searchLower) ||
        item.tanggal.toLowerCase().includes(searchLower) ||
        item.customer.toLowerCase().includes(searchLower) ||
        item.keterangan.toLowerCase().includes(searchLower) ||
        (item.shop_name && item.shop_name.toLowerCase().includes(searchLower)) ||
        (item.online_id && item.online_id.toLowerCase().includes(searchLower))
      );
    })
    .filter((item) => {
      // Status filter
      if (statusFilter === 'L') {
        return item.lunas === true; // Lunas
      } else if (statusFilter === 'B') {
        return item.lunas === false; // Belum Lunas
      }
      return true; // Semua
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

  const getStatusBadge = (item: PenjualanItem) => {
    const isLunas = item.lunas === true;
    return {
      label: isLunas ? 'Lunas' : 'Belum Lunas',
      color: isLunas ? '#059669' : '#DC2626',
      bgColor: isLunas ? '#D1FAE5' : '#FEE2E2',
    };
  };

  const getKodeLabel = (item: PenjualanItem): string => {
    return item.service ? `SER/${item.id}` : `JUAL/${item.id}`;
  };

  const renderItem = ({ item, index }: { item: PenjualanItem; index: number }) => {
    const isEditing = editingIndex === index;
    const status = getStatusBadge(item);

    if (isEditing) {
      // Edit Mode
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardId}>{getKodeLabel(item)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>

          {/* Edit Form */}
          <View style={styles.editForm}>
            <View style={styles.formGroup}>
              <Text style={styles.editLabel}>Tanggal</Text>
              <TextInput
                style={styles.editInput}
                value={editData.tanggal || item.tanggal}
                onChangeText={(val) => setEditData({ ...editData, tanggal: val })}
                placeholder="YYYY-MM-DDTHH:mm"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.editLabel}>Customer</Text>
              <TouchableOpacity
                style={styles.editSelectButton}
                onPress={() => {
                  setCurrentEditIndex(index);
                  setShowCustomerModal(true);
                }}
              >
                <Text style={styles.editSelectText}>
                  {customers.find((c) => c.id === (editData.id_customer || item.id_customer))?.nama ||
                    item.customer ||
                    'Pilih Customer'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
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
          <Text style={styles.cardId}>{getKodeLabel(item)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{formatDate(item.tanggal)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.customer || `ID: ${item.id_customer}`}
            </Text>
          </View>

          {item.shop_name && (
            <View style={styles.infoRow}>
              <Ionicons name="storefront-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText}>{item.shop_name}</Text>
            </View>
          )}

          {item.online_id && (
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText}>
                {item.online_platform === 'TOKOPEDIA' ? item.invoice_tokped : item.online_id}
              </Text>
            </View>
          )}

          {item.keterangan && (
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText} numberOfLines={2}>
                {item.keterangan}
              </Text>
            </View>
          )}

          <View style={styles.amountRow}>
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Total</Text>
              <Text style={styles.amountValue}>Rp {formatCurrency(item.total)}</Text>
            </View>
            {parseFloat(item.biaya_service) > 0 && (
              <View style={styles.amountItem}>
                <Text style={styles.amountLabel}>Service</Text>
                <Text style={styles.amountValue}>Rp {formatCurrency(item.biaya_service)}</Text>
              </View>
            )}
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Bayar</Text>
              <Text style={[styles.amountValue, { color: '#059669' }]}>
                Rp {formatCurrency(item.bayar)}
              </Text>
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
          <Ionicons name="menu" size={28} color="#dc2626" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Penjualan</Text>
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
              placeholder="Cari kode, tanggal, customer, toko..."
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

        {/* Status Filter */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'S' && styles.filterButtonActive]}
            onPress={() => setStatusFilter('S')}
          >
            <Text
              style={[styles.filterButtonText, statusFilter === 'S' && styles.filterButtonTextActive]}
            >
              Semua
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'L' && styles.filterButtonActive]}
            onPress={() => setStatusFilter('L')}
          >
            <Text
              style={[styles.filterButtonText, statusFilter === 'L' && styles.filterButtonTextActive]}
            >
              Lunas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'B' && styles.filterButtonActive]}
            onPress={() => setStatusFilter('B')}
          >
            <Text
              style={[styles.filterButtonText, statusFilter === 'B' && styles.filterButtonTextActive]}
            >
              Belum Lunas
            </Text>
          </TouchableOpacity>
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
          <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>Tidak ada data</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Tidak ada hasil yang sesuai dengan pencarian'
              : 'Belum ada transaksi penjualan pada periode ini'}
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

      {/* Modals */}
      <SearchCustomerModal
        visible={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setCurrentEditIndex(null);
        }}
        onSelect={handleCustomerSelect}
      />
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
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
    marginBottom: 12,
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
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  filterButtonActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#f59e0b',
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
  editForm: {
    marginBottom: 12,
    gap: 12,
  },
  formGroup: {
    gap: 6,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: 'white',
  },
  editTextArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  editSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  editSelectText: {
    fontSize: 14,
    color: '#111827',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveEditButton: {
    backgroundColor: '#f59e0b',
  },
  saveEditButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

