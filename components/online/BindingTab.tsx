import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';
import SearchOnlineModal from './SearchOnlineModal';

interface Platform {
  platform: string;
  name: string;
  id_online: string;
  id_online_mb: number;
  id_ecommerce: number;
  check: boolean;
  isVariant: boolean;
  disconnected: boolean;
  shop_name?: string;
  product_name?: string;
  price_marketplace?: number;
  original_price_marketplace?: number;
  expected_price?: number;
  price_match?: number;
  stok_platform?: number;
  tiktok_status?: string;
}

interface ProductData {
  id: number;
  nama: string;
  sku: string;
  hargajual2: number;
  stok: number;
  berat: number;
}

interface EcommerceAccount {
  id: number;
  platform: string;
  name: string;
  domain: string;
  shop_id: string;
  status: string;
}

interface BindingTabProps {
  productId: number | null;
}

export default function BindingTab({ productId }: BindingTabProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [platformsData, setPlatformsData] = useState<any[]>([]);
  const [syncingStock, setSyncingStock] = useState(false);
  const [ecommerceList, setEcommerceList] = useState<EcommerceAccount[]>([]);
  const [showTambahBaru, setShowTambahBaru] = useState(false);
  const [showBind, setShowBind] = useState(false);
  const [searchOnlineModal, setSearchOnlineModal] = useState<{
    visible: boolean;
    from: 'BIND' | 'VARIANT' | null;
    id_ecommerce: number;
  }>({ visible: false, from: null, id_ecommerce: 0 });

  useEffect(() => {
    if (productId) {
      fetchData();
      fetchEcommerceList();
    }
  }, [productId]);

  const fetchEcommerceList = async () => {
    try {
      const response = await ApiService.authenticatedRequest('/get/ecommerce');
      if (response?.status && response.data) {
        const approvedAccounts = response.data.filter(
          (acc: EcommerceAccount) => acc.status === 'APPROVED'
        );
        setEcommerceList(approvedAccounts);
      }
    } catch (error) {
      console.error('Error fetching ecommerce list:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch platform bindings
      const response = await ApiService.authenticatedRequest(
        `/get/ecommerce/ALL/product?id_database=${productId}&from=masterbarang`
      );

      console.log('🔍 [BINDING] API Response:', JSON.stringify(response, null, 2));

      if (response?.status && response.data) {
        console.log('🔍 [BINDING] First item data:', response.data[0]);

        // Store full platform data for price/stock info
        setPlatformsData(response.data);

        const platformData = response.data.map((p: any, index: number) => ({
          platform: p.platform || '',
          name: p.name || '',
          id_online: p.id_online || '',
          id_online_mb: p.id_online_mb || 0,
          id_ecommerce: p.id_ecommerce || 0,
          check: index === 0,
          isVariant: p.isVariant || false,
          disconnected: p.disconnected || false,
          shop_name: p.shop_name || '',
          product_name: p.nama || p.product_name || '', // Use 'nama' field like web version
          price_marketplace: p.price_marketplace,
          original_price_marketplace: p.original_price_marketplace,
          expected_price: p.expected_price,
          price_match: p.price_match,
          stok_platform: p.stok_platform,
          tiktok_status: p.tiktok_status,
        }));

        console.log('🔍 [BINDING] Mapped platform data:', platformData);
        setPlatforms(platformData);
      }

      // Fetch master barang data
      const masterResponse = await ApiService.authenticatedRequest(
        `/get/masterbarang/condition/and/id:equal:${productId}`
      );

      if (masterResponse?.status && masterResponse.data?.[0]) {
        setProductData(masterResponse.data[0]);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load product data');
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformSelect = (index: number) => {
    const updated = platforms.map((p, i) => ({
      ...p,
      check: i === index,
    }));
    setPlatforms(updated);
    setCurrentIndex(index);
  };

  const handleUnbind = async (platform: Platform) => {
    Alert.alert(
      'Unbind Product',
      `Are you sure you want to unbind this product from ${platform.platform}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unbind',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.authenticatedRequest(
                `/unbind-product?id_online_mb=${platform.id_online_mb}`
              );
              
              if (response?.status) {
                Alert.alert('Success', 'Product unbound successfully');
                fetchData(); // Refresh data
              } else {
                Alert.alert('Error', response?.reason || 'Failed to unbind product');
              }
            } catch (error) {
              console.error('Error unbinding:', error);
              Alert.alert('Error', 'Failed to unbind product');
            }
          },
        },
      ]
    );
  };

  const getPlatformColor = (platform: string): string => {
    switch (platform.toUpperCase()) {
      case 'SHOPEE': return '#ee4d2d';
      case 'TOKOPEDIA': return '#42b549';
      case 'LAZADA': return '#0f146d';
      case 'TIKTOK': return '#000000';
      default: return '#6B7280';
    }
  };

  const getPlatformIcon = (platform: string): any => {
    switch (platform.toUpperCase()) {
      case 'SHOPEE': return 'cart';
      case 'TOKOPEDIA': return 'bag';
      case 'LAZADA': return 'pricetag';
      case 'TIKTOK': return 'musical-notes';
      default: return 'globe';
    }
  };

  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTikTokStatusColor = (status: string | undefined): { bg: string; text: string } => {
    switch (status) {
      case 'ACTIVATE': return { bg: '#dcfce7', text: '#166534' };
      case 'DELETED': return { bg: '#fee2e2', text: '#991b1b' };
      case 'DRAFT': return { bg: '#e0e7ff', text: '#3730a3' };
      case 'PENDING': return { bg: '#fef3c7', text: '#92400e' };
      case 'FAILED': return { bg: '#fecaca', text: '#991b1b' };
      case 'SELLER_DEACTIVATED': return { bg: '#fed7aa', text: '#9a3412' };
      case 'PLATFORM_DEACTIVATED': return { bg: '#fca5a5', text: '#991b1b' };
      case 'FREEZE': return { bg: '#bfdbfe', text: '#1e40af' };
      default: return { bg: '#f3f4f6', text: '#4b5563' };
    }
  };

  const handleSyncStock = async () => {
    if (!productId) return;

    try {
      setSyncingStock(true);
      const response = await ApiService.authenticatedRequest('/ecommerce/sync/stock', {
        method: 'POST',
        body: JSON.stringify([{ id_barang: productId }]),
      });

      if (response?.status) {
        Alert.alert('Success', 'Stock synchronized successfully');
        fetchData(); // Refresh data
      } else {
        Alert.alert('Error', response?.reason || 'Failed to sync stock');
      }
    } catch (error) {
      console.error('Error syncing stock:', error);
      Alert.alert('Error', 'Failed to sync stock');
    } finally {
      setSyncingStock(false);
    }
  };

  const handleTambahBaru = () => {
    if (ecommerceList.length === 0) {
      Alert.alert('No Marketplace', 'No approved marketplace accounts found');
      return;
    }
    setShowTambahBaru(true);
  };

  const handleTambahBaruSelect = async (ecommerceId: number) => {
    try {
      setShowTambahBaru(false);

      // Fetch shop details
      const response = await ApiService.authenticatedRequest(
        `/get/ecommerce/condition/and/id:equal:${ecommerceId},status:equal:APPROVED`
      );

      if (!response?.status || !response.data || response.data.length === 0) {
        Alert.alert('Error', 'Shop not found');
        return;
      }

      const selectedAccount = ecommerceList.find((acc) => acc.id === ecommerceId);

      if (!selectedAccount || !productData) return;

      // Add new platform to the list
      const newPlatform: Platform = {
        platform: selectedAccount.platform,
        name: selectedAccount.name,
        id_online: '0',
        id_online_mb: 0,
        id_ecommerce: ecommerceId,
        check: true,
        isVariant: false,
        disconnected: false,
        shop_name: selectedAccount.name,
        product_name: productData.nama,
      };

      // Update platforms - uncheck all others and add new one
      const updatedPlatforms = platforms.map((p) => ({ ...p, check: false }));
      updatedPlatforms.push(newPlatform);
      setPlatforms(updatedPlatforms);
      setCurrentIndex(updatedPlatforms.length - 1);

      Alert.alert('Success', `Added ${selectedAccount.platform} platform`);
    } catch (error) {
      console.error('Error adding platform:', error);
      Alert.alert('Error', 'Failed to add platform');
    }
  };

  const handleBind = () => {
    if (ecommerceList.length === 0) {
      Alert.alert('No Marketplace', 'No approved marketplace accounts found');
      return;
    }
    setShowBind(true);
  };

  const handleBindSelect = (ecommerceId: number) => {
    setShowBind(false);
    setSearchOnlineModal({
      visible: true,
      from: 'BIND',
      id_ecommerce: ecommerceId,
    });
  };

  const handleSearchOnlineSelect = async (product: any) => {
    try {
      const selectedAccount = ecommerceList.find(
        (acc) => acc.id === searchOnlineModal.id_ecommerce
      );

      if (!selectedAccount || !productData) return;

      // Add the bound product to platforms
      const newPlatform: Platform = {
        platform: selectedAccount.platform,
        name: selectedAccount.name,
        id_online: product.item_id.toString(),
        id_online_mb: 0,
        id_ecommerce: searchOnlineModal.id_ecommerce,
        check: true,
        isVariant: product.isVariant || false,
        disconnected: false,
        shop_name: selectedAccount.name,
        product_name: product.name,
      };

      // Update platforms
      const updatedPlatforms = platforms.map((p) => ({ ...p, check: false }));
      updatedPlatforms.push(newPlatform);
      setPlatforms(updatedPlatforms);
      setCurrentIndex(updatedPlatforms.length - 1);

      Alert.alert('Success', `Bound product from ${selectedAccount.platform}`);
    } catch (error) {
      console.error('Error binding product:', error);
      Alert.alert('Error', 'Failed to bind product');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Product Info Header */}
      {productData && (
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{productData.nama}</Text>
          <Text style={styles.productSku}>SKU: {productData.sku}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={handleTambahBaru}>
          <Ionicons name="add-circle-outline" size={20} color="#f59e0b" />
          <Text style={styles.actionButtonText}>Tambah Baru</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleBind}>
          <Ionicons name="link-outline" size={20} color="#2563eb" />
          <Text style={styles.actionButtonText}>Bind</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, syncingStock && styles.actionButtonDisabled]}
          onPress={handleSyncStock}
          disabled={syncingStock}
        >
          {syncingStock ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Ionicons name="sync-outline" size={20} color="#059669" />
          )}
          <Text style={styles.actionButtonText}>Sync Stock</Text>
        </TouchableOpacity>
      </View>

      {/* Platform List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Platforms</Text>

        {platforms.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No platforms connected</Text>
            <Text style={styles.emptySubtext}>Tap "Tambah Baru" to connect a platform</Text>
          </View>
        ) : (
          platforms.map((platform, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.platformCard,
                platform.check && styles.platformCardActive,
              ]}
              onPress={() => handlePlatformSelect(index)}
            >
              <View style={styles.platformHeader}>
                <View style={styles.platformInfo}>
                  <View
                    style={[
                      styles.platformIcon,
                      { backgroundColor: getPlatformColor(platform.platform) + '20' },
                    ]}
                  >
                    <Ionicons
                      name={getPlatformIcon(platform.platform)}
                      size={20}
                      color={getPlatformColor(platform.platform)}
                    />
                  </View>
                  <View style={styles.platformDetails}>
                    <Text style={styles.platformName}>{platform.platform}</Text>
                    <Text style={styles.shopName}>{platform.shop_name}</Text>
                  </View>
                </View>

                {platform.check && (
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark-circle" size={24} color="#f59e0b" />
                  </View>
                )}
              </View>

              <Text style={styles.productNameText} numberOfLines={2}>
                {platform.product_name || 'No product name'}
              </Text>

              {/* Badges */}
              <View style={styles.badgeContainer}>
                {platform.isVariant && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Variant</Text>
                  </View>
                )}
                {platform.disconnected && (
                  <View style={[styles.badge, styles.badgeDisconnected]}>
                    <Text style={[styles.badgeText, styles.badgeTextDisconnected]}>
                      Disconnected
                    </Text>
                  </View>
                )}
              </View>

              {/* Unbind Button */}
              {platform.check && (
                <TouchableOpacity
                  style={styles.unbindButton}
                  onPress={() => handleUnbind(platform)}
                >
                  <Ionicons name="unlink-outline" size={16} color="#dc2626" />
                  <Text style={styles.unbindText}>Unbind</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Price & Stock Information */}
      {platforms[currentIndex] && !platforms[currentIndex].disconnected && productData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Harga & Stok</Text>

          {/* TikTok Status Badge */}
          {platforms[currentIndex].platform === 'TIKTOK' && platforms[currentIndex].tiktok_status && (
            <View style={styles.statusBadgeContainer}>
              <Text style={styles.statusLabel}>Status Produk TikTok:</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getTikTokStatusColor(platforms[currentIndex].tiktok_status).bg }
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  { color: getTikTokStatusColor(platforms[currentIndex].tiktok_status).text }
                ]}>
                  {platforms[currentIndex].tiktok_status}
                </Text>
              </View>
            </View>
          )}

          {/* Price Information */}
          <View style={styles.priceStockCard}>
            {/* PlexSeller Price */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Harga PlexSeller</Text>
              <Text style={styles.pricePlexSeller}>
                {formatCurrency(productData.hargajual2)}
              </Text>
            </View>

            {/* Expected Price (after markup) */}
            {platforms[currentIndex].expected_price != null && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Harga Seharusnya (setelah markup)</Text>
                <Text style={styles.priceExpected}>
                  {formatCurrency(platforms[currentIndex].expected_price)}
                </Text>
              </View>
            )}

            {/* Marketplace Price */}
            {platforms[currentIndex].price_marketplace != null && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Harga di Marketplace</Text>
                <Text style={styles.priceMarketplace}>
                  {formatCurrency(platforms[currentIndex].price_marketplace)}
                </Text>
              </View>
            )}

            {/* Original Marketplace Price (if different) */}
            {platforms[currentIndex].original_price_marketplace != null &&
             platforms[currentIndex].original_price_marketplace !== platforms[currentIndex].price_marketplace && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Harga Asli (sebelum diskon)</Text>
                <Text style={styles.priceOriginal}>
                  {formatCurrency(platforms[currentIndex].original_price_marketplace)}
                </Text>
              </View>
            )}

            {/* Price Synchronization Status */}
            {platforms[currentIndex].price_match != null && (
              <View style={styles.syncStatusContainer}>
                <Text style={styles.syncLabel}>Status Sinkronisasi:</Text>
                {platforms[currentIndex].price_match === 1 ? (
                  <View style={styles.syncBadgeSuccess}>
                    <Text style={styles.syncBadgeSuccessText}>✅ Sinkron</Text>
                  </View>
                ) : platforms[currentIndex].price_match === 0 ? (
                  <View style={styles.syncBadgeError}>
                    <Text style={styles.syncBadgeErrorText}>❌ Tidak Sinkron</Text>
                  </View>
                ) : (
                  <View style={styles.syncBadgeNeutral}>
                    <Text style={styles.syncBadgeNeutralText}>Tidak ada data</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Stock Information */}
          <View style={styles.priceStockCard}>
            <Text style={styles.stockSectionTitle}>Informasi Stok</Text>

            {/* Local Stock */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Stok Lokal</Text>
              <Text style={styles.stockLocal}>
                {productData.stok ?? '-'}
              </Text>
            </View>

            {/* Marketplace Stock */}
            {platforms[currentIndex].stok_platform != null && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Stok di Marketplace</Text>
                <Text style={styles.stockMarketplace}>
                  {platforms[currentIndex].stok_platform}
                </Text>
              </View>
            )}

            {/* Stock Sync Status + Action */}
            {(() => {
              const localStock = productData.stok;
              const marketStock = platforms[currentIndex].stok_platform;

              if (localStock == null || marketStock == null) {
                return (
                  <View style={styles.syncStatusContainer}>
                    <View style={styles.syncBadgeNeutral}>
                      <Text style={styles.syncBadgeNeutralText}>Tidak ada data</Text>
                    </View>
                  </View>
                );
              }

              const isMatch = Number(localStock) === Number(marketStock);

              return (
                <View style={styles.stockSyncContainer}>
                  {isMatch ? (
                    <View style={styles.syncBadgeSuccess}>
                      <Text style={styles.syncBadgeSuccessText}>✅ Sinkron</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.syncBadgeError}>
                        <Text style={styles.syncBadgeErrorText}>❌ Tidak Sinkron</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.syncButton, syncingStock && styles.syncButtonDisabled]}
                        onPress={handleSyncStock}
                        disabled={syncingStock}
                      >
                        {syncingStock ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="sync-outline" size={16} color="#fff" />
                            <Text style={styles.syncButtonText}>Sync Stok</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })()}
          </View>
        </View>
      )}

      {/* Tambah Baru Modal */}
      <Modal
        visible={showTambahBaru}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTambahBaru(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Marketplace</Text>
            <ScrollView style={styles.modalList}>
              {ecommerceList.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={styles.modalItem}
                  onPress={() => handleTambahBaruSelect(account.id)}
                >
                  <Text style={styles.modalItemText}>
                    {account.platform} - {account.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowTambahBaru(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bind Modal */}
      <Modal
        visible={showBind}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBind(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Marketplace untuk Bind</Text>
            <ScrollView style={styles.modalList}>
              {ecommerceList.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={styles.modalItem}
                  onPress={() => handleBindSelect(account.id)}
                >
                  <Text style={styles.modalItemText}>
                    {account.platform} - {account.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowBind(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Search Online Modal */}
      <SearchOnlineModal
        visible={searchOnlineModal.visible}
        onClose={() => setSearchOnlineModal({ visible: false, from: null, id_ecommerce: 0 })}
        onSelect={handleSearchOnlineSelect}
        id_ecommerce={searchOnlineModal.id_ecommerce}
        platform={ecommerceList.find((acc) => acc.id === searchOnlineModal.id_ecommerce)?.platform}
        from={searchOnlineModal.from || 'BIND'}
        parentVariant={false}
        exclude_id={platforms.map((p) => p.id_online)}
        productName={productData?.nama}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  productHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  productSku: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    marginTop: 12,
    backgroundColor: 'white',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  platformCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  platformCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  platformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformDetails: {
    marginLeft: 12,
    flex: 1,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  shopName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  checkIcon: {
    marginLeft: 8,
  },
  productNameText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  badgeDisconnected: {
    backgroundColor: '#fee2e2',
  },
  badgeTextDisconnected: {
    color: '#991b1b',
  },
  unbindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    gap: 6,
    marginTop: 8,
  },
  unbindText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  infoCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  statusConnected: {
    color: '#059669',
  },
  statusDisconnected: {
    color: '#dc2626',
  },
  statusBadgeContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceStockCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  priceRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  pricePlexSeller: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  priceExpected: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9333ea',
  },
  priceMarketplace: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  priceOriginal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  syncStatusContainer: {
    paddingTop: 12,
  },
  syncLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  syncBadgeSuccess: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  syncBadgeSuccessText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  syncBadgeError: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  syncBadgeErrorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
  },
  syncBadgeNeutral: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  syncBadgeNeutralText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  stockSectionTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  stockLocal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  stockMarketplace: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  stockSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalItemText: {
    fontSize: 16,
    color: '#111827',
  },
  modalCancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});

