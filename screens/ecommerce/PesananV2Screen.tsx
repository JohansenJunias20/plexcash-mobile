import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Alert, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import moment from 'moment';
import PesananV2FilterModal from '../../components/PesananV2FilterModal';
import PesananV2OrderCard from '../../components/PesananV2OrderCard';
import ProgressModal from '../../components/ProgressModal';

type Nav = NativeStackNavigationProp<any>;

// Same status tabs as web
const STATUS_TABS = [
  { label: 'Semua Pesanan', value: 'SEMUA' },
  { label: 'Belum Dibayar', value: 'BELUM DIBAYAR' },
  { label: 'Pesanan Baru', value: 'PESANAN BARU' },
  { label: 'Siap Dikirim', value: 'SIAP DIKIRIM' },
  { label: 'Dikirim', value: 'DIKIRIM' },
  { label: 'Selesai', value: 'SELESAI' },
  { label: 'Pembatalan', value: 'PEMBATALAN' },
  { label: 'Pengembalian', value: 'PENGEMBALIAN' },
];

// Helper function to deduplicate orders by id_online and ecommerce_id to prevent duplicate key rendering warnings
function deduplicateOrders(list: any[]) {
  const seen = new Set<string>();
  return list.filter(item => {
    if (!item) return false;
    const key = `${item.id_online || ''}-${item.ecommerce_id || ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export default function PesananV2Screen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  // Core state
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({ page: 1, per_page: 50, total_records: 0, total_pages: 0 });

  // Filters
  const [currentTab, setCurrentTab] = useState('SEMUA');
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [filterCounts, setFilterCounts] = useState<any>({ penjualan: { sudah: 0, belum: 0 }, kurir: {}, toko: {}, cetak: { sudah: 0, belum: 0 }, scan: { sudah: 0, belum: 0 } });
  
  const [searchType, setSearchType] = useState<'order_id' | 'no_resi' | 'buyer_username' | 'sku'>('order_id');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchTagInput, setSearchTagInput] = useState('');
  
  const [sortMethod, setSortMethod] = useState<'terbaru' | 'terlama' | 'deadline'>('terbaru');
  const [dateType, setDateType] = useState<'tanggal_order' | 'waktu_proses' | 'tanggal_cetak' | 'tanggal_batal'>('tanggal_order');
  const [filterCetak, setFilterCetak] = useState<'semua' | 'sudah' | 'belum'>('semua');
  const [filterScan, setFilterScan] = useState<'semua' | 'sudah' | 'belum'>('semua');
  
  const [dateStart, setDateStart] = useState(moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DDTHH:mm'));
  const [dateEnd, setDateEnd] = useState(moment().endOf('day').format('YYYY-MM-DDTHH:mm'));
  const [orderTypeFilter, setOrderTypeFilter] = useState<'semua' | 'standard' | 'kilat'>('semua');
  const [hasPenjualan, setHasPenjualan] = useState<'semua' | 'sudah' | 'belum'>('semua');
  const [kurirFilters, setKurirFilters] = useState<string[]>([]);
  const [filterResep, setFilterResep] = useState(false);
  
  const [ecommerceList, setEcommerceList] = useState<any[]>([]);
  const [selectedEcommerces, setSelectedEcommerces] = useState<number[]>([]);
  const [platformFilter, setPlatformFilter] = useState('');

  // Modals
  const [filterOpen, setFilterOpen] = useState(false);
  
  // Progress/Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIdRef = useRef(0);

  // Selection
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<'none' | 'page' | 'all'>('none');

  // Permissions
  const [userInfo, setUserInfo] = useState({ canUpdate: true, email: '' });

  // Progress Modals
  const [buatProgress, setBuatProgress] = useState({ open: false, processed: 0, total: 0, status: '', title: '' });
  const [cetakLoading, setCetakLoading] = useState(false);

  const fetchIdRef = useRef(0);
  const kilatAllOrdersRef = useRef<any[]>([]);

  // Fetch ecommerces and permissions on mount
  useEffect(() => {
    const init = async () => {
      try {
        const res = await ApiService.authenticatedRequest('/get/ecommerce');
        if (res?.status) {
          setEcommerceList((res.data || []).filter((e: any) => e.status === 'APPROVED'));
        }
        const accRes = await ApiService.authenticatedRequest('/get/akses');
        if (accRes?.status) {
          setUserInfo({
            canUpdate: accRes?.data?.actions?.update ?? true,
            email: '',
          });
        }
      } catch (e) {}
    };
    init();
  }, []);

  const fetchOrders = useCallback(async (params?: any) => {
    fetchIdRef.current++;
    const thisFetchId = fetchIdRef.current;
    
    // Only show loading if it's not a background pagination or refresh
    if (!params?.isLoadMore && !params?.isRefresh) {
      setLoading(true);
    }

    const effectiveTags = params?.search_values ?? searchTags;
    const effectiveType = params?.search_type ?? searchType;
    const effectiveHasPenjualan = params?.has_penjualan ?? hasPenjualan;
    const effectiveKurirs = params?.kurir_list ?? kurirFilters;
    const effectiveEcommerces = params?.ecommerce_ids ?? selectedEcommerces;
    const effectivePlatform = params?.platform ?? platformFilter;
    const effectiveFilterResep = params?.filter_resep !== undefined ? params.filter_resep : filterResep;
    const effectiveStatus = params?.status ?? currentTab;
    const effectiveOrderType = params?.order_type ?? orderTypeFilter;
    const effectivePage = params?.page ?? pagination.page;
    const effectivePerPage = params?.per_page ?? pagination.per_page;

    const queryParams = new URLSearchParams({
        status: effectiveStatus,
        page: String(effectivePage),
        per_page: String(effectivePerPage),
        search_type: effectiveType,
        search_values: effectiveTags.join(','),
        sort: params?.sort ?? sortMethod,
        date_type: params?.date_type ?? dateType,
        date_start: (params?.date_start ?? dateStart).replace('T', ' '),
        date_end: (params?.date_end ?? dateEnd).replace('T', ' '),
        kurir: effectiveKurirs.join(','),
        ecommerce_ids: effectiveEcommerces.join(','),
        has_penjualan: effectiveHasPenjualan,
        platform: effectivePlatform,
        filter_cetak: params?.filter_cetak ?? filterCetak,
        filter_scan: params?.filter_scan ?? filterScan,
        filter_resep: String(effectiveFilterResep),
    });

        const queryString = queryParams.toString();
        console.log('[PesananV2] Fetching:', `/get/pesanan-v2/orders?${queryString}`);

        try {
            let dbRes: any = null;
            dbRes = await ApiService.authenticatedRequest(`/get/pesanan-v2/orders?${queryString}&t=${Date.now()}`);
            console.log('[PesananV2] Res status:', dbRes?.status, 'Data length:', dbRes?.data?.length);
            if (dbRes?.data?.length === 1) {
                console.log('[PesananV2] Single Order Data:', JSON.stringify(dbRes.data[0]));
                console.log('[PesananV2] Pagination Info:', JSON.stringify(dbRes.pagination));
            }

        if (thisFetchId !== fetchIdRef.current) return;

        let dbOrders: any[] = [];
        let newPagination = { page: effectivePage, per_page: effectivePerPage, total_records: 0, total_pages: 1 };
        
        let dbResFilterCounts = { penjualan: { sudah: 0, belum: 0 }, kurir: {}, toko: {}, cetak: { sudah: 0, belum: 0 }, scan: { sudah: 0, belum: 0 } };

        if (dbRes && dbRes.status) {
            let rawDbOrders = dbRes.data || [];
            
            // Standardize print and scanned flags flexibly to handle any V2 API format variations
            rawDbOrders = rawDbOrders.map((rd: any) => {
                const rawScanned = rd.scanned !== undefined ? rd.scanned : rd.is_scanned;
                const rawPrint = rd.print !== undefined ? rd.print : rd.is_printed;
                const rawPacked = rd.packed !== undefined ? rd.packed : rd.is_packed;
                
                const isScanned = (!!rawScanned && rawScanned !== '0' && rawScanned !== 0 && String(rawScanned).toLowerCase() !== 'false') || !!rd.scan_timestamp;
                const isPrinted = (!!rawPrint && rawPrint !== '0' && rawPrint !== 0 && String(rawPrint).toLowerCase() !== 'false') || !!rd.print_timestamp;
                const isPacked = (!!rawPacked && rawPacked !== '0' && rawPacked !== 0 && String(rawPacked).toLowerCase() !== 'false') || !!rd.pack_timestamp;
                
                return {
                    ...rd,
                    print: isPrinted,
                    scanned: isScanned,
                    packed: isPacked,
                };
            });
            

            dbOrders = rawDbOrders;
            
            newPagination.total_records = dbRes.pagination?.total_records || 0;
            newPagination.total_pages = Math.max(1, dbRes.pagination?.total_pages || 1);
            if (dbRes.tab_counts) setTabCounts(dbRes.tab_counts);
            if (dbRes.filter_counts) dbResFilterCounts = { ...dbRes.filter_counts };
        } else if (dbRes && !dbRes.status) {
            Alert.alert('Error', dbRes.reason || 'Gagal memuat pesanan');
        }

        // Merge with Kilat Orders if orderType !== standard
        const cachedKilat = kilatAllOrdersRef.current || [];
        if (cachedKilat.length > 0 && effectiveOrderType !== 'standard') {
            const filterTab = (o: any) => {
                if (effectiveStatus === 'SEMUA') return true;
                const s = o.booking_status || o.status;
                if (effectiveStatus === 'PESANAN BARU' && s === 'PESANAN BARU') return true;
                if (effectiveStatus === 'SIAP DIKIRIM' && s === 'DIPROSES') return true;
                if (effectiveStatus === 'DIKIRIM' && s === 'PERJALANAN') return true;
                if (effectiveStatus === 'SELESAI' && s === 'SELESAI') return true;
                if (effectiveStatus === 'PEMBATALAN' && s === 'PEMBATALAN') return true;
                return false;
            };
            const filterSearch = (o: any) => {
                if (!effectiveTags.length) return true;
                return effectiveTags.some((tag: string) => {
                    const t = tag.toLowerCase();
                    return (o.id_online || o.booking_sn || '').toLowerCase().includes(t) ||
                           (o.buyer_username || '').toLowerCase().includes(t) ||
                           (o.no_resi || '').toLowerCase().includes(t);
                });
            };
            
            // Map raw booking fields to display fields (mirrors web Pesanan V2 mapping)
            const mapStatus = (s?: string) => {
                switch ((s || '').toUpperCase()) {
                    case 'READY_TO_SHIP': case 'RETRY_SHIP': case 'PROCESSED':
                    case 'MATCHED': case 'ARRANGED': return 'DIPROSES';
                    case 'SHIPPED': return 'PERJALANAN';
                    case 'COMPLETED': return 'SELESAI';
                    case 'CANCELLED': case 'IN_CANCEL': return 'PEMBATALAN';
                    default: return s || 'UNKNOWN';
                }
            };

            const filterScanLocal = (o: any) => {
                const effectiveFilterScan = params?.filter_scan ?? filterScan;
                const effectiveFilterCetak = params?.filter_cetak ?? filterCetak;
                
                let pass = true;
                
                if (effectiveFilterScan !== 'semua') {
                    const isScanned = o.scanned || !!o.scan_timestamp;
                    if (effectiveFilterScan === 'sudah' && !isScanned) pass = false;
                    if (effectiveFilterScan === 'belum' && isScanned) pass = false;
                }
                
                if (effectiveFilterCetak !== 'semua') {
                    const isPrinted = o.print || !!o.print_timestamp;
                    if (effectiveFilterCetak === 'sudah' && !isPrinted) pass = false;
                    if (effectiveFilterCetak === 'belum' && isPrinted) pass = false;
                }
                
                return pass;
            };

            let preFilteredKilat = cachedKilat
                .map(o => ({
                    ...o,
                    isBookingOrder: true,
                    // Use order_sn if available (for OrderDetail lookup), fallback to booking_sn
                    id_online: o.order_sn || o.booking_sn,
                    booking_sn: o.booking_sn,
                    ecommerce_id: o.id_ecommerce || o.ecommerce_id,
                    // Map display fields from raw booking response
                    status: mapStatus(o.booking_status || o.status),
                    buyer_username: o.recipient_address?.name || o.buyer_username || '-',
                    buyer_city: o.recipient_address?.city || o.buyer_city || '-',
                    nama_kurir: o.shipping_carrier || o.nama_kurir || '-',
                    no_resi: o.tracking_number || o.no_resi || o.booking_sn || '-',
                    tanggal_order: o.create_time || o.created_at || o.tanggal_order || null,
                    total_harga: o.total_amount || o.total_price || o.total_harga || 0,
                    items: (o.items || []).map((item: any) => ({
                        sku: item.sku || '-',
                        nama: item.name || item.nama || '-',
                        qty: item.qty || 1,
                        harga_jual: item.price || item.harga_jual || 0,
                    })),
                    orderType: 'PENGIRIMAN KILAT',
                }))
                .filter(o => filterTab(o) && filterSearch(o));
                
            // Ensure standard booleans for kilat as well using flexible checks
            preFilteredKilat.forEach((o: any) => {
                const rawScanned = o.scanned !== undefined ? o.scanned : o.is_scanned;
                const rawPrint = o.print !== undefined ? o.print : o.is_printed;
                const rawPacked = o.packed !== undefined ? o.packed : o.is_packed;
                
                o.scanned = (!!rawScanned && rawScanned !== '0' && rawScanned !== 0 && String(rawScanned).toLowerCase() !== 'false') || !!o.scan_timestamp;
                o.print = (!!rawPrint && rawPrint !== '0' && rawPrint !== 0 && String(rawPrint).toLowerCase() !== 'false') || !!o.print_timestamp;
                o.packed = (!!rawPacked && rawPacked !== '0' && rawPacked !== 0 && String(rawPacked).toLowerCase() !== 'false') || !!o.pack_timestamp;
            });
            
            const filteredKilat = preFilteredKilat.filter(o => filterScanLocal(o));
                
            const startIdx = (effectivePage - 1) * effectivePerPage;
            const paginatedKilat = filteredKilat.slice(startIdx, startIdx + effectivePerPage);

            if (effectiveOrderType === 'kilat') {
                dbOrders = paginatedKilat;
                newPagination.total_records = filteredKilat.length;
                newPagination.total_pages = Math.ceil(filteredKilat.length / effectivePerPage) || 1;
            } else if (filteredKilat.length > 0) {
                // If orderType is 'semua', combine them and filter duplicates
                const standardOrders = dbOrders.filter((o: any) => !o.isBookingOrder && !paginatedKilat.some(k => k.id_online === o.id_online || k.booking_sn === o.booking_sn || k.order_sn === o.id_online));
                dbOrders = [...paginatedKilat, ...standardOrders];
            }
        }

        if (effectivePage === 1) {
            setOrders(deduplicateOrders(dbOrders));
        } else {
            setOrders(prev => deduplicateOrders([...prev, ...dbOrders]));
        }
        setPagination(newPagination);
        
        setFilterCounts(dbResFilterCounts);
        
        // We handle selection clear slightly differently in mobile to preserve UX if wanted,
        // but to match web we clear on filter change.
        if (!params?.isLoadMore) {
            setSelectedOrders(new Set());
            setSelectAllMode('none');
        }

    } catch (err) {
        if (thisFetchId === fetchIdRef.current) {
            Alert.alert('Error', 'Koneksi ke server gagal');
        }
    } finally {
        if (thisFetchId === fetchIdRef.current) {
            setLoading(false);
            setRefreshing(false);
        }
    }
  }, [currentTab, pagination.page, pagination.per_page, searchTags, searchType, sortMethod, dateType, dateStart, dateEnd, filterCetak, filterScan, selectedEcommerces, hasPenjualan, kurirFilters, platformFilter, filterResep, orderTypeFilter]);

  // Live Sync Effect (matches Web's behavior for syncing from Marketplace)
  useEffect(() => {
    if (orderTypeFilter === 'standard' || ecommerceList.length === 0 || (currentTab === 'SEMUA' && orderTypeFilter === 'semua')) {
      return;
    }

    const syncLiveOrders = async () => {
      syncIdRef.current++;
      const currentSyncId = syncIdRef.current;
      
      const dEnd = moment(dateEnd).unix();
      const bStart = moment(dateEnd).subtract(10, 'days').unix();
      const dStart = Math.max(moment(dateStart).unix(), bStart);
      
      const targetEcommerces = selectedEcommerces.length > 0 
        ? ecommerceList.filter(e => selectedEcommerces.includes(e.id))
        : ecommerceList;

      if (targetEcommerces.length === 0) return;

      setIsSyncing(true);
      
      try {
        const settled = await Promise.allSettled(
          targetEcommerces.map(shop => 
            ApiService.authenticatedRequest(
              `/get/ecommerce/order/date/${dStart}/${dEnd}?id_ecommerce=${shop.id}&mode=cepat&t=${Date.now()}`
            )
          )
        );
        
        // Extract kilat bookings
        const allKilatOrders: any[] = [];
        settled.forEach((res) => {
          if (res.status === 'fulfilled' && res.value?.bookings) {
            allKilatOrders.push(...res.value.bookings);
          }
        });
        kilatAllOrdersRef.current = allKilatOrders;

        // After syncing, if we are still on the same sync run, refresh the local database view 
        if (currentSyncId === syncIdRef.current) {
          fetchOrders({ isRefresh: true });
        }
      } catch (err) {
        console.warn('[PesananV2] Sync failed:', err);
      } finally {
        if (currentSyncId === syncIdRef.current) {
          setIsSyncing(false);
        }
      }
    };

    syncLiveOrders();
  }, [currentTab, dateStart, dateEnd, selectedEcommerces, ecommerceList, orderTypeFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders({ page: 1, isRefresh: true });
    }, [fetchOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders({ page: 1, isRefresh: true });
  };

  const loadMore = () => {
    if (loading || refreshing || pagination.page >= pagination.total_pages) return;
    fetchOrders({ page: pagination.page + 1, isLoadMore: true });
  };

  const handleTabChange = (newTab: string) => {
    setCurrentTab(newTab);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchOrders({ status: newTab, page: 1 });
  };

  const handleSearchSubmit = () => {
      const trimmed = searchTagInput.trim();
      if (!trimmed) return;
      const newTags = [...searchTags, trimmed];
      setSearchTags(newTags);
      setSearchTagInput('');
      fetchOrders({ search_values: newTags, page: 1 });
  };

  const removeSearchTag = (tag: string) => {
      const newTags = searchTags.filter(t => t !== tag);
      setSearchTags(newTags);
      fetchOrders({ search_values: newTags, page: 1 });
  };

  // Selection
  const toggleSelection = (id_online: string) => {
      setSelectedOrders(prev => {
          const next = new Set(prev);
          if (next.has(id_online)) next.delete(id_online);
          else next.add(id_online);
          return next;
      });
  };

  const isAllSelected = selectedOrders.size === orders.length && orders.length > 0;
  
  const handleSelectAllToggle = () => {
      if (isAllSelected) {
          setSelectedOrders(new Set());
          setSelectAllMode('none');
      } else {
          setSelectedOrders(new Set(orders.map(o => o.id_online)));
          setSelectAllMode('page');
      }
  };

  // Bulk actions
  const bulkBuatPenjualan = async () => {
      if (!userInfo.canUpdate) return Alert.alert('Permission Error', 'Anda tidak memiliki akses.');
      
      const selectedArr = Array.from(selectedOrders);
      if (selectedArr.length === 0) return;

      Alert.alert(
          'Konfirmasi',
          `Buat penjualan untuk ${selectedArr.length} pesanan?`,
          [
              { text: 'Batal', style: 'cancel' },
              { text: 'Ya, Buat', onPress: () => executeBulkBuatPenjualan(selectedArr) }
          ]
      );
  };

  const executeBulkBuatPenjualan = async (selectedArr: string[]) => {
      setBuatProgress({ open: true, processed: 0, total: selectedArr.length, status: 'Mempersiapkan...', title: 'Membuat Penjualan...' });
      
      const ordersToProcess = orders.filter(o => selectedArr.includes(o.id_online));
      
      const CHUNK_SIZE = 5;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < ordersToProcess.length; i += CHUNK_SIZE) {
          const chunk = ordersToProcess.slice(i, i + CHUNK_SIZE);
          setBuatProgress(prev => ({ ...prev, status: `Memproses ${i+1} - ${Math.min(i+CHUNK_SIZE, ordersToProcess.length)} dari ${ordersToProcess.length}` }));

          try {
              const payloads = await Promise.all(chunk.map(async (o) => {
                  try {
                      // Fetch detail for latest items
                      const detailRes = await ApiService.authenticatedRequest(`/get/ecommerce/order?id=${o.id_online}&id_ecommerce=${o.ecommerce_id}`);
                      if (!detailRes?.status) return null;
                      const d = detailRes.data;
                      return {
                          platform: d.from || o.platform,
                          id: d.id || o.id_online,
                          barang: (d.items || []).map((it: any) => ({
                              price: it.price_after_discount ?? it.price ?? 0,
                              name: it.name,
                              sku: it.sku,
                              qty: it.qty,
                              id_online: it.id_online,
                              id_parent: it.id_parent,
                          })),
                          id_ecommerce: d.id_ecommerce || o.ecommerce_id,
                          date: typeof d.date === 'string' ? d.date : new Date().toISOString(),
                          invoice: d.invoice,
                          from_import: false,
                          booking_sn: d.booking_sn,
                          orderType: d.orderType,
                          isBookingOrder: !!d.booking_sn,
                          update_stok: true // Optional config
                      };
                  } catch { return null; }
              }));

              const validPayloads = payloads.filter(p => p !== null);
              if (validPayloads.length > 0) {
                  const res = await ApiService.authenticatedRequest('/ecommerce/pesanan', {
                      method: 'POST',
                      body: JSON.stringify(validPayloads)
                  });
                  if (res?.status) successCount += validPayloads.length;
                  else failCount += validPayloads.length;
              }
          } catch (e) {
              failCount += chunk.length;
          }

          setBuatProgress(prev => ({ ...prev, processed: i + chunk.length }));
      }

      setBuatProgress({ open: false, processed: 0, total: 0, status: '', title: '' });
      Alert.alert('Hasil Buat Penjualan', `Berhasil: ${successCount}\nGagal: ${failCount}`);
      setSelectedOrders(new Set());
      fetchOrders({ page: 1 });
  };

  const bulkBuatRetur = async () => {
      if (!userInfo.canUpdate) return Alert.alert('Permission Error', 'Anda tidak memiliki akses.');
      
      const selectedArr = Array.from(selectedOrders);
      if (selectedArr.length === 0) return;

      Alert.alert(
          'Konfirmasi',
          `Buat retur untuk ${selectedArr.length} pesanan?`,
          [
              { text: 'Batal', style: 'cancel' },
              { text: 'Ya, Buat', onPress: () => executeBulkBuatRetur(selectedArr) }
          ]
      );
  };

  const executeBulkBuatRetur = async (selectedArr: string[]) => {
      setBuatProgress({ open: true, processed: 0, total: selectedArr.length, status: 'Mempersiapkan...', title: 'Membuat Retur...' });
      
      const ordersToProcess = orders.filter(o => selectedArr.includes(o.id_online));
      
      const CHUNK_SIZE = 5;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < ordersToProcess.length; i += CHUNK_SIZE) {
          const chunk = ordersToProcess.slice(i, i + CHUNK_SIZE);
          setBuatProgress(prev => ({ ...prev, status: `Memproses ${i+1} - ${Math.min(i+CHUNK_SIZE, ordersToProcess.length)} dari ${ordersToProcess.length}` }));

          try {
              const payloads = await Promise.all(chunk.map(async (o) => {
                  try {
                      // Fetch detail for latest items
                      const detailRes = await ApiService.authenticatedRequest(`/get/ecommerce/order?id=${o.id_online}&id_ecommerce=${o.ecommerce_id}`);
                      if (!detailRes?.status) return null;
                      const d = detailRes.data;
                      return {
                          platform: d.from || o.platform,
                          id: d.id || o.id_online,
                          barang: (d.items || []).map((it: any) => ({
                              price: it.price_after_discount ?? it.price ?? 0,
                              name: it.name,
                              sku: it.sku,
                              qty: it.qty,
                              id_online: it.id_online,
                              id_parent: it.id_parent,
                          })),
                          id_ecommerce: d.id_ecommerce || o.ecommerce_id,
                          date: typeof d.date === 'string' ? d.date : new Date().toISOString(),
                          invoice: d.invoice,
                          from_import: false,
                          booking_sn: d.booking_sn,
                          orderType: d.orderType,
                          isBookingOrder: !!d.booking_sn,
                          update_stok: true
                      };
                  } catch { return null; }
              }));

              const validPayloads = payloads.filter(p => p !== null);
              if (validPayloads.length > 0) {
                  const res = await ApiService.authenticatedRequest('/ecommerce/retur', {
                      method: 'POST',
                      body: JSON.stringify(validPayloads)
                  });
                  if (res?.status) successCount += validPayloads.length;
                  else failCount += validPayloads.length;
              }
          } catch (e) {
              failCount += chunk.length;
          }

          setBuatProgress(prev => ({ ...prev, processed: i + chunk.length }));
      }

      setBuatProgress({ open: false, processed: 0, total: 0, status: '', title: '' });
      Alert.alert('Hasil Buat Retur', `Berhasil: ${successCount}\nGagal: ${failCount}`);
      setSelectedOrders(new Set());
      fetchOrders({ page: 1 });
  };

  const handlePrintLabels = async () => {
    if (!userInfo.canUpdate) return Alert.alert('Permission Error', 'Anda tidak memiliki akses.');
    
    const selectedArr = Array.from(selectedOrders);
    if (selectedArr.length === 0) return;

    const ordersToProcess = orders.filter(o => selectedArr.includes(o.id_online));
    setCetakLoading(true);
    
    try {
        const payload = ordersToProcess.map(o => ({
            id_ecommerce: o.ecommerce_id,
            order_id: o.id_online,
            booking_sn: o.booking_sn || null,
            A6: true,
        }));

        const res = await ApiService.authenticatedRequest('/ecommerce/ship_label', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const list = Array.isArray(res.data) ? res.data : [res];

        // Fetch recipe details if Shopee orders are present
        const shopeeOrders = list.filter((it: any) => !it.error && it.data && it.platform === 'SHOPEE' && it.type === 'data');
        let recipesMap: any = {};
        if (shopeeOrders.length > 0) {
          try {
            const orderIds = shopeeOrders.map((it: any) => it.order_id);
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
            throw new Error(processed.error);
        }

        navigation.navigate('LabelPreview', { 
            html: processed.html, 
            pdfUrl: processed.pdfUrl, 
            title: `Label Pengiriman (${ordersToProcess.length})` 
        });

    } catch (e: any) {
        Alert.alert('Gagal', e.message);
    } finally {
        setCetakLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.hamburgerButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color="#D97706" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pesanan V2</Text>
        <View style={styles.headerRight}>
            {isSyncing && (
              <ActivityIndicator size="small" color="#D97706" style={{ marginRight: 8 }} />
            )}
            <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
                <Ionicons name="refresh" size={22} color="#4B5563" />
            </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {STATUS_TABS.map((tab) => {
                  const isActive = currentTab === tab.value;
                  const count = tabCounts[tab.value] || 0;
                  return (
                      <TouchableOpacity
                          key={tab.value}
                          style={[styles.tabButton, isActive && styles.tabButtonActive]}
                          onPress={() => handleTabChange(tab.value)}
                      >
                          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                          {count > 0 && (
                              <View style={[styles.badge, isActive && styles.badgeActive]}>
                                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>{count > 99 ? '99+' : count}</Text>
                              </View>
                          )}
                      </TouchableOpacity>
                  );
              })}
          </ScrollView>
      </View>

      {/* Filter & Search Bar */}
      <View style={styles.filterBar}>
          <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginLeft: 8 }} />
              <TextInput
                  style={styles.searchInput}
                  placeholder={`Cari ${searchType === 'order_id' ? 'Order ID' : searchType === 'no_resi' ? 'No Resi' : searchType === 'buyer_username' ? 'Username' : 'SKU'}... (Enter)`}
                  value={searchTagInput}
                  onChangeText={setSearchTagInput}
                  onSubmitEditing={handleSearchSubmit}
              />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFilterOpen(true)}>
              <Ionicons name="filter" size={18} color="#4B5563" />
          </TouchableOpacity>
      </View>
      {/* Search Tags */}
      {searchTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.searchTagsScroll} contentContainerStyle={styles.searchTagsContainer}>
              {searchTags.map(tag => (
                  <View key={tag} style={styles.searchTag}>
                      <Text style={styles.searchTagText}>{tag}</Text>
                      <TouchableOpacity onPress={() => removeSearchTag(tag)}>
                          <Ionicons name="close-circle" size={16} color="#D97706" />
                      </TouchableOpacity>
                  </View>
              ))}
          </ScrollView>
      )}

      {/* Active Selection Bar */}
      {selectedOrders.size > 0 && (
          <View style={styles.selectionBar}>
              <Text style={styles.selectionText}>{selectedOrders.size} Dipilih</Text>
              <View style={styles.selectionActions}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F97316' }]} onPress={bulkBuatRetur}>
                      <Text style={styles.actionBtnText}>Buat Retur</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={bulkBuatPenjualan}>
                      <Text style={styles.actionBtnText}>Buat Penjualan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F3F4F6' }]} onPress={handlePrintLabels}>
                      <Text style={[styles.actionBtnText, { color: '#374151' }]}>Cetak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearBtn} onPress={() => setSelectedOrders(new Set())}>
                      <Ionicons name="close" size={20} color="#EF4444" />
                  </TouchableOpacity>
              </View>
          </View>
      )}

      {/* List */}
      {loading && orders.length === 0 ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#D97706" /></View>
      ) : (
          <FlatList
              data={orders}
              keyExtractor={(it) => `${it.id_online}-${it.ecommerce_id}`}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                  <PesananV2OrderCard
                      order={item}
                      isSelected={selectedOrders.has(item.id_online)}
                      onToggleSelect={() => toggleSelection(item.id_online)}
                      onPress={() => {
                           navigation.navigate('OrderDetail', {
                              // For kilat orders: pass booking_sn so detail screen can use it
                              id: item.isBookingOrder
                                ? (item.order_sn || item.booking_sn || item.id_online)
                                : item.id_online,
                              id_ecommerce: item.ecommerce_id,
                              scan_timestamp: item.scan_timestamp,
                              print_timestamp: item.print_timestamp,
                              scanned: item.scanned,
                              packed: item.packed,
                              pack_timestamp: item.pack_timestamp,
                              booking_sn: item.isBookingOrder ? item.booking_sn : undefined,
                              // Pass cached kilat data so detail screen shows items & shipping without extra API call
                              kilat_order_data: item.isBookingOrder ? {
                                buyer_username: item.buyer_username,
                                buyer_city: item.buyer_city,
                                nama_kurir: item.nama_kurir,
                                no_resi: item.no_resi,
                                tanggal_order: item.tanggal_order,
                                total_harga: item.total_harga,
                                ecommerce_name: item.ecommerce_name,
                                platform: item.platform,
                                status: item.status,
                                items: (item.items || []).map((it: any) => ({
                                  sku: it.sku || '-',
                                  nama: it.nama || it.name || '-',
                                  qty: it.qty || 1,
                                  harga_jual: it.harga_jual || it.price || 0,
                                })),
                              } : undefined,
                           });
                      }}
                  />
              )}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D97706']} />}
              ListFooterComponent={<View style={{ padding: 20 }}>{(loading || refreshing) && orders.length > 0 && <ActivityIndicator color="#D97706" />}</View>}
          />
      )}

      {/* Filter Modal */}
      <PesananV2FilterModal
          visible={filterOpen}
          onClose={() => setFilterOpen(false)}
          state={{ searchType, sortMethod, dateType, dateStart, dateEnd, orderTypeFilter, hasPenjualan, kurirFilters, platformFilter, filterCetak, filterScan, filterResep, selectedEcommerces }}
          setters={{ setSearchType, setSortMethod, setDateType, setDateStart, setDateEnd, setOrderTypeFilter, setHasPenjualan, setKurirFilters, setPlatformFilter, setFilterCetak, setFilterScan, setFilterResep, setSelectedEcommerces }}
          onApply={() => { setFilterOpen(false); fetchOrders({ page: 1 }); }}
          filterCounts={filterCounts}
          ecommerceList={ecommerceList}
      />

      {/* Progress Modal */}
      <ProgressModal
          visible={buatProgress.open}
          title={buatProgress.title || "Membuat Penjualan..."}
          status={buatProgress.status}
          progress={buatProgress.total > 0 ? (buatProgress.processed / buatProgress.total) : 0}
          processed={buatProgress.processed}
          total={buatProgress.total}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  hamburgerButton: { marginRight: 16 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1F2937' },
  headerRight: { flexDirection: 'row' },
  iconButton: { padding: 6, marginLeft: 8 },
  tabsContainer: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabButton: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center' },
  tabButtonActive: { borderBottomColor: '#D97706' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#D97706', fontWeight: '600' },
  badge: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  badgeActive: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },
  badgeTextActive: { color: '#D97706' },
  filterBar: { flexDirection: 'row', padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, height: 40, marginRight: 12 },
  searchInput: { flex: 1, paddingHorizontal: 8, fontSize: 14, color: '#1F2937' },
  filterButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  searchTagsScroll: { maxHeight: 40, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchTagsContainer: { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  searchTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8, borderWidth: 1, borderColor: '#FDE68A' },
  searchTagText: { fontSize: 12, color: '#B45309', marginRight: 4 },
  selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FEF3C7', borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  selectionText: { fontWeight: '600', color: '#B45309', fontSize: 14 },
  selectionActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  clearBtn: { marginLeft: 12 },
  listContent: { padding: 12, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
