import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import Toast from '../../components/Toast';
import ApiService from '../../services/api';
import {
  loadingTimeEstimator,
  LoadingEstimate,
  LoadingProgress,
} from '../../services/ecommerce/loadingTimeEstimator';

// ==================== TYPES ====================
type RootStackParamList = {
  BoostProduk: {
    shop_id: string;
    id_ecommerce: number;
    platform: string;
    shop_name: string;
  };
};

type BoostProdukScreenRouteProp = RouteProp<RootStackParamList, 'BoostProduk'>;
type NavigationProp = DrawerNavigationProp<any>;

interface Product {
  item_id: number;
  nama: string;
  sku: string;
  images: string[];
  qty?: number;
  harga?: number;
}

// ==================== CONSTANTS ====================
const MAX_BOOST_ITEMS = 30;

// ==================== MAIN COMPONENT ====================
export default function BoostProdukScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BoostProdukScreenRouteProp>();
  const { shop_id, id_ecommerce, platform, shop_name } = route.params;

  // ==================== STATE ====================
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');
  const [submittedSearchText, setSubmittedSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boosting, setBoosting] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  // Loading progress state
  const [loadingEstimate, setLoadingEstimate] = useState<LoadingEstimate | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const loadingStartTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==================== HELPER FUNCTIONS ====================
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // ==================== PROGRESS TRACKING ====================
  const startProgressTracking = (estimate: LoadingEstimate) => {
    loadingStartTimeRef.current = Date.now();
    setLoadingEstimate(estimate);

    // Update progress every 500ms
    progressIntervalRef.current = setInterval(() => {
      const progress = loadingTimeEstimator.calculateProgress(
        loadingStartTimeRef.current,
        estimate
      );
      setLoadingProgress(progress);
    }, 500);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoadingProgress(null);
    setLoadingEstimate(null);
  };

  // ==================== API CALLS ====================
  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('📦 [BoostProduk] Fetching products for shop_id:', shop_id, 'id_ecommerce:', id_ecommerce);

      // Get initial estimate and start tracking
      const estimate = loadingTimeEstimator.getEstimate();
      startProgressTracking(estimate);

      console.log('⏱️ [BoostProduk] Estimated loading time:', {
        seconds: estimate.estimatedSeconds,
        range: `${estimate.estimatedRange.min}-${estimate.estimatedRange.max}s`,
        confidence: estimate.confidence,
      });

      const response = await ApiService.get(
        `/get/shopee/products-for-boost?shop_id=${shop_id}&id_ecommerce=${id_ecommerce}`
      );

      // Calculate actual loading time
      const loadingDuration = Date.now() - loadingStartTimeRef.current;

      console.log('📡 [BoostProduk] Response:', response);

      if (response.status) {
        const productCount = response.data?.length || 0;
        setProducts(response.data || []);
        setFilteredProducts(response.data || []);
        console.log('✅ [BoostProduk] Loaded', productCount, 'products');
        console.log('⏱️ [BoostProduk] Actual loading time:', (loadingDuration / 1000).toFixed(1), 'seconds');

        // Record loading time for future estimates
        await loadingTimeEstimator.recordLoadingTime(productCount, loadingDuration);
      } else {
        showToast(response.reason || 'Gagal memuat produk', 'error');
      }
    } catch (error: any) {
      console.error('❌ [BoostProduk] Error fetching products:', error);
      showToast(error.message || 'Gagal memuat produk', 'error');
    } finally {
      stopProgressTracking();
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [shop_id, id_ecommerce]);

  // ==================== EFFECTS ====================
  // Initialize loading time estimator
  useEffect(() => {
    loadingTimeEstimator.initialize();
  }, []);

  // Fetch products on mount
  useEffect(() => {
    if (!shop_id || !id_ecommerce) {
      showToast('Shop ID dan ID Ecommerce diperlukan', 'error');
      return;
    }
    fetchProducts();
  }, [shop_id, id_ecommerce]);

  // Cleanup progress tracking on unmount
  useEffect(() => {
    return () => {
      stopProgressTracking();
    };
  }, []);

  // Filter products based on submitted search text (manual trigger only)
  useEffect(() => {
    if (submittedSearchText.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(
        (p) =>
          p.nama.toLowerCase().includes(submittedSearchText.toLowerCase()) ||
          p.sku.toLowerCase().includes(submittedSearchText.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [submittedSearchText, products]);

  // ==================== EVENT HANDLERS ====================
  const handleSearchSubmit = () => {
    // Trigger filtering when user presses "Search" on keyboard or taps search icon
    setSubmittedSearchText(searchText);
  };

  const handleClearSearch = () => {
    // Clear both search text and submitted search text
    setSearchText('');
    setSubmittedSearchText('');
  };

  const toggleSelectItem = (item_id: number) => {
    setSelectedItems((prev) => {
      if (prev.includes(item_id)) {
        // Deselect item
        return prev.filter((id) => id !== item_id);
      } else {
        // Check if already at max limit
        if (prev.length >= MAX_BOOST_ITEMS) {
          showToast(`Maksimal ${MAX_BOOST_ITEMS} produk dapat di-boost sekaligus`, 'error');
          return prev;
        }
        // Select item
        return [...prev, item_id];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredProducts.length) {
      // Deselect all
      setSelectedItems([]);
    } else {
      // Select all (up to MAX_BOOST_ITEMS)
      const itemsToSelect = filteredProducts.slice(0, MAX_BOOST_ITEMS).map((p) => p.item_id);

      if (filteredProducts.length > MAX_BOOST_ITEMS) {
        showToast(
          `Hanya ${MAX_BOOST_ITEMS} produk pertama yang dipilih (maksimal ${MAX_BOOST_ITEMS} produk)`,
          'info'
        );
      }

      setSelectedItems(itemsToSelect);
    }
  };

  const handleBoostItems = async () => {
    if (selectedItems.length === 0) {
      showToast('Pilih minimal 1 produk untuk di-boost', 'error');
      return;
    }

    if (selectedItems.length > MAX_BOOST_ITEMS) {
      showToast(`Maksimal ${MAX_BOOST_ITEMS} produk dapat di-boost sekaligus`, 'error');
      return;
    }

    Alert.alert(
      'Konfirmasi Boost',
      `Anda akan boost ${selectedItems.length} produk. Lanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Boost',
          onPress: async () => {
            try {
              setBoosting(true);

              console.log('[BOOST] Sending request with:', {
                shop_id,
                id_ecommerce,
                item_ids: selectedItems,
              });

              const response = await ApiService.post('/shopee/boost-items', {
                shop_id,
                id_ecommerce,
                item_ids: selectedItems,
              });

              console.log('[BOOST] Response:', response);

              if (response.status) {
                const successCount = response.summary?.success || selectedItems.length;
                const failedCount = response.summary?.failed || 0;

                let message = `Berhasil boost ${successCount} produk!`;
                if (failedCount > 0) {
                  message += ` (${failedCount} produk gagal)`;
                }

                showToast(message, 'success');

                // Redirect back after 2 seconds
                setTimeout(() => {
                  navigation.navigate("NaikkanProduk");
                }, 2000);
              } else {
                // Check if error is about boost slot limit
                const errorMsg = response.reason || 'Gagal melakukan boost';
                const isSlotLimitError =
                  errorMsg.toLowerCase().includes('bump slot limit') ||
                  errorMsg.toLowerCase().includes('slot boost') ||
                  errorMsg.toLowerCase().includes('batas maksimal');

                if (isSlotLimitError) {
                  // Save items as pending
                  console.log('[BOOST] Boost failed due to slot limit, saving items as pending');

                  try {
                    const pendingResponse = await ApiService.post('/shopee/save-pending-boost', {
                      shop_id,
                      id_ecommerce,
                      item_ids: selectedItems,
                    });

                    if (pendingResponse.status) {
                      showToast(
                        pendingResponse.message || 'Produk berhasil ditambahkan ke antrian boost',
                        'success'
                      );

                      setTimeout(() => {
                        navigation.goBack();
                      }, 2000);
                    } else {
                      showToast(
                        pendingResponse.reason || 'Gagal menyimpan produk ke antrian boost',
                        'error'
                      );
                    }
                  } catch (pendingError) {
                    console.error('[BOOST] Error saving pending items:', pendingError);
                    showToast('Gagal menyimpan produk ke antrian boost', 'error');
                  }
                } else {
                  showToast(errorMsg, 'error');
                }
              }
            } catch (error: any) {
              console.error('[BOOST] Error boosting items:', error);
              showToast(error.message || 'Gagal melakukan boost', 'error');
            } finally {
              setBoosting(false);
            }
          },
        },
      ]
    );
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderProductItem = useCallback(({ item: product }: { item: Product }) => {
    const isSelected = selectedItems.includes(product.item_id);
    const imageUrl = product.images && product.images.length > 0 ? product.images[0] : '';

    return (
      <TouchableOpacity
        style={[styles.productCard, isSelected && styles.productCardSelected]}
        onPress={() => toggleSelectItem(product.item_id)}
        activeOpacity={0.7}
      >
        <View style={styles.checkbox}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? '#f59e0b' : '#9ca3af'}
          />
        </View>

        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <Ionicons name="image-outline" size={32} color="#d1d5db" />
          </View>
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.nama}
          </Text>
          <Text style={styles.productSku} numberOfLines={1}>
            SKU: {product.sku}
          </Text>
          {product.harga && (
            <Text style={styles.productPrice}>
              Rp {product.harga.toLocaleString('id-ID')}
            </Text>
          )}
          {product.qty !== undefined && (
            <Text style={styles.productStock}>Stok: {product.qty}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selectedItems]);

  const renderInfoCard = useCallback(() => {
    const isOverLimit = selectedItems.length > MAX_BOOST_ITEMS;
    const selectionColor = isOverLimit ? '#ef4444' : selectedItems.length > 0 ? '#10b981' : '#9ca3af';

    return (
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="cube-outline" size={20} color="#0288d1" />
            <Text style={styles.infoLabel}>Total Produk</Text>
            <Text style={styles.infoValue}>{filteredProducts.length}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color={selectionColor} />
            <Text style={styles.infoLabel}>Dipilih</Text>
            <Text style={[styles.infoValue, { color: selectionColor }]}>
              {selectedItems.length} / {MAX_BOOST_ITEMS}
            </Text>
          </View>
        </View>

        {/* Warning message if over limit */}
        {isOverLimit && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={16} color="#ef4444" />
            <Text style={styles.warningText}>
              Maksimal {MAX_BOOST_ITEMS} produk dapat di-boost sekaligus. Anda telah memilih {selectedItems.length} produk.
            </Text>
          </View>
        )}

        {filteredProducts.length > 0 && (
          <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
            <Ionicons
              name={selectedItems.length === filteredProducts.length ? 'checkbox' : 'square-outline'}
              size={20}
              color="#f59e0b"
            />
            <Text style={styles.selectAllText}>
              {selectedItems.length === filteredProducts.length ? 'Batalkan Semua' : 'Pilih Semua'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [filteredProducts.length, selectedItems.length]);

  const renderListEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Memuat produk...</Text>

          {/* Progress Indicator with Time Estimate */}
          {loadingProgress && (
            <View style={styles.progressContainer}>
              {/* Progress Bar */}
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${loadingProgress.progressPercentage}%` }
                  ]}
                />
              </View>

              {/* Progress Info */}
              <View style={styles.progressInfo}>
                <Text style={styles.progressPercentage}>
                  {loadingProgress.progressPercentage}%
                </Text>
                <Text style={styles.progressTime}>
                  {loadingProgress.estimatedRemainingSeconds > 0
                    ? `~${loadingProgress.estimatedRemainingSeconds} detik tersisa`
                    : 'Hampir selesai...'}
                </Text>
              </View>

              {/* Status Message */}
              <Text style={styles.progressStatus}>
                {loadingProgress.status === 'starting' && '🚀 Memulai...'}
                {loadingProgress.status === 'loading' && '⏳ Harap tunggu...'}
                {loadingProgress.status === 'almost-done' && '✨ Hampir selesai...'}
                {loadingProgress.status === 'finishing' && '🎉 Menyelesaikan...'}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={64} color="#d1d5db" />
        <Text style={styles.emptyText}>
          {submittedSearchText ? 'Produk tidak ditemukan' : 'Tidak ada produk'}
        </Text>
        <Text style={styles.emptySubtext}>
          {submittedSearchText ? 'Coba kata kunci lain' : 'Belum ada produk untuk di-boost'}
        </Text>
      </View>
    );
  }, [loading, loadingProgress, submittedSearchText]);

  const keyExtractor = useCallback((item: Product) => item.item_id.toString(), []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 100, // Approximate height of product card
      offset: 100 * index,
      index,
    }),
    []
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
        <TouchableOpacity onPress={() => navigation.navigate("NaikkanProduk")} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Boost Produk
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {shop_name || platform}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar - Outside FlatList to prevent keyboard issues */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TouchableOpacity onPress={handleSearchSubmit} style={styles.searchIconButton}>
            <Ionicons
              name="search"
              size={20}
              color={searchText.trim() !== '' && searchText !== submittedSearchText ? "#f59e0b" : "#9ca3af"}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk (nama atau SKU)..."
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearchSubmit}
            placeholderTextColor="#9ca3af"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Products FlatList */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderInfoCard}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={<View style={{ height: 100 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f59e0b']}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        getItemLayout={getItemLayout}
      />

      {/* Floating Action Button */}
      {selectedItems.length > 0 && !boosting && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={[
              styles.fab,
              selectedItems.length > MAX_BOOST_ITEMS && styles.fabDisabled
            ]}
            onPress={handleBoostItems}
            activeOpacity={0.8}
            disabled={selectedItems.length > MAX_BOOST_ITEMS}
          >
            <Ionicons name="trending-up" size={24} color="#fff" />
            <Text style={styles.fabText}>Boost {selectedItems.length} Produk</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Boosting Overlay */}
      {boosting && (
        <View style={styles.boostingOverlay}>
          <View style={styles.boostingCard}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.boostingText}>Memproses boost produk...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flexGrow: 1,
  },

  // Search
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIconButton: {
    padding: 4,
    marginRight: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  clearButton: {
    padding: 4,
  },
  searchHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  searchHintText: {
    fontSize: 12,
    color: '#f59e0b',
    marginLeft: 4,
    fontStyle: 'italic',
  },

  // Info Card
  infoCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  infoItem: {
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
    lineHeight: 18,
  },

  // Products List
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  productCardSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  checkbox: {
    marginRight: 12,
    justifyContent: 'center',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 2,
  },
  productStock: {
    fontSize: 12,
    color: '#6b7280',
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },

  // Progress Indicator
  progressContainer: {
    marginTop: 24,
    width: '80%',
    maxWidth: 300,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f59e0b',
  },
  progressTime: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressStatus: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#9ca3af',
  },

  // Floating Action Button
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'transparent',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    gap: 8,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  fabDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },

  // Boosting Overlay
  boostingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boostingCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  boostingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});

