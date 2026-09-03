import ApiService from '../api';
import moment from 'moment';

// ============================================
// INTERFACES & TYPES
// ============================================

export interface IFlashSaleShop {
  id: number;
  name: string;
  platform: string;
  status: string;
  shop_id?: number | string;
}

export interface IUnmetCriterion {
  metric_name: string;
  title: string;
  target: string;
  current: string;
  description: string;
}

export interface ISellerEligibilityResponse {
  status: boolean;
  is_eligible: boolean;
  unmet_criteria?: IUnmetCriterion[];
  shop_name?: string;
  performance_summary?: {
    sales?: number;
    orders?: number;
    buyers?: number;
    click_rate?: number;
  };
  reason?: string;
}

export interface ITimeslot {
  timeslot_id: number;
  start_time: number;
  end_time: number;
  is_booked?: boolean;
}

export interface IProductCategory {
  id: number;
  name: string;
}

export interface IFlashSaleProductItem {
  item_id: number | string;
  name: string;
  item_name?: string;
  product_name?: string;
  price: number;
  current_price?: number;
  stock: number;
  isParent?: boolean;
  isVariant?: boolean;
  parent_id?: number | string | null;
  models?: IFlashSaleProductItem[];
  hpp?: number;
  is_bound?: boolean;
  category_id?: number;
  picture?: string;
  image?: string;
  images?: string[];
  sku?: string;
}

export interface IFlashSaleItemPayload {
  item_id: number | string;
  isVariant: boolean;
  flash_price: number;
  stock: number;
  parent_id?: number | string;
}

export interface IFlashSaleSession {
  id: number;
  flash_sale_id: number;
  timeslot_id: number;
  start_time: number | string;
  end_time: number | string;
  status: 'active' | 'draft' | 'ended' | 'cancelled' | string;
  item_count?: number;
  items?: IFlashSaleSessionItem[];
}

export interface IFlashSaleSessionItem {
  id?: number;
  item_id: number | string;
  model_id?: number | string;
  name?: string;
  item_name?: string;
  product_name?: string;
  image?: string;
  picture?: string;
  sku?: string;
  original_price: number;
  flash_price: number;
  stock_allocated: number;
  sold_count?: number;
  hpp?: number;
  is_bound?: boolean;
  status?: string;
  reject_reason?: string;
}

export interface IAutoFlashSaleItem {
  id: number;
  id_ecommerce: number;
  shop_id: number | string;
  item_id: string | number;
  name?: string;
  item_name?: string;
  product_name?: string;
  item_sku?: string;
  sku?: string;
  flash_price: number;
  stock_allocated: number;
  end_date: string | null;
  status: 'ACTIVE' | 'FINISHED' | string;
  last_sync_status: 'success' | 'failed' | string;
  reason_failed?: string | null;
  created_at: string;
  picture?: string;
  image?: string;
  hpp?: number;
  original_price?: number;
}

