import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, ActivityIndicator, FlatList, RefreshControl, Alert, Modal, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import moment from 'moment';
import DiskonAddModal from './DiskonAddModal';
import { useFocusEffect } from '@react-navigation/native';

export default function DiskonScreen({ navigation }: any) {
  const layout = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'lokal', title: 'Promo Lokal' },
    { key: 'aktif', title: 'Shopee Aktif' },
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

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [preselectedItem, setPreselectedItem] = useState<any>(null);

  const openAddModalWithItem = (item: any) => {
    setPreselectedItem(item);
    setAddModalVisible(true);
  };

  const openAddModal = () => {
    setPreselectedItem(null);
    setAddModalVisible(true);
  };

  // Fetching Data
  const fetchPromos = async () => {
    setLoadingLokal(true);
    try {
      const res = await ApiService.get('/get/promo_marketplace');
      if (res.success) setPromos(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLokal(false);
    }
  };

  const fetchLivePromos = async () => {
    setLoadingAktif(true);
    try {
      const res = await ApiService.get('/get/live_promo_shopee?status=ongoing,upcoming');
      if (res.success) setLivePromos(res.data);
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
      if (res.success) setHistoryPromos(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  const fetchAnalisis = async () => {
    setLoadingAnalisis(true);
    try {
      const res = await ApiService.get('/get/analisis_produk_masterbarang');
      if (res.success) setAnalisisItems(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalisis(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPromos();
      // Load others when tab changes or initially if needed
    }, [])
  );

  useEffect(() => {
    if (index === 0 && promos.length === 0) fetchPromos();
    if (index === 1 && livePromos.length === 0) fetchLivePromos();
    if (index === 2 && historyPromos.length === 0) fetchHistoryPromos();
    if (index === 3 && analisisItems.length === 0) fetchAnalisis();
  }, [index]);

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

  // Rendering Tabs
  const renderLokal = () => (
    <View style={styles.tabContent}>
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
              <Text style={styles.cardDetail}>Auto Renew: {item.is_renewed ? 'Ya' : 'Tidak'}</Text>
              
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
      {loadingAktif ? <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} /> : (
        <FlatList
          data={livePromos}
          keyExtractor={(item: any) => item.discount_id.toString() + item.id_ecommerce}
          refreshControl={<RefreshControl refreshing={loadingAktif} onRefresh={fetchLivePromos} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.discount_name}</Text>
              <Text style={styles.cardShop}>{item.shop_name}</Text>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
                <Text style={styles.cardDetail}>{moment(item.start_time * 1000).format('DD MMM YYYY')}</Text>
                <Text style={styles.cardDetail}>sd {moment(item.end_time * 1000).format('DD MMM YYYY')}</Text>
              </View>
              <View style={[styles.statusBadge, { alignSelf: 'flex-start', marginTop: 8 }, item.status_api === 'ongoing' ? styles.statusActive : styles.statusUpcoming]}>
                  <Text style={styles.statusText}>{item.status_api.toUpperCase()}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada promo Shopee aktif.</Text>}
        />
      )}
    </View>
  );

  const renderRiwayat = () => (
    <View style={styles.tabContent}>
      {loadingRiwayat ? <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} /> : (
        <FlatList
          data={historyPromos}
          keyExtractor={(item: any) => item.discount_id.toString() + item.id_ecommerce}
          refreshControl={<RefreshControl refreshing={loadingRiwayat} onRefresh={fetchHistoryPromos} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { opacity: 0.7 }]}>
              <Text style={styles.cardTitle}>{item.discount_name}</Text>
              <Text style={styles.cardShop}>{item.shop_name}</Text>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
                <Text style={styles.cardDetail}>{moment(item.start_time * 1000).format('DD MMM YYYY')}</Text>
                <Text style={styles.cardDetail}>sd {moment(item.end_time * 1000).format('DD MMM YYYY')}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada riwayat promo.</Text>}
        />
      )}
    </View>
  );

  const renderAnalisis = () => (
    <View style={styles.tabContent}>
      {loadingAnalisis ? <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} /> : (
        <FlatList
          data={analisisItems}
          keyExtractor={(item: any) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loadingAnalisis} onRefresh={fetchAnalisis} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openAddModalWithItem(item)}>
              <Text style={styles.cardTitle}>{item.nama}</Text>
              <Text style={styles.cardDetail}>SKU: {item.sku} | Merk: {item.merk}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.cardDetail}>HPP: Rp {Number(item.hpp).toLocaleString('id-ID')}</Text>
                <Text style={styles.cardDetail}>Harga Jual: Rp {Number(item.harga_jual_2).toLocaleString('id-ID')}</Text>
              </View>
              <Text style={[styles.cardDetail, {marginTop: 4, fontWeight: 'bold'}]}>
                Shopee Bound: {item.jumlah_shopee_bound}
              </Text>
              {item.etalase_harga_coret && item.etalase_harga_coret.length > 0 && (
                <View style={styles.etalaseContainer}>
                  <Text style={styles.etalaseTitle}>Harga di Shopee:</Text>
                  {item.etalase_harga_coret.map((et: any, idx: number) => (
                    <Text key={idx} style={styles.etalaseText}>
                      - {et.shop_name}: Rp {Number(et.harga_promo).toLocaleString('id-ID')} ({et.diskon_pct}%)
                    </Text>
                  ))}
                </View>
              )}
              <View style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                <Text style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 13 }}>+ Buat Promo</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada data analisis.</Text>}
        />
      )}
    </View>
  );

  const renderScene = SceneMap({
    lokal: renderLokal,
    aktif: renderAktif,
    riwayat: renderRiwayat,
    analisis: renderAnalisis,
  });

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

      {/* FAB Tambah Promo */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={openAddModal}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Modal Add Promo */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <DiskonAddModal 
          initialItem={preselectedItem}
          onClose={() => setAddModalVisible(false)} 
          onSuccess={() => {
            setAddModalVisible(false);
            fetchPromos();
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
});
