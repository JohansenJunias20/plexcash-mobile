import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Image, Modal, Dimensions, StatusBar, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { sendPaymentReminder } from '../../services/ecommerce/paymentReminderService';
import { acceptOrders, rejectCancellation, TCancelRejectReason, cancelSellerOrders } from '../../services/ecommerce/orderService';
import CancelReasonModal from '../../components/CancelReasonModal';
import TolakPesananModal from '../../components/TolakPesananModal';
import { transformErrorMessage } from '../../utils/transformErrorMessage';

const SHOW_IMAGES_KEY = '@order_detail_show_images';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  print?: boolean;
  print_timestamp?: string;
  scanned?: boolean;
  scan_timestamp?: string | null;
  packed?: boolean;
  pack_timestamp?: string | null;
  buyer_username?: string;
  buyer_id?: string | number;
  no_resi?: string;
  shop_id?: string;
  has_penjualan?: boolean;
  has_retur?: boolean;
  package_id?: string[];
  item_pack_id?: number[] | null;
  /** Menunjukkan siapa yang membatalkan pesanan di marketplace: "buyer" | "seller" | "system" */
  cancel_by?: string;
  /** Alasan pembatalan mentah dari marketplace (kode/teks asli platform) */
  cancel_reason?: string;
  /** Waktu pembatalan pesanan sudah final (dari marketplace) */
  date_cancelled?: string;
  /** Waktu pengajuan permintaan pembatalan oleh buyer (status PEMBATALAN, sebelum diterima/ditolak seller) */
  date_cancel_requested?: string;
};

// Menerjemahkan siapa yang membatalkan pesanan (dari data marketplace) ke label Bahasa Indonesia
const translateCancelBy = (cancelBy?: string | null): string => {
  switch ((cancelBy || '').toLowerCase()) {
    case 'buyer': return 'Pembeli';
    case 'seller': return 'Penjual';
    case 'system': return 'Sistem Marketplace';
    default: return 'Tidak Diketahui';
  }
};

// Menerjemahkan kode/teks alasan pembatalan mentah dari marketplace ke Bahasa Indonesia yang mudah dipahami
const translateCancelReason = (cancelReason?: string | null): string | null => {
  if (!cancelReason) return null;
  const map: Record<string, string> = {
    'OUT_OF_STOCK': 'Stok barang habis',
    'CUSTOMER_REQUEST': 'Permintaan pembeli',
    'UNDELIVERABLE_AREA': 'Area tidak terjangkau kurir',
    'COD_NOT_SUPPORTED': 'COD tidak didukung di area ini',
    'Unpaid Order': 'Pesanan tidak dibayar (kadaluarsa)',
    'Failed Delivery': 'Gagal pengiriman',
    'Package delivery failed': 'Gagal pengiriman',
    'Pengiriman paket gagal': 'Gagal pengiriman',
    'Package lost': 'Paket hilang',
    'Paket hilang': 'Paket hilang',
  };
  return map[cancelReason] || cancelReason;
};

type RakMap = {
  hasRak: boolean;
  skuRakMap: Record<string, string>;
  onlineRakMap: Record<string, string>;
};

