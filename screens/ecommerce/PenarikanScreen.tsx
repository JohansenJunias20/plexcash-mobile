import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import moment from 'moment';

import ApiService, { API_BASE_URL } from '../../services/api';
import BaganAkunSearchModal from './components/BaganAkunSearchModal';
import PenarikanDetailModal, {
  getKodeBA,
  ITAOdataTransaction,
  KodebaTipe,
} from './components/PenarikanDetailModal';

// Currency formatting helper
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

interface ECommerceAccount {
  id: number;
  platform: string;
  name: string;
  api_private: boolean;
  status: string;
}

interface BiayaLainnya {
  deposit_id: string;
  nama: string;
  id_database?: number;
  kode?: number;
  tipe: 'IKLAN' | 'LAINNYA' | 'EKSPEDISI';
  amount: number;
  date: string;
  check?: boolean;
}

export default function PenarikanScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Core States
  const [ecommerceList, setEcommerceList] = useState<ECommerceAccount[]>([]);
  const [idEcommerce, setIdEcommerce] = useState<number>(0);
  const [fetching, setFetching] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<ITAOdataTransaction[]>([]);
  const [biayaLainnya, setBiayaLainnya] = useState<BiayaLainnya[]>([]);

  // Selection States
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedBiaya, setSelectedBiaya] = useState<Set<string>>(new Set());

  // Date Filters
  const [dateStart, setDateStart] = useState<moment.Moment>(moment().subtract(3, 'd'));
  const [dateEnd, setDateEnd] = useState<moment.Moment>(moment());
  const [dateChanged, setDateChanged] = useState<boolean>(false);

  // Settings
  const [syncSaldoHistory, setSyncSaldoHistory] = useState<boolean>(false);
  const [autoJournalingEnabled, setAutoJournalingEnabled] = useState<boolean>(false);
  const [autoJournalingLoading, setAutoJournalingLoading] = useState<boolean>(false);

  // Chart of Accounts (Bagan Akun)
  const [baganAkunPembayaran, setBaganAkunPembayaran] = useState({ kodeba: '', nama: '' });
  const [baganAkunPiutang, setBaganAkunPiutang] = useState({ kodeba: '113', nama: 'PIUTANG USAHA' });

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'semua' | 'belum_dibuat' | 'telah_dibuat'>('semua');
  const [activeSubTab, setActiveSubTab] = useState<'transaksi' | 'biaya'>('transaksi');

  // Search Modals
  const [showBaganAkunModal, setShowBaganAkunModal] = useState<
    '' | 'pembayaran' | 'piutang' | 'auto_pembayaran' | 'auto_piutang'
  >('');

  // Auto Journal Configuration dialog
  const [showAutoJournalConfigDialog, setShowAutoJournalConfigDialog] = useState<boolean>(false);
  const [autoJournalPembayaran, setAutoJournalPembayaran] = useState({ kodeba: '', nama: '' });
  const [autoJournalPiutang, setAutoJournalPiutang] = useState({ kodeba: '113', nama: 'PIUTANG USAHA' });
  const [autoJournalConfigLoading, setAutoJournalConfigLoading] = useState<boolean>(false);

  // Date Jurnal (BUAT process)
  const [tanggalJurnal, setTanggalJurnal] = useState<moment.Moment>(moment());
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);

  // Expo DateTimePicker states
  const [showDatePickerStart, setShowDatePickerStart] = useState<boolean>(false);
  const [showDatePickerEnd, setShowDatePickerEnd] = useState<boolean>(false);
  const [showDatePickerJurnal, setShowDatePickerJurnal] = useState<boolean>(false);
  const [showTimePickerJurnal, setShowTimePickerJurnal] = useState<boolean>(false);

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<ITAOdataTransaction | null>(null);

  // Processing Stats (BUAT action)
  const [creating, setCreating] = useState<boolean>(false);
  const [cancelProcessing, setCancelProcessing] = useState<boolean>(false);
  const cancelProcessingRef = useRef<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const [processingStats, setProcessingStats] = useState<{
    totalItems: number;
    processedItems: number;
    created: number;
    alreadyCreated: number;
    failed: number;
    startTime: number;
  } | null>(null);

  // Filter Panel Collapsed
  const [filterCollapsed, setFilterCollapsed] = useState<boolean>(false);

  // Summary Totals
  const [totalOmset, setTotalOmset] = useState<number>(0);
  const [totalBayar, setTotalBayar] = useState<number>(0);

  // Auto update tanggalJurnal every second if not manually edited
  useEffect(() => {
    if (!isManuallyEdited && activeTab === 'belum_dibuat') {
      const interval = setInterval(() => {
        setTanggalJurnal(moment());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isManuallyEdited, activeTab]);

  // Fetch initial setup configurations
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setFetching(true);
        // 1. Get ecommerce list
        const ecommerceRes = await ApiService.get('/get/ecommerce');
        if (ecommerceRes && ecommerceRes.status) {
          const approved = (ecommerceRes.data || []).filter(
            (item: ECommerceAccount) => item.status === 'APPROVED'
          );
          setEcommerceList(approved);
          if (approved.length > 0) {
            setIdEcommerce(approved[0].id);
          }
        }

        // 2. Get global settings
        const settingsRes = await ApiService.get('/get/settings');
        if (settingsRes && settingsRes.status) {
          const syncHistory = (settingsRes.data || []).find(
            (item: any) => item.setting === 'sync_saldohistory'
          );
          setSyncSaldoHistory(!!syncHistory?.value);
        }

        // 3. Get auto journaling status
        const autoRes = await ApiService.get('/settings/auto_journaling');
        if (autoRes && autoRes.status) {
          setAutoJournalingEnabled(!!autoRes.enabled);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setFetching(false);
      }
    };

    loadSettings();
  }, []);

  // Fetch settlement data whenever idEcommerce or search is triggered
  const fetchSettlementData = async () => {
    if (!idEcommerce) return;

    try {
      setFetching(true);
      // Reset selections
      setSelectedTransactions(new Set());
      setSelectedBiaya(new Set());

      const activeEcom = ecommerceList.find((el) => el.id === idEcommerce);
      if (activeEcom?.platform === 'TOKOPEDIA' && !syncSaldoHistory) {
        // Tokopedia manual upload requires a file, don't auto-fetch
        setTransactions([]);
        setBiayaLainnya([]);
        setFetching(false);
        return;
      }

      const startUnix = dateStart.unix();
      const endUnix = dateEnd.unix();
      const url = `/get/ecommerce/settlement/${idEcommerce}?start=${startUnix}&end=${endUnix}`;

      const res = await ApiService.get(url);
      if (res && res.status) {
        setTransactions(res.data.transactions || []);
        setBiayaLainnya(res.data.biaya_lainnya || []);
        setDateChanged(false);
      } else {
        Alert.alert('Error', res.reason || 'Gagal memuat data settlement');
      }
    } catch (error) {
      console.error('Failed to fetch settlement data:', error);
      Alert.alert('Error', 'Terjadi kesalahan jaringan saat memuat data');
    } finally {
      setFetching(false);
    }
  };

  // Trigger fetch when e-commerce account changes
  useEffect(() => {
    fetchSettlementData();
  }, [idEcommerce]);

  // Calculate realtime selected totals
  useEffect(() => {
    // 1. Total Omset: sum of (total - retur?.total) of checked transactions with valid id_database
    const selectedTxData = transactions.filter(
      (tx) => selectedTransactions.has(tx.no_order) && tx.id_database && tx.id_database !== -1
    );
    const sumOmset = selectedTxData.reduce(
      (acc, tx) => acc + (tx.total - (tx.retur?.total || 0)),
      0
    );
    setTotalOmset(sumOmset);

    // 2. Total Bayar: sum of (bayar) of checked transactions with valid id_database + sum of amount of checked other fees without id_database (unprocessed)
    const sumBayarTx = selectedTxData.reduce((acc, tx) => acc + (tx.bayar || 0), 0);

    const selectedBiayaData = biayaLainnya.filter(
      (b) => selectedBiaya.has(b.deposit_id) && !b.id_database
    );
    const sumBayarBiaya = selectedBiayaData.reduce((acc, b) => acc + (b.amount || 0), 0);

    setTotalBayar(sumBayarTx + sumBayarBiaya);
  }, [selectedTransactions, selectedBiaya, transactions, biayaLainnya]);

  // Handle Date Pickers Range limits
  const handleDateStartPick = (selectedDate?: Date) => {
    setShowDatePickerStart(false);
    if (!selectedDate) return;

    const start = moment(selectedDate);
    setDateStart(start);
    setDateChanged(true);

    if (dateEnd.isBefore(start)) {
      setDateEnd(start.clone());
    } else if (dateEnd.diff(start, 'months', true) > 1) {
      setDateEnd(start.clone().add(1, 'month'));
    }
  };

  const handleDateEndPick = (selectedDate?: Date) => {
    setShowDatePickerEnd(false);
    if (!selectedDate) return;

    const end = moment(selectedDate);
    if (end.isBefore(dateStart)) {
      Alert.alert('Error', 'Tanggal akhir tidak boleh sebelum tanggal awal.');
      return;
    }

    if (end.diff(dateStart, 'months', true) > 1) {
      Alert.alert('Peringatan', 'Jarak maksimal tanggal adalah 1 bulan.');
      setDateEnd(dateStart.clone().add(1, 'month'));
      setDateChanged(true);
      return;
    }

    setDateEnd(end);
    setDateChanged(true);
  };

  // Upload File Tokopedia logic
  const handleTokopediaUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: fileAsset.uri,
        name: fileAsset.name || 'tokopedia_settlement.xlsx',
        type: fileAsset.mimeType || 'application/octet-stream',
      } as any);

      setFetching(true);
      // Retrieve auth header to execute fetch directly to bypass ApiService json type restriction
      const authHeader = await ApiService.getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/penarikan/tokopedia`, {
        method: 'POST',
        body: formData,
        headers: {
          ...authHeader,
        },
      });

      const responseText = await response.text();
      let resJson: any;
      try {
        resJson = JSON.parse(responseText);
      } catch (e) {
        resJson = { status: false, reason: 'Format respon server tidak valid.' };
      }

      if (resJson.status) {
        const trans = (resJson.data?.transactions || []).map((tx: any) => ({
          ...tx,
          id: tx.invoice || tx.no_order,
        }));
        setTransactions(trans);

        const fees = (resJson.data?.biaya_lainnya || []).map((fee: any) => ({
          ...fee,
          id: fee.deposit_id,
        }));
        setBiayaLainnya(fees);
        setSelectedTransactions(new Set());
        setSelectedBiaya(new Set());
      } else {
        Alert.alert('Upload Gagal', resJson.reason || 'Gagal memproses file Tokopedia');
      }
    } catch (error) {
      console.error('Tokopedia upload error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat mengunggah file.');
    } finally {
      setFetching(false);
    }
  };

  // Auto Journaling Toggle handler
  const handleAutoJournalingToggle = async (value: boolean) => {
    if (value && idEcommerce) {
      setAutoJournalingLoading(true);
      try {
        const checkRes = await ApiService.get(
          `/settings/auto_journaling/bagan_akun/${idEcommerce}`
        );

        if (!checkRes.status || !checkRes.data?.kodeba_pembayaran) {
          setAutoJournalingLoading(false);
          setShowAutoJournalConfigDialog(true);
          return;
        }
      } catch (error) {
        console.error('Error checking auto journal config:', error);
      }
    }

    setAutoJournalingLoading(true);
    try {
      const res = await ApiService.post('/settings/auto_journaling', { enabled: value });
      if (res.status) {
        setAutoJournalingEnabled(value);
        Alert.alert(
          'Sukses',
          res.message ||
            (value ? 'Auto Journaling berhasil diaktifkan' : 'Auto Journaling berhasil dinonaktifkan')
        );
      } else {
        Alert.alert('Error', res.reason || 'Gagal merubah status Auto Journaling');
      }
    } catch (error) {
      Alert.alert('Error', 'Terjadi kesalahan jaringan');
    } finally {
      setAutoJournalingLoading(false);
    }
  };

  // Save Auto Journal Bagan Akun Configuration
  const handleSaveAutoJournalConfig = async () => {
    if (!idEcommerce) return;
    if (!autoJournalPembayaran.kodeba) {
      Alert.alert('Peringatan', 'Pilih bagan akun pembayaran terlebih dahulu');
      return;
    }
    if (!autoJournalPiutang.kodeba) {
      Alert.alert('Peringatan', 'Pilih bagan akun piutang terlebih dahulu');
      return;
    }

    setAutoJournalConfigLoading(true);
    try {
      const configRes = await ApiService.post(
        `/settings/auto_journaling/bagan_akun/${idEcommerce}`,
        {
          kodeba_pembayaran: autoJournalPembayaran.kodeba,
          kodeba_piutang: autoJournalPiutang.kodeba,
        }
      );

      if (configRes.status) {
        setShowAutoJournalConfigDialog(false);
        // Now turn on auto journaling
        const enableRes = await ApiService.post('/settings/auto_journaling', { enabled: true });
        if (enableRes.status) {
          setAutoJournalingEnabled(true);
          Alert.alert('Sukses', 'Konfigurasi disimpan & Auto Journaling diaktifkan.');
        }
      } else {
        Alert.alert('Error', configRes.reason || 'Gagal menyimpan konfigurasi');
      }
    } catch (error) {
      Alert.alert('Error', 'Terjadi kesalahan jaringan');
    } finally {
      setAutoJournalConfigLoading(false);
    }
  };

  // BUAT (Create batch journaling) action
  const handleCreateJurnal = async () => {
    if (!baganAkunPembayaran.kodeba) {
      Alert.alert('Peringatan', 'Pilih bagan akun pembayaran terlebih dahulu');
      return;
    }

    const selectedTxData = transactions.filter(
      (tx) => selectedTransactions.has(tx.no_order) && tx.id_database && tx.id_database !== -1
    );
    const selectedBiayaData = biayaLainnya.filter(
      (b) => selectedBiaya.has(b.deposit_id) && !b.id_database
    );

    if (selectedTxData.length === 0 && selectedBiayaData.length === 0) {
      Alert.alert('Peringatan', 'Pilih transaksi atau biaya lainnya yang akan dijurnal');
      return;
    }

    setCreating(true);
    setCancelProcessing(false);
    cancelProcessingRef.current = false;

    const jDate = tanggalJurnal.format('YYYY-MM-DD HH:mm:ss');
    const CHUNK_SIZE = 200;

    // Slice to chunks
    const transactionChunks: typeof selectedTxData[] = [];
    for (let i = 0; i < selectedTxData.length; i += CHUNK_SIZE) {
      transactionChunks.push(selectedTxData.slice(i, i + CHUNK_SIZE));
    }

    const biayaChunks: typeof selectedBiayaData[] = [];
    for (let i = 0; i < selectedBiayaData.length; i += CHUNK_SIZE) {
      biayaChunks.push(selectedBiayaData.slice(i, i + CHUNK_SIZE));
    }

    const totalChunks = transactionChunks.length + biayaChunks.length;
    const totalItems = selectedTxData.length + selectedBiayaData.length;

    setProcessingStats({
      totalItems,
      processedItems: 0,
      created: 0,
      alreadyCreated: 0,
      failed: 0,
      startTime: Date.now(),
    });

    const accumulatedResults = {
      created: {
        transactions: [] as { no_order: string; id_withdraw: number }[],
        biaya_lainnya: [] as { deposit_id: string; id_withdraw: number }[],
      },
      already_created: { transactions: [] as string[], biaya_lainnya: [] as string[] },
      failed: {
        transactions: [] as { no_order: string; reason: string }[],
        biaya_lainnya: [] as { deposit_id: string; reason: string }[],
      },
    };

    let currentChunk = 0;
    let processedItemsCount = 0;

    // 1. Process transactions
    for (let i = 0; i < transactionChunks.length; i++) {
      if (cancelProcessingRef.current) break;

      currentChunk++;
      setProcessingProgress({ current: currentChunk, total: totalChunks });

      try {
        const res = await ApiService.post('/penarikan', {
          transactions: transactionChunks[i],
          biaya_lainnya: [],
          id_ecommerce: idEcommerce,
          kodeba_piutang: baganAkunPiutang.kodeba,
          kodeba_pembayaran: baganAkunPembayaran.kodeba,
          tanggal_jurnal: jDate,
        });

        if (!res.status) {
          Alert.alert('Error', `Proses chunk transaksi ke-${currentChunk} gagal: ${res.message || 'Error'}`);
          setCreating(false);
          setProcessingProgress(null);
          return;
        }

        const chunkResult = res.data;
        accumulatedResults.created.transactions.push(...(chunkResult.created?.transactions || []));
        accumulatedResults.already_created.transactions.push(
          ...(chunkResult.already_created?.transactions || [])
        );
        accumulatedResults.failed.transactions.push(...(chunkResult.failed?.transactions || []));

        processedItemsCount += transactionChunks[i].length;
        setProcessingStats((prev) =>
          prev
            ? {
                ...prev,
                processedItems: processedItemsCount,
                created:
                  accumulatedResults.created.transactions.length +
                  accumulatedResults.created.biaya_lainnya.length,
                alreadyCreated:
                  accumulatedResults.already_created.transactions.length +
                  accumulatedResults.already_created.biaya_lainnya.length,
                failed:
                  accumulatedResults.failed.transactions.length +
                  accumulatedResults.failed.biaya_lainnya.length,
              }
            : null
        );
      } catch (err) {
        Alert.alert('Error', 'Kesalahan jaringan saat memproses batch transaksi');
        setCreating(false);
        setProcessingProgress(null);
        return;
      }
    }

    // 2. Process other fees
    for (let i = 0; i < biayaChunks.length; i++) {
      if (cancelProcessingRef.current) break;

      currentChunk++;
      setProcessingProgress({ current: currentChunk, total: totalChunks });

      try {
        const res = await ApiService.post('/penarikan', {
          transactions: [],
          biaya_lainnya: biayaChunks[i],
          id_ecommerce: idEcommerce,
          kodeba_piutang: baganAkunPiutang.kodeba,
          kodeba_pembayaran: baganAkunPembayaran.kodeba,
          tanggal_jurnal: jDate,
        });

        if (!res.status) {
          Alert.alert('Error', `Proses chunk biaya ke-${currentChunk} gagal: ${res.message || 'Error'}`);
          setCreating(false);
          setProcessingProgress(null);
          return;
        }

        const chunkResult = res.data;
        accumulatedResults.created.biaya_lainnya.push(...(chunkResult.created?.biaya_lainnya || []));
        accumulatedResults.already_created.biaya_lainnya.push(
          ...(chunkResult.already_created?.biaya_lainnya || [])
        );
        accumulatedResults.failed.biaya_lainnya.push(...(chunkResult.failed?.biaya_lainnya || []));

        processedItemsCount += biayaChunks[i].length;
        setProcessingStats((prev) =>
          prev
            ? {
                ...prev,
                processedItems: processedItemsCount,
                created:
                  accumulatedResults.created.transactions.length +
                  accumulatedResults.created.biaya_lainnya.length,
                alreadyCreated:
                  accumulatedResults.already_created.transactions.length +
                  accumulatedResults.already_created.biaya_lainnya.length,
                failed:
                  accumulatedResults.failed.transactions.length +
                  accumulatedResults.failed.biaya_lainnya.length,
              }
            : null
        );
      } catch (err) {
        Alert.alert('Error', 'Kesalahan jaringan saat memproses batch biaya');
        setCreating(false);
        setProcessingProgress(null);
        return;
      }
    }

    setProcessingProgress(null);
    setProcessingStats(null);

    // Apply outcomes to state arrays
    // Update transactions list
    setTransactions((prev) =>
      prev.map((tx) => {
        const created = accumulatedResults.created.transactions.find(
          (el) => el.no_order === tx.no_order
        );
        if (created) {
          return { ...tx, id_database_withdraw: created.id_withdraw };
        }
        const failed = accumulatedResults.failed.transactions.find(
          (el) => el.no_order === tx.no_order
        );
        if (failed) {
          // Uncheck failed items
          selectedTransactions.delete(tx.no_order);
          return tx;
        }
        return tx;
      })
    );

    // Update other fees list
    setBiayaLainnya((prev) =>
      prev.map((b) => {
        const created = accumulatedResults.created.biaya_lainnya.find(
          (el) => el.deposit_id === b.deposit_id
        );
        if (created) {
          return { ...b, id_database: created.id_withdraw };
        }
        const failed = accumulatedResults.failed.biaya_lainnya.find(
          (el) => el.deposit_id === b.deposit_id
        );
        if (failed) {
          // Uncheck failed
          selectedBiaya.delete(b.deposit_id);
          return b;
        }
        return b;
      })
    );

    // Clear checked lists
    setSelectedTransactions(new Set(selectedTransactions));
    setSelectedBiaya(new Set(selectedBiaya));

    const createdCount =
      accumulatedResults.created.transactions.length +
      accumulatedResults.created.biaya_lainnya.length;
    const alreadyCreatedCount =
      accumulatedResults.already_created.transactions.length +
      accumulatedResults.already_created.biaya_lainnya.length;
    const failedCount =
      accumulatedResults.failed.transactions.length +
      accumulatedResults.failed.biaya_lainnya.length;

    if (cancelProcessingRef.current) {
      Alert.alert(
        'Dibatalkan',
        `Proses dihentikan oleh user.\n\nBerhasil: ${createdCount}, Sudah ada: ${alreadyCreatedCount}, Gagal: ${failedCount}`
      );
    } else if (failedCount > 0) {
      const failedInvoices = accumulatedResults.failed.transactions.map((f) => {
        const reason =
          f.reason === 'biaya_penjualan_error'
            ? 'Gagal menghitung biaya penjualan'
            : f.reason === 'penjualan_not_found'
            ? 'Data penjualan tidak ditemukan'
            : f.reason === 'insert_failed'
            ? 'Gagal menyimpan ke database'
            : f.reason;
        return `${f.no_order}: ${reason}`;
      });

      const failedFees = accumulatedResults.failed.biaya_lainnya.map((f) => {
        const reason = f.reason === 'insert_failed' ? 'Gagal menyimpan ke database' : f.reason;
        return `${f.deposit_id}: ${reason}`;
      });

      const allFailed = [...failedInvoices, ...failedFees];
      Alert.alert(
        'Proses Selesai (Ada Error)',
        `Berhasil: ${createdCount}\nSudah ada sebelumnya: ${alreadyCreatedCount}\nGagal: ${failedCount}\n\nDetail Gagal:\n${allFailed.join(
          '\n'
        )}`
      );
    } else if (alreadyCreatedCount > 0) {
      Alert.alert(
        'Proses Selesai',
        `Berhasil dibuat: ${createdCount}\nSudah ada sebelumnya: ${alreadyCreatedCount}`
      );
    } else {
      Alert.alert('Sukses', `Berhasil membuat ${createdCount} penarikan.`);
    }

    setCreating(false);
  };

  // BATAL (Delete batch journaling) action
  const handleCancelJurnal = async () => {
    const selectedTxData = transactions.filter(
      (tx) => selectedTransactions.has(tx.no_order) && tx.id_database
    );
    const selectedBiayaData = biayaLainnya.filter(
      (b) => selectedBiaya.has(b.deposit_id) && b.id_database
    );

    if (selectedTxData.length === 0 && selectedBiayaData.length === 0) {
      Alert.alert('Peringatan', 'Pilih item yang sudah terproses (jurnal ada) untuk dibatalkan');
      return;
    }

    Alert.alert(
      'Konfirmasi Batal',
      `Apakah Anda yakin ingin membatalkan jurnal penarikan untuk ${
        selectedTxData.length + selectedBiayaData.length
      } item terpilih? Jurnal akan dihapus dari sistem ERP.`,
      [
        { text: 'Tidak', style: 'cancel' },
        {
          text: 'Ya, Batalkan',
          style: 'destructive',
          onPress: async () => {
            try {
              setFetching(true);
              const res = await ApiService.delete('/penarikan', {
                transactions: selectedTxData,
                biaya_lainnya: selectedBiayaData,
                id_ecommerce: idEcommerce,
                kodeba_piutang: baganAkunPiutang.kodeba,
                kodeba_pembayaran: baganAkunPembayaran.kodeba,
              });

              if (res.status) {
                // Reset withdraw/database IDs to 0
                setTransactions((prev) =>
                  prev.map((tx) =>
                    selectedTransactions.has(tx.no_order)
                      ? { ...tx, id_database_withdraw: 0 }
                      : tx
                  )
                );

                setBiayaLainnya((prev) =>
                  prev.map((b) =>
                    selectedBiaya.has(b.deposit_id) ? { ...b, id_database: 0 } : b
                  )
                );

                setSelectedTransactions(new Set());
                setSelectedBiaya(new Set());
                Alert.alert('Sukses', 'Jurnal penarikan berhasil dibatalkan.');
              } else {
                Alert.alert('Gagal', res.reason || 'Gagal membatalkan jurnal penarikan');
              }
            } catch (error) {
              Alert.alert('Error', 'Terjadi kesalahan jaringan saat membatalkan jurnal.');
            } finally {
              setFetching(false);
            }
          },
        },
      ]
    );
  };

  // Select all checkbox handler
  const handleSelectAllToggle = () => {
    const isTrans = activeSubTab === 'transaksi';

    if (isTrans) {
      const selectableTx = filteredTransactions.filter(
        (tx) => tx.id_database && tx.id_database !== -1
      );
      const allChecked =
        selectableTx.length > 0 &&
        selectableTx.every((tx) => selectedTransactions.has(tx.no_order));

      const nextSet = new Set(selectedTransactions);
      if (allChecked) {
        selectableTx.forEach((tx) => nextSet.delete(tx.no_order));
      } else {
        selectableTx.forEach((tx) => nextSet.add(tx.no_order));
      }
      setSelectedTransactions(nextSet);
    } else {
      const allChecked =
        filteredBiaya.length > 0 && filteredBiaya.every((b) => selectedBiaya.has(b.deposit_id));

      const nextSet = new Set(selectedBiaya);
      if (allChecked) {
        filteredBiaya.forEach((b) => nextSet.delete(b.deposit_id));
      } else {
        filteredBiaya.forEach((b) => nextSet.add(b.deposit_id));
      }
      setSelectedBiaya(nextSet);
    }
  };

  // Filters logic based on active tab
  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === 'belum_dibuat') return !tx.id_database_withdraw;
    if (activeTab === 'telah_dibuat') return tx.id_database_withdraw !== 0;
    return true;
  });

  const filteredBiaya = biayaLainnya.filter((b) => {
    if (activeTab === 'belum_dibuat') return !b.id_database;
    if (activeTab === 'telah_dibuat') return b.id_database !== 0;
    return true;
  });

  const activeEcom = ecommerceList.find((el) => el.id === idEcommerce);
  const isTokopediaManual = activeEcom?.platform === 'TOKOPEDIA' && !syncSaldoHistory;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} edges={['bottom', 'left', 'right']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          style={styles.menuBtn}
        >
          <Ionicons name="menu" size={26} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Penarikan (Settlement)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {/* Configuration / Filters Section */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setFilterCollapsed(!filterCollapsed)}
          >
            <View style={styles.collapseTitleRow}>
              <Ionicons name="funnel-outline" size={18} color="#4f46e5" />
              <Text style={styles.collapseTitle}>Parameter & Filter Penarikan</Text>
            </View>
            <Ionicons
              name={filterCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color="#6b7280"
            />
          </TouchableOpacity>

          {!filterCollapsed && (
            <View style={styles.filterContent}>
              {/* E-Commerce Picker */}
              <Text style={styles.label}>Platform E-Commerce</Text>
              <View style={styles.pickerContainer}>
                {ecommerceList.length > 0 ? (
                  <Picker
                    selectedValue={idEcommerce}
                    onValueChange={(val) => {
                      setTransactions([]);
                      setBiayaLainnya([]);
                      setIdEcommerce(val);
                    }}
                    style={styles.picker}
                  >
                    {ecommerceList.map((e) => (
                      <Picker.Item key={e.id} label={`${e.name} (${e.platform})`} value={e.id} />
                    ))}
                  </Picker>
                ) : (
                  <Text style={styles.placeholderText}>Memuat Akun E-Commerce...</Text>
                )}
              </View>

              {/* Date Filters (Hidden if Tokopedia Manual upload is active) */}
              {!isTokopediaManual && (
                <>
                  <Text style={styles.label}>Rentang Tanggal</Text>
                  <View style={styles.datePickerRow}>
                    <TouchableOpacity
                      onPress={() => setShowDatePickerStart(true)}
                      style={styles.dateBtn}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#4b5563" style={{ marginRight: 6 }} />
                      <Text style={styles.dateBtnText}>{dateStart.format('DD-MM-YYYY')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.dateDivider}>s/d</Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePickerEnd(true)}
                      style={styles.dateBtn}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#4b5563" style={{ marginRight: 6 }} />
                      <Text style={styles.dateBtnText}>{dateEnd.format('DD-MM-YYYY')}</Text>
                    </TouchableOpacity>
                  </View>

                  {showDatePickerStart && (
                    <DateTimePicker
                      value={dateStart.toDate()}
                      mode="date"
                      onChange={(e, d) => handleDateStartPick(d)}
                    />
                  )}
                  {showDatePickerEnd && (
                    <DateTimePicker
                      value={dateEnd.toDate()}
                      mode="date"
                      onChange={(e, d) => handleDateEndPick(d)}
                    />
                  )}

                  {dateChanged && (
                    <TouchableOpacity style={styles.searchBtn} onPress={fetchSettlementData}>
                      <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.searchBtnText}>Cari</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Chart of Accounts Config Selection */}
              <View style={styles.divider} />
              <View style={styles.accSection}>
                <View style={styles.accField}>
                  <Text style={styles.label}>Bagan Akun Pembayaran (Kas/Bank)</Text>
                  <TouchableOpacity
                    onPress={() => setShowBaganAkunModal('pembayaran')}
                    style={styles.accInputBtn}
                  >
                    <Text
                      style={
                        baganAkunPembayaran.kodeba ? styles.accInputText : styles.accInputTextPlaceholder
                      }
                      numberOfLines={1}
                    >
                      {baganAkunPembayaran.kodeba
                        ? `${baganAkunPembayaran.kodeba} - ${baganAkunPembayaran.nama}`
                        : 'Pilih Akun Kas/Bank'}
                    </Text>
                    <Ionicons name="search" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.accField}>
                  <Text style={styles.label}>Bagan Akun Piutang</Text>
                  <TouchableOpacity
                    onPress={() => setShowBaganAkunModal('piutang')}
                    style={styles.accInputBtn}
                  >
                    <Text style={styles.accInputText} numberOfLines={1}>
                      {baganAkunPiutang.kodeba
                        ? `${baganAkunPiutang.kodeba} - ${baganAkunPiutang.nama}`
                        : 'Pilih Akun Piutang'}
                    </Text>
                    <Ionicons name="search" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Auto Journaling toggle */}
              <View style={styles.divider} />
              <View style={styles.autoJournalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.autoJournalTitle}>Penjurnalan Otomatis</Text>
                  <Text style={styles.autoJournalSubtitle}>
                    Jurnal settlement otomatis untuk marketplace ini
                  </Text>
                </View>
                {autoJournalingLoading ? (
                  <ActivityIndicator size="small" color="#4f46e5" />
                ) : (
                  <Switch
                    value={autoJournalingEnabled}
                    onValueChange={handleAutoJournalingToggle}
                    thumbColor={autoJournalingEnabled ? '#4f46e5' : '#f4f3f4'}
                    trackColor={{ false: '#767577', true: '#c7d2fe' }}
                  />
                )}
              </View>
            </View>
          )}
        </View>

        {/* Tokopedia Upload File manual flow */}
        {isTokopediaManual && (
          <View style={styles.uploadCard}>
            <Ionicons name="cloud-upload-outline" size={36} color="#42b549" style={{ marginBottom: 8 }} />
            <Text style={styles.uploadTitle}>Mutasi Tokopedia Manual</Text>
            <Text style={styles.uploadSubtitle}>
              Unggah file mutasi / settlement dari Tokopedia Seller Center Anda untuk diproses.
            </Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleTokopediaUpload}>
              <Ionicons name="document-text-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.uploadBtnText}>Pilih & Unggah File</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Navigation Main (Semua, Belum Dibuat, Telah Dibuat) */}
        <View style={styles.tabBar}>
          {(['semua', 'belum_dibuat', 'telah_dibuat'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => {
                setActiveTab(tab);
                setSelectedTransactions(new Set());
                setSelectedBiaya(new Set());
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'semua' ? 'Semua' : tab === 'belum_dibuat' ? 'Belum Dibuat' : 'Telah Dibuat'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sub-Tab Navigation (Transaksi vs Biaya) */}
        <View style={styles.subTabBar}>
          {(['transaksi', 'biaya'] as const).map((subTab) => (
            <TouchableOpacity
              key={subTab}
              style={[styles.subTabItem, activeSubTab === subTab && styles.subTabItemActive]}
              onPress={() => {
                setActiveSubTab(subTab);
              }}
            >
              <Text style={[styles.subTabText, activeSubTab === subTab && styles.subTabTextActive]}>
                {subTab === 'transaksi'
                  ? `Transaksi (${filteredTransactions.length})`
                  : `Biaya Lainnya (${filteredBiaya.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List Content */}
        {fetching ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingAreaText}>Mengambil data...</Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            {/* Header select all */}
            <View style={styles.selectHeader}>
              <TouchableOpacity style={styles.selectHeaderBtn} onPress={handleSelectAllToggle}>
                <Ionicons
                  name={
                    activeSubTab === 'transaksi'
                      ? filteredTransactions.filter((tx) => tx.id_database && tx.id_database !== -1)
                          .length > 0 &&
                        filteredTransactions
                          .filter((tx) => tx.id_database && tx.id_database !== -1)
                          .every((tx) => selectedTransactions.has(tx.no_order))
                        ? 'checkbox'
                        : 'square-outline'
                      : filteredBiaya.length > 0 &&
                        filteredBiaya.every((b) => selectedBiaya.has(b.deposit_id))
                      ? 'checkbox'
                      : 'square-outline'
                  }
                  size={20}
                  color="#4f46e5"
                />
                <Text style={styles.selectHeaderLabel}>Pilih Semua Halaman Ini</Text>
              </TouchableOpacity>
            </View>

            {/* Transaksi List */}
            {activeSubTab === 'transaksi' ? (
              filteredTransactions.length > 0 ? (
                filteredTransactions.map((item) => {
                  const isChecked = selectedTransactions.has(item.no_order);
                  const isSelectable = item.id_database && item.id_database !== -1;
                  const returStatus = item.retur
                    ? item.retur.status === 'rejected'
                      ? '❌'
                      : item.retur.status === 'approved'
                      ? item.retur.lunas
                        ? '⚠️'
                        : '☑️'
                      : ''
                    : '';

                  // Return Tooltip Explanation mock
                  const returExplanation =
                    returStatus === '☑️'
                      ? 'Retur disetujui & belum lunas'
                      : returStatus === '❌'
                      ? 'Retur ditolak'
                      : returStatus === '⚠️'
                      ? 'Retur disetujui & sudah lunas'
                      : '';

                  // Formula percentage
                  const totalRetur = item.retur && !item.retur.lunas ? item.retur.total : 0;
                  const diff = item.bayar - (item.total - totalRetur);
                  const percentage = item.total > 0 ? (100 * diff) / item.total : 0;
                  const isHighFee = percentage >= 25;

                  return (
                    <View key={item.no_order} style={styles.rowCard}>
                      <TouchableOpacity
                        disabled={!isSelectable}
                        onPress={() => {
                          const next = new Set(selectedTransactions);
                          if (next.has(item.no_order)) next.delete(item.no_order);
                          else next.add(item.no_order);
                          setSelectedTransactions(next);
                        }}
                        style={styles.checkboxContainer}
                      >
                        <Ionicons
                          name={isChecked ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelectable ? '#4f46e5' : '#d1d5db'}
                        />
                      </TouchableOpacity>

                      <View style={styles.rowDetails}>
                        <View style={styles.invoiceRow}>
                          <Text style={styles.invoiceText}>{item.invoice || item.no_order}</Text>
                          {item.id_database === -1 ? (
                            <Text style={styles.dbWarning}>
                              ⚠️
                            </Text>
                          ) : (
                            <Text style={styles.dbText}>ID: {item.id_database}</Text>
                          )}
                        </View>

                        <View style={styles.detailTextRow}>
                          <Text style={styles.detailLabel}>WD ID:</Text>
                          <Text style={styles.detailVal}>
                            {item.id_database_withdraw ? item.id_database_withdraw : '-'}
                          </Text>
                        </View>

                        <View style={styles.detailTextRow}>
                          <Text style={styles.detailLabel}>Tanggal:</Text>
                          <Text style={styles.detailVal}>
                            {moment(item.tanggal).format('DD-MM HH:mm')}
                          </Text>
                        </View>

                        <View style={styles.detailTextRow}>
                          <Text style={styles.detailLabel}>Total Omset:</Text>
                          <Text style={styles.detailVal}>{formatRupiah(item.total)}</Text>
                        </View>

                        {item.retur && (
                          <View style={styles.detailTextRow}>
                            <Text style={styles.detailLabel}>Retur:</Text>
                            <Text style={[styles.detailVal, { color: '#f59e0b', fontWeight: 'bold' }]}>
                              {formatRupiah(item.retur.total)} {returStatus} ({returExplanation})
                            </Text>
                          </View>
                        )}

                        <View style={styles.detailTextRow}>
                          <Text style={styles.detailLabel}>Net Bayar:</Text>
                          <Text style={styles.detailValBold}>{formatRupiah(item.bayar)}</Text>
                        </View>

                        <View style={styles.detailTextRow}>
                          <Text style={styles.detailLabel}>% Biaya:</Text>
                          <Text style={[styles.detailValBold, { color: isHighFee ? '#ef4444' : '#1f2937' }]}>
                            {percentage.toFixed(2)}%
                          </Text>
                        </View>
                      </View>

                      {/* Detail modal trigger */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTxForDetail(item);
                          setShowDetailModal(true);
                        }}
                        style={styles.infoBtn}
                      >
                        <Ionicons name="information-circle-outline" size={24} color="#6366f1" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="documents-outline" size={48} color="#9ca3af" />
                  <Text style={styles.emptyText}>Tidak ada transaksi settlement ditemukan</Text>
                </View>
              )
            ) : filteredBiaya.length > 0 ? (
              filteredBiaya.map((item) => {
                const isChecked = selectedBiaya.has(item.deposit_id);

                return (
                  <View key={item.deposit_id} style={styles.rowCard}>
                    <TouchableOpacity
                      onPress={() => {
                        const next = new Set(selectedBiaya);
                        if (next.has(item.deposit_id)) next.delete(item.deposit_id);
                        else next.add(item.deposit_id);
                        setSelectedBiaya(next);
                      }}
                      style={styles.checkboxContainer}
                    >
                      <Ionicons name={isChecked ? 'checkbox' : 'square-outline'} size={22} color="#4f46e5" />
                    </TouchableOpacity>

                    <View style={styles.rowDetails}>
                      <View style={styles.invoiceRow}>
                        <Text style={styles.invoiceText}>{item.deposit_id}</Text>
                        {item.id_database ? (
                          <Text style={styles.dbText}>Jurnal: {item.id_database}</Text>
                        ) : (
                          <Text style={styles.dbPending}>Belum Terproses</Text>
                        )}
                      </View>
                      <Text style={styles.biayaName}>{item.nama}</Text>

                      <View style={styles.detailTextRow}>
                        <Text style={styles.detailLabel}>Tanggal:</Text>
                        <Text style={styles.detailVal}>
                          {moment(item.date).format('DD-MM-YYYY HH:mm')}
                        </Text>
                      </View>

                      <View style={styles.detailTextRow}>
                        <Text style={styles.detailLabel}>Tipe:</Text>
                        <Text style={styles.detailVal}>{item.tipe}</Text>
                      </View>

                      <View style={styles.detailTextRow}>
                        <Text style={styles.detailLabel}>Nominal:</Text>
                        <Text style={styles.detailValBold}>{formatRupiah(item.amount)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="card-outline" size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>Tidak ada biaya lainnya ditemukan</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Floating Bottom Card Summary */}
      <View style={styles.summaryCard}>
        {/* Statistics progress bar for BUAT process */}
        {creating && processingStats && (
          <View style={styles.progressSection}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${
                      (processingStats.processedItems / (processingStats.totalItems || 1)) * 100
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              Memproses {processingStats.processedItems} dari {processingStats.totalItems} item
            </Text>
            <View style={styles.statsSummaryRow}>
              <Text style={[styles.statsBadgeSmall, { color: '#059669' }]}>
                ✓ Sukses: {processingStats.created}
              </Text>
              <Text style={[styles.statsBadgeSmall, { color: '#2563eb' }]}>
                ℹ Ada: {processingStats.alreadyCreated}
              </Text>
              <Text style={[styles.statsBadgeSmall, { color: '#dc2626' }]}>
                ✗ Gagal: {processingStats.failed}
              </Text>
            </View>

            {processingStats.processedItems > 0 && (() => {
              const elapsedTime = Date.now() - processingStats.startTime;
              const itemsPerMs = processingStats.processedItems / elapsedTime;
              const remainingItems = processingStats.totalItems - processingStats.processedItems;
              const estimatedRemainingSeconds = Math.round(remainingItems / itemsPerMs / 1000);
              return (
                <Text style={styles.etaText}>Estimasi tersisa: {estimatedRemainingSeconds} detik</Text>
              );
            })()}

            <TouchableOpacity
              onPress={() => {
                setCancelProcessing(true);
                cancelProcessingRef.current = true;
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Batal Pemrosesan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date picking / Actions bottom container */}
        {!creating && (
          <View style={styles.summaryTop}>
            <View style={styles.totalsColumn}>
              <View style={styles.totalSummaryRow}>
                <Text style={styles.totalSummaryLabel}>Total Omset:</Text>
                <Text style={styles.totalSummaryValue}>{formatRupiah(totalOmset)}</Text>
              </View>
              <View style={styles.totalSummaryRow}>
                <Text style={styles.totalSummaryLabel}>Akan Masuk Kas:</Text>
                <Text style={styles.totalSummaryValueBold}>{formatRupiah(totalBayar)}</Text>
              </View>
            </View>

            {/* Date Picker Jurnal input for Belum Dibuat */}
            {activeTab === 'belum_dibuat' && (
              <View style={styles.journalDateSection}>
                <Text style={styles.journalDateLabel}>Tanggal Jurnal:</Text>
                <View style={styles.journalPickerButtons}>
                  <TouchableOpacity
                    onPress={() => setShowDatePickerJurnal(true)}
                    style={styles.journalPickerBtn}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#4b5563" />
                    <Text style={styles.journalPickerBtnText}>
                      {tanggalJurnal.format('DD-MM-YYYY')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowTimePickerJurnal(true)}
                    style={[styles.journalPickerBtn, { marginLeft: 6 }]}
                  >
                    <Ionicons name="time-outline" size={14} color="#4b5563" />
                    <Text style={styles.journalPickerBtnText}>{tanggalJurnal.format('HH:mm:ss')}</Text>
                  </TouchableOpacity>
                </View>

                {showDatePickerJurnal && (
                  <DateTimePicker
                    value={tanggalJurnal.toDate()}
                    mode="date"
                    onChange={(event, date) => {
                      setShowDatePickerJurnal(false);
                      if (date) {
                        const newD = moment(date);
                        const nextJurnal = tanggalJurnal
                          .clone()
                          .year(newD.year())
                          .month(newD.month())
                          .date(newD.date());
                        setTanggalJurnal(nextJurnal);
                        setIsManuallyEdited(true);
                      }
                    }}
                  />
                )}

                {showTimePickerJurnal && (
                  <DateTimePicker
                    value={tanggalJurnal.toDate()}
                    mode="time"
                    onChange={(event, date) => {
                      setShowTimePickerJurnal(false);
                      if (date) {
                        const newT = moment(date);
                        const nextJurnal = tanggalJurnal
                          .clone()
                          .hour(newT.hour())
                          .minute(newT.minute())
                          .second(newT.second());
                        setTanggalJurnal(nextJurnal);
                        setIsManuallyEdited(true);
                      }
                    }}
                  />
                )}
              </View>
            )}
          </View>
        )}

        {/* Action button trigger (BUAT / BATAL) */}
        {!creating && (
          <View style={styles.actionButtonsRow}>
            {activeTab === 'belum_dibuat' && (
              <TouchableOpacity style={styles.actionCreateBtn} onPress={handleCreateJurnal}>
                <Ionicons name="create-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnTextBold}>BUAT JURNAL</Text>
              </TouchableOpacity>
            )}
            {activeTab === 'telah_dibuat' && (
              <TouchableOpacity style={styles.actionCancelBtn} onPress={handleCancelJurnal}>
                <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnTextBold}>BATALKAN JURNAL</Text>
              </TouchableOpacity>
            )}
            {activeTab === 'semua' && (
              <Text style={styles.activeTabTip}>
                Pilih tab "Belum Dibuat" atau "Telah Dibuat" untuk memproses settlement.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Reusable Chart of Accounts Search Selector */}
      <BaganAkunSearchModal
        open={showBaganAkunModal !== ''}
        onClose={() => setShowBaganAkunModal('')}
        onSelect={(item) => {
          if (showBaganAkunModal === 'pembayaran') {
            setBaganAkunPembayaran(item);
          } else if (showBaganAkunModal === 'piutang') {
            setBaganAkunPiutang(item);
          } else if (showBaganAkunModal === 'auto_pembayaran') {
            setAutoJournalPembayaran(item);
          } else if (showBaganAkunModal === 'auto_piutang') {
            setAutoJournalPiutang(item);
          }
        }}
        parent={
          showBaganAkunModal === 'pembayaran' || showBaganAkunModal === 'auto_pembayaran'
            ? '111'
            : '11'
        }
        title={
          showBaganAkunModal === 'pembayaran' || showBaganAkunModal === 'auto_pembayaran'
            ? 'Cari Bagan Akun Kas/Bank'
            : 'Cari Bagan Akun Piutang'
        }
      />

      {/* Auto Journal Configuration Dialog Modal */}
      <Modal
        visible={showAutoJournalConfigDialog}
        animationType="fade"
        transparent
        onRequestClose={() => !autoJournalConfigLoading && setShowAutoJournalConfigDialog(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>Konfigurasi Bagan Akun Auto Journaling</Text>
            <Text style={styles.dialogSubtitle}>
              Pilih bagan akun yang akan digunakan untuk menjurnal transaksi e-commerce settlement ini secara otomatis.
            </Text>

            <View style={styles.dialogFields}>
              <Text style={styles.dialogLabel}>Bagan Akun Pembayaran (Kas/Bank) *</Text>
              <TouchableOpacity
                onPress={() => setShowBaganAkunModal('auto_pembayaran')}
                style={styles.accInputBtn}
              >
                <Text
                  style={
                    autoJournalPembayaran.kodeba ? styles.accInputText : styles.accInputTextPlaceholder
                  }
                  numberOfLines={1}
                >
                  {autoJournalPembayaran.kodeba
                    ? `${autoJournalPembayaran.kodeba} - ${autoJournalPembayaran.nama}`
                    : 'Pilih Akun Kas/Bank'}
                </Text>
                <Ionicons name="search" size={16} color="#6b7280" />
              </TouchableOpacity>
              <Text style={styles.fieldHelp}>
                Akun kas/bank penerima dana cair (contoh: 111.1 - Bank BCA)
              </Text>

              <Text style={[styles.dialogLabel, { marginTop: 12 }]}>Bagan Akun Piutang *</Text>
              <TouchableOpacity
                onPress={() => setShowBaganAkunModal('auto_piutang')}
                style={styles.accInputBtn}
              >
                <Text style={styles.accInputText} numberOfLines={1}>
                  {autoJournalPiutang.kodeba
                    ? `${autoJournalPiutang.kodeba} - ${autoJournalPiutang.nama}`
                    : 'Pilih Akun Piutang'}
                </Text>
                <Ionicons name="search" size={16} color="#6b7280" />
              </TouchableOpacity>
              <Text style={styles.fieldHelp}> Akun piutang marketplace (default: 113 - PIUTANG USAHA)</Text>
            </View>

            <View style={styles.dialogFooter}>
              <TouchableOpacity
                disabled={autoJournalConfigLoading}
                onPress={() => setShowAutoJournalConfigDialog(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={autoJournalConfigLoading || !autoJournalPembayaran.kodeba}
                onPress={handleSaveAutoJournalConfig}
                style={[
                  styles.dialogSaveBtn,
                  (!autoJournalPembayaran.kodeba || autoJournalConfigLoading) && styles.dialogDisabledBtn,
                ]}
              >
                {autoJournalConfigLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.dialogSaveBtnText}>Simpan & Aktifkan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail Breakdown Modal */}
      <PenarikanDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedTxForDetail(null);
        }}
        transaction={selectedTxForDetail}
        platform={activeEcom?.platform || ''}
        idEcommerce={idEcommerce}
        ecommerceName={activeEcom?.name || ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    height: 56,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  collapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  collapseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 8,
  },
  filterContent: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: '#fff',
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 44,
    width: '100%',
  },
  placeholderText: {
    padding: 12,
    color: '#9ca3af',
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  dateBtnText: {
    fontSize: 14,
    color: '#1f2937',
  },
  dateDivider: {
    paddingHorizontal: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  searchBtn: {
    height: 40,
    backgroundColor: '#4f46e5',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  accSection: {
    flexDirection: 'column',
  },
  accField: {
    marginBottom: 12,
  },
  accInputBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  accInputText: {
    fontSize: 13,
    color: '#1f2937',
    flex: 1,
  },
  accInputTextPlaceholder: {
    fontSize: 13,
    color: '#9ca3af',
    flex: 1,
  },
  autoJournalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  autoJournalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  autoJournalSubtitle: {
    fontSize: 11,
    color: '#60a5fa',
    marginTop: 2,
  },
  uploadCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  uploadBtn: {
    height: 40,
    backgroundColor: '#42b549',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: '#4f46e5',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  tabTextActive: {
    color: '#fff',
  },
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
  },
  subTabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabItemActive: {
    borderBottomColor: '#4f46e5',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  subTabTextActive: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  listSection: {
    marginHorizontal: 12,
    marginTop: 8,
  },
  selectHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectHeaderLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '500',
    color: '#4b5563',
  },
  rowCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopWidth: 0,
    padding: 12,
    alignItems: 'center',
  },
  checkboxContainer: {
    paddingRight: 12,
    justifyContent: 'center',
  },
  rowDetails: {
    flex: 1,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  invoiceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  dbWarning: {
    fontSize: 14,
  },
  dbText: {
    fontSize: 11,
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dbPending: {
    fontSize: 10,
    color: '#d97706',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  biayaName: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  detailTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailVal: {
    fontSize: 12,
    color: '#374151',
  },
  detailValBold: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  infoBtn: {
    padding: 8,
    marginLeft: 4,
  },
  loadingArea: {
    paddingVertical: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAreaText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  summaryCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  totalsColumn: {
    flex: 1,
  },
  totalSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  totalSummaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 100,
  },
  totalSummaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  totalSummaryValueBold: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  journalDateSection: {
    flex: 1.2,
    alignItems: 'flex-end',
  },
  journalDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 4,
  },
  journalPickerButtons: {
    flexDirection: 'row',
  },
  journalPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
  },
  journalPickerBtnText: {
    fontSize: 11,
    color: '#1f2937',
    marginLeft: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
  },
  actionCreateBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#10b981',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCancelBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnTextBold: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  activeTabTip: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    width: '100%',
  },
  progressSection: {
    paddingVertical: 4,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  statsBadgeSmall: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  etaText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 6,
  },
  dialogSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    marginBottom: 16,
  },
  dialogFields: {
    marginBottom: 20,
  },
  dialogLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  fieldHelp: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  dialogFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dialogCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogCancelBtnText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '600',
  },
  dialogSaveBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogDisabledBtn: {
    backgroundColor: '#a5b4fc',
  },
  dialogSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
