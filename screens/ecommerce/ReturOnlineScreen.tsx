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
  Modal,
  Alert,
  Platform,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../../services/api';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import BaganAkunSearchModal from './components/BaganAkunSearchModal';

// Platform UI Styling Utilities
const PLATFORM_BRANDS: { [key: string]: { color: string; label: string; icon: string } } = {
  SHOPEE: { color: '#EE4D2D', label: 'Shopee', icon: 'logo-windows' },
  TOKOPEDIA: { color: '#42B549', label: 'Tokopedia', icon: 'logo-android' },
  LAZADA: { color: '#0F146D', label: 'Lazada', icon: 'logo-apple' },
  TIKTOK: { color: '#000000', label: 'TikTok', icon: 'logo-tiktok' },
};

const getPlatformBrand = (platform: string) => {
  const plat = (platform || '').toUpperCase();
  return PLATFORM_BRANDS[plat] || { color: '#6366f1', label: platform || 'Other', icon: 'storefront-outline' };
};

// Formatting helpers
const formatRupiah = (value: number) => {
  if (value === undefined || value === null) return 'Rp 0';
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
};

const customReasonMessage = (reason: string) => {
  switch (reason) {
    case 'MISSING':
      return 'Barang tidak lengkap';
    case 'NOT ARRIVE':
      return 'Barang tidak sampai';
    case 'WRONG_ITEM':
      return 'Barang salah';
    case 'PRODUCT_DAMAGED':
      return 'Barang rusak';
    case 'UNKNOWN':
      return 'Alasan tidak diketahui';
    default:
      return reason || 'Alasan tidak diketahui';
  }
};

const customSolutionMessage = (solution: string) => {
  switch (solution) {
    case 'REFUND_WITH_RETURN':
      return 'Barang dikembalikan';
    case 'REFUND_NO_RETURN':
      return 'Dana dikembalikan (Barang tidak dikembalikan)';
    case 'CLOSED':
      return 'Complain ditutup';
    case 'SWAP_ITEM':
      return 'Barang ditukar';
    case 'SEND_REMAINING':
      return 'Kirim barang tersisa';
    case 'UNKNOWN':
      return 'Alasan tidak diketahui';
    default:
      return solution || 'Alasan tidak diketahui';
  }
};

const toBool = (val: any) => {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '0' && s !== 'false' && s !== '' && s !== 'null';
  }
  return !!val;
};

const isValidTimestamp = (val: any) => {
  if (val === undefined || val === null || val === '') return false;
  const s = String(val).trim();
  return s !== '0000-00-00 00:00:00' && s !== 'null' && s !== 'undefined' && s !== 'Invalid date';
};


