import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { TabView, TabBar } from 'react-native-tab-view';

import {
  FlashSaleService,
  IFlashSaleShop,
  ISellerEligibilityResponse,
  IFlashSaleSession,
} from '../../../services/ecommerce/flashSaleService';
import EligibilityBanner from './components/EligibilityBanner';
import AutoFlashSaleTab from './tabs/AutoFlashSaleTab';
import LiveFlashSaleTab from './tabs/LiveFlashSaleTab';
import FlashSaleDetailModal from './components/FlashSaleDetailModal';

export default function FlashSaleScreen() {
  const navigation = useNavigation<any>();
  const layout = useWindowDimensions();

  // Shops State
  const [shops, setShops] = useState<IFlashSaleShop[]>([]);
  const [selectedShop, setSelectedShop] = useState<IFlashSaleShop | null>(null);
  const [loadingShops, setLoadingShops] = useState(true);
  const [showShopPicker, setShowShopPicker] = useState(false);

  // Eligibility & Performance State
  const [eligibility, setEligibility] = useState<ISellerEligibilityResponse | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Trigger Sync state
  const [triggeringSync, setTriggeringSync] = useState(false);

  // Detail Modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeSession, setActiveSession] = useState<IFlashSaleSession | null>(null);

  // Tab View state
  const [tabIndex, setTabIndex] = useState(0);
  const [routes] = useState([
    { key: 'auto', title: 'Otomatis' },
    { key: 'all', title: 'Semua' },
    { key: 'active', title: 'Berjalan' },
    { key: 'draft', title: 'Akan Datang' },
    { key: 'ended', title: 'Berakhir' },
  ]);

  // Load shops on mount
  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoadingShops(true);
    try {
      const shopeeShops = await FlashSaleService.getShopeeShops();
      setShops(shopeeShops);
      if (shopeeShops.length > 0) {
        setSelectedShop(shopeeShops[0]);
        checkEligibility(shopeeShops[0].id);
      }
    } catch (err) {
      console.error('[FlashSaleScreen] Error fetching shops:', err);
    } finally {
      setLoadingShops(false);
    }
  };

  const checkEligibility = async (shopId: number) => {
    setCheckingEligibility(true);
    try {
      const res = await FlashSaleService.checkEligibility(shopId);
      setEligibility(res);
    } catch (err) {
      console.error('[FlashSaleScreen] Error checking eligibility:', err);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleSelectShop = (shop: IFlashSaleShop) => {
    setSelectedShop(shop);
    setShowShopPicker(false);
    checkEligibility(shop.id);
  };

  const handleTriggerSync = async () => {
    if (!selectedShop) return;

    Alert.alert(
      'Jalankan Auto-Sync',
      `Jalankan sinkronisasi Flash Sale Shopee untuk toko "${selectedShop.name}" sekarang?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Jalankan',
          onPress: async () => {
            setTriggeringSync(true);
            try {
              const res = await FlashSaleService.triggerAutoSync(selectedShop.id);
              if (res.status) {
                Alert.alert('Sukses', res.message || 'Proses auto sync berhasil dimulai di background!');
              } else {
                Alert.alert('Gagal Sync', res.reason || 'Gagal memicu auto sync.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Gagal menghubungi server.');
            } finally {
              setTriggeringSync(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenCreateScreen = () => {
    if (!selectedShop) {
      Alert.alert('Perhatian', 'Pilih toko Shopee terlebih dahulu.');
      return;
    }

    if (eligibility && !eligibility.is_eligible) {
      Alert.alert(
        'Peringatan Kriteria Shopee',
        'Toko Anda saat ini belum memenuhi kriteria kelayakan Shopee Flash Sale. Shopee mungkin akan menolak pendaftaran sesi baru. Tetap ingin melanjutkan?',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Lanjutkan',
            onPress: () => {
              navigation.navigate('CreateFlashSale', {
                id_ecommerce: selectedShop.id,
                shop_name: selectedShop.name,
              });
            },
          },
        ]
      );
      return;
    }

    navigation.navigate('CreateFlashSale', {
      id_ecommerce: selectedShop.id,
      shop_name: selectedShop.name,
    });
  };

  const handleOpenDetailModal = (session: IFlashSaleSession) => {
    setActiveSession(session);
    setDetailModalVisible(true);
  };

  const renderScene = ({ route }: { route: { key: string } }) => {
    if (!selectedShop) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.centerText}>Pilih toko terlebih dahulu</Text>
        </View>
      );
    }

    switch (route.key) {
      case 'auto':
        return <AutoFlashSaleTab idEcommerce={selectedShop.id} />;
      case 'all':
        return (
          <LiveFlashSaleTab
            idEcommerce={selectedShop.id}
            type="all"
            onOpenDetail={handleOpenDetailModal}
          />
        );
      case 'active':
        return (
          <LiveFlashSaleTab
            idEcommerce={selectedShop.id}
            type="active"
            onOpenDetail={handleOpenDetailModal}
          />
        );
      case 'draft':
        return (
          <LiveFlashSaleTab
            idEcommerce={selectedShop.id}
            type="draft"
            onOpenDetail={handleOpenDetailModal}
          />
        );
      case 'ended':
        return (
          <LiveFlashSaleTab
            idEcommerce={selectedShop.id}
            type="ended"
            onOpenDetail={handleOpenDetailModal}
          />
        );
      default:
        return null;
    }
  };

  // Performance stats (from eligibility response or mock fallback)
  const perf = eligibility?.performance_summary || {
    sales: 0,
    orders: 0,
    buyers: 0,
    click_rate: 0,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.topBarTitle}>Flash Sale Shopee</Text>
          <Text style={styles.topBarSubtitle}>Manajemen & Otomatisasi Sesi</Text>
        </View>

        {/* Sync Trigger Button */}
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={handleTriggerSync}
          disabled={triggeringSync || !selectedShop}
        >
          {triggeringSync ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="sync" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Shop Selector Dropdown Card */}
      <View style={styles.shopSelectorBar}>
        <TouchableOpacity
          style={styles.shopSelectorBtn}
          onPress={() => setShowShopPicker(true)}
          disabled={loadingShops || shops.length === 0}
        >
          <View style={styles.shopeeLogoBadge}>
            <Text style={styles.shopeeLogoText}>S</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.shopSelectorLabel}>Toko Shopee Aktif</Text>
            <Text style={styles.shopSelectorName}>
              {loadingShops
                ? 'Memuat toko...'
                : selectedShop
                ? selectedShop.name
                : 'Tidak ada toko Shopee terhubung'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Eligibility Banner */}
      <EligibilityBanner eligibility={eligibility} loading={checkingEligibility} />

      {/* Performance Summary Card (7 Days) */}
      <View style={styles.perfCard}>
        <View style={styles.perfHeader}>
          <Ionicons name="bar-chart-outline" size={15} color="#EE4D2D" />
          <Text style={styles.perfTitle}>Ringkasan Performa (7 Hari Terakhir)</Text>
        </View>
        <View style={styles.perfGrid}>
          <View style={styles.perfCol}>
            <Text style={styles.perfVal}>
              Rp {(perf.sales || 0).toLocaleString('id-ID')}
            </Text>
            <Text style={styles.perfLabel}>Penjualan</Text>
          </View>
          <View style={styles.perfDivider} />
          <View style={styles.perfCol}>
            <Text style={styles.perfVal}>{perf.orders || 0}</Text>
            <Text style={styles.perfLabel}>Pesanan</Text>
          </View>
          <View style={styles.perfDivider} />
          <View style={styles.perfCol}>
            <Text style={styles.perfVal}>{perf.buyers || 0}</Text>
            <Text style={styles.perfLabel}>Pembeli</Text>
          </View>
          <View style={styles.perfDivider} />
          <View style={styles.perfCol}>
            <Text style={styles.perfVal}>{perf.click_rate || 0}%</Text>
            <Text style={styles.perfLabel}>Klik</Text>
          </View>
        </View>
      </View>

      {/* Tab View */}
      <View style={{ flex: 1 }}>
        <TabView
          navigationState={{ index: tabIndex, routes }}
          renderScene={renderScene}
          onIndexChange={setTabIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={(props: any) => (
            <TabBar
              {...props}
              scrollEnabled
              indicatorStyle={styles.tabIndicator}
              style={styles.tabBar}
              labelStyle={styles.tabLabel}
              activeColor="#EE4D2D"
              inactiveColor="#6B7280"
              tabStyle={styles.tabItem}
            />
          )}
        />
      </View>

      {/* Floating Action Button (+ Buat Flash Sale) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={handleOpenCreateScreen}
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>Buat Flash Sale</Text>
      </TouchableOpacity>

      {/* Shop Picker Modal */}
      <Modal
        visible={showShopPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShopPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shopModalBox}>
            <View style={styles.shopModalHeader}>
              <Text style={styles.shopModalTitle}>Pilih Toko Shopee</Text>
              <TouchableOpacity onPress={() => setShowShopPicker(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={shops}
              keyExtractor={(s) => String(s.id)}
              renderItem={({ item }) => {
                const isSelected = selectedShop?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.shopItemRow, isSelected && styles.shopItemRowSelected]}
                    onPress={() => handleSelectShop(item)}
                  >
                    <View style={styles.shopeeSmallLogo}>
                      <Text style={styles.shopeeSmallText}>S</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.shopItemName,
                          isSelected && styles.shopItemNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.shopItemSub}>Shopee ID: #{item.shop_id || item.id}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#EE4D2D" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Detail / Edit Modal */}
      <FlashSaleDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        session={activeSession}
        idEcommerce={selectedShop?.id || 0}
        onSessionUpdated={() => {
          // Re-fetch or trigger refresh if needed
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EE4D2D',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 10,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topBarSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  syncBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  shopSelectorBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  shopSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shopeeLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EE4D2D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopeeLogoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  shopSelectorLabel: {
    fontSize: 10,
    color: '#9A3412',
    fontWeight: '500',
  },
  shopSelectorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  perfCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  perfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  perfTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  perfGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perfCol: {
    flex: 1,
    alignItems: 'center',
  },
  perfVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  perfLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  perfDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabIndicator: {
    backgroundColor: '#EE4D2D',
    height: 3,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabItem: {
    width: 'auto',
    paddingHorizontal: 14,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EE4D2D',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 25,
    shadowColor: '#EE4D2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    gap: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shopModalBox: {
    width: '100%',
    maxHeight: '60%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  shopModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  shopModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  shopItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  shopItemRowSelected: {
    backgroundColor: '#FFF7F5',
  },
  shopeeSmallLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EE4D2D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopeeSmallText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  shopItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  shopItemNameSelected: {
    color: '#EE4D2D',
  },
  shopItemSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
});
