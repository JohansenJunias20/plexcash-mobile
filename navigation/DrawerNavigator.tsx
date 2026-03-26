import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import CustomDrawerContent from './CustomDrawerContent';
import LoginScreen from '../components/LoginScreen';
import MainScreen from '../components/MainScreen';
import BarangListScreen from '../screens/barang/BarangListScreen';
import BarangEditScreen from '../screens/barang/BarangEditScreen';
import KartustokScreen from '../screens/barang/KartustokScreen';
import StockDetailsScreen from '../screens/barang/StockDetailsScreen';
import BulkBarcodeScreen from '../screens/barang/BulkBarcodeScreen';
import NewOnlineScreen from '../screens/barang/NewOnlineScreen';
import POSKasirScreen from '../screens/pos/POSKasirScreen';
import OrdersListScreen from '../screens/orders/OrdersListScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import LabelPreviewScreen from '../screens/orders/LabelPreviewScreen';
import ScanOutScreen from '../screens/scanout/ScanOutScreen';
import ScanInScreen from '../screens/scanin/ScanInScreen';
import ScanSearchScreen from '../screens/scanout/ScanSearchScreen';
import UserListScreen from '../screens/user/UserListScreen';
import UserEditScreen from '../screens/user/UserEditScreen';
import BundlingListScreen from '../screens/bundling/BundlingListScreen';
import BundlingEditScreen from '../screens/bundling/BundlingEditScreen';
import StokOpnameScreen from '../screens/stokopname/StokOpnameScreen';
import Settingscreen from '../screens/Settingscreen';

// MASTER Section Imports
import SupplierListScreen from '../screens/supplier/SupplierListScreen';
import SupplierEditScreen from '../screens/supplier/SupplierEditScreen';
import CustomerListScreen from '../screens/customer/CustomerListScreen';
import CustomerEditScreen from '../screens/customer/CustomerEditScreen';
import SatuanListScreen from '../screens/master/SatuanListScreen';
import BaganAkunListScreen from '../screens/master/BaganAkunListScreen';
import UploadScreen from '../screens/master/UploadScreen';
import ImportBarangScreen from '../screens/master/ImportBarangScreen';
import WarehouseListScreen from '../screens/master/WarehouseListScreen';

// TRANSAKSI Section - Pembelian
import PembelianTambahScreen from '../screens/transaksi/pembelian/PembelianTambahScreen';
import PembelianSearchScreen from '../screens/transaksi/pembelian/PembelianSearchScreen';
import PembelianRincianScreen from '../screens/transaksi/pembelian/PembelianRincianScreen';
import PembelianPelunasanScreen from '../screens/transaksi/pembelian/PembelianPelunasanScreen';
import PembelianReturScreen from '../screens/transaksi/pembelian/PembelianReturScreen';
import PembelianDPBeliScreen from '../screens/transaksi/pembelian/PembelianDPBeliScreen';
import PreOrderScreen from '../screens/transaksi/PreOrderScreen';

// TRANSAKSI Section - Penjualan
import PenjualanTambahScreen from '../screens/transaksi/penjualan/PenjualanTambahScreen';
import PenjualanSearchScreen from '../screens/transaksi/penjualan/PenjualanSearchScreen';
import PenjualanRincianScreen from '../screens/transaksi/penjualan/PenjualanRincianScreen';
import PenjualanPelunasanScreen from '../screens/transaksi/penjualan/PenjualanPelunasanScreen';
import PenjualanReturScreen from '../screens/transaksi/penjualan/PenjualanReturScreen';

// TRANSAKSI Section - Jurnal
import JurnalTambahScreen from '../screens/transaksi/jurnal/JurnalTambahScreen';
import JurnalSearchScreen from '../screens/transaksi/jurnal/JurnalSearchScreen';

// TRANSAKSI Section - Others
import MutasiAkunScreen from '../screens/transaksi/MutasiAkunScreen';
import PesanBarangScreen from '../screens/transaksi/PesanBarangScreen';

