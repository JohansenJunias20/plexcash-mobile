import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import moment from 'moment';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import SearchSupplierModal, { SupplierItem } from '../../components/pembelian/SearchSupplierModal';
import SearchBarangModal, { BarangItem } from '../../components/SearchBarangModal';

interface PreOrderItem {
  id_masterbarang: number;
  nama: string;
  qty: number;
  harga: number;
  merk: string;
  satuan: string;
}

interface PreOrderData {
  id?: number;
  tanggal_po: string;
  tanggal_perkiraan_sampai: string;
  id_supplier: number;
  supplier_nama?: string;
  notes: string;
  items: PreOrderItem[];
  id_pembelian?: number;
}

interface FilterState {
  dateFrom: string;
  dateTo: string;
  status: 'all' | 'pending' | 'converted';
  supplierId: number | null;
}

export default function PreOrderScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [preOrders, setPreOrders] = useState<PreOrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showBarangModal, setShowBarangModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedPreOrders, setSelectedPreOrders] = useState<number[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  
  const [currentPreOrder, setCurrentPreOrder] = useState<PreOrderData>({
    tanggal_po: moment().format('YYYY-MM-DDTHH:mm:ss'),
    tanggal_perkiraan_sampai: moment().add(7, 'days').format('YYYY-MM-DD'),
    id_supplier: 0,
    notes: '',
    items: [],
  });

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: moment().subtract(2, 'months').format('YYYY-MM-DD'),
    dateTo: moment().add(2, 'months').format('YYYY-MM-DD'),
    status: 'all',
    supplierId: null,
  });

  useEffect(() => {
    fetchPreOrders();
    fetchSuppliers();
  }, []);

  // Handle transfer data from PesanBarang screen
  useEffect(() => {
    const params = route.params as any;
    if (params?.transferData) {
      const { items, supplierId, supplierName } = params.transferData;

      // Convert transfer items to PreOrderItems
      const preOrderItems: PreOrderItem[] = items.map((item: any) => ({
        id_masterbarang: item.id,
        nama: item.nama,
        qty: item.qty_to_order || 1,
        harga: 0, // Will be filled by user
        merk: item.merk || '',
        satuan: 'pcs',
      }));

      // Set current pre-order with transferred data
      setCurrentPreOrder({
        tanggal_po: moment().format('YYYY-MM-DDTHH:mm:ss'),
        tanggal_perkiraan_sampai: moment().add(7, 'days').format('YYYY-MM-DD'),
        id_supplier: supplierId,
        supplier_nama: supplierName,
        notes: 'Transferred from Pesan Barang',
        items: preOrderItems,
      });

      // Open the dialog
      setShowDialog(true);

      // Clear the transfer data from params
      navigation.setParams({ transferData: undefined } as any);
    }
  }, [route.params]);

  const fetchPreOrders = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      
      const response = await fetch(`${API_BASE_URL}/api/preorder`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.status) {
        setPreOrders(data.data || []);
      } else {
        Alert.alert('Error', data.reason || 'Failed to load pre-orders');
      }
    } catch (error) {
      console.error('Error fetching pre-orders:', error);
      Alert.alert('Error', 'Failed to load pre-orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = await getTokenAuth();
      
      const response = await fetch(`${API_BASE_URL}/get/supplier`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.status && Array.isArray(data.data)) {
        setSuppliers(data.data);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPreOrders();
    setRefreshing(false);
  }, []);

  const getFilteredPreOrders = () => {
    return preOrders.filter(po => {
      // Filter by date range
      if (filters.dateFrom) {
        const poDate = moment(po.tanggal_po);
        const filterDate = moment(filters.dateFrom);
        if (poDate.isBefore(filterDate)) return false;
      }
      if (filters.dateTo) {
        const poDate = moment(po.tanggal_po);
        const filterDate = moment(filters.dateTo);
        if (poDate.isAfter(filterDate)) return false;
      }

      // Filter by status
      if (filters.status !== 'all') {
        const poStatus = po.id_pembelian ? 'converted' : 'pending';
        if (poStatus !== filters.status) return false;
      }

      // Filter by supplier
      if (filters.supplierId !== null) {
        if (po.id_supplier !== filters.supplierId) return false;
      }

      return true;
    });
  };

  const handleAddItem = () => {
    setShowBarangModal(true);
  };

  const handleRemoveItem = (index: number) => {
    setCurrentPreOrder({
      ...currentPreOrder,
      items: currentPreOrder.items.filter((_, i) => i !== index),
    });
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    setCurrentPreOrder({
      ...currentPreOrder,
      items: currentPreOrder.items.map((item, i) =>
        i === index ? { ...item, qty } : item
      ),
    });
  };

  const handleUpdateItemPrice = (index: number, harga: number) => {
    setCurrentPreOrder({
      ...currentPreOrder,
      items: currentPreOrder.items.map((item, i) =>
        i === index ? { ...item, harga } : item
      ),
    });
  };

  const handleSelectSupplier = (supplier: SupplierItem) => {
    setCurrentPreOrder({
      ...currentPreOrder,
      id_supplier: supplier.id,
      supplier_nama: supplier.nama,
    });
    setShowSupplierModal(false);
  };

  const handleSelectBarang = (items: BarangItem[]) => {
    const newItems: PreOrderItem[] = items.map(item => ({
      id_masterbarang: item.id,
      nama: item.nama,
      qty: 1,
      harga: item.hargabeli || 0,
      merk: item.merk || '',
      satuan: item.satuan || 'pcs',
    }));

    setCurrentPreOrder({
      ...currentPreOrder,
      items: [...currentPreOrder.items, ...newItems],
    });
    setShowBarangModal(false);
  };

  const handleSavePreOrder = async () => {
    if (!currentPreOrder.id_supplier) {
      Alert.alert('Validasi', 'Silakan pilih supplier');
      return;
    }
    if (currentPreOrder.items.length === 0) {
      Alert.alert('Validasi', 'Silakan tambahkan minimal 1 item');
      return;
    }

    try {
      setLoading(true);
      const token = await getTokenAuth();
      const method = currentPreOrder.id ? 'PATCH' : 'POST';
      const url = currentPreOrder.id
        ? `${API_BASE_URL}/api/preorder/${currentPreOrder.id}`
        : `${API_BASE_URL}/api/preorder`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentPreOrder),
      });

      const data = await response.json();

      if (data.status) {
        Alert.alert('Sukses', 'Pre-order berhasil disimpan');
        setShowDialog(false);
        resetCurrentPreOrder();
        fetchPreOrders();
      } else {
        Alert.alert('Error', data.reason || 'Gagal menyimpan pre-order');
      }
    } catch (error) {
      console.error('Error saving pre-order:', error);
      Alert.alert('Error', 'Gagal menyimpan pre-order');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePreOrder = async (preOrder: PreOrderData) => {
    if (!preOrder.id) {
      Alert.alert('Error', 'Cannot delete pre-order without ID');
      return;
    }

    if (preOrder.id_pembelian) {
      Alert.alert('Error', 'Cannot delete pre-order that has been converted to pembelian');
      return;
    }

    Alert.alert(
      'Konfirmasi',
      'Apakah Anda yakin ingin menghapus pre-order ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const token = await getTokenAuth();

              const response = await fetch(`${API_BASE_URL}/api/preorder/${preOrder.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                },
              });

              const data = await response.json();

              if (data.status) {
                Alert.alert('Sukses', 'Pre-order berhasil dihapus');
                fetchPreOrders();
              } else {
                Alert.alert('Error', data.reason || 'Gagal menghapus pre-order');
              }
            } catch (error) {
              console.error('Error deleting pre-order:', error);
              Alert.alert('Error', 'Gagal menghapus pre-order');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const resetCurrentPreOrder = () => {
    setCurrentPreOrder({
      tanggal_po: moment().format('YYYY-MM-DDTHH:mm:ss'),
      tanggal_perkiraan_sampai: moment().add(7, 'days').format('YYYY-MM-DD'),
      id_supplier: 0,
      notes: '',
      items: [],
    });
  };

  const handleNewPreOrder = () => {
    resetCurrentPreOrder();
    setShowDialog(true);
  };

  const handleEditPreOrder = (preOrder: PreOrderData) => {
    setCurrentPreOrder(preOrder);
    setShowDialog(true);
  };

  const toggleSelectPreOrder = (index: number) => {
    if (selectedPreOrders.includes(index)) {
      setSelectedPreOrders(selectedPreOrders.filter(i => i !== index));
    } else {
      setSelectedPreOrders([...selectedPreOrders, index]);
    }
  };

  const handleConvertToPembelian = () => {
    if (selectedPreOrders.length === 0) {
      Alert.alert('Info', 'Silakan pilih minimal 1 pre-order');
      return;
    }

    const filteredPreOrders = getFilteredPreOrders();
    const selectedPOs = selectedPreOrders
      .map(idx => filteredPreOrders[idx])
      .filter(po => po !== undefined);

    if (selectedPOs.length === 0) {
      Alert.alert('Error', 'Selected pre-orders not found');
      return;
    }

    // Check if all selected pre-orders have the same supplier
    const firstSupplierId = selectedPOs[0].id_supplier;
    const allSameSupplierId = selectedPOs.every(po => po.id_supplier === firstSupplierId);

    if (!allSameSupplierId) {
      Alert.alert('Error', 'Semua pre-order harus memiliki supplier yang sama');
      return;
    }

    // Navigate to PembelianTambah with pre-order IDs
    const poIds = selectedPOs.map(po => po.id).join(',');
    (navigation as any).navigate('PembelianTambah', { po_ids: poIds });
  };

  const renderPreOrderItem = ({ item, index }: { item: PreOrderData; index: number }) => {
    const isSelected = selectedPreOrders.includes(index);
    const status = item.id_pembelian ? 'Converted' : 'Pending';
    const statusColor = item.id_pembelian ? '#10b981' : '#f59e0b';

    return (
      <TouchableOpacity
        style={[styles.preOrderCard, isSelected && styles.preOrderCardSelected]}
        onPress={() => toggleSelectPreOrder(index)}
        onLongPress={() => handleEditPreOrder(item)}
      >
        <View style={styles.preOrderHeader}>
          <View style={styles.preOrderHeaderLeft}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <View>
              <Text style={styles.preOrderId}>PO #{item.id}</Text>
              <Text style={styles.preOrderDate}>
                {moment(item.tanggal_po).format('DD/MM/YYYY HH:mm')}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>

        <View style={styles.preOrderBody}>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{item.supplier_nama || 'Unknown Supplier'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              Est. Arrival: {moment(item.tanggal_perkiraan_sampai).format('DD/MM/YYYY')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{item.items.length} item(s)</Text>
          </View>
          {item.notes && (
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText} numberOfLines={1}>{item.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.preOrderActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditPreOrder(item)}
          >
            <Ionicons name="create-outline" size={20} color="#3b82f6" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, item.id_pembelian && styles.actionButtonDisabled]}
            onPress={() => handleDeletePreOrder(item)}
            disabled={!!item.id_pembelian}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={item.id_pembelian ? '#9CA3AF' : '#ef4444'}
            />
            <Text style={[
              styles.actionButtonText,
              item.id_pembelian && styles.actionButtonTextDisabled
            ]}>
              Hapus
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredPreOrders = getFilteredPreOrders();
  const activeFilterCount =
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.supplierId !== null ? 1 : 0);

  if (loading && preOrders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => (navigation as any).openDrawer()}
        >
          <Ionicons name="menu" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pre Order</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="filter" size={24} color="#111827" />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleNewPreOrder}
        >
          <Ionicons name="add-circle-outline" size={20} color="white" />
          <Text style={styles.primaryButtonText}>Buat Pre Order</Text>
        </TouchableOpacity>
        {selectedPreOrders.length > 0 && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleConvertToPembelian}
          >
            <Ionicons name="arrow-forward-outline" size={20} color="#f59e0b" />
            <Text style={styles.secondaryButtonText}>
              Convert ({selectedPreOrders.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pre-orders List */}
      <FlatList
        data={filteredPreOrders}
        keyExtractor={(item, index) => `${item.id || index}`}
        renderItem={renderPreOrderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#f59e0b']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Tidak ada pre-order</Text>
            <Text style={styles.emptySubtext}>
              Buat pre-order baru dengan menekan tombol di atas
            </Text>
          </View>
        }
      />

      {/* Create/Edit Pre Order Dialog */}
      <Modal
        visible={showDialog}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {currentPreOrder.id ? 'Edit Pre Order' : 'Buat Pre Order'}
              </Text>
              <TouchableOpacity onPress={() => setShowDialog(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Supplier Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Supplier *</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowSupplierModal(true)}
                >
                  <Text style={[
                    styles.selectButtonText,
                    !currentPreOrder.supplier_nama && styles.selectButtonPlaceholder
                  ]}>
                    {currentPreOrder.supplier_nama || 'Pilih Supplier'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* PO Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tanggal PO</Text>
                <TextInput
                  style={styles.input}
                  value={moment(currentPreOrder.tanggal_po).format('DD/MM/YYYY HH:mm')}
                  editable={false}
                />
              </View>

              {/* Est. Arrival Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Perkiraan Sampai</Text>
                <TextInput
                  style={styles.input}
                  value={moment(currentPreOrder.tanggal_perkiraan_sampai).format('DD/MM/YYYY')}
                  editable={false}
                />
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Catatan</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={currentPreOrder.notes}
                  onChangeText={(text) => setCurrentPreOrder({ ...currentPreOrder, notes: text })}
                  placeholder="Tambahkan catatan..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Items Section */}
              <View style={styles.formGroup}>
                <View style={styles.itemsHeader}>
                  <Text style={styles.formLabel}>
                    Items ({currentPreOrder.items.length})
                  </Text>
                  <TouchableOpacity
                    style={styles.addItemButton}
                    onPress={handleAddItem}
                  >
                    <Ionicons name="add-circle" size={20} color="#f59e0b" />
                    <Text style={styles.addItemButtonText}>Tambah</Text>
                  </TouchableOpacity>
                </View>

                {currentPreOrder.items.map((item, index) => (
                  <View key={index} style={styles.itemCard}>
                    <View style={styles.itemCardHeader}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.nama}
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.itemCardBody}>
                      <View style={styles.itemInputGroup}>
                        <Text style={styles.itemInputLabel}>Qty</Text>
                        <TextInput
                          style={styles.itemInput}
                          value={String(item.qty)}
                          onChangeText={(text) => handleUpdateItemQty(index, parseInt(text) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.itemInputGroup}>
                        <Text style={styles.itemInputLabel}>Harga</Text>
                        <TextInput
                          style={styles.itemInput}
                          value={String(item.harga)}
                          onChangeText={(text) => handleUpdateItemPrice(index, parseFloat(text) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDialog(false)}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePreOrder}
              >
                <Text style={styles.saveButtonText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Supplier Modal */}
      <SearchSupplierModal
        visible={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSelect={handleSelectSupplier}
      />

      {/* Barang Modal */}
      <SearchBarangModal
        visible={showBarangModal}
        onClose={() => setShowBarangModal(false)}
        onSelect={handleSelectBarang}
        multiSelect={true}
        excludeIds={currentPreOrder.items.map(item => item.id_masterbarang)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  preOrderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  preOrderCardSelected: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  preOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  preOrderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  preOrderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  preOrderDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  preOrderBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  preOrderActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextDisabled: {
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectButtonText: {
    fontSize: 14,
    color: '#111827',
  },
  selectButtonPlaceholder: {
    color: '#9CA3AF',
  },
  input: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  itemCardBody: {
    flexDirection: 'row',
    gap: 12,
  },
  itemInputGroup: {
    flex: 1,
  },
  itemInputLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemInput: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

