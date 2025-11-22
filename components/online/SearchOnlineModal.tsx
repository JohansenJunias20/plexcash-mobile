import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';

interface Product {
  item_id: string;
  model_id?: string;
  name: string;
  parent_name?: string;
  product_url: string;
  sku: string;
  berat: number;
  isVariant: boolean;
  isParent: boolean;
  parent_id?: string;
  jenis_varian?: Record<string, string>;
  category?: any;
  description?: string;
  images?: string[];
}

interface SearchOnlineModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  id_ecommerce: number;
  platform?: string;
  from: 'BIND' | 'VARIANT';
  parentVariant?: boolean;
  exclude_id?: string[];
  productName?: string;
}

export default function SearchOnlineModal({
  visible,
  onClose,
  onSelect,
  id_ecommerce,
  platform,
  from,
  parentVariant = false,
  exclude_id = [],
  productName,
}: SearchOnlineModalProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      fetchProducts();
    }
  }, [visible, id_ecommerce]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.parent_name && product.parent_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await ApiService.authenticatedRequest(
        `/get/ecommerce/products?id_ecommerce=${id_ecommerce}&parentVariant=${parentVariant ? 1 : 0}`
      );

      if (response?.status && response.data) {
        let productData = response.data as Product[];

        // Filter based on 'from' type
        if (from === 'BIND') {
          // For BIND, exclude parent products
          productData = productData.filter((p) => !p.isParent);
        }

        // Exclude already bound products
        if (exclude_id.length > 0) {
          productData = productData.filter(
            (p) => !exclude_id.includes(p.model_id || p.item_id)
          );
        }

        setProducts(productData);
        setFilteredProducts(productData);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (product: Product) => {
    onSelect(product);
    onClose();
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const displayName = item.parent_name
      ? `${item.parent_name} ${item.name}`
      : item.name;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleSelect(item)}
      >
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.productSku}>SKU: {item.sku}</Text>
          {item.isVariant && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Variant</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {from === 'BIND' ? 'Bind Product' : 'Select Parent Variant'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Product Name Display */}
        {productName && (
          <View style={styles.productNameContainer}>
            <Text style={styles.productNameLabel}>Produk yang sedang dipilih:</Text>
            <Text style={styles.productNameText}>{productName}</Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Product List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>No products found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'No products available'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.model_id || item.item_id}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginTop: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  productNameContainer: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  productNameLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  productNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
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
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
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
  listContainer: {
    paddingHorizontal: 16,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});

