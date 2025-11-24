import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, DrawerActions } from '@react-navigation/native';
import moment from 'moment';
import { io, Socket } from 'socket.io-client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import SearchCustomerModal, { CustomerItem } from '../../../components/penjualan/SearchCustomerModal';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import SearchBarangModal, { BarangItem } from '../../../components/SearchBarangModal';
import SearchBundlingModal, { BundlingItem } from '../../../components/penjualan/SearchBundlingModal';
import TambahItemManualModal, { ManualItemData } from '../../../components/penjualan/TambahItemManualModal';
import BarcodeScannerModal from '../../../components/penjualan/BarcodeScannerModal';

// Interface matching web version (IItemTambahPenjualan)
interface ItemDetail {
  id_barang?: number;
  id_bundling?: number;
  nama: string;
  sku: string;
  qty: string;
  hargabeli: string;
  hargajual: string; // Include PPN price
  hargajual_exp: string; // Exclude PPN price
  merk?: string;
  satuan?: string;
  kategori?: string;
  no_po?: string;
  no_sj?: string;
  is_manual?: boolean;
  stok?: number; // Available stock for validation
  // Wholesale pricing fields
  harga_grosir?: number;
  qty_grosir?: number;
  harga_normal?: number;
  is_wholesale_active?: boolean;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Ecommerce {
  id: number;
  name: string;
  platform: string;
}

// Route params type for ecommerce order integration
type PenjualanTambahParams = {
  PenjualanTambah: {
    id_online?: string;
    id_ecommerce?: number;
  };
};

export default function PenjualanTambahScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PenjualanTambahParams, 'PenjualanTambah'>>();
  const socketRef = useRef<Socket | null>(null);

  // Form state
  const [tanggal, setTanggal] = useState(moment().format('YYYY-MM-DDTHH:mm:ss'));
  const [idCustomer, setIdCustomer] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [kodeBaganAkun, setKodeBaganAkun] = useState('');
  const [baganAkunName, setBaganAkunName] = useState('');
  const [biayaService, setBiayaService] = useState('');
  const [fakturPajak, setFakturPajak] = useState('');
  const [noInvoice, setNoInvoice] = useState('');
  const [noSuratJalan, setNoSuratJalan] = useState('');
  const [nomorKendaraan, setNomorKendaraan] = useState('');
  const [namaPengirim, setNamaPengirim] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // Ecommerce state
  const [ecommerce, setEcommerce] = useState<Ecommerce>({ id: 0, name: '', platform: '' });
  const [listEcommerce, setListEcommerce] = useState<Ecommerce[]>([]);
  const [idOnline, setIdOnline] = useState('');
  const [reasonOnline, setReasonOnline] = useState('');

  // PPN state
  const [isPkpActive, setIsPkpActive] = useState(false);
  const [ppnRate, setPpnRate] = useState(11);
  const [ppnMode, setPpnMode] = useState<'include' | 'exclude'>('exclude');

  // Payment state
  const [bayar, setBayar] = useState('');
  const [terbayar, setTerbayar] = useState('');
  const [kembalian, setKembalian] = useState(0);
  const [tglJatuhTempo, setTglJatuhTempo] = useState('');

  // Item details
  const [itemDetails, setItemDetails] = useState<ItemDetail[]>([]);

  // Warehouses
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Modal states
  const [showCustomer, setShowCustomer] = useState(false);
  const [showBaganAkun, setShowBaganAkun] = useState(false);
  const [showBarang, setShowBarang] = useState(false);
  const [showBundling, setShowBundling] = useState(false);
  const [showManualItem, setShowManualItem] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Helper function: Calculate price based on quantity and wholesale settings (SAMA seperti web)
  const calculatePrice = (item: ItemDetail, newQty: number): { price: number; isWholesale: boolean } => {
    const qty = newQty;
    const hasWholesaleSettings = item.harga_grosir && item.qty_grosir && item.harga_grosir > 0 && item.qty_grosir > 0;
    const shouldUseWholesale = hasWholesaleSettings && qty >= item.qty_grosir!;

    if (shouldUseWholesale) {
      return {
        price: item.harga_grosir!,
        isWholesale: true,
      };
    } else {
      const normalPrice = item.harga_normal || parseFloat(item.hargajual || '0');
      return {
        price: normalPrice,
        isWholesale: false,
      };
    }
  };

  // Helper method: Calculate total with PPN (always use include price) - SAMA seperti web
  const calculateTotal = (): number => {
    const itemsTotal = itemDetails.reduce((total, item) => {
      const qty = parseInt(item.qty.toString());

      let includePrice;
      if (!isPkpActive) {
        includePrice = parseFloat(item.hargajual || item.hargajual_exp || '0');
      } else {
        if (ppnMode === 'include') {
          includePrice = parseFloat(item.hargajual || '0');
        } else {
          const excludePrice = parseFloat(item.hargajual_exp || '0');
          includePrice = excludePrice * (1 + ppnRate / 100);
        }
      }

      return total + includePrice * qty;
    }, 0);
    const biayaServiceNum = parseFloat(biayaService || '0');
    return itemsTotal + biayaServiceNum;
  };

