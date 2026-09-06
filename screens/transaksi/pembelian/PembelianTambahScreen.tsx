import React, { useState, useEffect } from 'react';
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
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import SearchBarangModal, { BarangItem } from '../../../components/SearchBarangModal';
import TambahBarangModal, { NewBarangData } from '../../../components/pembelian/TambahBarangModal';

interface ItemDetail {
  id: number;
  nama: string;
  merk: string;
  kategori: string;
  satuan: string;
  qty: string;
  hargabeli: string; // Include PPN price
  dpp: string; // Exclude PPN price
  pricelist: string;
  qty_print: string;
}

interface Warehouse {
  id: string;
  name: string;
  type: string;
}

interface PreOrderItem {
  id_masterbarang: number;
  nama: string;
  qty: number;
  harga: number;
  merk: string;
  satuan: string;
}

interface PreOrderData {
  id?: number;
  tanggal_po: string;
  tanggal_perkiraan_sampai: string;
  id_supplier: number;
  supplier_nama?: string;
  notes: string;
  items: PreOrderItem[];
  id_pembelian?: number;
}

// Helper function to format datetime for MySQL
const formatDateTimeForMySQL = (date: Date | string): string => {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
};

export default function PembelianTambahScreen() {
  // Form state
  const [tanggalInvoice, setTanggalInvoice] = useState('');
  const [idSupplier, setIdSupplier] = useState(0);
  const [supplierName, setSupplierName] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [kodeBaganAkun, setKodeBaganAkun] = useState('');
  const [baganAkunName, setBaganAkunName] = useState('');
  const [bayar, setBayar] = useState('');
  const [biayaTambahan, setBiayaTambahan] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [persentaseBiayaTambahan, setPersentaseBiayaTambahan] = useState(0);

  // PPN state
  const [isPkpActive, setIsPkpActive] = useState(false);
  const [ppnRate, setPpnRate] = useState(11);
  const [ppnMode, setPpnMode] = useState<'include' | 'exclude'>('exclude');

  // Item details
  const [itemDetails, setItemDetails] = useState<ItemDetail[]>([]);

  // Warehouses
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Modal states
  const [showSupplier, setShowSupplier] = useState(false);
  const [showBaganAkun, setShowBaganAkun] = useState(false);
  const [showBarang, setShowBarang] = useState(false);
  const [showTambahBarang, setShowTambahBarang] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-order related state
  const [selectedPreOrders, setSelectedPreOrders] = useState<PreOrderData[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrderData[]>([]);
  const [showPreOrderSearch, setShowPreOrderSearch] = useState(false);
  const [loadingPreOrders, setLoadingPreOrders] = useState(false);
  const [pendingPreOrdersCount, setPendingPreOrdersCount] = useState(0);

  // DP Beli related state
  const [pendingDPBeli, setPendingDPBeli] = useState<any[]>([]);
  const [loadingDPBeli, setLoadingDPBeli] = useState(false);

  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handle po_ids from navigation params (from PreOrder screen)
  useEffect(() => {
    const params = route.params as any;
    if (params?.po_ids) {
      handlePreOrderIds(params.po_ids);
      // Clear param after processing
      navigation.setParams({ po_ids: undefined } as any);
    }
  }, [route.params]);

  // Fetch pending DP Beli when supplier changes
  useEffect(() => {
    const fetchPendingDPBeli = async () => {
      if (idSupplier === 0) {
        setPendingDPBeli([]);
        return;
      }
      try {
        setLoadingDPBeli(true);
        const token = await getTokenAuth();
        if (!token) return;

        const start = '2020-01-01';
        const end = moment().add(1, 'years').format('YYYY-MM-DD');
        const dpResponse = await fetch(`${API_BASE_URL}/get/dpbeli/interval/${start}/${end}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dpData = await dpResponse.json();
        
        if (dpData.status && dpData.data) {
          const dpPending = dpData.data.filter((item: any) => 
            String(item.id_supplier) === String(idSupplier) && Number(item.dp) > Number(item.terpakai)
          );
          setPendingDPBeli(dpPending);
        }
      } catch (error) {
        console.error('Error fetching pending DP Beli:', error);
      } finally {
        setLoadingDPBeli(false);
      }
    };

    fetchPendingDPBeli();
  }, [idSupplier]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load PKP settings
      const token = await getTokenAuth();
      if (!token) return;

      const settingsRes = await fetch(`${API_BASE_URL}/get/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const settingsData = await settingsRes.json();

      if (settingsData.status && settingsData.data) {
        const pkpSetting = settingsData.data.find((s: any) => s.key === 'isPkpActive');
        if (pkpSetting) {
          setIsPkpActive(pkpSetting.value === 'true' || pkpSetting.value === true);
        }
      }

      // Load warehouses
      const warehouseRes = await fetch(`${API_BASE_URL}/get/warehouse`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const warehouseData = await warehouseRes.json();

      if (warehouseData.status && warehouseData.data) {
        // Filter out SHOPEE_BOOKING_PENDING warehouses from purchase form
        const filteredWarehouses = warehouseData.data.filter((wh: Warehouse) => wh.type !== 'SHOPEE_BOOKING_PENDING');
        setWarehouses(filteredWarehouses);
      }

      // Set default date to now
      const now = new Date();
      const formattedDate = now.toISOString().slice(0, 16);
      setTanggalInvoice(formattedDate);

    } catch (error) {
      console.error('Load initial data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSelect = async (supplier: SupplierItem) => {
    setIdSupplier(supplier.id);
    setSupplierName(supplier.nama);

    // Fetch pending pre-orders for this supplier
    try {
      const token = await getTokenAuth();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/preorder`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.status && data.data) {
        const pending = data.data.filter(
          (po: PreOrderData) => !po.id_pembelian && po.id_supplier === supplier.id
        );
        setPendingPreOrdersCount(pending.length);
      }
    } catch (error) {
      console.error('Error fetching pending pre-orders:', error);
    }
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setKodeBaganAkun(item.kode);
    setBaganAkunName(item.nama);
  };

  const handleBarangSelect = (items: BarangItem[]) => {
    const newItems: ItemDetail[] = items.map(item => {
      const initialPrice = (item.hpp || 0).toString();
      return {
        id: item.id,
        nama: item.nama,
        merk: item.merk || '',
        kategori: item.kategori || '',
        satuan: item.satuan || '',
        qty: '1',
        hargabeli: initialPrice,
        dpp: initialPrice,
        pricelist: initialPrice,
        qty_print: '1',
      };
    });

    const combined = [...itemDetails, ...newItems];
    const res = recalculateItemsWithBiaya(combined, biayaTambahan, isPkpActive, ppnRate, ppnMode);
    setItemDetails(res.items);
    setPersentaseBiayaTambahan(res.persentase);
  };

  const handleTambahBarangDone = (data: NewBarangData) => {
    const newItem: ItemDetail = {
      id: data.id,
      nama: data.nama,
      merk: data.merk,
      kategori: data.kategori,
      satuan: data.satuan,
      qty: '1',
      hargabeli: '0',
      dpp: '0',
      pricelist: '0',
      qty_print: '1',
    };

    const combined = [...itemDetails, newItem];
    const res = recalculateItemsWithBiaya(combined, biayaTambahan, isPkpActive, ppnRate, ppnMode);
    setItemDetails(res.items);
    setPersentaseBiayaTambahan(res.persentase);
  };

  // Pre-order handling functions
  const handlePreOrderIds = async (poIdsParam: string) => {
    try {
      setLoadingPreOrders(true);

      // Parse comma-separated IDs
      const poIds = poIdsParam.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));

      if (poIds.length === 0) {
        Alert.alert('Error', 'No valid pre-order IDs');
        return;
      }

      // Fetch pre-orders
      const token = await getTokenAuth();
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/get/preorder/by-ids?ids=${poIds.join(',')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.status && data.data) {
        const preOrders = data.data;

        // Validate same supplier
        const firstSupplierId = preOrders[0].id_supplier;
        const allSame = preOrders.every((po: PreOrderData) => po.id_supplier === firstSupplierId);

        if (!allSame) {
          Alert.alert('Error', 'Semua pre-order harus memiliki supplier yang sama');
          return;
        }

        // Validate not converted
        const anyConverted = preOrders.some((po: PreOrderData) => po.id_pembelian);
        if (anyConverted) {
          Alert.alert('Error', 'Beberapa pre-order sudah dikonversi');
          return;
        }

        // Populate form
        populateFromPreOrders(preOrders);
      }
    } catch (error) {
      console.error('Error loading pre-orders:', error);
      Alert.alert('Error', 'Failed to load pre-orders');
    } finally {
      setLoadingPreOrders(false);
    }
  };

  const populateFromPreOrders = (preOrders: PreOrderData[]) => {
    // Set supplier
    const supplierId = preOrders[0].id_supplier;
    const supplierName = preOrders[0].supplier_nama || '';
    setIdSupplier(supplierId);
    setSupplierName(supplierName);

    // Merge items from all pre-orders
    const itemMap = new Map<number, ItemDetail>();

    preOrders.forEach(po => {
      po.items.forEach(item => {
        if (itemMap.has(item.id_masterbarang)) {
          // Combine quantities
          const existing = itemMap.get(item.id_masterbarang)!;
          existing.qty = (parseInt(existing.qty) + item.qty).toString();
        } else {
          // Add new item
          itemMap.set(item.id_masterbarang, {
            id: item.id_masterbarang,
            nama: item.nama,
            merk: item.merk || '',
            kategori: '',
            satuan: item.satuan || 'pcs',
            qty: item.qty.toString(),
            hargabeli: item.harga.toString(),
            dpp: item.harga.toString(),
            pricelist: item.harga.toString(),
            qty_print: item.qty.toString(),
          });
        }
      });
    });

    // Convert map to array
    const mergedItems = Array.from(itemMap.values());
    const res = recalculateItemsWithBiaya(mergedItems, biayaTambahan, isPkpActive, ppnRate, ppnMode);
    setItemDetails(res.items);
    setPersentaseBiayaTambahan(res.persentase);

    // Set selected pre-orders
    setSelectedPreOrders(preOrders);

    // Set notes
    const notes = preOrders.map(po => `PO #${po.id}: ${po.notes}`).join('\n');
    setKeterangan(notes);
  };

  const fetchAllPreOrders = async () => {
    try {
      setLoadingPreOrders(true);
      const token = await getTokenAuth();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/preorder`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.status && data.data) {
        // Filter only pending pre-orders
        const pending = data.data.filter((po: PreOrderData) => !po.id_pembelian);
        setPreOrders(pending);
      }
    } catch (error) {
      console.error('Error loading pre-orders:', error);
      Alert.alert('Error', 'Failed to load pre-orders');
    } finally {
      setLoadingPreOrders(false);
    }
  };

  const handleOpenPreOrderSearch = async () => {
    if (idSupplier === 0) {
      Alert.alert('Info', 'Silakan pilih supplier terlebih dahulu');
      return;
    }
    await fetchAllPreOrders();
    setShowPreOrderSearch(true);
  };

  const handleTogglePreOrder = (preOrder: PreOrderData) => {
    // Check if already selected
    const isSelected = selectedPreOrders.some(po => po.id === preOrder.id);

    if (isSelected) {
      // Remove from selection
      setSelectedPreOrders(selectedPreOrders.filter(po => po.id !== preOrder.id));
    } else {
      // Validate same supplier
      if (selectedPreOrders.length > 0) {
        const firstSupplierId = selectedPreOrders[0].id_supplier;
        if (preOrder.id_supplier !== firstSupplierId) {
          Alert.alert('Error', 'Semua pre-order harus memiliki supplier yang sama');
          return;
        }
      }
      // Add to selection
      setSelectedPreOrders([...selectedPreOrders, preOrder]);
    }
  };

  const handleConfirmPreOrderSelection = () => {
    if (selectedPreOrders.length === 0) {
      Alert.alert('Info', 'Silakan pilih minimal 1 pre-order');
      return;
    }

    populateFromPreOrders(selectedPreOrders);
    setShowPreOrderSearch(false);
  };

  const handleRemovePreOrder = (index: number) => {
    const newSelected = [...selectedPreOrders];
    newSelected.splice(index, 1);
    setSelectedPreOrders(newSelected);

    // If no more pre-orders, clear items
    if (newSelected.length === 0) {
      setItemDetails([]);
      setKeterangan('');
    } else {
      // Re-populate with remaining pre-orders
      populateFromPreOrders(newSelected);
    }
  };

  const recalculateItemsWithBiaya = (
    items: ItemDetail[],
    biayaStr: string,
    pkpActive: boolean,
    ppn: number,
    mode: 'include' | 'exclude'
  ): { items: ItemDetail[]; persentase: number } => {
    const biayaNum = parseFloat(biayaStr || '0');
    const validBiaya = isNaN(biayaNum) || biayaNum < 0 ? 0 : biayaNum;

    // Total base value = sum(qty * pricelist)
    const totalBaseValue = items.reduce((sum, item) => {
      const qty = parseInt(item.qty || '0') || 0;
      const pl = parseFloat(item.pricelist || item.hargabeli || item.dpp || '0') || 0;
      return sum + (qty * pl);
    }, 0);

    let persentase = totalBaseValue > 0 ? validBiaya / totalBaseValue : 0;
    if (!isFinite(persentase) || isNaN(persentase)) {
      persentase = 0;
    }

    const updated = items.map(item => {
      const pl = parseFloat(item.pricelist || item.hargabeli || item.dpp || '0') || 0;
      if (pkpActive) {
        if (persentase === 0) {
          const dpp = pl;
          const incl = Number((dpp * (1 + ppn / 100)).toFixed(2));
          return {
            ...item,
            pricelist: pl.toString(),
            dpp: dpp.toString(),
            hargabeli: incl.toString(),
          };
        } else {
          const dppWithBiaya = Number((pl * (1 + persentase)).toFixed(2));
          const inclWithBiaya = Number((dppWithBiaya * (1 + ppn / 100)).toFixed(2));
          return {
            ...item,
            pricelist: pl.toString(),
            dpp: dppWithBiaya.toString(),
            hargabeli: inclWithBiaya.toString(),
          };
        }
      } else {
        if (persentase === 0) {
          return {
            ...item,
            pricelist: pl.toString(),
            hargabeli: pl.toString(),
            dpp: pl.toString(),
          };
        } else {
          const finalHb = Number((pl * (1 + persentase)).toFixed(2));
          return {
            ...item,
            pricelist: pl.toString(),
            hargabeli: finalHb.toString(),
            dpp: finalHb.toString(),
          };
        }
      }
    });

    return { items: updated, persentase };
  };

  const handleBiayaTambahanChange = (val: string) => {
    if (val === '' || val === '+' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
      setBiayaTambahan(val);
      const res = recalculateItemsWithBiaya(itemDetails, val, isPkpActive, ppnRate, ppnMode);
      setItemDetails(res.items);
      setPersentaseBiayaTambahan(res.persentase);
    }
  };

  const updateItemDetail = (index: number, field: keyof ItemDetail, value: string) => {
    const updated = [...itemDetails];
    if (field === 'qty') {
      updated[index] = { ...updated[index], qty: value };
    } else if (field === 'pricelist' || field === 'hargabeli' || field === 'dpp') {
      updated[index] = {
        ...updated[index],
        pricelist: value,
        hargabeli: value,
        dpp: value,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    const res = recalculateItemsWithBiaya(updated, biayaTambahan, isPkpActive, ppnRate, ppnMode);
    setItemDetails(res.items);
    setPersentaseBiayaTambahan(res.persentase);
  };

  const deleteItem = (index: number) => {
    Alert.alert(
      'Hapus Item',
      'Apakah Anda yakin ingin menghapus item ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            const updated = itemDetails.filter((_, i) => i !== index);
            const res = recalculateItemsWithBiaya(updated, biayaTambahan, isPkpActive, ppnRate, ppnMode);
            setItemDetails(res.items);
            setPersentaseBiayaTambahan(res.persentase);
          },
        },
      ]
    );
  };

  const calculateBaseTotal = (): number => {
    return itemDetails.reduce((total, item) => {
      const qty = parseInt(item.qty || '0') || 0;
      const pl = parseFloat(item.pricelist || item.dpp || item.hargabeli || '0') || 0;
      return total + (pl * qty);
    }, 0);
  };

  const calculatePpnAmount = (): number => {
    if (!isPkpActive) return 0;
    const baseTotalDpp = itemDetails.reduce((total, item) => {
      const qty = parseInt(item.qty || '0') || 0;
      const dpp = parseFloat(item.dpp || '0') || 0;
      return total + (dpp * qty);
    }, 0);
    return baseTotalDpp * (ppnRate / 100);
  };

  const calculateTotal = (): number => {
    return itemDetails.reduce((total, item) => {
      const qty = parseInt(item.qty || '0') || 0;
      let includePrice: number;

      if (!isPkpActive) {
        includePrice = parseFloat(item.hargabeli || item.dpp || '0') || 0;
      } else {
        if (ppnMode === 'include') {
          includePrice = parseFloat(item.hargabeli || '0') || 0;
        } else {
          const excludePrice = parseFloat(item.dpp || '0') || 0;
          includePrice = excludePrice * (1 + ppnRate / 100);
        }
      }

      return total + (includePrice * qty);
    }, 0);
  };

  const handleSave = async () => {
    // Validations
    if (!tanggalInvoice) {
      Alert.alert('Error', 'Tanggal invoice harus diisi');
      return;
    }

    if (idSupplier === 0) {
      Alert.alert('Error', 'Supplier harus dipilih');
      return;
    }

    const bayarAmount = parseFloat(bayar || '0');
    if (bayarAmount > 0 && !kodeBaganAkun) {
      Alert.alert('Error', 'Bagan akun harus dipilih jika ada pembayaran');
      return;
    }

    if (itemDetails.length === 0) {
      Alert.alert('Error', 'Minimal harus ada 1 item barang');
      return;
    }

    // Validate prices based on PKP mode
    for (const item of itemDetails) {
      if (isPkpActive) {
        if (ppnMode === 'include' && !item.hargabeli) {
          Alert.alert('Error', `Harga beli (Include PPN) untuk ${item.nama} harus diisi`);
          return;
        }
        if (ppnMode === 'exclude' && !item.dpp) {
          Alert.alert('Error', `Harga beli (Exclude PPN) untuk ${item.nama} harus diisi`);
          return;
        }
      } else {
        if (!item.hargabeli && !item.dpp) {
          Alert.alert('Error', `Harga beli untuk ${item.nama} harus diisi`);
          return;
        }
      }
    }

    try {
      setSaving(true);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const total = calculateTotal();
      const sisa = total - bayarAmount;

      const detailpembelian = itemDetails.map(item => {
        const finalPrice = parseFloat(item.hargabeli || item.dpp || '0');
        const dppVal = isPkpActive ? parseFloat(item.dpp || '0') : finalPrice;
        return {
          id_barang: item.id,
          qty: parseInt(item.qty || '0'),
          harga_beli: finalPrice,
          dpp: dppVal,
          kodeBA: '51.1',
          price_list: item.pricelist ? parseFloat(item.pricelist) : finalPrice,
          qty_print: parseInt(item.qty_print || '0'),
        };
      });

      const payload = {
        data: {
          pembelian: {
            tanggal: formatDateTimeForMySQL(new Date()),
            tanggal_invoice: formatDateTimeForMySQL(tanggalInvoice),
            id_supplier: idSupplier,
            keterangan,
            bayar: bayarAmount,
            bayarkontan: bayarAmount,
            kodeBAbayar: kodeBaganAkun || null,
            hutangkontan: sisa,
            kodeBAhutang: sisa === 0 ? null : '21.1',
            usePpn: isPkpActive,
            ppn: ppnRate,
            biaya_tambahan: parseFloat(biayaTambahan || '0'),
            total,
            warehouse_id: selectedWarehouse ? Number(selectedWarehouse) : null,
          },
          detailpembelian,
          // Include pre-order IDs for conversion
          preOrderIds: selectedPreOrders.map(po => po.id).filter(id => id !== undefined)
        },
      };

      const res = await fetch(`${API_BASE_URL}/pembelian`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status) {
        Alert.alert('Sukses', 'Pembelian berhasil disimpan', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setTanggalInvoice('');
              setIdSupplier(0);
              setSupplierName('');
              setKeterangan('');
              setKodeBaganAkun('');
              setBaganAkunName('');
              setBayar('');
              setBiayaTambahan('');
              setItemDetails([]);

              // Reset pre-order state
              setSelectedPreOrders([]);
              setPendingPreOrdersCount(0);

              // Reset date to now
              const now = new Date();
              setTanggalInvoice(now.toISOString().slice(0, 16));
            },
          },
        ]);
      } else {
        Alert.alert('Error', data.reason || 'Gagal menyimpan pembelian');
      }
    } catch (error) {
      console.error('Save pembelian error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan pembelian');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat...</Text>
      </View>
    );
  }

  const baseTotal = calculateBaseTotal();
  const ppnAmount = calculatePpnAmount();
  const grandTotal = calculateTotal();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Tambah Pembelian</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>Buat transaksi pembelian baru</Text>
        </View>

        {/* Form Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Pembelian</Text>

          {/* Tanggal Invoice */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Tanggal Invoice <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={tanggalInvoice}
              onChangeText={setTanggalInvoice}
              placeholder="YYYY-MM-DDTHH:mm"
              editable={!saving}
            />
          </View>

          {/* Supplier */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Supplier <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowSupplier(true)}
              disabled={saving}
            >
              <View style={{ flex: 1 }}>
                {idSupplier === 0 ? (
                  <Text style={styles.selectPlaceholder}>Pilih Supplier</Text>
                ) : (
                  <>
                    <Text style={styles.selectValue}>{supplierName}</Text>
                    <Text style={styles.selectSubtext}>ID: {idSupplier}</Text>
                  </>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            </View>

            {/* Pending DP Beli Info */}
            {idSupplier > 0 && loadingDPBeli && (
              <View style={styles.dpInfoAlert}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={{ fontSize: 14, color: '#065f46', marginLeft: 8 }}>
                  Memuat DP Beli...
                </Text>
              </View>
            )}
            {idSupplier > 0 && !loadingDPBeli && pendingDPBeli.length > 0 && (
              <View style={styles.dpInfoAlert}>
                <Ionicons name="cash-outline" size={20} color="#10b981" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#065f46' }}>
                    DP Beli Pending ({pendingDPBeli.length})
                  </Text>
                  {pendingDPBeli.map((dpItem, idx) => {
                    const sisa = Number(dpItem.dp) - Number(dpItem.terpakai);
                    return (
                      <Text key={idx} style={{ fontSize: 13, color: '#064e3b', marginTop: 2 }}>
                        • {dpItem.tanggal.substring(0,10)}: Rp {sisa.toLocaleString('id-ID')} {dpItem.keterangan ? `(${dpItem.keterangan})` : ''}
                      </Text>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Pending Pre-Orders Notification */}
            {idSupplier > 0 && pendingPreOrdersCount > 0 && (
            <View style={styles.infoAlert}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                Ada {pendingPreOrdersCount} pre-order menunggu untuk supplier ini.
              </Text>
              <TouchableOpacity onPress={handleOpenPreOrderSearch}>
                <Text style={styles.infoLink}>Lihat</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pre-Order Selection */}
          {idSupplier > 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nomor PO (Optional)</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={handleOpenPreOrderSearch}
                disabled={saving}
              >
                <View style={{ flex: 1 }}>
                  <Text style={selectedPreOrders.length > 0 ? styles.selectValue : styles.selectPlaceholder}>
                    {selectedPreOrders.length > 0
                      ? selectedPreOrders.map(po => `#${po.id}`).join(', ')
                      : 'Pilih Pre-Order'}
                  </Text>
                </View>
                <Ionicons name="search" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Selected PO Chips */}
              {selectedPreOrders.length > 0 && (
                <View style={styles.chipContainer}>
                  {selectedPreOrders.map((po, idx) => (
                    <View key={idx} style={styles.chip}>
                      <Text style={styles.chipText}>PO #{po.id}</Text>
                      <TouchableOpacity onPress={() => handleRemovePreOrder(idx)}>
                        <Ionicons name="close-circle" size={18} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Keterangan */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Keterangan</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={keterangan}
              onChangeText={setKeterangan}
              placeholder="Masukkan keterangan"
              multiline
              numberOfLines={3}
              editable={!saving}
            />
          </View>

          {/* Warehouse */}
          {warehouses.length > 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Warehouse</Text>
              <View style={styles.pickerContainer}>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    selectedWarehouse === '' && styles.radioOptionSelected,
                  ]}
                  onPress={() => setSelectedWarehouse('')}
                  disabled={saving}
                >
                  <View style={styles.radioCircle}>
                    {selectedWarehouse === '' && <View style={styles.radioCircleInner} />}
                  </View>
                  <Text style={styles.radioLabel}>Tidak Pilih (Master Barang)</Text>
                </TouchableOpacity>
                {warehouses.map((wh) => (
                  <TouchableOpacity
                    key={wh.id}
                    style={[
                      styles.radioOption,
                      selectedWarehouse === wh.id && styles.radioOptionSelected,
                    ]}
                    onPress={() => setSelectedWarehouse(wh.id)}
                    disabled={saving}
                  >
                    <View style={styles.radioCircle}>
                      {selectedWarehouse === wh.id && <View style={styles.radioCircleInner} />}
                    </View>
                    <Text style={styles.radioLabel}>{wh.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Bayar */}
          <View style={styles.formGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={styles.label}>Bayar (Kontan)</Text>
              <TouchableOpacity
                onPress={() => setBayar(grandTotal.toString())}
                style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}
                disabled={saving}
              >
                <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '700' }}>= Bayar Lunas</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={bayar}
              onChangeText={setBayar}
              placeholder="0"
              keyboardType="numeric"
              editable={!saving}
            />
          </View>

          {/* Bagan Akun */}
          {parseFloat(bayar || '0') > 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Bagan Akun <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowBaganAkun(true)}
                disabled={saving}
              >
                <View style={{ flex: 1 }}>
                  {!kodeBaganAkun ? (
                    <Text style={styles.selectPlaceholder}>Pilih Bagan Akun</Text>
                  ) : (
                    <>
                      <Text style={styles.selectValue}>{baganAkunName}</Text>
                      <Text style={styles.selectSubtext}>Kode: {kodeBaganAkun}</Text>
                    </>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}
          {/* Biaya Tambahan */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Biaya Tambahan</Text>
            <TextInput
              style={styles.input}
              value={biayaTambahan}
              onChangeText={handleBiayaTambahanChange}
              placeholder="0"
              keyboardType="numeric"
              editable={!saving}
            />
            {parseFloat(biayaTambahan || '0') > 0 && (
              <Text style={{ fontSize: 13, color: '#d97706', fontWeight: 'bold', marginTop: 4 }}>
                +{(persentaseBiayaTambahan * 100).toFixed(2)}% dibebankan ke harga beli
              </Text>
            )}
          </View>
        </View>

        {/* PPN Section */}
        {isPkpActive && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pengaturan PPN</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tarif PPN (%)</Text>
              <TextInput
                style={styles.input}
                value={ppnRate.toString()}
                onChangeText={(val) => setPpnRate(parseFloat(val) || 0)}
                placeholder="11"
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Mode Perhitungan</Text>
              <View style={styles.ppnModeContainer}>
                <TouchableOpacity
                  style={[
                    styles.ppnModeButton,
                    ppnMode === 'exclude' && styles.ppnModeButtonActive,
                  ]}
                  onPress={() => setPpnMode('exclude')}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.ppnModeText,
                      ppnMode === 'exclude' && styles.ppnModeTextActive,
                    ]}
                  >
                    Exclude PPN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.ppnModeButton,
                    ppnMode === 'include' && styles.ppnModeButtonActive,
                  ]}
                  onPress={() => setPpnMode('include')}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.ppnModeText,
                      ppnMode === 'include' && styles.ppnModeTextActive,
                    ]}
                  >
                    Include PPN
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                {ppnMode === 'exclude'
                  ? 'Harga yang diinput adalah harga TANPA PPN. PPN akan ditambahkan otomatis.'
                  : 'Harga yang diinput adalah harga SUDAH TERMASUK PPN.'}
              </Text>
            </View>
          </View>
        )}

        {/* Item Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Detail Barang</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowBarang(true)}
                disabled={saving}
              >
                <Ionicons name="search" size={16} color="white" />
                <Text style={styles.addButtonText}>Cari Barang</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, styles.addButtonSecondary]}
                onPress={() => setShowTambahBarang(true)}
                disabled={saving}
              >
                <Ionicons name="add" size={16} color="#f59e0b" />
                <Text style={styles.addButtonTextSecondary}>Barang Baru</Text>
              </TouchableOpacity>
            </View>
          </View>

          {itemDetails.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Belum ada barang</Text>
              <Text style={styles.emptySubtext}>Tambahkan barang untuk melanjutkan</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: 45 }]}>ID</Text>
                  <Text style={[styles.tableHeaderCell, { width: 140 }]}>Nama Barang</Text>
                  <Text style={[styles.tableHeaderCell, { width: 55 }]}>Qty</Text>
                  <Text style={[styles.tableHeaderCell, { width: 105 }]}>
                    {isPkpActive ? (ppnMode === 'exclude' ? 'Harga Exc PPN' : 'Harga Inc PPN') : 'Harga Beli'}
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: 105 }]}>Harga (+Biaya)</Text>
                  <Text style={[styles.tableHeaderCell, { width: 110 }]}>Sub Total</Text>
                  <Text style={[styles.tableHeaderCell, { width: 60 }]}>Qty Print</Text>
                  <Text style={[styles.tableHeaderCell, { width: 45 }]}>Aksi</Text>
                </View>

                {/* Table Rows */}
                {itemDetails.map((item, index) => {
                  const qty = parseInt(item.qty || '0') || 0;
                  const finalPrice = parseFloat(item.hargabeli || item.dpp || '0') || 0;
                  const subtotal = qty * finalPrice;

                  return (
                    <View key={index} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { width: 45 }]}>{item.id}</Text>
                      <View style={[styles.tableCell, { width: 140 }]}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.nama}
                        </Text>
                        {item.merk && (
                          <Text style={styles.itemMeta}>{item.merk}</Text>
                        )}
                      </View>
                      <View style={[styles.tableCell, { width: 55 }]}>
                        <TextInput
                          style={styles.tableCellInput}
                          value={item.qty}
                          onChangeText={(val) => updateItemDetail(index, 'qty', val)}
                          keyboardType="numeric"
                          editable={!saving}
                        />
                      </View>
                      <View style={[styles.tableCell, { width: 105 }]}>
                        <TextInput
                          style={styles.tableCellInput}
                          value={item.pricelist}
                          onChangeText={(val) => updateItemDetail(index, 'pricelist', val)}
                          keyboardType="numeric"
                          editable={!saving}
                          placeholder="0"
                        />
                      </View>
                      <Text style={[styles.tableCell, { width: 105, fontWeight: 'bold', color: '#059669' }]}>
                        {finalPrice.toLocaleString('id-ID')}
                      </Text>
                      <Text style={[styles.tableCell, { width: 110, fontWeight: '600' }]}>
                        {subtotal.toLocaleString('id-ID')}
                      </Text>
                      <View style={[styles.tableCell, { width: 60 }]}>
                        <TextInput
                          style={styles.tableCellInput}
                          value={item.qty_print}
                          onChangeText={(val) => updateItemDetail(index, 'qty_print', val)}
                          keyboardType="numeric"
                          editable={!saving}
                        />
                      </View>
                      <View style={[styles.tableCell, { width: 45 }]}>
                        <TouchableOpacity
                          onPress={() => deleteItem(index)}
                          disabled={saving}
                        >
                          <Ionicons name="trash-outline" size={20} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Summary Section */}
        {itemDetails.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ringkasan Pembelian</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Nilai Barang (Dasar):</Text>
              <Text style={styles.summaryValue}>
                Rp {baseTotal.toLocaleString('id-ID')}
              </Text>
            </View>

            {parseFloat(biayaTambahan || '0') > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Biaya Tambahan (+{(persentaseBiayaTambahan * 100).toFixed(2)}%):
                </Text>
                <Text style={[styles.summaryValue, { color: '#d97706', fontWeight: 'bold' }]}>
                  + Rp {parseFloat(biayaTambahan).toLocaleString('id-ID')}
                </Text>
              </View>
            )}

            {isPkpActive && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>PPN ({ppnRate}%):</Text>
                <Text style={styles.summaryValue}>
                  + Rp {ppnAmount.toLocaleString('id-ID')}
                </Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.summaryRowTotal]}>
              <Text style={styles.summaryLabelTotal}>Total Pembelian:</Text>
              <Text style={[styles.summaryValueTotal, { color: '#059669', fontSize: 18 }]}>
                Rp {grandTotal.toLocaleString('id-ID')}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bayar (Kontan):</Text>
              <Text style={styles.summaryValue}>
                Rp {(parseFloat(bayar || '0')).toLocaleString('id-ID')}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sisa Hutang:</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    fontWeight: 'bold',
                    color: grandTotal - parseFloat(bayar || '0') > 0 ? '#ef4444' : '#10b981',
                  },
                ]}
              >
                Rp {(grandTotal - parseFloat(bayar || '0')).toLocaleString('id-ID')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalValue}>
            Rp {grandTotal.toLocaleString('id-ID')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={styles.saveButtonText}>Simpan Pembelian</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <SearchSupplierModal
        visible={showSupplier}
        onClose={() => setShowSupplier(false)}
        onSelect={handleSupplierSelect}
      />
      <SearchBaganAkunModal
        visible={showBaganAkun}
        onClose={() => setShowBaganAkun(false)}
        onSelect={handleBaganAkunSelect}
        shows={['111']}
      />
      <SearchBarangModal
        visible={showBarang}
        onClose={() => setShowBarang(false)}
        onSelect={handleBarangSelect}
        multiSelect={true}
        excludeIds={itemDetails.map((item) => item.id)}
      />
      <TambahBarangModal
        visible={showTambahBarang}
        onClose={() => setShowTambahBarang(false)}
        onDone={handleTambahBarangDone}
      />

      {/* Pre-Order Search Modal */}
      {showPreOrderSearch && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Pre-Order</Text>
              <TouchableOpacity onPress={() => setShowPreOrderSearch(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {loadingPreOrders ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>Memuat pre-orders...</Text>
              </View>
            ) : (
              <View style={styles.modalContent}>
                {preOrders
                  .filter(po => po.id_supplier === idSupplier)
                  .map((preOrder) => {
                    const isSelected = selectedPreOrders.some(po => po.id === preOrder.id);
                    return (
                      <TouchableOpacity
                        key={preOrder.id}
                        style={[styles.preOrderItem, isSelected && styles.preOrderItemSelected]}
                        onPress={() => handleTogglePreOrder(preOrder)}
                      >
                        <View style={styles.preOrderCheckbox}>
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={24}
                            color={isSelected ? '#f59e0b' : '#9CA3AF'}
                          />
                        </View>
                        <View style={styles.preOrderInfo}>
                          <Text style={styles.preOrderId}>PO #{preOrder.id}</Text>
                          <Text style={styles.preOrderDate}>
                            {new Date(preOrder.tanggal_po).toLocaleDateString('id-ID')}
                          </Text>
                          <Text style={styles.preOrderSupplier}>{preOrder.supplier_nama}</Text>
                          <Text style={styles.preOrderItems}>
                            {preOrder.items.length} item(s)
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                {preOrders.filter(po => po.id_supplier === idSupplier).length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>Tidak ada pre-order untuk supplier ini</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowPreOrderSearch(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleConfirmPreOrderSelection}
              >
                <Text style={styles.modalButtonTextConfirm}>Konfirmasi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  hamburgerButton: { padding: 5 },
  topHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  selectPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  selectValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  selectSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  pickerContainer: {
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  radioOptionSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
  },
  radioLabel: {
    fontSize: 15,
    color: '#111827',
  },
  ppnModeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ppnModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  ppnModeButtonActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  ppnModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  ppnModeTextActive: {
    color: '#f59e0b',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  addButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  addButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  addButtonTextSecondary: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
  },
  table: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  tableCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  tableCellInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: '#111827',
    backgroundColor: 'white',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#f59e0b',
    paddingTop: 12,
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  summaryLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summaryValueTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f59e0b',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  footerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  footerTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f59e0b',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // Pre-order styles
  dpInfoAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  infoAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
  },
  infoLink: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    maxHeight: 400,
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  preOrderItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  preOrderItemSelected: {
    backgroundColor: '#FEF3C7',
  },
  preOrderCheckbox: {
    marginRight: 12,
  },
  preOrderInfo: {
    flex: 1,
  },
  preOrderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  preOrderDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  preOrderSupplier: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  preOrderItems: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#f59e0b',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

