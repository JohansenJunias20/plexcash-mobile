import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

// Format currency helper
const formatRupiah = (value: number) => {
  if (value === undefined || value === null) return 'Rp 0';
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absVal);
  return isNegative ? `-${formatted}` : formatted;
};

export type KodebaTipe =
  | 'biaya_admin'
  | 'biaya_bebas_ongkir'
  | 'biaya_ekspedisi'
  | 'biaya_iklan'
  | 'biaya_lainnya'
  | 'persediaan'
  | 'pendapatan'
  | 'biaya_afilisasi'
  | 'voucher_seller';

export function getKodeBA(platform: string, idEcommerce: number, tipe: KodebaTipe): string {
  let final = '';

  switch (tipe) {
    case 'biaya_admin':
      final = '61.1.1.';
      break;
    case 'biaya_bebas_ongkir':
      final = '61.1.2.';
      break;
    case 'biaya_ekspedisi':
      final = '61.1.3.';
      break;
    case 'biaya_iklan':
      final = '61.1.4.';
      break;
    case 'biaya_lainnya':
      final = '61.1.9.';
      break;
    case 'pendapatan':
      final = '41.';
      break;
    case 'persediaan':
      final = '51.';
      break;
    case 'biaya_afilisasi':
      final = '61.1.5.';
      break;
    case 'voucher_seller':
      final = '61.1.6.';
      break;
    default:
      return '';
  }

  const platUpper = platform.toUpperCase();
  if (platUpper === 'TOKOPEDIA') {
    final += tipe === 'pendapatan' || tipe === 'persediaan' ? '3' : '2';
  } else if (platUpper === 'SHOPEE') {
    final += tipe === 'pendapatan' || tipe === 'persediaan' ? '2' : '1';
  } else if (platUpper === 'LAZADA') {
    final += tipe === 'pendapatan' || tipe === 'persediaan' ? '4' : '3';
  } else if (platUpper === 'TIKTOK') {
    final += tipe === 'pendapatan' || tipe === 'persediaan' ? '5' : '4';
  } else {
    return '';
  }

  return `${final}.${idEcommerce}`;
}

