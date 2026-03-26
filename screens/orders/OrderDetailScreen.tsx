import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOW_IMAGES_KEY = '@order_detail_show_images';

export type OrderDetail = {
  id: string;
  id_ecommerce: number;
  platform: string;
  ecommerce_name?: string;
  date?: string;
  invoice?: string;
  status?: string;
  total_price?: string | number;
  ekspedisi?: string;
  items?: { sku: string; name: string; qty: number; price?: number; id_online?: string; id_parent?: string; image_url?: string }[];
  orderType?: string;
  booking_sn?: string;
  print_timestamp?: string;
  scanned?: boolean;
  scan_timestamp?: string | null;
};

type Props = NativeStackScreenProps<AppStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen({ route, navigation }: Props) {
  const { id, id_ecommerce, scan_timestamp, print_timestamp, scanned } = route.params;
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [access, setAccess] = useState<{ actions?: { create?: boolean } } | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => { navigation.setOptions({ title: `Order ${id}` }); }, [navigation, id]);

  useEffect(() => { (async () => { try { const res = await ApiService.authenticatedRequest('/access'); if (res?.status) setAccess(res.access); } catch {} })(); }, []);

  // Load showImages preference from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SHOW_IMAGES_KEY);
        if (stored !== null) {
          setShowImages(stored === 'true');
        }
      } catch (e) {
        console.log('Error loading image preference:', e);
      } finally {
        setImagesLoaded(true);
      }
    })();
  }, []);

  // Save showImages preference when it changes (only after initial load)
  useEffect(() => {
    if (!imagesLoaded) return;
    (async () => {
      try {
        await AsyncStorage.setItem(SHOW_IMAGES_KEY, showImages ? 'true' : 'false');
      } catch (e) {
        console.log('Error saving image preference:', e);
      }
    })();
  }, [showImages, imagesLoaded]);

  const fetchOrderDetail = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await ApiService.authenticatedRequest(`/get/ecommerce/order?id=${id}&id_ecommerce=${id_ecommerce}`);
      if (res?.status) {
        const d = res.data;

        const finalPrintTimestamp = print_timestamp || d.print_timestamp || undefined;
        const finalScanned = scanned !== undefined ? scanned : (d.scanned === true || d.scanned === 1 || d.scanned === '1');
        const finalScanTimestamp = scan_timestamp !== undefined ? scan_timestamp : (d.scan_timestamp || null);

        setDetail({
          id: d.id,
          id_ecommerce: d.id_ecommerce || id_ecommerce,
          platform: d.from,
          ecommerce_name: d.ecommerce_name,
          date: d.date,
          invoice: d.invoice,
          status: d.status,
          total_price: d.total_price,
          ekspedisi: d.ekspedisi,
          items: (d.items || []).map((it: any) => ({
            sku: it.sku,
            name: it.name,
            qty: it.qty,
            price: it.price_after_discount ?? it.price,
            id_online: it.id_online,
            id_parent: it.id_parent,
            image_url: it.image_url || it.image || '',
          })),
          orderType: d.orderType,
          booking_sn: d.booking_sn,
          print_timestamp: finalPrintTimestamp,
          scanned: finalScanned,
          scan_timestamp: finalScanTimestamp,
        });
      }
    } catch (e) {
      console.error('order detail error', e);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [id, id_ecommerce]);

  const canCreate = !!access?.actions?.create;

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const createSales = async () => {
    if (!canCreate || !detail) { Alert.alert('Permission', 'You do not have permission'); return; }
    try {
      const body = [{
        platform: detail.platform,
        id: detail.id,
        barang: (detail.items || []).map(it => ({ price: it.price || 0, name: it.name, sku: it.sku, qty: it.qty, id_online: it.id_online, id_parent: it.id_parent })),
        id_ecommerce: detail.id_ecommerce,
        date: typeof detail.date === 'string' ? detail.date : new Date().toISOString(),
        invoice: detail.invoice,
        from_import: false,
        booking_sn: detail.booking_sn,
        orderType: detail.orderType,
        isBookingOrder: !!detail.booking_sn,
      }];
      const res = await ApiService.authenticatedRequest('/ecommerce/pesanan', { method: 'POST', body: JSON.stringify(body) });
      if (res?.status) Alert.alert('Success', 'Sales created.'); else Alert.alert('Failed', res?.reason || 'Failed to create sales');
    } catch (e: any) { console.error('createSales', e); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const printLabel = async () => {
    if (!canCreate || !detail) { Alert.alert('Permission', 'You do not have permission'); return; }
    try {
      const payload = [{ id_ecommerce: detail.id_ecommerce, order_id: detail.id, A6: true }];
      const res = await ApiService.authenticatedRequest('/ecommerce/ship_label', { method: 'POST', body: JSON.stringify(payload) });
      if (!res || res.status === false) { Alert.alert('Failed', res?.reason || 'Failed to get label'); return; }
      const list = Array.isArray(res.data) ? res.data : res;
      const htmlItem = list.find((x: any) => x?.type === 'HTML_ENCODED' && x.data);
      if (htmlItem) {
        navigation.navigate('LabelPreview', { html: String(htmlItem.data), title: `${detail.platform} Label` });
        return;
      }
      Alert.alert('Not supported', 'Label format is not supported on mobile yet. Please print from the web app.');
    } catch (e: any) { console.error('printLabel', e); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const getStatusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('baru') || s.includes('new')) return { bg: '#DBEAFE', text: '#1E40AF' };
    if (s.includes('proses') || s.includes('process')) return { bg: '#FEF3C7', text: '#92400E' };
    if (s.includes('perjalanan') || s.includes('shipping')) return { bg: '#E0E7FF', text: '#3730A3' };
    if (s.includes('selesai') || s.includes('complete')) return { bg: '#D1FAE5', text: '#065F46' };
    if (s.includes('batal') || s.includes('cancel')) return { bg: '#FEE2E2', text: '#991B1B' };
    return { bg: '#F3F4F6', text: '#374151' };
  };

  const statusColors = getStatusColor(detail?.status);

  if (loading) return (
    <SafeAreaView style={styles.safeContainer} edges={['bottom']}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    </SafeAreaView>
  );

  if (!detail) return (
    <SafeAreaView style={styles.safeContainer} edges={['bottom']}>
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchOrderDetail()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Check if any items have images
  const hasAnyImage = (detail.items || []).some(it => !!it.image_url);

  return (
    <SafeAreaView style={styles.safeContainer} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrderDetail(true)}
            tintColor="#f59e0b"
            colors={['#f59e0b']}
          />
        }
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Ionicons name="storefront" size={24} color="#f59e0b" />
              <View style={styles.headerTextContainer}>
                <Text style={styles.platformName}>{detail.ecommerce_name || detail.platform}</Text>
                <Text style={styles.orderId}>Order #{detail.id}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {(detail.status || 'UNKNOWN').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Order Information</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="receipt-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Invoice</Text>
              <Text style={styles.infoValue}>{detail.invoice || 'No Invoice'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="cash-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Total Price</Text>
              <Text style={styles.infoValueHighlight}>
                {typeof detail.total_price === 'number'
                  ? `Rp ${detail.total_price.toLocaleString('id-ID')}`
                  : detail.total_price || '-'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="car-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Shipping</Text>
              <Text style={styles.infoValue}>{detail.ekspedisi || '-'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="pricetag-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Order Type</Text>
              <Text style={styles.infoValue}>{detail.orderType || 'STANDARD'}</Text>
            </View>
          </View>

          {detail.booking_sn && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="bookmark-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Booking SN</Text>
                <Text style={styles.infoValue}>{detail.booking_sn}</Text>
              </View>
            </View>
          )}

          {detail.date && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Order Date</Text>
                <Text style={styles.infoValue}>{detail.date}</Text>
              </View>
            </View>
          )}

          {detail.print_timestamp && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="print-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Print Date</Text>
                <Text style={styles.infoValue}>{formatDate(detail.print_timestamp)}</Text>
              </View>
            </View>
          )}

          {detail.scan_timestamp && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="scan-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Scanned</Text>
                <Text style={[styles.infoValue, styles.scanTimestampHighlight]}>
                  {formatDate(detail.scan_timestamp)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Items Card */}
        <View style={styles.itemsCard}>
          {/* Items header with image toggle */}
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="cube-outline" size={20} color="#111827" />
              <Text style={styles.cardTitle}>Items ({(detail.items || []).length})</Text>
            </View>

            {/* Show/Hide image toggle button */}
            <TouchableOpacity
              style={[
                styles.imageToggleButton,
                showImages && styles.imageToggleButtonActive
              ]}
              onPress={() => setShowImages(prev => !prev)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showImages ? 'eye' : 'eye-off-outline'}
                size={16}
                color={showImages ? '#f59e0b' : '#6B7280'}
              />
              <Text style={[
                styles.imageToggleText,
                showImages && styles.imageToggleTextActive
              ]}>
                {showImages ? 'Sembunyikan Foto' : 'Tampilkan Foto'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Helper text for toggle */}
          {!hasAnyImage && showImages && (
            <View style={styles.noImageHint}>
              <Ionicons name="image-outline" size={14} color="#9CA3AF" />
              <Text style={styles.noImageHintText}>Tidak ada foto produk untuk pesanan ini</Text>
            </View>
          )}

          {(detail.items || []).length === 0 ? (
            <View style={styles.emptyItems}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyItemsText}>No items in this order</Text>
            </View>
          ) : (
            (detail.items || []).map((it, idx) => (
              <View key={`${it.sku}-${idx}`} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  {/* Product image (shown when toggle is ON and image_url exists) */}
                  {showImages && it.image_url ? (
                    <Image
                      source={{ uri: it.image_url }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.itemIconBadge}>
                      <Ionicons name="cube" size={16} color="#f59e0b" />
                    </View>
                  )}
                  <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                </View>
                <View style={styles.itemDetails}>
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>SKU:</Text>
                    <Text style={styles.itemDetailValue}>{it.sku}</Text>
                  </View>
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>Quantity:</Text>
                    <Text style={styles.itemQtyBadge}>×{it.qty}</Text>
                  </View>
                  {it.price !== undefined && (
                    <View style={styles.itemDetailRow}>
                      <Text style={styles.itemDetailLabel}>Price:</Text>
                      <Text style={styles.itemDetailValue}>
                        Rp {(it.price * it.qty).toLocaleString('id-ID')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Action Buttons - Fixed at bottom */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, !canCreate && styles.buttonDisabled]}
          disabled={!canCreate}
          onPress={createSales}
        >
          <Ionicons name="cart" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Create Sales</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton, !canCreate && styles.buttonDisabled]}
          disabled={!canCreate}
          onPress={printLabel}
        >
          <Ionicons name="print" size={20} color="#111827" />
          <Text style={styles.secondaryButtonText}>Print Label</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header Card
  headerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  platformName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Info Card
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  infoValueHighlight: {
    fontSize: 16,
    color: '#f59e0b',
    fontWeight: '700',
  },
  scanTimestampHighlight: {
    color: '#059669',
    fontWeight: '700',
  },

  // Items Card
  itemsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  // Image toggle button
  imageToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    gap: 5,
  },
  imageToggleButtonActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  imageToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  imageToggleTextActive: {
    color: '#92400E',
  },

  // No image hint
  noImageHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  noImageHintText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },

  emptyItems: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyItemsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
  },
  itemDetails: {
    gap: 8,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemDetailValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  itemQtyBadge: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '700',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },

  // Action Buttons
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
