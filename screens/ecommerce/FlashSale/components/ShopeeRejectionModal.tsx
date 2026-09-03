import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IShopeeRejection, translateShopeeError } from '../../../../services/ecommerce/flashSaleService';

interface ShopeeRejectionModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  generalReason?: string;
  failures: IShopeeRejection[];
}

export default function ShopeeRejectionModal({
  visible,
  onClose,
  title = 'Penolakan dari Shopee',
  generalReason,
  failures,
}: ShopeeRejectionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning" size={24} color="#EF4444" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                Beberapa produk tidak dapat didaftarkan ke Flash Sale
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* General Message if present */}
          {generalReason ? (
            <View style={styles.generalAlert}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.generalAlertText}>{generalReason}</Text>
            </View>
          ) : null}

          {/* Failures List */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {failures.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada detail penolakan item tambahan.</Text>
            ) : (
              failures.map((item, idx) => {
                const friendlyMsg = translateShopeeError(item.err_msg);
                return (
                  <View key={`${item.item_id}-${idx}`} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Ionicons name="close-circle" size={18} color="#EF4444" style={styles.itemIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>
                          {item.item_name || `Item ID: ${item.item_id}`}
                        </Text>
                        {item.item_sku ? (
                          <Text style={styles.itemSku}>SKU: {item.item_sku}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{friendlyMsg}</Text>
                      {item.err_msg && item.err_msg !== friendlyMsg && (
                        <Text style={styles.rawErrorText}>Shopee: "{item.err_msg}"</Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
              <Text style={styles.actionBtnText}>Saya Mengerti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  generalAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  generalAlertText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500',
  },
  scrollView: {
    flexGrow: 0,
    maxHeight: 380,
  },
  scrollContent: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    marginVertical: 16,
  },
  itemCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemSku: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
    lineHeight: 16,
  },
  rawErrorText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  actionBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
