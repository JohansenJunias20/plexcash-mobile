import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';

interface WDDetailModalProps {
  visible: boolean;
  onClose: () => void;
  groupedTransaction: any;
  kodeBaganAkun: string;
}

const currency = (n: number) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: 0 });

const formatDate = (s: string) => {
  try {
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return s; }
};

export default function WDDetailModal({
  visible,
  onClose,
  groupedTransaction,
  kodeBaganAkun,
}: WDDetailModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [details, setDetails] = useState<any[]>([]);

  useEffect(() => {
    if (visible && groupedTransaction) {
      fetchDetails();
    } else {
      setDetails([]);
    }
  }, [visible, groupedTransaction]);

  const fetchDetails = async () => {
    setIsLoading(true);
    try {
      const originalIds = groupedTransaction?.originalIds || [];
      if (originalIds.length === 0) {
        setIsLoading(false);
        return;
      }

      // Extract date
      const dateStr = groupedTransaction.tanggal.replace(' ', 'T');
      const transactionDate = new Date(dateStr);
      const bulan = String(transactionDate.getMonth() + 1).padStart(2, '0');
      const tahun = transactionDate.getFullYear();

      const token = await getTokenAuth();
      const res = await fetch(`${API_BASE_URL}/get/transaksi/${kodeBaganAkun}/${bulan}/${tahun}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.status && data.data) {
        const filtered = data.data.filter((item: any) =>
          originalIds.includes(item.id)
        );
        setDetails(filtered);
      } else {
        Alert.alert('Error', 'Gagal memuat detail transaksi.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat data.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!visible || !groupedTransaction) return null;

  const totalDebit = details.reduce((sum, item) => sum + (item.debit || 0), 0);
  const totalKredit = details.reduce((sum, item) => sum + (item.kredit || 0), 0);
  const netAmount = totalDebit - totalKredit;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalContainer}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="receipt" size={24} color="#fff" style={{ marginRight: 10 }} />
              <View>
                <Text style={s.headerTitle}>Detail Transaksi WD</Text>
                <Text style={s.headerSubtitle}>ID: {groupedTransaction.id}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={s.content}>
            {isLoading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={s.loadingText}>Memuat detail transaksi...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Summary Cards */}
                <View style={s.summaryContainer}>
                  <View style={[s.summaryCard, { backgroundColor: '#10B981' }]}>
                    <Text style={s.summaryCardLabel}>Total Debit</Text>
                    <Text style={s.summaryCardValue}>Rp {currency(totalDebit)}</Text>
                  </View>
                  <View style={[s.summaryCard, { backgroundColor: '#EF4444' }]}>
                    <Text style={s.summaryCardLabel}>Total Kredit</Text>
                    <Text style={s.summaryCardValue}>Rp {currency(totalKredit)}</Text>
                  </View>
                  <View style={[s.summaryCard, { backgroundColor: '#F59E0B' }]}>
                    <Text style={s.summaryCardLabel}>Net Amount</Text>
                    <Text style={s.summaryCardValue}>Rp {currency(netAmount)}</Text>
                  </View>
                </View>

                {/* Table */}
                <View style={s.tableContainer}>
                  <View style={s.tableHeader}>
                    <Text style={s.tableTitle}>Individual Transactions ({details.length})</Text>
                  </View>
                  {details.length === 0 ? (
                    <Text style={s.emptyText}>Tidak ada detail transaksi</Text>
                  ) : (
                    details.map((item, index) => (
                      <View key={index} style={[s.row, index % 2 === 0 && s.rowEven]}>
                        <View style={s.rowTop}>
                          <Text style={s.rowId}>{item.id}</Text>
                          <Text style={s.rowDate}>{formatDate(item.tanggal)}</Text>
                        </View>
                        {item.keterangan ? (
                          <Text style={s.rowKeterangan}>{item.keterangan}</Text>
                        ) : null}
                        <View style={s.rowAmounts}>
                          <View style={s.amountCol}>
                            <Text style={s.amountLabel}>Debit</Text>
                            <Text style={[s.amountValue, { color: '#059669' }]}>
                              {item.debit ? currency(item.debit) : '0'}
                            </Text>
                          </View>
                          <View style={[s.amountCol, { alignItems: 'flex-end' }]}>
                            <Text style={s.amountLabel}>Kredit</Text>
                            <Text style={[s.amountValue, { color: '#DC2626' }]}>
                              {item.kredit ? currency(item.kredit) : '0'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  closeBtn: { padding: 4 },
  content: { padding: 16, flexShrink: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#667eea', fontWeight: '600' },
  
  summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, minWidth: '30%', padding: 12, borderRadius: 10 },
  summaryCardLabel: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  summaryCardValue: { fontSize: 14, fontWeight: '700', color: '#fff' },

  tableContainer: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 1 },
  tableHeader: { backgroundColor: '#667eea', padding: 12 },
  tableTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyText: { padding: 20, textAlign: 'center', color: '#6B7280' },
  
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowEven: { backgroundColor: '#F9FAFB' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowId: { fontSize: 13, fontWeight: '700', color: '#667eea' },
  rowDate: { fontSize: 12, color: '#6B7280' },
  rowKeterangan: { fontSize: 13, color: '#374151', marginBottom: 6 },
  rowAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  amountCol: { flex: 1 },
  amountLabel: { fontSize: 10, color: '#9CA3AF' },
  amountValue: { fontSize: 13, fontWeight: '600' },
});
