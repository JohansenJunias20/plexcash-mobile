import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import moment from 'moment';
import ApiService from '../../../services/api';

interface Karyawan {
  id: number;
  nama: string;
}

interface PaymentCalculation {
  karyawan_id: number;
  karyawan_nama: string;
  gaji_pokok: number;
  penalty: number;
  bonus: number;
  total: number;
  hari_kerja?: number;
  hari_hadir?: number;
  hari_terlambat?: number;
  sudah_dibayar?: boolean;
  tanggal_bayar?: string;
}

interface PaymentHistory {
  id: number;
  tipe_pembayaran: string;
  periode_awal: string;
  periode_akhir: string | null;
  total_amount: number;
  tanggal_bayar: string;
  jumlah_karyawan: number;
  nama_karyawan: string;
}

interface ChartOfAccount {
  kode: string;
  nama: string;
}

export default function BayarGajiScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<'harian' | 'bulanan' | 'bonus' | 'riwayat'>('harian');

  // Master lists
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [coaList, setCoaList] = useState<ChartOfAccount[]>([]);
  const [historyList, setHistoryList] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selected employees for each tab
  const [selectedKaryawanIds, setSelectedKaryawanIds] = useState<number[]>([]);
  const [karyawanPickerVisible, setKaryawanPickerVisible] = useState(false);

  // Daily tab states
  const [dailyStartDate, setDailyStartDate] = useState<Date>(moment().subtract(7, 'days').toDate());
  const [dailyEndDate, setDailyEndDate] = useState<Date>(moment().toDate());
  const [showDailyStartPicker, setShowDailyStartPicker] = useState(false);
  const [showDailyEndPicker, setShowDailyEndPicker] = useState(false);
  const [dailyCalculations, setDailyCalculations] = useState<PaymentCalculation[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Monthly tab states
  const [monthlyDate, setMonthlyDate] = useState<Date>(moment().toDate());
  const [showMonthlyPicker, setShowMonthlyPicker] = useState(false);
  const [monthlyCalculations, setMonthlyCalculations] = useState<PaymentCalculation[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Bonus tab states
  const [bonusType, setBonusType] = useState<'weekly' | 'monthly'>('weekly');
  const [bonusStartDate, setBonusStartDate] = useState<Date>(moment().subtract(7, 'days').toDate());
  const [bonusEndDate, setBonusEndDate] = useState<Date>(moment().toDate());
  const [showBonusStartPicker, setShowBonusStartPicker] = useState(false);
  const [showBonusEndPicker, setShowBonusEndPicker] = useState(false);
  const [bonusMonthDate, setBonusMonthDate] = useState<Date>(moment().toDate());
  const [showBonusMonthPicker, setShowBonusMonthPicker] = useState(false);
  const [bonusCalculations, setBonusCalculations] = useState<PaymentCalculation[]>([]);
  const [bonusLoading, setBonusLoading] = useState(false);

  // Payment dialog states
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>(moment().toDate());
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [selectedCoa, setSelectedCoa] = useState<string>('');
  const [paymentKeterangan, setPaymentKeterangan] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Initial load: fetch karyawan, CoA, history
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [karyawanRes, coaRes] = await Promise.all([
        ApiService.authenticatedRequest('/get/karyawan'),
        ApiService.authenticatedRequest('/get/baganakun/condition/and/kode_induk:equal:111'),
      ]);

      if (karyawanRes?.status && Array.isArray(karyawanRes.data)) {
        setKaryawanList(karyawanRes.data);
        // Default select all employees
        setSelectedKaryawanIds(karyawanRes.data.map((k: any) => k.id));
      }

      if (coaRes?.status && Array.isArray(coaRes.data)) {
        setCoaList(coaRes.data);
        if (coaRes.data.length > 0) {
          setSelectedCoa(coaRes.data[0].kode);
        }
      }
    } catch (e) {
      console.error('Error fetching initial bayar gaji data:', e);
    }
  };

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await ApiService.authenticatedRequest('/api/bayar-gaji/history');
      if (res?.status && Array.isArray(res.data)) {
        setHistoryList(res.data);
      }
    } catch (e) {
      console.error('Error fetching bayar gaji history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'riwayat') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Format currency
  const formatCurrency = (val?: number) => {
    return `Rp ${(val || 0).toLocaleString('id-ID')}`;
  };

  // Toggle single employee selection
  const toggleKaryawanSelect = (id: number) => {
    setSelectedKaryawanIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all or none
  const toggleSelectAllKaryawan = () => {
    if (selectedKaryawanIds.length === karyawanList.length) {
      setSelectedKaryawanIds([]);
    } else {
      setSelectedKaryawanIds(karyawanList.map((k) => k.id));
    }
  };

  // Calculate daily wage
  const handleCalculateDaily = async () => {
    if (selectedKaryawanIds.length === 0) {
      Alert.alert('Peringatan', 'Pilih minimal 1 karyawan');
      return;
    }

    try {
      setDailyLoading(true);
      const res = await ApiService.authenticatedRequest('/api/bayar-gaji/calculate-daily', {
        method: 'POST',
        body: JSON.stringify({
          karyawan_ids: selectedKaryawanIds,
          start_date: moment(dailyStartDate).format('YYYY-MM-DD'),
          end_date: moment(dailyEndDate).format('YYYY-MM-DD'),
        }),
      });

      if (res?.status) {
        setDailyCalculations(res.data || []);
        if ((res.data || []).length === 0) {
          Alert.alert('Info', 'Tidak ada data absensi untuk karyawan pada periode ini');
        }
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal menghitung gaji harian');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menghitung gaji');
    } finally {
      setDailyLoading(false);
    }
  };

  // Calculate monthly salary
  const handleCalculateMonthly = async () => {
    if (selectedKaryawanIds.length === 0) {
      Alert.alert('Peringatan', 'Pilih minimal 1 karyawan');
      return;
    }

    try {
      setMonthlyLoading(true);
      const res = await ApiService.authenticatedRequest('/api/bayar-gaji/calculate-monthly', {
        method: 'POST',
        body: JSON.stringify({
          karyawan_ids: selectedKaryawanIds,
          bulan: moment(monthlyDate).format('YYYY-MM'),
        }),
      });

      if (res?.status) {
        setMonthlyCalculations(res.data || []);
        if ((res.data || []).length === 0) {
          Alert.alert('Info', 'Tidak ada data gaji bulanan untuk karyawan yang dipilih');
        }
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal menghitung gaji bulanan');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menghitung gaji bulanan');
    } finally {
      setMonthlyLoading(false);
    }
  };

  // Calculate bonus
  const handleCalculateBonus = async () => {
    if (selectedKaryawanIds.length === 0) {
      Alert.alert('Peringatan', 'Pilih minimal 1 karyawan');
      return;
    }

    const periode =
      bonusType === 'weekly'
        ? {
            start_date: moment(bonusStartDate).format('YYYY-MM-DD'),
            end_date: moment(bonusEndDate).format('YYYY-MM-DD'),
          }
        : {
            bulan: moment(bonusMonthDate).format('YYYY-MM'),
          };

    try {
      setBonusLoading(true);
      const res = await ApiService.authenticatedRequest('/api/bayar-gaji/calculate-bonus', {
        method: 'POST',
        body: JSON.stringify({
          karyawan_ids: selectedKaryawanIds,
          bonus_type: bonusType,
          periode,
        }),
      });

      if (res?.status) {
        setBonusCalculations(res.data || []);
        if ((res.data || []).length === 0) {
          Alert.alert('Info', 'Tidak ada bonus yang memenuhi syarat');
        }
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal menghitung bonus');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menghitung bonus');
    } finally {
      setBonusLoading(false);
    }
  };

  // Process payment execution
  const handleProcessPayment = async () => {
    if (!selectedCoa) {
      Alert.alert('Validasi', 'Pilih akun pembayaran / kas-bank');
      return;
    }

    let tipe_pembayaran = '';
    let periode_awal = '';
    let periode_akhir: string | null = null;
    let details: PaymentCalculation[] = [];

    if (activeTab === 'harian') {
      tipe_pembayaran = 'harian';
      periode_awal = moment(dailyStartDate).format('YYYY-MM-DD');
      periode_akhir = moment(dailyEndDate).format('YYYY-MM-DD');
      details = dailyCalculations.filter((c) => !c.sudah_dibayar);
    } else if (activeTab === 'bulanan') {
      tipe_pembayaran = 'bulanan';
      periode_awal = moment(monthlyDate).startOf('month').format('YYYY-MM-DD');
      periode_akhir = moment(monthlyDate).endOf('month').format('YYYY-MM-DD');
      details = monthlyCalculations.filter((c) => !c.sudah_dibayar);
    } else if (activeTab === 'bonus') {
      tipe_pembayaran = 'bonus';
      if (bonusType === 'weekly') {
        periode_awal = moment(bonusStartDate).format('YYYY-MM-DD');
        periode_akhir = moment(bonusEndDate).format('YYYY-MM-DD');
      } else {
        periode_awal = moment(bonusMonthDate).startOf('month').format('YYYY-MM-DD');
        periode_akhir = moment(bonusMonthDate).endOf('month').format('YYYY-MM-DD');
      }
      details = bonusCalculations.filter((c) => !c.sudah_dibayar);
    }

    if (details.length === 0) {
      Alert.alert('Peringatan', 'Tidak ada data karyawan yang belum dibayar');
      return;
    }

    try {
      setProcessingPayment(true);
      const res = await ApiService.authenticatedRequest('/api/bayar-gaji/process-payment', {
        method: 'POST',
        body: JSON.stringify({
          tipe_pembayaran,
          periode_awal,
          periode_akhir,
          coa_payment: selectedCoa,
          tanggal_bayar: moment(paymentDate).format('YYYY-MM-DD'),
          keterangan: paymentKeterangan.trim(),
          details,
        }),
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Pembayaran gaji berhasil diproses dan dijurnal!');
        setPaymentModalVisible(false);
        setPaymentKeterangan('');

        // Reset calculations
        if (activeTab === 'harian') setDailyCalculations([]);
        if (activeTab === 'bulanan') setMonthlyCalculations([]);
        if (activeTab === 'bonus') setBonusCalculations([]);

        // Refresh history
        fetchHistory();
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal memproses pembayaran gaji');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Get active unpaid calculations for sticky footer button
  const currentUnpaidCalculations = () => {
    if (activeTab === 'harian') return dailyCalculations.filter((c) => !c.sudah_dibayar);
    if (activeTab === 'bulanan') return monthlyCalculations.filter((c) => !c.sudah_dibayar);
    if (activeTab === 'bonus') return bonusCalculations.filter((c) => !c.sudah_dibayar);
    return [];
  };

  const unpaidItems = currentUnpaidCalculations();
  const totalUnpaidAmount = unpaidItems.reduce((sum, item) => sum + (item.total || 0), 0);

  const renderCalculationCard = (item: PaymentCalculation, idx: number) => {
    return (
      <View key={idx} style={styles.calcCard}>
        <View style={styles.calcCardHeader}>
          <Text style={styles.calcName}>{item.karyawan_nama}</Text>
          <View
            style={[
              styles.statusBadge,
              item.sudah_dibayar ? styles.statusPaid : styles.statusUnpaid,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                item.sudah_dibayar ? styles.statusPaidText : styles.statusUnpaidText,
              ]}
            >
              {item.sudah_dibayar ? 'Sudah Dibayar' : 'Belum Dibayar'}
            </Text>
          </View>
        </View>

        {/* Stats Row if present */}
        {(item.hari_hadir !== undefined || item.hari_kerja !== undefined) && (
          <View style={styles.calcMetaRow}>
            {item.hari_hadir !== undefined && (
              <Text style={styles.metaBadge}>Hadir: {item.hari_hadir} hr</Text>
            )}
            {item.hari_terlambat !== undefined && (
              <Text style={[styles.metaBadge, { color: '#dc2626', backgroundColor: '#fee2e2' }]}>
                Terlambat: {item.hari_terlambat} hr
              </Text>
            )}
          </View>
        )}

        <View style={styles.calcBreakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Gaji Pokok</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(item.gaji_pokok)}</Text>
          </View>
          {item.penalty > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: '#dc2626' }]}>Denda Keterlambatan</Text>
              <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>
                - {formatCurrency(item.penalty)}
              </Text>
            </View>
          )}
          {item.bonus > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: '#16a34a' }]}>Bonus</Text>
              <Text style={[styles.breakdownValue, { color: '#16a34a' }]}>
                + {formatCurrency(item.bonus)}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.breakdownRow}>
            <Text style={styles.totalLabel}>Total Bersih</Text>
            <Text style={styles.totalValue}>{formatCurrency(item.total)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={26} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bayar Gaji Karyawan</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            fetchInitialData();
            if (activeTab === 'riwayat') fetchHistory();
          }}
        >
          <Ionicons name="refresh" size={22} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'harian' && styles.tabItemActive]}
          onPress={() => setActiveTab('harian')}
        >
          <Text style={[styles.tabText, activeTab === 'harian' && styles.tabTextActive]}>
            Gaji Harian
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'bulanan' && styles.tabItemActive]}
          onPress={() => setActiveTab('bulanan')}
        >
          <Text style={[styles.tabText, activeTab === 'bulanan' && styles.tabTextActive]}>
            Gaji Bulanan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'bonus' && styles.tabItemActive]}
          onPress={() => setActiveTab('bonus')}
        >
          <Text style={[styles.tabText, activeTab === 'bonus' && styles.tabTextActive]}>
            Bonus
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'riwayat' && styles.tabItemActive]}
          onPress={() => setActiveTab('riwayat')}
        >
          <Text style={[styles.tabText, activeTab === 'riwayat' && styles.tabTextActive]}>
            Riwayat
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* TAB 1: GAJI HARIAN */}
        {activeTab === 'harian' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Hitung Gaji Harian</Text>

              {/* Select Karyawan */}
              <TouchableOpacity
                style={styles.pickerSelector}
                onPress={() => setKaryawanPickerVisible(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>Karyawan Terpilih</Text>
                  <Text style={styles.pickerValue}>
                    {selectedKaryawanIds.length === karyawanList.length
                      ? 'Semua Karyawan'
                      : `${selectedKaryawanIds.length} Karyawan Dipilih`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              {/* Date Range */}
              <View style={styles.dateRangeRow}>
                <TouchableOpacity
                  style={styles.dateInputBtn}
                  onPress={() => setShowDailyStartPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text style={styles.dateInputText}>
                    {moment(dailyStartDate).format('DD/MM/YYYY')}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: '#9ca3af' }}>s/d</Text>
                <TouchableOpacity
                  style={styles.dateInputBtn}
                  onPress={() => setShowDailyEndPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text style={styles.dateInputText}>
                    {moment(dailyEndDate).format('DD/MM/YYYY')}
                  </Text>
                </TouchableOpacity>
              </View>

              {showDailyStartPicker && (
                <DateTimePicker
                  value={dailyStartDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, date?: Date) => {
                    setShowDailyStartPicker(false);
                    if (date) setDailyStartDate(date);
                  }}
                />
              )}

              {showDailyEndPicker && (
                <DateTimePicker
                  value={dailyEndDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, date?: Date) => {
                    setShowDailyEndPicker(false);
                    if (date) setDailyEndDate(date);
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.calcBtn, dailyLoading && styles.btnDisabled]}
                disabled={dailyLoading}
                onPress={handleCalculateDaily}
              >
                {dailyLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="calculator-outline" size={18} color="#fff" />
                    <Text style={styles.calcBtnText}>Hitung Gaji Harian</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Calculations List */}
            {dailyCalculations.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.resultHeading}>
                  Hasil Perhitungan ({dailyCalculations.length} Karyawan)
                </Text>
                {dailyCalculations.map((item, idx) => renderCalculationCard(item, idx))}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: GAJI BULANAN */}
        {activeTab === 'bulanan' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Hitung Gaji Bulanan</Text>

              <TouchableOpacity
                style={styles.pickerSelector}
                onPress={() => setKaryawanPickerVisible(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>Karyawan Terpilih</Text>
                  <Text style={styles.pickerValue}>
                    {selectedKaryawanIds.length === karyawanList.length
                      ? 'Semua Karyawan'
                      : `${selectedKaryawanIds.length} Karyawan Dipilih`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerSelector}
                onPress={() => setShowMonthlyPicker(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>Bulan Gaji</Text>
                  <Text style={styles.pickerValue}>
                    {moment(monthlyDate).format('MMMM YYYY')}
                  </Text>
                </View>
                <Ionicons name="calendar" size={18} color="#f59e0b" />
              </TouchableOpacity>

              {showMonthlyPicker && (
                <DateTimePicker
                  value={monthlyDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, date?: Date) => {
                    setShowMonthlyPicker(false);
                    if (date) setMonthlyDate(date);
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.calcBtn, monthlyLoading && styles.btnDisabled]}
                disabled={monthlyLoading}
                onPress={handleCalculateMonthly}
              >
                {monthlyLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="calculator-outline" size={18} color="#fff" />
                    <Text style={styles.calcBtnText}>Hitung Gaji Bulanan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {monthlyCalculations.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.resultHeading}>
                  Hasil Perhitungan ({monthlyCalculations.length} Karyawan)
                </Text>
                {monthlyCalculations.map((item, idx) => renderCalculationCard(item, idx))}
              </View>
            )}
          </View>
        )}

        {/* TAB 3: BONUS */}
        {activeTab === 'bonus' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Hitung Bonus Karyawan</Text>

              <View style={styles.bonusTypeRow}>
                <TouchableOpacity
                  style={[styles.bonusTypeBtn, bonusType === 'weekly' && styles.bonusTypeBtnActive]}
                  onPress={() => setBonusType('weekly')}
                >
                  <Text
                    style={[
                      styles.bonusTypeText,
                      bonusType === 'weekly' && styles.bonusTypeTextActive,
                    ]}
                  >
                    Mingguan (Weekly)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bonusTypeBtn, bonusType === 'monthly' && styles.bonusTypeBtnActive]}
                  onPress={() => setBonusType('monthly')}
                >
                  <Text
                    style={[
                      styles.bonusTypeText,
                      bonusType === 'monthly' && styles.bonusTypeTextActive,
                    ]}
                  >
                    Bulanan (Monthly)
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.pickerSelector}
                onPress={() => setKaryawanPickerVisible(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>Karyawan Terpilih</Text>
                  <Text style={styles.pickerValue}>
                    {selectedKaryawanIds.length === karyawanList.length
                      ? 'Semua Karyawan'
                      : `${selectedKaryawanIds.length} Karyawan Dipilih`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              {bonusType === 'weekly' ? (
                <View style={styles.dateRangeRow}>
                  <TouchableOpacity
                    style={styles.dateInputBtn}
                    onPress={() => setShowBonusStartPicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                    <Text style={styles.dateInputText}>
                      {moment(bonusStartDate).format('DD/MM/YYYY')}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#9ca3af' }}>s/d</Text>
                  <TouchableOpacity
                    style={styles.dateInputBtn}
                    onPress={() => setShowBonusEndPicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                    <Text style={styles.dateInputText}>
                      {moment(bonusEndDate).format('DD/MM/YYYY')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.pickerSelector}
                  onPress={() => setShowBonusMonthPicker(true)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerLabel}>Bulan Bonus</Text>
                    <Text style={styles.pickerValue}>
                      {moment(bonusMonthDate).format('MMMM YYYY')}
                    </Text>
                  </View>
                  <Ionicons name="calendar" size={18} color="#f59e0b" />
                </TouchableOpacity>
              )}

              {showBonusStartPicker && (
                <DateTimePicker
                  value={bonusStartDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, date?: Date) => {
                    setShowBonusStartPicker(false);
                    if (date) setBonusStartDate(date);
                  }}
                />
              )}

              {showBonusEndPicker && (
                <DateTimePicker
                  value={bonusEndDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, date?: Date) => {
                    setShowBonusEndPicker(false);
                    if (date) setBonusEndDate(date);
                  }}
                />
              )}

              {showBonusMonthPicker && (
                <DateTimePicker
                  value={bonusMonthDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, date?: Date) => {
                    setShowBonusMonthPicker(false);
                    if (date) setBonusMonthDate(date);
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.calcBtn, bonusLoading && styles.btnDisabled]}
                disabled={bonusLoading}
                onPress={handleCalculateBonus}
              >
                {bonusLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="calculator-outline" size={18} color="#fff" />
                    <Text style={styles.calcBtnText}>Hitung Bonus</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {bonusCalculations.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.resultHeading}>
                  Hasil Bonus ({bonusCalculations.length} Karyawan)
                </Text>
                {bonusCalculations.map((item, idx) => renderCalculationCard(item, idx))}
              </View>
            )}
          </View>
        )}

        {/* TAB 4: RIWAYAT PEMBAYARAN */}
        {activeTab === 'riwayat' && (
          <View>
            {loadingHistory ? (
              <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 30 }} />
            ) : historyList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>Belum ada riwayat pembayaran gaji</Text>
              </View>
            ) : (
              historyList.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyTypeBadge}>
                      <Text style={styles.historyTypeText}>
                        {item.tipe_pembayaran.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.historyDate}>
                      {moment(item.tanggal_bayar).format('DD MMM YYYY')}
                    </Text>
                  </View>

                  <Text style={styles.historyPeriode}>
                    Periode: {moment(item.periode_awal).format('DD/MM/YYYY')}
                    {item.periode_akhir
                      ? ` s/d ${moment(item.periode_akhir).format('DD/MM/YYYY')}`
                      : ''}
                  </Text>

                  <Text style={styles.historyKaryawan} numberOfLines={2}>
                    {item.nama_karyawan} ({item.jumlah_karyawan} orang)
                  </Text>

                  <View style={styles.historyFooter}>
                    <Text style={styles.historyTotalLabel}>Total Dibayar</Text>
                    <Text style={styles.historyTotalAmount}>
                      {formatCurrency(item.total_amount)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Action Bar when there are unpaid items */}
      {unpaidItems.length > 0 && activeTab !== 'riwayat' && (
        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomBarCount}>{unpaidItems.length} Karyawan Belum Dibayar</Text>
            <Text style={styles.bottomBarTotal}>{formatCurrency(totalUnpaidAmount)}</Text>
          </View>
          <TouchableOpacity
            style={styles.bottomBarBtn}
            onPress={() => setPaymentModalVisible(true)}
          >
            <Ionicons name="cash" size={18} color="#fff" />
            <Text style={styles.bottomBarBtnText}>Bayar Gaji</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Process Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Konfirmasi Pembayaran Gaji</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {/* Summary Card */}
              <View style={styles.modalSummaryCard}>
                <Text style={styles.modalSummaryLabel}>Total Pengeluaran Gaji</Text>
                <Text style={styles.modalSummaryValue}>{formatCurrency(totalUnpaidAmount)}</Text>
                <Text style={styles.modalSummarySub}>
                  Untuk {unpaidItems.length} karyawan terpilih
                </Text>
              </View>

              {/* Tanggal Bayar */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>Tanggal Pembayaran</Text>
                <TouchableOpacity
                  style={styles.modalDateBtn}
                  onPress={() => setShowPaymentDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                  <Text style={styles.modalDateText}>
                    {moment(paymentDate).format('DD MMMM YYYY')}
                  </Text>
                </TouchableOpacity>
              </View>

              {showPaymentDatePicker && (
                <DateTimePicker
                  value={paymentDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, date?: Date) => {
                    setShowPaymentDatePicker(false);
                    if (date) setPaymentDate(date);
                  }}
                />
              )}

              {/* Akun Pembayaran (CoA) */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>Akun Pembayaran (Kas/Bank)</Text>
                {coaList.map((coa) => (
                  <TouchableOpacity
                    key={coa.kode}
                    style={[
                      styles.coaOption,
                      selectedCoa === coa.kode && styles.coaOptionSelected,
                    ]}
                    onPress={() => setSelectedCoa(coa.kode)}
                  >
                    <Ionicons
                      name={selectedCoa === coa.kode ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selectedCoa === coa.kode ? '#f59e0b' : '#9ca3af'}
                    />
                    <Text style={styles.coaOptionText}>
                      {coa.kode} - {coa.nama}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Catatan / Keterangan */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>Keterangan (Opsional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Catatan transaksi gaji..."
                  value={paymentKeterangan}
                  onChangeText={setPaymentKeterangan}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPaymentModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, processingPayment && { opacity: 0.6 }]}
                disabled={processingPayment}
                onPress={handleProcessPayment}
              >
                {processingPayment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Proses Pembayaran</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Multi-Select Karyawan Modal */}
      <Modal
        visible={karyawanPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setKaryawanPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Karyawan</Text>
              <TouchableOpacity onPress={() => setKaryawanPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAllKaryawan}>
              <Ionicons
                name={
                  selectedKaryawanIds.length === karyawanList.length
                    ? 'checkbox'
                    : 'square-outline'
                }
                size={20}
                color="#f59e0b"
              />
              <Text style={styles.selectAllText}>
                {selectedKaryawanIds.length === karyawanList.length
                  ? 'Batal Pilih Semua'
                  : 'Pilih Semua Karyawan'}
              </Text>
            </TouchableOpacity>

            <FlatList
              data={karyawanList}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 350 }}
              renderItem={({ item }) => {
                const isSelected = selectedKaryawanIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={styles.karyawanItem}
                    onPress={() => toggleKaryawanSelect(item.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isSelected ? '#f59e0b' : '#9ca3af'}
                    />
                    <Text style={styles.karyawanItemName}>{item.nama}</Text>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              style={styles.karyawanDoneBtn}
              onPress={() => setKaryawanPickerVisible(false)}
            >
              <Text style={styles.karyawanDoneText}>
                Selesai ({selectedKaryawanIds.length} Dipilih)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#f59e0b' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#f59e0b', fontWeight: '700' },
  content: { padding: 12, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  pickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  pickerLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  pickerValue: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 2 },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateInputBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  dateInputText: { fontSize: 13, color: '#111827' },
  bonusTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  bonusTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  bonusTypeBtnActive: { backgroundColor: '#fef3c7' },
  bonusTypeText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  bonusTypeTextActive: { color: '#b45309' },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
    marginTop: 6,
  },
  btnDisabled: { opacity: 0.6 },
  calcBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultHeading: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  calcCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  calcCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calcName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusPaid: { backgroundColor: '#dcfce7' },
  statusPaidText: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  statusUnpaid: { backgroundColor: '#fef3c7' },
  statusUnpaidText: { color: '#b45309', fontSize: 11, fontWeight: '600' },
  statusText: { fontSize: 11, fontWeight: '600' },
  calcMetaRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  metaBadge: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  calcBreakdown: { backgroundColor: '#f9fafb', padding: 10, borderRadius: 8 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  breakdownLabel: { fontSize: 12, color: '#6b7280' },
  breakdownValue: { fontSize: 12, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 6 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 14, fontWeight: '700', color: '#16a34a' },

  // History styles
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyTypeBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyTypeText: { fontSize: 11, fontWeight: '700', color: '#6d28d9' },
  historyDate: { fontSize: 12, color: '#6b7280' },
  historyPeriode: { fontSize: 12, color: '#4b5563', marginBottom: 4 },
  historyKaryawan: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 8 },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  historyTotalLabel: { fontSize: 12, color: '#6b7280' },
  historyTotalAmount: { fontSize: 15, fontWeight: '700', color: '#2563eb' },

  // Bottom Sticky Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    elevation: 8,
  },
  bottomBarCount: { fontSize: 12, color: '#6b7280' },
  bottomBarTotal: { fontSize: 16, fontWeight: '700', color: '#111827' },
  bottomBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  bottomBarBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalSummaryCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  modalSummaryLabel: { fontSize: 12, color: '#92400e' },
  modalSummaryValue: { fontSize: 20, fontWeight: '800', color: '#b45309', marginVertical: 2 },
  modalSummarySub: { fontSize: 11, color: '#92400e' },
  modalFormGroup: { marginBottom: 12 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  modalDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  modalDateText: { fontSize: 13, color: '#111827' },
  coaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 6,
    gap: 8,
  },
  coaOptionSelected: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  coaOptionText: { fontSize: 13, color: '#111827' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },
  modalSubmitText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Karyawan picker styles
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  selectAllText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  karyawanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  karyawanItemName: { fontSize: 14, color: '#111827' },
  karyawanDoneBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  karyawanDoneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { marginTop: 10, fontSize: 14, color: '#9ca3af' },
});
