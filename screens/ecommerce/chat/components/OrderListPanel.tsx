/**
 * OrderListPanel Component
 *
 * Displays a collapsible panel with list of orders for the current buyer
 */

import React, { memo, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { IOrder, formatPrice, getOrderStatusColor, filterOrdersByBuyer } from '../../../../services/ecommerce/orderService';
import { LoadingProgress } from '../../../../services/ecommerce/loadingTimeEstimator';
import { IChatBuyer } from '../types/chat.types';

interface IOrderListPanelProps {
  visible: boolean;
  orders: IOrder[];
  buyer?: IChatBuyer;
  loading: boolean;
  loadingProgress?: LoadingProgress | null;
  onClose: () => void;
  onOrderPress: (order: IOrder) => void;
  onAcceptOrder?: (order: IOrder) => void;
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
  buyer,
  loading,
  loadingProgress,
  onClose,
  onOrderPress,
  onAcceptOrder,
  onCancelLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'buyer' | 'all'>('buyer');

  // Filter orders by buyer
  const buyerOrders = useMemo(() => {
    if (!buyer || !buyer.name) return orders;
    return filterOrdersByBuyer(orders, buyer.name, buyer.id);
  }, [orders, buyer]);

  // Selected base list based on tab
  const baseOrders = useMemo(() => {
    if (activeTab === 'buyer' && buyer && buyer.name) {
      return buyerOrders;
    }
    return orders;
  }, [activeTab, buyerOrders, orders, buyer]);

  // Filtered by search query
  const displayedOrders = useMemo(() => {
    if (!searchQuery.trim()) return baseOrders;
    const q = searchQuery.toLowerCase().trim();
    return baseOrders.filter((item) => {
      const inv = (item.invoice || '').toLowerCase();
      const orderNum = (item.order_number || '').toLowerCase();
      const idStr = String(item.id || '').toLowerCase();
      const bookingSn = (item.booking_sn || '').toLowerCase();
      const statusStr = (item.status || '').toLowerCase();

      const items = item.items || item.products || [];
      const itemMatch = items.some((it: any) => {
        const name = (it.name || it.productName || it.product_name || '').toLowerCase();
        const sku = (it.sku || '').toLowerCase();
        return name.includes(q) || sku.includes(q);
      });

      return (
        inv.includes(q) ||
        orderNum.includes(q) ||
        idStr.includes(q) ||
        bookingSn.includes(q) ||
        statusStr.includes(q) ||
        itemMatch
      );
    });
  }, [baseOrders, searchQuery]);

  if (!visible) return null;

  const renderOrderCard = ({ item }: { item: IOrder }) => {
    // Get first product item
    const items = item.items || item.products || [];
    const firstItem = items[0];
    const itemImage = firstItem?.image || firstItem?.productImage || firstItem?.product_image;
    const itemName = firstItem?.name || firstItem?.productName || firstItem?.product_name || 'Product';

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

            {/* Action Buttons */}
            {(orderStatus.toUpperCase() === 'PESANAN BARU' || orderStatus.toUpperCase() === 'READY_TO_SHIP') && onAcceptOrder && (
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent triggering onOrderPress
                  onAcceptOrder(item);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Terima Pesanan</Text>
              </TouchableOpacity>
            )}
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
          <Text style={styles.headerTitle}>Order List ({displayedOrders.length})</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Search & Buyer Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari no. pesanan, produk, status..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {buyer && buyer.name ? (
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'buyer' && styles.tabButtonActive]}
              onPress={() => setActiveTab('buyer')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-outline"
                size={13}
                color={activeTab === 'buyer' ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[styles.tabText, activeTab === 'buyer' && styles.tabTextActive]}>
                Pesanan {buyer.name} ({buyerOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
              onPress={() => setActiveTab('all')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="list-outline"
                size={13}
                color={activeTab === 'all' ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                Semua ({orders.length})
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
        ) : displayedOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {searchQuery
                ? `Tidak ada pesanan cocok dengan "${searchQuery}"`
                : activeTab === 'buyer' && buyer
                ? `Belum ada pesanan untuk buyer ${buyer.name}`
                : 'Tidak ada pesanan ditemukan'}
            </Text>
            {activeTab === 'buyer' && buyerOrders.length === 0 && orders.length > 0 ? (
              <TouchableOpacity
                style={styles.showAllButton}
                onPress={() => setActiveTab('all')}
              >
                <Text style={styles.showAllButtonText}>Tampilkan Semua ({orders.length}) Pesanan</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <FlatList
            data={displayedOrders}
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
    height: 380, // Increased height to fit search & tabs nicely
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  searchSection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: '#f59e0b',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
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
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  showAllButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  showAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
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
  acceptButton: {
    marginTop: 8,
    backgroundColor: '#10B981', // Green for accept
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

// Memoize component to prevent unnecessary re-renders
export default memo(OrderListPanel);

