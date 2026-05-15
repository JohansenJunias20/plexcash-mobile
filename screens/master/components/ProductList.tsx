import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProductCard from './ProductCard';

interface IDefaultBarang {
  id: number | string;
  nama: string;
  sku: string;
  harga_jual: number;
  stok: number;
  imageUrl?: string;
  binded?: boolean;
  status_import?: 'waiting' | 'processing' | 'completed' | 'error';
}

interface ProductListProps {
  products: IDefaultBarang[];
  loading: boolean;
  refreshing: boolean;
  selectedIds: (number | string)[];
  onToggleSelection: (id: number | string) => void;
  onRefresh: () => void;
}

const ProductList: React.FC<ProductListProps> = ({
  products,
  loading,
  refreshing,
  selectedIds,
  onToggleSelection,
  onRefresh,
}) => {
  const renderItem = ({ item }: { item: IDefaultBarang }) => (
    <ProductCard
      item={item}
      isSelected={selectedIds.includes(item.id)}
      onToggleSelection={onToggleSelection}
    />
  );

  const renderEmpty = () => {
    if (loading) {
      return null;
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={64} color="#d1d5db" />
        <Text style={styles.emptyTitle}>Tidak ada produk</Text>
        <Text style={styles.emptySubtitle}>
          Belum ada produk yang tersedia untuk marketplace ini
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading) {
      return null;
    }

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="large" color="#fbbf24" />
        <Text style={styles.loadingText}>Memuat produk...</Text>
      </View>
    );
  };

  const keyExtractor = (item: IDefaultBarang) => String(item.id);

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={[
        styles.listContent,
        products.length === 0 && styles.listContentEmpty,
      ]}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#fbbf24']}
          tintColor="#fbbf24"
        />
      }
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={10}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingFooter: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default ProductList;

