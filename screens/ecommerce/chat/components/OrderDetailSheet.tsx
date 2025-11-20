/**
 * OrderDetailSheet Component
 * 
 * Bottom sheet modal to display detailed order information
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { IOrder, IOrderItem, formatPrice, getOrderStatusColor } from '../../../../services/ecommerce/orderService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface IOrderDetailSheetProps {
  visible: boolean;
  order: IOrder | null;
  onClose: () => void;
}

const OrderDetailSheet: React.FC<IOrderDetailSheetProps> = ({
  visible,
  order,
  onClose,
}) => {
  if (!order) return null;

  // Get order info
  const orderNumber = order.invoice || order.order_number || order.id || 'N/A';
  const orderDate = order.created_at 
    ? moment.unix(order.created_at).format('DD MMM YYYY HH:mm')
    : order.orderDate || 'N/A';
  const orderStatus = order.status || 'N/A';
  const items = order.items || order.products || [];
  const total = order.total || order.totalPrice || order.total_price || 0;
  const statusColor = getOrderStatusColor(orderStatus);

  const renderProductItem = (item: IOrderItem, index: number) => {
    const itemName = item.name || item.productName || item.product_name || 'Unknown Product';
    const itemQty = item.quantity || item.qty || 1;
    const itemPrice = item.price || item.productPrice || 0;
    const itemImage = item.image || item.productImage || item.product_image;
    const itemSubtotal = item.subtotal || (typeof itemPrice === 'number' ? itemPrice * itemQty : 0);

    return (
      <View key={index} style={styles.productItem}>
        {/* Product Image */}
        <Image
          source={{ uri: itemImage || 'https://via.placeholder.com/60' }}
          style={styles.productItemImage}
          resizeMode="cover"
        />

        {/* Product Details */}
        <View style={styles.productItemDetails}>
          <Text style={styles.productItemName} numberOfLines={2}>
            {itemName}
          </Text>
          <View style={styles.productItemInfo}>
            <Text style={styles.productItemQty}>Qty: {itemQty}</Text>
            <Text style={styles.productItemPrice}>{formatPrice(itemPrice)}</Text>
          </View>
          <Text style={styles.productItemSubtotal}>
            Subtotal: {formatPrice(itemSubtotal)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.sheet}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="receipt" size={24} color="#f59e0b" />
              <Text style={styles.headerTitle}>Order Details</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Order Info Card */}
            <View style={styles.infoCard}>
              {/* Order Number */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="receipt-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoLabelText}>Order Number</Text>
                </View>
                <Text style={styles.infoValue}>{orderNumber}</Text>
              </View>

              {/* Order Date */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoLabelText}>Date</Text>
                </View>
                <Text style={styles.infoValue}>{orderDate}</Text>
              </View>

              {/* Order Status */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoLabelText}>Status</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                  <Text style={styles.statusText}>{orderStatus}</Text>
                </View>
              </View>
            </View>

            {/* Products Section */}
            <View style={styles.productsSection}>
              <Text style={styles.sectionTitle}>Products ({items.length})</Text>
              {items.map((item, index) => renderProductItem(item, index))}
            </View>

            {/* Total Section */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Price</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabelText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  productItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  productItemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  productItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productItemQty: {
    fontSize: 12,
    color: '#6B7280',
  },
  productItemPrice: {
    fontSize: 12,
    color: '#6B7280',
  },
  productItemSubtotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f59e0b',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f59e0b',
  },
});

export default OrderDetailSheet;

