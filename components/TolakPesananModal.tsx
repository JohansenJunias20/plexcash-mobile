import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SELLER_CANCEL_REASONS,
  SUPPORTED_CANCEL_PLATFORMS,
} from '../services/ecommerce/orderService';

interface Props {
  visible: boolean;
  orders: any[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (reasonsByPlatform: Record<string, string>) => void;
}

const PLATFORM_THEMES: Record<string, { bg: string; color: string; border: string }> = {
  SHOPEE: { bg: '#FFF7ED', color: '#EA580C', border: '#FDBA74' },
  TIKTOK: { bg: '#F4F4F5', color: '#18181B', border: '#E4E4E7' },
  TOKOPEDIA: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  LAZADA: { bg: '#F5F3FF', color: '#7C3AED', border: '#C4B5FD' },
  BLIBLI: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
};

export default function TolakPesananModal({
  visible,
  orders,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [reasonsByPlatform, setReasonsByPlatform] = useState<Record<string, string>>({});

  // Group selected orders by platform
  const platformGroups: Record<string, any[]> = {};
  orders.forEach((o) => {
    const platform = (o.platform || o.from || 'UNKNOWN').toUpperCase();
    if (!platformGroups[platform]) platformGroups[platform] = [];
    platformGroups[platform].push(o);
  });

  const platformsInSelection = Object.keys(platformGroups);
  const supportedPlatforms = platformsInSelection.filter((p) =>
    SUPPORTED_CANCEL_PLATFORMS.includes(p)
  );

  // Initialize reasons when modal opens
  useEffect(() => {
    if (visible) {
      const initialReasons: Record<string, string> = {};
      supportedPlatforms.forEach((p) => {
        initialReasons[p] = 'OUT_OF_STOCK';
      });
      setReasonsByPlatform(initialReasons);
    }
  }, [visible, orders.length]);

  const handleSelectReason = (platform: string, reasonValue: string) => {
    setReasonsByPlatform((prev) => ({
      ...prev,
      [platform]: reasonValue,
    }));
  };

  const hasAnySupported = supportedPlatforms.length > 0;
  const canConfirm =
    hasAnySupported &&
    !loading &&
    supportedPlatforms.every((p) => Boolean(reasonsByPlatform[p]));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !loading && onClose()}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrapper}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </View>
            <View style={styles.headerTextWrapper}>
              <Text style={styles.title}>Tolak Pesanan</Text>
              <Text style={styles.subtitle}>
                Pilih alasan pembatalan untuk{' '}
                <Text style={styles.bold}>{orders.length}</Text> pesanan yang dipilih:
              </Text>
            </View>
          </View>

          {/* Platform Groups List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {platformsInSelection.map((platform) => {
              const platformOrders = platformGroups[platform] || [];
              const isSupported = SUPPORTED_CANCEL_PLATFORMS.includes(platform);
              const reasons = SELLER_CANCEL_REASONS[platform] || [];
              const theme = PLATFORM_THEMES[platform] || {
                bg: '#F3F4F6',
                color: '#4B5563',
                border: '#E5E7EB',
              };

              return (
                <View
                  key={platform}
                  style={[
                    styles.platformCard,
                    { borderColor: theme.border, backgroundColor: theme.bg },
                  ]}
                >
                  {/* Platform Badge Header */}
                  <View style={styles.platformHeader}>
                    <View style={[styles.platformBadge, { backgroundColor: theme.color }]}>
                      <Text style={styles.platformBadgeText}>{platform}</Text>
                    </View>
                    <Text style={styles.orderCountText}>
                      {platformOrders.length} pesanan
                    </Text>
                  </View>

                  {/* Reasons or Unsupported Warning */}
                  {isSupported ? (
                    <View style={styles.reasonsList}>
                      <Text style={styles.reasonsTitle}>Alasan Pembatalan:</Text>
                      {reasons.map((r) => {
                        const isSelected =
                          (reasonsByPlatform[platform] || 'OUT_OF_STOCK') === r.value;
                        return (
                          <TouchableOpacity
                            key={r.value}
                            style={[
                              styles.reasonOption,
                              isSelected && styles.reasonOptionSelected,
                            ]}
                            onPress={() => handleSelectReason(platform, r.value)}
                            disabled={loading}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioDot} />}
                            </View>
                            <Text
                              style={[
                                styles.reasonText,
                                isSelected && styles.reasonTextSelected,
                              ]}
                            >
                              {r.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.unsupportedCard}>
                      <Ionicons
                        name="warning-outline"
                        size={18}
                        color="#B91C1C"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.unsupportedText}>
                        Platform <Text style={styles.bold}>{platform}</Text> belum didukung
                        untuk tolak pesanan otomatis oleh penjual. Pesanan ini akan dilewati.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!canConfirm || loading) && styles.confirmBtnDisabled,
              ]}
              onPress={() => canConfirm && onConfirm(reasonsByPlatform)}
              disabled={!canConfirm || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={16}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.confirmBtnText}>Konfirmasi Tolak</Text>
                </>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerIconWrapper: {
    marginRight: 10,
    marginTop: 2,
  },
  headerTextWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollList: {
    maxHeight: 400,
    marginVertical: 4,
  },
  scrollContent: {
    paddingVertical: 4,
  },
  platformCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  platformBadgeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  orderCountText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  reasonsList: {
    marginTop: 2,
  },
  reasonsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  reasonOptionSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: '#EF4444',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  reasonText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  unsupportedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
  },
  unsupportedText: {
    fontSize: 12,
    color: '#991B1B',
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 145,
  },
  confirmBtnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  confirmBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