export default function ReturOnlineScreen() {
  const navigation = useNavigation();

  // Tab & state filters
  const [Tipe, setTipe] = useState<'komplain' | 'lainnya'>('komplain');
  const [Reason, setReason] = useState<'pengiriman_gagal' | 'dibatalkan'>('pengiriman_gagal');
  const [MenuIndex, setMenuIndex] = useState<'pending' | 'disetujui' | 'ditolak'>('pending');

  // E-Commerce Shop Filters
  const [CurrentEcommerce, setCurrentEcommerce] = useState<{ id: number; name: string; platform: string }>({
    id: 0,
    name: 'Semua',
    platform: '',
  });
  const [ecommerceList, setEcommerceList] = useState<any[]>([]);

  // Date Filters
  const [dateStart, setDateStart] = useState<moment.Moment>(moment().subtract(1, 'week').startOf('day'));
  const [dateEnd, setDateEnd] = useState<moment.Moment>(moment().endOf('day'));
  const [showDatePickerStart, setShowDatePickerStart] = useState(false);
  const [showDatePickerEnd, setShowDatePickerEnd] = useState(false);

  // Settings & Modes
  const [PengirimanGagalMethod, setPengirimanGagalMethod] = useState<'OTOMATIS' | 'MANUAL' | null>(null);

  // Data List states
  const [data, setData] = useState<any[]>([]);
  const [data2, setData2] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);

  // Bagan Akun (COA) for PlexSeller Approval
  const [baganAkunPembayaran, setBaganAkunPembayaran] = useState({ kodeBA: -1, keterangan: '' });
  const [showBaganAkunModal, setShowBaganAkunModal] = useState(false);

  // Column visibility selector states
  const [colVisibility, setColVisibility] = useState({
    print: true,
    scanout: true,
    pack: true,
  });
  const [showColVisibilityModal, setShowColVisibilityModal] = useState(false);

  // Search filter (for manual shipping failures)
  const [searchPengirimanGagal, setSearchPengirimanGagal] = useState('');

  // Bulk actions selection
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Detail Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRowForDetail, setSelectedRowForDetail] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailToko, setDetailToko] = useState('');
  const [detailPlatform, setDetailPlatform] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  // Processing indicators
  const [processingBulk, setProcessingBulk] = useState(false);
  const [processingRowId, setProcessingRowId] = useState<string | null>(null);

  // INITIAL MOUNT EFFECTS
  useEffect(() => {
    const initSetup = async () => {
      try {
        setFetching(true);
        // Fetch Ecommerce Shop List
        const shopRes = await ApiService.get('/get/ecommerce');
        if (shopRes?.status) {
          const approved = (shopRes.data || []).filter((shop: any) => shop.status === 'APPROVED');
          setEcommerceList(approved);
        }

        // Fetch Payout Settings
        const settingsRes = await ApiService.get('/get/settings');
        if (settingsRes?.status) {
          const pgMode = (settingsRes.data || []).find((s: any) => s.setting === 'pengirimangagal_mode');
          setPengirimanGagalMethod(pgMode?.value || 'OTOMATIS');
        } else {
          setPengirimanGagalMethod('OTOMATIS');
        }
      } catch (error) {
        console.error('[ReturOnline] Setup error:', error);
        setPengirimanGagalMethod('OTOMATIS');
      } finally {
        setFetching(false);
      }
    };

    initSetup();
  }, []);

  // FETCH RETURNS DATA
  const fetchReturnsData = async () => {
    if (PengirimanGagalMethod === null) return;
    try {
      setFetching(true);
      setData([]);
      setData2([]);
      setSelectedRowIds(new Set());

      const startStr = dateStart.startOf('day').format('YYYY-MM-DD HH:mm:ss');
      const endStr = dateEnd.endOf('day').format('YYYY-MM-DD HH:mm:ss');

      if (Tipe === 'komplain') {
        const url = `/get/returonline?online=1&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
        const res = await ApiService.get(url);
        if (res?.status && Array.isArray(res.data)) {
          const mapped = res.data.map((rd: any) => ({
            ...rd,
            check: false,
            id: rd.id_reverse,
            error_reason: '',
          }));
          setData(mapped);
        } else {
          Alert.alert('Error', res?.reason || 'Gagal memuat data komplain');
        }
      } else {
        const url = `/get/returonline?tipe=lainnya&pengirimangagalMethod=${PengirimanGagalMethod}&reason=${Reason}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
        const res = await ApiService.get(url);
        if (res?.status && Array.isArray(res.data)) {
          const dataLainnya = res.data;
          if (PengirimanGagalMethod === 'MANUAL') {
            if (Reason === 'pengiriman_gagal') {
              const res2 = await ApiService.get(`/get/pengirimangagal?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`);
              if (res2?.status && Array.isArray(res2.data)) {
                const manualPG = res2.data;
                const filteredGeneral = dataLainnya.filter(
                  (df: any) => df.reason !== 'komplain' && df.reason !== 'pengiriman_gagal'
                );
                const mappedManual = manualPG.map((rd: any) => ({
                  ...rd,
                  check: false,
                  reason: 'pengiriman_gagal',
                  approved: rd.status === 'pending' ? 0 : rd.status === 'approved' ? 1 : -1,
                }));
                const final = [...filteredGeneral, ...mappedManual];
                setData2(final.filter((df: any) => df.reason === Reason));
              } else {
                Alert.alert('Error', res2?.reason || 'Gagal memuat manual pengiriman gagal');
              }
            } else {
              const filtered = dataLainnya.filter(
                (df: any) => df.reason !== 'komplain' && df.reason === Reason
              );
              setData2(filtered.map((rd: any) => ({ ...rd, check: false })));
            }
          } else {
            const filtered = dataLainnya.filter(
              (df: any) => df.approved && df.reason !== 'komplain' && df.reason === Reason
            );
            setData2(filtered.map((rd: any) => ({ ...rd, check: false })));
          }
        } else {
          Alert.alert('Error', res?.reason || 'Gagal memuat data lainnya');
        }
      }
    } catch (error) {
      console.error('[ReturOnline] Fetch data error:', error);
      Alert.alert('Error', 'Terjadi kesalahan jaringan saat memuat data');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchReturnsData();
  }, [Tipe, Reason, PengirimanGagalMethod]);

  // DATE PICKERS CHANGE HANDLERS
  const onDateStartChange = (event: any, selectedDate?: Date) => {
    setShowDatePickerStart(false);
    if (selectedDate) {
      const start = moment(selectedDate).startOf('day');
      setDateStart(start);
      if (dateEnd.isBefore(start)) {
        setDateEnd(start.clone().endOf('day'));
      }
    }
  };

  const onDateEndChange = (event: any, selectedDate?: Date) => {
    setShowDatePickerEnd(false);
    if (selectedDate) {
      const end = moment(selectedDate).endOf('day');
      if (end.isBefore(dateStart)) {
        Alert.alert('Error', 'Tanggal akhir tidak boleh mendahului tanggal awal');
        return;
      }
      setDateEnd(end);
    }
  };

  // CHECKBOX SELECTION LOGIC
  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  const toggleSelectAll = (filteredRows: any[]) => {
    if (selectedRowIds.size === filteredRows.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredRows.map((r) => r.id)));
    }
  };

  // REDIRECT TO SALES DETAILS PAGE
  const openSalesDetails = (salesId: number) => {
    if (!salesId || salesId <= 0) return;
    
    if (Platform.OS === 'web') {
      const url = `https://app.plexseller.com/penjualan/search/rincian/${salesId}`;
      window.open(url, '_blank');
    } else {
      (navigation as any).navigate('PenjualanSearch', {
        screen: 'PenjualanRincian',
        params: { id: salesId },
      });
    }
  };

  // BULK ACTIONS
  const handleBulkApproveKomplain = async (filteredRows: any[]) => {
    if (baganAkunPembayaran.kodeBA === -1) {
      Alert.alert('Peringatan', 'Bagan akun pembayaran harus diisi terlebih dahulu');
      return;
    }
    const selectedRows = filteredRows.filter((r) => selectedRowIds.has(r.id));
    if (selectedRows.length === 0) return;

    try {
      setProcessingBulk(true);
      const res = await ApiService.post('/returonline', {
        status: 'approve',
        data: selectedRows,
        kodeBAbayar: baganAkunPembayaran.kodeBA,
        kodeBApersediaan: '51.1',
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Retur online terpilih berhasil disetujui');
        setSelectedRowIds(new Set());
        fetchReturnsData();
      } else {
        // Handle individual errors
        const reasons = res?.reason || [];
        setData((prev) =>
          prev.map((item) => {
            const fail = reasons.find((f: any) => f.id === item.id);
            return fail ? { ...item, error_reason: fail.reason } : item;
          })
        );
        Alert.alert('Proses Selesai', 'Beberapa retur gagal diproses. Silakan periksa detail pesan kesalahan.');
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan saat menyetujui retur online');
    } finally {
      setProcessingBulk(false);
    }
  };

  const handleBulkApproveLainnya = async (filteredRows: any[]) => {
    const selectedRows = filteredRows.filter((r) => selectedRowIds.has(r.id) && !r.approved);
    if (selectedRows.length === 0) return;

    try {
      setProcessingBulk(true);
      const res = await ApiService.post('/pengirimangagal', {
        status: 'approve',
        data: selectedRows,
        kodeBApersediaan: '51.1',
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Pengiriman gagal terpilih berhasil disetujui');
        setSelectedRowIds(new Set());
        fetchReturnsData();
      } else {
        const reasons = res?.reason || [];
        setData2((prev) =>
          prev.map((item) => {
            const fail = reasons.find((f: any) => f.id === item.id);
            if (fail) {
              return { ...item, error_reason: fail.reason };
            }
            if (selectedRows.some((sr) => sr.id === item.id)) {
              return { ...item, approved: true };
            }
            return item;
          })
        );
        Alert.alert('Proses Selesai', 'Beberapa item gagal diproses.');
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan saat menyetujui pengiriman gagal');
    } finally {
      setProcessingBulk(false);
    }
  };

  // INDIVIDUAL COMPLAINT APPROVALS
  const handleIndividualApprove = async (row: any) => {
    if (baganAkunPembayaran.kodeBA === -1) {
      Alert.alert('Peringatan', 'Bagan akun pembayaran harus diisi terlebih dahulu');
      return;
    }

    try {
      setProcessingRowId(row.id);
      const res = await ApiService.post('/returonline', {
        status: 'approve',
        data: [row],
        kodeBAbayar: baganAkunPembayaran.kodeBA,
        kodeBApersediaan: '51.1',
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Retur online berhasil disetujui');
        fetchReturnsData();
      } else {
        const fail = (res?.reason || []).find((f: any) => f.id === row.id);
        const errMsg = fail ? fail.reason : 'Terjadi kesalahan sistem';
        Alert.alert('Gagal Menyetujui', errMsg);
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan jaringan');
    } finally {
      setProcessingRowId(null);
    }
  };

  const handleIndividualReject = async (row: any) => {
    Alert.alert('Konfirmasi', 'Tolak tiket retur online ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya, Tolak',
        style: 'destructive',
        onPress: async () => {
          try {
            setProcessingRowId(row.id);
            const res = await ApiService.post('/returonline/reject', {
              status: 'reject',
              data: [row.id],
            });

            Alert.alert('Selesai', 'Proses tolak retur berhasil dijalankan');
            fetchReturnsData();
          } catch (e) {
            Alert.alert('Error', 'Gagal memproses penolakan');
          } finally {
            setProcessingRowId(null);
          }
        },
      },
    ]);
  };

  // CHANGE COMPLAINT SOLUTION
  const handleSolutionChange = async (row: any, newSolution: string) => {
    try {
      setProcessingRowId(row.id);
      const res = await ApiService.post('/returonline/ecommerce_reject', {
        id: row.id_reverse,
        id_ecommerce: row.id_ecommerce,
        solution: newSolution,
      });
      if (res?.status) {
        Alert.alert('Sukses', 'Solusi retur berhasil diubah');
        fetchReturnsData();
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal mengubah solusi');
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal menghubungi server');
    } finally {
      setProcessingRowId(null);
    }
  };

  // DETAIL MODAL LOGIC
  const openDetailModalSheet = async (row: any) => {
    setSelectedRowForDetail(row);
    setDetailToko('');
    setDetailPlatform('');
    setDetailItems([]);
    setShowDetailModal(true);
    setDetailLoading(true);

    try {
      // Get E-Commerce Shop Name & Platform
      const shopRes = await ApiService.get(`/get/ecommerce/condition/and/id:equal:${row.id_ecommerce}`).catch(() => null);
      if (shopRes?.status && shopRes.data && shopRes.data[0]) {
        setDetailPlatform(shopRes.data[0].platform);
        setDetailToko(shopRes.data[0].name);
      }

      // Determine return database ID
      let returnId: number | null = null;
      
      const isDatabaseId = (val: any) => {
        if (val === undefined || val === null || val === '') return false;
        const num = Number(val);
        return !isNaN(num) && num > 0 && num < 10000000;
      };

      if (row.id_database && Number(row.id_database) > 0) {
        returnId = Number(row.id_database);
      } else if (row.id_retur && isDatabaseId(row.id_retur)) {
        returnId = Number(row.id_retur);
      } else if (row.id && isDatabaseId(row.id)) {
        returnId = Number(row.id);
      }

      let savedItemsLoaded = false;

      if (returnId && returnId > 0) {
        // Fetch saved returns items from table detailreturonline via generic get
        const res = await ApiService.get(`/get/returonline?id=${returnId}`).catch(() => null);
        if (res?.status && Array.isArray(res.data) && res.data.length > 0) {
          const firstItem = res.data[0];
          setSelectedRowForDetail((prev: any) => ({
            ...prev,
            ...firstItem,
            id_retur: prev?.id_retur || firstItem?.id_retur || returnId,
            id_penjualan: prev?.id_penjualan || firstItem?.id_penjualan,
            id_ecommerce: prev?.id_ecommerce || firstItem?.id_ecommerce,
            invoice_tokped: prev?.invoice_tokped || firstItem?.invoice_tokped,
            nomor_resi: prev?.nomor_resi || firstItem?.nomor_resi,
            print: prev?.print !== undefined && prev?.print !== null ? prev.print : firstItem?.print,
            print_timestamp: prev?.print_timestamp !== undefined && prev?.print_timestamp !== null ? prev.print_timestamp : firstItem?.print_timestamp,
            scanout: prev?.scanout !== undefined && prev?.scanout !== null ? prev.scanout : firstItem?.scanout,
            scanout_time: prev?.scanout_time !== undefined && prev?.scanout_time !== null ? prev.scanout_time : firstItem?.scanout_time,
            pack: prev?.pack !== undefined && prev?.pack !== null ? prev.pack : firstItem?.pack,
            pack_time: prev?.pack_time !== undefined && prev?.pack_time !== null ? prev.pack_time : firstItem?.pack_time,
          }));
          const mapped = res.data.map((item: any) => ({
            ...item,
            name_mb: item.nama || item.name_mb || 'Produk',
            sku_mb: item.sku || item.sku_mb || '-',
            id: item.id_detailpenjualan || item.id_barang || item.id || Math.random().toString(),
            qty: item.qty || 0,
            price: item.harga_jual || item.price || 0,
          }));
          setDetailItems(mapped);
          savedItemsLoaded = true;
        }
      }


      // Fallback: If no saved returns items found, check if row.items exists (complaint returns list)
      if (!savedItemsLoaded) {
        if (row.items && row.items.length > 0) {
          const baseItems = row.items.map((dit: any) => ({
            ...dit,
            name_mb: dit.nama || '',
            sku_mb: dit.sku || '',
            id: dit.id_detailpenjualan || dit.child_id || dit.product_id || dit.id_barang || dit.id_bundling || Math.random().toString(),
            qty: dit.qty || 0,
            price: dit.price || dit.harga_jual || 0,
          }));
          setDetailItems(baseItems);

          // Fetch online_masterbarang details to populate name/sku
          const ids = row.items.map((dit: any) => dit.child_id || dit.product_id).filter(Boolean);
          if (ids.length > 0) {
            const mbRes = await ApiService.get(`/get/online_masterbarang?list=${encodeURIComponent(JSON.stringify(ids))}`).catch(() => null);
            if (mbRes?.status && Array.isArray(mbRes.data)) {
              setDetailItems((prev) =>
                prev.map((item) => {
                  const matched = mbRes.data.find(
                    (rd: any) =>
                      rd.id_online === item.child_id ||
                      rd.id_parent === item.product_id ||
                      rd.id_online === item.product_id
                  );
                  if (matched) {
                    return {
                      ...item,
                      sku_mb: matched.sku,
                      kategori_mb: matched.kategori,
                      merk_mb: matched.merk,
                      name_mb: matched.nama,
                      id_mb: matched.id,
                    };
                  }
                  return item;
                })
              );
            }
          }
        } else if (row.id_penjualan && Number(row.id_penjualan) > 0) {
          // Fallback for "Lainnya" (Shipping failure / cancel) which has a sales ID: load detailpenjualan
          const salesId = row.id_penjualan;
          console.log('[ReturOnline] Loading fallback items for salesId:', salesId);
          const [barangRes, bundlingRes, manualRes, recipeRes] = await Promise.all([
            ApiService.get(`/get/detailpenjualan/join/masterbarang/${salesId}`).catch(() => null),
            ApiService.get(`/get/detailpenjualan/join/bundling/${salesId}`).catch(() => null),
            ApiService.get(`/get/detailpenjualan_manual/${salesId}`).catch(() => null),
            ApiService.get(`/get/detailpenjualan/join/recipe/${salesId}`).catch(() => null),
          ]);

          const combinedItems: any[] = [];

          if (barangRes?.status && Array.isArray(barangRes.data)) {
            barangRes.data.forEach((item: any) => {
              combinedItems.push({
                ...item,
                id: item.id_detailpenjualan || item.id_barang || item.id || Math.random().toString(),
                name_mb: item.nama || 'Barang',
                sku_mb: item.sku || '-',
                price: item.hargajual || item.harga_jual || 0,
                qty: item.qty || 0,
              });
            });
          }

          if (bundlingRes?.status && Array.isArray(bundlingRes.data)) {
            bundlingRes.data.forEach((item: any) => {
              combinedItems.push({
                ...item,
                id: item.id_detailpenjualan || item.id_bundling || item.id || Math.random().toString(),
                name_mb: item.nama || 'Bundling',
                sku_mb: item.sku || '-',
                price: item.hargajual || item.harga_jual || 0,
                qty: item.qty || 0,
              });
            });
          }

          if (manualRes?.status && Array.isArray(manualRes.data)) {
            manualRes.data.forEach((item: any) => {
              combinedItems.push({
                ...item,
                id: item.id || Math.random().toString(),
                name_mb: item.nama || 'Manual Item',
                sku_mb: item.sku || '-',
                price: item.hargajual || item.harga_jual || 0,
                qty: item.qty || 0,
              });
            });
          }

          if (recipeRes?.status && Array.isArray(recipeRes.data)) {
            recipeRes.data.forEach((item: any) => {
              combinedItems.push({
                ...item,
                id: item.id_detailpenjualan || item.id_barang || item.id || Math.random().toString(),
                name_mb: item.nama || 'Resep Item',
                sku_mb: item.sku || '-',
                price: item.harga_jual || 0,
                qty: item.qty || 0,
              });
            });
          }

          console.log('[ReturOnline] Fallback items loaded count:', combinedItems.length);
          setDetailItems(combinedItems);
        }
      }
    } catch (error) {
      console.error('[ReturOnline] Fetch details error:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetailQtyChange = (itemId: string, increment: boolean) => {
    setDetailItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentQty = item.qty || 0;
          const newQty = increment ? currentQty + 1 : Math.max(1, currentQty - 1);
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  // ACTIONS INSIDE DETAIL SHEET
  const handlePlexSellerApproveFromDetail = async () => {
    if (baganAkunPembayaran.kodeBA === -1) {
      Alert.alert('Peringatan', 'Bagan akun pembayaran wajib diisi');
      return;
    }

    try {
      setDetailLoading(true);
      const res = await ApiService.post('/returonline', {
        status: 'approve',
        data: [{ ...selectedRowForDetail, items: detailItems }],
        kodeBAbayar: baganAkunPembayaran.kodeBA,
        kodeBApersediaan: '51.1',
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Retur online disetujui internal');
        setShowDetailModal(false);
        fetchReturnsData();
      } else {
        Alert.alert('Gagal', JSON.stringify(res?.reason || 'Gagal memproses'));
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan jaringan');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePlexSellerRejectFromDetail = async () => {
    if (baganAkunPembayaran.kodeBA === -1) {
      Alert.alert('Peringatan', 'Bagan akun pembayaran wajib diisi');
      return;
    }

    try {
      setDetailLoading(true);
      const res = await ApiService.post('/returonline', {
        status: 'reject',
        data: [{ ...selectedRowForDetail, items: detailItems }],
        kodeBAbayar: baganAkunPembayaran.kodeBA,
        kodeBApersediaan: '51.1',
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Retur online ditolak internal');
        setShowDetailModal(false);
        fetchReturnsData();
      } else {
        Alert.alert('Gagal', JSON.stringify(res?.reason || 'Gagal memproses'));
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal memproses penolakan');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleMarketplaceApproveFromDetail = async () => {
    try {
      setDetailLoading(true);
      const res = await ApiService.post('/accept/returonline/marketplace', {
        retur_sn: selectedRowForDetail?.id_reverse,
        id_ecommerce: selectedRowForDetail?.id_ecommerce,
        order_id: selectedRowForDetail?.order_id,
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Keputusan RETUR DISETUJUI dikirim ke Marketplace');
        setShowDetailModal(false);
        fetchReturnsData();
      } else {
        Alert.alert('Gagal', JSON.stringify(res?.reason || 'Gagal'));
      }
    } catch (e) {
      Alert.alert('Error', 'Kesalahan komunikasi ke marketplace');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleMarketplaceRejectFromDetail = async () => {
    try {
      setDetailLoading(true);
      const res = await ApiService.post('/reject/returonline/marketplace', {
        retur_sn: selectedRowForDetail?.id_reverse,
        id_ecommerce: selectedRowForDetail?.id_ecommerce,
        order_id: selectedRowForDetail?.order_id,
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Keputusan RETUR DITOLAK dikirim ke Marketplace');
        setShowDetailModal(false);
        fetchReturnsData();
      } else {
        Alert.alert('Gagal', JSON.stringify(res?.reason || 'Platform tidak mendukung'));
      }
    } catch (e) {
      Alert.alert('Error', 'Kesalahan komunikasi ke marketplace');
    } finally {
      setDetailLoading(false);
    }
  };

  // FILTER LOGIC FOR DATA LISTS
  const getFilteredData = () => {
    if (Tipe === 'komplain') {
      return data
        .filter((dt) => {
          if (MenuIndex === 'pending') return dt.id_database === 0;
          if (MenuIndex === 'disetujui') return dt.id_database > 0;
          if (MenuIndex === 'ditolak') return dt.id_database < 0;
          return true;
        })
        .filter((dt) => CurrentEcommerce.id === 0 || dt.id_ecommerce === CurrentEcommerce.id);
    } else {
      return data2
        .filter((dt) => {
          const q = searchPengirimanGagal.toLowerCase().trim();
          if (!q) return true;
          return (
            (dt.id_online || '').toLowerCase().includes(q) ||
            (dt.nomor_resi || '').toLowerCase().includes(q) ||
            (dt.shop_name || '').toLowerCase().includes(q) ||
            (dt.id_retur || '').toLowerCase().includes(q)
          );
        })
.filter((dt) => CurrentEcommerce.id === 0 || dt.id_ecommerce === CurrentEcommerce.id);
    }
  };

  const filteredRows = getFilteredData();
 
  // RENDER CARD COMPONENT
  const renderItemCard = ({ item }: { item: any }) => {
    const matchedShop = ecommerceList.find(shop => Number(shop.id) === Number(item.id_ecommerce));
    const resolvedPlatform = item.platform || matchedShop?.platform || '';
    const brand = getPlatformBrand(resolvedPlatform);
    const resolvedShopName = item.shop_name || matchedShop?.name || 'Toko Unknown';

    const dateFormatted = moment(item.tanggal).format('DD-MM-YYYY HH:mm');
    const isPending = Tipe === 'komplain' ? item.id_database === 0 : item.approved === 0 || item.status === 'pending';
    const isApproved = Tipe === 'komplain' ? item.id_database > 0 : item.approved > 0 || item.status === 'approved';
    const isRejected = Tipe === 'komplain' ? item.id_database < 0 : item.approved < 0 || item.status === 'rejected';

    // Real ID Retur should only be shown if it exists and is different from the order ID (id_online/id)
    const hasRealIdRetur = item.id_retur && 
                           item.id_retur !== item.id_online && 
                           item.id_retur !== item.id && 
                           item.id_retur !== item.invoice_tokped;
    const displayIdRetur = hasRealIdRetur ? item.id_retur : '-';
    
    // Status syncing based on boolean or timestamp existence using toBool and isValidTimestamp
    const isPrinted = toBool(item.print) || isValidTimestamp(item.print_timestamp);
    const isScanned = toBool(item.scanout) || isValidTimestamp(item.scanout_time);
    const isPacked = toBool(item.pack) || isValidTimestamp(item.pack_time);

    return (
      <View style={styles.card}>
        {/* Checkbox for Bulk Actions */}
        {isPending && (Tipe === 'komplain' || (PengirimanGagalMethod === 'MANUAL' && Reason === 'pengiriman_gagal')) && (
          <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.checkboxContainer}>
            <Ionicons
              name={selectedRowIds.has(item.id) ? 'checkbox' : 'square-outline'}
              size={22}
              color={selectedRowIds.has(item.id) ? '#f59e0b' : '#9ca3af'}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cardContent} onPress={() => openDetailModalSheet(item)}>
          {/* Platform & Shop Header */}
          <View style={styles.cardHeader}>
            <View style={styles.brandRow}>
              <View style={[styles.brandBadge, { backgroundColor: brand.color }]}>
                <Text style={styles.brandText}>{brand.label}</Text>
              </View>
              <Text style={styles.shopName} numberOfLines={1}>
                {resolvedShopName}
              </Text>
            </View>
            <Text style={styles.cardDate}>{dateFormatted}</Text>
          </View>

          {/* Invoice and Resi */}
          <View style={styles.cardBody}>
            <View style={styles.cardRowInline}>
              <Text style={styles.orderIdText} numberOfLines={1}>Order ID: {item.invoice_tokped || item.invoice || item.id_online}</Text>
              <View style={styles.returIdBadge}>
                <Text style={styles.returIdBadgeText}>ID Retur: {displayIdRetur}</Text>
              </View>
            </View>
            <Text style={styles.resiText}>Resi: {item.nomor_resi || '-'}</Text>

            {Tipe === 'komplain' && item.reason && (
              <View style={styles.badgeRow}>
                <Text style={styles.reasonBadge}>{customReasonMessage(item.reason)}</Text>
                {item.solution && (
                  <Text style={styles.solutionBadge}>{customSolutionMessage(item.solution)}</Text>
                )}
              </View>
            )}

            {/* Print, Scan, Pack indicators */}
            <View style={styles.metaRow}>
              {colVisibility.print && (
                <TouchableOpacity
                  style={styles.metaBadge}
                  onPress={() => {
                    if (isPrinted) {
                      Alert.alert(
                        'Print Info',
                        item.print_timestamp
                          ? `Waktu Print:\n${moment(item.print_timestamp).format('YYYY-MM-DD HH:mm:ss')}`
                          : 'Sudah di Print'
                      );
                    } else {
                      Alert.alert('Print Info', 'Belum di Print');
                    }
                  }}
                >
                  <Text style={styles.metaLabel}>Print: </Text>
                  <Text style={isPrinted ? styles.metaValSuccess : styles.metaValFail}>
                    {isPrinted ? '✅' : '❌'}
                  </Text>
                </TouchableOpacity>
              )}

              {colVisibility.scanout && (
                <TouchableOpacity
                  style={styles.metaBadge}
                  onPress={() => {
                    if (isScanned) {
                      Alert.alert(
                        'Scan Out Info',
                        item.scanout_time
                          ? `Waktu Scan Out:\n${moment(item.scanout_time).format('YYYY-MM-DD HH:mm:ss')}`
                          : 'Sudah Scan Out'
                      );
                    } else {
                      Alert.alert('Scan Out Info', 'Belum di Scan Out');
                    }
                  }}
                >
                  <Text style={styles.metaLabel}>Scan Out: </Text>
                  <Text style={isScanned ? styles.metaValSuccess : styles.metaValFail}>
                    {isScanned ? '✅' : '❌'}
                  </Text>
                </TouchableOpacity>
              )}

              {colVisibility.pack && (
                <TouchableOpacity
                  style={styles.metaBadge}
                  onPress={() => {
                    if (isPacked) {
                      Alert.alert(
                        'Pack Info',
                        item.pack_time
                          ? `Waktu Pack:\n${moment(item.pack_time).format('YYYY-MM-DD HH:mm:ss')}`
                          : 'Sudah di Pack'
                      );
                    } else {
                      Alert.alert('Pack Info', 'Belum di Pack');
                    }
                  }}
                >
                  <Text style={styles.metaLabel}>Pack: </Text>
                  <Text style={isPacked ? styles.metaValSuccess : styles.metaValFail}>
                    {isPacked ? '✅' : '❌'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Footer of Card */}
          <View style={styles.cardFooter}>
            <View style={styles.salesIdSection}>
              <Text style={styles.salesIdLabel}>Penjualan: </Text>
              {item.id_penjualan && item.id_penjualan > 0 ? (
                <TouchableOpacity onPress={() => openSalesDetails(Number(item.id_penjualan))}>
                  <Text style={styles.salesIdLink}>#{item.id_penjualan}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>❌</Text>
              )}
            </View>

            <View style={styles.payoutBadgeSection}>
              {/* Show solution selector if pending */}
              {isPending && Tipe === 'komplain' && item.solution_tiktok && item.solution_tiktok.length > 0 && (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={item.solution}
                    style={styles.pickerCompact}
                    onValueChange={(val) => handleSolutionChange(item, val)}
                  >
                    {item.solution_tiktok.map((sol: string) => (
                      <Picker.Item key={sol} label={sol} value={sol} />
                    ))}
                  </Picker>
                </View>
              )}

              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  isApproved && styles.statusBadgeApproved,
                  isRejected && styles.statusBadgeRejected,
                  isPending && styles.statusBadgePending,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isApproved && styles.statusTextApproved,
                    isRejected && styles.statusTextRejected,
                    isPending && styles.statusTextPending,
                  ]}
                >
                  {isApproved ? '✅ Approved' : isRejected ? '❌ Rejected' : '⏳ Pending'}
                </Text>
              </View>
            </View>
          </View>

          {/* Display Payout Total */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Retur:</Text>
            <Text style={styles.amountValue}>
              {formatRupiah(
                Tipe === 'komplain'
                  ? (item.items || []).reduce((a: number, b: any) => a + (b.qty * (b.price || 0)), 0)
                  : item.total
              )}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const isPrinted = selectedRowForDetail ? (toBool(selectedRowForDetail.print) || isValidTimestamp(selectedRowForDetail.print_timestamp)) : false;
  const isScanned = selectedRowForDetail ? (toBool(selectedRowForDetail.scanout) || isValidTimestamp(selectedRowForDetail.scanout_time)) : false;
  const isPacked = selectedRowForDetail ? (toBool(selectedRowForDetail.pack) || isValidTimestamp(selectedRowForDetail.pack_time)) : false;

  const matchedShopDetail = selectedRowForDetail ? ecommerceList.find(shop => Number(shop.id) === Number(selectedRowForDetail.id_ecommerce)) : null;
  const resolvedPlatformDetail = selectedRowForDetail?.platform || matchedShopDetail?.platform || detailPlatform || '';
  const resolvedShopNameDetail = selectedRowForDetail?.shop_name || matchedShopDetail?.name || detailToko || 'Toko Unknown';

  const displayIdReturDetail = selectedRowForDetail?.id_retur && 
                               selectedRowForDetail.id_retur !== selectedRowForDetail.id_online && 
                               selectedRowForDetail.id_retur !== selectedRowForDetail.id && 
                               selectedRowForDetail.id_retur !== selectedRowForDetail.invoice_tokped
                               ? selectedRowForDetail.id_retur : '';


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header Navigation area */}
      <LinearGradient colors={['#312e81', '#1e1b4b']} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Retur Online</Text>
          <TouchableOpacity onPress={() => setShowColVisibilityModal(true)} style={styles.gearIcon}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Top Segment Control */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, Tipe === 'komplain' && styles.segmentBtnActive]}
            onPress={() => {
              setTipe('komplain');
              setMenuIndex('pending');
            }}
          >
            <Text style={[styles.segmentText, Tipe === 'komplain' && styles.segmentTextActive]}>Komplain</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, Tipe === 'lainnya' && styles.segmentBtnActive]}
            onPress={() => {
              setTipe('lainnya');
              setReason('pengiriman_gagal');
            }}
          >
            <Text style={[styles.segmentText, Tipe === 'lainnya' && styles.segmentTextActive]}>Lainnya</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 2. Sub tabs */}
      <View style={styles.subTabBar}>
        {Tipe === 'komplain' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabScroll}>
            {['pending', 'disetujui', 'ditolak'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.subTabItem, MenuIndex === status && styles.subTabItemActive]}
                onPress={() => setMenuIndex(status as any)}
              >
                <Text style={[styles.subTabText, MenuIndex === status && styles.subTabTextActive]}>
                  {status === 'pending' ? 'Pending' : status === 'disetujui' ? 'Disetujui' : 'Ditolak'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {Tipe === 'lainnya' && (
          <View style={styles.reasonTabContainer}>
            <TouchableOpacity
              style={[styles.reasonTab, Reason === 'pengiriman_gagal' && styles.reasonTabActive]}
              onPress={() => setReason('pengiriman_gagal')}
            >
              <Text style={[styles.reasonTabText, Reason === 'pengiriman_gagal' && styles.reasonTabTextActive]}>
                Pengiriman Gagal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reasonTab, Reason === 'dibatalkan' && styles.reasonTabActive]}
              onPress={() => setReason('dibatalkan')}
            >
              <Text style={[styles.reasonTabText, Reason === 'dibatalkan' && styles.reasonTabTextActive]}>
                Dibatalkan
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. Horizontal Scrollable Ecommerce Shop Filters */}
      <View style={styles.shopFilterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopScroll}>
          <TouchableOpacity
            style={[styles.shopChip, CurrentEcommerce.id === 0 && styles.shopChipActive]}
            onPress={() => setCurrentEcommerce({ id: 0, name: 'Semua', platform: '' })}
          >
            <Text style={[styles.shopChipText, CurrentEcommerce.id === 0 && styles.shopChipTextActive]}>Semua</Text>
          </TouchableOpacity>

          {ecommerceList.map((shop) => (
            <TouchableOpacity
              key={shop.id}
              style={[styles.shopChip, CurrentEcommerce.id === shop.id && styles.shopChipActive]}
              onPress={() => setCurrentEcommerce(shop)}
            >
              <Text style={[styles.shopChipText, CurrentEcommerce.id === shop.id && styles.shopChipTextActive]}>
                {shop.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 4. Date range filters and search query */}
      <View style={styles.filterSection}>
        <View style={styles.dateSelectorContainer}>
          <TouchableOpacity onPress={() => setShowDatePickerStart(true)} style={styles.dateSelectorBtn}>
            <Ionicons name="calendar-outline" size={16} color="#4f46e5" style={{ marginRight: 6 }} />
            <Text style={styles.dateSelectorText}>{dateStart.format('DD-MM-YYYY')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateRangeDivider}>s/d</Text>
          <TouchableOpacity onPress={() => setShowDatePickerEnd(true)} style={styles.dateSelectorBtn}>
            <Ionicons name="calendar-outline" size={16} color="#4f46e5" style={{ marginRight: 6 }} />
            <Text style={styles.dateSelectorText}>{dateEnd.format('DD-MM-YYYY')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchSubmitBtn} onPress={fetchReturnsData}>
            <Ionicons name="search" size={16} color="#fff" />
            <Text style={styles.searchSubmitText}>CARI</Text>
          </TouchableOpacity>
        </View>

        {showDatePickerStart && (
          <DateTimePicker value={dateStart.toDate()} mode="date" onChange={onDateStartChange} />
        )}
        {showDatePickerEnd && (
          <DateTimePicker value={dateEnd.toDate()} mode="date" onChange={onDateEndChange} />
        )}

        {/* CARI Query textinput (For Shipping Failure) */}
        {Tipe === 'lainnya' && (
          <View style={styles.queryInputContainer}>
            <Ionicons name="search" size={18} color="#9ca3af" style={styles.querySearchIcon} />
            <TextInput
              style={styles.querySearchInput}
              placeholder="Cari ID Order / Nomor Resi / Toko..."
              placeholderTextColor="#9ca3af"
              value={searchPengirimanGagal}
              onChangeText={setSearchPengirimanGagal}
            />
            {searchPengirimanGagal.length > 0 && (
              <TouchableOpacity onPress={() => setSearchPengirimanGagal('')} style={styles.queryClearIcon}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* 5. Bulk actions header bar */}
      {selectedRowIds.size > 0 && (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkCountText}>{selectedRowIds.size} terpilih</Text>

          {Tipe === 'komplain' ? (
            <View style={styles.bulkActionLayout}>
              <TouchableOpacity onPress={() => setShowBaganAkunModal(true)} style={styles.coaSelectButton}>
                <Ionicons name="card-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.coaSelectButtonText} numberOfLines={1}>
                  {baganAkunPembayaran.kodeBA !== -1
                    ? `${baganAkunPembayaran.kodeBA} - ${baganAkunPembayaran.keterangan}`
                    : 'Pilih Akun Bank'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={processingBulk}
                onPress={() => handleBulkApproveKomplain(filteredRows)}
                style={styles.bulkApproveBtn}
              >
                {processingBulk ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.bulkApproveText}>SETUJU</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bulkActionLayout}>
              <TouchableOpacity
                disabled={processingBulk}
                onPress={() => handleBulkApproveLainnya(filteredRows)}
                style={styles.bulkApproveBtn}
              >
                {processingBulk ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.bulkApproveText}>SETUJU</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 6. List card transactions */}
      {fetching ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loaderText}>Memuat Data Retur...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.id}
          renderItem={renderItemCard}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={fetching} onRefresh={fetchReturnsData} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={60} color="#9ca3af" />
              <Text style={styles.emptyText}>Tidak ada data transaksi retur ditemukan</Text>
            </View>
          }
        />
      )}

      {/* 7. Column Visibility bottom sheet modal */}
      <Modal visible={showColVisibilityModal} transparent animationType="slide" onRequestClose={() => setShowColVisibilityModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter Kolom Tampilan</Text>
              <TouchableOpacity onPress={() => setShowColVisibilityModal(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelCol}>
                  <Text style={styles.toggleTitle}>Print Status</Text>
                  <Text style={styles.toggleDesc}>Tampilkan status & timestamp print</Text>
                </View>
                <Switch
                  value={colVisibility.print}
                  onValueChange={(val) => setColVisibility((prev) => ({ ...prev, print: val }))}
                  trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                  thumbColor={colVisibility.print ? '#4f46e5' : '#f3f4f6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelCol}>
                  <Text style={styles.toggleTitle}>Scan Out Status</Text>
                  <Text style={styles.toggleDesc}>Tampilkan status scanout paket</Text>
                </View>
                <Switch
                  value={colVisibility.scanout}
                  onValueChange={(val) => setColVisibility((prev) => ({ ...prev, scanout: val }))}
                  trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                  thumbColor={colVisibility.scanout ? '#4f46e5' : '#f3f4f6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelCol}>
                  <Text style={styles.toggleTitle}>Pack Status</Text>
                  <Text style={styles.toggleDesc}>Tampilkan status packed</Text>
                </View>
                <Switch
                  value={colVisibility.pack}
                  onValueChange={(val) => setColVisibility((prev) => ({ ...prev, pack: val }))}
                  trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                  thumbColor={colVisibility.pack ? '#4f46e5' : '#f3f4f6'}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setShowColVisibilityModal(false)}>
              <Text style={styles.sheetCloseBtnText}>Simpan Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 8. Transaction Details modal sheet */}
      <Modal visible={showDetailModal} transparent animationType="fade" onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailSheetHeader}>
              <Text style={styles.detailSheetTitle}>Detail Retur Online</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.detailSheetCloseBtnHeader}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.detailLoader}>
                <ActivityIndicator size="large" color="#4f46e5" />
                <Text style={styles.detailLoaderText}>Memuat Detail Barang...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.detailScrollContent}>
                {/* Meta summary card */}
                <View style={styles.detailMetaCard}>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>ID Retur (Database ID)</Text>
                    <Text style={styles.detailMetaVal}>{displayIdReturDetail || '-'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Order ID / ID Online</Text>
                    <Text style={styles.detailMetaVal}>{selectedRowForDetail?.id_online || selectedRowForDetail?.invoice_tokped || selectedRowForDetail?.id || '-'}</Text>
                  </View>
                  {((resolvedPlatformDetail).toUpperCase() === 'TOKOPEDIA') && (
                    <View style={styles.detailMetaRow}>
                      <Text style={styles.detailMetaLabel}>Invoice Tokopedia</Text>
                      <Text style={styles.detailMetaVal}>{selectedRowForDetail?.invoice_tokped || '-'}</Text>
                    </View>
                  )}
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Nomor Resi</Text>
                    <Text style={styles.detailMetaVal}>{selectedRowForDetail?.nomor_resi || '-'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>ID Penjualan (Sales ID)</Text>
                    {selectedRowForDetail?.id_penjualan && Number(selectedRowForDetail.id_penjualan) > 0 ? (
                      <TouchableOpacity onPress={() => openSalesDetails(Number(selectedRowForDetail.id_penjualan))}>
                        <Text style={styles.detailSalesIdLink}>#{selectedRowForDetail.id_penjualan}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.detailMetaVal}>-</Text>
                    )}
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Alasan / Kendala (Reason)</Text>
                    <Text style={styles.detailMetaVal}>{customReasonMessage(selectedRowForDetail?.reason)}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Tanggal</Text>
                    <Text style={styles.detailMetaVal}>
                      {selectedRowForDetail?.tanggal ? moment(selectedRowForDetail.tanggal).format('DD-MM-YYYY HH:mm:ss') : '-'}
                    </Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Status Persetujuan</Text>
                    <Text style={styles.detailMetaVal}>
                      {selectedRowForDetail?.approved === 1 || selectedRowForDetail?.status === 'approved' ? 'Approved (Disetujui)' : selectedRowForDetail?.approved === -1 || selectedRowForDetail?.status === 'rejected' ? 'Rejected (Ditolak)' : 'Pending (Menunggu)'}
                    </Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Platform / Marketplace</Text>
                    <Text style={styles.detailMetaVal}>{resolvedPlatformDetail || '-'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Nama Toko (Shop Name)</Text>
                    <Text style={styles.detailMetaVal}>{resolvedShopNameDetail || '-'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>ID Ecommerce</Text>
                    <Text style={styles.detailMetaVal}>{selectedRowForDetail?.id_ecommerce || '-'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Total Retur</Text>
                    <Text style={[styles.detailMetaVal, { fontWeight: 'bold' }]}>
                      {formatRupiah(selectedRowForDetail?.total || 0)}
                    </Text>
                  </View>

                  {/* Print, Scan, Pack details */}
                  <View style={styles.detailDivider} />
                  
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Status Print</Text>
                    <Text style={styles.detailMetaVal}>{isPrinted ? '✅ Sudah Print' : '❌ Belum Print'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Waktu Print</Text>
                    <Text style={styles.detailMetaVal}>
                      {selectedRowForDetail?.print_timestamp && isValidTimestamp(selectedRowForDetail.print_timestamp) 
                        ? moment(selectedRowForDetail.print_timestamp).format('DD-MM-YYYY HH:mm:ss') 
                        : '-'}
                    </Text>
                  </View>

                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Status Scan Out</Text>
                    <Text style={styles.detailMetaVal}>{isScanned ? '✅ Sudah Scan Out' : '❌ Belum Scan Out'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Waktu Scan Out</Text>
                    <Text style={styles.detailMetaVal}>
                      {selectedRowForDetail?.scanout_time && isValidTimestamp(selectedRowForDetail.scanout_time) 
                        ? moment(selectedRowForDetail.scanout_time).format('DD-MM-YYYY HH:mm:ss') 
                        : '-'}
                    </Text>
                  </View>

                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Status Pack</Text>
                    <Text style={styles.detailMetaVal}>{isPacked ? '✅ Sudah Pack' : '❌ Belum Pack'}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Waktu Pack</Text>
                    <Text style={styles.detailMetaVal}>
                      {selectedRowForDetail?.pack_time && isValidTimestamp(selectedRowForDetail.pack_time) 
                        ? moment(selectedRowForDetail.pack_time).format('DD-MM-YYYY HH:mm:ss') 
                        : '-'}
                    </Text>
                  </View>

                  {selectedRowForDetail?.solution && (
                    <View style={styles.detailMetaRow}>
                      <Text style={styles.detailMetaLabel}>Solusi yang Diajukan</Text>
                      <Text style={[styles.detailMetaVal, { color: '#059669', fontWeight: 'bold' }]}>
                        {customSolutionMessage(selectedRowForDetail.solution)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Items Table List */}
                <Text style={styles.detailSectionTitle}>Rincian Produk Retur</Text>
                {detailItems.length === 0 ? (
                  <View style={styles.detailItemsEmpty}>
                    <Text style={styles.detailItemsEmptyText}>Tidak ada data produk ditemukan</Text>
                  </View>
                ) : (
                  detailItems.map((item) => (
                    <View key={item.id} style={styles.itemDetailCard}>
                      <View style={styles.itemDetailHeader}>
                        <Text style={styles.itemDetailName}>{item.name_mb || item.nama || 'Produk'}</Text>
                        <Text style={styles.itemDetailSKU}>SKU: {item.sku_mb || item.sku || '-'}</Text>
                      </View>

                      <View style={styles.itemDetailRow}>
                        <View>
                          <Text style={styles.itemDetailLabel}>Harga</Text>
                          <Text style={styles.itemDetailVal}>{formatRupiah(item.price || item.hargajual || item.harga_jual || 0)}</Text>
                        </View>

                        {/* Quantity Modifier */}
                        <View>
                          <Text style={styles.itemDetailLabel}>Quantity Retur</Text>
                          {Tipe === 'komplain' && selectedRowForDetail?.id_database === 0 ? (
                            <View style={styles.qtyControl}>
                              <TouchableOpacity onPress={() => handleDetailQtyChange(item.id, false)} style={styles.qtyBtn}>
                                <Ionicons name="remove" size={16} color="#4f46e5" />
                              </TouchableOpacity>
                              <Text style={styles.qtyText}>{item.qty || 0}</Text>
                              <TouchableOpacity onPress={() => handleDetailQtyChange(item.id, true)} style={styles.qtyBtn}>
                                <Ionicons name="add" size={16} color="#4f46e5" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <Text style={styles.itemDetailValBold}>{item.qty || 0}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))
                )}

                {/* Internal PlexSeller Approval Form */}
                {Tipe === 'komplain' && selectedRowForDetail?.id_database === 0 && (
                  <View style={styles.detailActionBox}>
                    <Text style={styles.detailActionBoxTitle}>PLEXSELLER INTERNAL DECISION</Text>
                    <Text style={styles.detailActionBoxDesc}>Proses penyesuaian stok dan pencatatan kas/jurnal di PlexSeller</Text>

                    <Text style={styles.actionCoaLabel}>Bagan Akun Pembayaran (Kas/Bank) *</Text>
                    <TouchableOpacity onPress={() => setShowBaganAkunModal(true)} style={styles.coaSelectButtonDetail}>
                      <Ionicons name="card-outline" size={18} color="#4f46e5" style={{ marginRight: 8 }} />
                      <Text style={styles.coaSelectButtonDetailText}>
                        {baganAkunPembayaran.kodeBA !== -1
                          ? `${baganAkunPembayaran.kodeBA} - ${baganAkunPembayaran.keterangan}`
                          : 'Pilih Chart of Account (COA)'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#9ca3af" />
                    </TouchableOpacity>

                    <View style={styles.dualButtonRow}>
                      <TouchableOpacity onPress={handlePlexSellerRejectFromDetail} style={[styles.actionBtnDetail, styles.actionBtnReject]}>
                        <Ionicons name="close-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnTextDetail}>TOLAK INTERNAL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handlePlexSellerApproveFromDetail} style={[styles.actionBtnDetail, styles.actionBtnApprove]}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnTextDetail}>SETUJU INTERNAL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Marketplace Approval Form */}
                {Tipe === 'komplain' && selectedRowForDetail?.id_database === 0 && (
                  <View style={[styles.detailActionBox, { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }]}>
                    <Text style={[styles.detailActionBoxTitle, { color: '#1e40af' }]}>MARKETPLACE INTEGRATED DECISION</Text>
                    <Text style={styles.detailActionBoxDesc}>Kirim keputusan persetujuan retur langsung ke sistem marketplace API</Text>

                    <View style={styles.dualButtonRow}>
                      {detailPlatform.toUpperCase() !== 'SHOPEE' && (
                        <TouchableOpacity onPress={handleMarketplaceRejectFromDetail} style={[styles.actionBtnDetail, styles.actionBtnRejectMarket]}>
                          <Ionicons name="close" size={18} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.actionBtnTextDetail}>TOLAK TIKET</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={handleMarketplaceApproveFromDetail} style={[styles.actionBtnDetail, styles.actionBtnApproveMarket]}>
                        <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnTextDetail}>SETUJU SOLUSI</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.detailSheetFooter}>
              <TouchableOpacity style={styles.detailSheetCloseBtn} onPress={() => setShowDetailModal(false)}>
                <Text style={styles.detailSheetCloseBtnText}>Tutup Detail</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 9. Bagan Akun search modal */}
      <BaganAkunSearchModal
        open={showBaganAkunModal}
        onClose={() => setShowBaganAkunModal(false)}
        onSelect={(acc) => setBaganAkunPembayaran({ kodeBA: Number(acc.kodeba), keterangan: acc.nama })}
        parent="11"
        title="Pilih Bagan Akun Pembayaran"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  gearIcon: {
    padding: 6,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
  },
  segmentText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#1e1b4b',
  },
  subTabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subTabScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subTabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  subTabItemActive: {
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  subTabText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  subTabTextActive: {
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  reasonTabContainer: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'space-around',
  },
  reasonTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  reasonTabActive: {
    borderBottomColor: '#4f46e5',
  },
  reasonTabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  reasonTabTextActive: {
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  shopFilterBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  shopScroll: {
    paddingHorizontal: 12,
  },
  shopChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  shopChipActive: {
    backgroundColor: '#f59e0b',
  },
  shopChipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600',
  },
  shopChipTextActive: {
    color: '#fff',
  },
  filterSection: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    flex: 1.5,
    justifyContent: 'center',
  },
  dateSelectorText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  dateRangeDivider: {
    marginHorizontal: 8,
    color: '#6b7280',
    fontSize: 12,
  },
  searchSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
    flex: 1,
    justifyContent: 'center',
  },
  searchSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  queryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    height: 38,
  },
  querySearchIcon: {
    marginRight: 6,
  },
  querySearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
  },
  queryClearIcon: {
    padding: 4,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loaderText: {
    marginTop: 10,
    color: '#6b7280',
    fontSize: 14,
  },
  listContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  checkboxContainer: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  brandText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  shopName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
  },
  cardDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  cardBody: {
    marginBottom: 8,
  },
  cardRowInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 10,
  },
  returIdText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '700',
  },
  returIdBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  returIdBadgeText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: 'bold',
  },

  resiText: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  reasonBadge: {
    fontSize: 10,
    backgroundColor: '#fee2e2',
    color: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
    marginRight: 6,
    marginBottom: 4,
  },
  solutionBadge: {
    fontSize: 10,
    backgroundColor: '#d1fae5',
    color: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  metaLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  metaValSuccess: {
    fontSize: 10,
  },
  metaValFail: {
    fontSize: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
    marginTop: 4,
  },
  salesIdSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  salesIdLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  salesIdLink: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  payoutBadgeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeApproved: {
    backgroundColor: '#d1fae5',
  },
  statusBadgeRejected: {
    backgroundColor: '#fee2e2',
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusTextApproved: {
    color: '#065f46',
  },
  statusTextRejected: {
    color: '#991b1b',
  },
  statusTextPending: {
    color: '#d97706',
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  amountLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 4,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    height: 32,
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: '#f9fafb',
    width: 90,
  },
  pickerCompact: {
    height: 32,
    color: '#374151',
  },
  bulkActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1b4b',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  bulkCountText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  bulkActionLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  coaSelectButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 10,
    maxWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coaSelectButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bulkApproveBtn: {
    flexDirection: 'row',
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  bulkApproveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  sheetBody: {
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  toggleLabelCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  toggleDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  sheetCloseBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sheetCloseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailSheet: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '92%',
  },

  detailScrollContent: {
    padding: 12,
  },
  detailLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  detailLoaderText: {
    marginTop: 10,
    color: '#6b7280',
  },
  detailMetaCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  detailMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    alignItems: 'center',
  },
  detailMetaLabel: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  detailMetaVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'right',
    flex: 1.5,
    marginLeft: 12,
  },
  detailSalesIdLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    textDecorationLine: 'underline',
    textAlign: 'right',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  itemDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemDetailHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  itemDetailName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  itemDetailSKU: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetailLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  itemDetailVal: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  itemDetailValBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  detailItemsEmpty: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  detailItemsEmptyText: {
    color: '#6b7280',
    fontSize: 13,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  qtyBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 4,
    backgroundColor: '#f8fafc',
  },
  qtyText: {
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  detailActionBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  detailActionBoxTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  detailActionBoxDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 12,
  },
  actionCoaLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 6,
  },
  coaSelectButtonDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#f9fafb',
    marginBottom: 14,
  },
  coaSelectButtonDetailText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  dualButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtnDetail: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnReject: {
    backgroundColor: '#dc2626',
    marginRight: 8,
  },
  actionBtnApprove: {
    backgroundColor: '#059669',
    marginLeft: 8,
  },
  actionBtnRejectMarket: {
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  actionBtnApproveMarket: {
    backgroundColor: '#2563eb',
    marginLeft: 8,
  },
  actionBtnTextDetail: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  detailSheetFooter: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailSheetCloseBtn: {
    backgroundColor: '#4b5563',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailSheetCloseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  detailSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e1b4b',
  },
  detailSheetCloseBtnHeader: {
    padding: 8,
  },
});
