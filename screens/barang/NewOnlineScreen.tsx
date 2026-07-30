import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import ApiService from '../../services/api';
import SearchBarangModal, { BarangItem } from '../../components/SearchBarangModal';
import NewOnlineModal from '../../components/NewOnlineModal';
import * as ImagePicker from 'expo-image-picker';

type RouteProps = RouteProp<AppStackParamList, 'NewOnline'>;
type NavProps = NativeStackNavigationProp<AppStackParamList, 'NewOnline'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductDetail {
  id: number;
  nama: string;
  sku: string;
  merk?: string;
  kategori?: string;
  satuan?: string;
  stok?: number;
  jumlah_online?: number;
  hargajual?: number;
  hargajual2?: number;
  hpp?: number;
  berat?: number;
  foto?: string;
  image?: string;
  image_url?: string;
  gambar?: string;
  images?: string[];
}

interface PlatformItem {
  platform: string;
  shop_name?: string;
  product_name?: string;
  price_marketplace?: number;
  stok_platform?: number;
  disconnected?: boolean;
  tiktok_status?: string;
  images?: string[];
  image_url?: string;
}

export default function NewOnlineScreen(): JSX.Element {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const initialProductId = route.params?.id;

  const [productId, setProductId] = useState<number | null>(initialProductId || null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [platforms, setPlatforms] = useState<PlatformItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Local uploaded/picked images
  const [localImages, setLocalImages] = useState<string[]>([]);
  
  // Image Lightbox viewer state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [lightboxVisible, setLightboxVisible] = useState<boolean>(false);

  // Modals state
  const [showSearchModal, setShowSearchModal] = useState<boolean>(!initialProductId);
  const [showOnlineModal, setShowOnlineModal] = useState<boolean>(false);

  // Update productId when route parameter changes
  useEffect(() => {
    if (route.params?.id) {
      setProductId(route.params.id);
    }
  }, [route.params?.id]);

  // Load product & online platform data
  const loadProductData = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Sesi Berakhir', 'Silakan login kembali');
        return;
      }

      // 1. Fetch master barang detail
      const masterRes = await fetch(`${API_BASE_URL}/get/masterbarang/condition/and/id:equal:${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const masterJson = await masterRes.json();

      if (masterJson?.status && masterJson?.data?.[0]) {
        setProduct(masterJson.data[0]);
      } else {
        Alert.alert('Error', masterJson?.reason || 'Gagal memuat detail barang');
      }

      // 2. Fetch online platforms binding & images
      try {
        const platformRes = await ApiService.authenticatedRequest(
          `/get/ecommerce/ALL/product?id_database=${productId}&from=masterbarang`
        );
        if (platformRes?.status && Array.isArray(platformRes.data)) {
          setPlatforms(platformRes.data);
        }
      } catch (err) {
        console.warn('Gagal memuat data platform online:', err);
      }

    } catch (e) {
      console.error('Error fetching product data:', e);
      Alert.alert('Error', 'Gagal memuat data produk');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProductData();
  };

  // Compile all images from masterbarang, platform bindings, and local uploads
  const allImages = useMemo(() => {
    const imagesList: string[] = [];

    // Master barang images
    if (product) {
      if (Array.isArray(product.images)) {
        product.images.forEach(img => img && imagesList.push(img));
      }
      const prodAny = product as any;
      if (prodAny.foto) imagesList.push(prodAny.foto);
      if (prodAny.image) imagesList.push(prodAny.image);
      if (prodAny.image_url) imagesList.push(prodAny.image_url);
      if (prodAny.gambar) imagesList.push(prodAny.gambar);
      if (prodAny.picture) imagesList.push(prodAny.picture);
      if (prodAny.product_image) imagesList.push(prodAny.product_image);
      if (prodAny.productImage) imagesList.push(prodAny.productImage);
    }

    // Platform images
    platforms.forEach(p => {
      if (Array.isArray(p.images)) {
        p.images.forEach(img => img && imagesList.push(img));
      }
      const pAny = p as any;
      if (pAny.image_url) imagesList.push(pAny.image_url);
      if (pAny.image) imagesList.push(pAny.image);
      if (pAny.picture) imagesList.push(pAny.picture);
      if (pAny.url && typeof pAny.url === 'string' && pAny.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        imagesList.push(pAny.url);
      }
    });

    // Local picked images
    localImages.forEach(img => imagesList.push(img));

    // Filter duplicates & invalid empty strings
    return Array.from(new Set(imagesList.filter(img => typeof img === 'string' && img.trim().length > 0)));
  }, [product, platforms, localImages]);

  // Handle Pick Image from device library
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Izin Ditolak', 'Izin akses galeri dibutuhkan untuk memilih gambar produk.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris = result.assets.map(asset => asset.uri);
        setLocalImages(prev => [...prev, ...newUris]);
        Alert.alert('Berhasil', `${newUris.length} gambar berhasil ditambahkan ke pratinjau.`);
      }
    } catch (e) {
      console.error('Error picking image:', e);
      Alert.alert('Error', 'Gagal memilih gambar.');
    }
  };

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    setLightboxVisible(true);
  };

  const closeLightbox = () => {
    setLightboxVisible(false);
  };

  const nextImage = () => {
    if (allImages.length > 0) {
      setSelectedImageIndex(prev => (prev < allImages.length - 1 ? prev + 1 : 0));
    }
  };

  const prevImage = () => {
    if (allImages.length > 0) {
      setSelectedImageIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1));
    }
  };

  const handleSelectProduct = (selectedItems: BarangItem[]) => {
    if (selectedItems && selectedItems.length > 0) {
      const selected = selectedItems[0];
      setProductId(selected.id);
      setLocalImages([]);
      setShowSearchModal(false);
    }
  };

  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null || value === 0) return 'Rp 0';
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  const getPlatformColor = (platform: string): string => {
    switch ((platform || '').toUpperCase()) {
      case 'SHOPEE': return '#ee4d2d';
      case 'TOKOPEDIA': return '#42b549';
      case 'LAZADA': return '#0f146d';
      case 'TIKTOK': return '#000000';
      default: return '#6B7280';
    }
  };

  if (loading && !refreshing && productId) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat gambar & data produk online...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#f59e0b" />

      {/* Top Product Selector Bar */}
      <View style={styles.topSelectorBar}>
        <View style={styles.topSelectorLeft}>
          <Ionicons name="cube-outline" size={20} color="#f59e0b" />
          <Text style={styles.topSelectorTitle} numberOfLines={1}>
            {product ? `${product.nama} (${product.sku})` : 'Pilih Produk Online'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.changeProductBtn}
          onPress={() => setShowSearchModal(true)}
        >
          <Ionicons name="search" size={16} color="#ffffff" />
          <Text style={styles.changeProductBtnText}>
            {product ? 'Ganti' : 'Cari'}
          </Text>
        </TouchableOpacity>
      </View>

      {!productId || !product ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Ionicons name="image-outline" size={64} color="#f59e0b" />
            <Text style={styles.emptyTitle}>Tampilkan Gambar Produk</Text>
            <Text style={styles.emptySub}>
              Pilih atau cari produk untuk melihat gambar produk, foto dari marketplace, dan mengelola toko online.
            </Text>
            <TouchableOpacity
              style={styles.selectProductBtn}
              onPress={() => setShowSearchModal(true)}
            >
              <Ionicons name="search-outline" size={20} color="#ffffff" />
              <Text style={styles.selectProductBtnText}>Cari & Pilih Produk</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f59e0b']} />
          }
        >
          {/* Section 1: Product Images Gallery */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="images-outline" size={20} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Gambar Produk ({allImages.length})</Text>
              </View>
              <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImage}>
                <Ionicons name="add-circle-outline" size={18} color="#f59e0b" />
                <Text style={styles.addImageBtnText}>Tambah Foto</Text>
              </TouchableOpacity>
            </View>

            {/* Featured Image display */}
            {allImages.length > 0 ? (
              <View style={styles.featuredImageWrapper}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.featuredImageTouch}
                  onPress={() => openLightbox(selectedImageIndex)}
                >
                  <Image
                    source={{ uri: allImages[selectedImageIndex] }}
                    style={styles.featuredImage}
                    resizeMode="cover"
                  />
                  <View style={styles.zoomBadge}>
                    <Ionicons name="expand" size={14} color="#ffffff" />
                    <Text style={styles.zoomBadgeText}>Perbesar</Text>
                  </View>
                  <View style={styles.counterBadge}>
                    <Text style={styles.counterBadgeText}>
                      {selectedImageIndex + 1} / {allImages.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Horizontal thumbnail selector */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbnailScroll}
                  contentContainerStyle={styles.thumbnailScrollContainer}
                >
                  {allImages.map((uri, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedImageIndex(idx)}
                      style={[
                        styles.thumbnailItem,
                        selectedImageIndex === idx && styles.thumbnailActive,
                      ]}
                    >
                      <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.addThumbnailTile} onPress={handlePickImage}>
                    <Ionicons name="camera-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.addThumbnailText}>+ Foto</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            ) : (
              /* Empty image state */
              <View style={styles.noImageCard}>
                <Ionicons name="images" size={48} color="#d1d5db" />
                <Text style={styles.noImageTitle}>Belum Ada Gambar Produk</Text>
                <Text style={styles.noImageSub}>
                  Tambahkan foto produk dari galeri perangkat Anda untuk ditampilkan.
                </Text>
                <TouchableOpacity style={styles.uploadImageBtn} onPress={handlePickImage}>
                  <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />
                  <Text style={styles.uploadImageBtnText}>Pilih Foto dari Galeri</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Section 2: Product Overview Card */}
          <View style={styles.sectionCard}>
            <Text style={styles.productName}>{product.nama}</Text>
            <Text style={styles.productSku}>SKU: {product.sku || '-'}</Text>

            <View style={styles.badgeRow}>
              {product.merk && (
                <View style={styles.infoBadge}>
                  <Ionicons name="pricetag-outline" size={12} color="#4b5563" />
                  <Text style={styles.infoBadgeText}>{product.merk}</Text>
                </View>
              )}
              {product.kategori && (
                <View style={styles.infoBadge}>
                  <Ionicons name="folder-outline" size={12} color="#4b5563" />
                  <Text style={styles.infoBadgeText}>{product.kategori}</Text>
                </View>
              )}
              {product.satuan && (
                <View style={styles.infoBadge}>
                  <Ionicons name="cube-outline" size={12} color="#4b5563" />
                  <Text style={styles.infoBadgeText}>{product.satuan}</Text>
                </View>
              )}
            </View>

            {/* Price & Stock Grid */}
            <View style={styles.gridContainer}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Stok Master</Text>
                <Text style={styles.gridValue}>{product.stok ?? 0}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Stok Online</Text>
                <Text style={styles.gridValueHighlight}>{product.jumlah_online ?? 0}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Harga Jual 1</Text>
                <Text style={styles.gridValue}>{formatCurrency(product.hargajual)}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Harga Jual 2</Text>
                <Text style={styles.gridValue}>{formatCurrency(product.hargajual2)}</Text>
              </View>
            </View>
          </View>

          {/* Section 3: Online Platforms & Marketplace Bindings */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="globe-outline" size={20} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Status Toko Online ({platforms.length})</Text>
              </View>
              <TouchableOpacity
                style={styles.manageOnlineBtn}
                onPress={() => setShowOnlineModal(true)}
              >
                <Ionicons name="settings-outline" size={16} color="#ffffff" />
                <Text style={styles.manageOnlineBtnText}>Kelola Online</Text>
              </TouchableOpacity>
            </View>

            {platforms.length > 0 ? (
              platforms.map((p, idx) => {
                const platformImg = p.image_url || (Array.isArray(p.images) && p.images[0]) || (p as any).image || (p as any).picture || (p as any).foto || allImages[0];
                return (
                  <View key={idx} style={styles.platformCard}>
                    <View style={styles.platformHeader}>
                      <View
                        style={[
                          styles.platformBadge,
                          { backgroundColor: getPlatformColor(p.platform) },
                        ]}
                      >
                        <Text style={styles.platformBadgeText}>
                          {(p.platform || 'MARKETPLACE').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.platformShopName} numberOfLines={1}>
                        {p.shop_name || p.product_name || 'Toko Connected'}
                      </Text>
                    </View>

                    {/* Bind Product Info with Thumbnail */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, backgroundColor: '#ffffff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#f3f4f6' }}>
                      {platformImg ? (
                        <Image
                          source={{ uri: platformImg }}
                          style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: '#f9fafb' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' }}>
                          <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '500' }}>Produk Bind:</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }} numberOfLines={2}>
                          {p.product_name || product?.nama || '(Nama produk belum tersedia)'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.platformDetails}>
                      <Text style={styles.platformDetailText}>
                        Harga: <Text style={styles.platformDetailBold}>{formatCurrency(p.price_marketplace)}</Text>
                      </Text>
                      <Text style={styles.platformDetailText}>
                        Stok Platform: <Text style={styles.platformDetailBold}>{p.stok_platform ?? '-'}</Text>
                      </Text>
                    </View>

                    {p.tiktok_status && (
                      <View style={styles.tiktokStatusBadge}>
                        <Text style={styles.tiktokStatusText}>Status: {p.tiktok_status}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyPlatformBox}>
                <Ionicons name="cloud-offline-outline" size={32} color="#9ca3af" />
                <Text style={styles.emptyPlatformText}>Belum terhubung ke platform online</Text>
                <TouchableOpacity
                  style={styles.bindBtn}
                  onPress={() => setShowOnlineModal(true)}
                >
                  <Text style={styles.bindBtnText}>Hubungkan Produk Sekarang</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Lightbox Fullscreen Modal */}
      <Modal
        visible={lightboxVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeLightbox}
      >
        <View style={styles.lightboxContainer}>
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={closeLightbox}>
            <Ionicons name="close-circle" size={36} color="#ffffff" />
          </TouchableOpacity>

          {allImages.length > 0 && (
            <View style={styles.lightboxContent}>
              <Image
                source={{ uri: allImages[selectedImageIndex] }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />

              {/* Navigation arrows if multiple images */}
              {allImages.length > 1 && (
                <>
                  <TouchableOpacity style={styles.leftArrow} onPress={prevImage}>
                    <Ionicons name="chevron-back" size={36} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rightArrow} onPress={nextImage}>
                    <Ionicons name="chevron-forward" size={36} color="#ffffff" />
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.lightboxCounter}>
                <Text style={styles.lightboxCounterText}>
                  {selectedImageIndex + 1} / {allImages.length}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Search Product Modal */}
      <SearchBarangModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelect={handleSelectProduct}
        multiSelect={false}
        title="Pilih Barang Online"
      />

      {/* Full Web Parity Online Management Modal */}
      <NewOnlineModal
        visible={showOnlineModal}
        productId={productId}
        onClose={() => {
          setShowOnlineModal(false);
          loadProductData();
        }}
        from="masterbarang"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  topSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  topSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  topSelectorTitle: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  changeProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeProductBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  selectProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  selectProductBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  addImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addImageBtnText: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
    marginLeft: 4,
  },
  featuredImageWrapper: {
    alignItems: 'center',
  },
  featuredImageTouch: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  counterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailScroll: {
    marginTop: 12,
    width: '100%',
  },
  thumbnailScrollContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  thumbnailItem: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#f3f4f6',
  },
  thumbnailActive: {
    borderColor: '#f59e0b',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  addThumbnailTile: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  addThumbnailText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 2,
  },
  noImageCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  noImageTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
  },
  noImageSub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  uploadImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 16,
  },
  uploadImageBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 24,
  },
  productSku: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoBadgeText: {
    fontSize: 12,
    color: '#4b5563',
    marginLeft: 4,
    fontWeight: '500',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  gridItem: {
    width: '50%',
    paddingVertical: 6,
  },
  gridLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  gridValueHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#d97706',
    marginTop: 2,
  },
  manageOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  manageOnlineBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  platformCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  platformBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  platformShopName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  platformDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  platformDetailText: {
    fontSize: 13,
    color: '#4b5563',
  },
  platformDetailBold: {
    fontWeight: '600',
    color: '#111827',
  },
  tiktokStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
  },
  tiktokStatusText: {
    fontSize: 11,
    color: '#3730a3',
    fontWeight: '600',
  },
  emptyPlatformBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyPlatformText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
  },
  bindBtn: {
    marginTop: 12,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  bindBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 44,
    right: 20,
    zIndex: 10,
  },
  lightboxContent: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  leftArrow: {
    position: 'absolute',
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 24,
    padding: 6,
  },
  rightArrow: {
    position: 'absolute',
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 24,
    padding: 6,
  },
  lightboxCounter: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  lightboxCounterText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
