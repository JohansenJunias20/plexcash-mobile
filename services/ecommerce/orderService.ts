/**
 * Order Service
 * 
 * Handles fetching order data from ecommerce platforms
 */

import ApiService from '../api';
import { transformErrorMessage } from '../../utils/transformErrorMessage';

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

export interface IAcceptOrderResultItem {
  order_id: string;
  id_ecommerce: number;
  success: boolean;
  status: 'fulfilled' | 'rejected';
  reason?: string;
  originalOrder: any;
  hasLogisticsError?: boolean;
}

export interface IAcceptOrdersResult {
  status: boolean;
  total: number;
  successCount: number;
  failCount: number;
  results: IAcceptOrderResultItem[];
  rejectedItems: IAcceptOrderResultItem[];
  hasLogisticsError: boolean;
  rawResponse?: any;
}

/**
 * Accept orders (Standard and Booking Kilat) matching web Plexseller's behavior.
 * 
 * @param orders - Array of orders to accept
 * @param method_ship - 'pickup' | 'dropoff' (defaults to 'pickup')
 * @returns Object with aggregated success/failure details and friendly error messages
 */
export const acceptOrders = async (
  orders: any[],
  method_ship: 'pickup' | 'dropoff' = 'pickup'
): Promise<IAcceptOrdersResult> => {
  if (!orders || orders.length === 0) {
    return {
      status: false,
      total: 0,
      successCount: 0,
      failCount: 0,
      results: [],
      rejectedItems: [],
      hasLogisticsError: false,
    };
  }

  // Separate standard orders from booking kilat orders
  const bookingOrders: any[] = [];
  const standardOrders: any[] = [];

  orders.forEach((o) => {
    if (o.isBookingOrder || !!o.booking_sn) {
      bookingOrders.push(o);
    } else {
      standardOrders.push(o);
    }
  });

  const results: IAcceptOrderResultItem[] = [];

  // 1. Process Booking Orders (Shopee Kilat)
  if (bookingOrders.length > 0) {
    const bookingBody = bookingOrders.map((b) => ({
      id_ecommerce: Number(b.ecommerce_id || b.id_ecommerce),
      order_id: String(b.booking_sn || b.id_online || b.order_sn || b.id),
      method_ship,
    }));

    try {
      const res = await ApiService.authenticatedRequest('/ecommerce/shopee/ship_booking', {
        method: 'POST',
        body: JSON.stringify(bookingBody),
      });

      if (res && res.status && Array.isArray(res.data)) {
        res.data.forEach((r: any, idx: number) => {
          const original = bookingOrders[idx];
          const orderId = String(original.booking_sn || original.id_online || original.id);
          const isFulfilled = r?.status === 'fulfilled' && r?.value !== false;
          const rawReason = r?.reason || (r?.value === false ? 'Gagal proses booking' : '');
          const isLogisticsErr = typeof rawReason === 'string' && rawReason.includes('logistics.error_booking_order');
          const cleanReason = isFulfilled ? undefined : transformErrorMessage(rawReason || 'Gagal menerima booking');

          results.push({
            order_id: orderId,
            id_ecommerce: Number(original.ecommerce_id || original.id_ecommerce),
            success: isFulfilled,
            status: isFulfilled ? 'fulfilled' : 'rejected',
            reason: cleanReason,
            originalOrder: original,
            hasLogisticsError: isLogisticsErr,
          });
        });
      } else {
        // Entire booking call failed
        const failMsg = transformErrorMessage(res?.reason || res?.message || 'Gagal memproses booking');
        bookingOrders.forEach((original) => {
          results.push({
            order_id: String(original.booking_sn || original.id_online || original.id),
            id_ecommerce: Number(original.ecommerce_id || original.id_ecommerce),
            success: false,
            status: 'rejected',
            reason: failMsg,
            originalOrder: original,
            hasLogisticsError: false,
          });
        });
      }
    } catch (err: any) {
      bookingOrders.forEach((original) => {
        results.push({
          order_id: String(original.booking_sn || original.id_online || original.id),
          id_ecommerce: Number(original.ecommerce_id || original.id_ecommerce),
          success: false,
          status: 'rejected',
          reason: transformErrorMessage(err?.message || 'Terjadi kesalahan koneksi'),
          originalOrder: original,
          hasLogisticsError: false,
        });
      });
    }
  }

  // 2. Process Standard Orders
  if (standardOrders.length > 0) {
    const standardBody = standardOrders.map((p) => {
      const itemIdBlibli = Array.isArray(p.items)
        ? p.items.map((i: any) => i.itemId_blibli).filter(Boolean)
        : undefined;

      return {
        id_ecommerce: Number(p.ecommerce_id || p.id_ecommerce),
        order_id: String(p.id_online || p.id),
        package_id: p.package_id || undefined,
        method_ship,
        item_id_blibli: itemIdBlibli && itemIdBlibli.length > 0 ? itemIdBlibli : undefined,
        item_ids: p.item_pack_id || null,
      };
    });

    try {
      const res = await ApiService.authenticatedRequest('/ecommerce/order/accept', {
        method: 'POST',
        body: JSON.stringify(standardBody),
      });

      if (res && res.status && Array.isArray(res.data)) {
        res.data.forEach((r: any, idx: number) => {
          const original = standardOrders[idx];
          const orderId = String(original.id_online || original.id);
          const isFulfilled = r?.status === 'fulfilled' && r?.value !== false;
          const rawReason = r?.reason || (r?.value === false ? 'Gagal proses, silakan coba lagi beberapa saat' : '');
          const isLogisticsErr = typeof rawReason === 'string' && rawReason.includes('logistics.error_booking_order');
          const cleanReason = isFulfilled ? undefined : transformErrorMessage(rawReason || 'Gagal menerima pesanan');

          results.push({
            order_id: orderId,
            id_ecommerce: Number(original.ecommerce_id || original.id_ecommerce),
            success: isFulfilled,
            status: isFulfilled ? 'fulfilled' : 'rejected',
            reason: cleanReason,
            originalOrder: original,
            hasLogisticsError: isLogisticsErr,
          });
        });
      } else {
        const failMsg = transformErrorMessage(res?.reason || res?.message || 'Gagal memproses pesanan');
        standardOrders.forEach((original) => {
          results.push({
            order_id: String(original.id_online || original.id),
            id_ecommerce: Number(original.ecommerce_id || original.id_ecommerce),
            success: false,
            status: 'rejected',
            reason: failMsg,
            originalOrder: original,
            hasLogisticsError: false,
          });
        });
      }
    } catch (err: any) {
      standardOrders.forEach((original) => {
        results.push({
          order_id: String(original.id_online || original.id),
          id_ecommerce: Number(original.ecommerce_id || original.id_ecommerce),
          success: false,
          status: 'rejected',
          reason: transformErrorMessage(err?.message || 'Terjadi kesalahan koneksi'),
          originalOrder: original,
          hasLogisticsError: false,
        });
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const rejectedItems = results.filter((r) => !r.success);
  const failCount = rejectedItems.length;
  const hasLogisticsError = rejectedItems.some((r) => r.hasLogisticsError);

  return {
    status: successCount > 0,
    total: orders.length,
    successCount,
    failCount,
    results,
    rejectedItems,
    hasLogisticsError,
  };
};

/**
 * Deteksi apakah nama kurir merupakan kurir Instan / Sameday
 */
export const isInstantCourier = (kurirName?: string): boolean => {
  if (!kurirName || typeof kurirName !== 'string') return false;
  const lower = kurirName.toLowerCase();
  return (
    lower.includes('instant') ||
    lower.includes('instan') ||
    lower.includes('sameday') ||
    lower.includes('same day') ||
    lower.includes('same_day') ||
    lower.includes('gojek') ||
    lower.includes('gosend') ||
    lower.includes('go-send') ||
    lower.includes('grab') ||
    lower.includes('spx instant') ||
    lower.includes('spx-instant') ||
    lower.includes('shopee xpress instant') ||
    lower.includes('spx sameday') ||
    lower.includes('lalamove') ||
    lower.includes('kurir toko') ||
    lower.includes('2 jam') ||
    lower.includes('paxel') ||
    lower.includes('borzo') ||
    lower.includes('bluebird') ||
    lower.includes('blue bird')
  );
};

/**
 * Deteksi apakah pesanan menggunakan kurir Instan
 */
export const isInstantOrder = (order: any): boolean => {
  if (!order) return false;
  const kurir =
    order.nama_kurir ||
    order.kurir ||
    order.ekspedisi ||
    order.shipping_carrier ||
    order.shipping_provider_name ||
    order.delivery_type ||
    '';
  return isInstantCourier(kurir);
};

/**
 * Menjadwalkan penerimaan pesanan dengan delay waktu (15m, 30m, 60m)
 */
export const scheduleAcceptOrders = async (
  orders: any[],
  delayMinutes: number,
  method_ship: 'pickup' | 'dropoff' = 'pickup'
): Promise<{ status: boolean; count?: number; scheduled_at?: string; message?: string; reason?: string }> => {
  if (!orders || orders.length === 0) {
    return { status: false, reason: 'Tidak ada pesanan yang dipilih.' };
  }

  const payload = orders.map((p) => {
    const itemIdBlibli = Array.isArray(p.items)
      ? p.items.map((i: any) => i.itemId_blibli).filter(Boolean)
      : undefined;

    return {
      id_ecommerce: Number(p.ecommerce_id || p.id_ecommerce),
      order_id: String(p.id_online || p.booking_sn || p.id),
      package_id: p.package_id || undefined,
      method_ship,
      item_id_blibli: itemIdBlibli && itemIdBlibli.length > 0 ? itemIdBlibli : undefined,
      item_ids: p.item_pack_id || null,
      nama_kurir: p.nama_kurir || p.kurir || p.ekspedisi || null,
      platform: p.platform || null,
      shop_id: p.shop_id || null,
    };
  });

  try {
    const res = await ApiService.authenticatedRequest('/ecommerce/order/schedule-accept', {
      method: 'POST',
      body: JSON.stringify({
        orders: payload,
        delay_minutes: delayMinutes,
      }),
    });
    return res;
  } catch (err: any) {
    return { status: false, reason: err?.message || 'Gagal menjadwalkan penerimaan pesanan.' };
  }
};

/**
 * Mengambil daftar jadwal penerimaan aktif (status = PENDING)
 */
export const fetchScheduledAcceptOrders = async (): Promise<any[]> => {
  try {
    const res = await ApiService.authenticatedRequest('/ecommerce/order/scheduled-accept', {
      method: 'GET',
    });
    if (res && res.status && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  } catch (err) {
    console.error('[orderService] fetchScheduledAcceptOrders error:', err);
    return [];
  }
};

/**
 * Membatalkan jadwal penerimaan order
 */
export const cancelScheduledAcceptOrder = async (
  orderIds: string | string[]
): Promise<{ status: boolean; message?: string }> => {
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  try {
    const res = await ApiService.authenticatedRequest('/ecommerce/order/cancel-schedule-accept', {
      method: 'POST',
      body: JSON.stringify({ order_ids: ids }),
    });
    return res;
  } catch (err: any) {
    return { status: false, message: err?.message || 'Gagal membatalkan jadwal.' };
  }
};

/**
 * Alasan penolakan/pembatalan pesanan dari pihak penjual (seller cancellation)
 * Sesuai dengan spesifikasi API Shopee & TikTok di web Plexseller
 */
export const SELLER_CANCEL_REASONS: Record<string, { value: string; label: string }[]> = {
  SHOPEE: [
    { value: 'OUT_OF_STOCK', label: 'Stok habis' },
    { value: 'CUSTOMER_REQUEST', label: 'Permintaan pembeli' },
    { value: 'UNDELIVERABLE_AREA', label: 'Area tidak terjangkau pengiriman' },
    { value: 'COD_NOT_SUPPORTED', label: 'COD tidak didukung' },
  ],
  TIKTOK: [
    { value: 'OUT_OF_STOCK', label: 'Stok habis' },
    { value: 'CUSTOMER_REQUEST', label: 'Permintaan pembeli' },
    { value: 'UNDELIVERABLE_AREA', label: 'Area tidak terjangkau pengiriman' },
    { value: 'COD_NOT_SUPPORTED', label: 'COD tidak didukung' },
    { value: 'TRADE_TIMEOUT_SELLER', label: 'Waktu penanganan habis (seller timeout)' },
    { value: 'OTHER', label: 'Lainnya' },
  ],
};

export const SUPPORTED_CANCEL_PLATFORMS = ['SHOPEE', 'TIKTOK'];

export interface ISellerCancelOrderResultItem {
  order_id: string;
  success: boolean;
  reason?: string;
}

export interface ISellerCancelOrdersResult {
  status: boolean;
  successCount: number;
  failCount: number;
  results: ISellerCancelOrderResultItem[];
}

/**
 * Tolak Pesanan / Batalkan Pesanan oleh Penjual
 * Memanggil POST /ecommerce/order/cancel — identik dengan web Plexseller
 */
export const cancelSellerOrders = async (
  orders: any[],
  cancelReasonByPlatform: Record<string, string>
): Promise<ISellerCancelOrdersResult> => {
  if (!orders || orders.length === 0) {
    return { status: false, successCount: 0, failCount: 0, results: [] };
  }

  const payload = orders.map((o) => {
    const platform = (o.platform || o.from || 'UNKNOWN').toUpperCase();
    const reason = cancelReasonByPlatform[platform] || 'OUT_OF_STOCK';
    return {
      id_ecommerce: Number(o.ecommerce_id || o.id_ecommerce || 0),
      order_id: String(o.id_online || o.id),
      shop_id: o.shop_id || o.id_toko,
      cancel_reason: reason,
      platform,
      supported: SUPPORTED_CANCEL_PLATFORMS.includes(platform),
      items: o.items?.map((it: any) => ({
        id_online: it.id_online,
        id_parent: it.id_parent,
        sku: it.sku,
        qty: it.qty,
        price: it.harga_jual ?? it.price,
      })),
    };
  });

  try {
    const res = await ApiService.authenticatedRequest('/ecommerce/order/cancel', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res?.status) {
      const errMsg = transformErrorMessage(res?.reason || 'Gagal membatalkan pesanan');
      return {
        status: false,
        successCount: 0,
        failCount: orders.length,
        results: orders.map((o) => ({
          order_id: String(o.id_online || o.id),
          success: false,
          reason: errMsg,
        })),
      };
    }

    const settled: any[] = Array.isArray(res?.data) ? res.data : [];
    const results: ISellerCancelOrderResultItem[] = orders.map((o, idx) => {
      const r = settled[idx];
      const success = r?.status === 'fulfilled' && r?.value === true;
      let reason: string | undefined;
      if (!success) {
        const rawErr = r?.reason
          ? typeof r.reason === 'string'
            ? r.reason
            : JSON.stringify(r.reason)
          : 'Gagal membatalkan';
        reason = transformErrorMessage(rawErr);
      }
      return {
        order_id: String(o.id_online || o.id),
        success,
        reason,
      };
    });

    const successCount = results.filter((r) => r.success).length;
    return {
      status: successCount > 0,
      successCount,
      failCount: results.length - successCount,
      results,
    };
  } catch (err: any) {
    return {
      status: false,
      successCount: 0,
      failCount: orders.length,
      results: orders.map((o) => ({
        order_id: String(o.id_online || o.id),
        success: false,
        reason: transformErrorMessage(err?.message || 'Terjadi kesalahan koneksi'),
      })),
    };
  }
};

// ==========================================
// BUYER CANCELLATION REQUESTS (Terima / Tolak Pembatalan Pembeli)
// ==========================================

export type TCancelRejectReason =
  | 'sudah dipacking'
  | 'sudah dikirim'
  | 'pembeli setuju'
  | 'tidak sesuai'
  | 'lainnya';

export const CANCEL_REJECT_REASONS: { label: string; value: TCancelRejectReason }[] = [
  { label: 'Pesanan sudah dipacking', value: 'sudah dipacking' },
  { label: 'Pesanan sudah diserahkan ke kurir / dikirim', value: 'sudah dikirim' },
  { label: 'Pembeli setuju untuk tetap melanjutkan pesanan', value: 'pembeli setuju' },
  { label: 'Alasan pembatalan pembeli tidak sesuai', value: 'tidak sesuai' },
  { label: 'Lainnya', value: 'lainnya' },
];

export interface ICancellationResultItem {
  id: string;
  success: boolean;
  reason?: string;
}

export interface ICancellationResult {
  status: boolean;
  total: number;
  successCount: number;
  failCount: number;
  results: ICancellationResultItem[];
}

export const acceptCancellation = async (orders: any[]): Promise<ICancellationResult> => {
  const payload = orders.map((o) => ({
    platform: (o.platform || 'SHOPEE').toUpperCase(),
    id: o.id_online || o.id,
    id_ecommerce: Number(o.ecommerce_id || o.id_ecommerce || 0),
    date: o.tanggal_order || o.date || new Date().toISOString(),
    invoice: o.id_online || o.invoice || o.id,
    from_import: false,
    booking_sn: o.booking_sn,
    orderType: o.orderType,
    isBookingOrder: !!o.booking_sn,
  }));

  try {
    const res = await ApiService.authenticatedRequest('/ecommerce/pembatalan/accept', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const results: ICancellationResultItem[] = [];
    if (res && res.status) {
      const dataList = Array.isArray(res.data) ? res.data : [];
      orders.forEach((o, idx) => {
        const itemRes = dataList[idx] || (dataList.length === 1 && orders.length === 1 ? dataList[0] : null);
        const orderId = String(o.id_online || o.id);
        const isSuccess = itemRes ? (itemRes.status !== 'rejected' && itemRes.value !== false) : true;
        const reason = isSuccess ? undefined : (typeof itemRes?.reason === 'string' ? itemRes.reason : itemRes?.reason?.message || 'Gagal terima pembatalan');
        results.push({ id: orderId, success: isSuccess, reason });
      });
    } else {
      const failMsg = res?.reason || res?.message || 'Gagal memproses terima pembatalan';
      orders.forEach((o) => {
        results.push({ id: String(o.id_online || o.id), success: false, reason: failMsg });
      });
    }

    const successCount = results.filter((r) => r.success).length;
    return {
      status: successCount > 0,
      total: orders.length,
      successCount,
      failCount: results.length - successCount,
      results,
    };
  } catch (err: any) {
    return {
      status: false,
      total: orders.length,
      successCount: 0,
      failCount: orders.length,
      results: orders.map((o) => ({
        id: String(o.id_online || o.id),
        success: false,
        reason: transformErrorMessage(err?.message || 'Terjadi kesalahan koneksi'),
      })),
    };
  }
};

export const rejectCancellation = async (
  orders: any[],
  reason: TCancelRejectReason | string
): Promise<ICancellationResult> => {
  const payload = orders.map((o) => ({
    platform: (o.platform || 'SHOPEE').toUpperCase(),
    id: o.id_online || o.id,
    id_ecommerce: Number(o.ecommerce_id || o.id_ecommerce || 0),
    date: o.tanggal_order || o.date || new Date().toISOString(),
    invoice: o.id_online || o.invoice || o.id,
    reason: reason || 'sudah dipacking',
    from_import: false,
  }));

  try {
    const res = await ApiService.authenticatedRequest('/ecommerce/pembatalan/reject', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const results: ICancellationResultItem[] = [];
    if (res && res.status) {
      const dataList = Array.isArray(res.data) ? res.data : [];
      orders.forEach((o, idx) => {
        const itemRes = dataList[idx] || (dataList.length === 1 && orders.length === 1 ? dataList[0] : null);
        const orderId = String(o.id_online || o.id);
        const isSuccess = itemRes ? (itemRes.status !== 'rejected' && itemRes.value !== false) : true;
        const itemReason = isSuccess
          ? undefined
          : typeof itemRes?.reason === 'string'
          ? itemRes.reason
          : itemRes?.reason?.message || 'Gagal tolak pembatalan';
        results.push({ id: orderId, success: isSuccess, reason: itemReason });
      });
    } else {
      const failMsg = res?.reason || res?.message || 'Gagal memproses tolak pembatalan';
      orders.forEach((o) => {
        results.push({ id: String(o.id_online || o.id), success: false, reason: failMsg });
      });
    }

    const successCount = results.filter((r) => r.success).length;
    return {
      status: successCount > 0,
      total: orders.length,
      successCount,
      failCount: results.length - successCount,
      results,
    };
  } catch (err: any) {
    return {
      status: false,
      total: orders.length,
      successCount: 0,
      failCount: orders.length,
      results: orders.map((o) => ({
        id: String(o.id_online || o.id),
        success: false,
        reason: transformErrorMessage(err?.message || 'Terjadi kesalahan koneksi'),
      })),
    };
  }
};