export interface IShopeeRejection {
  item_id: number | string;
  err_msg: string;
  item_name?: string;
  item_sku?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Translates technical error codes / phrases from Shopee into user-friendly Indonesian messages
 */
export const translateShopeeError = (rawMsg?: string, code?: number | string): string => {
  if (!rawMsg) return 'Shopee menolak produk ini tanpa keterangan.';
  const lower = rawMsg.toLowerCase();

  if (lower.includes('lowest price') || code === 10014 || code === '10014') {
    return 'Harga promo harus lebih rendah dari harga terendah produk dalam 7 hari terakhir.';
  }
  if (
    lower.includes('already exist') ||
    lower.includes('conflict') ||
    code === 1400101731 ||
    code === '1400101731'
  ) {
    return 'Produk sudah terdaftar pada sesi Flash Sale lain yang jadwalnya bentrok.';
  }
  if (
    lower.includes('item invalid') ||
    lower.includes('does not meet criteria') ||
    code === 1400101741 ||
    code === '1400101741'
  ) {
    return 'Status produk tidak valid di Shopee (misal stok habis, diblokir, atau non-aktif).';
  }
  if (lower.includes('stock') || lower.includes('quota')) {
    return 'Alokasi stok promosi harus antara 1 sampai 350 unit dan tidak melebihi stok gudang.';
  }
  if (lower.includes('discount')) {
    return 'Diskon promosi harus minimal 5% dan maksimal 100%.';
  }

  return rawMsg;
};

/**
 * Formats Shopee image URL, adding CDN prefix if only image hash is provided
 */
export const formatShopeeImageUrl = (img?: string): string | undefined => {
  if (!img || typeof img !== 'string') return undefined;
  const trimmed = img.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://down-id.img.susercontent.com/file/${trimmed}`;
};

/**
 * Universal date/time formatter supporting unix seconds, milliseconds, ISO strings, and MySQL datetime
 */
export const formatDateTime = (val: any, format = 'DD MMM YYYY, HH:mm'): string => {
  if (!val) return '-';
  try {
    // If it's a numeric unix timestamp in seconds (<= 10 digits)
    if (typeof val === 'number' || (/^\d+$/.test(String(val)) && String(val).length <= 10)) {
      const num = Number(val);
      if (num > 0 && num < 10000000000) {
        return moment(num * 1000).format(format);
      }
    }
    const m = moment(val);
    if (m.isValid()) {
      return m.format(format);
    }
    return String(val);
  } catch (e) {
    return '-';
  }
};

/**
 * Formats unix timestamp to Indonesian readable date/time (backwards compatible)
 */
export const formatEpochTime = (val: any, includeSeconds = false): string => {
  return formatDateTime(val, includeSeconds ? 'DD MMM YYYY, HH:mm:ss' : 'DD MMM YYYY, HH:mm');
};

/**
 * Calculates discount percentage
 */
export const calculateDiscountPercent = (originalPrice: number, flashPrice: number): number => {
  if (!originalPrice || originalPrice <= 0 || !flashPrice) return 0;
  const pct = ((originalPrice - flashPrice) / originalPrice) * 100;
  return Math.round(pct * 10) / 10;
};

/**
 * Calculates margin percentage relative to HPP
 */
export const calculateHppMargin = (flashPrice: number, hpp: number): number => {
  if (!hpp || hpp <= 0 || !flashPrice) return 0;
  const margin = ((flashPrice - hpp) / hpp) * 100;
  return Math.round(margin * 10) / 10;
};

// ============================================
// SERVICE CLASS
// ============================================

export class FlashSaleService {
  /**
   * Fetch connected shops and filter for active Shopee shops
   */
  static async getShopeeShops(): Promise<IFlashSaleShop[]> {
    try {
      const res = await ApiService.get('/get/ecommerce');
      if (res && res.status && Array.isArray(res.data)) {
        return res.data.filter(
          (shop: any) =>
            (shop.platform || '').toUpperCase() === 'SHOPEE' &&
            (shop.status || '').toUpperCase() === 'APPROVED'
        );
      }
      return [];
    } catch (error) {
      console.error('[FlashSaleService] Error fetching shops:', error);
      return [];
    }
  }

  /**
   * Check seller eligibility criteria for Shopee Flash Sale
   */
  static async checkEligibility(idEcommerce: number): Promise<ISellerEligibilityResponse> {
    try {
      const res = await ApiService.post('/api/flash-sale/check-eligibility', {
        id_ecommerce: idEcommerce,
      });
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error checking eligibility:', error);
      return {
        status: false,
        is_eligible: false,
        reason: error.message || 'Gagal memeriksa kelayakan toko',
      };
    }
  }

  /**
   * Fetch available Shopee timeslots within the next 48 hours
   */
  static async getTimeSlots(
    idEcommerce: number,
    startTime?: number,
    endTime?: number
  ): Promise<{ status: boolean; timeslot_list: ITimeslot[]; message?: string }> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const start = startTime || now;
      const end = endTime || now + 48 * 3600; // 48 hours ahead

      const res = await ApiService.post('/api/flash-sale/time-slots', {
        id_ecommerce: idEcommerce,
        start_time: start,
        end_time: end,
      });

