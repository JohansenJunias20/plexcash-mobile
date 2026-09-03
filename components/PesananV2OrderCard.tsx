import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { useAccess } from '../context/AccessContext';
import { API_BASE_URL } from '../services/api';
import { getTokenAuth } from '../services/token';
import { showMessage } from 'react-native-flash-message';
import { sendPaymentReminder } from '../services/ecommerce/paymentReminderService';

const C = {
  primary: '#D97706',
  primaryDark: '#B45309',
  primaryLight: '#FFFBEB',
  primaryBorder: '#FDE68A',
};

const getStatusColor = (status: string) => {
    switch ((status || '').toUpperCase()) {
        case 'BELUM DIBAYAR': return '#F59E0B';
        case 'PESANAN BARU': return '#3B82F6';
        case 'DIPROSES': return '#8B5CF6';
        case 'PERJALANAN': return '#06B6D4';
        case 'SAMPAI TUJUAN': return '#10B981';
        case 'SELESAI': return '#059669';
        case 'PEMBATALAN': case 'DIBATALKAN': return '#EF4444';
        case 'DIRETUR': case 'TELAH DIRETUR': return '#F97316';
        default: return '#6B7280';
    }
};

const PLATFORM_LOGO: any = {
    shopee: { bg: '#FFF7ED', color: '#EA580C', border: '#FDBA74' },
    tokopedia: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
    tiktok: { bg: '#F0F9FF', color: '#0369A1', border: '#7DD3FC' },
    lazada: { bg: '#F5F3FF', color: '#7C3AED', border: '#C4B5FD' },
};

interface Props {
  order: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPress: () => void;
  isUnpaidTab?: boolean;
  isReminded?: boolean;
  onOpenTemplateSetting?: () => void;
  onReminderSuccess?: (orderSn: string) => void;
}