  // Helper method: Calculate base total (without PPN - always use exclude price) - SAMA seperti web
  const calculateBaseTotal = (): number => {
    const itemsTotal = itemDetails.reduce((total, item) => {
      const qty = parseInt(item.qty.toString());

      let excludePrice;
      if (!isPkpActive) {
        excludePrice = parseFloat(item.hargajual_exp || item.hargajual || '0');
      } else {
        if (ppnMode === 'exclude') {
          excludePrice = parseFloat(item.hargajual_exp || '0');
        } else {
          const includePrice = parseFloat(item.hargajual || '0');
          excludePrice = includePrice / (1 + ppnRate / 100);
        }
      }

      return total + excludePrice * qty;
    }, 0);

    const biayaServiceNum = parseFloat(biayaService || '0');
    return itemsTotal + biayaServiceNum;
  };

  // Helper method: Calculate PPN amount - SAMA seperti web
  const calculatePpnAmount = (): number => {
    if (!isPkpActive) return 0;
    const baseTotal = calculateBaseTotal();
    return baseTotal * (ppnRate / 100);
  };

  // Calculate sisa (piutang)
  const calculateSisa = (): number => {
    const total = calculateTotal();
    const terbayarNum = parseFloat(terbayar || '0');
    return total - terbayarNum;
  };

