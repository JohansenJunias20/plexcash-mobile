import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../../services/api';

import ModalMarketplace from './components/ModalMarketplace';
import ModalTokopediaApiKey from './components/ModalTokopediaApiKey';
import ModalChatNotIntegrated from './components/ModalChatNotIntegrated';
import ModalImportWizard from './components/ModalImportWizard';

interface Shop {
  id: number;
  id_owner: number;
  platform: string;
  name: string;
  shop_id: string;
  auth_url?: string;
  auth_token?: string;
  auth_expire?: string;
  status: string;
  chat_app_id?: string;
  ads_app_id?: string;
}

export default function IntegrationScreen() {
  const navigation = useNavigation();

  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [modalMarketplaceOpen, setModalMarketplaceOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');

  const [modalTokoKeyOpen, setModalTokoKeyOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<number>(0);

  const [modalChatOpen, setModalChatOpen] = useState(false);
  const [unintegratedShops, setUnintegratedShops] = useState<Shop[]>([]);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardIdEcommerce, setWizardIdEcommerce] = useState(0);
  const [wizardShopIdStr, setWizardShopIdStr] = useState('');
  const [wizardPlatform, setWizardPlatform] = useState('');
  const [wizardShopName, setWizardShopName] = useState('');

  const [editNameModalOpen, setEditNameModalOpen] = useState(false);
  const [editShopTarget, setEditShopTarget] = useState<Shop | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const fetchShops = async () => {
    try {
      setLoading(true);
      const res = await ApiService.get('/get/ecommerce');
      if (res.status && res.data) {
        setShops(res.data);
        const unintegrated = res.data.filter((s: Shop) => s.status === 'APPROVED' && !s.chat_app_id);
        if (unintegrated.length > 0) {
          setUnintegratedShops(unintegrated);
          setModalChatOpen(true);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memuat data integrasi');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchShops();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleAddPlatform = async (platform: string) => {
    if (platform === 'SHOPEE') {
      const res = await ApiService.get('/get/shopee/auth_url');
      if (res.status && res.data) {
        Linking.openURL(res.data);
      }
    } else if (platform === 'TIKTOK') {
      Linking.openURL('https://services.tiktokshop.com/open/authorize?service_id=7345804330824320774');
    } else if (platform === 'LAZADA') {
      Linking.openURL('https://auth.lazada.com/oauth/authorize?response_type=code&client_id=129019');
    } else {
      // Tokopedia or Blibli
      setSelectedPlatform(platform);
      setModalMarketplaceOpen(true);
    }
  };

  const handleEditName = (shop: Shop) => {
    setEditShopTarget(shop);
    setEditNameValue(shop.name || '');
    setEditNameModalOpen(true);
  };

  const saveEditName = async () => {
    if (!editShopTarget || !editNameValue.trim()) return;
    try {
      const text = editNameValue.trim();
      const res = await ApiService.patch('/ecommerce', { id: editShopTarget.id, name: text });
      if (res.status) {
        setShops((prev) => prev.map((s) => (s.id === editShopTarget.id ? { ...s, name: text } : s)));
        setEditNameModalOpen(false);
      } else {
        Alert.alert('Error', res.reason || 'Gagal menyimpan');
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan jaringan');
    }
  };

  const handleRemove = (shop: Shop) => {
    Alert.alert(
      'Peringatan',
      `Anda yakin ingin menghapus ${shop.name || shop.shop_id}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await ApiService.get(`/marketplace/remove?id=${shop.id}`);
              if (res.status) {
                setShops((prev) => prev.filter((s) => s.id !== shop.id));
              } else {
                Alert.alert('Error', res.reason || 'Gagal menghapus toko');
              }
            } catch (e) {
              Alert.alert('Error', 'Terjadi kesalahan jaringan');
            }
          },
        },
      ]
    );
  };

  const handleIntegrateChat = async (shop: Shop) => {
    if (shop.platform === 'LAZADA') {
      Linking.openURL('https://auth.lazada.com/oauth/authorize?response_type=code&client_id=129019');
    } else if (shop.platform === 'SHOPEE') {
      const res = await ApiService.get('/get/SHOPEE/chat_auth_url');
      if (res.status && res.data) {
        Linking.openURL(res.data);
      }
    } else {
      Alert.alert('Info', `Integrasi chat Tokopedia akan segera hadir!`);
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'SHOPEE': return '#EE4D2D';
      case 'TOKOPEDIA': return '#42B549';
      case 'LAZADA': return '#0F146D';
      case 'TIKTOK': return '#000000';
      case 'BLIBLI': return '#0095DA';
      default: return '#666';
    }
  };

  const renderPlatformButtons = () => {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.platformRow}>
        {['SHOPEE', 'LAZADA', 'TIKTOK', 'BLIBLI', 'TOKOPEDIA'].map((plat) => (
          <TouchableOpacity
            key={plat}
            style={[styles.platformBtn, { borderColor: getPlatformColor(plat) }]}
            onPress={() => handleAddPlatform(plat)}
          >
            <Ionicons name="add" size={16} color={getPlatformColor(plat)} />
            <Text style={[styles.platformBtnText, { color: getPlatformColor(plat) }]}>{plat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderShopCard = (shop: Shop) => {
    const isApproved = shop.status === 'APPROVED';
    const color = getPlatformColor(shop.platform);

    return (
      <View key={shop.id} style={styles.shopCard}>
        <View style={styles.shopCardHeader}>
          <View style={styles.shopInfo}>
            <Text style={styles.shopName}>{shop.name || shop.shop_id}</Text>
            <View style={[styles.platformBadge, { backgroundColor: color }]}>
              <Text style={styles.platformBadgeText}>{shop.platform}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, isApproved ? styles.statusApproved : styles.statusPending]}>
            <Text style={[styles.statusText, isApproved ? styles.statusTextApproved : styles.statusTextPending]}>
              {shop.status}
            </Text>
          </View>
        </View>

        <Text style={styles.shopIdText}>ID: {shop.shop_id}</Text>

        <View style={styles.actionsRow}>
          {isApproved ? (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditName(shop)}>
                <Ionicons name="pencil" size={18} color="#4b5563" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setWizardIdEcommerce(shop.id);
                  setWizardShopIdStr(shop.shop_id);
                  setWizardPlatform(shop.platform);
                  setWizardShopName(shop.name || shop.shop_id);
                  setWizardOpen(true);
                }}
              >
                <Ionicons name="cloud-download" size={18} color="#059669" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemove(shop)}>
                <Ionicons name="trash" size={18} color="#ef4444" />
              </TouchableOpacity>

              {shop.platform === 'TOKOPEDIA' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setSelectedShopId(shop.id);
                    setModalTokoKeyOpen(true);
                  }}
                >
                  <Ionicons name="key" size={18} color="#f59e0b" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, !shop.chat_app_id && styles.actionWarningBtn]}
                onPress={() => handleIntegrateChat(shop)}
              >
                <Ionicons name="chatbubbles" size={18} color={!shop.chat_app_id ? '#b45309' : '#3b82f6'} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditName(shop)}>
                <Ionicons name="pencil" size={18} color="#4b5563" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemove(shop)}>
                <Ionicons name="trash" size={18} color="#ef4444" />
              </TouchableOpacity>

              {shop.platform === 'TOKOPEDIA' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={async () => {
                    try {
                      const res = await ApiService.get(`/tokopedia-shop/acc?id=${shop.id}`);
                      if (res.status) {
                        Alert.alert('Sukses', 'Berhasil konfirmasi');
                        fetchShops();
                      } else {
                        Alert.alert('Error', res.reason || 'Gagal');
                      }
                    } catch (e) {}
                  }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Integration</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Tambah Toko Baru</Text>
        {renderPlatformButtons()}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Toko Terhubung</Text>
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 40 }} />
        ) : shops.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={60} color="#9ca3af" />
            <Text style={styles.emptyText}>Belum ada toko yang terhubung</Text>
          </View>
        ) : (
          shops.map(renderShopCard)
        )}
      </ScrollView>

      {/* Modals */}
      <ModalMarketplace
        open={modalMarketplaceOpen}
        onClose={() => setModalMarketplaceOpen(false)}
        platform={selectedPlatform}
        shop_id="New Shop"
        onSuccess={(idEcommerce) => {
          setModalMarketplaceOpen(false);
          fetchShops();
          if (idEcommerce) {
            setWizardIdEcommerce(idEcommerce);
            setWizardShopIdStr("New Shop");
            setWizardPlatform(selectedPlatform);
            setWizardShopName("New Shop");
            setWizardOpen(true);
          }
        }}
      />

      <ModalTokopediaApiKey
        open={modalTokoKeyOpen}
        onClose={() => setModalTokoKeyOpen(false)}
        id_ecommerce={selectedShopId}
        onConfirm={async (appId, apiKey, apiSecret) => {
          try {
            const res = await ApiService.post('/tokopedia/apikey', {
              id_ecommerce: selectedShopId,
              app_id: appId,
              api_key: apiKey,
              api_secret: apiSecret,
            });
            if (res.status) {
              Alert.alert('Sukses', 'API Key disimpan');
              setModalTokoKeyOpen(false);
            } else {
              Alert.alert('Error', res.reason || 'Gagal menyimpan');
            }
          } catch (e) {}
        }}
      />

      <ModalChatNotIntegrated
        open={modalChatOpen}
        onClose={() => setModalChatOpen(false)}
        unintegratedShops={unintegratedShops}
      />

      <ModalImportWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        shopId={wizardShopIdStr}
        platform={wizardPlatform}
        idEcommerce={wizardIdEcommerce}
        shopName={wizardShopName}
      />

      {/* Edit Name Modal */}
      <Modal visible={editNameModalOpen} animationType="fade" transparent={true} onRequestClose={() => setEditNameModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.modalTitle}>Ubah Nama Toko</Text>
            <Text style={styles.modalSubtitle}>Masukkan nama baru untuk toko ini.</Text>
            <TextInput
              style={styles.modalInput}
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Nama Toko"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditNameModalOpen(false)}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEditName}>
                <Text style={styles.modalSaveText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
  },
  platformBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  platformBtnText: {
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 12,
  },
  shopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  shopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shopInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  shopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginRight: 8,
  },
  platformBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  platformBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusApproved: {
    backgroundColor: '#d1fae5',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusTextApproved: {
    color: '#047857',
  },
  statusTextPending: {
    color: '#b45309',
  },
  shopIdText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  actionWarningBtn: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    marginTop: 12,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentSmall: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 15,
  },
  modalSaveBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
