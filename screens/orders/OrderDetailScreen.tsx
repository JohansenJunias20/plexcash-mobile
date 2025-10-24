import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { Ionicons } from '@expo/vector-icons';

export type OrderDetail = {
  id: string;
  id_ecommerce: number;
  platform: string;
  ecommerce_name?: string;
  date?: string;
  invoice?: string;
  status?: string;
  total_price?: string | number;
  ekspedisi?: string;
  items?: { sku: string; name: string; qty: number; price?: number; id_online?: string; id_parent?: string }[];
  orderType?: string;
  booking_sn?: string;
};

type Props = NativeStackScreenProps<AppStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen({ route, navigation }: Props) {
  const { id, id_ecommerce } = route.params;
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [access, setAccess] = useState<{ actions?: { create?: boolean } } | undefined>();

  useEffect(() => { navigation.setOptions({ title: `Order ${id}` }); }, [navigation, id]);

  useEffect(() => { (async () => { try { const res = await ApiService.authenticatedRequest('/access'); if (res?.status) setAccess(res.access); } catch {} })(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await ApiService.authenticatedRequest(`/get/ecommerce/order?id=${id}&id_ecommerce=${id_ecommerce}`);
        if (res?.status) {
          const d = res.data;
          setDetail({
            id: d.id,
            id_ecommerce: d.id_ecommerce || id_ecommerce,
            platform: d.from,
            ecommerce_name: d.ecommerce_name,
            date: d.date,
            invoice: d.invoice,
            status: d.status,
            total_price: d.total_price,
            ekspedisi: d.ekspedisi,
            items: (d.items || []).map((it: any) => ({ sku: it.sku, name: it.name, qty: it.qty, price: it.price_after_discount ?? it.price, id_online: it.id_online, id_parent: it.id_parent })),
            orderType: d.orderType,
            booking_sn: d.booking_sn,
          });
        }
      } catch (e) { console.error('order detail error', e); }
    })();
  }, [id, id_ecommerce]);

  const canCreate = !!access?.actions?.create;

  const createSales = async () => {
    if (!canCreate || !detail) { Alert.alert('Permission', 'You do not have permission'); return; }
    try {
      const body = [{
        platform: detail.platform,
        id: detail.id,
        barang: (detail.items || []).map(it => ({ price: it.price || 0, name: it.name, sku: it.sku, qty: it.qty, id_online: it.id_online, id_parent: it.id_parent })),
        id_ecommerce: detail.id_ecommerce,
        date: typeof detail.date === 'string' ? detail.date : new Date().toISOString(),
        invoice: detail.invoice,
        from_import: false,
        booking_sn: detail.booking_sn,
        orderType: detail.orderType,
        isBookingOrder: !!detail.booking_sn,
      }];
      const res = await ApiService.authenticatedRequest('/ecommerce/pesanan', { method: 'POST', body: JSON.stringify(body) });
      if (res?.status) Alert.alert('Success', 'Sales created.'); else Alert.alert('Failed', res?.reason || 'Failed to create sales');
    } catch (e: any) { console.error('createSales', e); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const printLabel = async () => {
    if (!canCreate || !detail) { Alert.alert('Permission', 'You do not have permission'); return; }
    try {
      const payload = [{ id_ecommerce: detail.id_ecommerce, order_id: detail.id, A6: true }];
      const res = await ApiService.authenticatedRequest('/ecommerce/ship_label', { method: 'POST', body: JSON.stringify(payload) });
      if (!res || res.status === false) { Alert.alert('Failed', res?.reason || 'Failed to get label'); return; }
      const list = Array.isArray(res.data) ? res.data : res;
      const htmlItem = list.find((x: any) => x?.type === 'HTML_ENCODED' && x.data);
      if (htmlItem) {
        navigation.navigate('LabelPreview', { html: String(htmlItem.data), title: `${detail.platform} Label` });
        return;
      }
      Alert.alert('Not supported', 'Label format is not supported on mobile yet. Please print from the web app.');
    } catch (e: any) { console.error('printLabel', e); Alert.alert('Error', e?.message || 'Failed'); }
  };

  if (!detail) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text>Loading...</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{detail.ecommerce_name || detail.platform}</Text>
        <Text style={styles.badge}>{(detail.status || '').toUpperCase()}</Text>
      </View>
      <Text style={styles.sub}>ID: {detail.id} • {detail.invoice || 'No Invoice'}</Text>
      <Text style={styles.meta}>Total: {detail.total_price || '-'} • Ekspedisi: {detail.ekspedisi || '-'}</Text>
      <Text style={styles.meta}>Type: {detail.orderType || 'STANDARD'}{detail.booking_sn ? ` • Booking: ${detail.booking_sn}` : ''}</Text>

      <View style={{ marginTop: 12 }}>
        <Text style={styles.section}>Items</Text>
        {(detail.items || []).map((it, idx) => (
          <View key={`${it.sku}-${idx}`} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
            <Text style={styles.itemSku}>{it.sku}</Text>
            <Text style={styles.itemQty}>x{it.qty}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, !canCreate && styles.buttonDisabled]} disabled={!canCreate} onPress={createSales}>
          <Ionicons name="cart" size={18} color="#fff" /><Text style={styles.buttonText}>Create Sales</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.buttonAlt, !canCreate && styles.buttonDisabled]} disabled={!canCreate} onPress={printLabel}>
          <Ionicons name="print" size={18} color="#111827" /><Text style={styles.buttonAltText}>Print Label (A6)</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  badge: { backgroundColor: '#EEF2FF', color: '#3730a3', fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sub: { color: '#6B7280', marginTop: 4 },
  meta: { color: '#374151', marginTop: 4 },
  section: { fontWeight: '700', marginBottom: 6, color: '#111827' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  itemName: { flex: 1, color: '#111827' },
  itemSku: { color: '#6B7280', marginHorizontal: 8 },
  itemQty: { color: '#111827' },
  actions: { flexDirection: 'row', gap: 12 as any, marginTop: 16 },
  button: { flex: 1, flexDirection: 'row', gap: 8 as any, backgroundColor: '#2563eb', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonAlt: { flex: 1, flexDirection: 'row', gap: 8 as any, backgroundColor: '#E5E7EB', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonAltText: { color: '#111827', fontWeight: '600' },
  buttonText: { color: 'white', fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
});

