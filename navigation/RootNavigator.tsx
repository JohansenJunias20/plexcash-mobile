import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../components/LoginScreen';
import MainScreen from '../components/MainScreen';
import BarangListScreen from '../screens/barang/BarangListScreen';
import BarangEditScreen from '../screens/barang/BarangEditScreen';
import KartustokScreen from '../screens/barang/KartustokScreen';
import StockDetailsScreen from '../screens/barang/StockDetailsScreen';
import BulkBarcodeScreen from '../screens/barang/BulkBarcodeScreen';
import NewOnlineScreen from '../screens/barang/NewOnlineScreen';
import SupplierListScreen from '../screens/supplier/SupplierListScreen';
import SupplierEditScreen from '../screens/supplier/SupplierEditScreen';
import CustomerListScreen from '../screens/customer/CustomerListScreen';
import CustomerEditScreen from '../screens/customer/CustomerEditScreen';
import OrdersListScreen from '../screens/orders/OrdersListScreen';
import PesananV2Screen from '../screens/ecommerce/PesananV2Screen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import LabelPreviewScreen from '../screens/orders/LabelPreviewScreen';
import ScanOutScreen from '../screens/scanout/ScanOutScreen';
import POSKasirScreen from '../screens/pos/POSKasirScreen';
import DiskonScreen from '../screens/ecommerce/Diskon/DiskonScreen';
import UserListScreen from '../screens/user/UserListScreen';
import UserEditScreen from '../screens/user/UserEditScreen';
import BundlingListScreen from '../screens/bundling/BundlingListScreen';
import BundlingEditScreen from '../screens/bundling/BundlingEditScreen';
import StokOpnameScreen from '../screens/stokopname/StokOpnameScreen';
import Settingscreen from '../screens/Settingscreen';
import PembelianRincianScreen from '../screens/transaksi/pembelian/PembelianRincianScreen';
import PembelianHutangScreen from '../screens/transaksi/pembelian/PembelianHutangScreen';
import PembelianPelunasanScreen from '../screens/transaksi/pembelian/PembelianPelunasanScreen';
import PerangkatListScreen from '../screens/perangkat/PerangkatListScreen';
import PerangkatConfigScreen from '../screens/perangkat/PerangkatConfigScreen';
import KesehatanTokoScreen from '../screens/ecommerce/KesehatanTokoScreen';
import FlashSaleScreen from '../screens/ecommerce/FlashSale/FlashSaleScreen';
import CreateFlashSaleScreen from '../screens/ecommerce/FlashSale/CreateFlashSaleScreen';
import EcommerceChatDetailScreen from '../screens/ecommerce/EcommerceChatDetailScreen';
import { View, ActivityIndicator } from 'react-native';
import { logNavigation, logStateChange } from '../utils/logger';

export type AppStackParamList = {
  MainHome: undefined;
  BarangList: undefined;
  BarangEdit: { id: number } | undefined;
  Kartustok: { id: number };
  StockDetails: { id: number };
  BulkBarcode: undefined;
  NewOnline: { id: number };
  SupplierList: undefined;
  SupplierEdit: { id: number } | undefined;
  CustomerList: undefined;
  CustomerEdit: { id: number } | undefined;
  OrdersList: undefined;
  PesananV2: undefined;
  OrderDetail: {
    id: string;
    id_ecommerce: number;
    scan_timestamp?: string | null;
    print_timestamp?: string;
    print?: boolean;
    scanned?: boolean;
    packed?: boolean;
    pack_timestamp?: string | null;
    booking_sn?: string;
    buyer_username?: string;
    buyer_id?: string | number;
    platform?: string;
    ecommerce_name?: string;
    shop_id?: string;
    order_status?: string;
    has_penjualan?: boolean;
    has_retur?: boolean;
    source?: string;
    // Pre-fetched kilat order data (from booking cache) to avoid blank detail screen
    kilat_order_data?: {
      buyer_username?: string;
      buyer_city?: string;
      nama_kurir?: string;
      no_resi?: string;
      tanggal_order?: string;
      total_harga?: number;
      ecommerce_name?: string;
      platform?: string;
      status?: string;
      items?: { sku: string; nama: string; qty: number; harga_jual?: number }[];
    };
  };
  LabelPreview: { html?: string; pdfUrl?: string; title?: string };
  ScanOut: undefined;
  POSKasir: undefined;
  UserList: undefined;
  UserEdit: { email: string } | undefined;
  BundlingList: undefined;
  BundlingEdit: { id: number } | undefined;
  StokOpname: undefined;
  Settingscreen: undefined;
  PembelianRincian: { id: number };
  PembelianHutang: { detailId?: number } | undefined;
  PembelianPelunasan: { id?: string; ids?: string; id_pembelian?: number; id_supplier?: number } | undefined;
  PerangkatList: undefined;
  PerangkatConfig: { client_id: string; desktop_name: string };
  DiskonScreen: undefined;
  KesehatanToko: undefined;
  FlashSale: { shopId?: number } | undefined;
  CreateFlashSale: { id_ecommerce: number; shop_name?: string };
  EcommerceChatDetail: {
    msgId: string;
    idEcommerce: number;
    buyer: any;
    platform: string;
    shopName?: string;
  };
};

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const LoadingScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator size="large" />
  </View>
);