      if (res && res.status) {
        return {
          status: true,
          timeslot_list: res.timeslot_list || res.data || [],
        };
      }
      return {
        status: false,
        timeslot_list: [],
        message: res?.message || 'Gagal mengambil slot waktu',
      };
    } catch (error: any) {
      console.error('[FlashSaleService] Error fetching timeslots:', error);
      return {
        status: false,
        timeslot_list: [],
        message: error.message || 'Gagal mengambil slot waktu',
      };
    }
  }

  /**
   * Fetch products with price, variants, category, HPP, and binding status
   */
  /**
   * Fetch products with price, variants, category, HPP, and binding status
   */
  static async getProductsWithPrice(
    idEcommerce: number
  ): Promise<{ status: boolean; data: IFlashSaleProductItem[]; categories: IProductCategory[]; message?: string }> {
    try {
      const res = await ApiService.get(`/get/ecommerce/products-with-price?id_ecommerce=${idEcommerce}`);
      if (res && (res.status || Array.isArray(res.data))) {
        const rawData = Array.isArray(res.data) ? res.data : [];
        const rawCategories = Array.isArray(res.categories) ? res.categories : [];

        // Normalize images, pictures, and names for every product & variant
        const normalizedProducts: IFlashSaleProductItem[] = rawData.map((item: any) => {
          const rawImages = Array.isArray(item.images) ? item.images : [];
          const rawPic =
            item.picture ||
            item.image ||
            (rawImages.length > 0 ? rawImages[0] : undefined);
          const formattedPic = formatShopeeImageUrl(rawPic);

          const models: IFlashSaleProductItem[] = Array.isArray(item.models)
            ? item.models.map((m: any) => {
                const mRawImages = Array.isArray(m.images) ? m.images : [];
                const mRawPic =
                  m.picture ||
                  m.image ||
                  (mRawImages.length > 0 ? mRawImages[0] : undefined) ||
                  formattedPic;
                return {
                  ...m,
                  item_id: m.item_id ? String(m.item_id) : '',
                  name: m.nama || m.name || m.item_name || '',
                  picture: formatShopeeImageUrl(mRawPic),
                  images: mRawImages.map((u: string) => formatShopeeImageUrl(u) || u),
                  sku: m.sku || '',
                  price: m.price || m.current_price || 0,
                  current_price: m.current_price || m.price || 0,
                  stock: m.stock || m.qty || 0,
                  hpp: m.hpp || 0,
                  is_bound: !!m.is_bound,
                  isVariant: true,
                  parent_id: item.item_id ? String(item.item_id) : undefined,
                };
              })
            : [];

          return {
            ...item,
            item_id: item.item_id ? String(item.item_id) : '',
            name: item.nama || item.name || item.item_name || item.product_name || '',
            picture: formattedPic,
            images: rawImages.map((u: string) => formatShopeeImageUrl(u) || u),
            sku: item.sku || '',
            price: item.price || item.current_price || 0,
            current_price: item.current_price || item.price || 0,
            stock: item.stock || item.qty || 0,
            hpp: item.hpp || 0,
            is_bound: !!item.is_bound,
            models,
          };
        });

        return {
          status: true,
          data: normalizedProducts,
          categories: rawCategories,
        };
      }
      return {
        status: false,
        data: [],
        categories: [],
        message: res?.message || 'Gagal mengambil daftar produk',
      };
    } catch (error: any) {
      console.error('[FlashSaleService] Error fetching products:', error);
      return {
        status: false,
        data: [],
        categories: [],
        message: error.message || 'Gagal mengambil produk',
      };
    }
  }

  // In-memory catalog cache by idEcommerce (valid for 5 mins)
  private static catalogCache: Record<
    number,
    {
      products: IFlashSaleProductItem[];
      lookupMap: Record<string, IFlashSaleProductItem>;
      timestamp: number;
    }
  > = {};

  /**
   * Get store catalog with indexed lookup map for fast item_id / model_id matching
   */
  static async getProductCatalog(
    idEcommerce: number,
    forceRefresh = false
  ): Promise<{
    products: IFlashSaleProductItem[];
    lookupMap: Record<string, IFlashSaleProductItem>;
  }> {
    const now = Date.now();
    const cached = this.catalogCache[idEcommerce];
    if (!forceRefresh && cached && now - cached.timestamp < 5 * 60 * 1000) {
      return { products: cached.products, lookupMap: cached.lookupMap };
    }

    const res = await this.getProductsWithPrice(idEcommerce);
    const products = res.data || [];
    const lookupMap: Record<string, IFlashSaleProductItem> = {};

    products.forEach((prod) => {
      const pid = String(prod.item_id);
      lookupMap[pid] = prod;

      if (prod.models && Array.isArray(prod.models)) {
        prod.models.forEach((m) => {
          const mid = String(m.item_id);
          const parentName = prod.name || '';
          const varName = m.name || '';
          const resolvedName = varName
            ? varName.toLowerCase().includes(parentName.toLowerCase())
              ? varName
              : `${parentName} - ${varName}`
            : parentName;

          lookupMap[mid] = {
            ...m,
            parent_id: pid,
            name: resolvedName,
            picture: m.picture || prod.picture,
            sku: m.sku || prod.sku,
            hpp: m.hpp || prod.hpp,
          };
        });
      }
    });

    this.catalogCache[idEcommerce] = {
      products,
      lookupMap,
      timestamp: now,
    };

    return { products, lookupMap };
  }

  /**
   * Create a new flash sale session at Shopee for a specific timeslot
   */
  static async createFlashSaleSession(
    idEcommerce: number,
    timeslotId: number,
    startTime: number,
    endTime: number
  ): Promise<{ status: boolean; flash_sale_id?: number; reason?: string; message?: string }> {
    try {
      const res = await ApiService.post('/api/flash-sale/create', {
        id_ecommerce: idEcommerce,
        timeslot_id: timeslotId,
        start_time: startTime,
        end_time: endTime,
      });
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error creating session:', error);
      return {
        status: false,
        reason: error.message || 'Gagal membuat sesi flash sale',
      };
    }
  }

  /**
   * Add items to an existing Shopee Flash Sale session
   */
  static async addItemsToSession(
    flashSaleId: number,
    items: IFlashSaleItemPayload[]
  ): Promise<{
    status: boolean;
    reason?: string;
    failure_list?: IShopeeRejection[];
    message?: string;
  }> {
    try {
      const res = await ApiService.post('/api/flash-sale/add-items', {
        flash_sale_id: flashSaleId,
        items,
      });
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error adding items:', error);
      return {
        status: false,
        reason: error.message || 'Gagal menambahkan produk ke sesi',
      };
    }
  }

  /**
   * Register products for recurring Auto Flash Sale
   */
  static async createAutoFlashSale(
    idEcommerce: number,
    products: Array<{ item_id: string | number; flash_price: number; stock_allocated: number }>,
    endDate?: string | null
  ): Promise<{ status: boolean; message?: string; reason?: string }> {
    try {
      const res = await ApiService.post('/api/flash-sale/auto/create', {
        id_ecommerce: idEcommerce,
        end_date: endDate || null,
        products,
      });
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error creating auto flash sale:', error);
      return {
        status: false,
        reason: error.message || 'Gagal menyimpan konfigurasi otomatis',
      };
    }
  }

  /**
   * Fetch live Shopee Flash Sale sessions list
   */
  static async getFlashSaleList(
    idEcommerce: number,
    type: 'all' | 'active' | 'draft' | 'ended' = 'all',
    offset = 0,
    limit = 30
  ): Promise<{ status: boolean; data: IFlashSaleSession[]; total_count?: number; message?: string }> {
    try {
      const res = await ApiService.get(
        `/api/flash-sale/list?id_ecommerce=${idEcommerce}&type=${type}&offset=${offset}&limit=${limit}`
      );
      if (res && res.status) {
        return {
          status: true,
          data: Array.isArray(res.data) ? res.data : [],
          total_count: res.total_count || (Array.isArray(res.data) ? res.data.length : 0),
        };
      }
      return {
        status: false,
        data: [],
        message: res?.message || 'Gagal mengambil daftar sesi',
      };
    } catch (error: any) {
      console.error('[FlashSaleService] Error fetching session list:', error);
      return {
        status: false,
        data: [],
        message: error.message || 'Gagal mengambil sesi',
      };
    }
  }

  /**
   * Fetch items in a specific Shopee Flash Sale session
   */
  static async getSessionItems(
    flashSaleId: number,
    idEcommerce: number
  ): Promise<{ status: boolean; data: IFlashSaleSessionItem[]; message?: string }> {
    try {
      const res = await ApiService.get(`/api/flash-sale/${flashSaleId}/items?id_ecommerce=${idEcommerce}`);
      if (res && res.status) {
        return {
          status: true,
          data: Array.isArray(res.data) ? res.data : [],
        };
      }
      return {
        status: false,
        data: [],
        message: res?.message || 'Gagal mengambil item sesi',
      };
    } catch (error: any) {
      console.error('[FlashSaleService] Error fetching session items:', error);
      return {
        status: false,
        data: [],
        message: error.message || 'Gagal mengambil item sesi',
      };
    }
  }

  /**
   * Update flash price & stock allocation for items in an active/draft session
   */
  static async updateSessionItems(
    flashSaleId: number,
    items: Array<{ item_id: number | string; flash_price: number; stock_allocated: number }>
  ): Promise<{ status: boolean; reason?: string; failure_list?: IShopeeRejection[]; message?: string }> {
    try {
      const res = await ApiService.post(`/api/flash-sale/${flashSaleId}/update-items`, {
        items,
      });
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error updating session items:', error);
      return {
        status: false,
        reason: error.message || 'Gagal memperbarui item sesi',
      };
    }
  }

  /**
   * Delete / cancel a Flash Sale session in Shopee
   */
  static async deleteFlashSaleSession(
    flashSaleId: number,
    idEcommerce: number
  ): Promise<{ status: boolean; reason?: string; message?: string }> {
    try {
      const res = await ApiService.delete(`/api/flash-sale/${flashSaleId}?id_ecommerce=${idEcommerce}`, {});
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error deleting session:', error);
      return {
        status: false,
        reason: error.message || 'Gagal membatalkan sesi',
      };
    }
  }

  /**
   * Fetch list of items registered for recurring Auto Flash Sale
   */
  static async getAutoFlashSaleList(
    idEcommerce: number
  ): Promise<{ status: boolean; data: IAutoFlashSaleItem[]; message?: string }> {
    try {
      const res = await ApiService.get(`/api/flash-sale/auto/list?id_ecommerce=${idEcommerce}`);
      if (res && res.status) {
        return {
          status: true,
          data: Array.isArray(res.data) ? res.data : [],
        };
      }
      return {
        status: false,
        data: [],
        message: res?.message || 'Gagal mengambil daftar auto flash sale',
      };
    } catch (error: any) {
      console.error('[FlashSaleService] Error fetching auto list:', error);
      return {
        status: false,
        data: [],
        message: error.message || 'Gagal mengambil konfigurasi otomatis',
      };
    }
  }

  /**
   * Delete items from recurring Auto Flash Sale list
   */
  static async deleteAutoFlashSaleItems(
    idEcommerce: number,
    ids: number[]
  ): Promise<{ status: boolean; message?: string; reason?: string }> {
    try {
      const res = await ApiService.post('/api/flash-sale/auto/delete', {
        id_ecommerce: idEcommerce,
        ids,
      });
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error deleting auto items:', error);
      return {
        status: false,
        reason: error.message || 'Gagal menghapus item konfigurasi otomatis',
      };
    }
  }

  /**
   * Trigger immediate background auto sync for selected shop
   */
  static async triggerAutoSync(
    idEcommerce: number
  ): Promise<{ status: boolean; message?: string; reason?: string }> {
    try {
      const res = await ApiService.post('/api/flash-sale/trigger', {
        id_ecommerce: idEcommerce,
      });
      return res;
    } catch (error: any) {
      console.error('[FlashSaleService] Error triggering auto sync:', error);
      return {
        status: false,
        reason: error.message || 'Gagal menjalankan sync otomatis',
      };
    }
  }
}

export default FlashSaleService;
