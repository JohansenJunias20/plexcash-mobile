import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';

interface ItemBelumPesan {
  id: number;
  nama: string;
  merk: string;
  kategori: string;
  id_supplier: number;
  supplier_nama?: string;
  minstok: number;
  stok: number;
  qty_pesan: number;
  qty_preorder_pending: number;
  total_available: number;
  qty_to_order: number;
}

interface BelumPesanTabProps {
  items: ItemBelumPesan[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onUpdateQty: (id: number, qty: number) => void;
  onUpdateSupplier: (id: number, id_supplier: number) => Promise<void>;
  onMarkAsOrdered: (id: number, id_supplier: number, qty_pesan: number) => void;
}

export default function BelumPesanTab({
  items,
  loading,
  refreshing,
  onRefresh,
  onUpdateQty,
  onUpdateSupplier,
  onMarkAsOrdered,
}: BelumPesanTabProps) {
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<number | null>(null);

  const handleChangeSupplier = (itemId: number, currentSupplierId: number) => {
    console.log('[BelumPesanTab] Opening supplier modal for item:', itemId, 'current supplier:', currentSupplierId);
    setCurrentItemId(itemId);
    setShowSupplierModal(true);
  };

  const handleSupplierSelect = async (supplier: SupplierItem) => {
    console.log('[BelumPesanTab] Supplier selected:', supplier.id, supplier.nama);
    if (currentItemId) {
      console.log('[BelumPesanTab] Updating supplier for item:', currentItemId, 'to:', supplier.id);

      // Close modal immediately for better UX
      setShowSupplierModal(false);

      // Call the async update function (which will auto-mark as ordered)
      await onUpdateSupplier(currentItemId, supplier.id);

      // Clear current item
      setCurrentItemId(null);
    } else {
      console.warn('[BelumPesanTab] No current item ID set!');
    }
  };

  const handleOrder = (item: ItemBelumPesan) => {
    console.log('[BelumPesanTab] Order button clicked for item:', item.id, 'supplier:', item.id_supplier);

    if (!item.id_supplier) {
      console.warn('[BelumPesanTab] No supplier selected for item:', item.id);
      Alert.alert('Error', 'Please select a supplier first');
      return;
    }

    if (item.qty_pesan <= 0) {
      console.warn('[BelumPesanTab] Invalid quantity for item:', item.id, 'qty:', item.qty_pesan);
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    console.log('[BelumPesanTab] Showing confirmation dialog for item:', item.id);
    Alert.alert(
      'Confirm Order',
      `Mark "${item.nama}" as ordered?\nQuantity: ${item.qty_pesan}\nSupplier : ${item.supplier_nama || 'Tidak diketahui'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Order',
          onPress: () => {
            console.log('[BelumPesanTab] User confirmed order for item:', item.id);
            onMarkAsOrdered(item.id, item.id_supplier, item.qty_pesan);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ItemBelumPesan }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.nama}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Merk:</Text>
            <Text style={styles.infoValue}>{item.merk || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kategori:</Text>
            <Text style={styles.infoValue}>{item.kategori || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stock:</Text>
            <Text style={styles.infoValue}>
              {item.stok} / Min: {item.minstok}
            </Text>
          </View>
          {item.qty_preorder_pending > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pending PO:</Text>
              <Text style={[styles.infoValue, styles.pendingPO]}>
                {item.qty_preorder_pending}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Supplier:</Text>
            <Text style={[styles.infoValue, item.supplier_nama ? styles.supplierSelected : styles.supplierNotSelected]}>
              {item.supplier_nama || 'Not Selected'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Need to Order:</Text>
            <Text style={[styles.infoValue, styles.needToOrder]}>
              {item.qty_to_order}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.qtyContainer}>
            <Text style={styles.qtyLabel}>Qty:</Text>
            <TextInput
              style={styles.qtyInput}
              value={item.qty_pesan.toString()}
              onChangeText={(text) => {
                const qty = parseInt(text) || 0;
                console.log('[BelumPesanTab] Quantity changed for item:', item.id, 'to:', qty);
                onUpdateQty(item.id, qty);
              }}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>

          <TouchableOpacity
            style={styles.changeButton}
            onPress={() => {
              console.log('[BelumPesanTab] Change button pressed for item:', item.id);
              handleChangeSupplier(item.id, item.id_supplier);
            }}
          >
            <Ionicons name="swap-horizontal" size={18} color="#ffffff" />
            <Text style={styles.changeButtonText}>Change</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => {
              console.log('[BelumPesanTab] Order button pressed for item:', item.id);
              handleOrder(item);
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
            <Text style={styles.orderButtonText}>Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle-outline" size={64} color="#9ca3af" />
      <Text style={styles.emptyText}>No items need ordering</Text>
      <Text style={styles.emptySubtext}>All items are above minimum stock</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
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

      <SearchSupplierModal
        visible={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSelect={handleSupplierSelect}
        title="Select Supplier"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  cardHeader: {
    marginBottom: 12,
  },
  productName: {
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
  pendingPO: {
    color: '#3b82f6',
  },
  needToOrder: {
    color: '#ef4444',
    fontWeight: '600',
  },
  supplierSelected: {
    color: '#10b981',
    fontWeight: '600',
  },
  supplierNotSelected: {
    color: '#ef4444',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  qtyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginRight: 8,
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
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  changeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  orderButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
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

