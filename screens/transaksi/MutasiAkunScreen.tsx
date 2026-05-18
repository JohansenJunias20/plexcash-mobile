import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import WDDetailModal from './components/WDDetailModal';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface TransaksiItem {
  tanggal: string;
  id: string;
  keterangan: string;
  debit: number;
  kredit: number;
  saldo: number;
  isGrouped?: boolean;
  originalIds?: string[];
}

interface BaganAkun {
  kode: string;
  nama: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────
const currency = (n: number) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: 0 });

const formatDate = (s: string) => {
  try {
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return s; }
};

const monthIndex = (name: string) =>
  String(MONTHS.findIndex(m => m === name) + 1).padStart(2, '0');

const groupWD = (data: any[]): any[] => {
  const grouped: Record<string, any> = {};
  const result: any[] = [];
  data.forEach((item: any) => {
    if (item.id && item.id.toString().startsWith('WD/')) {
      const key = `${item.tanggal}_${item.kodeba}`;
      if (grouped[key]) {
        grouped[key].debit += item.debit || 0;
        grouped[key].kredit += item.kredit || 0;
        if (!grouped[key].originalIds) grouped[key].originalIds = [];
        grouped[key].originalIds.push(item.id);
      } else {
        grouped[key] = { 
          ...item, 
          debit: item.debit || 0, 
          kredit: item.kredit || 0, 
          keterangan: '', 
          isGrouped: true,
          originalIds: [item.id]
        };
      }
    } else {
      result.push(item);
    }
  });
  Object.values(grouped).forEach(g => result.push(g));
  return result;
};

// ─── Bagan Akun search modal ─────────────────────────────────────────────────
interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: BaganAkun) => void;
}
const BaganAkunModal: React.FC<SearchModalProps> = ({ visible, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [allItems, setAllItems] = useState<BaganAkun[]>([]);
  const [loading, setLoading] = useState(false);

  // Load semua data saat modal pertama kali dibuka
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      const res = await fetch(`${API_BASE_URL}/get/baganakun`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status) {
        setAllItems(data.data as BaganAkun[]);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Fetch data setiap kali modal dibuka
  React.useEffect(() => {
    if (visible) {
      setQuery('');
      loadAll();
    } else {
      setAllItems([]);
    }
  }, [visible]);

  // Filter client-side berdasarkan query
  const filteredItems = query.length > 0
    ? allItems.filter(i => {
        const ql = query.toLowerCase();
        return i.kode.toLowerCase().includes(ql) || i.nama.toLowerCase().includes(ql);
      })
    : allItems;

  const handleClose = () => { setQuery(''); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.searchModal}>
          <View style={s.searchModalHeader}>
            <Text style={s.searchModalTitle}>Pilih Bagan Akun</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={s.searchInput}
              placeholder="Cari kode atau nama akun..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          {loading
            ? <ActivityIndicator style={{ marginTop: 24 }} color="#f59e0b" />
            : <FlatList
                data={filteredItems}
                keyExtractor={i => i.kode}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.baganItem} onPress={() => { handleClose(); onSelect(item); }}>
                    <Text style={s.baganKode}>{item.kode}</Text>
                    <Text style={s.baganNama}>{item.nama}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  query.length > 0
                    ? <Text style={s.emptyText}>Tidak ada hasil untuk "{query}"</Text>
                    : <Text style={s.emptyText}>Tidak ada bagan akun tersedia</Text>
                }
              />
          }
        </View>
      </View>
    </Modal>
  );
};

