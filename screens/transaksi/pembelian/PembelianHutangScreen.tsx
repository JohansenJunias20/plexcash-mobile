import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, DrawerActions, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import ApiService from '../../../services/api';

export interface PembelianHutangItem {
  id: number;
  tanggal: string;
  id_supplier: number;
  nama_supplier: string;
  online_id: number | null;
  online_platform: string | null;
  total: number | string;
  BAYAR: number | string;
  bayarkontan: number | string;
  tgl_jatuh_tempo: string | null;
}

export interface SupplierWithHutang {
  id_supplier: number;
  nama_supplier: string;
  total_sisa_hutang: number | string;
}

export interface HistoryPelunasanItem {
  tanggal: string;
  kodeBA: string | null;
  keterangan: string | null;
  saldo: number | string;
}

type PembelianHutangRouteProp = RouteProp<
  { PembelianHutang: { detailId?: number } },
  'PembelianHutang'
>;

export default function PembelianHutangScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<PembelianHutangRouteProp>();

  // Filter States
  const [statusFilter, setStatusFilter] = useState<'all' | 'lunas' | 'belum_lunas'>('belum_lunas');
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithHutang | null>(null);
  const [dateStart, setDateStart] = useState<string>(
    moment().subtract(30, 'days').format('YYYY-MM-DD')
  );
  const [dateEnd, setDateEnd] = useState<string>(moment().format('YYYY-MM-DD'));
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'custom'>('30days');

  // Date Pickers State
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRows, setTotalRows] = useState<number>(0);

  // Data States
  const [hutangList, setHutangList] = useState<PembelianHutangItem[]>([]);
  const [supplierList, setSupplierList] = useState<SupplierWithHutang[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Bulk Selection Mode (Active when selectedSupplier !== null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modals State
  const [supplierModalVisible, setSupplierModalVisible] = useState<boolean>(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>('');

  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<PembelianHutangItem | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<HistoryPelunasanItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Due Date Edit inside Modal
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null);
  const [showDueDateModalPicker, setShowDueDateModalPicker] = useState<boolean>(false);
  const [updatingDueDate, setUpdatingDueDate] = useState<boolean>(false);

  // Helper Calculations
  const getTerbayar = (item: PembelianHutangItem): number => {
    const bayar = parseFloat(String(item.BAYAR || 0));
    const bayarkontan = parseFloat(String(item.bayarkontan || 0));
    return (isNaN(bayar) ? 0 : bayar) + (isNaN(bayarkontan) ? 0 : bayarkontan);
  };

  const getSisaHutang = (item: PembelianHutangItem): number => {
    const total = parseFloat(String(item.total || 0));
    const totalNum = isNaN(total) ? 0 : total;
    return totalNum - getTerbayar(item);
  };

  const getStatusBadge = (item: PembelianHutangItem) => {
    const sisa = getSisaHutang(item);
    if (sisa <= 0) {
      return { status: 'LUNAS', color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7' };
    }
    if (item.tgl_jatuh_tempo) {
      const isDue = moment(item.tgl_jatuh_tempo, 'YYYY-MM-DD').startOf('day').isSameOrBefore(moment().startOf('day'));
      if (isDue) {
        return { status: 'JATUH TEMPO', color: '#EF4444', bg: '#FEE2E2', border: '#FCA5A5' };
      }
    }
    return { status: 'BELUM LUNAS', color: '#F59E0B', bg: '#FEF3C7', border: '#FDE68A' };
  };

  const getUmurHutangText = (tgl_jatuh_tempo: string | null) => {
    if (!tgl_jatuh_tempo) return { text: '-', isOverdue: false };
    const selisihHari = moment().startOf('day').diff(moment(tgl_jatuh_tempo, 'YYYY-MM-DD').startOf('day'), 'days');
    if (selisihHari > 0) {
      return { text: `${selisihHari} hari (Terlambat)`, isOverdue: true };
    }
    if (selisihHari === 0) {
      return { text: 'Hari ini', isOverdue: false };
    }
    return { text: `${Math.abs(selisihHari)} hari lagi`, isOverdue: false };
  };

  const formatRupiah = (val: number | string) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
    if (isNaN(num)) return 'Rp 0';
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  };

  // Header Summaries
  const totalHutangBelumLunas = hutangList.reduce((acc, item) => {
    const sisa = getSisaHutang(item);
    return acc + (sisa > 0 ? sisa : 0);
  }, 0);

  const totalTerbayar = hutangList.reduce((acc, item) => {
    return acc + getTerbayar(item);
  }, 0);

  const totalSisaHutangTerpilih = hutangList.reduce((acc, item) => {
    if (selectedIds.has(item.id)) {
      return acc + getSisaHutang(item);
    }
    return acc;
  }, 0);

  // Load Supplier List with Debt
  const fetchSuppliers = async () => {
    try {
      const res = await ApiService.getHutangSuppliers();
      if (res.status && res.data) {
        setSupplierList(res.data);
      }
    } catch (error) {
      console.error('Error fetching suppliers with debt:', error);
    }
  };

  // Load Main Hutang List
  const fetchHutangList = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const params: any = {
          status: statusFilter,
          dateStart,
          dateEnd,
          page: currentPage,
          pageSize,
          sortBy: 'tanggal',
          sortOrder: 'DESC',
        };
        if (selectedSupplier) {
          params.id_supplier = selectedSupplier.id_supplier;
        }

        const res = await ApiService.getHutangList(params);
        if (res.status && res.data) {
          setHutangList(res.data);
          if (res.pagination) {
            setTotalPages(res.pagination.totalPages || 1);
            setTotalRows(res.pagination.totalRows || res.data.length);
          }
        } else {
          setHutangList([]);
        }
      } catch (error) {
        console.error('Error loading hutang data:', error);
        Alert.alert('Error', 'Gagal memuat data hutang');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, selectedSupplier, dateStart, dateEnd, currentPage, pageSize]
  );

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchHutangList();
  }, [fetchHutangList]);

  // Deep Link Handling
  useEffect(() => {
    const detailId = route.params?.detailId;
    if (detailId && hutangList.length > 0) {
      const item = hutangList.find((i) => i.id === Number(detailId));
      if (item) {
        openDetailModal(item);
      }
    }
  }, [route.params?.detailId, hutangList]);

  // Reset page when filter changes
  const handleStatusFilterChange = (status: 'all' | 'lunas' | 'belum_lunas') => {
    setStatusFilter(status);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const handleSupplierSelect = (supplier: SupplierWithHutang | null) => {
    setSelectedSupplier(supplier);
    setSupplierModalVisible(false);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const applyDatePreset = (preset: 'today' | '7days' | '30days' | 'thisMonth') => {
    setDatePreset(preset);
    setCurrentPage(1);
    let start = moment();
    const end = moment().format('YYYY-MM-DD');

    if (preset === 'today') {
      start = moment();
    } else if (preset === '7days') {
      start = moment().subtract(7, 'days');
    } else if (preset === '30days') {
      start = moment().subtract(30, 'days');
    } else if (preset === 'thisMonth') {
      start = moment().startOf('month');
    }

    setDateStart(start.format('YYYY-MM-DD'));
    setDateEnd(end);
  };

  // Selection toggle
  const toggleSelectId = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === hutangList.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(hutangList.map((item) => item.id));
      setSelectedIds(allIds);
    }
  };

  // Bulk Action
  const handleLunasiTerpilih = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('Peringatan', 'Pilih minimal satu nota untuk dilunasi.');
      return;
    }
    if (!selectedSupplier) {
      Alert.alert('Peringatan', 'Supplier harus dipilih untuk pelunasan massal.');
      return;
    }

    const idsArray = Array.from(selectedIds);
    try {
      setLoading(true);
      const res = await ApiService.lunasiHutangTerpilih(idsArray, selectedSupplier.id_supplier);
      if (res.status) {
        Alert.alert('Sukses', 'Nota terpilih siap dilunasi.', [
          {
            text: 'Lanjutkan',
            onPress: () => {
              navigation.navigate('PembelianPelunasan', {
                ids: idsArray.join(','),
                id_supplier: selectedSupplier.id_supplier,
              });
            },
          },
        ]);
      } else {
        Alert.alert('Gagal', res.reason || 'Gagal memproses pelunasan terpilih');
      }
    } catch (error) {
      console.error('Error settling selected:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memproses pelunasan massal.');
    } finally {
      setLoading(false);
    }
  };

  // Detail Modal & History
  const openDetailModal = async (item: PembelianHutangItem) => {
    setSelectedItemForDetail(item);
    setEditingDueDate(item.tgl_jatuh_tempo);
    setDetailModalVisible(true);
    setLoadingHistory(true);
    try {
      const res = await ApiService.getDetailPelunasanHutang(item.id);
      if (res.status && res.data) {
        setPaymentHistory(res.data);
      } else {
        setPaymentHistory([]);
      }
    } catch (error) {
      console.error('Error loading payment history:', error);
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Save updated due date
  const handleSaveDueDate = async () => {
    if (!selectedItemForDetail || !editingDueDate) return;
    try {
      setUpdatingDueDate(true);
      const res = await ApiService.updateJatuhTempo(selectedItemForDetail.id, editingDueDate);
      if (res.status) {
        Alert.alert('Sukses', 'Tanggal jatuh tempo berhasil diperbarui.');
        // Update local item
        setSelectedItemForDetail({
          ...selectedItemForDetail,
          tgl_jatuh_tempo: editingDueDate,
        });
        fetchHutangList();
      } else {
        Alert.alert('Gagal', res.reason || 'Gagal memperbarui tanggal jatuh tempo');
      }
    } catch (error) {
      console.error('Error updating due date:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memperbarui tanggal jatuh tempo.');
    } finally {
      setUpdatingDueDate(false);
    }
  };

  const filteredSuppliers = supplierList.filter((s) =>
    s.nama_supplier.toLowerCase().includes(supplierSearchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.drawerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hutang (Accounts Payable)</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchHutangList(true)}>
          <Ionicons name="refresh" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchHutangList(true)} />
        }
      >
        {/* Summary Cards Header */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.summaryCardRed]}>
            <View style={styles.summaryCardHeader}>
              <Ionicons name="wallet-outline" size={20} color="#DC2626" />
              <Text style={styles.summaryCardTitle}>Total Belum Lunas</Text>
            </View>
            <Text style={styles.summaryCardValueRed}>
              {formatRupiah(totalHutangBelumLunas)}
            </Text>
          </View>

          <View style={[styles.summaryCard, styles.summaryCardGreen]}>
            <View style={styles.summaryCardHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#059669" />
              <Text style={styles.summaryCardTitle}>Total Terbayar</Text>
            </View>
            <Text style={styles.summaryCardValueGreen}>
              {formatRupiah(totalTerbayar)}
            </Text>
          </View>
        </View>

        {/* Filter Section */}
        <View style={styles.filterSection}>
          {/* Status Chips */}
          <Text style={styles.filterLabel}>Status Pembayaran</Text>
          <View style={styles.chipContainer}>
            <TouchableOpacity
              style={[styles.chip, statusFilter === 'belum_lunas' && styles.chipActive]}
              onPress={() => handleStatusFilterChange('belum_lunas')}
            >
              <Text
                style={[
                  styles.chipText,
                  statusFilter === 'belum_lunas' && styles.chipTextActive,
                ]}
              >
                Belum Lunas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, statusFilter === 'lunas' && styles.chipActive]}
              onPress={() => handleStatusFilterChange('lunas')}
            >
              <Text
                style={[styles.chipText, statusFilter === 'lunas' && styles.chipTextActive]}
              >
                Lunas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, statusFilter === 'all' && styles.chipActive]}
              onPress={() => handleStatusFilterChange('all')}
            >
              <Text style={[styles.chipText, statusFilter === 'all' && styles.chipTextActive]}>
                Semua
              </Text>
            </TouchableOpacity>
          </View>

          {/* Supplier Selector */}
          <Text style={styles.filterLabel}>Filter Supplier</Text>
          <TouchableOpacity
            style={styles.supplierSelector}
            onPress={() => setSupplierModalVisible(true)}
          >
            <Ionicons name="business-outline" size={20} color="#4B5563" />
            <Text style={styles.supplierSelectorText}>
              {selectedSupplier ? selectedSupplier.nama_supplier : 'Semua Supplier'}
            </Text>
            {selectedSupplier ? (
              <TouchableOpacity
                onPress={() => handleSupplierSelect(null)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            )}
          </TouchableOpacity>

          {/* Date Presets & Date Inputs */}
          <Text style={styles.filterLabel}>Rentang Tanggal Nota</Text>
          <View style={styles.presetContainer}>
            <TouchableOpacity
              style={[styles.presetButton, datePreset === 'today' && styles.presetButtonActive]}
              onPress={() => applyDatePreset('today')}
            >
              <Text
                style={[
                  styles.presetText,
                  datePreset === 'today' && styles.presetTextActive,
                ]}
              >
                Hari Ini
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetButton, datePreset === '7days' && styles.presetButtonActive]}
              onPress={() => applyDatePreset('7days')}
            >
              <Text
                style={[
                  styles.presetText,
                  datePreset === '7days' && styles.presetTextActive,
                ]}
              >
                7 Hari
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.presetButton,
                datePreset === '30days' && styles.presetButtonActive,
              ]}
              onPress={() => applyDatePreset('30days')}
            >
              <Text
                style={[
                  styles.presetText,
                  datePreset === '30days' && styles.presetTextActive,
                ]}
              >
                30 Hari
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.presetButton,
                datePreset === 'thisMonth' && styles.presetButtonActive,
              ]}
              onPress={() => applyDatePreset('thisMonth')}
            >
              <Text
                style={[
                  styles.presetText,
                  datePreset === 'thisMonth' && styles.presetTextActive,
                ]}
              >
                Bulan Ini
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Date Inputs */}
          <View style={styles.dateInputsRow}>
            <TouchableOpacity
              style={styles.dateInputBox}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <Text style={styles.dateInputText}>{dateStart}</Text>
            </TouchableOpacity>
            <Text style={{ marginHorizontal: 8, color: '#6B7280' }}>s/d</Text>
            <TouchableOpacity
              style={styles.dateInputBox}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <Text style={styles.dateInputText}>{dateEnd}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Pickers Modals for Android/iOS */}
        {showStartDatePicker && (
          <DateTimePicker
            value={moment(dateStart, 'YYYY-MM-DD').toDate()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowStartDatePicker(Platform.OS === 'ios');
              if (date) {
                setDateStart(moment(date).format('YYYY-MM-DD'));
                setDatePreset('custom');
                setCurrentPage(1);
              }
            }}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            value={moment(dateEnd, 'YYYY-MM-DD').toDate()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowEndDatePicker(Platform.OS === 'ios');
              if (date) {
                setDateEnd(moment(date).format('YYYY-MM-DD'));
                setDatePreset('custom');
                setCurrentPage(1);
              }
            }}
          />
        )}

        {/* List Header / Bulk Select All Bar */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listCountText}>
            Menampilkan {hutangList.length} dari {totalRows} nota
          </Text>
          {selectedSupplier && hutangList.length > 0 && (
            <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
              <Ionicons
                name={
                  selectedIds.size === hutangList.length
                    ? 'checkbox'
                    : 'square-outline'
                }
                size={18}
                color="#059669"
              />
              <Text style={styles.selectAllText}>Pilih Semua</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text style={styles.loadingText}>Memuat data hutang...</Text>
          </View>
        ) : hutangList.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Tidak ada data hutang ditemukan</Text>
          </View>
        ) : (
          /* Cards List */
          hutangList.map((item) => {
            const badge = getStatusBadge(item);
            const terbayar = getTerbayar(item);
            const sisa = getSisaHutang(item);
            const umur = getUmurHutangText(item.tgl_jatuh_tempo);
            const isSelected = selectedIds.has(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => {
                  if (selectedSupplier) {
                    toggleSelectId(item.id);
                  } else {
                    openDetailModal(item);
                  }
                }}
                activeOpacity={0.8}
              >
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    {selectedSupplier && (
                      <TouchableOpacity
                        style={{ marginRight: 8 }}
                        onPress={() => toggleSelectId(item.id)}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? '#059669' : '#9CA3AF'}
                        />
                      </TouchableOpacity>
                    )}
                    <Text style={styles.cardNotaId}>#{item.id}</Text>
                  </View>

                  <View style={styles.badgesRow}>
                    {/* Badge Tipe Online/Offline */}
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {item.online_id !== null
                          ? `🌐 Online ${item.online_platform ? `(${item.online_platform})` : ''}`
                          : '🏪 Offline'}
                      </Text>
                    </View>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: badge.bg, borderColor: badge.border },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Card Body */}
                <View style={styles.cardBody}>
                  <Text style={styles.supplierName}>{item.nama_supplier}</Text>
                  <Text style={styles.cardDate}>
                    Tanggal: {moment(item.tanggal).format('DD/MM/YYYY HH:mm')}
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.amountGrid}>
                    <View style={styles.amountCol}>
                      <Text style={styles.amountLabel}>Total Nota</Text>
                      <Text style={styles.amountValue}>{formatRupiah(item.total)}</Text>
                    </View>
                    <View style={styles.amountCol}>
                      <Text style={styles.amountLabel}>Terbayar</Text>
                      <Text style={styles.amountValueGreen}>{formatRupiah(terbayar)}</Text>
                    </View>
                    <View style={styles.amountCol}>
                      <Text style={styles.amountLabel}>Sisa Hutang</Text>
                      <Text style={[styles.amountValueRed, sisa <= 0 && { color: '#10B981' }]}>
                        {formatRupiah(sisa)}
                      </Text>
                    </View>
                  </View>

                  {/* Umur Hutang */}
                  <View style={styles.dueRow}>
                    <Text style={styles.dueLabel}>Jatuh Tempo: </Text>
                    <Text style={styles.dueValue}>
                      {item.tgl_jatuh_tempo
                        ? moment(item.tgl_jatuh_tempo).format('DD/MM/YYYY')
                        : '-'}
                    </Text>
                    <Text style={{ marginHorizontal: 4, color: '#9CA3AF' }}>|</Text>
                    <Text
                      style={[
                        styles.dueText,
                        umur.isOverdue && styles.dueTextOverdue,
                      ]}
                    >
                      {umur.text}
                    </Text>
                  </View>
                </View>

                {/* Card Footer */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.detailButton}
                    onPress={() => openDetailModal(item)}
                  >
                    <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
                    <Text style={styles.detailButtonText}>Detail & Riwayat</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.pageButton, currentPage <= 1 && styles.pageButtonDisabled]}
              disabled={currentPage <= 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <Ionicons name="chevron-back" size={18} color={currentPage <= 1 ? '#9CA3AF' : '#1F2937'} />
              <Text style={[styles.pageButtonText, currentPage <= 1 && { color: '#9CA3AF' }]}>
                Sebelumnya
              </Text>
            </TouchableOpacity>

            <Text style={styles.pageInfoText}>
              Hal {currentPage} / {totalPages}
            </Text>

            <TouchableOpacity
              style={[
                styles.pageButton,
                currentPage >= totalPages && styles.pageButtonDisabled,
              ]}
              disabled={currentPage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  currentPage >= totalPages && { color: '#9CA3AF' },
                ]}
              >
                Selanjutnya
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={currentPage >= totalPages ? '#9CA3AF' : '#1F2937'}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Selection Bar (Bulk Action) */}
      {selectedSupplier && selectedIds.size > 0 && (
        <View style={styles.floatingBar}>
          <View style={styles.floatingBarTextCol}>
            <Text style={styles.floatingBarTitle}>
              {selectedIds.size} Nota Dipilih
            </Text>
            <Text style={styles.floatingBarSub}>
              Total: {formatRupiah(totalSisaHutangTerpilih)}
            </Text>
          </View>
          <TouchableOpacity style={styles.bulkPayButton} onPress={handleLunasiTerpilih}>
            <Ionicons name="cash" size={20} color="#FFF" />
            <Text style={styles.bulkPayButtonText}>Lunasi Terpilih</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Supplier Modal Selector */}
      <Modal
        visible={supplierModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSupplierModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Pilih Supplier</Text>
              <TouchableOpacity onPress={() => setSupplierModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama supplier..."
                placeholderTextColor="#9CA3AF"
                value={supplierSearchQuery}
                onChangeText={setSupplierSearchQuery}
              />
            </View>

            {/* Option to clear supplier filter */}
            <TouchableOpacity
              style={styles.supplierItemOption}
              onPress={() => handleSupplierSelect(null)}
            >
              <View>
                <Text style={styles.supplierItemName}>Semua Supplier</Text>
                <Text style={styles.supplierItemSub}>Menampilkan semua transaksi</Text>
              </View>
              {!selectedSupplier && <Ionicons name="checkmark" size={20} color="#059669" />}
            </TouchableOpacity>

            <ScrollView style={{ maxHeight: 400 }}>
              {filteredSuppliers.map((s) => {
                const isSelected = selectedSupplier?.id_supplier === s.id_supplier;
                return (
                  <TouchableOpacity
                    key={s.id_supplier}
                    style={[styles.supplierItemOption, isSelected && styles.supplierItemOptionSelected]}
                    onPress={() => handleSupplierSelect(s)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.supplierItemName}>{s.nama_supplier}</Text>
                      <Text style={styles.supplierItemSub}>
                        Sisa Hutang: {formatRupiah(s.total_sisa_hutang)}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#059669" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail & History Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        {selectedItemForDetail && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>
                  Detail Nota #{selectedItemForDetail.id}
                </Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 16 }}>
                {/* Rincian Nota Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Rincian Transaksi</Text>

                  <View style={styles.detailGrid}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Supplier:</Text>
                      <Text style={styles.detailValueBold}>
                        {selectedItemForDetail.nama_supplier}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tanggal Transaksi:</Text>
                      <Text style={styles.detailValue}>
                        {moment(selectedItemForDetail.tanggal).format('DD/MM/YYYY HH:mm')}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tipe Transaksi:</Text>
                      <Text style={styles.detailValue}>
                        {selectedItemForDetail.online_id !== null
                          ? `🌐 Online (${selectedItemForDetail.online_platform || 'E-Commerce'})`
                          : '🏪 Offline'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Total Purchase:</Text>
                      <Text style={styles.detailValueBold}>
                        {formatRupiah(selectedItemForDetail.total)}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Total Terbayar:</Text>
                      <Text style={[styles.detailValueBold, { color: '#059669' }]}>
                        {formatRupiah(getTerbayar(selectedItemForDetail))}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sisa Hutang:</Text>
                      <Text style={[styles.detailValueBold, { color: '#DC2626' }]}>
                        {formatRupiah(getSisaHutang(selectedItemForDetail))}
                      </Text>
                    </View>
                  </View>

                  {/* Inline DatePicker for Tanggal Jatuh Tempo */}
                  <View style={styles.dueDateEditBox}>
                    <Text style={styles.detailLabel}>Tanggal Jatuh Tempo:</Text>
                    <View style={styles.dueDateActionRow}>
                      <TouchableOpacity
                        style={styles.dueDateInput}
                        onPress={() => setShowDueDateModalPicker(true)}
                      >
                        <Ionicons name="calendar-outline" size={18} color="#4B5563" />
                        <Text style={styles.dueDateInputText}>
                          {editingDueDate
                            ? moment(editingDueDate).format('DD/MM/YYYY')
                            : 'Belum diatur'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.saveDueDateBtn}
                        onPress={handleSaveDueDate}
                        disabled={updatingDueDate}
                      >
                        {updatingDueDate ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.saveDueDateBtnText}>Simpan</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showDueDateModalPicker && (
                    <DateTimePicker
                      value={
                        editingDueDate
                          ? moment(editingDueDate, 'YYYY-MM-DD').toDate()
                          : new Date()
                      }
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        setShowDueDateModalPicker(Platform.OS === 'ios');
                        if (date) {
                          setEditingDueDate(moment(date).format('YYYY-MM-DD'));
                        }
                      }}
                    />
                  )}
                </View>

                {/* History Pelunasan Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Riwayat Pembayaran / Pelunasan</Text>

                  {loadingHistory ? (
                    <ActivityIndicator size="small" color="#F59E0B" style={{ marginVertical: 12 }} />
                  ) : paymentHistory.length === 0 ? (
                    <Text style={styles.noHistoryText}>Belum ada riwayat pembayaran</Text>
                  ) : (
                    <View style={styles.historyTable}>
                      <View style={styles.historyTableHeader}>
                        <Text style={[styles.historyCellHeader, { flex: 1.2 }]}>Tanggal</Text>
                        <Text style={[styles.historyCellHeader, { flex: 1 }]}>Kas/Bank</Text>
                        <Text style={[styles.historyCellHeader, { flex: 1.5 }]}>Keterangan</Text>
                        <Text style={[styles.historyCellHeader, { flex: 1.2, textAlign: 'right' }]}>
                          Nominal
                        </Text>
                      </View>

                      {paymentHistory.map((h, idx) => (
                        <View key={idx} style={styles.historyTableRow}>
                          <Text style={[styles.historyCell, { flex: 1.2 }]}>
                            {moment(h.tanggal).format('DD/MM/YY')}
                          </Text>
                          <Text style={[styles.historyCell, { flex: 1 }]}>
                            {h.kodeBA || '-'}
                          </Text>
                          <Text style={[styles.historyCell, { flex: 1.5 }]}>
                            {h.keterangan || '-'}
                          </Text>
                          <Text
                            style={[
                              styles.historyCell,
                              { flex: 1.2, textAlign: 'right', color: '#059669', fontWeight: '600' },
                            ]}
                          >
                            {formatRupiah(h.saldo)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Action Buttons Footer */}
              <View style={styles.modalFooterActions}>
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => {
                    setDetailModalVisible(false);
                    navigation.navigate('PembelianRincian', {
                      id: selectedItemForDetail.id,
                    });
                  }}
                >
                  <Ionicons name="document-text-outline" size={18} color="#0284C7" />
                  <Text style={styles.btnSecondaryText}>Rincian Pembelian</Text>
                </TouchableOpacity>

                {getSisaHutang(selectedItemForDetail) > 0 && (
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={() => {
                      setDetailModalVisible(false);
                      navigation.navigate('PembelianPelunasan', {
                        id_pembelian: selectedItemForDetail.id,
                        id_supplier: selectedItemForDetail.id_supplier,
                      });
                    }}
                  >
                    <Ionicons name="cash-outline" size={18} color="#FFF" />
                    <Text style={styles.btnPrimaryText}>Bayar / Lunasi</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  drawerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  refreshButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    marginHorizontal: 4,
  },
  summaryCardRed: {
    borderLeftColor: '#DC2626',
  },
  summaryCardGreen: {
    borderLeftColor: '#059669',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryCardTitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginLeft: 6,
  },
  summaryCardValueRed: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  summaryCardValueGreen: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  filterSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  chipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#D97706',
    fontWeight: '700',
  },
  supplierSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  supplierSelectorText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
    fontWeight: '500',
  },
  presetContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginRight: 6,
  },
  presetButtonActive: {
    backgroundColor: '#F59E0B',
  },
  presetText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#FFF',
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateInputText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 6,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listCountText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#9CA3AF',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSelected: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardNotaId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    marginBottom: 10,
  },
  supplierName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  cardDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  amountGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountCol: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  amountValueGreen: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  amountValueRed: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dueLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  dueValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  dueText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  dueTextOverdue: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginLeft: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pageButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginHorizontal: 4,
  },
  pageInfoText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  floatingBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingBarTextCol: {
    flex: 1,
  },
  floatingBarTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  floatingBarSub: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  bulkPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bulkPayButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    margin: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    marginLeft: 8,
    fontSize: 13,
    color: '#1F2937',
  },
  supplierItemOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  supplierItemOptionSelected: {
    backgroundColor: '#ECFDF5',
  },
  supplierItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  supplierItemSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
  },
  detailGrid: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 13,
    color: '#1F2937',
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  dueDateEditBox: {
    marginTop: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
  },
  dueDateActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dueDateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
  },
  dueDateInputText: {
    fontSize: 13,
    color: '#1F2937',
    marginLeft: 6,
  },
  saveDueDateBtn: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  saveDueDateBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noHistoryText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  historyTable: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  historyTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyCellHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
  },
  historyTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyCell: {
    fontSize: 11,
    color: '#4B5563',
  },
  modalFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
  },
  btnSecondaryText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});
