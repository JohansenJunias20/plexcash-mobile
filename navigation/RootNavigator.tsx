import React from 'react';
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
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import LabelPreviewScreen from '../screens/orders/LabelPreviewScreen';
import ScanOutScreen from '../screens/scanout/ScanOutScreen';
import { View, ActivityIndicator } from 'react-native';

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
  OrderDetail: { id: string; id_ecommerce: number };
  LabelPreview: { html: string; title?: string };
  ScanOut: undefined;
};

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const LoadingScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator size="large" />
  </View>
);

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator>
        <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      </AuthStack.Navigator>
    );
  }

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
      <AppStack.Screen name="OrdersList" component={OrdersListScreen} options={{ title: 'Pesanan' }} />
      <AppStack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Detail Pesanan' }} />
      <AppStack.Screen name="LabelPreview" component={LabelPreviewScreen} options={{ title: 'Label Preview' }} />
      <AppStack.Screen name="ScanOut" component={ScanOutScreen} options={{ title: 'Scan Out' }} />
    </AppStack.Navigator>
  );
}

