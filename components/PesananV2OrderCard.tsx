import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

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
}

export default function PesananV2OrderCard({ order, isSelected, onToggleSelect, onPress }: Props) {
  const statusColor = getStatusColor(order.status);
  const platformKey = (order.platform || '').toLowerCase();
  const platformStyle = PLATFORM_LOGO[platformKey] || { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' };

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
            <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
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
                {order.print && <View style={[styles.miniBadge, { backgroundColor: '#E0E7FF' }]}><Text style={[styles.miniBadgeText, { color: '#3730A3' }]}>PRINTED</Text></View>}
                {order.scanned ? (
                    <View style={[styles.miniBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[styles.miniBadgeText, { color: '#065F46' }]}>SUDAH SCAN</Text></View>
                ) : (
                    <View style={[styles.miniBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.miniBadgeText, { color: '#991B1B' }]}>BELUM SCAN</Text></View>
                )}
            </View>
            <Text style={styles.totalText}>Rp {(order.total_harga || 0).toLocaleString('id-ID')}</Text>
        </View>
      </TouchableOpacity>
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
  badgesRow: { flexDirection: 'row', gap: 6 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniBadgeText: { fontSize: 9, fontWeight: '700' },
  totalText: { fontSize: 14, fontWeight: '700', color: '#111827' },
});
