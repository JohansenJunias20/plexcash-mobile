import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';

interface Shop {
  id: number;
  platform: string;
  name: string;
  shop_id: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  unintegratedShops: Shop[];
}

export default function ModalChatNotIntegrated({ open, onClose, unintegratedShops }: Props) {
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

  const isChatIntegrationAvailable = (platform: string) => {
    return platform === 'SHOPEE' || platform === 'LAZADA';
  };

  const handleIntegrateChat = async (platform: string) => {
    try {
      if (platform === 'LAZADA') {
        Linking.openURL('https://auth.lazada.com/oauth/authorize?response_type=code&client_id=129019');
      } else if (platform === 'SHOPEE') {
        const response = await ApiService.get('/get/SHOPEE/chat_auth_url');
        if (response.status && response.data) {
          Linking.openURL(response.data);
        } else {
          Alert.alert('Error', response.reason || 'Gagal mendapatkan URL auth');
        }
      } else {
        Alert.alert('Info', `Integrasi chat ${platform} akan segera hadir!`);
      }
    } catch (error) {
      console.error('Error integrating chat:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memproses integrasi chat');
    }
  };

  const renderItem = ({ item }: { item: Shop }) => {
    const color = getPlatformColor(item.platform);
    const available = isChatIntegrationAvailable(item.platform);

    return (
      <View style={styles.shopCard}>
        <View style={styles.shopInfo}>
          <Ionicons name="chatbubbles" size={28} color={color} style={styles.icon} />
          <View style={{ flex: 1 }}>
            <View style={styles.shopNameRow}>
              <Text style={styles.shopName} numberOfLines={1}>
                {item.name || item.shop_id}
              </Text>
              <View style={[styles.platformBadge, { backgroundColor: color }]}>
                <Text style={styles.platformBadgeText}>{item.platform}</Text>
              </View>
            </View>
            <Text style={styles.shopId}>Shop ID: {item.shop_id}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.integrateButton, !available && styles.disabledButton, available && { backgroundColor: color }]}
          onPress={() => handleIntegrateChat(item.platform)}
        >
          <Ionicons name="link" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.integrateButtonText}>
            {available ? 'Integrasikan' : 'Segera Hadir'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={open} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="warning" size={32} color="#fff" />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Chat Belum Terintegrasi</Text>
                <Text style={styles.headerSubtitle}>
                  {unintegratedShops.length} toko memerlukan integrasi chat
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={unintegratedShops}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#6366f1', // indigo-500
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  shopCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 12,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flexShrink: 1,
  },
  platformBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  platformBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  shopId: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  integrateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  integrateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'flex-end',
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
});
