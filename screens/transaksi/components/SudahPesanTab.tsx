import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import KartuStokModal from '../../../components/KartuStokModal';

interface ItemSudahPesan {
  id: number;
  tgl_pesan: string;
  nama: string;
  merk: string;
  kategori: string;
  id_supplier: number;
  supplier_nama: string;
  qty_pesan: number;
  po_status: 'belum_po' | 'sudah_po';
  po_ids: number[];
  po_qty_total: number;
}

interface Supplier {
  id_supplier: number | null;
  nama: string;
}

interface SudahPesanTabProps {
  items: ItemSudahPesan[];
  suppliers: Supplier[];
  selectedSupplierIndex: number;
  poFilterIndex: number;
  selectedItems: number[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSupplierChange: (index: number) => void;
  onPOFilterChange: (index: number) => void;
  onToggleSelection: (id: number) => void;
  onUpdateQty: (id: number, qty: number) => void;
  onMarkAsNotOrdered: (id: number) => void;
  onTransferToPreOrder: () => void;
}

export default function SudahPesanTab({
  items,
  suppliers,
  selectedSupplierIndex,
  poFilterIndex,
  selectedItems,
  loading,
  refreshing,
  onRefresh,
  onSupplierChange,
  onPOFilterChange,
  onToggleSelection,
  onUpdateQty,
  onMarkAsNotOrdered,
  onTransferToPreOrder,
}: SudahPesanTabProps) {
  const [editingQty, setEditingQty] = useState<{ [key: number]: string }>({});
  const [kartuStokItemId, setKartuStokItemId] = useState<number | null>(null);
  const [kartuStokItemNama, setKartuStokItemNama] = useState<string>('');
  const [showKartuStok, setShowKartuStok] = useState(false);

  const openKartuStok = (item: ItemSudahPesan) => {
    setKartuStokItemId(item.id);
    setKartuStokItemNama(item.nama);
    setShowKartuStok(true);
  };

  // Filter items based on supplier and PO status
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by supplier
    const selectedSupplier = suppliers[selectedSupplierIndex];
    if (selectedSupplier && selectedSupplier.id_supplier !== null) {
      filtered = filtered.filter(item => item.id_supplier === selectedSupplier.id_supplier);
    }

    // Filter by PO status
    if (poFilterIndex === 1) {
      // Belum PO
      filtered = filtered.filter(item => item.po_status === 'belum_po');
    } else if (poFilterIndex === 2) {
      // Sudah PO
      filtered = filtered.filter(item => item.po_status === 'sudah_po');
    }

    return filtered;
  }, [items, suppliers, selectedSupplierIndex, poFilterIndex]);

  // Debounced quantity update
  const handleQtyChange = useCallback(
    (id: number, text: string) => {
      setEditingQty(prev => ({ ...prev, [id]: text }));
      
      // Debounce the API call
      const qty = parseInt(text) || 0;
      if (qty > 0) {
        const timeoutId = setTimeout(() => {
          onUpdateQty(id, qty);
        }, 500);
        
        return () => clearTimeout(timeoutId);
      }
    },
    [onUpdateQty]
  );

  const handleMarkAsNotOrdered = (item: ItemSudahPesan) => {
    Alert.alert(
      'Confirm',
      `Mark "${item.nama}" as not ordered?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => onMarkAsNotOrdered(item.id),
        },
      ]
    );
  };

  const renderSupplierTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.supplierTabsContainer}
      contentContainerStyle={styles.supplierTabsContent}
    >
      {suppliers.map((supplier, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.supplierTab,
            selectedSupplierIndex === index && styles.supplierTabActive,
          ]}
          onPress={() => {
            console.log('[SudahPesanTab] Supplier tab clicked:', supplier.nama);
            onSupplierChange(index);
          }}
        >
          <Text
            style={[
              styles.supplierTabText,
              selectedSupplierIndex === index && styles.supplierTabTextActive,
            ]}
            numberOfLines={1}
          >
            {supplier.nama}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderPOStatusTabs = () => {
    // Check if all visible items are selected
    const allSelected = filteredItems.length > 0 &&
      filteredItems.every(item => selectedItems.includes(item.id));
    const someSelected = selectedItems.length > 0 && !allSelected;

    const handleSelectAll = () => {
      console.log('[SudahPesanTab] Select All clicked, current state:', allSelected);
      if (allSelected) {
        // Deselect all visible items
        console.log('[SudahPesanTab] Deselecting all items');
        filteredItems.forEach(item => {
          if (selectedItems.includes(item.id)) {
            onToggleSelection(item.id);
          }
        });
      } else {
        // Select all visible items
        console.log('[SudahPesanTab] Selecting all', filteredItems.length, 'items');
        filteredItems.forEach(item => {
          if (!selectedItems.includes(item.id)) {
            onToggleSelection(item.id);
          }
        });
      }
    };

    return (
      <View style={styles.poStatusContainer}>
        {/* Select All Checkbox */}
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={handleSelectAll}
        >
          <Ionicons
            name={allSelected ? 'checkbox' : someSelected ? 'checkbox-outline' : 'square-outline'}
            size={24}
            color={allSelected || someSelected ? '#f59e0b' : '#9ca3af'}
          />
          <Text style={styles.selectAllText}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>

        {/* PO Status Filter Tabs */}
        <View style={styles.poStatusTabs}>
          {['Semua', 'Belum PO', 'Sudah PO'].map((label, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.poStatusTab,
                poFilterIndex === index && styles.poStatusTabActive,
              ]}
              onPress={() => onPOFilterChange(index)}
            >
              <Text
                style={[
                  styles.poStatusTabText,
                  poFilterIndex === index && styles.poStatusTabTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderSelectionBar = () => {
    if (selectedItems.length === 0) return null;

    return (
      <View style={styles.selectionBar}>
        <View style={styles.selectionInfo}>
          <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
          <Text style={styles.selectionText}>
            {selectedItems.length} item(s) selected
          </Text>
        </View>
        <View style={styles.selectionActions}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => selectedItems.forEach(id => onToggleSelection(id))}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.transferButton}
            onPress={onTransferToPreOrder}
          >
            <Ionicons name="arrow-forward-circle" size={18} color="#ffffff" />
            <Text style={styles.transferButtonText}>Transfer to PO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ItemSudahPesan }) => {
    const isSelected = selectedItems.includes(item.id);
    const qtyValue = editingQty[item.id] !== undefined ? editingQty[item.id] : item.qty_pesan.toString();

    return (
      <View style={[styles.card, isSelected && styles.cardSelected]}>
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => onToggleSelection(item.id)}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={isSelected ? '#f59e0b' : '#9ca3af'}
            />
          </TouchableOpacity>
          <Text style={styles.productName} numberOfLines={2}>
            {item.nama}
          </Text>
          {/* Kartu Stok info button */}
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => openKartuStok(item)}
          >
            <Ionicons name="information-circle" size={22} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ordered:</Text>
            <Text style={styles.infoValue}>
              {new Date(item.tgl_pesan).toLocaleDateString('id-ID')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Supplier:</Text>
            <Text style={styles.infoValue}>{item.supplier_nama}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Merk:</Text>
            <Text style={styles.infoValue}>{item.merk || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kategori:</Text>
            <Text style={styles.infoValue}>{item.kategori || '-'}</Text>
          </View>

          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Qty:</Text>
            <TextInput
              style={styles.qtyInput}
              value={qtyValue}
              onChangeText={(text) => handleQtyChange(item.id, text)}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>

          <View style={styles.poStatusRow}>
            <View
              style={[
                styles.poStatusBadge,
                item.po_status === 'sudah_po' ? styles.poStatusBadgeSuccess : styles.poStatusBadgeWarning,
              ]}
            >
              <Text style={styles.poStatusBadgeText}>
                {item.po_status === 'sudah_po' ? 'Sudah ada PO' : 'Belum ada PO'}
              </Text>
            </View>
            {item.po_status === 'sudah_po' && item.po_ids.length > 0 && (
              <Text style={styles.poIds}>
                PO: {item.po_ids.join(', ')}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.notOrderedButton}
            onPress={() => handleMarkAsNotOrdered(item)}
          >
            <Ionicons name="close-circle" size={18} color="#ef4444" />
            <Text style={styles.notOrderedButtonText}>Mark as Not Ordered</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={64} color="#9ca3af" />
      <Text style={styles.emptyText}>No ordered items</Text>
      <Text style={styles.emptySubtext}>Items you order will appear here</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderSupplierTabs()}
      {renderPOStatusTabs()}
      {renderSelectionBar()}

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          filteredItems.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f59e0b']}
            tintColor="#f59e0b"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <KartuStokModal
        visible={showKartuStok}
        itemId={kartuStokItemId}
        itemNama={kartuStokItemNama}
        onClose={() => setShowKartuStok(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  supplierTabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  supplierTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  supplierTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    minWidth: 100,
    maxWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierTabActive: {
    backgroundColor: '#f59e0b',
  },
  supplierTabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  supplierTabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  poStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  poStatusTabs: {
    flex: 1,
    flexDirection: 'row',
  },
  poStatusTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  poStatusTabActive: {
    borderBottomColor: '#f59e0b',
  },
  poStatusTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  poStatusTabTextActive: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fbbf24',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
    gap: 4,
  },
  transferButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
    marginRight: 12,
  },
  infoBtn: {
    padding: 2,
    marginLeft: 6,
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardBody: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  qtyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginRight: 12,
  },
  qtyInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  poStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  poStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  poStatusBadgeSuccess: {
    backgroundColor: '#d1fae5',
  },
  poStatusBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  poStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  poIds: {
    fontSize: 12,
    color: '#6b7280',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  notOrderedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  notOrderedButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
});