// ECOMMERCE Section
import EcommerceChatScreen from '../screens/ecommerce/EcommerceChatScreen';
import EcommerceChatDetailScreen from '../screens/ecommerce/EcommerceChatDetailScreen';
import NotifikasiScreen from '../screens/ecommerce/NotifikasiScreen';
import PenarikanScreen from '../screens/ecommerce/PenarikanScreen';
import ReturOnlineScreen from '../screens/ecommerce/ReturOnlineScreen';
import BookingOrdersScreen from '../screens/ecommerce/BookingOrdersScreen';
import IntegrationScreen from '../screens/ecommerce/IntegrationScreen';
import EcommerceToolsProductScreen from '../screens/ecommerce/tools/EcommerceToolsProductScreen';
import NaikkanProdukScreen from '../screens/ecommerce/NaikkanProdukScreen';
import BoostProdukScreen from '../screens/ecommerce/BoostProdukScreen';
import ProsesOtomatisScreen from '../screens/ecommerce/ProsesOtomatisScreen';
import ProsesOtomatisConfigScreen from '../screens/ecommerce/ProsesOtomatisConfigScreen';

// LAPORAN Section
import NeracaScreen from '../screens/laporan/NeracaScreen';
import LabaRugiScreen from '../screens/laporan/LabaRugiScreen';
import LaporanBarangScreen from '../screens/laporan/LaporanBarangScreen';
import IklanScreen from '../screens/laporan/IklanScreen';
import PerangkatListScreen from '../screens/perangkat/PerangkatListScreen';
import PerangkatConfigScreen from '../screens/perangkat/PerangkatConfigScreen';

const Drawer = createDrawerNavigator();
const AuthStack = createNativeStackNavigator();

// Create Stack Navigators for list→detail screen groups
const BarangStack = createNativeStackNavigator();
const SupplierStack = createNativeStackNavigator();
const CustomerStack = createNativeStackNavigator();
const UserStack = createNativeStackNavigator();
const BundlingStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();
const EcommerceChatStack = createNativeStackNavigator();
const NaikkanProdukStack = createNativeStackNavigator();
const ProsesOtomatisStack = createNativeStackNavigator();
const PerangkatStack = createNativeStackNavigator();
const PembelianStack = createNativeStackNavigator();
const PenjualanStack = createNativeStackNavigator();

const LoadingScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937' }}>
    <ActivityIndicator size="large" color="#f59e0b" />
  </View>
);

// Stack Navigator Components
const BarangStackScreen = () => (
  <BarangStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <BarangStack.Screen name="BarangListMain" component={BarangListScreen} />
    <BarangStack.Screen name="BarangEdit" component={BarangEditScreen} />
    <BarangStack.Screen name="Kartustok" component={KartustokScreen} />
    <BarangStack.Screen name="StockDetails" component={StockDetailsScreen} />
    <BarangStack.Screen name="BulkBarcode" component={BulkBarcodeScreen} />
    <BarangStack.Screen name="NewOnline" component={NewOnlineScreen} />
  </BarangStack.Navigator>
);

const SupplierStackScreen = () => (
  <SupplierStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <SupplierStack.Screen name="SupplierListMain" component={SupplierListScreen} />
    <SupplierStack.Screen name="SupplierEdit" component={SupplierEditScreen} />
  </SupplierStack.Navigator>
);

const CustomerStackScreen = () => (
  <CustomerStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <CustomerStack.Screen name="CustomerListMain" component={CustomerListScreen} />
    <CustomerStack.Screen name="CustomerEdit" component={CustomerEditScreen} />
  </CustomerStack.Navigator>
);

const UserStackScreen = () => (
  <UserStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <UserStack.Screen name="UserListMain" component={UserListScreen} />
    <UserStack.Screen name="UserEdit" component={UserEditScreen} />
  </UserStack.Navigator>
);