export default function RootNavigator() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Log every render to track navigation state changes
  useEffect(() => {
    logNavigation('🧭 RootNavigator rendered/updated', {
      isLoading,
      isAuthenticated,
      hasUser: !!user,
      userEmail: user?.email || 'none'
    });

    // Force a small delay to ensure state has propagated
    if (isAuthenticated && !isLoading) {
      logNavigation('✅ Authentication complete - MainScreen should be visible');
    }
  }, [isAuthenticated, isLoading, user]);

  logNavigation('🧭 RootNavigator render cycle', { isLoading, isAuthenticated });
  console.log('🧭 [NAVIGATOR] RootNavigator render - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    logNavigation('⏳ Showing loading screen');
    console.log('🧭 [NAVIGATOR] Showing loading screen');
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    logNavigation('🔒 User NOT authenticated - showing LoginScreen');
    console.log('🧭 [NAVIGATOR] User NOT authenticated - showing LoginScreen');
    return (
      <AuthStack.Navigator>
        <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      </AuthStack.Navigator>
    );
  }

  logNavigation('✅ User IS authenticated - showing MainScreen');
  console.log('🧭 [NAVIGATOR] User IS authenticated - showing MainScreen');

  // const Drawer = createDrawerNavigator();

  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#f59e0b',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        statusBarStyle: 'light',
        statusBarTranslucent: false,
      }}
    > 
      <AppStack.Screen name="MainHome" component={MainScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="BarangList" component={BarangListScreen} options={{ title: 'Barang' }} />
      <AppStack.Screen name="BarangEdit" component={BarangEditScreen} options={{ title: 'Edit Barang' }} />
      <AppStack.Screen name="Kartustok" component={KartustokScreen} options={{ title: 'Kartu Stok' }} />
      <AppStack.Screen name="StockDetails" component={StockDetailsScreen} options={{ title: 'Warehouse Details' }} />
      <AppStack.Screen name="BulkBarcode" component={BulkBarcodeScreen} options={{ title: 'Bulk Barcode' }} />
      <AppStack.Screen name="NewOnline" component={NewOnlineScreen} options={{ title: 'Online' }} />
      <AppStack.Screen name="SupplierList" component={SupplierListScreen} options={{ title: 'Supplier' }} />
      <AppStack.Screen name="SupplierEdit" component={SupplierEditScreen} options={{ title: 'Supplier' }} />
      <AppStack.Screen name="CustomerList" component={CustomerListScreen} options={{ title: 'Customer' }} />
      <AppStack.Screen name="CustomerEdit" component={CustomerEditScreen} options={{ title: 'Customer' }} />
      <AppStack.Screen name="UserList" component={UserListScreen} options={{ title: 'User Management' }} />
      <AppStack.Screen name="UserEdit" component={UserEditScreen} options={{ title: 'User Permissions' }} />
      <AppStack.Screen name="OrdersList" component={OrdersListScreen} options={{ title: 'Pesanan' }} />
      <AppStack.Screen name="PesananV2" component={PesananV2Screen} options={{ headerShown: false }} />
      <AppStack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Detail Pesanan' }} />
      <AppStack.Screen name="LabelPreview" component={LabelPreviewScreen} options={{ title: 'Label Preview' }} />
      <AppStack.Screen name="ScanOut" component={ScanOutScreen} options={{ title: 'Scan Out' }} />
      <AppStack.Screen name="POSKasir" component={POSKasirScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="DiskonScreen" component={DiskonScreen} options={{ title: 'Diskon' }} />
      <AppStack.Screen name="BundlingList" component={BundlingListScreen} options={{ title: 'Bundling' }} />
      <AppStack.Screen name="BundlingEdit" component={BundlingEditScreen} options={{ title: 'Bundling' }} />
      <AppStack.Screen name="StokOpname" component={StokOpnameScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="Settingscreen" component={Settingscreen} options={{ headerShown: false }} />
      <AppStack.Screen name="PembelianRincian" component={PembelianRincianScreen} options={{ title: 'Rincian Pembelian' }} />
      <AppStack.Screen name="PembelianHutang" component={PembelianHutangScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="PembelianPelunasan" component={PembelianPelunasanScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="PerangkatList" component={PerangkatListScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="PerangkatConfig" component={PerangkatConfigScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="KesehatanToko" component={KesehatanTokoScreen} options={{ title: 'Kesehatan Toko' }} />
      <AppStack.Screen name="FlashSale" component={FlashSaleScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="CreateFlashSale" component={CreateFlashSaleScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="EcommerceChatDetail" component={EcommerceChatDetailScreen} options={{ headerShown: false }} />
    </AppStack.Navigator>
  );
}

