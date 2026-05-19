import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  NativeModules,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';
import ApiService from '../services/api';


interface DrawerItemProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  badge?: string;
  nested?: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const DrawerItem: React.FC<DrawerItemProps> = ({ label, icon, onPress, active, badge, nested }) => (
  <TouchableOpacity
    style={[
      styles.drawerItem,
      active && styles.drawerItemActive,
      nested && styles.drawerItemNested,
    ]}
    onPress={onPress}
  >
    <View style={styles.drawerItemLeft}>
      <Ionicons
        name={icon}
        size={nested ? 18 : 22}
        color={active ? '#f3f4f6' : nested ? '#9CA3AF' : '#6B7280'}
        style={styles.drawerItemIcon}
      />
      <Text
        style={[
          styles.drawerItemLabel,
          active && styles.drawerItemLabelActive,
          nested && styles.drawerItemLabelNested,
        ]}
      >
        {label}
      </Text>
    </View>
    {badge && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.collapsibleSection}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.collapsibleHeaderLeft}>
          <Ionicons name={icon} size={22} color="#6B7280" style={styles.drawerItemIcon} />
          <Text style={styles.collapsibleHeaderText}>{title}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>
      {expanded && <View style={styles.collapsibleContent}>{children}</View>}
    </View>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

interface CustomDrawerContentProps {
  navigation: any;
  state: any;
}

