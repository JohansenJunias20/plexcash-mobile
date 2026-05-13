import { Ionicons } from '@expo/vector-icons';

export interface MenuItem {
  id: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  category: string;
  /**
   * Dot-notation path into the AccessPermissions object.
   * e.g. "master.barang", "transaksi.pembelian.tambah", "ecommerce.scanout"
   * Leave undefined for menus that are always visible (e.g. Home, Settings app-level).
   */
  accessKey?: string;
}

export const AVAILABLE_MENUS: MenuItem[] = [
  // POS
  { id: 'POSKasir', label: 'POS Kasir', subtitle: 'Point of Sale', icon: 'cash-outline', route: 'POSKasir', category: 'POS', accessKey: 'transaksi.penjualan.pos_kasir' },

  // MASTER
  { id: 'BarangList', label: 'Barang', subtitle: 'Kelola Items', icon: 'cube-outline', route: 'BarangList', category: 'MASTER', accessKey: 'master.barang' },
  { id: 'SupplierList', label: 'Supplier', subtitle: 'Kelola Supplier', icon: 'briefcase-outline', route: 'SupplierList', category: 'MASTER', accessKey: 'master.supplier' },
  { id: 'CustomerList', label: 'Customer', subtitle: 'Kelola Customer', icon: 'people-outline', route: 'CustomerList', category: 'MASTER', accessKey: 'master.customer' },
  { id: 'SatuanList', label: 'Satuan', subtitle: 'Unit Management', icon: 'scale-outline', route: 'SatuanList', category: 'MASTER', accessKey: 'master.satuan' },
  { id: 'BaganAkunList', label: 'Bagan Akun', subtitle: 'Chart of Accounts', icon: 'calculator-outline', route: 'BaganAkunList', category: 'MASTER', accessKey: 'master.baganakun' },
  { id: 'UserList', label: 'User', subtitle: 'Manage Users', icon: 'people-outline', route: 'UserList', category: 'MASTER', accessKey: 'master.user' },
  { id: 'UploadScreen', label: 'Upload', subtitle: 'Upload Files', icon: 'cloud-upload-outline', route: 'UploadScreen', category: 'MASTER', accessKey: 'master.upload' },
  { id: 'BundlingList', label: 'Bundling', subtitle: 'Paket Produk', icon: 'albums-outline', route: 'BundlingList', category: 'MASTER', accessKey: 'master.bundling' },
  { id: 'ImportBarang', label: 'Import', subtitle: 'Import Data', icon: 'download-outline', route: 'ImportBarang', category: 'MASTER', accessKey: 'master.import_barang' },
  { id: 'WarehouseList', label: 'Warehouse', subtitle: 'Warehouse Management', icon: 'business-outline', route: 'WarehouseList', category: 'MASTER', accessKey: 'master.warehouse' },

  // TRANSAKSI - Pembelian
  { id: 'PembelianTambah', label: 'Pembelian Tambah', subtitle: 'Tambah Pembelian', icon: 'add-circle-outline', route: 'PembelianTambah', category: 'TRANSAKSI', accessKey: 'transaksi.pembelian.tambah' },
  { id: 'PembelianSearch', label: 'Pembelian Search', subtitle: 'Cari Pembelian', icon: 'search-outline', route: 'PembelianSearch', category: 'TRANSAKSI', accessKey: 'transaksi.pembelian.search' },
  { id: 'PembelianPelunasan', label: 'Pembelian Pelunasan', subtitle: 'Pelunasan Pembelian', icon: 'cash-outline', route: 'PembelianPelunasan', category: 'TRANSAKSI', accessKey: 'transaksi.pembelian.pelunasan' },
  { id: 'PembelianRetur', label: 'Pembelian Retur', subtitle: 'Retur Pembelian', icon: 'return-down-back-outline', route: 'PembelianRetur', category: 'TRANSAKSI', accessKey: 'transaksi.pembelian.retur' },
  { id: 'PembelianDPBeli', label: 'Pembelian DP', subtitle: 'DP Pembelian', icon: 'card-outline', route: 'PembelianDPBeli', category: 'TRANSAKSI', accessKey: 'transaksi.pembelian.dp_beli' },
  { id: 'PreOrder', label: 'Pre Order', subtitle: 'Pre Order', icon: 'calendar-outline', route: 'PreOrder', category: 'TRANSAKSI', accessKey: 'transaksi.pembelian.preorder' },

  // TRANSAKSI - Penjualan
  { id: 'PenjualanTambah', label: 'Penjualan Tambah', subtitle: 'Tambah Penjualan', icon: 'add-circle-outline', route: 'PenjualanTambah', category: 'TRANSAKSI', accessKey: 'transaksi.penjualan.tambah' },
  { id: 'PenjualanSearch', label: 'Penjualan Search', subtitle: 'Cari Penjualan', icon: 'search-outline', route: 'PenjualanSearch', category: 'TRANSAKSI', accessKey: 'transaksi.penjualan.search' },
  { id: 'PenjualanPelunasan', label: 'Penjualan Pelunasan', subtitle: 'Pelunasan Penjualan', icon: 'cash-outline', route: 'PenjualanPelunasan', category: 'TRANSAKSI', accessKey: 'transaksi.penjualan.pelunasan' },
  { id: 'PenjualanRetur', label: 'Penjualan Retur', subtitle: 'Retur Penjualan', icon: 'return-down-back-outline', route: 'PenjualanRetur', category: 'TRANSAKSI', accessKey: 'transaksi.penjualan.retur' },

  // TRANSAKSI - Jurnal
  { id: 'JurnalTambah', label: 'Jurnal Tambah', subtitle: 'Tambah Jurnal', icon: 'add-circle-outline', route: 'JurnalTambah', category: 'TRANSAKSI', accessKey: 'transaksi.jurnal.tambah' },
  { id: 'JurnalSearch', label: 'Jurnal Search', subtitle: 'Cari Jurnal', icon: 'search-outline', route: 'JurnalSearch', category: 'TRANSAKSI', accessKey: 'transaksi.jurnal.search' },

  // TRANSAKSI - Others
  { id: 'MutasiAkun', label: 'Mutasi Akun', subtitle: 'Account Mutation', icon: 'swap-horizontal-outline', route: 'MutasiAkun', category: 'TRANSAKSI', accessKey: 'transaksi.detailbaganakun' },
  { id: 'StokOpname', label: 'Stok Opname', subtitle: 'Stock Taking', icon: 'clipboard-outline', route: 'StokOpname', category: 'TRANSAKSI', accessKey: 'transaksi.stokopname' },
  { id: 'PesanBarang', label: 'Pesan Barang', subtitle: 'Order Items', icon: 'cube-outline', route: 'PesanBarang', category: 'TRANSAKSI', accessKey: 'transaksi.pesanbarang' },

  // ECOMMERCE
  { id: 'DiskonScreen', label: 'Diskon & Promo', subtitle: 'Promo & Harga Coret', icon: 'pricetag-outline', route: 'DiskonScreen', category: 'ECOMMERCE', accessKey: 'ecommerce.diskon' },
  { id: 'Pesanan', label: 'Pesanan', subtitle: 'Ecommerce Orders', icon: 'cart-outline', route: 'Pesanan', category: 'ECOMMERCE', accessKey: 'ecommerce.pesanan' },
  { id: 'EcommerceChat', label: 'Chat', subtitle: 'Customer Chat', icon: 'chatbubbles-outline', route: 'EcommerceChat', category: 'ECOMMERCE', accessKey: 'ecommerce.ecommerce_chat' },
  { id: 'Notifikasi', label: 'Notifikasi', subtitle: 'Notifications', icon: 'notifications-outline', route: 'Notifikasi', category: 'ECOMMERCE', accessKey: 'ecommerce.notifikasi' },
  { id: 'Penarikan', label: 'Penarikan', subtitle: 'Withdrawal', icon: 'wallet-outline', route: 'Penarikan', category: 'ECOMMERCE', accessKey: 'ecommerce.penarikan' },
  { id: 'ReturOnline', label: 'Retur Online', subtitle: 'Online Returns', icon: 'return-up-back-outline', route: 'ReturOnline', category: 'ECOMMERCE', accessKey: 'ecommerce.returonline' },
  { id: 'BookingOrders', label: 'Booking Orders', subtitle: 'Booking Management', icon: 'airplane-outline', route: 'BookingOrders', category: 'ECOMMERCE', accessKey: 'ecommerce.booking_orders' },
  { id: 'Integration', label: 'Integration', subtitle: 'Platform Integration', icon: 'git-network-outline', route: 'Integration', category: 'ECOMMERCE', accessKey: 'ecommerce.integration' },
  { id: 'EcommerceToolsProduct', label: 'Tools Produk', subtitle: 'Product Tools', icon: 'pricetag-outline', route: 'EcommerceToolsProduct', category: 'ECOMMERCE', accessKey: 'ecommerce.ecommerce_tools.product' },
  { id: 'NaikkanProduk', label: 'Naikkan Produk', subtitle: 'Boost Products', icon: 'arrow-up-outline', route: 'NaikkanProduk', category: 'ECOMMERCE', accessKey: 'ecommerce.naikkan_produk' },
  { id: 'ProsesOtomatis', label: 'Proses Otomatis', subtitle: 'Automation', icon: 'cog-outline', route: 'ProsesOtomatis', category: 'ECOMMERCE', accessKey: 'ecommerce.proses_otomatis' },
  { id: 'ScanOut', label: 'Scan Out', subtitle: 'Scan Shipping Labels', icon: 'scan-outline', route: 'ScanOut', category: 'ECOMMERCE', accessKey: 'ecommerce.scanout' },
  { id: 'ScanIn', label: 'Scan In', subtitle: 'Scan Returned Packages', icon: 'scan-outline', route: 'ScanIn', category: 'ECOMMERCE', accessKey: 'ecommerce.scanin' },
  { id: 'ScanSearch', label: 'Cari by Scan', subtitle: 'Search by Scan', icon: 'search-circle-outline', route: 'ScanSearch', category: 'ECOMMERCE', accessKey: 'ecommerce.scanout' },

  // LAPORAN
  { id: 'Neraca', label: 'Neraca', subtitle: 'Balance Sheet', icon: 'stats-chart-outline', route: 'Neraca', category: 'LAPORAN', accessKey: 'laporan.neraca' },
  { id: 'LabaRugi', label: 'Laba Rugi', subtitle: 'Profit & Loss', icon: 'trending-up-outline', route: 'LabaRugi', category: 'LAPORAN', accessKey: 'laporan.labarugi' },
  { id: 'LaporanBarang', label: 'Laporan Barang', subtitle: 'Item Reports', icon: 'bar-chart-outline', route: 'LaporanBarang', category: 'LAPORAN', accessKey: 'laporan.laporanbarang' },
  { id: 'Iklan', label: 'Iklan', subtitle: 'Advertising', icon: 'megaphone-outline', route: 'Iklan', category: 'LAPORAN', accessKey: 'laporan.iklan' },

  // SETTING
  { id: 'Setting', label: 'Setting', subtitle: 'App Configuration', icon: 'cog-outline', route: 'Setting', category: 'SETTING' },
];

export const DEFAULT_QUICK_ACTIONS: string[] = [
  'POSKasir',
  'BarangList',
  'Pesanan',
  'ScanOut',
  'UserList',
  'BundlingList',
  'StokOpname',
  'Setting',
];

export const MAX_QUICK_ACTIONS = 8;

/**
 * Resolve a dot-notation access key against the access object.
 * e.g. "master.barang" → access?.master?.barang
 */
export const resolveAccessKey = (access: Record<string, any>, key: string | undefined): boolean => {
  if (!key) return true; // No access key = always visible
  const parts = key.split('.');
  let current: any = access;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return false;
    current = current[part];
  }
  
  // Highly permissive truthy check, same as checkAccess in CustomDrawerContent
  if (current === undefined || current === null || current === false || current === 0 || current === '0' || current === '') return false;
  if (typeof current === 'string' && current.toLowerCase() === 'false') return false;
  return !!current;
};
