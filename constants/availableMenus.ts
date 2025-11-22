import { Ionicons } from '@expo/vector-icons';

export interface MenuItem {
  id: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  category: string;
}

export const AVAILABLE_MENUS: MenuItem[] = [
  // POS
  { id: 'POSKasir', label: 'POS Kasir', subtitle: 'Point of Sale', icon: 'cash-outline', route: 'POSKasir', category: 'POS' },
  
  // MASTER
  { id: 'BarangList', label: 'Barang', subtitle: 'Kelola Items', icon: 'cube-outline', route: 'BarangList', category: 'MASTER' },
  { id: 'SupplierList', label: 'Supplier', subtitle: 'Kelola Supplier', icon: 'briefcase-outline', route: 'SupplierList', category: 'MASTER' },
  { id: 'CustomerList', label: 'Customer', subtitle: 'Kelola Customer', icon: 'people-outline', route: 'CustomerList', category: 'MASTER' },
  { id: 'SatuanList', label: 'Satuan', subtitle: 'Unit Management', icon: 'scale-outline', route: 'SatuanList', category: 'MASTER' },
  { id: 'BaganAkunList', label: 'Bagan Akun', subtitle: 'Chart of Accounts', icon: 'calculator-outline', route: 'BaganAkunList', category: 'MASTER' },
  { id: 'UserList', label: 'User', subtitle: 'Manage Users', icon: 'people-outline', route: 'UserList', category: 'MASTER' },
  { id: 'UploadScreen', label: 'Upload', subtitle: 'Upload Files', icon: 'cloud-upload-outline', route: 'UploadScreen', category: 'MASTER' },
  { id: 'BundlingList', label: 'Bundling', subtitle: 'Paket Produk', icon: 'albums-outline', route: 'BundlingList', category: 'MASTER' },
  { id: 'ImportBarang', label: 'Import', subtitle: 'Import Data', icon: 'download-outline', route: 'ImportBarang', category: 'MASTER' },
  { id: 'WarehouseList', label: 'Warehouse', subtitle: 'Warehouse Management', icon: 'business-outline', route: 'WarehouseList', category: 'MASTER' },
  
  // TRANSAKSI - Pembelian
  { id: 'PembelianTambah', label: 'Pembelian Tambah', subtitle: 'Tambah Pembelian', icon: 'add-circle-outline', route: 'PembelianTambah', category: 'TRANSAKSI' },
  { id: 'PembelianSearch', label: 'Pembelian Search', subtitle: 'Cari Pembelian', icon: 'search-outline', route: 'PembelianSearch', category: 'TRANSAKSI' },
  { id: 'PembelianPelunasan', label: 'Pembelian Pelunasan', subtitle: 'Pelunasan Pembelian', icon: 'cash-outline', route: 'PembelianPelunasan', category: 'TRANSAKSI' },
  { id: 'PembelianRetur', label: 'Pembelian Retur', subtitle: 'Retur Pembelian', icon: 'return-down-back-outline', route: 'PembelianRetur', category: 'TRANSAKSI' },
  { id: 'PembelianDPBeli', label: 'Pembelian DP', subtitle: 'DP Pembelian', icon: 'card-outline', route: 'PembelianDPBeli', category: 'TRANSAKSI' },
  
  // TRANSAKSI - Penjualan
  { id: 'PenjualanTambah', label: 'Penjualan Tambah', subtitle: 'Tambah Penjualan', icon: 'add-circle-outline', route: 'PenjualanTambah', category: 'TRANSAKSI' },
  { id: 'PenjualanSearch', label: 'Penjualan Search', subtitle: 'Cari Penjualan', icon: 'search-outline', route: 'PenjualanSearch', category: 'TRANSAKSI' },
  { id: 'PenjualanPelunasan', label: 'Penjualan Pelunasan', subtitle: 'Pelunasan Penjualan', icon: 'cash-outline', route: 'PenjualanPelunasan', category: 'TRANSAKSI' },
  { id: 'PenjualanRetur', label: 'Penjualan Retur', subtitle: 'Retur Penjualan', icon: 'return-down-back-outline', route: 'PenjualanRetur', category: 'TRANSAKSI' },
  
  // TRANSAKSI - Jurnal
  { id: 'JurnalTambah', label: 'Jurnal Tambah', subtitle: 'Tambah Jurnal', icon: 'add-circle-outline', route: 'JurnalTambah', category: 'TRANSAKSI' },
  { id: 'JurnalSearch', label: 'Jurnal Search', subtitle: 'Cari Jurnal', icon: 'search-outline', route: 'JurnalSearch', category: 'TRANSAKSI' },
  
  // TRANSAKSI - Others
  { id: 'MutasiAkun', label: 'Mutasi Akun', subtitle: 'Account Mutation', icon: 'swap-horizontal-outline', route: 'MutasiAkun', category: 'TRANSAKSI' },
  { id: 'StokOpname', label: 'Stok Opname', subtitle: 'Stock Taking', icon: 'clipboard-outline', route: 'StokOpname', category: 'TRANSAKSI' },
  { id: 'PesanBarang', label: 'Pesan Barang', subtitle: 'Order Items', icon: 'cube-outline', route: 'PesanBarang', category: 'TRANSAKSI' },
  
  // ECOMMERCE
  { id: 'Pesanan', label: 'Pesanan', subtitle: 'Ecommerce Orders', icon: 'cart-outline', route: 'Pesanan', category: 'ECOMMERCE' },
  { id: 'EcommerceChat', label: 'Chat', subtitle: 'Customer Chat', icon: 'chatbubbles-outline', route: 'EcommerceChat', category: 'ECOMMERCE' },
  { id: 'Notifikasi', label: 'Notifikasi', subtitle: 'Notifications', icon: 'notifications-outline', route: 'Notifikasi', category: 'ECOMMERCE' },
  { id: 'Penarikan', label: 'Penarikan', subtitle: 'Withdrawal', icon: 'wallet-outline', route: 'Penarikan', category: 'ECOMMERCE' },
  { id: 'ReturOnline', label: 'Retur Online', subtitle: 'Online Returns', icon: 'return-up-back-outline', route: 'ReturOnline', category: 'ECOMMERCE' },
  { id: 'BookingOrders', label: 'Booking Orders', subtitle: 'Booking Management', icon: 'airplane-outline', route: 'BookingOrders', category: 'ECOMMERCE' },
  { id: 'Integration', label: 'Integration', subtitle: 'Platform Integration', icon: 'git-network-outline', route: 'Integration', category: 'ECOMMERCE' },
  { id: 'EcommerceToolsProduct', label: 'Tools Produk', subtitle: 'Product Tools', icon: 'pricetag-outline', route: 'EcommerceToolsProduct', category: 'ECOMMERCE' },
  { id: 'NaikkanProduk', label: 'Naikkan Produk', subtitle: 'Boost Products', icon: 'arrow-up-outline', route: 'NaikkanProduk', category: 'ECOMMERCE' },
  { id: 'ProsesOtomatis', label: 'Proses Otomatis', subtitle: 'Automation', icon: 'cog-outline', route: 'ProsesOtomatis', category: 'ECOMMERCE' },
  { id: 'ScanOut', label: 'Scan Out', subtitle: 'Scan Shipping Labels', icon: 'scan-outline', route: 'ScanOut', category: 'ECOMMERCE' },
  
  // LAPORAN
  { id: 'Neraca', label: 'Neraca', subtitle: 'Balance Sheet', icon: 'stats-chart-outline', route: 'Neraca', category: 'LAPORAN' },
  { id: 'LabaRugi', label: 'Laba Rugi', subtitle: 'Profit & Loss', icon: 'trending-up-outline', route: 'LabaRugi', category: 'LAPORAN' },
  { id: 'LaporanBarang', label: 'Laporan Barang', subtitle: 'Item Reports', icon: 'bar-chart-outline', route: 'LaporanBarang', category: 'LAPORAN' },
  { id: 'Iklan', label: 'Iklan', subtitle: 'Advertising', icon: 'megaphone-outline', route: 'Iklan', category: 'LAPORAN' },
  
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

