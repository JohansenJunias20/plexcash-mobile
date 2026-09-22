import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  IProduct,
  formatPrice,
  formatStock,
  fetchProductsPaged,
} from '../../../../services/ecommerce/productService';

/**
 * ProductListPanel Component
 * Displays a collapsible panel with a searchable, paginated product list
 * for sending to buyer. Fetches products page-by-page from the backend
 * (instead of loading the whole catalog at once) so stores with very large
 * catalogs (10k+ products) stay fast and light on memory.
 */

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

interface IProductListPanelProps {
  visible: boolean;
  idEcommerce: number;
  onClose: () => void;
  onProductPress: (product: IProduct) => void;
}

const ProductListPanel: React.FC<IProductListPanelProps> = ({
  visible,
  idEcommerce,
  onClose,
  onProductPress,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<IProduct[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guards against stale responses when search/close happens mid-request
  const requestIdRef = useRef(0);

  // Debounce search input before triggering a server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset local state when the panel closes, so reopening starts fresh
  useEffect(() => {
    if (!visible) {
      setSearchInput('');
      setSearchQuery('');
      setProducts([]);
      setPage(1);
      setTotal(0);
      setErrorMessage(null);
    }
  }, [visible]);

  // Fetch page 1 whenever the panel opens or the search query changes
  useEffect(() => {
    if (!visible) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setErrorMessage(null);

    fetchProductsPaged(idEcommerce, 1, PAGE_SIZE, searchQuery).then((result) => {
      if (requestId !== requestIdRef.current) return; // superseded by a newer request

      if (result.status) {
        setProducts(result.data);
        setTotal(result.total);
        setPage(1);
      } else {
        setProducts([]);
        setTotal(0);
        setErrorMessage(result.message || 'Gagal memuat produk');
      }
      setLoading(false);
    });
  }, [visible, idEcommerce, searchQuery]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (products.length >= total) return;

    const nextPage = page + 1;
    const requestId = requestIdRef.current;
    setLoadingMore(true);

    fetchProductsPaged(idEcommerce, nextPage, PAGE_SIZE, searchQuery).then((result) => {
      if (requestId !== requestIdRef.current) return; // search/close changed meanwhile

      if (result.status) {
        setProducts((prev) => [...prev, ...result.data]);
        setPage(nextPage);
        setTotal(result.total);
      }
      setLoadingMore(false);
    });
  }, [idEcommerce, page, products.length, total, searchQuery, loading, loadingMore]);

  if (!visible) return null;

  // Render product card
  const renderProductCard = ({ item }: { item: IProduct }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => onProductPress(item)}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      <View style={styles.productImageContainer}>
        {item.picture ? (
          <Image
            source={{ uri: item.picture }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="cube-outline" size={40} color="#D1D5DB" />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        {/* Product Name */}
        <Text style={styles.productName} numberOfLines={2}>
          {item.nama}
        </Text>

        {/* SKU */}
        {item.sku && (
          <Text style={styles.productSku} numberOfLines={1}>
            SKU: {item.sku}
          </Text>
        )}

        {/* Price and Stock */}
        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>
            {formatPrice(item.hargajual)}
          </Text>
          <Text
            style={[
              styles.productStock,
              item.stok === 0 && styles.productStockEmpty,
            ]}
          >
            {formatStock(item.stok)}
          </Text>
        </View>
      </View>

      {/* Send Icon */}
      <View style={styles.sendIconContainer}>
        <Ionicons name="send" size={20} color="#f59e0b" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="cube" size={24} color="#f59e0b" />
          <Text style={styles.headerTitle}>Select Product</Text>
          {total > 0 && (
            <Text style={styles.headerCount}>
              ({products.length}/{total})
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama produk atau SKU..."
          placeholderTextColor="#9CA3AF"
          value={searchInput}
          onChangeText={setSearchInput}
          autoCorrect={false}
        />
        {searchInput ? (
          <TouchableOpacity onPress={() => setSearchInput('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Loading State (initial load / new search) */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      )}

      {/* Error State */}
      {!loading && errorMessage && products.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>{errorMessage}</Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && !errorMessage && products.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'Produk tidak ditemukan' : 'No products available'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Coba kata kunci lain'
              : 'Add products to your store to send them to buyers'}
          </Text>
        </View>
      )}

      {/* Product List */}
      {!loading && products.length > 0 && (
        <FlatList
          data={products}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color="#f59e0b"
                style={styles.footerLoader}
              />
            ) : null
          }
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 100,
            offset: 100 * index,
            index,
          })}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 500,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerCount: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    paddingVertical: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
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
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  productStock: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  productStockEmpty: {
    color: '#EF4444',
  },
  sendIconContainer: {
    padding: 8,
  },
});

export default ProductListPanel;