// ─── Period picker modal ──────────────────────────────────────────────────────
interface PeriodModalProps {
  visible: boolean;
  bulan: string;
  tahun: number;
  onClose: () => void;
  onApply: (bulan: string, tahun: number) => void;
}
const PeriodModal: React.FC<PeriodModalProps> = ({ visible, bulan, tahun, onClose, onApply }) => {
  const [selBulan, setSelBulan] = useState(bulan);
  const [selTahun, setSelTahun] = useState(tahun);

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.periodModal}>
          <View style={s.searchModalHeader}>
            <Text style={s.searchModalTitle}>Pilih Periode</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <Text style={s.periodLabel}>Tahun</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[s.chip, selTahun === y && s.chipActive]}
                onPress={() => setSelTahun(y)}
              >
                <Text style={[s.chipText, selTahun === y && s.chipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.periodLabel}>Bulan</Text>
          <View style={s.monthGrid}>
            {MONTHS.map(m => (
              <TouchableOpacity
                key={m}
                style={[s.monthChip, selBulan === m && s.chipActive]}
                onPress={() => setSelBulan(m)}
              >
                <Text style={[s.chipText, selBulan === m && s.chipTextActive]}>
                  {m.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.applyButton} onPress={() => { onApply(selBulan, selTahun); onClose(); }}>
            <Text style={s.applyButtonText}>Terapkan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MutasiAkunScreen() {
  const navigation = useNavigation();
  const now = new Date();

  const [kodeBaganAkun, setKodeBaganAkun] = useState('');
  const [namaBaganAkun, setNamaBaganAkun] = useState('');
  const [bulan, setBulan] = useState(MONTHS[now.getMonth()]);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [items, setItems] = useState<TransaksiItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showBaganModal, setShowBaganModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showWDModal, setShowWDModal] = useState(false);
  const [selectedWD, setSelectedWD] = useState<any>(null);

  const getData = async (b: string, t: number, kode: string) => {
    if (!kode) { Alert.alert('Info', 'Pilih bagan akun terlebih dahulu.'); return; }
    try {
      setIsLoading(true);
      setItems([]);
      setSaldoAwal(0);
      setLoadingMsg('Memuat saldo awal...');

      const token = await getTokenAuth();
      const headers = { Authorization: `Bearer ${token}` };
      const mBulan = monthIndex(b);

      const [resSaldo, resTrx] = await Promise.all([
        fetch(`${API_BASE_URL}/get/saldoawal/${kode}/${mBulan}/${t}`, { headers }),
        fetch(`${API_BASE_URL}/get/transaksi/${kode}/${mBulan}/${t}`, { headers }),
      ]);

      setLoadingMsg('Memproses data...');
      const saldoData = await resSaldo.json();
      const trxData = await resTrx.json();

      const initSaldo = parseFloat(saldoData.data || '0');
      setSaldoAwal(initSaldo);

      if (trxData.status) {
        let running = initSaldo;
        let rows: any[] = trxData.data.filter((r: any) => r.kredit || r.debit);
        rows = groupWD(rows);
        rows.sort((a: any, b: any) =>
          new Date(a.tanggal.replace(' ', 'T')).getTime() -
          new Date(b.tanggal.replace(' ', 'T')).getTime()
        );
        const mapped: TransaksiItem[] = rows.map((r: any) => {
          running += (r.debit || 0) - (r.kredit || 0);
          return {
            tanggal: r.tanggal,
            id: r.id,
            keterangan: r.keterangan || '',
            debit: r.debit || 0,
            kredit: r.kredit || 0,
            saldo: running,
            isGrouped: r.isGrouped,
            originalIds: r.originalIds,
          };
        });
        setItems(mapped);
      } else {
        Alert.alert('Error', trxData.reason || 'Gagal memuat data transaksi.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat data.');
    } finally {
      setIsLoading(false);
      setLoadingMsg('');
    }
  };

  const handleSelectAkun = (item: BaganAkun) => {
    setKodeBaganAkun(item.kode);
    setNamaBaganAkun(item.nama);
    getData(bulan, tahun, item.kode);
  };

  const handleApplyPeriod = (b: string, t: number) => {
    setBulan(b);
    setTahun(t);
    if (kodeBaganAkun) getData(b, t, kodeBaganAkun);
  };

  const totalDebit = items.reduce((a, i) => a + i.debit, 0);
  const totalKredit = items.reduce((a, i) => a + i.kredit, 0);

  const handleIdClick = (item: TransaksiItem) => {
    if (item.isGrouped && item.id.toString().startsWith('WD/')) {
      setSelectedWD(item);
      setShowWDModal(true);
      return;
    }

    if (!item.id) return;
    const idString = item.id.toString();
    const parts = idString.split('/');
    if (parts.length < 2) return;

    const type = parts[0];
    const id = parts[1];

    switch (type) {
      case 'JURNAL':
      case 'JNL':
        navigation.navigate('JurnalSearch' as never);
        break;
      case 'PB':
      case 'KONTAN.PB':
      case 'VALAS.PB':
      case 'RMPB':
        navigation.navigate('PembelianRincian' as never, { id: parseInt(id, 10) } as never);
        break;
      case 'PJ':
      case 'KONTAN.PJ':
        navigation.navigate('PenjualanRincian' as never, { id: parseInt(id, 10) } as never);
        break;
      case 'PELUNASAN.PB':
      case 'P.HUTANG':
        navigation.navigate('PembelianPelunasan' as never);
        break;
      case 'PELUNASAN.PJ':
      case 'P.PIUTANG':
        navigation.navigate('PenjualanPelunasan' as never);
        break;
      case 'DP.PB':
      case 'VALAS.DP':
        navigation.navigate('PembelianDPBeli' as never);
        break;
      case 'RETUR.PB':
      case 'RPB':
        navigation.navigate('PembelianRetur' as never);
        break;
      case 'RETUR.PJ':
      case 'RPJ':
        navigation.navigate('PenjualanRetur' as never);
        break;
      case 'STOK.OPNAME':
      case 'STOKOP':
        navigation.navigate('StokOpname' as never);
        break;
      case 'RO':
        navigation.navigate('ReturOnline' as never);
        break;
      default:
        break;
    }
  };

  const renderItem = ({ item }: { item: TransaksiItem }) => (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.rowDate}>{formatDate(item.tanggal)}</Text>
        <TouchableOpacity style={[s.idBadge, item.isGrouped && s.idBadgeGrouped]} onPress={() => handleIdClick(item)}>
          {item.isGrouped && (
            <Text style={s.groupedTag}>GROUP</Text>
          )}
          <Text style={[s.idText, (item.isGrouped || item.id.includes('/')) && { color: '#3B82F6', textDecorationLine: 'underline' }]} numberOfLines={1}>
            {item.id}
          </Text>
        </TouchableOpacity>
      </View>
      {item.keterangan ? (
        <Text style={s.rowKeterangan} numberOfLines={2}>{item.keterangan}</Text>
      ) : null}
      <View style={s.rowAmounts}>
        <View style={s.amountCol}>
          <Text style={s.amountLabel}>Debit</Text>
          <Text style={[s.amountValue, item.debit > 0 && s.debitColor]}>
            {item.debit > 0 ? currency(item.debit) : '-'}
          </Text>
        </View>
        <View style={s.amountCol}>
          <Text style={s.amountLabel}>Kredit</Text>
          <Text style={[s.amountValue, item.kredit > 0 && s.kreditColor]}>
            {item.kredit > 0 ? currency(item.kredit) : '-'}
          </Text>
        </View>
        <View style={[s.amountCol, { alignItems: 'flex-end' }]}>
          <Text style={s.amountLabel}>Saldo</Text>
          <Text style={[s.amountValue, s.saldoColor]}>{currency(item.saldo)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.hamburger} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Mutasi Akun</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Control panel */}
      <View style={s.panel}>
        {/* Akun selector */}
        <TouchableOpacity style={s.akunSelector} onPress={() => setShowBaganModal(true)}>
          <Ionicons name="calculator-outline" size={20} color="#f59e0b" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.akunSelectorLabel}>Bagan Akun</Text>
            <Text style={s.akunSelectorValue} numberOfLines={1}>
              {kodeBaganAkun ? `${kodeBaganAkun} — ${namaBaganAkun}` : 'Pilih akun...'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Period + Search button */}
        <View style={s.controlRow}>
          <TouchableOpacity style={s.periodButton} onPress={() => setShowPeriodModal(true)}>
            <Ionicons name="calendar-outline" size={18} color="#374151" />
            <Text style={s.periodButtonText}>{bulan.substring(0, 3)} {tahun}</Text>
            <Ionicons name="chevron-down" size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.cariButton, !kodeBaganAkun && { opacity: 0.5 }]}
            onPress={() => getData(bulan, tahun, kodeBaganAkun)}
            disabled={!kodeBaganAkun || isLoading}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={s.cariButtonText}>Cari</Text>
          </TouchableOpacity>
        </View>

        {/* Saldo awal info */}
        {(kodeBaganAkun && !isLoading) && (
          <View style={s.saldoRow}>
            <Text style={s.saldoLabel}>Saldo Awal Periode</Text>
            <Text style={s.saldoValue}>Rp {currency(saldoAwal)}</Text>
          </View>
        )}
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={s.loadingText}>{loadingMsg || 'Memuat data...'}</Text>
        </View>
      )}

      {/* List */}
      {!isLoading && (
        <>
          {items.length > 0 && (
            <View style={s.summary}>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Total Debit</Text>
                <Text style={[s.summaryValue, s.debitColor]}>Rp {currency(totalDebit)}</Text>
              </View>
              <View style={s.summarySep} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Total Kredit</Text>
                <Text style={[s.summaryValue, s.kreditColor]}>Rp {currency(totalKredit)}</Text>
              </View>
              <View style={s.summarySep} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Transaksi</Text>
                <Text style={s.summaryValue}>{items.length}</Text>
              </View>
            </View>
          )}
          <FlatList
            data={items}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Ionicons name="swap-horizontal-outline" size={64} color="#D1D5DB" />
                <Text style={s.emptyTitle}>
                  {kodeBaganAkun ? 'Tidak ada transaksi' : 'Pilih bagan akun'}
                </Text>
                <Text style={s.emptySubtitle}>
                  {kodeBaganAkun
                    ? `Tidak ada mutasi pada ${bulan} ${tahun}`
                    : 'Tekan tombol "Pilih akun" di atas untuk mulai'}
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* Modals */}
      <BaganAkunModal
        visible={showBaganModal}
        onClose={() => setShowBaganModal(false)}
        onSelect={handleSelectAkun}
      />
      <PeriodModal
        visible={showPeriodModal}
        bulan={bulan}
        tahun={tahun}
        onClose={() => setShowPeriodModal(false)}
        onApply={handleApplyPeriod}
      />
      <WDDetailModal
        visible={showWDModal}
        onClose={() => setShowWDModal(false)}
        groupedTransaction={selectedWD}
        kodeBaganAkun={kodeBaganAkun}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  hamburger: { padding: 4 },
  topTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  // Control panel
  panel: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  akunSelector: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#FCD34D', borderRadius: 10,
    backgroundColor: '#FFFBEB', padding: 12, marginBottom: 10,
  },
  akunSelectorLabel: { fontSize: 11, color: '#92400E', fontWeight: '600' },
  akunSelectorValue: { fontSize: 14, color: '#78350F', marginTop: 1, fontWeight: '500' },

  controlRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  periodButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', flex: 1,
  },
  periodButtonText: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },

  cariButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f59e0b', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  cariButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  saldoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  saldoLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  saldoValue: { fontSize: 14, color: '#111827', fontWeight: '700' },

  // Loading
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },

  // Summary bar
  summary: {
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, borderRadius: 10,
    padding: 12, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  summarySep: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 4 },

  // List
  listContent: { padding: 16, paddingTop: 8 },

  // Row card
  row: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowDate: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  idBadge: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: 4 },
  idBadgeGrouped: {},
  groupedTag: {
    fontSize: 9, fontWeight: '700', color: '#fff',
    backgroundColor: '#7C3AED', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  idText: { fontSize: 12, fontWeight: '600', color: '#3B82F6', maxWidth: 160 },
  rowKeterangan: { fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 18 },
  rowAmounts: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8,
  },
  amountCol: { flex: 1 },
  amountLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  amountValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  debitColor: { color: '#059669' },
  kreditColor: { color: '#DC2626' },
  saldoColor: { color: '#1D4ED8' },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },

  // Overlay & modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  searchModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  periodModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  searchModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  searchModalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 10,
    marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 0 },
  baganItem: {
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  baganKode: { fontSize: 14, fontWeight: '700', color: '#f59e0b', minWidth: 60 },
  baganNama: { fontSize: 14, color: '#374151', flex: 1 },
  emptyText: { textAlign: 'center', padding: 24, color: '#9CA3AF', fontSize: 14 },

  // Period modal
  periodLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', marginRight: 8, backgroundColor: '#fff',
  },
  chipActive: { borderColor: '#f59e0b', backgroundColor: '#FEF3C7' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#92400E' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  monthChip: {
    width: '22%', alignItems: 'center', paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff',
  },
  applyButton: {
    backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  applyButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