const BundlingStackScreen = () => (
  <BundlingStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <BundlingStack.Screen name="BundlingListMain" component={BundlingListScreen} />
    <BundlingStack.Screen name="BundlingEdit" component={BundlingEditScreen} />
  </BundlingStack.Navigator>
);

const OrdersStackScreen = () => (
  <OrdersStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <OrdersStack.Screen name="OrdersListMain" component={OrdersListScreen} />
    <OrdersStack.Screen name="OrderDetail" component={OrderDetailScreen} />
    <OrdersStack.Screen name="LabelPreview" component={LabelPreviewScreen} />
  </OrdersStack.Navigator>
);

const EcommerceChatStackScreen = () => (
  <EcommerceChatStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <EcommerceChatStack.Screen name="EcommerceChatMain" component={EcommerceChatScreen} />
    <EcommerceChatStack.Screen name="EcommerceChatDetail" component={EcommerceChatDetailScreen} />
  </EcommerceChatStack.Navigator>
);

const NaikkanProdukStackScreen = () => (
  <NaikkanProdukStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <NaikkanProdukStack.Screen name="NaikkanProdukMain" component={NaikkanProdukScreen} />
    <NaikkanProdukStack.Screen name="BoostProduk" component={BoostProdukScreen} />
  </NaikkanProdukStack.Navigator>
);

const ProsesOtomatisStackScreen = () => (
  <ProsesOtomatisStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <ProsesOtomatisStack.Screen name="ProsesOtomatisMain" component={ProsesOtomatisScreen} />
    <ProsesOtomatisStack.Screen name="ProsesOtomatisConfig" component={ProsesOtomatisConfigScreen} />
  </ProsesOtomatisStack.Navigator>
);

const PerangkatStackScreen = () => (
  <PerangkatStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <PerangkatStack.Screen name="PerangkatListMain" component={PerangkatListScreen} />
    <PerangkatStack.Screen name="PerangkatConfig" component={PerangkatConfigScreen} />
  </PerangkatStack.Navigator>
);

const PembelianStackScreen = () => (
  <PembelianStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <PembelianStack.Screen name="PembelianSearchMain" component={PembelianSearchScreen} />
    <PembelianStack.Screen name="PembelianRincian" component={PembelianRincianScreen} />
  </PembelianStack.Navigator>
);

const PenjualanStackScreen = () => (
  <PenjualanStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <PenjualanStack.Screen name="PenjualanSearchMain" component={PenjualanSearchScreen} />
    <PenjualanStack.Screen name="PenjualanRincian" component={PenjualanRincianScreen} />
  </PenjualanStack.Navigator>
);

