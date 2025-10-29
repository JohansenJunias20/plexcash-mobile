import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ProductItem = {
  name: string;
  sku: string;
  qty: number;
  varian?: string;
  image_url?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: ProductItem[];
  loading?: boolean;
};

type SortField = 'name' | 'sku' | 'qty';
type SortDirection = 'asc' | 'desc';

export default function DaftarBarangModal({ visible, onClose, items, loading }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Aggregate items by SKU
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, ProductItem>();
    items.forEach((item) => {
      const key = item.sku || item.name;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.qty += item.qty;
      } else {
        map.set(key, { ...item });
      }
    });
    return Array.from(map.values());
  }, [items]);

  // Filter and sort
  const processedItems = useMemo(() => {
    let filtered = aggregatedItems;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.varian || '').toLowerCase().includes(q)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'qty') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [aggregatedItems, searchQuery, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return 'swap-vertical-outline';
    return sortDirection === 'asc' ? 'arrow-up' : 'arrow-down';
  };

  const renderItem = ({ item }: { item: ProductItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.varian && (
          <Text style={styles.itemVariant} numberOfLines={1}>
            {item.varian}
          </Text>
        )}
        <Text style={styles.itemSku} numberOfLines={1}>
          SKU: {item.sku}
        </Text>
      </View>
      <View style={styles.itemQty}>
        <Text style={styles.qtyLabel}>Qty</Text>
        <Text style={styles.qtyValue}>{item.qty}</Text>
      </View>
    </View>
  );

  const totalQty = useMemo(() => processedItems.reduce((sum, item) => sum + item.qty, 0), [processedItems]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daftar Barang</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, SKU, or variant"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort controls */}
        <View style={styles.sortBar}>
          <TouchableOpacity style={styles.sortButton} onPress={() => toggleSort('name')}>
            <Text style={styles.sortButtonText}>Name</Text>
            <Ionicons name={getSortIcon('name')} size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortButton} onPress={() => toggleSort('sku')}>
            <Text style={styles.sortButtonText}>SKU</Text>
            <Ionicons name={getSortIcon('sku')} size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortButton} onPress={() => toggleSort('qty')}>
            <Text style={styles.sortButtonText}>Qty</Text>
            <Ionicons name={getSortIcon('qty')} size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {processedItems.length} items • Total Qty: {totalQty}
          </Text>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fbbf24" />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : processedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        ) : (
          <FlatList
            data={processedItems}
            keyExtractor={(item, index) => `${item.sku}-${index}`}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  sortBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  sortButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  summary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  summaryText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  listContent: {
    padding: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1,
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  itemSku: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  itemQty: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qtyLabel: {
    fontSize: 10,
    color: '#92400E',
    marginBottom: 2,
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9CA3AF',
  },
});

