import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, DrawerActions } from '@react-navigation/native';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';

import ApiService from '../../../services/api';
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import SearchPembelianItemModal, { PembelianSearchItem } from '../../../components/pembelian/SearchPembelianItemModal';
import SearchReturItemModal, { ReturSearchItem } from '../../../components/pembelian/SearchReturItemModal';
import SearchDPItemModal, { DPSearchItem } from '../../../components/pembelian/SearchDPItemModal';
import SearchPelunasanModal, { PelunasanEksisItem } from '../../../components/pembelian/SearchPelunasanModal';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
export interface PelunasanItem {
  idPembelian?: number; // ID Pembelian (> 0 jika baris Pembelian)
  idRetur?: number; // ID Retur (> 0 jika baris Retur Pembelian)
  idDP?: number; // ID DP (> 0 jika baris DP Beli / Valas DP)
  total: string; // Nominal Hutang/Saldo awal baris ini (string float)
  bayar: string; // Nominal yang dibayarkan/dipotong pada baris ini (string float)
  source_type?: string; // 'dpbeli' atau 'valas_dp_pembelian' (khusus DP)
}

export default function PembelianPelunasanScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // --- Main Form State ---
  const [id, setId] = useState<string>('BARU');
  const [tanggal, setTanggal] = useState<string>(moment().format('YYYY-MM-DDTHH:mm:ss'));
  const [supplier, setSupplier] = useState<{ id: number; nama: string }>({ id: 0, nama: '' });
  const [kodeBaganAkun, setKodeBaganAkun] = useState<string>('111.01');
  const [namaBaganAkun, setNamaBaganAkun] = useState<string>('');
  const [keterangan, setKeterangan] = useState<string>('');
  const [items, setItems] = useState<PelunasanItem[]>([]);

  // --- Loading / Saving State ---
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // --- Modal Visibility State ---
  const [showSupplierSearch, setShowSupplierSearch] = useState<boolean>(false);
  const [showBaganAkunSearch, setShowBaganAkunSearch] = useState<boolean>(false);
  const [showPembelianSearch, setShowPembelianSearch] = useState<boolean>(false);
  const [showReturSearch, setShowReturSearch] = useState<boolean>(false);
  const [showDPSearch, setShowDPSearch] = useState<boolean>(false);
  const [showPelunasanSearch, setShowPelunasanSearch] = useState<boolean>(false);

  // --- Date / Time Picker State ---
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  // ---------------------------------------------------------------------------
  // Navigation Params / Auto-Fill Handler
  // ---------------------------------------------------------------------------
  useEffect(() => {
    handleInitialParams();
  }, [route.params]);

  const handleInitialParams = async () => {
    const params = route.params || {};

    // Scenario A: Load Existing Transaction (Edit / View) via ?id=X
    if (params.id && params.id !== 'BARU') {
      await loadPelunasanById(params.id.toString());
      return;
    }

    // Scenario B: Auto-Fill from "Lunasi Terpilih" (Multi-Pembelian) via ?ids=101,102,103&id_supplier=5
    if (params.ids && params.id_supplier) {
      await loadFromMultiPembelian(params.ids.toString(), parseInt(params.id_supplier));
      return;
    }

    // Scenario C: Auto-Fill from "Bayar / Lunasi" Single Invoice via ?id_pembelian=101&id_supplier=5
    if (params.id_pembelian && params.id_supplier) {
      await loadFromSinglePembelian(parseInt(params.id_pembelian), parseInt(params.id_supplier));
      return;
    }
  };

  /**
   * Load existing pelunasan transaction by ID (Section 3.A)
   */
  const loadPelunasanById = async (pelunasanId: string) => {
    try {
      setLoading(true);
      // 1. GET /get/pelunasanhutang/condition/and/id:equal:${id}
      const pelunasanRes = await ApiService.getPelunasanHutangById(pelunasanId);
      if (!pelunasanRes.status || !pelunasanRes.data || pelunasanRes.data.length === 0) {
        Alert.alert('Error', `Data pelunasan #${pelunasanId} tidak ditemukan.`);
        return;
      }
      const pelunasan = pelunasanRes.data[0];

      // 2. GET /get/supplier/condition/and/id:equal:${pelunasan.id_supplier}
      let supplierNama = '';
      if (pelunasan.id_supplier) {
        const suppRes = await ApiService.getSupplierById(pelunasan.id_supplier);
        if (suppRes.status && suppRes.data && suppRes.data.length > 0) {
          supplierNama = suppRes.data[0].nama || '';
        }
      }

      // 3. GET /get/detailpelunasanhutang/condition/and/id_pelunasan:equal:${id}
      const detailRes = await ApiService.getDetailPelunasanHutangById(pelunasanId);
      let loadedItems: PelunasanItem[] = [];
      if (detailRes.status && Array.isArray(detailRes.data)) {
        loadedItems = detailRes.data.map((item: any) => ({
          idPembelian: item.id_pembelian || 0,
          idRetur: item.id_retur || 0,
          idDP: item.id_dp || 0,
          total: String(item.totalhutang ?? 0),
          bayar: String(item.saldo ?? 0),
          source_type: item.source_type,
        }));
      }

      // 4. Set State
      setId(pelunasan.id.toString());
      setTanggal(
        pelunasan.tanggal
          ? pelunasan.tanggal.replace(' ', 'T')
          : moment().format('YYYY-MM-DDTHH:mm:ss')
      );
      setSupplier({ id: pelunasan.id_supplier || 0, nama: supplierNama });
      setKodeBaganAkun(pelunasan.kodeBA || '');
      setKeterangan(pelunasan.keterangan || '');
      setItems(loadedItems);
    } catch (error) {
      console.error('Error loading pelunasan by id:', error);
      Alert.alert('Error', 'Gagal memuat data pelunasan.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Auto-fill multi-pembelian selection (Section 3.B)
   */
  const loadFromMultiPembelian = async (idsStr: string, supplierId: number) => {
    try {
      setLoading(true);
      // Fetch Supplier Name
      const suppRes = await ApiService.getSupplierById(supplierId);
      let suppName = '';
      if (suppRes.status && suppRes.data && suppRes.data.length > 0) {
        suppName = suppRes.data[0].nama || '';
      }

      // Fetch Pembelian by IDs
      const pemRes = await ApiService.getPembelianByIds(idsStr);
      const newItems: PelunasanItem[] = [];

      if (pemRes.status && Array.isArray(pemRes.data)) {
        for (const item of pemRes.data) {
          const totalNum = parseFloat(String(item.total || 0));
          const bayarNum = parseFloat(String(item.BAYAR || 0));
          const sisaHutang = totalNum - bayarNum;

          newItems.push({
            idPembelian: parseInt(String(item.id)),
            idRetur: 0,
            idDP: 0,
            total: sisaHutang.toString(),
            bayar: sisaHutang.toString(),
          });
        }
      }

      setId('BARU');
      setTanggal(moment().format('YYYY-MM-DDTHH:mm:ss'));
      setSupplier({ id: supplierId, nama: suppName });
      setItems(newItems);
    } catch (error) {
      console.error('Error loading multi-pembelian:', error);
      Alert.alert('Error', 'Gagal memuat data pelunasan terpilih.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Auto-fill single pembelian invoice (Section 3.C)
   */
  const loadFromSinglePembelian = async (pembelianId: number, supplierId: number) => {
    try {
      setLoading(true);
      // Fetch Supplier Name
      const suppRes = await ApiService.getSupplierById(supplierId);
      let suppName = '';
      if (suppRes.status && suppRes.data && suppRes.data.length > 0) {
        suppName = suppRes.data[0].nama || '';
      }

      // Fetch Pembelian Single
      const pemRes = await ApiService.getPembelianById(pembelianId);
      let sisaHutang = 0;
      if (pemRes.status && pemRes.data && pemRes.data.length > 0) {
        const p = pemRes.data[0];
        const totalNum = parseFloat(String(p.total || 0));
        const bayarNum = parseFloat(String(p.BAYAR || 0));
        sisaHutang = totalNum - bayarNum;
      }

      setId('BARU');
      setTanggal(moment().format('YYYY-MM-DDTHH:mm:ss'));
      setSupplier({ id: supplierId, nama: suppName });
      setItems([
        {
          idPembelian: pembelianId,
          idRetur: 0,
          idDP: 0,
          total: sisaHutang.toString(),
          bayar: sisaHutang.toString(),
        },
      ]);
    } catch (error) {
      console.error('Error loading single pembelian:', error);
      Alert.alert('Error', 'Gagal memuat data nota pembelian.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers & Business Logic Rules
  // ---------------------------------------------------------------------------

  /**
   * Reset form to new status (Tombol "Baru")
   */
  const handleResetForm = () => {
    setId('BARU');
    setTanggal(moment().format('YYYY-MM-DDTHH:mm:ss'));
    setSupplier({ id: 0, nama: '' });
    setKodeBaganAkun('111.01');
    setNamaBaganAkun('');
    setKeterangan('');
    setItems([]);
  };

  /**
   * Handle Supplier Select (Poin Penting 3: Reset items array to [])
   */
  const handleSupplierSelect = (item: SupplierItem) => {
    setSupplier({ id: item.id, nama: item.nama });
    setItems([]); // WAJIB reset items saat ganti supplier
    setShowSupplierSearch(false);
  };

  /**
   * Handle Bagan Akun Select
   */
  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setKodeBaganAkun(item.kode);
    setNamaBaganAkun(item.nama);
    setShowBaganAkunSearch(false);
  };

  /**
   * Handle Add Pembelian Item from modal
   */
  const handleAddPembelianItem = (selected: PembelianSearchItem) => {
    const sisa = selected.sisa.toString();
    setItems((prev) => [
      ...prev,
      {
        idPembelian: selected.id,
        idRetur: 0,
        idDP: 0,
        total: sisa,
        bayar: sisa,
      },
    ]);
    setShowPembelianSearch(false);
  };

  /**
   * Handle Add Retur Item from modal
   */
  const handleAddReturItem = (selected: ReturSearchItem) => {
    // Retur total & bayar stored as negative string: -(total - bayar)
    const sisaNegatif = (-Math.abs(selected.sisa)).toString();
    setItems((prev) => [
      ...prev,
      {
        idPembelian: 0,
        idRetur: selected.id,
        idDP: 0,
        total: sisaNegatif,
        bayar: sisaNegatif,
      },
    ]);
    setShowReturSearch(false);
  };

  /**
   * Handle Add DP Item from modal
   */
  const handleAddDPItem = (selected: DPSearchItem) => {
    // DP total & bayar stored as negative string: -(dp - terpakai)
    const sisaNegatif = (-Math.abs(selected.sisa)).toString();
    setItems((prev) => [
      ...prev,
      {
        idPembelian: 0,
        idRetur: 0,
        idDP: selected.id,
        total: sisaNegatif,
        bayar: sisaNegatif,
        source_type: selected.source_type || 'dpbeli',
      },
    ]);
    setShowDPSearch(false);
  };

  /**
   * Handle Open Existing Pelunasan from modal
   */
  const handleSelectPelunasanEksis = async (selected: PelunasanEksisItem) => {
    setShowPelunasanSearch(false);
    await loadPelunasanById(selected.id.toString());
  };

  /**
   * Handle Change Nominal `bayar` per item (Section 2.B)
   */
  const handleBayarChange = (index: number, text: string) => {
    const newItems = [...items];
    const item = newItems[index];

    // Allow typing minus or empty string
    if (text === '' || text === '-') {
      item.bayar = text;
      setItems(newItems);
      return;
    }

    const valNum = parseFloat(text);
    if (isNaN(valNum)) {
      item.bayar = text;
      setItems(newItems);
      return;
    }

    const totalNum = parseFloat(item.total) || 0;

    if ((item.idDP || 0) > 0) {
      // DP BELI / VALAS DP (Section 2.B.2): Allow negative values <= -1
      // If user types positive number, make negative or cap if absolute value exceeds
      let finalVal = valNum;
      if (finalVal > 0) finalVal = -finalVal;

      if (Math.abs(finalVal) > Math.abs(totalNum)) {
        finalVal = totalNum; // Cap to total
      }
      item.bayar = finalVal.toString();
    } else if ((item.idRetur || 0) > 0) {
      // RETUR PEMBELIAN (Section 2.B.3): Total is negative (e.g. -150000)
      let finalVal = valNum;
      if (finalVal > 0) finalVal = -finalVal;

      if (Math.abs(finalVal) > Math.abs(totalNum)) {
        finalVal = totalNum; // Cap to total
      }
      item.bayar = finalVal.toString();
    } else {
      // PEMBELIAN (Section 2.B.3): Total is positive (e.g. 500000)
      let finalVal = valNum;
      if (finalVal > totalNum) {
        finalVal = totalNum; // Cap to total
      }
      item.bayar = finalVal.toString();
    }

    setItems(newItems);
  };

  /**
   * Remove item row
   */
  const handleRemoveItem = (index: number) => {
    Alert.alert('Hapus Baris', 'Apakah Anda yakin ingin menghapus baris pelunasan ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Calculations & Pre-Save Validations (Section 2.C)
  // ---------------------------------------------------------------------------

  const totalBayar = items.reduce((acc, item) => acc + (parseFloat(item.bayar) || 0), 0);

  /**
   * Save / Submit Handler (Section 2.C & 5)
   */
  const handleSave = async () => {
    // Check Supplier
    if (supplier.id <= 0) {
      Alert.alert('Peringatan', 'Pilih supplier terlebih dahulu!');
      return;
    }

    // Check Items
    if (items.length === 0) {
      Alert.alert('Peringatan', 'Daftar item pelunasan tidak boleh kosong!');
      return;
    }

    // Validasi 1 - Bagan Akun Required if totalBayar !== 0 (Section 2.C.2)
    if (totalBayar !== 0 && (!kodeBaganAkun || kodeBaganAkun.trim() === '')) {
      Alert.alert('Peringatan', 'bagan akun harus diisi!');
      return;
    }

    // Validasi 2 - Max Nominal Bayar per Baris (Section 2.C.3)
    for (const item of items) {
      const bayarAbs = Math.abs(parseFloat(item.bayar) || 0);
      const totalAbs = Math.abs(parseFloat(item.total) || 0);

      if (bayarAbs > totalAbs) {
        let notaLabel = '';
        if ((item.idPembelian || 0) > 0) notaLabel = `PEMBELIAN/${item.idPembelian}`;
        else if ((item.idRetur || 0) > 0) notaLabel = `RETUR/${item.idRetur}`;
        else if ((item.idDP || 0) > 0) notaLabel = `DP/${item.idDP}`;

        Alert.alert(
          'Peringatan',
          `bayar tidak boleh lebih dari total hutang pada no nota : ${notaLabel}`
        );
        return;
      }
    }

    try {
      setIsSaving(true);

      // Datetime payload format: YYYY-MM-DD HH:mm:ss (Replace T with space)
      const formattedTanggal = tanggal.replace('T', ' ');

      const payloadItems = items.map((item) => ({
        idPembelian: item.idPembelian || 0,
        idRetur: item.idRetur || 0,
        idDP: item.idDP || 0,
        total: item.total,
        bayar: item.bayar,
        ...(item.source_type ? { source_type: item.source_type } : {}),
      }));

      if (id === 'BARU') {
        // Create NEW pelunasan (Section 5.A)
        const payload = {
          tanggal: formattedTanggal,
          id_supplier: supplier.id,
          keterangan: keterangan,
          kodeBA: kodeBaganAkun,
          items: payloadItems,
        };

        const res = await ApiService.createPelunasanHutang(payload);
        if (res.status) {
          if (res.id) {
            setId(res.id.toString());
          }
          Alert.alert('Sukses', 'sukses menyimpan');
        } else {
          Alert.alert('Gagal', res.reason || 'Gagal menyimpan pelunasan');
        }
      } else {
        // Update EXISTING pelunasan (Section 5.B)
        const payload = {
          id: id,
          tanggal: formattedTanggal,
          id_supplier: supplier.id,
          keterangan: keterangan,
          kodeBA: kodeBaganAkun,
          items: payloadItems,
        };

        const res = await ApiService.updatePelunasanHutang(payload);
        if (res.status) {
          Alert.alert('Sukses', 'sukses menyimpan');
        } else {
          Alert.alert('Gagal', res.reason || 'Gagal memperbarui pelunasan');
        }
      }
    } catch (error) {
      console.error('Error saving pelunasan:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan pelunasan.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Delete Handler (Section 5.C)
   */
  const handleDelete = () => {
    if (id === 'BARU') return;

    Alert.alert('Hapus Transaksi', `Apakah Anda yakin ingin menghapus Pelunasan #${id}?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsSaving(true);
            const res = await ApiService.deletePelunasanHutang(id);
            if (res.status) {
              handleResetForm();
              Alert.alert('Sukses', 'sukses menghapus');
            } else {
              Alert.alert('Gagal', res.reason || 'Gagal menghapus pelunasan');
            }
          } catch (error) {
            console.error('Error deleting pelunasan:', error);
            Alert.alert('Error', 'Terjadi kesalahan saat menghapus pelunasan.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Date & Time Picker Helpers
  // ---------------------------------------------------------------------------
  const openDatePicker = () => {
    setPickerDate(moment(tanggal, 'YYYY-MM-DDTHH:mm:ss').toDate());
    setDatePickerMode('date');
    setShowDatePicker(true);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      if (datePickerMode === 'date') {
        const currentDate = moment(tanggal, 'YYYY-MM-DDTHH:mm:ss');
        const newDate = moment(selectedDate)
          .hour(currentDate.hour())
          .minute(currentDate.minute())
          .second(currentDate.second());
        setTanggal(newDate.format('YYYY-MM-DDTHH:mm:ss'));

        if (Platform.OS === 'android') {
          // Open time picker immediately after date picker on Android
          setTimeout(() => {
            setDatePickerMode('time');
            setShowDatePicker(true);
          }, 100);
        }
      } else {
        const currentDate = moment(tanggal, 'YYYY-MM-DDTHH:mm:ss');
        const newDate = currentDate
          .hour(selectedDate.getHours())
          .minute(selectedDate.getMinutes());
        setTanggal(newDate.format('YYYY-MM-DDTHH:mm:ss'));
      }
    }
  };

  // Helper formatting numbers for display
  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  // Helper badge color & text determination (Section 2.A)
  const getItemBadgeInfo = (item: PelunasanItem) => {
    if ((item.idPembelian || 0) > 0) {
      return {
        label: 'PEMBELIAN',
        code: `PEMBELIAN/${item.idPembelian}`,
        bg: '#DBEAFE',
        text: '#1E40AF',
        border: '#BFDBFE',
      };
    }
    if ((item.idRetur || 0) > 0) {
      return {
        label: 'RETUR',
        code: `RETUR/${item.idRetur}`,
        bg: '#FEE2E2',
        text: '#991B1B',
        border: '#FECACA',
      };
    }
    if ((item.idDP || 0) > 0) {
      if (item.source_type === 'valas_dp_pembelian') {
        return {
          label: 'VALAS DP',
          code: `DP/${item.idDP}`,
          bg: '#F3E8FF',
          text: '#6B21A8',
          border: '#E9D5FF',
        };
      }
      return {
        label: 'DP BELI',
        code: `DP/${item.idDP}`,
        bg: '#E0E7FF',
        text: '#3730A3',
        border: '#C7D2FE',
      };
    }
    return {
      label: 'ITEM',
      code: 'ITEM',
      bg: '#F3F4F6',
      text: '#374151',
      border: '#E5E7EB',
    };
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.drawerBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pelunasan Pembelian</Text>
        <View style={styles.headerRightBtns}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowPelunasanSearch(true)}>
            <Ionicons name="search" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleResetForm}>
            <Ionicons name="refresh" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Memuat data pelunasan...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 160 }}>
          {/* Status ID Banner & Tanggal Picker Header */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeaderRow}>
              <Text style={styles.sectionTitle}>Status Pelunasan</Text>
              <View
                style={[
                  styles.idBadge,
                  id === 'BARU' ? styles.idBadgeGreen : styles.idBadgeBlue,
                ]}
              >
                <Text
                  style={[
                    styles.idBadgeText,
                    id === 'BARU' ? styles.idBadgeTextGreen : styles.idBadgeTextBlue,
                  ]}
                >
                  {id === 'BARU' ? 'BARU' : `#${id}`}
                </Text>
              </View>
            </View>

            {/* Tanggal Picker Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tanggal & Waktu Transaksi</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={openDatePicker}>
                <Ionicons name="calendar-outline" size={18} color="#4B5563" />
                <Text style={styles.datePickerText}>
                  {moment(tanggal, 'YYYY-MM-DDTHH:mm:ss').format('DD MMMM YYYY, HH:mm')}
                </Text>
                <Ionicons name="pencil" size={16} color="#6B7280" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Main Controls (Supplier, Bagan Akun, Keterangan) */}
          <View style={styles.formCard}>
            {/* Field Supplier */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Supplier <Text style={styles.req}>*</Text></Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowSupplierSearch(true)}
              >
                <Ionicons name="business-outline" size={18} color="#3B82F6" />
                <Text style={[styles.selectorText, supplier.id > 0 ? styles.selectorTextSelected : null]}>
                  {supplier.id > 0 ? `${supplier.nama} (#${supplier.id})` : 'Pilih Supplier...'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Field Bagan Akun (Kas/Bank) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bagan Akun (Kas / Bank)</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowBaganAkunSearch(true)}
              >
                <Ionicons name="wallet-outline" size={18} color="#10B981" />
                <Text style={[styles.selectorText, kodeBaganAkun ? styles.selectorTextSelected : null]}>
                  {kodeBaganAkun
                    ? `${kodeBaganAkun} ${namaBaganAkun ? '- ' + namaBaganAkun : ''}`
                    : 'Pilih Bagan Akun...'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Field Keterangan */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Keterangan / Catatan</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Tambah catatan pelunasan..."
                placeholderTextColor="#9CA3AF"
                multiline={true}
                numberOfLines={3}
                value={keterangan}
                onChangeText={setKeterangan}
              />
            </View>
          </View>

          {/* Action Chips: Tambah Pembelian, Retur, DP (Section 6.4) */}
          <View style={styles.itemsHeaderRow}>
            <Text style={styles.sectionTitle}>Rincian Alokasi Pelunasan ({items.length})</Text>
          </View>

          <View style={styles.addChipsRow}>
            {/* + DP Beli */}
            <TouchableOpacity
              style={[styles.chipAddBtn, styles.chipDP]}
              onPress={() => {
                if (supplier.id <= 0) {
                  Alert.alert('Peringatan', 'Pilih supplier terlebih dahulu!');
                  return;
                }
                setShowDPSearch(true);
              }}
            >
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.chipAddText}>+ DP Beli</Text>
            </TouchableOpacity>

            {/* + Pembelian */}
            <TouchableOpacity
              style={[styles.chipAddBtn, styles.chipPembelian]}
              onPress={() => {
                if (supplier.id <= 0) {
                  Alert.alert('Peringatan', 'Pilih supplier terlebih dahulu!');
                  return;
                }
                setShowPembelianSearch(true);
              }}
            >
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.chipAddText}>+ Pembelian</Text>
            </TouchableOpacity>

            {/* + Retur */}
            <TouchableOpacity
              style={[styles.chipAddBtn, styles.chipRetur]}
              onPress={() => {
                if (supplier.id <= 0) {
                  Alert.alert('Peringatan', 'Pilih supplier terlebih dahulu!');
                  return;
                }
                setShowReturSearch(true);
              }}
            >
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.chipAddText}>+ Retur</Text>
            </TouchableOpacity>
          </View>

          {/* Items Card List (Section 6.3) */}
          {items.length === 0 ? (
            <View style={styles.emptyItemsBox}>
              <Ionicons name="list-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyItemsText}>Belum ada nota/retur/DP yang dipilih</Text>
              <Text style={styles.emptyItemsSubtext}>
                Gunakan tombol + Pembelian, + Retur, atau + DP Beli di atas untuk menambahkan item.
              </Text>
            </View>
          ) : (
            items.map((item, idx) => {
              const badge = getItemBadgeInfo(item);
              const totalVal = parseFloat(item.total) || 0;

              return (
                <View key={idx} style={[styles.itemRowCard, { borderColor: badge.border }]}>
                  {/* Card Header */}
                  <View style={styles.itemRowHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                      </View>
                      <Text style={styles.itemCodeText}>{badge.code}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={styles.trashBtn}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  {/* Content: Total & Input Bayar */}
                  <View style={styles.itemRowBody}>
                    <View style={styles.itemCol}>
                      <Text style={styles.itemColLabel}>Sisa / Nominal Nota</Text>
                      <Text style={[styles.itemColValue, totalVal < 0 ? styles.textRed : styles.textBlue]}>
                        {formatRupiah(totalVal)}
                      </Text>
                    </View>

                    <View style={[styles.itemCol, { flex: 1.2, marginLeft: 12 }]}>
                      <Text style={styles.itemColLabel}>Nominal Dibayar / Dipotong</Text>
                      <TextInput
                        style={styles.bayarInput}
                        keyboardType="numeric"
                        value={item.bayar}
                        onChangeText={(txt) => handleBayarChange(idx, txt)}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Floating Footer Action Bar (Section 6.4) */}
      <View style={styles.footerBar}>
        {/* Total Bayar Summary Bar */}
        <View style={styles.footerSummaryRow}>
          <Text style={styles.totalBayarLabel}>Total Bayar (Sisa Kas/Bank):</Text>
          <Text
            style={[
              styles.totalBayarValue,
              totalBayar < 0 ? styles.textRed : styles.textGreen,
            ]}
          >
            {formatRupiah(totalBayar)}
          </Text>
        </View>

        {/* Footer Action Buttons */}
        <View style={styles.footerBtnsRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleResetForm} disabled={isSaving}>
            <Ionicons name="document-outline" size={18} color="#4B5563" />
            <Text style={styles.btnSecondaryText}>Baru</Text>
          </TouchableOpacity>

          {id !== 'BARU' && (
            <TouchableOpacity style={styles.btnDanger} onPress={handleDelete} disabled={isSaving}>
              <Ionicons name="trash" size={18} color="#FFF" />
              <Text style={styles.btnDangerText}>Hapus</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, isSaving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFF" />
                <Text style={styles.btnPrimaryText}>Simpan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Datetime Picker Modal Component */}
      {showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode={datePickerMode}
          is24Hour={true}
          display="default"
          onChange={onDateChange}
        />
      )}

      {/* Modal Pickers */}
      <SearchSupplierModal
        visible={showSupplierSearch}
        onClose={() => setShowSupplierSearch(false)}
        onSelect={handleSupplierSelect}
      />

      <SearchBaganAkunModal
        visible={showBaganAkunSearch}
        shows={['111']}
        onClose={() => setShowBaganAkunSearch(false)}
        onSelect={handleBaganAkunSelect}
      />

      <SearchPembelianItemModal
        visible={showPembelianSearch}
        supplierId={supplier.id}
        existingIds={items.map((i) => i.idPembelian || 0).filter((id) => id > 0)}
        onClose={() => setShowPembelianSearch(false)}
        onSelect={handleAddPembelianItem}
      />

      <SearchReturItemModal
        visible={showReturSearch}
        supplierId={supplier.id}
        existingIds={items.map((i) => i.idRetur || 0).filter((id) => id > 0)}
        onClose={() => setShowReturSearch(false)}
        onSelect={handleAddReturItem}
      />

      <SearchDPItemModal
        visible={showDPSearch}
        supplierId={supplier.id}
        existingIds={items.map((i) => i.idDP || 0).filter((id) => id > 0)}
        onClose={() => setShowDPSearch(false)}
        onSelect={handleAddDPItem}
      />

      <SearchPelunasanModal
        visible={showPelunasanSearch}
        onClose={() => setShowPelunasanSearch(false)}
        onSelect={handleSelectPelunasanEksis}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    height: 56,
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  drawerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 4,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
  },
  scrollContainer: {
    flex: 1,
    padding: 12,
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  idBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  idBadgeGreen: {
    backgroundColor: '#D1FAE5',
  },
  idBadgeBlue: {
    backgroundColor: '#DBEAFE',
  },
  idBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  idBadgeTextGreen: {
    color: '#065F46',
  },
  idBadgeTextBlue: {
    color: '#1E40AF',
  },
  inputGroup: {
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  req: {
    color: '#EF4444',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  datePickerText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  selectorText: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
  },
  selectorTextSelected: {
    color: '#111827',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 60,
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  addChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  chipAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
    elevation: 1,
  },
  chipDP: {
    backgroundColor: '#6366F1',
  },
  chipPembelian: {
    backgroundColor: '#2563EB',
  },
  chipRetur: {
    backgroundColor: '#DC2626',
  },
  chipAddText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyItemsBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
  },
  emptyItemsText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  emptyItemsSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  itemRowCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  itemRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  trashBtn: {
    padding: 4,
  },
  itemRowBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCol: {
    flex: 1,
  },
  itemColLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  itemColValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  bayarInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  textRed: {
    color: '#DC2626',
  },
  textBlue: {
    color: '#2563EB',
  },
  textGreen: {
    color: '#059669',
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalBayarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  totalBayarValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  footerBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  btnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  btnDangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  btnPrimary: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