const DrawerNavigatorContent = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 280,
        },
      }}
    >
      {/* Home */}
      <Drawer.Screen name="Main" component={MainScreen} />

      {/* POS Kasir */}
      <Drawer.Screen name="POSKasir" component={POSKasirScreen} />

      {/* MASTER Section - Using Stack Navigators */}
      <Drawer.Screen name="BarangList" component={BarangStackScreen} />
      <Drawer.Screen name="SupplierList" component={SupplierStackScreen} />
      <Drawer.Screen name="CustomerList" component={CustomerStackScreen} />
      <Drawer.Screen name="SatuanList" component={SatuanListScreen} />
      <Drawer.Screen name="BaganAkunList" component={BaganAkunListScreen} />
      <Drawer.Screen name="UserList" component={UserStackScreen} />
      <Drawer.Screen name="UploadScreen" component={UploadScreen} />
      <Drawer.Screen name="BundlingList" component={BundlingStackScreen} />
      <Drawer.Screen name="ImportBarang" component={ImportBarangScreen} />
      <Drawer.Screen name="WarehouseList" component={WarehouseListScreen} />

      {/* TRANSAKSI Section - Pembelian - Using Stack Navigator */}
      <Drawer.Screen name="PembelianTambah" component={PembelianTambahScreen} />
      <Drawer.Screen name="PembelianSearch" component={PembelianStackScreen} />
      <Drawer.Screen name="PembelianPelunasan" component={PembelianPelunasanScreen} />
      <Drawer.Screen name="PembelianRetur" component={PembelianReturScreen} />
      <Drawer.Screen name="PembelianDPBeli" component={PembelianDPBeliScreen} />
      <Drawer.Screen name="PreOrder" component={PreOrderScreen} />

      {/* TRANSAKSI Section - Penjualan - Using Stack Navigator */}
      <Drawer.Screen name="PenjualanTambah" component={PenjualanTambahScreen} />
      <Drawer.Screen name="PenjualanSearch" component={PenjualanStackScreen} />
      <Drawer.Screen name="PenjualanPelunasan" component={PenjualanPelunasanScreen} />
      <Drawer.Screen name="PenjualanRetur" component={PenjualanReturScreen} />

      {/* TRANSAKSI Section - Jurnal */}
      <Drawer.Screen name="JurnalTambah" component={JurnalTambahScreen} />
      <Drawer.Screen name="JurnalSearch" component={JurnalSearchScreen} />

      {/* TRANSAKSI Section - Others */}
      <Drawer.Screen name="MutasiAkun" component={MutasiAkunScreen} />
      <Drawer.Screen name="StokOpname" component={StokOpnameScreen} />
      <Drawer.Screen name="PesanBarang" component={PesanBarangScreen} />

      {/* ECOMMERCE Section - Using Stack Navigators */}
      <Drawer.Screen name="Pesanan" component={OrdersStackScreen} />
      <Drawer.Screen name="EcommerceChat" component={EcommerceChatStackScreen} />
      <Drawer.Screen name="Notifikasi" component={NotifikasiScreen} />
      <Drawer.Screen name="Penarikan" component={PenarikanScreen} />
      <Drawer.Screen name="ReturOnline" component={ReturOnlineScreen} />
      <Drawer.Screen name="BookingOrders" component={BookingOrdersScreen} />
      <Drawer.Screen name="Integration" component={IntegrationScreen} />
      <Drawer.Screen name="EcommerceToolsProduct" component={EcommerceToolsProductScreen} />
      <Drawer.Screen name="NaikkanProduk" component={NaikkanProdukStackScreen} />
      <Drawer.Screen name="ProsesOtomatis" component={ProsesOtomatisStackScreen} />

      {/* LAPORAN Section - Using Stack Navigator for Perangkat */}
      <Drawer.Screen name="Neraca" component={NeracaScreen} />
      <Drawer.Screen name="LabaRugi" component={LabaRugiScreen} />
      <Drawer.Screen name="LaporanBarang" component={LaporanBarangScreen} />
      <Drawer.Screen name="Iklan" component={IklanScreen} />
      <Drawer.Screen name="PerangkatList" component={PerangkatStackScreen} />

      {/* SETTING Section */}
      <Drawer.Screen name="Setting" component={Settingscreen} />

      {/* Scan Out, Scan In & Scan Search - Special */}
      <Drawer.Screen name="ScanOut" component={ScanOutScreen} />
      <Drawer.Screen name="ScanIn" component={ScanInScreen} />
      <Drawer.Screen name="ScanSearch" component={ScanSearchScreen} />
    </Drawer.Navigator>
  );
};

export default function DrawerNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('🧭 [DRAWER-NAVIGATOR] Render - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    console.log('🧭 [DRAWER-NAVIGATOR] Showing loading screen');
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    console.log('🧭 [DRAWER-NAVIGATOR] User NOT authenticated - showing LoginScreen');
    return (
      <AuthStack.Navigator>
        <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      </AuthStack.Navigator>
    );
  }

  console.log('🧭 [DRAWER-NAVIGATOR] User IS authenticated - showing DrawerNavigator');
  return <DrawerNavigatorContent />;
}