type Props = NativeStackScreenProps<AppStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen({ route, navigation }: Props) {
  const {
    id,
    id_ecommerce,
    scan_timestamp,
    print_timestamp,
    print,
    scanned,
    booking_sn,
    kilat_order_data,
    packed,
    pack_timestamp,
    buyer_username,
    buyer_id,
    platform,
    ecommerce_name,
    shop_id,
    order_status,
    has_penjualan,
    has_retur,
    source,
  } = route.params;

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [access, setAccess] = useState<{ actions?: { create?: boolean } } | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [processingCancel, setProcessingCancel] = useState(false);
  const [rejectingCancel, setRejectingCancel] = useState(false);
  const [cancelReasonModalVisible, setCancelReasonModalVisible] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [tolakPesananModalVisible, setTolakPesananModalVisible] = useState(false);
  const [isTolakPesananLoading, setIsTolakPesananLoading] = useState(false);
  const [rakMap, setRakMap] = useState<RakMap>({ hasRak: false, skuRakMap: {}, onlineRakMap: {} });

  // Resolve the rak (shelf) location of an item, mirroring the web Pesanan screen:
  // match by SKU first, then fall back to the marketplace binding (id_online).
  // Returns '' when the user has no raks at all or this item is not assigned to one.
  const getRakName = (it: { sku?: string; id_online?: string }): string => {
    if (!rakMap.hasRak) return '';
    const itemSku = String(it.sku || '').trim();
    const idOnline = String(it.id_online || '').trim();
    return rakMap.skuRakMap[itemSku] || (idOnline ? rakMap.onlineRakMap[idOnline] : '') || '';
  };

  const copyToClipboard = async (text: string | undefined | null, label: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Disalin', `${label} berhasil disalin.`);
  };

  const orderStatusUpper = useMemo(() => (detail?.status || '').toUpperCase(), [detail?.status]);

  const isCancellationPending = useMemo(() => {
    return (
      orderStatusUpper === 'PEMBATALAN' ||
      orderStatusUpper === 'IN_CANCEL' ||
      orderStatusUpper.includes('PEMBATALAN') ||
      orderStatusUpper.includes('IN_CANCEL')
    );
  }, [orderStatusUpper]);

  const isAlreadyCancelled = useMemo(() => {
    return (
      orderStatusUpper === 'DIBATALKAN' ||
      orderStatusUpper === 'CANCELLED' ||
      orderStatusUpper === 'CANCELED' ||
      orderStatusUpper === 'BATAL'
    );
  }, [orderStatusUpper]);

  const isUnpaid = useMemo(() => {
    return orderStatusUpper === 'BELUM DIBAYAR' || orderStatusUpper === 'UNPAID';
  }, [orderStatusUpper]);

  const isReturn = useMemo(() => {
    return (
      orderStatusUpper === 'PENGEMBALIAN' ||
      orderStatusUpper === 'RETUR' ||
      orderStatusUpper === 'DIRETUR' ||
      orderStatusUpper === 'TELAH DIRETUR'
    );
  }, [orderStatusUpper]);

  // New order awaiting acceptance — mirrors "PESANAN BARU" tab on the web Pesanan.tsx
  const isPesananBaru = useMemo(() => {
    return (
      orderStatusUpper === 'PESANAN BARU' ||
      orderStatusUpper === 'NEW_ORDER' ||
      orderStatusUpper === 'UNFULFILLED'
    );
  }, [orderStatusUpper]);

  // Order in process / ready to ship — mirrors "SIAP DIKIRIM" / "DIPROSES" tab
  const isDiproses = useMemo(() => {
    return (
      orderStatusUpper === 'DIPROSES' ||
      orderStatusUpper === 'SIAP DIKIRIM' ||
      orderStatusUpper === 'PROCESSED' ||
      orderStatusUpper === 'READY_TO_SHIP' ||
      orderStatusUpper === 'ARRANGED' ||
      orderStatusUpper.includes('PROSES')
    );
  }, [orderStatusUpper]);

  const lightboxImages = useMemo(() => {
    return (detail?.items || []).filter(it => !!it.image_url).map(it => it.image_url as string);
  }, [detail]);

  useEffect(() => {
    const isFromPesananV2 = source === 'pesanan_v2';
    navigation.setOptions({
      title: `Order ${id}`,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4, gap: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color="#f59e0b" />
          <Text style={{ color: '#f59e0b', fontSize: 15, fontWeight: '600' }}>
            {isFromPesananV2 ? 'Pesanan' : 'Scan'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, id, source]);

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

  const fetchRakMap = async () => {
    try {
      const res = await ApiService.post('/get/picking_rak', {});
      if (res?.status && res.has_rak) {
        setRakMap({
          hasRak: true,
          skuRakMap: res.sku_rak_map || {},
          onlineRakMap: res.online_rak_map || {},
        });
      } else {
        setRakMap({ hasRak: false, skuRakMap: {}, onlineRakMap: {} });
      }
    } catch (e) {
      // Rak info is supplementary - never block the order detail because of it
      console.log('Error fetching picking rak map:', e);
    }
  };

  const fetchOrderDetail = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      fetchRakMap();

      const encodedId = encodeURIComponent(id || '');
      const res = await ApiService.authenticatedRequest(`/get/ecommerce/order?id=${encodedId}&id_ecommerce=${id_ecommerce}`);
      if (res?.status) {
        const d = res.data;

        const finalPrintTimestamp = d.print_timestamp || print_timestamp || undefined;
        
        const rawPrint = d.print !== undefined ? d.print : (d.is_printed !== undefined ? d.is_printed : (d.is_print !== undefined ? d.is_print : (d.cetak !== undefined ? d.cetak : d.is_cetak)));
        const finalPrint = (!!rawPrint && rawPrint !== '0' && rawPrint !== 0 && String(rawPrint).toLowerCase() !== 'false') || !!finalPrintTimestamp || print || false;

        const finalScanned = d.scanned !== undefined ? (d.scanned === true || d.scanned === 1 || d.scanned === '1' || String(d.scanned).toLowerCase() === 'true') : (scanned !== undefined ? scanned : false);
        const finalScanTimestamp = d.scan_timestamp !== undefined ? d.scan_timestamp : (scan_timestamp !== undefined ? scan_timestamp : null);
        const finalPacked = d.packed !== undefined ? (d.packed === true || d.packed === 1 || d.packed === '1' || String(d.packed).toLowerCase() === 'true') : (packed !== undefined ? packed : false);
        const finalPackTimestamp = d.pack_timestamp !== undefined ? d.pack_timestamp : (pack_timestamp !== undefined ? pack_timestamp : null);

        const resolvedBuyer = d.buyer_username || d.buyer_name || d.buyer?.username || d.buyer?.name || d.recipient_name || d.customer_name || d.recipient_address?.name || buyer_username || '';
        const resolvedBuyerId = d.buyer_id || d.buyer?.id || d.buyer_user_id || d.buyer_open_id || buyer_id || '';
        const resolvedShopId = d.shop_id || d.id_toko || shop_id || '';
        const resolvedHasPenjualan = d.has_penjualan !== undefined ? (!!d.has_penjualan && d.has_penjualan !== '0' && d.has_penjualan !== 0) : has_penjualan;
        const resolvedHasRetur = d.has_retur !== undefined ? (!!d.has_retur && d.has_retur !== '0' && d.has_retur !== 0) : has_retur;

        setDetail({
          id: d.id || id,
          id_ecommerce: d.id_ecommerce || id_ecommerce,
          platform: d.from || d.platform || platform || 'SHOPEE',
          ecommerce_name: d.ecommerce_name || ecommerce_name,
          date: d.date,
          invoice: d.invoice,
          status: d.status || order_status,
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
          print: finalPrint,
          print_timestamp: finalPrintTimestamp,
          scanned: finalScanned,
          scan_timestamp: finalScanTimestamp,
          packed: finalPacked,
          pack_timestamp: finalPackTimestamp,
          buyer_username: resolvedBuyer,
          buyer_id: resolvedBuyerId,
          no_resi: d.no_resi || d.tracking_number || undefined,
          shop_id: resolvedShopId,
          has_penjualan: resolvedHasPenjualan,
          has_retur: resolvedHasRetur,
          package_id: d.package_id ?? undefined,
          item_pack_id: d.item_pack_id ?? d.item_ids ?? null,
          cancel_by: d.cancel_by || undefined,
          cancel_reason: d.cancel_reason || undefined,
          date_cancelled: d.date_cancelled || undefined,
          date_cancel_requested: d.date_cancel_requested || undefined,
        });
      } else if (booking_sn) {
        // Kilat order: the marketplace API might not support lookup by booking_sn.
        // Use pre-fetched kilat_order_data from navigation params (items, shipping, etc.)
        const kd = kilat_order_data;
        setDetail({
          id: id || booking_sn,
          id_ecommerce,
          platform: kd?.platform || platform || 'SHOPEE',
          ecommerce_name: kd?.ecommerce_name || ecommerce_name,
          date: kd?.tanggal_order,
          invoice: undefined,
          status: kd?.status || order_status || 'PENGIRIMAN KILAT',
          total_price: kd?.total_harga,
          ekspedisi: kd?.nama_kurir,
          items: (kd?.items || []).map((it: any) => ({
            sku: it.sku || '-',
            name: it.nama || it.name || '-',
            qty: it.qty || 1,
            price: it.harga_jual || it.price || 0,
            id_online: undefined,
            id_parent: undefined,
            image_url: '',
          })),
          orderType: 'PENGIRIMAN KILAT',
          booking_sn,
          print: print || false,
          print_timestamp: print_timestamp || undefined,
          scanned: scanned || false,
          scan_timestamp: scan_timestamp || null,
          packed: packed || false,
          pack_timestamp: pack_timestamp || null,
          buyer_username: kd?.buyer_username || buyer_username || '',
          buyer_id: buyer_id || '',
          no_resi: kd?.no_resi || undefined,
          shop_id: shop_id || '',
          has_penjualan: has_penjualan,
          has_retur: has_retur,
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

  const formatDate = (dateString?: string | null, includeSeconds = false): string => {
    if (!dateString) return '';
    try {
      const normalized = typeof dateString === 'string' && dateString.includes(' ') && !dateString.includes('T')
        ? dateString.replace(' ', 'T')
        : dateString;
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...(includeSeconds ? { second: '2-digit' } : {}),
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
      if (res?.status) {
        Alert.alert('Sukses', 'Penjualan berhasil dibuat.');
      } else {
        const rawReason = res?.id?.[0]?.reason || res?.reason;
        Alert.alert('Gagal Membuat Penjualan', transformErrorMessage(rawReason || 'Gagal membuat penjualan.'));
      }
    } catch (e: any) {
      console.error('createSales', e);
      Alert.alert('Gagal Membuat Penjualan', transformErrorMessage(e?.message || 'Terjadi kesalahan saat membuat penjualan.'));
    }
  };

  const handleTerimaPembatalan = () => {
    if (!canCreate || !detail) {
      Alert.alert('Permission', 'You do not have permission');
      return;
    }
    Alert.alert(
      'Konfirmasi Terima Pembatalan',
      `Apakah Anda yakin ingin menerima pembatalan untuk pesanan #${detail.id}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Terima',
          style: 'destructive',
          onPress: executeTerimaPembatalan,
        },
      ]
    );
  };

  const executeTerimaPembatalan = async () => {
    if (!canCreate || !detail) return;
    try {
      setProcessingCancel(true);
      const payload = [{
        platform: detail.platform,
        id: detail.id,
        id_ecommerce: detail.id_ecommerce,
        date: typeof detail.date === 'string' ? detail.date : new Date().toISOString(),
        invoice: detail.invoice,
        from_import: false,
        booking_sn: detail.booking_sn,
        orderType: detail.orderType,
        isBookingOrder: !!detail.booking_sn,
      }];

      const res = await ApiService.authenticatedRequest('/ecommerce/pembatalan/accept', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res?.status) {
        const list = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
        const itemResult = list[0];

        if (itemResult?.status === 'rejected') {
          const rawReason = itemResult.reason;
          const errorMsg = typeof rawReason === 'string'
            ? rawReason
            : (rawReason?.message || JSON.stringify(rawReason || 'Permintaan ditolak oleh marketplace'));
          Alert.alert('Gagal Terima Pembatalan', errorMsg);
          return;
        }

        // Also attempt local sales retur creation if order was previously converted to sales
        try {
          const returPayload = [{
            platform: detail.platform,
            id: detail.id,
            barang: (detail.items || []).map(it => ({
              price: it.price || 0,
              name: it.name,
              sku: it.sku,
              qty: it.qty,
              id_online: it.id_online,
              id_parent: it.id_parent,
            })),
            id_ecommerce: detail.id_ecommerce,
            date: typeof detail.date === 'string' ? detail.date : new Date().toISOString(),
            invoice: detail.invoice,
            from_import: false,
            booking_sn: detail.booking_sn,
            orderType: detail.orderType,
            isBookingOrder: !!detail.booking_sn,
            update_stok: true,
          }];
          await ApiService.authenticatedRequest('/ecommerce/pembatalan', {
            method: 'POST',
            body: JSON.stringify(returPayload),
          }).catch(() => null);
        } catch {}

        Alert.alert('Sukses', 'Pembatalan pesanan berhasil diterima di marketplace.', [
          {
            text: 'OK',
            onPress: () => {
              fetchOrderDetail(true);
            },
          },
        ]);
        setDetail(prev => prev ? { ...prev, status: 'DIBATALKAN' } : null);
      } else {
        const err = res?.reason || res?.message || res?.error || res?.data;
        let errorMessage = 'Gagal memproses pembatalan ke marketplace.';
        if (typeof err === 'string') {
          if (err.includes('<html') || err.includes('<!DOCTYPE')) {
            errorMessage = 'Terjadi kesalahan 500 Internal Server Error di backend.';
          } else {
            errorMessage = err;
          }
        } else if (err) {
          errorMessage = JSON.stringify(err);
        }
        Alert.alert('Gagal', errorMessage);
      }
    } catch (e: any) {
      console.error('executeTerimaPembatalan error', e);
      Alert.alert('Error', e?.message || 'Terjadi kesalahan saat memproses pembatalan');
    } finally {
      setProcessingCancel(false);
    }
  };

  const handleTolakPembatalan = () => {
    if (!canCreate || !detail) {
      Alert.alert('Permission', 'You do not have permission');
      return;
    }
    setCancelReasonModalVisible(true);
  };

  const executeTolakPembatalan = async (reason: TCancelRejectReason) => {
    if (!detail) {
      setCancelReasonModalVisible(false);
      return;
    }
    setRejectingCancel(true);
    try {
      const res = await rejectCancellation([{
        id_online: detail.id,
        cancel_id: detail.id,
        platform: detail.platform,
        id_ecommerce: detail.id_ecommerce,
        tanggal_order: typeof detail.date === 'string' ? detail.date : new Date().toISOString(),
        invoice: detail.invoice,
      }], reason);

      if (res.successCount > 0) {
        setDetail(prev => prev ? { ...prev, status: 'DIBATALKAN' } : null);
        Alert.alert('Sukses', 'Permintaan pembatalan berhasil ditolak.', [
          { text: 'OK', onPress: () => fetchOrderDetail(true) },
        ]);
      } else {
        const failReason = res.results[0]?.reason || 'Gagal menolak pembatalan.';
        Alert.alert('Gagal Tolak Pembatalan', failReason);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Terjadi kesalahan saat menolak pembatalan');
    } finally {
      setRejectingCancel(false);
      setCancelReasonModalVisible(false);
    }
  };

  // Terima Pesanan — mirrors web Pesanan.tsx: ask for shipping method (pickup/dropoff) then accept
  const handleTerimaPesanan = () => {
    if (!canCreate || !detail) {
      Alert.alert('Permission', 'You do not have permission');
      return;
    }
    Alert.alert(
      'Terima Pesanan',
      `Pilih metode pengiriman untuk pesanan ${detail.id}:`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Dropoff (Antar ke Gerai)', onPress: () => executeTerimaPesanan('dropoff') },
        { text: 'Pickup (Kurir Jemput)', onPress: () => executeTerimaPesanan('pickup') },
      ]
    );
  };

  const executeTerimaPesanan = async (method_ship: 'pickup' | 'dropoff') => {
    if (!detail) return;
    setAccepting(true);
    try {
      const res = await acceptOrders([detail], method_ship);
      if (res.successCount > 0) {
        Alert.alert('Sukses', 'Pesanan berhasil diterima.', [
          { text: 'OK', onPress: () => fetchOrderDetail(true) },
        ]);
      } else {
        const rejected = res.rejectedItems[0];
        const hasLogisticsError = res.hasLogisticsError;
        if (method_ship === 'pickup' && hasLogisticsError) {
          Alert.alert(
            'Gagal Booking Pickup',
            `${rejected?.reason || 'Kurir tidak bisa menjemput pesanan ini.'}\n\nApakah Anda ingin mencoba menggunakan metode Dropoff (Antar ke Gerai)?`,
            [
              { text: 'Tutup', style: 'cancel' },
              { text: 'Ganti ke Dropoff', onPress: () => executeTerimaPesanan('dropoff') },
            ]
          );
        } else {
          Alert.alert('Gagal Terima Pesanan', rejected?.reason || 'Pesanan gagal diproses, silakan coba lagi.');
        }
      }
    } catch (e: any) {
      console.error('executeTerimaPesanan error', e);
      Alert.alert('Error', e?.message || 'Terjadi kesalahan saat menerima pesanan');
    } finally {
      setAccepting(false);
    }
  };

  const handleTolakPesanan = () => {
    if (!canCreate || !detail) {
      Alert.alert('Permission', 'Anda tidak memiliki akses.');
      return;
    }
    setTolakPesananModalVisible(true);
  };

  const executeTolakPesanan = async (reasonsByPlatform: Record<string, string>) => {
    if (!detail) {
      setTolakPesananModalVisible(false);
      return;
    }

    setIsTolakPesananLoading(true);
    try {
      const res = await cancelSellerOrders([detail], reasonsByPlatform);

      setTolakPesananModalVisible(false);

      if (res.successCount > 0) {
        setDetail((prev) => (prev ? { ...prev, status: 'DIBATALKAN' } : null));
        Alert.alert('Sukses', 'Pesanan berhasil dibatalkan / ditolak.', [
          { text: 'OK', onPress: () => fetchOrderDetail(true) },
        ]);
      } else {
        const failReason = res.results[0]?.reason || 'Gagal membatalkan pesanan.';
        Alert.alert('Gagal Tolak Pesanan', failReason);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal membatalkan pesanan.');
    } finally {
      setIsTolakPesananLoading(false);
    }
  };

  const printLabel = async () => {
    if (!canCreate || !detail) { Alert.alert('Permission', 'You do not have permission'); return; }
    try {
      const payload = [{ id_ecommerce: detail.id_ecommerce, order_id: detail.id, A6: true }];
      const res = await ApiService.authenticatedRequest('/ecommerce/ship_label', { method: 'POST', body: JSON.stringify(payload) });
      if (!res || res.status === false) { Alert.alert('Failed', res?.reason || 'Failed to get label'); return; }
      
      const list = Array.isArray(res.data) ? res.data : [res];

      // Fetch recipe details if Shopee orders are present
      const shopeeOrders = list.filter((item: any) => !item.error && item.data && item.platform === 'SHOPEE' && item.type === 'data');
      let recipesMap: any = {};
      if (shopeeOrders.length > 0) {
        try {
          const orderIds = shopeeOrders.map((item: any) => item.order_id);
          const recipeRes = await ApiService.authenticatedRequest('/resi_recipe_details', {
            method: 'POST',
            body: JSON.stringify({ order_ids: orderIds }),
          });
          if (recipeRes?.status && Array.isArray(recipeRes.data)) {
            recipesMap = recipeRes.data.reduce((acc: any, row: any) => {
              const orderId = String(row.online_id || row.booking_sn || row.raw_online_id);
              if (!acc[orderId]) acc[orderId] = {};
              const recipeSku = String(row.recipe_sku);
              if (!acc[orderId][recipeSku]) acc[orderId][recipeSku] = [];
              
              const existing = acc[orderId][recipeSku].find((c: any) => c.component_sku === row.component_sku && c.stock_type === row.stock_type && c.warehouse_name === row.warehouse_name);
              if (existing) {
                existing.component_qty += row.component_qty;
              } else {
                acc[orderId][recipeSku].push({
                  recipe_nama: row.recipe_nama,
                  component_nama: row.component_nama,
                  component_sku: row.component_sku,
                  component_qty: row.component_qty,
                  warehouse_name: row.warehouse_name,
                  stock_type: row.stock_type
                });
              }
              return acc;
            }, {});
          }
        } catch (recipeErr) {
          console.warn('Failed to fetch recipe details for labels:', recipeErr);
        }
      }
      
      const { processShippingLabels } = require('../../utils/printHelper');
      const processed = processShippingLabels(list, recipesMap);
      
      if (processed.error) {
        Alert.alert('Failed', processed.error);
        return;
      }
      
      navigation.navigate('LabelPreview', { 
        html: processed.html, 
        pdfUrl: processed.pdfUrl, 
        title: `${detail.platform} Label` 
      });
    } catch (e: any) { console.error('printLabel', e); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const handleChatBuyer = async () => {
    if (!detail) return;

    const currentPlatform = detail.platform || route.params?.platform || 'SHOPEE';
    const buyerName = (detail.buyer_username || route.params?.buyer_username || '').trim();
    const buyerId = String(detail.buyer_id || route.params?.buyer_id || '').trim();

    setChatLoading(true);
    let matchedChat: any = null;

    try {
      // Coba cari percakapan yang sudah ada di /get/ecommerce/chats
      const chatsRes = await ApiService.authenticatedRequest('/get/ecommerce/chats', {
        method: 'GET',
      });

      if (chatsRes?.status && Array.isArray(chatsRes.data)) {
        const chatList = chatsRes.data;
        const buyerNameLower = buyerName.toLowerCase();
        const buyerIdLower = buyerId.toLowerCase();

        matchedChat = chatList.find((c: any) => {
          const matchEcommerce =
            !detail.id_ecommerce || Number(c.id_ecommerce) === Number(detail.id_ecommerce);
          const matchPlatform = !c.platform || c.platform.toUpperCase() === currentPlatform.toUpperCase();

          if (!matchEcommerce && !matchPlatform) return false;

          const cBuyerName = String(c.buyer?.name || c.buyer?.username || c.name || '').toLowerCase().trim();
          const cBuyerId = String(c.buyer?.id || c.buyer_id || '').toLowerCase().trim();

          if (buyerIdLower && cBuyerId && cBuyerId === buyerIdLower) {
            return true;
          }

          if (buyerNameLower && cBuyerName) {
            if (
              cBuyerName === buyerNameLower ||
              cBuyerName.includes(buyerNameLower) ||
              buyerNameLower.includes(cBuyerName)
            ) {
              return true;
            }
          }

          return false;
        });
      }
    } catch (e) {
      console.warn('[OrderDetail] Error fetching chats for buyer match:', e);
    } finally {
      setChatLoading(false);
    }

    // Langsung redirect ke room chat pembeli tanpa alert/modal!
    const targetBuyer = {
      name: matchedChat?.buyer?.name || buyerName || 'Pembeli',
      id: String(matchedChat?.buyer?.id || buyerId || ''),
      thumbnail_url: matchedChat?.buyer?.thumbnail_url || '',
    };

    (navigation as any).navigate('EcommerceChatDetail', {
      msgId: matchedChat?.msg_id || String(buyerId || detail.id || detail.booking_sn || ''),
      idEcommerce: Number(matchedChat?.id_ecommerce || detail.id_ecommerce || route.params?.id_ecommerce || 0),
      buyer: targetBuyer,
      platform: matchedChat?.platform || currentPlatform,
      shopName: matchedChat?.shop_name || matchedChat?.toko_name || detail.ecommerce_name || route.params?.ecommerce_name,
    });
  };

  const handleSendReminder = async () => {
    if (!detail || reminderLoading) return;
    const platform = (detail.platform || '').toUpperCase();
    if (platform === 'TIKTOK') {
      Alert.alert(
        'Platform Belum Mendukung',
        'Platform TikTok belum menyediakan API Seller Chat untuk mengirim pesan langsung ke pembeli.'
      );
      return;
    }

    const orderSn = detail.id || detail.booking_sn || '';
    setReminderLoading(true);
    try {
      const res = await sendPaymentReminder({
        order_id: detail.id,
        order_sn: orderSn,
        buyer_id: detail.buyer_id || '',
        buyer_username: detail.buyer_username || '',
        id_ecommerce: Number(detail.id_ecommerce || 0),
        shop_id: String(detail.shop_id || ''),
        platform: platform,
        custom_message: '',
      });

      if (res.status || res.success) {
        Alert.alert('Sukses', res.message || 'Pesan pengingat pembayaran berhasil dikirim ke pembeli!');
      } else {
        Alert.alert('Gagal', res.reason || 'Gagal mengirim pengingat pembayaran.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Terjadi kesalahan saat mengirim pengingat.');
    } finally {
      setReminderLoading(false);
    }
  };

  const handleCreateRetur = async () => {
    if (!canCreate || !detail) { Alert.alert('Permission', 'Anda tidak memiliki akses.'); return; }
    Alert.alert(
      'Konfirmasi Buat Retur',
      `Buat retur untuk pesanan #${detail.id}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Buat Retur',
          onPress: executeCreateRetur,
        },
      ]
    );
  };

  const executeCreateRetur = async () => {
    if (!canCreate || !detail) return;
    try {
      const payload = [{
        platform: detail.platform,
        id: detail.id,
        barang: (detail.items || []).map(it => ({
          price: it.price || 0,
          name: it.name,
          sku: it.sku,
          qty: it.qty,
          id_online: it.id_online,
          id_parent: it.id_parent,
        })),
        id_ecommerce: detail.id_ecommerce,
        date: typeof detail.date === 'string' ? detail.date : new Date().toISOString(),
        invoice: detail.invoice,
        from_import: false,
        booking_sn: detail.booking_sn,
        orderType: detail.orderType,
        isBookingOrder: !!detail.booking_sn,
        update_stok: true,
      }];

      const res = await ApiService.authenticatedRequest('/ecommerce/pembatalan', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Retur pesanan berhasil dibuat.');
        setDetail(prev => prev ? { ...prev, has_retur: true } : null);
      } else {
        const err = res?.reason || res?.message || 'Gagal membuat retur';
        Alert.alert('Gagal', typeof err === 'string' ? err : JSON.stringify(err));
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal membuat retur');
    }
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
                <View style={styles.copyableRow}>
                  <Text style={styles.orderId} numberOfLines={1}>Order #{detail.id}</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(detail.id, 'Nomor pesanan')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.copyIconButton}
                  >
                    <Ionicons name="copy-outline" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                <Text style={[styles.statusText, { color: statusColors.text }]}>
                  {(detail.status || 'UNKNOWN').toUpperCase()}
                </Text>
              </View>
              {detail.scanned || !!detail.scan_timestamp ? (
                <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 }]}>
                  <Text style={[styles.statusText, { color: '#065F46', fontSize: 10 }]}>SUDAH SCAN</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 }]}>
                  <Text style={[styles.statusText, { color: '#991B1B', fontSize: 10 }]}>BELUM SCAN</Text>
                </View>
              )}
              {detail.packed || !!detail.pack_timestamp ? (
                <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 }]}>
                  <Text style={[styles.statusText, { color: '#065F46', fontSize: 10 }]}>SUDAH PACK</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 }]}>
                  <Text style={[styles.statusText, { color: '#991B1B', fontSize: 10 }]}>BELUM PACK</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Order Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Order Information</Text>

          {isCancellationPending ? (
            <View style={[styles.infoRow, { backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8 }]}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#B45309" />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: '#B45309' }]}>Permintaan Pembatalan Oleh</Text>
                <Text style={[styles.infoValue, { color: '#B45309', fontWeight: '700' }]}>{translateCancelBy(detail.cancel_by)}</Text>
                {translateCancelReason(detail.cancel_reason) ? (
                  <Text style={[styles.infoLabel, { color: '#B45309', marginTop: 2 }]}>Alasan: {translateCancelReason(detail.cancel_reason)}</Text>
                ) : null}
                {detail.date_cancel_requested ? (
                  <Text style={[styles.infoLabel, { color: '#B45309', marginTop: 2 }]}>Waktu Permintaan: {formatDate(detail.date_cancel_requested, true)}</Text>
                ) : null}
              </View>
            </View>
          ) : detail.status === 'DIBATALKAN' ? (
            <View style={[styles.infoRow, { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 }]}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="close-circle-outline" size={20} color="#B91C1C" />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: '#B91C1C' }]}>Dibatalkan Oleh</Text>
                <Text style={[styles.infoValue, { color: '#B91C1C', fontWeight: '700' }]}>{translateCancelBy(detail.cancel_by)}</Text>
                {translateCancelReason(detail.cancel_reason) ? (
                  <Text style={[styles.infoLabel, { color: '#B91C1C', marginTop: 2 }]}>Alasan: {translateCancelReason(detail.cancel_reason)}</Text>
                ) : null}
                {detail.date_cancel_requested ? (
                  <Text style={[styles.infoLabel, { color: '#B91C1C', marginTop: 2 }]}>Waktu Permintaan: {formatDate(detail.date_cancel_requested, true)}</Text>
                ) : null}
                {detail.date_cancelled ? (
                  <Text style={[styles.infoLabel, { color: '#B91C1C', marginTop: 2 }]}>Waktu Dibatalkan: {formatDate(detail.date_cancelled, true)}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {detail.buyer_username ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="person-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Buyer / Pembeli</Text>
                <Text style={styles.infoValue}>{detail.buyer_username}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="receipt-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Invoice</Text>
              <Text style={styles.infoValue}>{detail.invoice || 'No Invoice'}</Text>
            </View>
          </View>

          {detail.no_resi ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="barcode-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nomor Resi</Text>
                <View style={styles.copyableRow}>
                  <Text style={styles.infoValue} numberOfLines={1}>{detail.no_resi}</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(detail.no_resi, 'Nomor resi')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.copyIconButton}
                  >
                    <Ionicons name="copy-outline" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

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

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="print-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Print Date</Text>
              <Text style={styles.infoValue}>
                {detail.print_timestamp 
                  ? formatDate(detail.print_timestamp) 
                  : (detail.print ? 'Sudah Dicetak (Tanggal tidak tersedia)' : 'Belum Cetak')}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="scan-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Scan Date</Text>
              {detail.scan_timestamp ? (
                <Text style={[styles.infoValue, styles.scanTimestampHighlight]}>
                  {formatDate(detail.scan_timestamp, true)}
                </Text>
              ) : (
                <Text style={[styles.infoValue, { color: '#EF4444' }]}>Belum Scan</Text>
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="cube-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Pack Date</Text>
              {detail.pack_timestamp ? (
                <Text style={[styles.infoValue, styles.scanTimestampHighlight]}>
                  {formatDate(detail.pack_timestamp)}
                </Text>
              ) : (
                <Text style={[styles.infoValue, { color: '#EF4444' }]}>Belum Pack</Text>
              )}
            </View>
          </View>
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
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        const idx = lightboxImages.indexOf(it.image_url as string);
                        if (idx !== -1) {
                          setLightboxIndex(idx);
                          setLightboxVisible(true);
                        }
                      }}
                      style={styles.productImageContainer}
                    >
                      <Image
                        source={{ uri: it.image_url }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                      <View style={styles.zoomHint}>
                        <Ionicons name="expand-outline" size={14} color="white" />
                      </View>
                    </TouchableOpacity>
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
                  {!!getRakName(it) && (
                    <View style={styles.itemDetailRow}>
                      <Text style={styles.itemDetailLabel}>Rak:</Text>
                      <View style={styles.itemRakBadge}>
                        <Ionicons name="location-outline" size={12} color="#0369a1" />
                        <Text style={styles.itemRakText}>{getRakName(it)}</Text>
                      </View>
                    </View>
                  )}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionScrollContent}
        >
          {/* Kembali / Scan Lagi */}
          <TouchableOpacity
            style={[styles.actionButton, styles.backButton]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name={source === 'pesanan_v2' ? 'arrow-back-outline' : 'scan-outline'}
              size={18}
              color="#f59e0b"
            />
            <Text style={styles.backButtonText} numberOfLines={1}>
              {source === 'pesanan_v2' ? 'Kembali' : 'Scan Lagi'}
            </Text>
          </TouchableOpacity>

          {/* Chat Pembeli Button - Available in ALL statuses */}
          <TouchableOpacity
            style={[styles.actionButton, styles.chatButton, chatLoading && styles.buttonDisabled]}
            onPress={handleChatBuyer}
            disabled={chatLoading}
          >
            {chatLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />
                <Text style={styles.chatButtonText} numberOfLines={1}>Chat Pembeli</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Status-Aware Action Buttons */}
          {isCancellationPending ? (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.cancelOrderButton,
                  (!canCreate || processingCancel || rejectingCancel) && styles.buttonDisabled,
                ]}
                disabled={!canCreate || processingCancel || rejectingCancel}
                onPress={handleTerimaPembatalan}
              >
                {processingCancel ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.cancelOrderButtonText} numberOfLines={1}>Terima Batal</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.rejectCancelButton,
                  (!canCreate || processingCancel || rejectingCancel) && styles.buttonDisabled,
                ]}
                disabled={!canCreate || processingCancel || rejectingCancel}
                onPress={handleTolakPembatalan}
              >
                {rejectingCancel ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color="#fff" />
                    <Text style={styles.rejectCancelButtonText} numberOfLines={1}>Tolak Batal</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : isAlreadyCancelled ? (
            <View style={[styles.actionButton, styles.cancelledDisabledButton]}>
              <Ionicons name="ban" size={18} color="#6B7280" />
              <Text style={styles.cancelledDisabledButtonText} numberOfLines={1}>Dibatalkan</Text>
            </View>
          ) : isUnpaid ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.reminderButton, reminderLoading && styles.buttonDisabled]}
              disabled={reminderLoading}
              onPress={handleSendReminder}
            >
              {reminderLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="notifications-outline" size={17} color="#fff" />
                  <Text style={styles.reminderButtonText} numberOfLines={1}>Ingatkan Bayar</Text>
                </>
              )}
            </TouchableOpacity>
          ) : isReturn ? (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.returButton,
                (!canCreate || detail.has_retur) && styles.buttonDisabled,
              ]}
              disabled={!canCreate || detail.has_retur}
              onPress={handleCreateRetur}
            >
              <Ionicons name="return-up-back-outline" size={17} color="#fff" />
              <Text style={styles.returButtonText} numberOfLines={1}>
                {detail.has_retur ? 'Sudah Retur' : 'Buat Retur'}
              </Text>
            </TouchableOpacity>
          ) : isPesananBaru ? (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.acceptOrderButton,
                  (!canCreate || accepting) && styles.buttonDisabled,
                ]}
                disabled={!canCreate || accepting}
                onPress={handleTerimaPesanan}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.acceptOrderButtonText} numberOfLines={1}>Terima Pesanan</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.tolakPesananButton,
                  (!canCreate || isTolakPesananLoading) && styles.buttonDisabled,
                ]}
                disabled={!canCreate || isTolakPesananLoading}
                onPress={handleTolakPesanan}
              >
                {isTolakPesananLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={17} color="#fff" />
                    <Text style={styles.tolakPesananButtonText} numberOfLines={1}>Tolak Pesanan</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : isDiproses ? (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.primaryButton,
                  (!canCreate || detail.has_penjualan) && styles.buttonDisabled,
                ]}
                disabled={!canCreate || detail.has_penjualan}
                onPress={createSales}
              >
                <Ionicons name="cart-outline" size={17} color="#fff" />
                <Text style={styles.primaryButtonText} numberOfLines={1}>
                  {detail.has_penjualan ? 'Sales Dibuat' : 'Buat Sales'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, !canCreate && styles.buttonDisabled]}
                disabled={!canCreate}
                onPress={printLabel}
              >
                <Ionicons name="print-outline" size={17} color="#111827" />
                <Text style={styles.secondaryButtonText} numberOfLines={1}>Print</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.tolakPesananButton,
                  (!canCreate || isTolakPesananLoading) && styles.buttonDisabled,
                ]}
                disabled={!canCreate || isTolakPesananLoading}
                onPress={handleTolakPesanan}
              >
                {isTolakPesananLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={17} color="#fff" />
                    <Text style={styles.tolakPesananButtonText} numberOfLines={1}>Tolak Pesanan</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.primaryButton,
                  (!canCreate || detail.has_penjualan) && styles.buttonDisabled,
                ]}
                disabled={!canCreate || detail.has_penjualan}
                onPress={createSales}
              >
                <Ionicons name="cart-outline" size={17} color="#fff" />
                <Text style={styles.primaryButtonText} numberOfLines={1}>
                  {detail.has_penjualan ? 'Sales Dibuat' : 'Buat Sales'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, !canCreate && styles.buttonDisabled]}
                disabled={!canCreate}
                onPress={printLabel}
              >
                <Ionicons name="print-outline" size={17} color="#111827" />
                <Text style={styles.secondaryButtonText} numberOfLines={1}>Print</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Tolak Pesanan — Seller Cancellation Modal */}
      <TolakPesananModal
        visible={tolakPesananModalVisible}
        orders={detail ? [detail] : []}
        loading={isTolakPesananLoading}
        onClose={() => !isTolakPesananLoading && setTolakPesananModalVisible(false)}
        onConfirm={executeTolakPesanan}
      />

      {/* Tolak Pembatalan — Reason Modal */}
      <CancelReasonModal
        visible={cancelReasonModalVisible}
        orderCount={1}
        loading={rejectingCancel}
        onClose={() => !rejectingCancel && setCancelReasonModalVisible(false)}
        onConfirm={executeTolakPembatalan}
      />

      {/* Lightbox Modal */}
      <Modal
        visible={lightboxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxVisible(false)}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setLightboxVisible(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          {/* Image Counter */}
          {lightboxImages.length > 1 && (
            <View style={styles.lightboxCounter}>
              <Text style={styles.lightboxCounterText}>
                {lightboxIndex + 1} / {lightboxImages.length}
              </Text>
            </View>
          )}

          {/* Main Image */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Image
              source={{ uri: lightboxImages[lightboxIndex] }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          </Pressable>

          {/* Navigation Buttons */}
          {lightboxImages.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.lightboxNavBtn, styles.lightboxNavLeft]}
                onPress={(e) => {
                  (e as any).stopPropagation?.();
                  setLightboxIndex(prev => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
                }}
              >
                <Ionicons name="chevron-back" size={32} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lightboxNavBtn, styles.lightboxNavRight]}
                onPress={(e) => {
                  (e as any).stopPropagation?.();
                  setLightboxIndex(prev => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
                }}
              >
                <Ionicons name="chevron-forward" size={32} color="white" />
              </TouchableOpacity>
            </>
          )}

          {/* Dot Indicators */}
          {lightboxImages.length > 1 && (
            <View style={styles.lightboxDots}>
              {lightboxImages.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setLightboxIndex(i)}
                  style={[
                    styles.lightboxDot,
                    i === lightboxIndex && styles.lightboxDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </Pressable>
      </Modal>
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
    flexShrink: 1,
  },
  copyableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyIconButton: {
    marginLeft: 6,
    padding: 2,
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
    flexShrink: 1,
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
  productImageContainer: {
    marginRight: 12,
    position: 'relative',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 3,
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
  itemRakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 1,
  },
  itemRakText: {
    fontSize: 14,
    color: '#0369a1',
    fontWeight: '700',
    flexShrink: 1,
  },

  // Action Buttons
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  actionScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    flexGrow: 1,
  },
  actionButton: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  // Lightbox styles
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    padding: 8,
  },
  lightboxCounter: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 10,
  },
  lightboxCounterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  lightboxNavBtn: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    padding: 10,
    zIndex: 10,
  },
  lightboxNavLeft: {
    left: 16,
  },
  lightboxNavRight: {
    right: 16,
  },
  lightboxDots: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
  },
  lightboxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  lightboxDotActive: {
    backgroundColor: 'white',
    width: 20,
    borderRadius: 4,
  },
  primaryButton: {
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  chatButton: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  reminderButton: {
    backgroundColor: '#D97706',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  reminderButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  returButton: {
    backgroundColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  returButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  acceptOrderButton: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  acceptOrderButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  backButton: {
    flex: 0,
    minWidth: 72,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelOrderButton: {
    flex: 1,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelOrderButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectCancelButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  rejectCancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelledDisabledButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelledDisabledButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  tolakPesananButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tolakPesananButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
