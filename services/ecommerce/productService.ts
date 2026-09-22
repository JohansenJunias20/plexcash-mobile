import ApiService from '../api';

/**
 * Product Service
 * Handles fetching and managing product data for E-commerce Chat
 */

// ============================================
// INTERFACES
// ============================================

export interface IProduct {
  id: number | string; // Variant-group rows from the paged endpoint use a "v-<id>" string id
  product_id?: string;
  nama: string; // Product name
  sku: string;
  picture?: string; // Image URL
  hargajual?: number; // Selling price (undefined = not applicable, e.g. a variant group)
  stok?: number; // Stock quantity (undefined = not applicable, e.g. a variant group)
  merk?: string; // Brand
  kategori?: string; // Category
}

export interface IProductImage {
  id_import: number;
  image_url: string;
}

export interface IProductResponse {
  status: boolean;
  data: {
    barang: any[]; // Raw product data from API
    image: IProductImage[]; // Product images
  };
  message?: string;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Fetch products for a specific ecommerce platform
 * @param idEcommerce - The ecommerce platform ID
 * @returns Promise with status and product data
 */
export const fetchProducts = async (idEcommerce: number): Promise<{
  status: boolean;
  data: IProduct[];
  message?: string;
}> => {
  try {
    console.log('📦 [ProductService] Fetching products for idEcommerce:', idEcommerce);

    const response: IProductResponse = await ApiService.authenticatedRequest(
      `/get/import_barang?display_picture=1&id_ecommerce=${idEcommerce}`
    );

    console.log('📡 [ProductService] API Response:', {
      status: response.status,
      productCount: response.data?.barang?.length || 0,
      imageCount: response.data?.image?.length || 0,
    });

    if (!response.status) {
      console.error('❌ [ProductService] Failed to fetch products:', response.message);
      return {
        status: false,
        data: [],
        message: response.message || 'Failed to fetch products',
      };
    }

    // Transform and map images to products
    const products: IProduct[] = response.data.barang.map((product: any) => {
      // Find matching image for this product
      const productImage = response.data.image.find(
        (img: IProductImage) => img.id_import === product.id
      );

      return {
        id: product.id,
        product_id: product.product_id || product.id?.toString(),
        nama: product.nama || 'Unnamed Product',
        sku: product.sku || '',
        picture: productImage?.image_url || '',
        hargajual: product.hargajual || 0,
        stok: product.stok || 0,
        merk: product.merk || '',
        kategori: product.kategori || '',
      };
    });

    console.log('✅ [ProductService] Products fetched successfully:', {
      count: products.length,
      firstProduct: products[0] ? {
        id: products[0].id,
        nama: products[0].nama,
        has_image: !!products[0].picture,
      } : null,
    });

    return {
      status: true,
      data: products,
    };
  } catch (error: any) {
    console.error('❌ [ProductService] Error fetching products:', {
      error: error.message,
      stack: error.stack,
    });
    return {
      status: false,
      data: [],
      message: error.message || 'Unknown error occurred',
    };
  }
};

export interface IProductPagedResult {
  status: boolean;
  data: IProduct[];
  total: number;
  message?: string;
}

/**
 * Fetch a page of products for a specific ecommerce platform, with optional
 * server-side search by name/SKU. Backed by the paginated `/get/import_barang_paged`
 * endpoint (also used by the master product screen), so large catalogs (10k+ items)
 * don't need to be fetched all at once.
 * @param idEcommerce - The ecommerce platform ID
 * @param page - 1-based page number
 * @param pageSize - Number of items per page
 * @param search - Optional search term, matched against product name and SKU
 */
export const fetchProductsPaged = async (
  idEcommerce: number,
  page: number,
  pageSize: number,
  search?: string
): Promise<IProductPagedResult> => {
  try {
    const params = new URLSearchParams();
    params.append('id_ecommerce', String(idEcommerce));
    params.append('page', String(page));
    params.append('pageSize', String(pageSize));
    params.append('sort', JSON.stringify([{ field: 'nama', sort: 'asc' }]));

    const query = search?.trim();
    if (query) {
      // field 'nama' already matches against both product name and SKU server-side
      params.append('filter', JSON.stringify({ items: [{ field: 'nama', value: query }] }));
    }

    const response = await ApiService.get(`/get/import_barang_paged?${params.toString()}`);

    if (!response?.status) {
      return {
        status: false,
        data: [],
        total: 0,
        message: response?.reason || 'Failed to fetch products',
      };
    }

    const rows = response.data?.rows || [];
    const products: IProduct[] = rows.map((row: any) => {
      // Variant-group rows (row_type === 'VAR_PARENT') don't carry a single
      // stok/harga_jual of their own (the API sends 0 as a placeholder) —
      // treat those as "not applicable" instead of showing a misleading
      // Rp 0 / Out of Stock for a product that may well have stock.
      const isVariantGroup = row.row_type === 'VAR_PARENT';
      return {
        id: row.id,
        product_id: row.product_id?.toString() ?? row.id?.toString(),
        nama: row.nama || 'Unnamed Product',
        sku: row.sku || '',
        picture: row.imageUrl || '',
        hargajual: isVariantGroup ? undefined : (row.harga_jual || 0),
        stok: isVariantGroup ? undefined : (row.stok || 0),
      };
    });

    return { status: true, data: products, total: response.data?.total || 0 };
  } catch (error: any) {
    console.error('❌ [ProductService] Error fetching paged products:', {
      error: error.message,
      stack: error.stack,
    });
    return {
      status: false,
      data: [],
      total: 0,
      message: error.message || 'Unknown error occurred',
    };
  }
};

/**
 * Format price to Indonesian Rupiah format
 * @param price - Price in number
 * @returns Formatted price string
 */
export const formatPrice = (price?: number): string => {
  if (!price || price === 0) return '';
  return `Rp ${price.toLocaleString('id-ID')}`;
};

/**
 * Format stock quantity
 * @param stock - Stock quantity
 * @returns Formatted stock string
 */
export const formatStock = (stock?: number): string => {
  if (stock === undefined || stock === null) return 'N/A';
  if (stock === 0) return 'Out of Stock';
  return `${stock} pcs`;
};

