import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';

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
}

interface BindingTabProps {
  productId: number | null;
}

export default function BindingTab({ productId }: BindingTabProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [productData, setProductData] = useState<any>(null);

  useEffect(() => {
    if (productId) {
      fetchData();
    }
  }, [productId]);

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
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="add-circle-outline" size={20} color="#f59e0b" />
          <Text style={styles.actionButtonText}>Tambah Baru</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="link-outline" size={20} color="#2563eb" />
          <Text style={styles.actionButtonText}>Bind</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="sync-outline" size={20} color="#059669" />
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
      {platforms[currentIndex] && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price & Stock Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform:</Text>
              <Text style={styles.infoValue}>{platforms[currentIndex].platform}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Shop:</Text>
              <Text style={styles.infoValue}>{platforms[currentIndex].shop_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Product ID:</Text>
              <Text style={styles.infoValue}>{platforms[currentIndex].id_online}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={[
                styles.infoValue,
                platforms[currentIndex].disconnected ? styles.statusDisconnected : styles.statusConnected
              ]}>
                {platforms[currentIndex].disconnected ? 'Disconnected' : 'Connected'}
              </Text>
            </View>
          </View>
        </View>
      )}
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
});