const CustomDrawerContent: React.FC<CustomDrawerContentProps> = ({ navigation, state }) => {
  const { user } = useAuth();
  const { access, role, isLoading: accessLoading } = useAccess();
  const a = access as any;
  const [currentDatabase, setCurrentDatabase] = useState<string>('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingDatabase, setLoadingDatabase] = useState(true);
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [switchingDatabase, setSwitchingDatabase] = useState(false);
  const [dbSearch, setDbSearch] = useState('');

  const ADMIN_EMAILS = ['johansen.junias17@gmail.com', 'josoft.josoft@gmail.com'];
  const isAdmin = ADMIN_EMAILS.includes((user as any)?.email);
  const isAdminRole = isAdmin || role === 'admin';
  const currentRoute = state.routes[state.index]?.name;

  /** Helper to strictly check boolean-like values */
  const checkAccess = (val: any): boolean => {
    if (isAdminRole) return true;
    if (val === undefined || val === null || val === false || val === 0 || val === '0' || val === '') return false;
    if (typeof val === 'string' && val.toLowerCase() === 'false') return false;
    return !!val;
  };

  /** Mirror of web Sidebar's hasAnyTrue — returns true if obj or any nested value is true */
  const hasAnyTrue = (obj: any): boolean => {
    if (isAdminRole) return true;
    if (!obj) return false;
    if (typeof obj === 'object') {
      return Object.values(obj).some((val) => hasAnyTrue(val));
    }
    return checkAccess(obj);
  };

  useEffect(() => {
    const fetchDatabaseInfo = async () => {
      try {
        setLoadingDatabase(true);
        const dbResponse = await ApiService.getCurrentDatabase();
        if (dbResponse.status && dbResponse.data) {
          setCurrentDatabase(dbResponse.data);
        }

        const listResponse = await ApiService.getDatabaseList();
        if (listResponse.status && listResponse.data) {
          setDatabases(listResponse.data);
        }
      } catch (error) {
        console.error('Error fetching database info:', error);
      } finally {
        setLoadingDatabase(false);
      }
    };

    fetchDatabaseInfo();
  }, [isAdmin]);

  const handleDatabaseSwitch = async (newDatabase: string) => {
    if (newDatabase === currentDatabase) {
      setShowDatabasePicker(false);
      return;
    }

    try {
      setSwitchingDatabase(true);
      const response = await ApiService.setDatabase(newDatabase);

      if (response.status) {
        setCurrentDatabase(newDatabase);
        setShowDatabasePicker(false);
        Alert.alert(
          'Database Switched', 
          `Successfully switched to: ${newDatabase}`,
          [{
            text: 'OK',
            onPress: async () => {
              try {
                if (__DEV__ && NativeModules.DevSettings && NativeModules.DevSettings.reload) {
                  NativeModules.DevSettings.reload();
                } else {
                  await Updates.reloadAsync();
                }
              } catch (e) {
                console.error('Failed to reload app:', e);
              }
            }
          }]
        );
      }
    } catch (error) {
      console.error('Error switching database:', error);
    } finally {
      setSwitchingDatabase(false);
    }
  };

  if (accessLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DrawerContentScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="person-circle" size={56} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Welcome Back!</Text>
              <Text style={styles.headerSubtitle}>{(user as any)?.email || 'Guest'}</Text>
            </View>
          </View>
        </View>

        {/* Home - always visible */}
        <DrawerItem
          label="Home"
          icon="home"
          onPress={() => navigation.navigate('Main')}
          active={currentRoute === 'Main'}
        />

      {/* MASTER Section - only if user has any master access */}
      {hasAnyTrue(a?.master) && <SectionHeader title="MASTER" />}
      {checkAccess(a?.master?.barang) && <DrawerItem label="Barang" icon="cube" onPress={() => navigation.navigate('BarangList')} active={currentRoute === 'BarangList'} />}
      {checkAccess(a?.master?.supplier) && <DrawerItem label="Supplier" icon="briefcase" onPress={() => navigation.navigate('SupplierList')} active={currentRoute === 'SupplierList'} />}
      {checkAccess(a?.master?.customer) && <DrawerItem label="Customer" icon="people" onPress={() => navigation.navigate('CustomerList')} active={currentRoute === 'CustomerList'} />}
      {checkAccess(a?.master?.satuan) && <DrawerItem label="Satuan" icon="scale" onPress={() => navigation.navigate('SatuanList')} active={currentRoute === 'SatuanList'} />}
      {checkAccess(a?.master?.baganakun) && <DrawerItem label="Bagan Akun" icon="calculator" onPress={() => navigation.navigate('BaganAkunList')} active={currentRoute === 'BaganAkunList'} />}
      {checkAccess(a?.master?.user) && <DrawerItem label="User" icon="person" onPress={() => navigation.navigate('UserList')} active={currentRoute === 'UserList'} />}
      {checkAccess(a?.master?.upload) && <DrawerItem label="Upload" icon="cloud-upload" onPress={() => navigation.navigate('UploadScreen')} active={currentRoute === 'UploadScreen'} />}
      {checkAccess(a?.master?.bundling) && <DrawerItem label="Bundling" icon="albums" onPress={() => navigation.navigate('BundlingList')} active={currentRoute === 'BundlingList'} />}
      {checkAccess(a?.master?.import_barang) && <DrawerItem label="Import" icon="download" onPress={() => navigation.navigate('ImportBarang')} active={currentRoute === 'ImportBarang'} />}
      {checkAccess(a?.master?.warehouse) && <DrawerItem label="Warehouse" icon="business" onPress={() => navigation.navigate('WarehouseList')} active={currentRoute === 'WarehouseList'} badge="NEW" />}

      {/* TRANSAKSI Section */}
      {(() => {
        // Debugging the access object for the specific issue the user is reporting
        if (a) {
          console.log("=== DEBUG AKSES ===");
          console.log(JSON.stringify(a, null, 2));
        }
        return hasAnyTrue(a?.transaksi) ? <SectionHeader title="TRANSAKSI" /> : null;
      })()}

      {/* Pembelian - Collapsible, only if any pembelian sub-access */}
      {(checkAccess(a?.transaksi?.pembelian?.tambah) || checkAccess(a?.transaksi?.pembelian?.search) || checkAccess(a?.transaksi?.pembelian?.pelunasan) || checkAccess(a?.transaksi?.pembelian?.retur) || checkAccess(a?.transaksi?.pembelian?.dp_beli) || checkAccess(a?.transaksi?.pembelian?.preorder) || checkAccess(a?.transaksi?.pembelian?.hutang)) && (
        <CollapsibleSection title="Pembelian" icon="cart">
          {checkAccess(a?.transaksi?.pembelian?.tambah) && <DrawerItem label="Tambah" icon="add-circle" onPress={() => navigation.navigate('PembelianTambah')} active={currentRoute === 'PembelianTambah'} nested />}
          {checkAccess(a?.transaksi?.pembelian?.search) && <DrawerItem label="Search" icon="search" onPress={() => navigation.navigate('PembelianSearch')} active={currentRoute === 'PembelianSearch'} nested />}
          {checkAccess(a?.transaksi?.pembelian?.pelunasan) && <DrawerItem label="Pelunasan" icon="cash" onPress={() => navigation.navigate('PembelianPelunasan')} active={currentRoute === 'PembelianPelunasan'} nested />}
          {checkAccess(a?.transaksi?.pembelian?.retur) && <DrawerItem label="Retur" icon="return-down-back" onPress={() => navigation.navigate('PembelianRetur')} active={currentRoute === 'PembelianRetur'} nested />}
          {checkAccess(a?.transaksi?.pembelian?.dp_beli) && <DrawerItem label="DP Beli" icon="card" onPress={() => navigation.navigate('PembelianDPBeli')} active={currentRoute === 'PembelianDPBeli'} nested />}
          {checkAccess(a?.transaksi?.pembelian?.preorder) && <DrawerItem label="Pre Order" icon="calendar" onPress={() => navigation.navigate('PreOrder')} active={currentRoute === 'PreOrder'} nested />}
          {checkAccess(a?.transaksi?.pembelian?.hutang) && <DrawerItem label="Hutang" icon="wallet" onPress={() => Alert.alert('Segera Hadir', 'Fitur Hutang Pembelian sedang dalam pengembangan.')} active={false} nested badge="Soon" />}
        </CollapsibleSection>
      )}

      {/* Penjualan - Collapsible */}
      {(checkAccess(a?.transaksi?.penjualan?.tambah) || checkAccess(a?.transaksi?.penjualan?.search) || checkAccess(a?.transaksi?.penjualan?.pelunasan) || checkAccess(a?.transaksi?.penjualan?.retur) || checkAccess(a?.transaksi?.penjualan?.pos_kasir) || checkAccess(a?.transaksi?.penjualan?.dpjual) || checkAccess(a?.transaksi?.penjualan?.piutang) || checkAccess(a?.transaksi?.penjualan?.post_print)) && (
        <CollapsibleSection title="Penjualan" icon="cash-outline">
          {checkAccess(a?.transaksi?.penjualan?.tambah) && <DrawerItem label="Tambah" icon="add-circle" onPress={() => navigation.navigate('PenjualanTambah')} active={currentRoute === 'PenjualanTambah'} nested />}
          {checkAccess(a?.transaksi?.penjualan?.search) && <DrawerItem label="Search" icon="search" onPress={() => navigation.navigate('PenjualanSearch')} active={currentRoute === 'PenjualanSearch'} nested />}
          {checkAccess(a?.transaksi?.penjualan?.pelunasan) && <DrawerItem label="Pelunasan" icon="cash" onPress={() => navigation.navigate('PenjualanPelunasan')} active={currentRoute === 'PenjualanPelunasan'} nested />}
          {checkAccess(a?.transaksi?.penjualan?.retur) && <DrawerItem label="Retur" icon="return-down-back" onPress={() => navigation.navigate('PenjualanRetur')} active={currentRoute === 'PenjualanRetur'} nested />}
          {checkAccess(a?.transaksi?.penjualan?.pos_kasir) && <DrawerItem label="POS Kasir" icon="print" onPress={() => navigation.navigate('POSKasir')} active={currentRoute === 'POSKasir'} nested />}
          {checkAccess(a?.transaksi?.penjualan?.dpjual) && <DrawerItem label="DP Jual" icon="card" onPress={() => Alert.alert('Segera Hadir', 'Fitur DP Penjualan sedang dalam pengembangan.')} active={false} nested badge="Soon" />}
          {checkAccess(a?.transaksi?.penjualan?.piutang) && <DrawerItem label="Piutang" icon="wallet" onPress={() => Alert.alert('Segera Hadir', 'Fitur Piutang Penjualan sedang dalam pengembangan.')} active={false} nested badge="Soon" />}
        </CollapsibleSection>
      )}

      {/* Jurnal - Collapsible */}
      {(checkAccess(a?.transaksi?.jurnal?.tambah) || checkAccess(a?.transaksi?.jurnal?.search) || checkAccess(a?.transaksi?.jurnal?.biaya)) && (
        <CollapsibleSection title="Jurnal" icon="book">
          {checkAccess(a?.transaksi?.jurnal?.tambah) && <DrawerItem label="Tambah" icon="add-circle" onPress={() => navigation.navigate('JurnalTambah')} active={currentRoute === 'JurnalTambah'} nested />}
          {checkAccess(a?.transaksi?.jurnal?.search) && <DrawerItem label="Search" icon="search" onPress={() => navigation.navigate('JurnalSearch')} active={currentRoute === 'JurnalSearch'} nested />}
          {checkAccess(a?.transaksi?.jurnal?.biaya) && <DrawerItem label="Biaya" icon="cash" onPress={() => Alert.alert('Segera Hadir', 'Fitur Jurnal Biaya sedang dalam tahap pengembangan untuk aplikasi mobile.')} active={false} nested badge="Soon" />}
        </CollapsibleSection>
      )}

      {checkAccess(a?.transaksi?.detailbaganakun) && <DrawerItem label="Mutasi Akun" icon="swap-horizontal" onPress={() => navigation.navigate('MutasiAkun')} active={currentRoute === 'MutasiAkun'} />}
      {checkAccess(a?.transaksi?.stokopname) && <DrawerItem label="Stok Opname" icon="clipboard" onPress={() => navigation.navigate('StokOpname')} active={currentRoute === 'StokOpname'} />}
      {checkAccess(a?.transaksi?.pesanbarang) && <DrawerItem label="Pesan Barang" icon="cube" onPress={() => navigation.navigate('PesanBarang')} active={currentRoute === 'PesanBarang'} />}

      {/* ECOMMERCE Section */}
      {hasAnyTrue(a?.ecommerce) && <SectionHeader title="ECOMMERCE" />}
      {checkAccess(a?.ecommerce?.diskon) && <DrawerItem label="Diskon & Promo" icon="pricetag-outline" onPress={() => navigation.navigate('DiskonScreen')} active={currentRoute === 'DiskonScreen'} />}
      {checkAccess(a?.ecommerce?.pesanan) && <DrawerItem label="Pesanan" icon="list" onPress={() => navigation.navigate('Pesanan')} active={currentRoute === 'Pesanan'} />}
      {checkAccess(a?.ecommerce?.pesanan) && <DrawerItem label="Pesanan V2" icon="list-circle" onPress={() => navigation.navigate('PesananV2')} active={currentRoute === 'PesananV2'} badge="NEW" />}
      {checkAccess(a?.ecommerce?.ecommerce_chat) && <DrawerItem label="Chat" icon="chatbubbles" onPress={() => navigation.navigate('EcommerceChat')} active={currentRoute === 'EcommerceChat'} />}
      {checkAccess(a?.ecommerce?.notifikasi) && <DrawerItem label="Notifikasi" icon="notifications" onPress={() => navigation.navigate('Notifikasi')} active={currentRoute === 'Notifikasi'} />}
      {checkAccess(a?.ecommerce?.penarikan) && <DrawerItem label="Penarikan" icon="wallet" onPress={() => navigation.navigate('Penarikan')} active={currentRoute === 'Penarikan'} />}
      {checkAccess(a?.ecommerce?.returonline) && <DrawerItem label="Retur Online" icon="return-up-back" onPress={() => navigation.navigate('ReturOnline')} active={currentRoute === 'ReturOnline'} />}
      {checkAccess(a?.ecommerce?.booking_orders) && <DrawerItem label="Booking Orders" icon="airplane" onPress={() => navigation.navigate('BookingOrders')} active={currentRoute === 'BookingOrders'} badge="NEW" />}
      {checkAccess(a?.ecommerce?.integration) && <DrawerItem label="Integration" icon="git-network" onPress={() => navigation.navigate('Integration')} active={currentRoute === 'Integration'} />}

      {/* Ecommerce Tools - Collapsible */}
      {checkAccess(a?.ecommerce?.ecommerce_tools?.product) && (
        <CollapsibleSection title="Tools" icon="construct">
          {checkAccess(a?.ecommerce?.ecommerce_tools?.product) && <DrawerItem label="Produk" icon="pricetag" onPress={() => navigation.navigate('EcommerceToolsProduct')} active={currentRoute === 'EcommerceToolsProduct'} nested />}
        </CollapsibleSection>
      )}

      {checkAccess(a?.ecommerce?.naikkan_produk) && <DrawerItem label="Naikkan Produk" icon="arrow-up" onPress={() => navigation.navigate('NaikkanProduk')} active={currentRoute === 'NaikkanProduk'} />}
      {checkAccess(a?.ecommerce?.proses_otomatis) && <DrawerItem label="Proses Otomatis" icon="cog" onPress={() => navigation.navigate('ProsesOtomatis')} active={currentRoute === 'ProsesOtomatis'} />}
      {checkAccess(a?.ecommerce?.scanout) && <DrawerItem label="Scan Out" icon="scan" onPress={() => navigation.navigate('ScanOut')} active={currentRoute === 'ScanOut'} />}
      {checkAccess(a?.ecommerce?.scanin) && <DrawerItem label="Scan In" icon="scan" onPress={() => navigation.navigate('ScanIn')} active={currentRoute === 'ScanIn'} />}
      {checkAccess(a?.ecommerce?.scanout) && <DrawerItem label="Cari by Scan" icon="search-circle" onPress={() => navigation.navigate('ScanSearch')} active={currentRoute === 'ScanSearch'} />}

      {/* LAPORAN Section */}
      {hasAnyTrue(a?.laporan) && <SectionHeader title="LAPORAN" />}
      {checkAccess(a?.laporan?.neraca) && <DrawerItem label="Neraca" icon="stats-chart" onPress={() => navigation.navigate('Neraca')} active={currentRoute === 'Neraca'} />}
      {checkAccess(a?.laporan?.labarugi) && <DrawerItem label="Laba Rugi" icon="trending-up" onPress={() => navigation.navigate('LabaRugi')} active={currentRoute === 'LabaRugi'} />}
      {checkAccess(a?.laporan?.laporanbarang) && <DrawerItem label="Laporan Barang" icon="bar-chart" onPress={() => navigation.navigate('LaporanBarang')} active={currentRoute === 'LaporanBarang'} />}
      {checkAccess(a?.laporan?.iklan) && <DrawerItem label="Iklan" icon="megaphone" onPress={() => navigation.navigate('Iklan')} active={currentRoute === 'Iklan'} />}
      {checkAccess(a?.laporan?.perangkat) && <DrawerItem label="Perangkat WinForms" icon="desktop-outline" onPress={() => navigation.navigate('PerangkatList')} active={currentRoute === 'PerangkatList'} />}

      {/* SETTING Section - always visible */}
      <SectionHeader title="SETTING" />
      <DrawerItem label="Settings" icon="settings" onPress={() => navigation.navigate('Setting')} active={currentRoute === 'Setting'} />

      </DrawerContentScrollView>

      {/* Database Selector at Bottom */}
      {(isAdmin || databases.length > 1) && (
        <View style={styles.databaseSelectorBottom}>
          <TouchableOpacity
            style={styles.databaseSelector}
            onPress={() => setShowDatabasePicker(true)}
            disabled={loadingDatabase}
          >
            <Ionicons name="server" size={20} color="#f59e0b" />
            <View style={styles.databaseSelectorText}>
              <Text style={styles.databaseSelectorLabel}>Database</Text>
              <Text style={styles.databaseSelectorValue}>
                {loadingDatabase ? 'Loading...' : currentDatabase || 'Unknown'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Database Picker Modal */}
      {(isAdmin || databases.length > 1) && (
        <Modal
          visible={showDatabasePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => { setShowDatabasePicker(false); setDbSearch(''); }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Switch Database</Text>
                <TouchableOpacity onPress={() => { setShowDatabasePicker(false); setDbSearch(''); }}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.dbSearchContainer}>
                <Ionicons name="search" size={18} color="#9CA3AF" style={styles.dbSearchIcon} />
                <TextInput
                  style={styles.dbSearchInput}
                  placeholder="Cari database..."
                  placeholderTextColor="#9CA3AF"
                  value={dbSearch}
                  onChangeText={setDbSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {dbSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setDbSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {switchingDatabase ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#f59e0b" />
                  <Text style={styles.loadingText}>Switching database...</Text>
                </View>
              ) : (
                <ScrollView style={styles.databaseList}>
                  {databases
                    .filter(db => db.toLowerCase().includes(dbSearch.toLowerCase()))
                    .map((db) => (
                    <TouchableOpacity
                      key={db}
                      style={[
                        styles.databaseItem,
                        db === currentDatabase && styles.databaseItemActive,
                      ]}
                      onPress={() => handleDatabaseSwitch(db)}
                    >
                      <View style={styles.databaseItemLeft}>
                        <Ionicons
                          name="server"
                          size={20}
                          color={db === currentDatabase ? '#f59e0b' : '#6B7280'}
                        />
                        <Text
                          style={[
                            styles.databaseItemText,
                            db === currentDatabase && styles.databaseItemTextActive,
                          ]}
                        >
                          {db}
                        </Text>
                      </View>
                      {db === currentDatabase && (
                        <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                      )}
                    </TouchableOpacity>
                  ))}
                  {databases.filter(db => db.toLowerCase().includes(dbSearch.toLowerCase())).length === 0 && (
                    <View style={styles.dbSearchEmpty}>
                      <Ionicons name="search-outline" size={32} color="#D1D5DB" />
                      <Text style={styles.dbSearchEmptyText}>Tidak ada database "{dbSearch}"</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#f59e0b',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  databaseSelectorBottom: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
  },
  databaseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  databaseSelectorText: {
    flex: 1,
    marginLeft: 10,
  },
  databaseSelectorLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  databaseSelectorValue: {
    fontSize: 14,
    color: '#78350F',
    marginTop: 2,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
  },
  drawerItemActive: {
    backgroundColor: '#f59e0b',
  },
  drawerItemNested: {
    paddingLeft: 48,
    paddingVertical: 10,
  },
  drawerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerItemIcon: {
    marginRight: 12,
  },
  drawerItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  drawerItemLabelActive: {
    color: '#f3f4f6',
  },
  drawerItemLabelNested: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  badge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  collapsibleSection: {
    marginVertical: 2,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collapsibleHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  collapsibleContent: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  databaseList: {
    maxHeight: 400,
  },
  dbSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dbSearchIcon: { marginRight: 8 },
  dbSearchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 0 },
  dbSearchEmpty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  dbSearchEmptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  databaseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  databaseItemActive: {
    backgroundColor: '#FEF3C7',
  },
  databaseItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  databaseItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  databaseItemTextActive: {
    color: '#f59e0b',
    fontWeight: '600',
  },
});

export default CustomDrawerContent;

