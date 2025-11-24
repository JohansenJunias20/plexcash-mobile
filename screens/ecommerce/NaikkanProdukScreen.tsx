import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { TabView, TabBar } from 'react-native-tab-view';
import ApiService from '../../services/api';
import Toast from '../../components/Toast';

const { width } = Dimensions.get('window');

// ==================== INTERFACES ====================
interface EcommerceAccount {
  id: number;
  platform: string;
  shop_id: string;
  status: 'PENDING' | 'EMAILED' | 'APPROVED' | 'EXPIRED';
  domain: string;
  name: string;
  authenticate_time?: string | null;
}

interface NaikkanProdukData {
  id: number;
  id_ecommerce: number;
  id_online: string;
  status: 'pending' | 'active' | 'selesai';
  time: number | null;
  platform?: string;
  shop_name?: string;
  shop_id?: string;
  product_name?: string | null;
  product_image?: string | null;
  product_sku?: string | null;
}

// ==================== HELPER FUNCTIONS ====================
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending': return '#ed6c02';
    case 'active': return '#0288d1';
    case 'selesai': return '#2e7d32';
    default: return '#9e9e9e';
  }
};

const getStatusIcon = (status: string): any => {
  switch (status) {
    case 'pending': return 'time-outline';
    case 'active': return 'trending-up-outline';
    case 'selesai': return 'checkmark-circle-outline';
    default: return 'help-circle-outline';
  }
};

const getPlatformColor = (platform: string): string => {
  const colors: { [key: string]: string } = {
    'SHOPEE': '#EE4D2D',
    'TOKOPEDIA': '#42B549',
    'LAZADA': '#0F156D',
    'TIKTOK': '#000000',
    'BLIBLI': '#0095DA',
  };
  return colors[platform] || '#757575';
};