export default function PesananV2OrderCard({
  order,
  isSelected,
  onToggleSelect,
  onPress,
  isUnpaidTab = false,
  isReminded = false,
  onOpenTemplateSetting,
  onReminderSuccess,
}: Props) {
  const { access } = useAccess();
  const [showHpp, setShowHpp] = useState(false);
  const [resolvedItems, setResolvedItems] = useState<any[]>(order.items || []);
  const [loadingHpp, setLoadingHpp] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [localReminded, setLocalReminded] = useState(isReminded);

  useEffect(() => {
    setLocalReminded(isReminded);
  }, [isReminded]);

  useEffect(() => {
    setResolvedItems(order.items || []);
  }, [order.items]);

  const handleShowHpp = async () => {
    setShowHpp(true);
    
    // Check if we need to resolve HPP (i.e. if any item has HPP = 0 or undefined)
    const itemsToResolve = (order.items || []).filter((item: any) => !item.hpp || Number(item.hpp) === 0);
    if (itemsToResolve.length === 0) {
      setResolvedItems(order.items || []);
      return;
    }

    setLoadingHpp(true);
    try {
      const token = await getTokenAuth();
      if (!token) return;

      const updatedItems = await Promise.all(
        (order.items || []).map(async (item: any) => {
          // If already has hpp, use it
          const currentHpp = Number(item.hpp || item.hargabeli || 0);
          if (currentHpp > 0) {
            return {
              ...item,
              hpp: currentHpp
            };
          }

          let hpp = 0;

          // 1. Try search by SKU first
          if (item.sku && item.sku !== '-') {
            try {
              const qs = new URLSearchParams();
              qs.set('start', '0');
              qs.set('end', '1');
              qs.set('sku', item.sku);
              qs.set('nama', '');

              const url = `${API_BASE_URL}/get/masterbarang/search?${qs.toString()}`;
              const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.status && data.data && data.data.length > 0) {
                hpp = Number(data.data[0].hargabeli || data.data[0].hpp || 0);
              }
            } catch (err) {
              console.warn(`Failed to search masterbarang by SKU (${item.sku}) for hpp:`, err);
            }
          }

          // 2. Try by online ID if still 0
          if (hpp === 0 && item.id_online) {
            try {
              const url = `${API_BASE_URL}/get/masterbarang?id_online=${item.id_online}&id_ecommerce=${order.ecommerce_id}`;
              const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.status && data.data && data.data.length > 0) {
                hpp = Number(data.data[0].hargabeli || data.data[0].hpp || 0);
              }
            } catch (err) {
              console.warn(`Failed to fetch masterbarang by online ID (${item.id_online}) for hpp:`, err);
            }
          }

          // 3. Try bundling if still 0
          if (hpp === 0 && item.id_online) {
            try {
              const url = `${API_BASE_URL}/get/bundling?id_online=${item.id_online}&id_ecommerce=${order.ecommerce_id}`;
              const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.status && data.data && data.data.length > 0) {
                hpp = Number(data.data[0].hargabeli || data.data[0].hpp || 0);
              }
            } catch (err) {
              console.warn(`Failed to fetch bundling by online ID (${item.id_online}) for hpp:`, err);
            }
          }

          return {
            ...item,
            hpp: hpp
          };
        })
      );

      setResolvedItems(updatedItems);
    } catch (error) {
      console.warn('Error resolving HPP:', error);
      setResolvedItems(order.items || []);
    } finally {
      setLoadingHpp(false);
    }
  };

  const statusColor = getStatusColor(order.status);
  const platformKey = (order.platform || '').toLowerCase();
  const platformStyle = PLATFORM_LOGO[platformKey] || { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' };

  // HPP Logic
  const allItems = resolvedItems;
  const hasItems = allItems.length > 0;
  const canShowHpp = !!access?.master?.show_hpp && hasItems;

  const itemsWithHpp = allItems.filter((item: any) => Number(item.hpp || item.hargabeli || 0) > 0);
  const hasPartialHpp = itemsWithHpp.length > 0 && itemsWithHpp.length < allItems.length;
  const hasNoHpp = itemsWithHpp.length === 0;

  let totalHpp = 0;
  let totalJual = 0;

  const calcItems = hasPartialHpp ? itemsWithHpp : allItems;
  calcItems.forEach((item: any) => {
    const qty = Number(item.qty || 0);
    const itemHpp = Number(item.hpp || item.hargabeli || 0);
    const itemJual = Number(item.harga_jual || item.price || item.harga || 0);
    totalHpp += itemHpp * qty;
    totalJual += itemJual * qty;
  });

  const selisih = totalJual - totalHpp;
  const marginPct = totalHpp > 0 ? (selisih / totalHpp) * 100 : 100;
  const isProfit = selisih >= 0;

  const profitText = isProfit ? `+ Rp ${selisih.toLocaleString('id-ID')}` : `- Rp ${Math.abs(selisih).toLocaleString('id-ID')}`;
  const marginText = isProfit ? `(+ ${parseFloat(marginPct.toFixed(1))}%)` : `(${parseFloat(marginPct.toFixed(1))}%)`;

  const isUnpaid = isUnpaidTab || (order.status || '').toUpperCase() === 'BELUM DIBAYAR';

  const handleSendReminder = async () => {
    if (isReminded || localReminded || reminderLoading) return;

    const platform = (order.platform || '').toUpperCase();
    if (platform === 'TIKTOK') {
      showMessage({
        message: 'Platform Belum Mendukung',
        description: 'Platform TikTok belum menyediakan API Seller Chat untuk mengirim pesan langsung ke pembeli.',
        type: 'warning',
      });
      return;
    }

    const orderSn = order.id_online || order.order_sn || order.booking_sn || '';
    if (!orderSn) {
      showMessage({
        message: 'Nomor Pesanan Tidak Valid',
        description: 'Nomor pesanan tidak ditemukan untuk pesanan ini.',
        type: 'danger',
      });
      return;
    }

    setReminderLoading(true);
    try {
      const res = await sendPaymentReminder({
        order_id: order.id ?? order.order_id ?? 0,
        order_sn: orderSn,
        buyer_id: order.buyer_id ?? '',
        buyer_username: order.buyer_username || '',
        id_ecommerce: Number(order.ecommerce_id || order.id_ecommerce || 0),
        shop_id: String(order.shop_id || order.id_toko || ''),
        platform: platform,
        custom_message: '',
      });

      if (res.status || res.success) {
        setLocalReminded(true);
        onReminderSuccess?.(orderSn);
        showMessage({
          message: 'Pengingat Terkirim',
          description: res.message || 'Pesan pengingat pembayaran berhasil dikirim ke pembeli!',
          type: 'success',
        });
      } else {
        showMessage({
          message: 'Gagal Mengirim Pengingat',
          description: res.reason || 'Terjadi kesalahan saat mengirim pengingat pembayaran',
          type: 'danger',
        });
      }
    } catch (error: any) {
      showMessage({
        message: 'Error',
        description: error?.message || 'Gagal mengirim pengingat pembayaran',
        type: 'danger',
      });
    } finally {
      setReminderLoading(false);
    }
  };

  return (
    <View style={[styles.card, isSelected && styles.cardSelected]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.checkboxContainer} onPress={onToggleSelect}>
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={22}
            color={isSelected ? C.primary : "#D1D5DB"}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerContent} onPress={onPress}>
          <View style={styles.rowBetween}>
            <View style={styles.platformBadgeContainer}>
              <View style={[styles.platformBadge, { backgroundColor: platformStyle.bg, borderColor: platformStyle.border }]}>
                 <Text style={[styles.platformText, { color: platformStyle.color }]}>{order.platform}</Text>
              </View>
              {order.isBookingOrder && (
                  <View style={[styles.platformBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', marginLeft: 6 }]}>
                      <Text style={[styles.platformText, { color: '#DC2626' }]}>KILAT</Text>
                  </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {order.packed || !!order.pack_timestamp ? (
                  <View style={[styles.miniBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[styles.miniBadgeText, { color: '#065F46' }]}>SUDAH PACK</Text></View>
              ) : (
                  <View style={[styles.miniBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.miniBadgeText, { color: '#991B1B' }]}>BELUM PACK</Text></View>
              )}
              <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
            </View>
          </View>
          <Text style={styles.ecommerceName}>{order.ecommerce_name}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onPress} style={styles.body}>
        {/* IDs */}
        <View style={styles.row}>
          <Ionicons name="receipt-outline" size={14} color="#6B7280" />
          <Text style={styles.idText} selectable> {order.id_online}</Text>
        </View>

        {/* Kurir & Resi */}
        <View style={styles.row}>
          <Ionicons name="cube-outline" size={14} color="#6B7280" />
          <Text style={styles.infoText}> {order.nama_kurir || '-'} {order.no_resi ? `• ${order.no_resi}` : ''}</Text>
        </View>

        {/* User */}
        <View style={styles.row}>
          <Ionicons name="person-outline" size={14} color="#6B7280" />
          <Text style={styles.infoText}> {order.buyer_username || '-'} {order.buyer_city ? `• ${order.buyer_city}` : ''}</Text>
        </View>

        {/* Date */}
        <View style={styles.row}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text style={styles.infoText}> {order.tanggal_order ? moment(order.tanggal_order).format('DD/MM/YYYY HH:mm') : '-'}</Text>
        </View>

        {/* Print Date */}
        {(order.print_timestamp || order.print) && (
          <View style={styles.row}>
            <Ionicons name="print-outline" size={14} color="#6B7280" />
            <Text style={styles.infoText}>
              {' '}
              {order.print_timestamp 
                ? moment(order.print_timestamp).format('DD/MM/YYYY HH:mm') 
                : 'Sudah Dicetak (Tanggal tidak tersedia)'}
            </Text>
          </View>
        )}

        {/* Items Summary */}
        <View style={styles.itemsBox}>
            {order.items?.slice(0, 2).map((item: any, idx: number) => (
                <Text key={idx} style={styles.itemText} numberOfLines={1}>
                    {item.qty}x {item.sku || '-'} - {item.nama}
                </Text>
            ))}
            {(order.items?.length || 0) > 2 && (
                <Text style={styles.itemMoreText}>+ {(order.items?.length || 0) - 2} produk lainnya</Text>
            )}
        </View>

        {/* Footer info (Badges & Total) */}
        <View style={styles.footer}>
            <View style={styles.badgesRow}>
                {order.has_penjualan && <View style={[styles.miniBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[styles.miniBadgeText, { color: '#065F46' }]}>DIBUAT</Text></View>}
                {(order.print || !!order.print_timestamp) && <View style={[styles.miniBadge, { backgroundColor: '#E0E7FF' }]}><Text style={[styles.miniBadgeText, { color: '#3730A3' }]}>PRINTED</Text></View>}
                {order.scanned || !!order.scan_timestamp ? (
                    <View style={[styles.miniBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[styles.miniBadgeText, { color: '#065F46' }]}>SUDAH SCAN</Text></View>
                ) : (
                    <View style={[styles.miniBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.miniBadgeText, { color: '#991B1B' }]}>BELUM SCAN</Text></View>
                )}
                {(order.has_retur || order.retur) && (
                    <View style={[styles.miniBadge, { backgroundColor: '#FFEDD5' }]}><Text style={[styles.miniBadgeText, { color: '#C2410C' }]}>SUDAH RETUR</Text></View>
                )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.totalText}>Rp {(order.total_harga || 0).toLocaleString('id-ID')}</Text>
                {canShowHpp && (
                    <TouchableOpacity 
                        onPress={handleShowHpp} 
                        style={{ marginLeft: 8 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="bar-chart" size={18} color="#10B981" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
      </TouchableOpacity>

      {/* Payment Reminder Action Bar */}
      {isUnpaid && (
        <View style={styles.reminderBar}>
          <TouchableOpacity
            style={[
              styles.reminderButton,
              (isReminded || localReminded) && styles.reminderButtonSuccess,
              (reminderLoading || isReminded || localReminded) && styles.reminderButtonDisabled,
            ]}
            onPress={handleSendReminder}
            disabled={reminderLoading || isReminded || localReminded}
            activeOpacity={0.8}
          >
            {reminderLoading ? (
              <ActivityIndicator size="small" color="#FFF" style={styles.reminderIcon} />
            ) : (isReminded || localReminded) ? (
              <Ionicons name="checkmark-circle" size={16} color="#FFF" style={styles.reminderIcon} />
            ) : (
              <Ionicons name="notifications" size={16} color="#FFF" style={styles.reminderIcon} />
            )}
            <Text style={styles.reminderButtonText}>
              {reminderLoading
                ? 'Mengirim...'
                : (isReminded || localReminded)
                ? 'Pengingat Terkirim'
                : 'Ingatkan Pembayaran'}
            </Text>
          </TouchableOpacity>

          {onOpenTemplateSetting && (
            <TouchableOpacity
              style={styles.settingTemplateButton}
              onPress={onOpenTemplateSetting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="settings-outline" size={18} color="#D97706" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* HPP Modal */}
      <Modal visible={showHpp} transparent={true} animationType="fade" onRequestClose={() => setShowHpp(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowHpp(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            <View style={styles.bsHeader}>
              <Text style={styles.bsTitle}>Rincian HPP</Text>
              <TouchableOpacity onPress={() => setShowHpp(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.bsContent} showsVerticalScrollIndicator={false}>
              {loadingHpp ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#D97706" />
                  <Text style={{ marginTop: 8, fontSize: 13, color: '#6B7280' }}>Memuat HPP...</Text>
                </View>
              ) : (
                allItems.map((item: any, idx: number) => {
                  const qty = Number(item.qty || 0);
                  const hppVal = Number(item.hpp || item.hargabeli || 0);
                  const hppTotal = hppVal * qty;
                  return (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.nama || item.sku} × {qty}</Text>
                      {hppVal > 0 ? (
                        <Text style={styles.itemHpp}>Rp {hppTotal.toLocaleString('id-ID')}</Text>
                      ) : (
                        <Text style={styles.itemHppEmpty}>Rp 0</Text>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.bsFooter}>
              {loadingHpp ? (
                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Menghitung...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.bsFooterRow}>
                    <Text style={styles.bsFooterLabel}>Total HPP</Text>
                    <Text style={styles.bsFooterValue}>Rp {totalHpp.toLocaleString('id-ID')}</Text>
                  </View>
                  <View style={styles.bsFooterRow}>
                    <Text style={styles.bsFooterLabel}>{hasPartialHpp ? 'Est. Untung' : 'Untung'}</Text>
                    <Text style={[styles.bsFooterValue, { color: isProfit ? '#10B981' : '#EF4444' }]}>
                      {profitText} {marginText}
                    </Text>
                  </View>
                  {hasPartialHpp && (
                    <Text style={styles.warningText}>* sebagian HPP belum diisi.</Text>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardSelected: { borderColor: C.primary, backgroundColor: C.primaryLight },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  checkboxContainer: { paddingRight: 12 },
  headerContent: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  platformBadgeContainer: { flexDirection: 'row', alignItems: 'center' },
  platformBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  platformText: { fontSize: 10, fontWeight: '700' },
  statusText: { fontSize: 12, fontWeight: '700' },
  ecommerceName: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  body: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  idText: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  infoText: { fontSize: 13, color: '#4B5563' },
  itemsBox: { backgroundColor: '#F9FAFB', padding: 8, borderRadius: 6, marginTop: 4, marginBottom: 8 },
  itemText: { fontSize: 12, color: '#374151', marginBottom: 2 },
  itemMoreText: { fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1, marginRight: 8 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniBadgeText: { fontSize: 9, fontWeight: '700' },
  totalText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  // Bottom Sheet / Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', paddingBottom: 20 },
  bsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  bsTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  bsContent: { padding: 16 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  itemName: { fontSize: 13, color: '#374151', flex: 1, marginRight: 12, lineHeight: 18 },
  itemHpp: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  itemHppEmpty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  bsFooter: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  bsFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bsFooterLabel: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  bsFooterValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  warningText: { fontSize: 12, color: '#D97706', fontStyle: 'italic', marginTop: 4, textAlign: 'center' },
  reminderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    gap: 8,
  },
  reminderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderButtonSuccess: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  reminderButtonDisabled: {
    opacity: 0.9,
  },
  reminderIcon: {
    marginRight: 6,
  },
  reminderButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  settingTemplateButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