  useEffect(() => {
    loadInitialData();

    // Initialize Socket.io connection (SAMA seperti web)
    socketRef.current = io('wss://ws-1706.plexseller.com:99');

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Load ecommerce order if params are provided (SAMA seperti web lines 363-433)
  useEffect(() => {
    const loadEcommerceOrder = async () => {
      const id_online = route.params?.id_online;
      const id_ecommerce = route.params?.id_ecommerce;

      if (!id_online || !id_ecommerce) return;

      try {
        const token = await getTokenAuth();
        if (!token) return;

        // Get ecommerce info
        const ecomRes = await fetch(
          `${API_BASE_URL}/get/ecommerce/condition/and/id:equal:${id_ecommerce},status:equal:APPROVED`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const ecomData = await ecomRes.json();

        if (ecomData.status && ecomData.data && ecomData.data.length > 0) {
          setEcommerce({
            id: id_ecommerce,
            name: ecomData.data[0].name,
            platform: ecomData.data[0].platform,
          });
        }

        // Get order details
        const orderRes = await fetch(
          `${API_BASE_URL}/get/ecommerce/order?id_ecommerce=${id_ecommerce}&id=${id_online}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const orderData = await orderRes.json();

        if (orderData.status && orderData.data && orderData.data.items) {
          // Map items from ecommerce order
          const mappedItems = await Promise.all(
            orderData.data.items.map(async (row: any) => {
              // Try to find masterbarang first
              const barangRes = await fetch(
                `${API_BASE_URL}/get/masterbarang?id_online=${row.id_online}&id_ecommerce=${id_ecommerce}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const barangData = await barangRes.json();

              if (barangData.data && barangData.data.length > 0) {
                // Found masterbarang
                const item = barangData.data[0];
                row.id_barang = item.id;
                row.hargabeli = item.hargabeli;
                row.hargajual2 = item.hargajual2;
                row.merk = item.merk;
                row.kategori = item.kategori;
                row.nama = item.nama;
                row.satuan = item.satuan;
                row.harga_grosir = item.harga_grosir;
                row.qty_grosir = item.qty_grosir;
              } else {
                // Try bundling
                const bundlingRes = await fetch(
                  `${API_BASE_URL}/get/bundling?id_online=${row.id_online}&id_ecommerce=${id_ecommerce}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                const bundlingData = await bundlingRes.json();

                if (bundlingData.status && bundlingData.data && bundlingData.data.length > 0) {
                  const bundling = bundlingData.data[0];
                  row.id_bundling = bundling.id;
                  row.hargajual2 = bundling.hargajual2;
                  row.nama = bundling.nama;
                  row.satuan = bundling.satuan;
                  row.hargabeli = bundling.hargabeli;
                }
              }

              return row;
            })
          );

          // Transform to ItemDetail format with wholesale pricing logic
          const items: ItemDetail[] = mappedItems.map((row) => {
            const initialQty = parseInt(row.qty?.toString() || '0');
            const hasWholesale = row.harga_grosir && row.qty_grosir && row.harga_grosir > 0 && row.qty_grosir > 0;
            const useWholesale = hasWholesale && initialQty >= row.qty_grosir;
            const basePrice = row.hargajual2 || row.price || 0;
            const finalPrice = useWholesale ? row.harga_grosir : basePrice;

            return {
              id_barang: row.id_barang,
              id_bundling: row.id_bundling,
              nama: row.nama || '',
              sku: row.sku || '',
              qty: row.qty?.toString() || '1',
              hargabeli: row.hargabeli?.toString() || '0',
              hargajual: finalPrice.toString(),
              hargajual_exp: ((finalPrice * 100) / (100 + ppnRate)).toString(),
              merk: row.merk || '',
              satuan: row.satuan || '',
              kategori: row.kategori || '',
              no_po: '',
              no_sj: '',
              harga_grosir: row.harga_grosir,
              qty_grosir: row.qty_grosir,
              harga_normal: row.hargajual2,
              is_wholesale_active: useWholesale,
            };
          });

          // Set state
          setItemDetails(items);
          setIdOnline(id_online);
          if (orderData.data.date) {
            setTanggal(moment(orderData.data.date).format('YYYY-MM-DDTHH:mm:ss'));
          }
        }
      } catch (error) {
        console.error('Load ecommerce order error:', error);
        Alert.alert('Error', 'Gagal memuat order dari ecommerce');
      }
    };

    loadEcommerceOrder();
  }, [route.params]);

  // Auto-sync bayar to terbayar and calculate kembalian
  useEffect(() => {
    const cash = parseFloat(bayar || '0');
    const total = calculateTotal();
    const settled = Math.min(cash, total);
    const change = Math.max(cash - total, 0);

    setTerbayar(settled.toString());
    setKembalian(change);
  }, [bayar, itemDetails, biayaService, isPkpActive, ppnRate, ppnMode]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) return;

      // Load PKP settings
      const settingsRes = await fetch(`${API_BASE_URL}/get/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const settingsData = await settingsRes.json();

      if (settingsData.status && settingsData.data) {
        const pkpSetting = settingsData.data.find((s: any) => s.setting === 'pkp');
        if (pkpSetting) {
          setIsPkpActive(pkpSetting.value === '1' || pkpSetting.value === true);
        }
      }

      // Load warehouses
      const warehouseRes = await fetch(`${API_BASE_URL}/get/warehouse`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const warehouseData = await warehouseRes.json();

      if (warehouseData.status && warehouseData.data) {
        setWarehouses(warehouseData.data);
        if (warehouseData.data.length > 0) {
          setSelectedWarehouse(warehouseData.data[0].id);
        }
      }

      // Load ecommerce list (status APPROVED)
      const ecommerceRes = await fetch(`${API_BASE_URL}/get/ecommerce`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ecommerceData = await ecommerceRes.json();

      if (ecommerceData.status && ecommerceData.data) {
        const approved = ecommerceData.data.filter((e: any) => e.status === 'APPROVED');
        setListEcommerce(approved);
      }

      // Load customer name for default customer (id=1)
      const customerRes = await fetch(`${API_BASE_URL}/get/customer/condition/or/id:equal:1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const customerData = await customerRes.json();
      if (customerData.status && customerData.data && customerData.data.length > 0) {
        setCustomerName(customerData.data[0].nama);
      }
    } catch (error) {
      console.error('Load initial data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer: CustomerItem) => {
    setIdCustomer(customer.id);
    setCustomerName(customer.nama);
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setKodeBaganAkun(item.kode);
    setBaganAkunName(item.nama);
  };

  const handleBarangSelect = (items: BarangItem[]) => {
    const newItemDetails = [...itemDetails];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.stok === 0) {
        Alert.alert('Stok Habis', `Stok ${item.sku} habis`);
        continue;
      }

      // Check if item already exists (duplicate check - SAMA seperti barcode scanner di web)
      const existingIndex = newItemDetails.findIndex(
        (detail) => detail.id_barang === item.id && !detail.id_bundling
      );

      if (existingIndex >= 0) {
        // Item sudah ada - increment qty dan recalculate price
        const currentQty = parseInt(newItemDetails[existingIndex].qty || '0') || 0;
        const newQty = currentQty + 1;
        newItemDetails[existingIndex].qty = newQty.toString();

        // Recalculate price based on wholesale logic
        const priceResult = calculatePrice(newItemDetails[existingIndex], newQty);
        newItemDetails[existingIndex].hargajual = priceResult.price.toString();
        newItemDetails[existingIndex].hargajual_exp = ((priceResult.price * 100) / (100 + ppnRate)).toString();
        newItemDetails[existingIndex].is_wholesale_active = priceResult.isWholesale;
      } else {
        // Item baru - add to list
        const initialQty = 1;
        const shouldUseWholesale = item.harga_grosir && item.qty_grosir && initialQty >= item.qty_grosir;
        const finalPrice = shouldUseWholesale ? item.harga_grosir! : item.hargajual!;

        newItemDetails.push({
          id_barang: item.id,
          nama: item.nama,
          sku: item.sku || '',
          qty: '1',
          merk: item.merk || '',
          satuan: item.satuan || '',
          kategori: item.kategori || '',
          hargabeli: item.hpp?.toString() || '0',
          hargajual: finalPrice.toString(),
          hargajual_exp: ((finalPrice * 100) / (100 + ppnRate)).toString(),
          no_po: '',
          no_sj: '',
          stok: item.stok, // Store stock for validation
          harga_grosir: item.harga_grosir,
          qty_grosir: item.qty_grosir,
          harga_normal: item.hargajual,
          is_wholesale_active: shouldUseWholesale,
        });
      }
    }

    setItemDetails(newItemDetails);
  };

  const handleBundlingSelect = (items: BundlingItem[]) => {
    const newItemDetails = [...itemDetails];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.stok === 0) {
        Alert.alert('Stok Habis', `Stok ${item.sku} habis`);
        continue;
      }

      // Check if bundling already exists (duplicate check)
      const existingIndex = newItemDetails.findIndex(
        (detail) => detail.id_bundling === item.id && !detail.id_barang
      );

      if (existingIndex >= 0) {
        // Bundling sudah ada - increment qty
        const currentQty = parseInt(newItemDetails[existingIndex].qty || '0') || 0;
        const newQty = currentQty + 1;
        newItemDetails[existingIndex].qty = newQty.toString();
        // Note: Bundling tidak ada wholesale pricing, jadi tidak perlu recalculate
      } else {
        // Bundling baru - add to list
        newItemDetails.push({
          id_bundling: item.id,
          nama: item.nama,
          sku: item.sku,
          qty: '1',
          merk: item.merk || '',
          satuan: item.satuan || '',
          kategori: item.kategori || '',
          hargabeli: item.hargabeli.toString(),
          hargajual: item.hargajual2.toString(),
          hargajual_exp: ((item.hargajual2 * 100) / (100 + ppnRate)).toString(),
          no_po: '',
          no_sj: '',
          stok: item.stok, // Store stock for validation
        });
      }
    }

    setItemDetails(newItemDetails);
  };

  const handleManualItemAdd = (data: ManualItemData) => {
    const newItem: ItemDetail = {
      nama: data.nama,
      sku: 'MANUAL',
      qty: data.qty,
      hargabeli: '0',
      hargajual: data.hargajual,
      hargajual_exp: ((parseFloat(data.hargajual) * 100) / (100 + ppnRate)).toString(),
      no_po: '',
      no_sj: '',
      is_manual: true,
    };

    setItemDetails([...itemDetails, newItem]);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const token = await getTokenAuth();
      if (!token) return;

      const url = `${API_BASE_URL}/get/masterbarang/condition/and/0/1?query=barcode:equal:${encodeURIComponent(barcode)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!json.status || !json.data || json.data.length === 0) {
        Alert.alert('Tidak Ditemukan', `Barcode tidak ditemukan: ${barcode}`);
        return;
      }

      const row = json.data[0];
      if (row.stok === 0) {
        Alert.alert('Stok Habis', `Stok ${row.sku} habis`);
        return;
      }

      // Check if item already exists
      const existingIndex = itemDetails.findIndex(
        (item) => item.id_barang === row.id && !item.id_bundling
      );

      if (existingIndex >= 0) {
        // Increment quantity
        const newItems = [...itemDetails];
        const currentQty = parseInt(newItems[existingIndex].qty || '0') || 0;
        const newQty = currentQty + 1;
        newItems[existingIndex].qty = newQty.toString();

        // Recalculate price based on wholesale logic
        const priceResult = calculatePrice(newItems[existingIndex], newQty);
        newItems[existingIndex].hargajual = priceResult.price.toString();
        newItems[existingIndex].hargajual_exp = ((priceResult.price * 100) / (100 + ppnRate)).toString();
        newItems[existingIndex].is_wholesale_active = priceResult.isWholesale;

        setItemDetails(newItems);
      } else {
        // Add new item
        const initialQty = 1;
        const hasWholesale = !!(row.harga_grosir && row.qty_grosir && row.harga_grosir > 0 && row.qty_grosir > 0);
        const useWholesale = hasWholesale && initialQty >= row.qty_grosir;
        const basePrice = row.hargajual || 0;
        const finalPrice = useWholesale ? row.harga_grosir : basePrice;

        const newItem: ItemDetail = {
          id_barang: row.id,
          nama: row.nama,
          sku: row.sku,
          qty: '1',
          merk: row.merk || '',
          satuan: row.satuan || '',
          kategori: row.kategori || '',
          hargabeli: row.hargabeli?.toString() || '0',
          hargajual: finalPrice.toString(),
          hargajual_exp: ((finalPrice * 100) / (100 + ppnRate)).toString(),
          no_po: '',
          no_sj: '',
          stok: row.stok, // Store stock for validation
          harga_grosir: row.harga_grosir,
          qty_grosir: row.qty_grosir,
          harga_normal: basePrice,
          is_wholesale_active: useWholesale,
        };

        setItemDetails([...itemDetails, newItem]);
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat scan barcode');
    }
  };

  const handleUpdateItem = (index: number, field: keyof ItemDetail, value: string) => {
    const newItems = [...itemDetails];
    const item = newItems[index];

    // STOK VALIDATION - Check if qty exceeds available stock (SAMA seperti web)
    if (field === 'qty') {
      const newQty = parseInt(value) || 0;

      if (item.stok !== undefined && newQty > item.stok) {
        Alert.alert(
          'Stok Tidak Cukup',
          `Stok tersedia: ${item.stok} ${item.satuan || 'unit'}. Qty yang diinput: ${newQty}`,
          [{ text: 'OK' }]
        );
        return; // Don't update if stock is insufficient
      }
    }

    (newItems[index] as any)[field] = value;

    // If quantity is being updated, recalculate price based on wholesale logic
    if (field === 'qty') {
      const newQty = parseInt(value) || 0;

      const hasWholesaleSettings = !!(
        item.harga_grosir &&
        item.qty_grosir &&
        item.harga_grosir > 0 &&
        item.qty_grosir > 0
      );

      if (hasWholesaleSettings) {
        const priceResult = calculatePrice(item, newQty);
        newItems[index].is_wholesale_active = priceResult.isWholesale;

        const includePrice = priceResult.price;
        if (!isPkpActive) {
          newItems[index].hargajual = includePrice.toString();
          newItems[index].hargajual_exp = includePrice.toString();
        } else if (ppnMode === 'include') {
          newItems[index].hargajual = includePrice.toString();
          newItems[index].hargajual_exp = ((includePrice * 100) / (100 + ppnRate)).toString();
        } else {
          newItems[index].hargajual_exp = ((includePrice * 100) / (100 + ppnRate)).toString();
          newItems[index].hargajual = includePrice.toString();
        }
      }
    }

    setItemDetails(newItems);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = [...itemDetails];
    newItems.splice(index, 1);
    setItemDetails(newItems);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const currentTime = moment(tanggal);
      const newDate = moment(selectedDate)
        .hour(currentTime.hour())
        .minute(currentTime.minute())
        .second(currentTime.second());
      setTanggal(newDate.format('YYYY-MM-DDTHH:mm:ss'));
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const currentDate = moment(tanggal);
      const newDateTime = moment(selectedTime)
        .year(currentDate.year())
        .month(currentDate.month())
        .date(currentDate.date());
      setTanggal(newDateTime.format('YYYY-MM-DDTHH:mm:ss'));
    }
  };

  // Validasi SAMA seperti web (lines 2147-2188)
  const validateForm = (): boolean => {
    // 1. Jika ecommerce dipilih → id_online wajib diisi
    if (ecommerce.id && !idOnline) {
      Alert.alert('Validasi', 'Wajib isi ID Online!');
      return false;
    }

    // 2. Jika ada reason_online → tampilkan alert error
    if (reasonOnline) {
      Alert.alert('Validasi', reasonOnline);
      return false;
    }

    // 3. Minimal ada item ATAU biaya_service > 0
    if (itemDetails.length === 0 && (biayaService === '0' || biayaService === '')) {
      Alert.alert('Validasi', 'Harap isi biaya service ataupun barang');
      return false;
    }

    // 4. Tanggal wajib diisi
    if (tanggal === '') {
      Alert.alert('Validasi', 'Silahkan isi tanggal penjualan');
      return false;
    }

    // 5. Jika terbayar > 0 → Bagan Akun wajib diisi
    if (kodeBaganAkun === '' && parseFloat(terbayar || '0') !== 0) {
      Alert.alert('Validasi', 'Silahkan isi Bagan Akun');
      return false;
    }

    // 6. Qty setiap item tidak boleh "0" atau ""
    for (let i = 0; i < itemDetails.length; i++) {
      const element = itemDetails[i];
      if (element.qty === '0' || element.qty === '') {
        Alert.alert('Validasi', 'Qty harap diisi');
        return false;
      }
    }

    // 7. Jika id_customer = 0 dan sisa != 0 → wajib isi customer (untuk piutang)
    const sisa = calculateSisa();
    if (idCustomer === 0 && sisa !== 0) {
      Alert.alert('Validasi', 'Mohon isi customer bila piutang');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (saving) return;

    if (!validateForm()) return;

    try {
      setSaving(true);

      // Get platform from customer name (SAMA seperti web line 2209-2214)
      const token = await getTokenAuth();
      if (!token) return;

      const customerRes = await fetch(
        `${API_BASE_URL}/get/customer/condition/or/id:equal:${idCustomer}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const customerData = await customerRes.json();

      let platform: string | null = null;
      if (customerData.status && customerData.data && customerData.data.length > 0) {
        platform = (customerData.data[0].nama as string).toUpperCase();
      }

      // Prepare data (SAMA seperti web lines 2190-2205)
      const data = itemDetails.map((itemDetail) => ({
        id_barang: itemDetail.id_barang,
        id_bundling: itemDetail.id_bundling,
        qty: itemDetail.qty,
        harga_beli: itemDetail.hargabeli,
        harga_jual: itemDetail.hargajual,
        harga_jual_exp: itemDetail.hargajual_exp,
        no_po: itemDetail.no_po || '',
        no_sj: itemDetail.no_sj || '',
        kodeBA: '51.1',
        is_manual: itemDetail.is_manual || false,
        nama: itemDetail.nama,
        sku: itemDetail.sku,
      }));

      const sisa = calculateSisa();
      const total = itemDetails.reduce(
        (a, b) => a + parseFloat(b.hargajual === '' ? '0' : b.hargajual) * parseInt(b.qty),
        0
      );

      // API Call (SAMA seperti web lines 2216-2258)
      const response = await fetch(`${API_BASE_URL}/penjualan?timestamp=${moment().unix()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            penjualan: {
              tanggal,
              id_customer: idCustomer,
              keterangan,
              bayar: parseFloat(terbayar === '' ? '0' : terbayar),
              bayarkontan: parseFloat(terbayar === '' ? '0' : terbayar),
              kodeBAbayar: terbayar === '' || terbayar === '0' ? null : kodeBaganAkun,
              piutangkontan: sisa,
              kodeBApiutang: sisa === 0 ? null : '113',
              kodeBApenjualan: '41.1',
              service: false,
              underservice: false,
              biaya_service: biayaService,
              total,
              online_id: idOnline,
              id_ecommerce: ecommerce.id,
              online_platform: platform,
              faktur_pajak: fakturPajak,
              no_invoice: noInvoice,
              no_surat_jalan: noSuratJalan,
              nomor_kendaraan: nomorKendaraan,
              nama_pengirim: namaPengirim,
              tgl_jatuh_tempo: tglJatuhTempo || null,
              ppn: ppnRate,
              useppn: isPkpActive,
              warehouse_id: selectedWarehouse || null,
            },
            detailpenjualan: data,
          },
        }),
      });

      const result = await response.json();

      if (result.status === true) {
        Alert.alert('Sukses', 'Penjualan berhasil disimpan', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('PenjualanSearch' as never),
          },
        ]);
      } else {
        Alert.alert('Error', JSON.stringify(result.reason));
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan penjualan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#dc2626" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Tambah Penjualan</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
        </View>

        {/* Form Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Transaksi</Text>

          {/* Tanggal */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Tanggal *</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                <Text style={styles.dateTimeButtonText}>
                  {moment(tanggal).format('DD MMM YYYY')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#2563eb" />
                <Text style={styles.dateTimeButtonText}>
                  {moment(tanggal).format('HH:mm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Customer */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Customer *</Text>
            <View style={styles.inputWithButton}>
              <TextInput
                style={[styles.input, styles.inputWithButtonInput]}
                value={`${idCustomer} - ${customerName}`}
                editable={false}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowCustomer(true)}
              >
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Warehouse */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Warehouse *</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Pilih Warehouse:</Text>
              {warehouses.map((wh) => (
                <TouchableOpacity
                  key={wh.id}
                  style={[
                    styles.pickerOption,
                    selectedWarehouse === wh.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setSelectedWarehouse(wh.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      selectedWarehouse === wh.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {wh.name}
                  </Text>
                  {selectedWarehouse === wh.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Ecommerce */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Ecommerce (Optional)</Text>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  ecommerce.id === 0 && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setEcommerce({ id: 0, name: '', platform: '' });
                  setIdCustomer(1);
                  setIdOnline('');
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    ecommerce.id === 0 && styles.pickerOptionTextSelected,
                  ]}
                >
                  Tidak ada (Offline)
                </Text>
                {ecommerce.id === 0 && (
                  <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
                )}
              </TouchableOpacity>
              {listEcommerce.map((ec) => (
                <TouchableOpacity
                  key={ec.id}
                  style={[
                    styles.pickerOption,
                    ecommerce.id === ec.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setEcommerce(ec);
                    const newCustomerId =
                      ec.platform === 'SHOPEE' ? 2 : ec.platform === 'TOKOPEDIA' ? 3 : ec.platform === 'LAZADA' ? 4 : 1;
                    setIdCustomer(newCustomerId);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      ecommerce.id === ec.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {ec.name} ({ec.platform})
                  </Text>
                  {ecommerce.id === ec.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ID Online (conditional) */}
          {ecommerce.id !== 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>ID Online *</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan ID Online"
                value={idOnline}
                onChangeText={setIdOnline}
              />
            </View>
          )}

          {/* Keterangan */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Keterangan</Text>
            <TextInput
              style={styles.input}
              placeholder="Keterangan transaksi"
              value={keterangan}
              onChangeText={setKeterangan}
            />
          </View>

          {/* Biaya Service */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Biaya Service</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={biayaService}
              onChangeText={setBiayaService}
              keyboardType="numeric"
            />
          </View>

          {/* Faktur Pajak */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Faktur Pajak</Text>
            <TextInput
              style={styles.input}
              placeholder="Nomor faktur pajak"
              value={fakturPajak}
              onChangeText={setFakturPajak}
            />
          </View>

          {/* Nomor Invoice */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nomor Invoice</Text>
            <TextInput
              style={styles.input}
              placeholder="Nomor invoice"
              value={noInvoice}
              onChangeText={setNoInvoice}
            />
          </View>

          {/* Nomor Surat Jalan */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nomor Surat Jalan</Text>
            <TextInput
              style={styles.input}
              placeholder="Nomor surat jalan"
              value={noSuratJalan}
              onChangeText={setNoSuratJalan}
            />
          </View>

          {/* Nomor Kendaraan */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nomor Kendaraan</Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: B 1234 ABC"
              value={nomorKendaraan}
              onChangeText={setNomorKendaraan}
            />
          </View>

          {/* Nama Pengirim */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nama Pengirim</Text>
            <TextInput
              style={styles.input}
              placeholder="Nama pengirim barang"
              value={namaPengirim}
              onChangeText={setNamaPengirim}
            />
          </View>
        </View>

        {/* PPN Section - Only show when PKP is active */}
        {isPkpActive && (
          <View style={styles.section}>
            <View style={styles.ppnHeader}>
              <Text style={styles.sectionTitle}>PPN (Pajak Pertambahan Nilai)</Text>
              <View style={styles.pkpBadge}>
                <Text style={styles.pkpBadgeText}>PKP Aktif</Text>
              </View>
            </View>

            {/* PPN Rate */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tarif PPN (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="11"
                value={ppnRate.toString()}
                onChangeText={(text) => setPpnRate(parseFloat(text) || 0)}
                keyboardType="numeric"
              />
            </View>

            {/* PPN Mode */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Mode Perhitungan</Text>
              <View style={styles.ppnModeContainer}>
                <TouchableOpacity
                  style={[
                    styles.ppnModeButton,
                    ppnMode === 'exclude' && styles.ppnModeButtonActive,
                  ]}
                  onPress={() => setPpnMode('exclude')}
                >
                  <Text
                    style={[
                      styles.ppnModeButtonText,
                      ppnMode === 'exclude' && styles.ppnModeButtonTextActive,
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
                >
                  <Text
                    style={[
                      styles.ppnModeButtonText,
                      ppnMode === 'include' && styles.ppnModeButtonTextActive,
                    ]}
                  >
                    Include PPN
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                {ppnMode === 'exclude' ? 'Harga belum termasuk PPN' : 'Harga sudah termasuk PPN'}
              </Text>
            </View>
          </View>
        )}

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daftar Barang</Text>

          {/* Add Item Buttons */}
          <View style={styles.addItemButtons}>
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowBarang(true)}
            >
              <Ionicons name="cube-outline" size={20} color="#2563eb" />
              <Text style={styles.addItemButtonText}>Master Barang</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowBundling(true)}
            >
              <Ionicons name="albums-outline" size={20} color="#2563eb" />
              <Text style={styles.addItemButtonText}>Bundling</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowManualItem(true)}
            >
              <Ionicons name="create-outline" size={20} color="#16a34a" />
              <Text style={styles.addItemButtonText}>Manual</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowBarcodeScanner(true)}
            >
              <Ionicons name="barcode-outline" size={20} color="#dc2626" />
              <Text style={styles.addItemButtonText}>Barcode</Text>
            </TouchableOpacity>
          </View>

          {/* Item Table */}
          {itemDetails.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>Belum ada barang</Text>
            </View>
          ) : (
            <FlatList
              data={itemDetails}
              scrollEnabled={false}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.nama}</Text>
                    <TouchableOpacity onPress={() => handleDeleteItem(index)}>
                      <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.itemSku}>SKU: {item.sku}</Text>

                  {item.is_wholesale_active && (
                    <View style={styles.wholesaleBadge}>
                      <Text style={styles.wholesaleBadgeText}>Harga Grosir Aktif</Text>
                    </View>
                  )}

                  <View style={styles.itemRow}>
                    <View style={styles.itemField}>
                      <Text style={styles.itemFieldLabel}>Qty</Text>
                      <TextInput
                        style={styles.itemInput}
                        value={item.qty}
                        onChangeText={(text) => handleUpdateItem(index, 'qty', text)}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.itemField}>
                      <Text style={styles.itemFieldLabel}>Harga Jual</Text>
                      <TextInput
                        style={styles.itemInput}
                        value={item.hargajual}
                        onChangeText={(text) => handleUpdateItem(index, 'hargajual', text)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.itemRow}>
                    <View style={styles.itemField}>
                      <Text style={styles.itemFieldLabel}>No PO</Text>
                      <TextInput
                        style={styles.itemInput}
                        value={item.no_po || ''}
                        onChangeText={(text) => handleUpdateItem(index, 'no_po', text)}
                      />
                    </View>

                    <View style={styles.itemField}>
                      <Text style={styles.itemFieldLabel}>No SJ</Text>
                      <TextInput
                        style={styles.itemInput}
                        value={item.no_sj || ''}
                        onChangeText={(text) => handleUpdateItem(index, 'no_sj', text)}
                      />
                    </View>
                  </View>

                  <View style={styles.itemTotal}>
                    <Text style={styles.itemTotalLabel}>Subtotal:</Text>
                    <Text style={styles.itemTotalValue}>
                      Rp {(parseFloat(item.hargajual) * parseInt(item.qty)).toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {/* Payment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pembayaran</Text>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal Barang:</Text>
              <Text style={styles.summaryValue}>
                Rp {calculateBaseTotal().toLocaleString('id-ID')}
              </Text>
            </View>

            {isPkpActive && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>PPN ({ppnRate}%):</Text>
                <Text style={styles.summaryValue}>
                  Rp {calculatePpnAmount().toLocaleString('id-ID')}
                </Text>
              </View>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Total:</Text>
              <Text style={styles.summaryValueBold}>
                Rp {calculateTotal().toLocaleString('id-ID')}
              </Text>
            </View>
          </View>

          {/* Bagan Akun */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Bagan Akun</Text>
            <View style={styles.inputWithButton}>
              <TextInput
                style={[styles.input, styles.inputWithButtonInput]}
                value={kodeBaganAkun ? `${kodeBaganAkun} - ${baganAkunName}` : ''}
                placeholder="Pilih bagan akun"
                editable={false}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowBaganAkun(true)}
              >
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bayar */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Bayar (Cash)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={bayar}
              onChangeText={setBayar}
              keyboardType="numeric"
            />
          </View>

          {/* Terbayar (auto-calculated) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Terbayar</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={terbayar}
              editable={false}
            />
          </View>

          {/* Kembalian */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Kembalian</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={kembalian.toLocaleString('id-ID')}
              editable={false}
            />
          </View>

          {/* Sisa (Piutang) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Sisa (Piutang)</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={calculateSisa().toLocaleString('id-ID')}
              editable={false}
            />
          </View>

          {/* Tanggal Jatuh Tempo */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Tanggal Jatuh Tempo</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={tglJatuhTempo}
              onChangeText={setTglJatuhTempo}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Simpan Penjualan</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modals */}
      <SearchCustomerModal
        visible={showCustomer}
        onClose={() => setShowCustomer(false)}
        onSelect={handleCustomerSelect}
      />

      <SearchBaganAkunModal
        visible={showBaganAkun}
        onClose={() => setShowBaganAkun(false)}
        onSelect={handleBaganAkunSelect}
      />

      <SearchBarangModal
        visible={showBarang}
        onClose={() => setShowBarang(false)}
        onSelect={handleBarangSelect}
        multiSelect
      />

      <SearchBundlingModal
        visible={showBundling}
        onClose={() => setShowBundling(false)}
        onSelect={handleBundlingSelect}
        exceptions={itemDetails
          .filter((item) => item.id_bundling)
          .map((item) => item.id_bundling!)}
      />

      <TambahItemManualModal
        visible={showManualItem}
        onClose={() => setShowManualItem(false)}
        onAdd={handleManualItemAdd}
      />

      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />

      {/* DateTimePicker Modals */}
      {showDatePicker && (
        <DateTimePicker
          value={moment(tanggal).toDate()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={moment(tanggal).toDate()}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#151515ff',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWithButtonInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
  },
  pickerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  ppnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pkpBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pkpBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ppnModeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ppnModeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  ppnModeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  ppnModeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  ppnModeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  dateTimeButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  addItemButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  addItemButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  itemCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  itemSku: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  wholesaleBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  wholesaleBadgeText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  itemField: {
    flex: 1,
  },
  itemFieldLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  itemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  itemTotalLabel: {
    fontSize: 14,
    color: '#666',
  },
  itemTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

