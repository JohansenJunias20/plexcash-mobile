/**
 * Order Service
 * 
 * Handles fetching order data from ecommerce platforms
 */

import ApiService from '../api';

export interface IOrderItem {
  id?: string;
  name?: string;
  productName?: string;
  product_name?: string;
  image?: string;
  productImage?: string;
  product_image?: string;
  quantity?: number;
  qty?: number;
  price?: number | string;
  productPrice?: number | string;
  subtotal?: number | string;
}

export interface IOrder {
  id?: string;
  invoice?: string;
  order_number?: string;
  created_at?: number;
  orderDate?: string;
  status?: string;
  items?: IOrderItem[];
  products?: IOrderItem[];
  total?: number | string;
  totalPrice?: number | string;
  total_price?: number | string;
  platform?: string;
  shop_name?: string;
  id_ecommerce?: number;
  from?: string;
  booking_sn?: string | null;
  package_id?: string | null;
  orderType?: string;
  isBookingOrder?: boolean;
}

/**
 * Fetch orders for a specific ecommerce platform within a date range
 *
 * NOTE: This API endpoint returns ALL orders from the ecommerce platform,
 * not filtered by buyer. Client-side filtering is required.
 *
 * @param idEcommerce - The ecommerce platform ID
 * @param startDate - Start date in Unix timestamp (seconds)
 * @param endDate - End date in Unix timestamp (seconds)
 * @returns Promise with order list data
 */
export const fetchOrders = async (
  idEcommerce: number,
  startDate: number,
  endDate: number
): Promise<{ status: boolean; data: IOrder[]; message?: string }> => {
  try {
    console.log('📦 [OrderService] Fetching orders:', {
      idEcommerce,
      startDate,
      endDate,
    });

    const endpoint = `/get/ecommerce/order/date/${startDate}/${endDate}?id_ecommerce=${idEcommerce}`;
    const response = await ApiService.authenticatedRequest(endpoint, {
      method: 'GET',
    });

    const orderCount = response?.data?.length || 0;
    console.log('✅ [OrderService] Orders fetched successfully:', {
      count: orderCount,
    });

    // Log warning if too many orders (performance concern)
    if (orderCount > 100) {
      console.warn('⚠️ [OrderService] Large number of orders fetched:', {
        count: orderCount,
        note: 'Consider adding buyer filter to API endpoint for better performance',
      });
    }

    return {
      status: true,
      data: response?.data || [],
    };
  } catch (error: any) {
    console.error('❌ [OrderService] Error fetching orders:', error);
    return {
      status: false,
      data: [],
      message: error?.message || 'Failed to fetch orders',
    };
  }
};

/**
 * Format price to Indonesian Rupiah format
 * 
 * @param price - Price value (number or string)
 * @returns Formatted price string (e.g., "Rp 1.250.000")
 */
export const formatPrice = (price: number | string | undefined): string => {
  if (!price) return 'Rp 0';

  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice)) return 'Rp 0';

  return `Rp ${numPrice.toLocaleString('id-ID')}`;
};

/**
 * Get order status color based on status string
 *
 * @param status - Order status string
 * @returns Color hex code
 */
export const getOrderStatusColor = (status: string | undefined): string => {
  if (!status) return '#6B7280'; // gray

  const statusLower = status.toLowerCase();

  if (statusLower.includes('pending') || statusLower.includes('waiting')) {
    return '#6B7280'; // gray
  } else if (statusLower.includes('processing') || statusLower.includes('confirmed')) {
    return '#f59e0b'; // amber/orange
  } else if (statusLower.includes('shipped') || statusLower.includes('shipping')) {
    return '#3B82F6'; // blue
  } else if (statusLower.includes('delivered') || statusLower.includes('completed') || statusLower.includes('success')) {
    return '#10B981'; // green
  } else if (statusLower.includes('cancelled') || statusLower.includes('canceled') || statusLower.includes('failed')) {
    return '#EF4444'; // red
  }

  return '#6B7280'; // default gray
};

/**
 * Filter orders by buyer name
 *
 * NOTE: This is a client-side filter because the API endpoint returns ALL orders
 * from the ecommerce platform. Ideally, the API should support buyer filtering.
 *
 * @param orders - Array of all orders
 * @param buyerName - Buyer name to filter by
 * @param buyerId - Optional buyer ID to filter by
 * @returns Filtered array of orders for the specific buyer
 */
export const filterOrdersByBuyer = (
  orders: IOrder[],
  buyerName: string,
  buyerId?: string
): IOrder[] => {
  if (!orders || orders.length === 0) {
    return [];
  }

  const buyerNameLower = buyerName ? buyerName.toLowerCase().trim() : '';
  const buyerIdLower = buyerId ? String(buyerId).toLowerCase().trim() : '';

  return orders.filter((order: any) => {
    // Collect all candidate fields from order
    const candidates = [
      order.shop_name,
      order.buyer_username,
      order.buyer_name,
      order.buyer?.username,
      order.buyer?.name,
      order.buyer?.id,
      order.buyer?.buyer_id,
      order.customer_name,
      order.recipient_name,
      order.username,
      order.buyer_id,
      order.user_id,
      order.buyer_user_id,
      order.open_id,
      order.buyer_open_id,
    ]
      .filter(Boolean)
      .map((s: any) => String(s).toLowerCase().trim());

    if (buyerNameLower) {
      // Exact match against any candidate
      if (candidates.some((c) => c === buyerNameLower)) {
        return true;
      }
      // Substring match in either direction
      if (
        candidates.some(
          (c) => c.includes(buyerNameLower) || buyerNameLower.includes(c)
        )
      ) {
        return true;
      }
    }

    if (buyerIdLower) {
      if (candidates.some((c) => c === buyerIdLower) || String(order.id || '').toLowerCase() === buyerIdLower) {
        return true;
      }
    }

    return false;
  });
};

