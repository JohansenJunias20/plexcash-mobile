import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, useWindowDimensions, ActivityIndicator, FlatList, RefreshControl, Alert, Modal, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabView, TabBar } from 'react-native-tab-view';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import moment from 'moment';
import DiskonAddModal from './DiskonAddModal';
import { useFocusEffect } from '@react-navigation/native';

export default function DiskonScreen({ navigation }: any) {
  const layout = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'aktif', title: 'Live Shopee' },
    { key: 'riwayat', title: 'Riwayat' },
    { key: 'analisis', title: 'Analisis' },
  ]);

  const [promos, setPromos] = useState([]);
  const [livePromos, setLivePromos] = useState([]);
  const [historyPromos, setHistoryPromos] = useState([]);
  const [analisisItems, setAnalisisItems] = useState([]);

  const [loadingLokal, setLoadingLokal] = useState(false);
  const [loadingAktif, setLoadingAktif] = useState(false);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);

  const [shops, setShops] = useState<any[]>([]);
  const [analisisActiveShopId, setAnalisisActiveShopId] = useState<number>(0);
  const [filterShopName, setFilterShopName] = useState<string>('all');

  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set());
  const [etalaseModalVisible, setEtalaseModalVisible] = useState(false);
  const [etalaseModalItems, setEtalaseModalItems] = useState<any[]>([]);
  const [etalaseModalProductName, setEtalaseModalProductName] = useState('');
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailPromo, setDetailPromo] = useState<any>(null);
  const [shopeeDetailItems, setShopeeDetailItems] = useState<any[]>([]);
  const [loadingShopeeDetail, setLoadingShopeeDetail] = useState(false);
  const [editPriceMap, setEditPriceMap] = useState<Record<string, string>>({});
  const [savingPrice, setSavingPrice] = useState(false);

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [preselectedItems, setPreselectedItems] = useState<any[]>([]);
  const [initialShopForModal, setInitialShopForModal] = useState<any>(null);

  const [autoRenewPromos, setAutoRenewPromos] = useState([]);
  const [liveSearch, setLiveSearch] = useState('');

  // Analisis multi-select
  const [analisisSelected, setAnalisisSelected] = useState<Set<number>>(new Set());
  const [analisisSearch, setAnalisisSearch] = useState('');
  const [analisisFilterEtalase, setAnalisisFilterEtalase] = useState<'all' | 'ada' | 'tidak'>('all');
  const [analisisFilterHpp, setAnalisisFilterHpp] = useState<'all' | 'ada' | 'tidak'>('all');
  const [analisisFilterBound, setAnalisisFilterBound] = useState<'all' | 'ada' | 'tidak'>('all');

  const openAddModalWithItems = (items: any[], shopId?: number) => {
    setPreselectedItems(items);
    if (shopId) {
      const shopObj = shops.find(s => s.id === shopId || s.ID === shopId);
      setInitialShopForModal(shopObj);
    } else {
      setInitialShopForModal(null);
    }
    setAddModalVisible(true);
  };

  const openAddModal = () => {
    setPreselectedItems([]);
    setInitialShopForModal(null);
    setAddModalVisible(true);
  };

  // Fetching Data
  const fetchShops = async () => {
    try {
      const res = await ApiService.get('/get/shopee_shops');
      if (res && res.data && res.data.length > 0) {
        setShops(res.data);
        setAnalisisActiveShopId(res.data[0].id || res.data[0].ID);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPromos = async () => {
    setLoadingLokal(true);
    try {
      const res = await ApiService.get('/get/promo_marketplace');
      let items = [];
      if (Array.isArray(res)) items = res;
      else if (res && Array.isArray(res.data)) items = res.data;
      else if (res && res.data && Array.isArray(res.data.rows)) items = res.data.rows;
      else if (res && res.data && Array.isArray(res.data.data)) items = res.data.data;
      setPromos(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLokal(false);
    }
  };

  const fetchLivePromos = async () => {
    setLoadingAktif(true);
    try {
      const searchParam = liveSearch.trim() ? `&search=${encodeURIComponent(liveSearch)}` : '';
      const res = await ApiService.get(`/get/live_promo_shopee?status=ongoing,upcoming${searchParam}`);
      let items = [];
      if (Array.isArray(res)) items = res;
      else if (res && Array.isArray(res.data)) items = res.data;
      else if (res && res.data && Array.isArray(res.data.rows)) items = res.data.rows;
      else if (res && res.data && Array.isArray(res.data.data)) items = res.data.data;
      setLivePromos(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAktif(false);
    }
  };

  const fetchHistoryPromos = async () => {
    setLoadingRiwayat(true);
    try {
      const res = await ApiService.get('/get/live_promo_shopee?status=expired');
      let items = [];
      if (Array.isArray(res)) items = res;
      else if (res && Array.isArray(res.data)) items = res.data;
      else if (res && res.data && Array.isArray(res.data.rows)) items = res.data.rows;
      else if (res && res.data && Array.isArray(res.data.data)) items = res.data.data;
      setHistoryPromos(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  const fetchAnalisis = async () => {
    setLoadingAnalisis(true);
    try {
      const shopParam = analisisActiveShopId ? `&id_ecommerce=${analisisActiveShopId}` : '';
      const res = await ApiService.get(`/get/analisis_produk_masterbarang?search=${shopParam}`);
      let items = [];
      if (Array.isArray(res)) items = res;
      else if (res && Array.isArray(res.data)) items = res.data;
      else if (res && res.data && Array.isArray(res.data.rows)) items = res.data.rows;
      else if (res && res.data && Array.isArray(res.data.data)) items = res.data.data;
      else if (res && Array.isArray(res.result)) items = res.result;
      setAnalisisItems(items);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error API Analisis', e?.message || String(e));
    } finally {
      setLoadingAnalisis(false);
    }
  };

  const fetchAutoRenewPromos = async () => {
    try {
      const res = await ApiService.get('/get/auto_renew_promos');
      if (res && res.data) setAutoRenewPromos(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchShops();
      const currentRoute = routes[index]?.key;
      if (currentRoute === 'aktif') {
        fetchLivePromos();
      } else if (currentRoute === 'riwayat') {
        fetchHistoryPromos();
      } else if (currentRoute === 'analisis') {
        fetchAnalisis();
      }
    }, [index])
  );

  useEffect(() => {
    const currentRoute = routes[index]?.key;
    if (currentRoute === 'aktif' && livePromos.length === 0) fetchLivePromos();
    if (currentRoute === 'riwayat' && historyPromos.length === 0) fetchHistoryPromos();
    if (currentRoute === 'analisis' && analisisItems.length === 0) fetchAnalisis();
  }, [index]);

  useEffect(() => {
    const currentRoute = routes[index]?.key;
    if (currentRoute === 'analisis' && analisisActiveShopId !== 0) {
      fetchAnalisis();
    }
  }, [analisisActiveShopId, index]);

  const handleDeletePromo = (id: number) => {
    Alert.alert("Konfirmasi", "Yakin ingin menghapus promo ini (Lokal)?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        try {
          const res = await ApiService.post(`/delete/promo_marketplace/${id}`, {});
          if (res.success) {
            fetchPromos();
          } else {
            Alert.alert("Gagal", "Gagal menghapus promo.");
          }
        } catch (err) {
          console.error(err);
        }
      }}
    ]);
  };

  const handleSyncPromo = (id: number) => {
    Alert.alert("Konfirmasi", "Yakin ingin melakukan sync promo ini ke semua toko Shopee?", [
      { text: "Batal", style: "cancel" },
      { text: "Sync", onPress: async () => {
        try {
          const res = await ApiService.post(`/sync/promo_marketplace/${id}`, {});
          if (res.success) {
            Alert.alert("Berhasil", "Sync berhasil!");
          } else {
            Alert.alert("Info", "Sync selesai dengan pesan: " + res.message);
          }
          fetchPromos();
        } catch (err) {
          Alert.alert("Gagal", "Gagal melakukan sync.");
        }
      }}
    ]);
  };

  const endLivePromo = (discount_id: number, id_ecommerce: number) => {
    Alert.alert("Akhiri Promo", "Yakin ingin mengakhiri promo ini? Promo akan dihentikan di Shopee.", [
      { text: "Batal", style: "cancel" },
      { text: "Akhiri", style: "destructive", onPress: async () => {
        try {
          const res = await ApiService.post('/end/live_promo_shopee', { discount_id, id_ecommerce });
          if (res.success || res.status) {
            Alert.alert("Berhasil", "Promo berhasil diakhiri");
            fetchLivePromos();
          } else {
            Alert.alert("Gagal", res.message || res.reason || "Gagal mengakhiri promo");
          }
        } catch (err: any) {
          Alert.alert("Error", err.message || String(err));
        }
      }}
    ]);
  };

  const openShopeeDetail = async (promo: any) => {
    setDetailModalVisible(true);
    setDetailPromo(promo);
    setLoadingShopeeDetail(true);
    setShopeeDetailItems([]);
    setEditPriceMap({});
    try {
      const res = await ApiService.get(`/get/promo_detail_shopee/${promo.discount_id}?id_ecommerce=${promo.id_ecommerce}&_t=${Date.now()}`);
      if (res && res.success) {
        setShopeeDetailItems(res.data || []);
        const map: Record<string, string> = {};
        (res.data || []).forEach((item: any) => {
          const key = `${item.item_id}:${item.model_id || ''}`;
          map[key] = String(item.harga_promo || '');
        });
        setEditPriceMap(map);
      } else if (res && res.data) {
        setShopeeDetailItems(res.data);
      } else {
        Alert.alert("Gagal", res?.message || "Gagal memuat detail produk");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || String(e));
    } finally {
      setLoadingShopeeDetail(false);
    }
  };

  const handleSavePromoPrice = async () => {
    if (!detailPromo || !detailPromo.discount_id) return;
    const itemsToUpdate = shopeeDetailItems.filter(item => {
      const key = `${item.item_id}:${item.model_id || ''}`;
      if (editPriceMap[key] === undefined) return false;
      const cleanVal = editPriceMap[key].replace(/[^0-9]/g, '');
      if (!cleanVal) return false;
      return parseFloat(cleanVal) !== Number(item.harga_promo);
    }).map(item => {
      const key = `${item.item_id}:${item.model_id || ''}`;
      const cleanVal = editPriceMap[key].replace(/[^0-9]/g, '');
      const numModel = item.model_id ? Number(item.model_id) : 0;
      return {
        item_id: Number(item.item_id),
        model_id: numModel,
        id_online: Number(item.item_id),
        id_model: numModel,
        harga_promo: parseFloat(cleanVal),
        purchase_limit: item.purchase_limit ? Number(item.purchase_limit) : 0,
        original_price: Number(item.harga_asli || item.original_price || item.harga_normal || 0)
      };
    }).filter(it => it.harga_promo > 0);

    if (itemsToUpdate.length === 0) return Alert.alert('Info', 'Tidak ada perubahan harga.');

    setSavingPrice(true);
    try {
      const res = await ApiService.post('/update/live_promo_price', {
        discount_id: detailPromo.discount_id,
        id_ecommerce: detailPromo.id_ecommerce,
        items: itemsToUpdate
      });
      if (res.success || res.status) {
        Alert.alert('Sukses', 'Harga promo berhasil diperbarui!');
        // Update local state to avoid backend cache returning old data
        const updatedItems = shopeeDetailItems.map(it => {
          const key = `${it.item_id}:${it.model_id || ''}`;
          if (editPriceMap[key] !== undefined) {
             const cleanVal = editPriceMap[key].replace(/[^0-9]/g, '');
             if (cleanVal) return { ...it, harga_promo: parseFloat(cleanVal) };
          }
          return it;
        });
        setShopeeDetailItems(updatedItems);
        
        const newMap: Record<string, string> = {};
        updatedItems.forEach((it: any) => {
          const key = `${it.item_id}:${it.model_id || ''}`;
          newMap[key] = String(it.harga_promo || '');
        });
        setEditPriceMap(newMap);
      } else {
        Alert.alert('Gagal', res.message || 'Terjadi kesalahan');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setSavingPrice(false);
    }
  };

  // Rendering Tabs
  const renderShopTabs = (currentValue: any, onSelect: (val: any) => void, useName: boolean = false, allowAll: boolean = true) => {
    const data = allowAll ? [{ id: 0, name: 'Semua Toko' }, ...shops] : shops;
    return (
      <View style={{ marginBottom: 12, marginTop: 8 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={data}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => {
            const val = useName && item.id !== 0 ? item.name : item.id;
            const isActive = currentValue === val || (currentValue === 'all' && item.id === 0);
            return (
              <TouchableOpacity
                style={[styles.shopTab, isActive && styles.shopTabActive]}
                onPress={() => onSelect(val === 0 && useName ? 'all' : val)}
              >
                <Text style={[styles.shopTabText, isActive && styles.shopTabTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>
    );
  };

  const renderLokal = () => (
    <View style={styles.tabContent}>
      {autoRenewPromos.length > 0 && (
        <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="sync-circle" size={28} color="#3b82f6" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e293b' }}>Promo Perpanjang Otomatis</Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>{autoRenewPromos.length} promo dijadwalkan</Text>
          </View>
        </View>
      )}
      {loadingLokal ? <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} /> : (
        <FlatList
          data={promos}
          keyExtractor={(item: any) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loadingLokal} onRefresh={fetchPromos} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.nama_promo}</Text>
                <View style={[styles.statusBadge, item.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.cardDetail}>Mulai: {moment(item.start_time).format('DD MMM YYYY HH:mm')}</Text>
              <Text style={styles.cardDetail}>Akhir: {moment(item.end_time).format('DD MMM YYYY HH:mm')}</Text>
              <Text style={styles.cardDetail}>Auto Renew: {item.auto_renew ? 'Ya' : 'Tidak'}</Text>
              
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeletePromo(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  <Text style={[styles.actionText, {color: '#ef4444'}]}>Hapus</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleSyncPromo(item.id)}>
                  <Ionicons name="sync-outline" size={20} color="#3b82f6" />
                  <Text style={[styles.actionText, {color: '#3b82f6'}]}>Sync</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada promo lokal.</Text>}
        />
      )}
    </View>
  );

  const renderAktif = () => (
    <View style={styles.tabContent}>
      {renderShopTabs(filterShopName, setFilterShopName, true)}
      <View style={[styles.searchBarRow, { marginBottom: 12, paddingHorizontal: 0, borderBottomWidth: 0 }]}>
        <TextInput
          style={styles.analisisSearchInput}
          placeholder="Cari promo..."
          value={liveSearch}
          onChangeText={setLiveSearch}
          onSubmitEditing={fetchLivePromos}
        />
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchLivePromos}>
          <Ionicons name="search" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>
      {loadingAktif ? <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} /> : (
        <FlatList
          data={livePromos.filter((p: any) => filterShopName === 'all' || p.shop_name === filterShopName)}
          keyExtractor={(item: any) => item.discount_id.toString() + item.id_ecommerce}
          refreshControl={<RefreshControl refreshing={loadingAktif} onRefresh={fetchLivePromos} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openShopeeDetail(item)}>
              <Text style={styles.cardTitle}>{item.discount_name}</Text>
              <Text style={styles.cardShop}>{item.shop_name}</Text>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
                <Text style={styles.cardDetail}>{moment(item.start_time * 1000).format('DD MMM YYYY')}</Text>
                <Text style={styles.cardDetail}>sd {moment(item.end_time * 1000).format('DD MMM YYYY')}</Text>
              </View>
              <View style={[styles.statusBadge, { alignSelf: 'flex-start', marginTop: 8 }, item.status_api === 'ongoing' ? styles.statusActive : styles.statusUpcoming]}>
                  <Text style={styles.statusText}>{item.status_api.toUpperCase()}</Text>
              </View>
              {item.status_api === 'ongoing' && (
                <TouchableOpacity 
                  style={{ position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}
                  onPress={() => endLivePromo(item.discount_id, item.id_ecommerce)}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>Akhiri</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada promo Shopee aktif.</Text>}
        />
      )}
    </View>
  );

  const renderRiwayat = () => (
    <View style={styles.tabContent}>
      {renderShopTabs(filterShopName, setFilterShopName, true)}
      {loadingRiwayat ? <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} /> : (
        <FlatList
          data={historyPromos.filter((p: any) => filterShopName === 'all' || p.shop_name === filterShopName)}
          keyExtractor={(item: any) => item.discount_id.toString() + item.id_ecommerce}
          refreshControl={<RefreshControl refreshing={loadingRiwayat} onRefresh={fetchHistoryPromos} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, { opacity: 0.7 }]} onPress={() => openShopeeDetail(item)}>
              <Text style={styles.cardTitle}>{item.discount_name}</Text>
              <Text style={styles.cardShop}>{item.shop_name}</Text>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
                <Text style={styles.cardDetail}>{moment(item.start_time * 1000).format('DD MMM YYYY')}</Text>
                <Text style={styles.cardDetail}>sd {moment(item.end_time * 1000).format('DD MMM YYYY')}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada riwayat promo.</Text>}
        />
      )}
    </View>
  );

  const renderAnalisis = () => {
    // Filter
    let filtered = [...analisisItems] as any[];
    if (analisisSearch) {
      const q = analisisSearch.toLowerCase();
      filtered = filtered.filter((i: any) =>
        (i.nama && i.nama.toLowerCase().includes(q)) ||
        (i.sku && i.sku.toLowerCase().includes(q)) ||
        (i.merk && i.merk.toLowerCase().includes(q))
      );
    }
    if (analisisFilterHpp === 'ada') filtered = filtered.filter((i: any) => i.hpp > 0);
    if (analisisFilterHpp === 'tidak') filtered = filtered.filter((i: any) => !(i.hpp > 0));
    if (analisisFilterBound === 'ada') filtered = filtered.filter((i: any) => i.jumlah_shopee_bound > 0);
    if (analisisFilterBound === 'tidak') filtered = filtered.filter((i: any) => !(i.jumlah_shopee_bound > 0));
    if (analisisFilterEtalase === 'ada') filtered = filtered.filter((i: any) => i.jumlah_etalase_harga_coret > 0);
    if (analisisFilterEtalase === 'tidak') filtered = filtered.filter((i: any) => !(i.jumlah_etalase_harga_coret > 0));

    const allIds = filtered.map((i: any) => i.id || i.id_masterbarang || i.id_produk);
    const allSelected = allIds.length > 0 && allIds.every((id: number) => analisisSelected.has(id));
    const selectedCount = analisisSelected.size;

    const toggleOne = (id: number) => {
      setAnalisisSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    const selectAll = () => setAnalisisSelected(new Set(allIds));
    const clearAll = () => setAnalisisSelected(new Set());

    const buildPromoItems = (ids: Set<number>) => {
      const items: any[] = [];
      (analisisItems as any[]).forEach((i: any) => {
        const currentId = i.id || i.id_masterbarang || i.id_produk;
        if (ids.has(currentId)) {
          if (i.variants && i.variants.length > 0 && !i.is_single_product) {
            i.variants.forEach((v: any) => {
              const fullName = v.nama
                ? (v.nama.toLowerCase().includes(i.nama.toLowerCase())
                  ? v.nama
                  : `${i.nama} - ${v.nama}`)
                : i.nama;
              items.push({
                id_masterbarang: v.id || v.id_masterbarang || v.id_produk || currentId,
                nama: fullName,
                sku: v.sku || i.sku,
                merk: v.merk || i.merk,
                hpp: v.hpp || i.hpp,
                harga_jual_2: v.harga_jual_2 || i.harga_jual_2,
                harga_promo: '',
                persentase_promo: '',
                purchase_limit: '0',
                included_id_onlines: [],
                showMappings: false,
              });
            });
          } else {
            items.push({
              id_masterbarang: currentId,
              nama: i.nama,
              sku: i.sku,
              merk: i.merk,
              hpp: i.hpp,
              harga_jual_2: i.harga_jual_2,
              harga_promo: '',
              persentase_promo: '',
              purchase_limit: '0',
              included_id_onlines: [],
              showMappings: false,
            });
          }
        }
      });
      return items;
    };

    return (
      <View style={{ flex: 1 }}>
        {renderShopTabs(analisisActiveShopId, setAnalisisActiveShopId, false, false)}
        
        {/* Search bar */}
        <View style={[styles.searchBarRow]}>
          <TextInput
            style={styles.analisisSearchInput}
            placeholder="Cari nama/SKU/merk..."
            value={analisisSearch}
            onChangeText={setAnalisisSearch}
          />
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchAnalisis}>
            <Ionicons name="refresh" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Filter badges */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Harga Coret:</Text>
          {(['all', 'ada', 'tidak'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.filterChip, analisisFilterEtalase === v && styles.filterChipActive]}
              onPress={() => setAnalisisFilterEtalase(v)}
            >
              <Text style={[styles.filterChipText, analisisFilterEtalase === v && styles.filterChipTextActive]}>
                {v === 'all' ? 'Semua' : v === 'ada' ? '✅ Ada' : '❌ Belum Ada'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Select-all bar */}
        <View style={styles.selectAllBar}>
          <TouchableOpacity onPress={allSelected ? clearAll : selectAll} style={styles.selectAllBtn}>
            <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={20} color="#f59e0b" />
            <Text style={styles.selectAllText}>
              {allSelected ? 'Batal Semua' : `Pilih Semua (${filtered.length})`}
            </Text>
          </TouchableOpacity>
          {analisisFilterEtalase === 'tidak' && filtered.length > 0 && (
            <TouchableOpacity
              style={styles.selectAllQuickBtn}
              onPress={() => setAnalisisSelected(new Set(allIds))}
            >
              <Text style={styles.selectAllQuickText}>Pilih Semua Belum Promo</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingAnalisis
          ? <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} />
          : (
          <FlatList
            data={filtered}
            keyExtractor={(item: any, index: number) => String(item.id || item.id_masterbarang || item.id_produk || index)}
            refreshControl={<RefreshControl refreshing={loadingAnalisis} onRefresh={fetchAnalisis} />}
            renderItem={({ item }: any) => {
              const currentId = item.id || item.id_masterbarang || item.id_produk;
              const isChecked = analisisSelected.has(currentId);
              const hasEtalase = item.jumlah_etalase_harga_coret > 0;
              return (
                <TouchableOpacity
                  style={[styles.card, isChecked && styles.cardSelected]}
                  onPress={() => toggleOne(currentId)}
                  onLongPress={() => {
                    openAddModalWithItems(buildPromoItems(new Set([currentId])), analisisActiveShopId);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isChecked ? '#f59e0b' : '#d1d5db'}
                      style={{ marginRight: 10, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.cardTitle, { flex: 1 }]}>{item.nama}</Text>
                        <View style={[styles.etalaseBadge, hasEtalase ? styles.etalaseBadgeActive : styles.etalaseBadgeNone]}>
                          <Text style={[styles.etalaseBadgeText, hasEtalase ? { color: '#15803d' } : { color: '#9ca3af' }]}>
                            {hasEtalase ? `✓ ${item.jumlah_etalase_harga_coret} Promo` : '— Belum Promo'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardDetail}>SKU: {item.sku}{item.merk ? ` · ${item.merk}` : ''}</Text>
                      <View style={styles.rowBetween}>
                        <Text style={styles.cardDetail}>HPP: Rp {Number(item.hpp).toLocaleString('id-ID')}</Text>
                        <Text style={styles.cardDetail}>HJ2: Rp {Number(item.harga_jual_2).toLocaleString('id-ID')}</Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <Text style={[styles.cardDetail, { fontWeight: 'bold', marginBottom: 0 }]}>
                          Shopee Bound: {item.jumlah_shopee_bound}
                        </Text>
                        {hasEtalase && (
                          <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}
                            onPress={(e) => {
                              e.stopPropagation();
                              setEtalaseModalItems(item.etalase_harga_coret);
                              setEtalaseModalProductName(`${item.nama} (${item.sku})`);
                              setEtalaseModalVisible(true);
                            }}
                          >
                            <Ionicons name="information-circle" size={16} color="#0284c7" />
                            <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: 'bold', marginLeft: 4 }}>Detail Etalase</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {item.variants && item.variants.length > 0 && !item.is_single_product && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                          <TouchableOpacity 
                            onPress={(e) => {
                              e.stopPropagation();
                              setExpandedVariants(prev => {
                                const next = new Set(prev);
                                if (next.has(currentId)) next.delete(currentId);
                                else next.add(currentId);
                                return next;
                              });
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                          >
                            <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 13 }}>
                              {item.variants.length} Varian
                            </Text>
                            <Ionicons name={expandedVariants.has(currentId) ? "chevron-up" : "chevron-down"} size={14} color="#3b82f6" style={{ marginLeft: 4 }} />
                          </TouchableOpacity>
                          
                          {expandedVariants.has(currentId) && (
                            <View style={{ marginTop: 4, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6 }}>
                              {item.variants.map((v: any, vIdx: number) => (
                                <View key={vIdx} style={{ marginBottom: vIdx < item.variants.length - 1 ? 8 : 0, paddingBottom: vIdx < item.variants.length - 1 ? 8 : 0, borderBottomWidth: vIdx < item.variants.length - 1 ? 1 : 0, borderBottomColor: '#e2e8f0' }}>
                                  <Text style={{ fontSize: 13, fontWeight: '500', color: '#1e293b' }}>{v.nama}</Text>
                                  <Text style={{ fontSize: 11, color: '#64748b' }}>{v.sku}</Text>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                                    <Text style={{ fontSize: 12, color: '#475569' }}>HPP: Rp {Number(v.hpp).toLocaleString('id-ID')}</Text>
                                    <Text style={{ fontSize: 12, color: '#475569' }}>HJ2: Rp {Number(v.harga_jual_2).toLocaleString('id-ID')}</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada data analisis.</Text>}
            contentContainerStyle={{ paddingBottom: selectedCount > 0 ? 100 : 16 }}
          />
        )}

        {/* Floating action bar when items selected */}
        {selectedCount > 0 && (
          <View style={styles.selectionActionBar}>
            <Text style={styles.selectionCount}>{selectedCount} barang dipilih</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.selectionClearBtn} onPress={clearAll}>
                <Text style={styles.selectionClearText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.selectionPromoBtn}
                onPress={() => {
                  openAddModalWithItems(buildPromoItems(analisisSelected), analisisActiveShopId);
                  clearAll();
                }}
              >
                <Ionicons name="pricetag" size={16} color="#fff" />
                <Text style={styles.selectionPromoText}>Buat Promo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderScene = ({ route }: any) => {
    switch (route.key) {
      case 'lokal': return renderLokal();
      case 'aktif': return renderAktif();
      case 'riwayat': return renderRiwayat();
      case 'analisis': return renderAnalisis();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => navigation.toggleDrawer?.()} style={styles.menuBtn}>
          <Ionicons name="menu" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle}>Diskon & Promo</Text>
      </View>
      <View style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={props => (
          <TabBar
            {...props}
            scrollEnabled
            indicatorStyle={{ backgroundColor: '#f59e0b' }}
            style={{ backgroundColor: '#fff' }}
            labelStyle={{ color: '#374151', fontWeight: 'bold', fontSize: 13, textTransform: 'none' }}
            activeColor="#f59e0b"
            inactiveColor="#9ca3af"
            tabStyle={{ width: 'auto', minWidth: 100 }}
          />
        )}
      />

      {/* FAB Tambah Promo - di tab Live Shopee */}
      {routes[index]?.key === 'aktif' && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Modal Detail Live Shopee */}
      <Modal visible={detailModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={{ padding: 8, marginRight: 8 }}>
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>{detailPromo?.discount_name || detailPromo?.nama_promo}</Text>
              <Text style={{ fontSize: 13, color: '#64748b' }}>{detailPromo?.shop_name}</Text>
            </View>
            {(detailPromo?.status_api === 'ongoing' || detailPromo?.status_api === 'upcoming') && (
              <TouchableOpacity onPress={handleSavePromoPrice} disabled={savingPrice} style={{ backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                {savingPrice ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Simpan</Text>}
              </TouchableOpacity>
            )}
          </View>
          {loadingShopeeDetail ? (
            <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={shopeeDetailItems}
              keyExtractor={(_, idx) => idx.toString()}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>
                    {item.item_name || item.nama || `Item #${item.item_id}`} {item.model_name ? `- ${item.model_name}` : ''}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                    {item.item_sku || item.model_sku || item.sku || ''}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: '#475569' }}>Harga Normal</Text>
                    <Text style={{ textDecorationLine: 'line-through', color: '#94a3b8' }}>Rp {Number(item.harga_asli || item.original_price || item.harga_normal || 0).toLocaleString('id-ID')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Harga Promo</Text>
                    {detailPromo?.status_api === 'ongoing' || detailPromo?.status_api === 'upcoming' ? (
                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: '#ef4444', fontWeight: 'bold', marginRight: 4 }}>Rp</Text>
                          <TextInput 
                             style={{ borderWidth: 1, borderColor: '#ef4444', color: '#ef4444', fontWeight: 'bold', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, textAlign: 'right', minWidth: 80 }}
                             keyboardType="numeric"
                             value={editPriceMap[`${item.item_id}:${item.model_id || ''}`]}
                             onChangeText={(val) => setEditPriceMap(prev => ({...prev, [`${item.item_id}:${item.model_id || ''}`]: val}))}
                          />
                       </View>
                    ) : (
                       <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Rp {Number(item.harga_promo).toLocaleString('id-ID')}</Text>
                    )}
                  </View>
                  
                  <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>HPP</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600' }}>Rp {Number(item.hpp).toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Base (HJ2)</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600' }}>Rp {Number(item.harga_jual_2 ?? item.harga_base ?? item.hargajual2 ?? 0).toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Margin Promo</Text>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: item.harga_promo - item.hpp > 0 ? '#16a34a' : '#ef4444' }}>
                        Rp {Number(item.harga_promo - item.hpp).toLocaleString('id-ID')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 30, padding: 20 }}>
                  <Ionicons name="time-outline" size={48} color="#94a3b8" />
                  <Text style={{ textAlign: 'center', marginTop: 12, color: '#64748b', fontSize: 16 }}>
                    Detail produk belum tersedia.
                  </Text>
                  <Text style={{ textAlign: 'center', marginTop: 8, color: '#94a3b8', fontSize: 13 }}>
                    Untuk promo yang baru dibuat, Shopee membutuhkan waktu sekitar 1-3 menit untuk memproses dan menampilkan detail barang. Silakan tutup dan coba buka lagi beberapa saat lagi.
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Modal Detail Etalase Info */}
      <Modal visible={etalaseModalVisible} transparent={true} animationType="fade" onRequestClose={() => setEtalaseModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, width: '100%', maxHeight: '80%', padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1 }}>Detail Etalase Harga Coret</Text>
              <TouchableOpacity onPress={() => setEtalaseModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, color: '#334155', marginBottom: 12, fontWeight: '500' }}>{etalaseModalProductName}</Text>
            <FlatList
              data={etalaseModalItems}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <View style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', color: '#1e293b', fontSize: 14 }}>{item.discount_name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>ID: {item.discount_id}</Text>
                    </View>
                    <View style={{ backgroundColor: item.status_api === 'ongoing' ? '#dcfce7' : '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                      <Text style={{ color: item.status_api === 'ongoing' ? '#166534' : '#0369a1', fontSize: 10, fontWeight: 'bold' }}>
                        {item.status_api?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: '#fff3e0', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 8 }}>
                    <Text style={{ color: '#e65100', fontSize: 11, fontWeight: 'bold' }}>{item.variant_name || item.shop_name}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#475569' }}>Harga Normal</Text>
                    <Text style={{ fontSize: 12, textDecorationLine: 'line-through', color: '#9ca3af' }}>Rp {Number(item.harga_asli || 0).toLocaleString('id-ID')}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e293b' }}>Harga Promo</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#ef4444', marginRight: 6 }}>Rp {Number(item.harga_promo || 0).toLocaleString('id-ID')}</Text>
                      {item.diskon_pct ? (
                        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>-{item.diskon_pct}%</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>HPP: Rp {Number(item.hpp || 0).toLocaleString('id-ID')}</Text>
                    {item.margin_pct !== null && item.margin_pct !== undefined ? (
                      <View style={{ backgroundColor: Number(item.margin_pct) < 0 ? '#fee2e2' : '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: Number(item.margin_pct) < 0 ? '#ef4444' : '#16a34a' }}>
                          Margin: {item.margin_pct}%
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal Add Promo */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <DiskonAddModal 
          initialItems={preselectedItems}
          initialShop={initialShopForModal}
          onClose={() => setAddModalVisible(false)} 
          onSuccess={() => {
            setAddModalVisible(false);
            fetchLivePromos();
            fetchAnalisis();
          }} 
        />
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f59e0b' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f59e0b' },
  menuBtn: { marginRight: 16 },
  screenHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  tabContent: { flex: 1, padding: 12 },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shopTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  shopTabActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  shopTabText: {
    color: '#4b5563',
    fontWeight: '500',
    fontSize: 13,
  },
  shopTabTextActive: {
    color: '#1d4ed8',
    fontWeight: 'bold',
  },
  cardSelected: {
    borderColor: '#f59e0b',
    borderWidth: 2,
    backgroundColor: '#fffbeb',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', flex: 1 },
  cardShop: { fontSize: 14, color: '#f59e0b', fontWeight: '600', marginBottom: 4 },
  cardDetail: { fontSize: 13, color: '#4b5563', marginBottom: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#f3f4f6' },
  statusUpcoming: { backgroundColor: '#fef9c3' },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#374151' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 16 },
  actionText: { marginLeft: 4, fontSize: 14, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#9ca3af' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  etalaseContainer: { marginTop: 8, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6 },
  etalaseTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  etalaseText: { fontSize: 12, color: '#334155', marginBottom: 2 },
  // Analisis

  etalaseBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 6 },
  etalaseBadgeActive: { backgroundColor: '#dcfce7' },
  etalaseBadgeNone: { backgroundColor: '#f3f4f6' },
  etalaseBadgeText: { fontSize: 10, fontWeight: 'bold' },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  analisisSearchInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, fontSize: 13, backgroundColor: '#f9fafb', marginRight: 8 },
  refreshBtn: { padding: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', gap: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  filterLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginRight: 4 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipActive: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  filterChipText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  filterChipTextActive: { color: '#d97706' },
  selectAllBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  selectAllQuickBtn: { backgroundColor: '#fff3cd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#f59e0b' },
  selectAllQuickText: { fontSize: 11, color: '#d97706', fontWeight: 'bold' },
  selectionActionBar: { position: 'absolute', bottom: 24, left: 12, right: 12, backgroundColor: '#1e3a8a', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  selectionCount: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  selectionClearBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  selectionClearText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  selectionPromoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  selectionPromoText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
