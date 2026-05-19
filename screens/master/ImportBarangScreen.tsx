import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';

import ApiService from '../../services/api';
import MarketplaceTabs from './components/MarketplaceTabs';
import ProductList from './components/ProductList';
import FilterBar from './components/FilterBar';
import SelectionBar from './components/SelectionBar';
import BindMassalModal from './components/BindMassalModal';
import MigrateModal from './components/MigrateModal';

// Types
interface Marketplace {
  id: number;
  platform: string;
  name?: string;
  shop_id: string;
  status?: string;
  status_import?: 'idle' | 'importing' | 'completed' | 'error';
  import_progress?: number;
  import_total?: number;
}

interface IDefaultBarang {
  id: number | string;
  nama: string;
  sku: string;
  harga_jual: number;
  stok: number;
  imageUrl?: string;
  binded?: boolean;
  status_import?: 'waiting' | 'processing' | 'completed' | 'error';
  row_type?: string;
  variantCount?: number;
}

interface MarketplaceStatus {
  import_status: 'idle' | 'in_progress' | 'completed' | 'failed';
  progress?: {
    processed: number;
    total: number;
  };
  message?: string;
}

const ImportBarangScreen: React.FC = () => {
  const navigation = useNavigation();

  // Marketplace data
  const [listShop, setListShop] = useState<Marketplace[]>([]);
  const [currentMarketplaceIndex, setCurrentMarketplaceIndex] = useState(-1);

  // Product data
  const [products, setProducts] = useState<IDefaultBarang[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);

  // Filtering
  const [skuFilter, setSkuFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  // Modals
  const [showBindModal, setShowBindModal] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  // Import progress
  const [marketplaceStatus, setMarketplaceStatus] = useState<Map<number, MarketplaceStatus>>(new Map());

  // Fetch marketplace list
  const fetchMarketplaces = useCallback(async () => {
    try {
      const response = await ApiService.get('/get/ecommerce');
      if (response.data && Array.isArray(response.data)) {
        // Only get approved and non-pending names
        const validShops = response.data.filter((shop: any) => shop.status === 'APPROVED' && shop.status !== 'PENDING_NAME');
        setListShop(validShops);
        if (validShops.length > 0 && currentMarketplaceIndex === -1) {
          setCurrentMarketplaceIndex(0);
        }
      }
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
      showMessage({
        message: 'Error',
        description: 'Gagal memuat daftar marketplace',
        type: 'danger',
      });
    }
  }, [currentMarketplaceIndex]);

  // Fetch products for current marketplace
  const fetchProducts = useCallback(async (showLoader = true) => {
    if (currentMarketplaceIndex === -1 || !listShop[currentMarketplaceIndex]) {
      return;
    }

    const currentMarketplace = listShop[currentMarketplaceIndex];

    if (showLoader) {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.append('id_ecommerce', String(currentMarketplace.id));
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));

      const filterItems = [];
      if (skuFilter) {
        filterItems.push({ field: 'sku', value: skuFilter });
      }

      if (nameFilter) {
        filterItems.push({ field: 'nama', value: nameFilter });
      }

      if (filterItems.length > 0) {
        params.append('filter', JSON.stringify({ items: filterItems }));
      }

      // Sort by name so VAR_PARENT items are interleaved with regular items alphabetically
      // (default sort_id causes VAR_PARENT items to appear on page 7+ due to their ID range)
      params.append('sort', JSON.stringify([{ field: 'nama', sort: 'asc' }]));

      const response = await ApiService.get(`/get/import_barang_paged?${params.toString()}`);

      if (response.data) {
        const rawRows = response.data.rows || [];
        // Deduplicate by id to prevent 'Encountered two children with same key' error
        const seen = new Set<string>();
        const rows = rawRows.filter((r: any) => {
          const key = String(r.id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setProducts(rows);
        setTotalCount(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      showMessage({
        message: 'Error',
        description: 'Gagal memuat daftar produk',
        type: 'danger',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMarketplaceIndex, listShop, page, pageSize, skuFilter, nameFilter]);

  // Initial load
  useEffect(() => {
    fetchMarketplaces();
  }, []);



  // Load products when marketplace or filters change
  useEffect(() => {
    if (currentMarketplaceIndex !== -1) {
      fetchProducts();
    }
  }, [currentMarketplaceIndex, page, skuFilter, nameFilter]);

  // Poll import progress for marketplaces
  useEffect(() => {
    if (listShop.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const shop of listShop) {
        try {
          const response = await ApiService.get(`/get/ecommerce/import-progress/${shop.id}`);
          if (response.data) {
            setMarketplaceStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(shop.id, response.data);
              return newMap;
            });
          }
        } catch (error) {
          // Silently fail for progress polling
          console.error('Error polling import progress:', error);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [listShop]);

  // Handlers
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchProducts(false);
  }, [fetchProducts]);

  const handleMarketplaceChange = useCallback((index: number) => {
    setCurrentMarketplaceIndex(index);
    setPage(1);
    setSelectedIds([]);
    setSkuFilter('');
    setNameFilter('');
  }, []);

  const handleMarketplaceRefresh = useCallback(async (shop: Marketplace) => {
    try {
      showMessage({
        message: 'Info',
        description: `Memulai sinkronisasi toko ${shop.name || shop.shop_id}...`,
        type: 'info',
      });
      const response = await ApiService.get(`/ecommerce/import-barang?shop_id=${shop.shop_id}&platform=${shop.platform}&id_ecommerce=${shop.id}`);
      if (!response.status) {
        showMessage({
          message: 'Error',
          description: response.reason || 'Gagal memulai sinkronisasi',
          type: 'danger',
        });
      } else {
        showMessage({
          message: 'Sukses',
          description: 'Sinkronisasi berjalan. Anda bisa memantau progress di tab.',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error refreshing marketplace:', error);
      showMessage({
        message: 'Error',
        description: 'Terjadi kesalahan jaringan saat sinkronisasi',
        type: 'danger',
      });
    }
  }, []);

  const handleToggleSelection = useCallback((id: number | string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  }, [selectedIds, products]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleOpenBindModal = useCallback(() => {
    if (selectedIds.length === 0) {
      showMessage({
        message: 'Peringatan',
        description: 'Pilih minimal 1 produk untuk di-bind',
        type: 'warning',
      });
      return;
    }
    setShowBindModal(true);
  }, [selectedIds]);

  const handleOpenMigrateModal = useCallback(() => {
    if (selectedIds.length === 0) {
      showMessage({
        message: 'Peringatan',
        description: 'Pilih minimal 1 produk untuk di-migrate',
        type: 'warning',
      });
      return;
    }
    setShowMigrateModal(true);
  }, [selectedIds]);

  const handleBindSuccess = useCallback(() => {
    setShowBindModal(false);
    setSelectedIds([]);
    fetchProducts();
  }, [fetchProducts]);

  const handleMigrateSuccess = useCallback(() => {
    setShowMigrateModal(false);
    setSelectedIds([]);
  }, []);

  const handlePreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(prev => prev - 1);
    }
  }, [page]);

  const handleNextPage = useCallback(() => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (page < totalPages) {
      setPage(prev => prev + 1);
    }
  }, [page, totalCount, pageSize]);

  const handleClearFilters = useCallback(() => {
    setSkuFilter('');
    setNameFilter('');
    setPage(1);
  }, []);

  // Get current marketplace
  const currentMarketplace = currentMarketplaceIndex !== -1 ? listShop[currentMarketplaceIndex] : null;
  const currentStatus = currentMarketplace ? marketplaceStatus.get(currentMarketplace.id) : null;

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Barang</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Marketplace Tabs */}
      <MarketplaceTabs
        marketplaces={listShop}
        currentIndex={currentMarketplaceIndex}
        onSelectMarketplace={handleMarketplaceChange}
        marketplaceStatus={marketplaceStatus}
        onRefreshMarketplace={handleMarketplaceRefresh}
      />

      {/* Filter Bar */}
      <FilterBar
        skuFilter={skuFilter}
        nameFilter={nameFilter}
        onSkuFilterChange={setSkuFilter}
        onNameFilterChange={setNameFilter}
        onClearFilters={handleClearFilters}
      />

      {/* Selection Bar */}
      {selectedIds.length > 0 && (
        <SelectionBar
          selectedCount={selectedIds.length}
          totalCount={products.length}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBind={handleOpenBindModal}
          onMigrate={handleOpenMigrateModal}
        />
      )}


      {/* Product List */}
      <ProductList
        products={products}
        loading={loading}
        refreshing={refreshing}
        selectedIds={selectedIds}
        onToggleSelection={handleToggleSelection}
        onRefresh={handleRefresh}
      />

      {/* Pagination */}
      {!loading && products.length > 0 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            onPress={handlePreviousPage}
            disabled={page === 1}
            style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={page === 1 ? '#9ca3af' : '#1f2937'} />
          </TouchableOpacity>

          <Text style={styles.paginationText}>
            Page {page} of {totalPages} ({totalCount} items)
          </Text>

          <TouchableOpacity
            onPress={handleNextPage}
            disabled={page === totalPages}
            style={[styles.paginationButton, page === totalPages && styles.paginationButtonDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={page === totalPages ? '#9ca3af' : '#1f2937'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Bind Massal Modal */}
      <BindMassalModal
        visible={showBindModal}
        selectedIds={selectedIds}
        idEcommerce={currentMarketplace?.id || 0}
        onClose={() => setShowBindModal(false)}
        onSuccess={handleBindSuccess}
      />

      {/* Migrate Modal */}
      <MigrateModal
        visible={showMigrateModal}
        selectedIds={selectedIds}
        sourceIdEcommerce={currentMarketplace?.id || 0}
        marketplaces={listShop.filter(shop => shop.id !== currentMarketplace?.id)}
        onClose={() => setShowMigrateModal(false)}
        onSuccess={handleMigrateSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  paginationButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default ImportBarangScreen;
