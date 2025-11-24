import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import ApiService from '../../services/api';
import { loadingTimeEstimator } from '../../services/ecommerce/loadingTimeEstimator';

// ==================== INTERFACES ====================
interface EcommerceShop {
  id: number;
  platform: string;
  name: string;
  shop_id: string;
  status: string;
  auto_process_enabled?: boolean;
}

// ==================== CONSTANTS ====================
const PLATFORM_COLORS: { [key: string]: string } = {
  SHOPEE: '#ee4d2d',
  TOKOPEDIA: '#42b549',
  LAZADA: '#0f146d',
  TIKTOK: '#000000',
};

export default function ProsesOtomatisScreen() {
  const navigation = useNavigation();

  // ==================== STATE ====================
  const [shops, setShops] = useState<EcommerceShop[]>([]);
  const [filteredShops, setFilteredShops] = useState<EcommerceShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchText, setSearchText] = useState('');

  // Loading time estimation
  const [loadingProgress, setLoadingProgress] = useState({
    elapsedSeconds: 0,
    estimatedTotalSeconds: 5,
    estimatedRemainingSeconds: 5,
    progressPercentage: 0,
    status: 'starting' as 'starting' | 'loading' | 'almost-done' | 'finishing',
  });
  const loadingStartTime = useRef<number>(0);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==================== EFFECTS ====================
  useEffect(() => {
    initializeAndFetch();

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchText);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Filter shops based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredShops(shops);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = shops.filter(
      (shop) =>
        shop.name?.toLowerCase().includes(query) ||
        shop.platform?.toLowerCase().includes(query) ||
        shop.shop_id?.toString().includes(query)
    );
    setFilteredShops(filtered);
  }, [searchQuery, shops]);

  // ==================== FUNCTIONS ====================
  const initializeAndFetch = async () => {
    await loadingTimeEstimator.initialize();
    await fetchShops();
  };

  const startLoadingProgress = (estimatedSeconds: number) => {
    loadingStartTime.current = Date.now();
    setLoadingProgress({
      elapsedSeconds: 0,
      estimatedTotalSeconds: estimatedSeconds,
      estimatedRemainingSeconds: estimatedSeconds,
      progressPercentage: 0,
      status: 'starting',
    });

    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      const elapsedMs = Date.now() - loadingStartTime.current;
      const elapsedSeconds = parseFloat((elapsedMs / 1000).toFixed(1));
      const estimatedTotal = estimatedSeconds;
      const remaining = Math.max(0, estimatedTotal - elapsedSeconds);
      const percentage = Math.min(95, (elapsedSeconds / estimatedTotal) * 100);

      let status: 'starting' | 'loading' | 'almost-done' | 'finishing' = 'loading';
      if (percentage < 10) status = 'starting';
      else if (percentage > 80) status = 'almost-done';
      else if (percentage > 90) status = 'finishing';

      setLoadingProgress({
        elapsedSeconds,
        estimatedTotalSeconds: estimatedTotal,
        estimatedRemainingSeconds: remaining,
        progressPercentage: percentage,
        status,
      });
    }, 500);
  };

  const stopLoadingProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    setLoadingProgress({
      elapsedSeconds: 0,
      estimatedTotalSeconds: 0,
      estimatedRemainingSeconds: 0,
      progressPercentage: 100,
      status: 'finishing',
    });
  };

  const fetchShops = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const startTime = Date.now();
      const estimate = await loadingTimeEstimator.getEstimate(0);
      console.log('⏱️ [ProsesOtomatis] Estimated loading time:', estimate);

      startLoadingProgress(estimate.estimatedSeconds);

      console.log('📦 [ProsesOtomatis] Fetching ecommerce shops...');
      const response = await ApiService.get('/get/ecommerce');

      if (response.status) {
        const approvedShops = response.data.filter(
          (shop: EcommerceShop) => shop.status === 'APPROVED'
        );
        console.log('✅ [ProsesOtomatis] Fetched shops:', approvedShops.length);
        setShops(approvedShops);
        setFilteredShops(approvedShops);

        const duration = Date.now() - startTime;
        await loadingTimeEstimator.recordLoadingTime(approvedShops.length, duration);
      } else {
        console.error('❌ [ProsesOtomatis] Failed to fetch shops:', response.reason);
      }
    } catch (error) {
      console.error('❌ [ProsesOtomatis] Error fetching shops:', error);
    } finally {
      stopLoadingProgress();
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchShops(true);
  };

  const openConfigScreen = (shop: EcommerceShop) => {
    (navigation as any).navigate('ProsesOtomatisConfig', { shop });
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderStatCard = (
    title: string,
    value: number,
    icon: keyof typeof Ionicons.glyphMap,
    gradientColors: string[]
  ) => {
    return (
      <LinearGradient colors={gradientColors} style={styles.statCard}>
        <View style={styles.statCardContent}>
          <View style={styles.statCardLeft}>
            <Text style={styles.statCardTitle}>{title}</Text>
            <Text style={styles.statCardValue}>{value}</Text>
          </View>
          <Ionicons name={icon} size={48} color="rgba(255,255,255,0.3)" />
        </View>
      </LinearGradient>
    );
  };

  const renderShopItem = ({ item }: { item: EcommerceShop }) => {
    const platformColor = PLATFORM_COLORS[item.platform] || '#9ca3af';

    return (
      <TouchableOpacity
        style={styles.shopCard}
        onPress={() => openConfigScreen(item)}
        activeOpacity={0.7}
      >
        <View style={styles.shopCardHeader}>
          <View style={[styles.platformBadge, { backgroundColor: platformColor }]}>
            <Text style={styles.platformBadgeText}>{item.platform}</Text>
          </View>
          {item.auto_process_enabled ? (
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          ) : (
            <Ionicons name="close-circle" size={24} color="#9ca3af" />
          )}
        </View>

        <Text style={styles.shopName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.shopId}>Shop ID: {item.shop_id}</Text>

        <View style={styles.shopCardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: '#10b98120' }]}>
            <Text style={[styles.statusBadgeText, { color: '#10b981' }]}>APPROVED</Text>
          </View>
          <TouchableOpacity style={styles.configButton} onPress={() => openConfigScreen(item)}>
            <Ionicons name="settings-outline" size={20} color="#f59e0b" />
            <Text style={styles.configButtonText}>Config</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLoadingIndicator = () => {
    const { elapsedSeconds, estimatedRemainingSeconds, progressPercentage, status } =
      loadingProgress;

    const statusMessages = {
      starting: 'Memulai...',
      loading: 'Memuat data toko...',
      'almost-done': 'Hampir selesai...',
      finishing: 'Menyelesaikan...',
    };

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>{statusMessages[status]}</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
        </View>
        <Text style={styles.loadingTimeText}>
          {elapsedSeconds.toFixed(1)}s / ~{estimatedRemainingSeconds.toFixed(1)}s tersisa
        </Text>
      </View>
    );
  };

  // ==================== STATISTICS ====================
  const totalShops = shops.length;
  const activeShops = shops.filter((s) => s.auto_process_enabled).length;
  const inactiveShops = totalShops - activeShops;

  // ==================== MAIN RENDER ====================
  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Proses Otomatis</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <Ionicons name="sync-circle" size={40} color="white" />
            <View style={styles.titleTextContainer}>
              <Text style={styles.title}>Proses Otomatis Pesanan</Text>
              <Text style={styles.subtitle}>
                Kelola jadwal otomatis pemrosesan pesanan untuk setiap toko marketplace
              </Text>
            </View>
          </View>

          {/* Statistics Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statsScrollView}
            contentContainerStyle={styles.statsScrollContent}
          >
            {renderStatCard('Total Toko', totalShops, 'storefront', ['#667eea', '#764ba2'])}
            {renderStatCard('Auto Process Aktif', activeShops, 'checkmark-circle', [
              '#11998e',
              '#38ef7d',
            ])}
            {renderStatCard('Belum Aktif', inactiveShops, 'close-circle', [
              '#ee0979',
              '#ff6a00',
            ])}
          </ScrollView>

          {/* Search Bar - Outside FlatList */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#f59e0b" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari toko berdasarkan nama, platform, atau shop ID..."
                placeholderTextColor="#9ca3af"
                value={searchText}
                onChangeText={setSearchText}
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.searchResultBadge}>
              <Ionicons name="funnel" size={16} color="#f59e0b" />
              <Text style={styles.searchResultText}>{filteredShops.length} toko ditampilkan</Text>
            </View>
          </View>

          {/* Shop List */}
          {loading ? (
            renderLoadingIndicator()
          ) : (
            <FlatList
              data={filteredShops}
              renderItem={renderShopItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={['#f59e0b']}
                  tintColor="#f59e0b"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="storefront-outline" size={64} color="#9ca3af" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'Tidak ada toko yang cocok' : 'Belum ada toko terdaftar'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hamburgerButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 38,
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  statsScrollView: {
    marginBottom: 16,
  },
  statsScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    width: 200,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLeft: {
    flex: 1,
  },
  statCardTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  clearButton: {
    padding: 4,
  },
  searchResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  searchResultText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  shopCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  platformBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  shopId: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  shopCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  configButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 12,
  },
  progressBarContainer: {
    width: '80%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  loadingTimeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
  },
});

