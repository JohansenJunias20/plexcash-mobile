import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IProduct, formatPrice, formatStock } from '../../../../services/ecommerce/productService';

/**
 * ProductListPanel Component
 * Displays a collapsible panel with product list for sending to buyer
 */

interface IProductListPanelProps {
  visible: boolean;
  products: IProduct[];
  loading: boolean;
  onClose: () => void;
  onProductPress: (product: IProduct) => void;
  onCancelLoading?: () => void;
  loadingProgress?: {
    percentage: number;
    estimatedTime: string;
    remainingTime: string;
    status: string;
  } | null;
}

const ProductListPanel: React.FC<IProductListPanelProps> = ({
  visible,
  products,
  loading,
  onClose,
  onProductPress,
  onCancelLoading,
  loadingProgress,
}) => {
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
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>
            {loadingProgress?.status || 'Loading products...'}
          </Text>

          {/* Progress Bar */}
          {loadingProgress && (
            <>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${loadingProgress.percentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {loadingProgress.remainingTime} ({loadingProgress.percentage}%)
              </Text>
            </>
          )}

          {/* Cancel Button */}
          {onCancelLoading && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancelLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>No products available</Text>
          <Text style={styles.emptySubtext}>
            Add products to your store to send them to buyers
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
  closeButton: {
    padding: 4,
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
  progressBarContainer: {
    width: '80%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  cancelButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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