export interface ITAOdataTransaction {
  tanggal: string;
  no_order: string;
  invoice: string;
  total: number;
  biaya_pokok: number;
  biaya_admin: number;
  biaya_ongkir: number;
  biaya_lainnya: {
    nama: string;
    biaya: number;
    deskripsi: string;
    kodeBA: string;
    tipe: 'EKSPEDISI' | 'VOUCHER SELLER' | 'LAINNYA' | 'AFILIASI';
  }[];
  bayar: number;
  lunas?: boolean;
  id_database: number;
  id_database_withdraw: number;
  retur?: {
    total: number;
    id_returonline: number;
    status: 'approved' | 'rejected';
    lunas: boolean;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  transaction: ITAOdataTransaction | null;
  platform: string;
  idEcommerce: number;
  ecommerceName: string;
}

export default function PenarikanDetailModal({
  open,
  onClose,
  transaction,
  platform,
  idEcommerce,
  ecommerceName,
}: Props) {
  if (!transaction) return null;

  const isDibuat = transaction.id_database_withdraw !== 0;

  // Calculations
  const adminFee = -Math.abs(transaction.biaya_admin || 0);
  const ongkirFee = -Math.abs(transaction.biaya_ongkir || 0);
  const otherFeesSum = (transaction.biaya_lainnya || []).reduce(
    (acc, item) => acc + (item.biaya || 0),
    0
  );
  const totalBiaya = adminFee + ongkirFee + otherFeesSum;
  const returTotal = transaction.retur?.total || 0;
  const grandTotal = transaction.total - returTotal + totalBiaya;

  // Build items list
  const breakdownItems = [
    {
      id: 'biaya_admin',
      nama: 'Biaya Admin',
      kodeBA: getKodeBA(platform, idEcommerce, 'biaya_admin'),
      deskripsi: 'Biaya layanan yang dikenakan oleh marketplace',
      amount: adminFee,
    },
    {
      id: 'bebas_ongkir',
      nama: 'Biaya Bebas Ongkir',
      kodeBA: getKodeBA(platform, idEcommerce, 'biaya_bebas_ongkir'),
      deskripsi: 'Biaya subsidi ongkos kirim promosi seller',
      amount: ongkirFee,
    },
    ...(transaction.biaya_lainnya || []).map((item, idx) => ({
      id: `other_${idx}`,
      nama: item.nama,
      kodeBA: item.kodeBA || getKodeBA(platform, idEcommerce, 'biaya_lainnya'),
      deskripsi: item.deskripsi || 'Biaya operasional lainnya',
      amount: item.biaya,
    })),
  ];

  return (
    <Modal visible={open} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Detail Transaksi Penarikan</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
              <Ionicons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Metadata Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status Penarikan</Text>
                <View style={[styles.statusBadge, isDibuat ? styles.statusDibuat : styles.statusBelum]}>
                  <Text style={[styles.statusText, isDibuat ? styles.statusTextDibuat : styles.statusTextBelum]}>
                    {isDibuat ? 'DIBUAT' : 'BELUM DIBUAT'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>No. Invoice / Order</Text>
                <Text style={styles.infoValue}>{transaction.invoice || transaction.no_order}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Platform</Text>
                <Text style={styles.infoValue}>{ecommerceName || platform}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tanggal</Text>
                <Text style={styles.infoValue}>
                  {moment(transaction.tanggal).format('DD-MM-YYYY HH:mm')}
                </Text>
              </View>
            </View>

            {/* Breakdown Table Header */}
            <Text style={styles.sectionTitle}>Rincian Biaya Marketplace</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Nama Biaya</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Kode Akun</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Nominal</Text>
              </View>

              {breakdownItems.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.itemName}>{item.nama}</Text>
                    {item.deskripsi ? <Text style={styles.itemDesc}>{item.deskripsi}</Text> : null}
                  </View>
                  <Text style={[styles.itemCode, { flex: 1.5 }]}>{item.kodeBA || '-'}</Text>
                  <Text style={[styles.itemAmount, { flex: 2 }]}>{formatRupiah(item.amount)}</Text>
                </View>
              ))}
            </View>

            {/* Live Totals Summary Panel */}
            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Biaya</Text>
                <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                  {formatRupiah(totalBiaya)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Transaksi</Text>
                <Text style={styles.summaryValue}>{formatRupiah(transaction.total)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Retur</Text>
                <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
                  {formatRupiah(returTotal)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.divider]}>
                <Text style={styles.summaryLabelBold}>Grand Total</Text>
                <Text style={styles.summaryValueBold}>{formatRupiah(grandTotal)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.netPayoutRow]}>
                <Text style={styles.netPayoutLabel}>Bayar (Net Masuk Kas)</Text>
                <Text style={styles.netPayoutValue}>{formatRupiah(transaction.bayar)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
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
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeIconButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  infoSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusDibuat: {
    backgroundColor: '#d1fae5',
  },
  statusBelum: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusTextDibuat: {
    color: '#065f46',
  },
  statusTextBelum: {
    color: '#991b1b',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4b5563',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  itemDesc: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  itemCode: {
    fontSize: 12,
    color: '#4b5563',
  },
  itemAmount: {
    fontSize: 13,
    textAlign: 'right',
    color: '#374151',
    fontWeight: '500',
  },
  summarySection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 8,
  },
  summaryLabelBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  summaryValueBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  netPayoutRow: {
    backgroundColor: '#eff6ff',
    marginHorizontal: -16,
    marginBottom: -16,
    marginTop: 12,
    padding: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
  },
  netPayoutLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  netPayoutValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  footer: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'stretch',
  },
  closeButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