const formatCooldownTime = (seconds: number | null): string => {
  if (seconds === null || seconds === 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

// ==================== MAIN COMPONENT ====================
export default function NaikkanProdukScreen() {
  const navigation = useNavigation();

  // State Management
  const [ecommerceAccounts, setEcommerceAccounts] = useState<EcommerceAccount[]>([]);
  const [naikkanProdukData, setNaikkanProdukData] = useState<NaikkanProdukData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedShopTab, setSelectedShopTab] = useState<string>('all');
  const [tabIndex, setTabIndex] = useState(0);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Tab routes for TabView
  const [routes, setRoutes] = useState([
    { key: 'all', title: 'Semua Toko' },
  ]);

  // ==================== API CALLS ====================
  const fetchEcommerceAccounts = async () => {
    try {
      const response = await ApiService.get('/get/ecommerce');
      if (response.status) {
        // Filter hanya yang APPROVED dan SHOPEE
        const shopeeApproved = response.data.filter(
          (acc: EcommerceAccount) => acc.status === 'APPROVED' && acc.platform === 'SHOPEE'
        );
        setEcommerceAccounts(shopeeApproved);

        // Update tab routes
        const newRoutes = [
          { key: 'all', title: 'Semua Toko' },
          ...shopeeApproved.map((acc: EcommerceAccount) => ({
            key: acc.shop_id,
            title: acc.name || acc.domain,
          })),
        ];
        setRoutes(newRoutes);
      }
    } catch (error) {
      console.error('Error fetching ecommerce accounts:', error);
      showToast('Gagal memuat akun marketplace', 'error');
    }
  };

  const fetchNaikkanProdukData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: 'active' });
      if (selectedShopTab !== 'all') {
        params.append('shop_id', selectedShopTab);
      }

      const response = await ApiService.get(`/get/boosted-products?${params.toString()}`);
      if (response.status) {
        setNaikkanProdukData(response.data);
      }
    } catch (error) {
      console.error('Error fetching naikkan produk data:', error);
      showToast('Gagal memuat data produk boost', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateBoostedList = async (accountId: number, shopId: string) => {
    try {
      setRefreshing(true);
      showToast('Memperbarui boosted list...', 'info');

      const response = await ApiService.get(
        `/get/shopee/boosted-list?shop_id=${shopId}&id_ecommerce=${accountId}`
      );

      if (response.status) {
        await fetchNaikkanProdukData();
        showToast('Boosted list berhasil diperbarui', 'success');
      } else {
        showToast(response.reason || 'Gagal memperbarui boosted list', 'error');
      }
    } catch (error) {
      console.error('Error updating boosted list:', error);
      showToast('Gagal memperbarui boosted list', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchEcommerceAccounts();
    fetchNaikkanProdukData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchNaikkanProdukData();
    }
  }, [selectedShopTab]);

  useFocusEffect(
    useCallback(() => {
      fetchNaikkanProdukData();
    }, [selectedShopTab])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEcommerceAccounts(), fetchNaikkanProdukData()]);
    setRefreshing(false);
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderStatsCard = (
    title: string,
    value: number,
    icon: any,
    color: string,
    borderColor: string
  ) => (
    <View style={[styles.statsCard, { borderLeftColor: borderColor }]}>
      <View style={styles.statsContent}>
        <View style={styles.statsTextContainer}>
          <Text style={styles.statsTitle}>{title}</Text>
          <Text style={[styles.statsValue, { color }]}>{value}</Text>
        </View>
        <Ionicons name={icon} size={40} color={color} style={styles.statsIcon} />
      </View>
    </View>
  );

  const renderAccountItem = ({ item }: { item: EcommerceAccount }) => (
    <View style={styles.accountCard}>
      <View style={styles.accountHeader}>
        <View style={[styles.platformBadge, { backgroundColor: getPlatformColor(item.platform) }]}>
          <Text style={styles.platformText}>{item.platform}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#2e7d32" />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.accountInfo}>
        <Text style={styles.accountName}>{item.name || item.domain}</Text>
        <Text style={styles.accountShopId}>Shop ID: {item.shop_id}</Text>
      </View>

      <TouchableOpacity
        style={styles.boostButton}
        onPress={() => {
          if (item.platform === 'SHOPEE') {
            updateBoostedList(item.id, item.shop_id);
          }
          // Navigate to boost page
          (navigation as any).navigate('BoostProduk', {
            shop_id: item.shop_id,
            id_ecommerce: item.id,
            platform: item.platform,
            shop_name: item.name || item.domain,
          });
        }}
      >
        <Ionicons name="trending-up" size={20} color="#fff" />
        <Text style={styles.boostButtonText}>Boost Produk</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBoostedProductItem = ({ item }: { item: NaikkanProdukData }) => (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={[styles.platformBadge, { backgroundColor: getPlatformColor(item.platform || '') }]}>
          <Text style={styles.platformText}>{item.platform}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusChipText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.product_name || '-'}
        </Text>
        {item.product_sku && (
          <Text style={styles.productSku}>SKU: {item.product_sku}</Text>
        )}
        <Text style={styles.productShop}>{item.shop_name || '-'}</Text>
      </View>

      <View style={styles.productFooter}>
        <View style={styles.productIdContainer}>
          <Ionicons name="pricetag-outline" size={14} color="#666" />
          <Text style={styles.productId}>{item.id_online}</Text>
        </View>
        <View style={styles.cooldownContainer}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.cooldownText}>{formatCooldownTime(item.time)}</Text>
        </View>
      </View>
    </View>
  );

  const renderTabScene = ({ route }: any) => {
    const filteredData = route.key === 'all'
      ? naikkanProdukData
      : naikkanProdukData.filter(item => item.shop_id === route.key);

    return (
      <ScrollView
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
          </View>
        ) : filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>Tidak ada produk yang di-boost</Text>
            <Text style={styles.emptySubtext}>Mulai boost produk untuk meningkatkan visibilitas</Text>
          </View>
        ) : (
          <View style={styles.listContent}>
            {filteredData.map((item) => (
              <View key={item.id}>
                {renderBoostedProductItem({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      scrollEnabled
      indicatorStyle={styles.tabIndicator}
      style={styles.tabBar}
      tabStyle={styles.tab}
      labelStyle={styles.tabLabel}
      activeColor="#f59e0b"
      inactiveColor="#6b7280"
    />
  );

  // ==================== MAIN RENDER ====================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation as any).openDrawer()}
          style={styles.menuButton}
        >
          <Ionicons name="menu" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Naikkan Produk</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f59e0b']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards - 2x2 Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {renderStatsCard('Total Toko', ecommerceAccounts.length, 'storefront', '#1976d2', '#1976d2')}
            {renderStatsCard(
              'Pending',
              naikkanProdukData.filter(d => d.status === 'pending').length,
              'time',
              '#ed6c02',
              '#ed6c02'
            )}
          </View>
          <View style={styles.statsRow}>
            {renderStatsCard(
              'Active',
              naikkanProdukData.filter(d => d.status === 'active').length,
              'trending-up',
              '#0288d1',
              '#0288d1'
            )}
            {renderStatsCard(
              'Selesai',
              naikkanProdukData.filter(d => d.status === 'selesai').length,
              'checkmark-circle',
              '#2e7d32',
              '#2e7d32'
            )}
          </View>
        </View>

        {/* Section: Akun Marketplace */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Akun Marketplace (APPROVED)</Text>
          {ecommerceAccounts.length === 0 ? (
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={24} color="#0288d1" />
              <Text style={styles.infoText}>
                Tidak ada akun marketplace yang approved. Silakan integrasikan akun marketplace terlebih dahulu.
              </Text>
            </View>
          ) : (
            ecommerceAccounts.map((item) => (
              <View key={item.id}>
                {renderAccountItem({ item })}
              </View>
            ))
          )}
        </View>

        {/* Section: Riwayat Boost Produk dengan TabView */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riwayat Boost Produk (ACTIVE)</Text>
          <View style={styles.tabViewContainer}>
            <TabView
              navigationState={{ index: tabIndex, routes }}
              renderScene={renderTabScene}
              onIndexChange={(index) => {
                setTabIndex(index);
                setSelectedShopTab(routes[index].key);
              }}
              initialLayout={{ width }}
              renderTabBar={renderTabBar}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44, // Same width as menuButton to keep title centered
  },
  content: {
    flex: 1,
  },

  // Stats Cards
  statsContainer: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTextContainer: {
    flex: 1,
  },
  statsTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statsIcon: {
    opacity: 0.3,
  },

  // Section
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0288d1',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#01579b',
    lineHeight: 20,
  },

  // Account Card
  accountList: {
    gap: 12,
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  platformText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  accountInfo: {
    marginBottom: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  accountShopId: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'monospace',
  },
  boostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  boostButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Product Card
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  productInfo: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  productShop: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  productIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  productId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  cooldownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cooldownText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // TabView
  tabViewContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 400, // Minimum height untuk TabView
    maxHeight: 800, // Maximum height untuk TabView
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    width: 'auto',
    minWidth: 100,
  },
  tabIndicator: {
    backgroundColor: '#f59e0b',
    height: 3,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabContent: {
    flex: 1,
  },

  // List
  listContent: {
    padding: 16,
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});

