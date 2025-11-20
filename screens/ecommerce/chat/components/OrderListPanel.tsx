/**
 * OrderListPanel Component
 *
 * Displays a collapsible panel with list of orders for the current buyer
 */

import React, { memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { IOrder, formatPrice, getOrderStatusColor } from '../../../../services/ecommerce/orderService';
import { LoadingProgress } from '../../../../services/ecommerce/loadingTimeEstimator';

interface IOrderListPanelProps {
  visible: boolean;
  orders: IOrder[];
  loading: boolean;
  loadingProgress?: LoadingProgress | null;
  onClose: () => void;
  onOrderPress: (order: IOrder) => void;
  onCancelLoading?: () => void;
}

// Order Image Component with error handling
const OrderImage: React.FC<{ imageUrl?: string; itemName: string }> = ({ imageUrl, itemName }) => {
  const [imageError, setImageError] = useState(false);

  // Placeholder icon component
  const PlaceholderIcon = () => (
    <View style={styles.placeholderContainer}>
      <Ionicons name="image-outline" size={32} color="#D1D5DB" />
    </View>
  );

  if (!imageUrl || imageError) {
    return <PlaceholderIcon />;
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.productImage}
      resizeMode="cover"
      onError={(error) => {
        console.log('❌ [OrderImage] Failed to load image:', {
          url: imageUrl,
          error: error.nativeEvent,
        });
        setImageError(true);
      }}
    />
  );
};

const OrderListPanel: React.FC<IOrderListPanelProps> = ({
  visible,
  orders,
  loading,
  loadingProgress,
  onClose,
  onOrderPress,
  onCancelLoading,
}) => {
  if (!visible) return null;

  const renderOrderCard = ({ item }: { item: IOrder }) => {
    // Get first product item
    const items = item.items || item.products || [];
    const firstItem = items[0];
    const itemImage = firstItem?.image || firstItem?.productImage || firstItem?.product_image;
    const itemName = firstItem?.name || firstItem?.productName || firstItem?.product_name || 'Product';

    // Debug: Log image URL
    if (!itemImage) {
      console.log('⚠️ [OrderListPanel] No image found for order:', {
        orderNumber: item.invoice || item.id,
        firstItem: firstItem,
        itemsCount: items.length,
      });
    }

    // Get order info
    const orderNumber = item.invoice || item.order_number || item.id || 'N/A';
    const orderDate = item.created_at
      ? moment.unix(item.created_at).format('DD MMM YYYY HH:mm')
      : item.orderDate || 'N/A';
    const orderStatus = item.status || 'N/A';
    const total = item.total || item.totalPrice || item.total_price || 0;
    const statusColor = getOrderStatusColor(orderStatus);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => onOrderPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.orderCardContent}>
          {/* Product Image with Badge */}
          <View style={styles.imageContainer}>
            <OrderImage imageUrl={itemImage} itemName={itemName} />
            {items.length > 1 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>+{items.length - 1}</Text>
              </View>
            )}
          </View>

          {/* Order Details */}
          <View style={styles.orderDetails}>
            {/* Order Number & Status */}
            <View style={styles.orderHeader}>
              <View style={styles.orderNumberContainer}>
                <Ionicons name="receipt-outline" size={12} color="#6B7280" />
                <Text style={styles.orderNumber} numberOfLines={1}>
                  {orderNumber}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{orderStatus}</Text>
              </View>
            </View>

            {/* Order Date */}
            <View style={styles.orderDateContainer}>
              <Ionicons name="calendar-outline" size={12} color="#6B7280" />
              <Text style={styles.orderDate}>{orderDate}</Text>
            </View>

            {/* Total Price */}
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalPrice}>{formatPrice(total)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="receipt" size={20} color="#f59e0b" />
          <Text style={styles.headerTitle}>Order List ({orders.length})</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading orders...</Text>

            {/* Progress Information */}
            {loadingProgress && (
              <>
                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${loadingProgress.progressPercentage}%` }
                    ]}
                  />
                </View>

                {/* Time Estimate */}
                <View style={styles.timeEstimateContainer}>
                  {loadingProgress.status === 'starting' && (
                    <Text style={styles.timeEstimateText}>
                      Memulai... (~{loadingProgress.estimatedTotalSeconds} detik)
                    </Text>
                  )}
                  {loadingProgress.status === 'loading' && (
                    <Text style={styles.timeEstimateText}>
                      Sisa waktu: ~{loadingProgress.estimatedRemainingSeconds} detik ({loadingProgress.progressPercentage}%)
                    </Text>
                  )}
                  {loadingProgress.status === 'almost-done' && (
                    <Text style={styles.timeEstimateText}>
                      Hampir selesai... ({loadingProgress.progressPercentage}%)
                    </Text>
                  )}
                  {loadingProgress.status === 'finishing' && (
                    <Text style={styles.timeEstimateText}>
                      Menyelesaikan...
                    </Text>
                  )}
                </View>
              </>
            )}

            {/* Fallback text when no progress data */}
            {!loadingProgress && (
              <Text style={styles.loadingSubtext}>Perlu membutuhkan waktu beberapa menit, silahkan tunggu</Text>
            )}

            {/* Cancel Button */}
            {onCancelLoading && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancelLoading}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color="#ef9c44ff" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            renderItem={renderOrderCard}
            keyExtractor={(item, index) => item.id || item.invoice || index.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            // Performance optimizations
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
            getItemLayout={(data, index) => ({
              length: 100, // Approximate height of each order card
              offset: 100 * index,
              index,
            })}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    height: 320, // Fixed height instead of maxHeight
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    height: 268, // Fixed height: 320 (container) - 52 (header height)
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
  },
  progressBarContainer: {
    width: '80%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  timeEstimateContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  timeEstimateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  cancelButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },
  listContent: {
    padding: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  orderCardContent: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  placeholderContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  orderDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orderDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  orderDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  totalPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
  },
});

// Memoize component to prevent unnecessary re-renders
export default memo(OrderListPanel);

