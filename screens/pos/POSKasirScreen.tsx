import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import BluetoothPrinterService, { BluetoothDevice, ReceiptData } from '../../services/BluetoothPrinterService';
import { useAuth } from '../../context/AuthContext';
import { useOrientation } from '../../hooks/useOrientation';

interface Product {
  id: number;
  nama: string;
  sku: string;
  barcode?: string;
  hargajual: number;
  hargabeli: number | null;
  stok: number;
  satuan: string;
  merk?: string;
  kategori?: string;
  harga_grosir?: number;
  qty_grosir?: number;
  is_bundling?: boolean; // Flag to identify bundling items
}

interface CartItem extends Product {
  qty: number;
  subtotal: number;
  is_wholesale: boolean;
  is_manual?: boolean; // Flag to identify manual items
  is_bundling?: boolean; // Flag to identify bundling items
  id_barang?: number; // For regular products
  id_bundling?: number; // For bundling products
}

interface Customer {
  id: number;
  nama: string;
}

interface BaganAkun {
  kode: string;
  nama: string;
  kode_induk: string;
  depth: number;
  stop: boolean;
}

const POSKasirScreen = ({ navigation }: any): JSX.Element => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const orientation = useOrientation();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>({ id: 1, nama: 'Umum' });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Barcode scanner states
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'code-128', 'code-39', 'code-93'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        handleBarcodeScan({ data: codes[0].value });
      }
    },
  });

  // Payment method (Bagan Akun) states
  const [showBaganAkunModal, setShowBaganAkunModal] = useState(false);
  const [baganAkunList, setBaganAkunList] = useState<BaganAkun[]>([]);
  const [selectedBaganAkun, setSelectedBaganAkun] = useState<BaganAkun | null>(null);
  const [baganAkunSearch, setBaganAkunSearch] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bayar, setBayar] = useState(''); // Cash received from customer
  const [terbayar, setTerbayar] = useState(''); // Amount settled for this transaction
  const [kembalian, setKembalian] = useState(0); // Change = bayar - total
  const [keterangan, setKeterangan] = useState('');
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printers, setPrinters] = useState<BluetoothDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('80mm');
  const [receiptLanguage, setReceiptLanguage] = useState<'id' | 'en'>('id');
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [isPkpActive, setIsPkpActive] = useState(false);
  const [ppnRate, setPpnRate] = useState(11);
  const [saving, setSaving] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Manual item states
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [manualItemQty, setManualItemQty] = useState('1');

  // Store settings
  const [storeSettings, setStoreSettings] = useState({
    name: 'PlexSeller',
    address: '',
    motto: '',
    phone: '',
  });

  useEffect(() => {
    loadCustomers();
    loadSettings();
    loadBaganAkun();
    requestCameraPermission();
    loadSavedBaganAkun();
    loadSavedPrinter();
    // Focus on search input when screen loads
    setTimeout(() => searchInputRef.current?.focus(), 300);
  }, []);

  const requestCameraPermission = async () => {
    const status = await Camera.requestCameraPermission();
    setHasPermission(status === 'granted');
  };

  const loadBaganAkun = async () => {
    try {
      const token = await getTokenAuth();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/get/baganakun`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.status) {
        // Filter only "stop" accounts (leaf nodes) under code 111 (Cash/Bank accounts)
        const cashAccounts = data.data.filter((item: BaganAkun) =>
          item.stop && (item.kode.startsWith('111') || item.kode_induk === '111')
        );
        setBaganAkunList(cashAccounts);
      }
    } catch (error) {
      console.error('Error loading bagan akun:', error);
    }
  };

  const loadSavedBaganAkun = async () => {
    try {
      const saved = await AsyncStorage.getItem('pos_selected_bagan_akun');
      if (saved) {
        const baganAkun = JSON.parse(saved);
        setSelectedBaganAkun(baganAkun);
      }
    } catch (error) {
      console.error('Error loading saved bagan akun:', error);
    }
  };

  const saveBaganAkunSelection = async (baganAkun: BaganAkun) => {
    try {
      await AsyncStorage.setItem('pos_selected_bagan_akun', JSON.stringify(baganAkun));
      setSelectedBaganAkun(baganAkun);
    } catch (error) {
      console.error('Error saving bagan akun selection:', error);
    }
  };

  const loadSavedPrinter = async () => {
    try {
      const savedPrinterAddress = await AsyncStorage.getItem('pos_selected_printer');
      const savedPaperSize = await AsyncStorage.getItem('pos_paper_size');
      const savedLanguage = await AsyncStorage.getItem('pos_receipt_language');

      if (savedPrinterAddress) {
        setSelectedPrinter(savedPrinterAddress);
        console.log('🖨️ [PRINTER] Loaded saved printer:', savedPrinterAddress);
      }

      if (savedPaperSize) {
        setPaperSize(savedPaperSize as '58mm' | '80mm');
        console.log('📄 [PRINTER] Loaded saved paper size:', savedPaperSize);
      }

      if (savedLanguage) {
        setReceiptLanguage(savedLanguage as 'id' | 'en');
        console.log('🌐 [PRINTER] Loaded saved language:', savedLanguage);
      }
    } catch (error) {
      console.error('Error loading saved printer:', error);
    }
  };

  const savePrinterSelection = async (printerAddress: string) => {
    try {
      await AsyncStorage.setItem('pos_selected_printer', printerAddress);
      setSelectedPrinter(printerAddress);
      console.log('🖨️ [PRINTER] Saved printer selection:', printerAddress);
    } catch (error) {
      console.error('Error saving printer selection:', error);
    }
  };

  const savePaperSizeSelection = async (size: '58mm' | '80mm') => {
    try {
      await AsyncStorage.setItem('pos_paper_size', size);
      setPaperSize(size);
      console.log('📄 [PRINTER] Saved paper size:', size);
    } catch (error) {
      console.error('Error saving paper size:', error);
    }
  };

  const saveLanguageSelection = async (language: 'id' | 'en') => {
    try {
      await AsyncStorage.setItem('pos_receipt_language', language);
      setReceiptLanguage(language);
      console.log('🌐 [PRINTER] Saved receipt language:', language);
    } catch (error) {
      console.error('Error saving receipt language:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const token = await getTokenAuth();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/get/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.status) {
        // Load PKP setting
        const pkpSetting = data.data.find((s: any) => s.setting === 'pkp');
        if (pkpSetting) {
          setIsPkpActive(pkpSetting.value === '1' || pkpSetting.value === true);
        }

        // Load store settings for receipt printing
        const storeName = data.data.find((s: any) => s.setting === 'printer:nama_toko')?.value || 'PlexSeller';
        const storeAddress = data.data.find((s: any) => s.setting === 'printer:alamat_toko')?.value || '';
        const storeMotto = data.data.find((s: any) => s.setting === 'printer:moto_toko')?.value || '';
        const storePhone = data.data.find((s: any) => s.setting === 'printer:no_telp_toko')?.value || '';

        setStoreSettings({
          name: storeName,
          address: storeAddress,
          motto: storeMotto,
          phone: storePhone,
        });

        console.log('📋 [SETTINGS] Store settings loaded:', { storeName, storeAddress, storeMotto, storePhone });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    }
  };

  const loadCustomers = async () => {
    try {
      const token = await getTokenAuth();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/get/customer`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.status) {
        setCustomers(data.data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    }
  };

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setProducts([]);
      setShowProductList(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getTokenAuth();
      if (!token) {
        console.error('No auth token available');
        setLoading(false);
        return;
      }

      // Strategy: Search both masterbarang and bundling, then merge results
      
      // PART 1: Search masterbarang (existing logic)
      const qsSku = new URLSearchParams();
      qsSku.set('start', '0');
      qsSku.set('end', '20');
      qsSku.set('sku', query);
      qsSku.set('nama', '');
      qsSku.set('merk', '');
      qsSku.set('kategori', '');

      const qsNama = new URLSearchParams();
      qsNama.set('start', '0');
      qsNama.set('end', '20');
      qsNama.set('sku', '');
      qsNama.set('nama', query);
      qsNama.set('merk', '');
      qsNama.set('kategori', '');

      console.log('🔍 [POS] Searching products and bundling...');

      // Execute masterbarang searches in parallel
      const [responseSku, responseNama] = await Promise.all([
        fetch(`${API_BASE_URL}/get/masterbarang/search?${qsSku.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/get/masterbarang/search?${qsNama.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const dataSku = await responseSku.json();
      const dataNama = await responseNama.json();

      // Merge masterbarang results and remove duplicates by ID
      const barangProducts: Product[] = [];
      const seenIds = new Set<number>();

      if (dataSku.status && dataSku.data) {
        dataSku.data.forEach((product: Product) => {
          if (!seenIds.has(product.id)) {
            barangProducts.push({ ...product, is_bundling: false });
            seenIds.add(product.id);
          }
        });
      }

      if (dataNama.status && dataNama.data) {
        dataNama.data.forEach((product: Product) => {
          if (!seenIds.has(product.id)) {
            barangProducts.push({ ...product, is_bundling: false });
            seenIds.add(product.id);
          }
        });
      }

      // PART 2: Search bundling
      const bundlingResponse = await fetch(`${API_BASE_URL}/get/bundling`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const bundlingData = await bundlingResponse.json();
      const bundlingProducts: Product[] = [];

      if (bundlingData.status && bundlingData.data) {
        // Filter bundling by query (search in nama or sku)
        const filteredBundling = bundlingData.data.filter((bundling: any) => {
          const searchLower = query.toLowerCase();
          const namaMatch = bundling.nama?.toLowerCase().includes(searchLower);
          const skuMatch = bundling.sku?.toLowerCase().includes(searchLower);
          return namaMatch || skuMatch;
        });

        // Map bundling to Product interface
        filteredBundling.forEach((bundling: any) => {
          bundlingProducts.push({
            id: bundling.id,
            nama: bundling.nama,
            sku: bundling.sku,
            hargajual: bundling.harga || bundling.hargajual || 0,
            hargabeli: bundling.hpp || 0,
            stok: bundling.stok || 0,
            satuan: 'set', // Bundling typically sold as set
            is_bundling: true,
          });
        });
      }

      // Merge both results
      const allProducts = [...barangProducts, ...bundlingProducts];

      console.log(`🔍 [POS] Found ${barangProducts.length} products and ${bundlingProducts.length} bundling items`);

      setProducts(allProducts);
      setShowProductList(allProducts.length > 0);

    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'Failed to search products');
    } finally {
      setLoading(false);
    }
  };

  const scanBarcode = async (barcode: string) => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) return;

      // Query masterbarang by barcode using condition endpoint
      const url = `${API_BASE_URL}/get/masterbarang/condition/and/0/1?query=barcode:equal:${encodeURIComponent(barcode)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (!data.status || !data.data || data.data.length === 0) {
        Alert.alert('Barcode Not Found', `Barcode "${barcode}" tidak ditemukan di database`);
        return;
      }

      const product = data.data[0];

      // Add product to cart (mark as regular product, not bundling)
      addToCart({ ...product, is_bundling: false });

      // Show success feedback
      Alert.alert('Success', `${product.nama} ditambahkan ke keranjang`);

    } catch (error) {
      console.error('Error scanning barcode:', error);
      Alert.alert('Error', 'Gagal memproses barcode');
    } finally {
      setLoading(false);
      setShowBarcodeScanner(false);
    }
  };

  const handleBarcodeScan = ({ data }: { data: string }) => {
    if (scannedBarcode === data) return; // Prevent duplicate scans

    setScannedBarcode(data);
    scanBarcode(data);

    // Reset after 2 seconds to allow scanning again
    setTimeout(() => setScannedBarcode(''), 2000);
  };

  const addToCart = (product: Product) => {
    // Check if it's a bundling or regular product
    const isBundling = product.is_bundling === true;
    
    // Find existing item in cart
    const existingIndex = cart.findIndex(item => {
      if (isBundling) {
        // For bundling: match by id_bundling
        return item.id_bundling === product.id && item.is_bundling === true;
      } else {
        // For regular product: match by id_barang
        return item.id_barang === product.id && !item.is_bundling;
      }
    });

    if (existingIndex >= 0) {
      // Update quantity
      const newCart = [...cart];
      const newQty = newCart[existingIndex].qty + 1;

      // Check wholesale pricing (only for regular products, not bundling)
      const isWholesale = !isBundling && product.harga_grosir && product.qty_grosir && newQty >= product.qty_grosir;
      const price = isWholesale ? (product.harga_grosir || 0) : (product.hargajual || 0);

      newCart[existingIndex].qty = newQty;
      newCart[existingIndex].subtotal = price * newQty;
      newCart[existingIndex].is_wholesale = !!isWholesale;

      setCart(newCart);
    } else {
      // Add new item
      const isWholesale = !isBundling && product.harga_grosir && product.qty_grosir && 1 >= product.qty_grosir;
      const price = isWholesale ? (product.harga_grosir || 0) : (product.hargajual || 0);

      const newItem: CartItem = {
        ...product,
        qty: 1,
        subtotal: price,
        is_wholesale: !!isWholesale,
        is_bundling: isBundling,
        // Set appropriate ID field
        ...(isBundling 
          ? { id_bundling: product.id, id_barang: undefined }
          : { id_barang: product.id, id_bundling: undefined }
        ),
      };

      setCart([...cart, newItem]);
    }

    // Clear search
    setSearchQuery('');
    setProducts([]);
    setShowProductList(false);
    searchInputRef.current?.focus();
  };

  const updateCartItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    const newCart = [...cart];
    const item = newCart[index];

    // Check wholesale pricing
    const isWholesale = item.harga_grosir && item.qty_grosir && newQty >= item.qty_grosir;
    const price = isWholesale ? (item.harga_grosir || 0) : (item.hargajual || 0);

    newCart[index].qty = newQty;
    newCart[index].subtotal = price * newQty;
    newCart[index].is_wholesale = !!isWholesale;

    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  const addManualItemToCart = () => {
    // Validation
    if (!manualItemName.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }
    if (!manualItemPrice.trim() || parseFloat(manualItemPrice) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    if (!manualItemQty.trim() || parseInt(manualItemQty) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    const price = parseFloat(manualItemPrice);
    const qty = parseInt(manualItemQty);

    // Create a manual item with a unique negative ID to avoid conflicts with real products
    const manualItem: CartItem = {
      id: -(Date.now()), // Negative timestamp as unique ID
      nama: manualItemName,
      sku: 'MANUAL',
      hargajual: price,
      hargabeli: null,
      stok: 0,
      satuan: 'pcs',
      qty: qty,
      subtotal: price * qty,
      is_wholesale: false,
      is_manual: true,
    };

    setCart([...cart, manualItem]);

    // Reset form and close modal
    setManualItemName('');
    setManualItemPrice('');
    setManualItemQty('1');
    setShowManualItemModal(false);

    Alert.alert('Success', 'Manual item added to cart');
  };

  const updateCartItemPrice = (index: number, newPrice: string) => {
    const price = parseFloat(newPrice || '0');
    const newCart = [...cart];
    const item = newCart[index];

    // Update price in product data
    newCart[index].hargajual = price;
    // Recalculate subtotal
    newCart[index].subtotal = price * item.qty;

    setCart(newCart);
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const ppn = isPkpActive ? subtotal * (ppnRate / 100) : 0;
    return {
      subtotal,
      ppn,
      total: subtotal + ppn,
    };
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    // Auto-fill bayar with total when opening payment modal
    const { total } = calculateTotal();
    setBayar(total.toString());
    setTerbayar(total.toString());
    setKembalian(0);
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    const { total } = calculateTotal();
    const terbayarAmount = parseFloat(terbayar || '0');
    const sisa = total - terbayarAmount;

    // Validate: sisa cannot be negative
    if (sisa < 0) {
      Alert.alert('Error', 'Terbayar tidak boleh lebih dari total');
      return;
    }

    // Validate: if there's piutang (sisa > 0), customer must be selected
    if (sisa > 0 && selectedCustomer.id === 0) {
      Alert.alert('Error', 'Mohon isi customer bila ada piutang');
      return;
    }

    // Validate bagan akun is selected if terbayar > 0
    if (terbayarAmount > 0 && !selectedBaganAkun) {
      Alert.alert('Error', 'Silahkan pilih Bagan Akun (Payment Method)');
      return;
    }

    setSaving(true);
    try {
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        setSaving(false);
        return;
      }

      const tanggal = new Date().toISOString();
      const detailpenjualan = cart.map(item => {
        const itemData = {
          id_barang: item.is_manual || item.is_bundling ? undefined : item.id_barang, // undefined for manual/bundling items
          id_bundling: item.is_bundling ? item.id_bundling : undefined, // set for bundling items
          qty: item.qty.toString(),
          harga_beli: (item.hargabeli || 0).toString(),
          harga_jual: item.is_wholesale && item.harga_grosir ? item.harga_grosir.toString() : item.hargajual.toString(),
          harga_jual_exppn: item.is_wholesale && item.harga_grosir ? item.harga_grosir.toString() : item.hargajual.toString(),
          no_po: '',
          no_sj: '',
          kodeBA: '51.1',
          is_manual: item.is_manual === true, // Explicitly check for true
          nama: item.nama,
          sku: item.sku,
          satuan: item.satuan || 'pcs',
          merk: item.merk || '',
          kategori: item.kategori || '',
        };

        console.log('Item mapping:', {
          nama: item.nama,
          is_manual_source: item.is_manual,
          is_bundling_source: item.is_bundling,
          is_manual_result: itemData.is_manual,
          id_barang: itemData.id_barang,
          id_bundling: itemData.id_bundling
        });

        return itemData;
      });

      console.log('=== SUBMITTING SALE ===');
      console.log('Total items:', detailpenjualan.length);
      console.log('Manual items:', detailpenjualan.filter(i => i.is_manual).length);
      console.log('Bundling items:', detailpenjualan.filter(i => i.id_bundling).length);
      console.log('Regular items:', detailpenjualan.filter(i => !i.is_manual && !i.id_bundling).length);
      console.log('Detail penjualan:', JSON.stringify(detailpenjualan, null, 2));

      const response = await fetch(`${API_BASE_URL}/penjualan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            penjualan: {
              tanggal,
              id_customer: selectedCustomer.id,
              keterangan,
              bayar: terbayarAmount,
              bayarkontan: terbayarAmount,
              kodeBAbayar: terbayarAmount > 0 ? selectedBaganAkun?.kode : null,
              piutangkontan: sisa,
              kodeBApiutang: sisa > 0 ? '113' : null,
              kodeBApenjualan: '41.1',
              service: false,
              underservice: false,
              biaya_service: 0,
              total: total,
              ppn: ppnRate,
              useppn: isPkpActive,
            },
            detailpenjualan,
          },
        }),
      });

      const data = await response.json();

      if (data.status) {
        // Close payment modal first
        setShowPaymentModal(false);
        setSaving(false);

        // Check if printer is configured
        if (selectedPrinter) {
          // Printer is configured - ask to print
          Alert.alert(
            'Success',
            'Transaction completed successfully. Print receipt?',
            [
              {
                text: 'Yes, Print',
                onPress: async () => {
                  await printReceipt(data.id, terbayarAmount);
                  // After printing, ask for new sale
                  Alert.alert('Print Complete', 'Start a new sale?', [
                    { text: 'Yes', onPress: () => resetTransaction() },
                    { text: 'No', style: 'cancel' },
                  ]);
                },
              },
              {
                text: 'No, New Sale',
                onPress: () => resetTransaction(),
                style: 'default',
              },
              {
                text: 'Close',
                style: 'cancel',
              },
            ]
          );
        } else {
          // No printer configured - show original options
          Alert.alert('Success', 'Transaction completed successfully', [
            {
              text: 'Print Receipt',
              onPress: () => {
                printReceipt(data.id, terbayarAmount);
              },
            },
            {
              text: 'New Sale',
              onPress: () => resetTransaction(),
              style: 'default',
            },
            {
              text: 'Close',
              style: 'cancel',
            },
          ]);
        }
      } else {
        Alert.alert('Error', data.reason || 'Failed to process transaction');
        setSaving(false);
        setShowPaymentModal(false);
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', error.message || 'Failed to process transaction');
      setSaving(false);
      setShowPaymentModal(false);
    }
  };

  const resetTransaction = () => {
    setCart([]);
    setBayar('');
    setTerbayar('');
    setKembalian(0);
    setKeterangan('');
    setSelectedCustomer({ id: 1, nama: 'Umum' });
    searchInputRef.current?.focus();
  };

  const printReceipt = async (invoiceId: number, payment: number) => {
    // Check Bluetooth is enabled first
    try {
      const enabled = await BluetoothPrinterService.isBluetoothEnabled();
      if (!enabled) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please turn on Bluetooth in your device settings to print receipts.',
          [
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }
    } catch (error) {
      console.error('Bluetooth check error:', error);
    }

    if (!selectedPrinter) {
      Alert.alert('No Printer', 'Please select a printer first', [
        { text: 'Select Printer', onPress: () => setShowPrinterModal(true) },
        { text: 'Skip', style: 'cancel' },
      ]);
      return;
    }

    try {
      const connected = await BluetoothPrinterService.connect(selectedPrinter);
      if (!connected) {
        Alert.alert('Error', 'Failed to connect to printer');
        return;
      }

      const { subtotal, ppn, total } = calculateTotal();
      const receiptData: ReceiptData = {
        storeName: storeSettings.name,
        storeMotto: storeSettings.motto,
        storeAddress: storeSettings.address,
        storePhone: storeSettings.phone,
        invoiceNumber: `INV-${invoiceId}`,
        receiptNumber: `INV-${invoiceId}`,
        date: new Date().toLocaleString('id-ID'),
        cashier: (user as any)?.email || 'Cashier',
        customerName: selectedCustomer.nama !== 'Umum' ? selectedCustomer.nama : undefined,
        items: cart.map(item => ({
          name: item.nama,
          qty: item.qty,
          price: item.subtotal / item.qty,
          total: item.subtotal,
        })),
        subtotal,
        tax: isPkpActive ? ppn : undefined,
        ppn: isPkpActive ? ppn : undefined,
        ppnRate: isPkpActive ? ppnRate : undefined,
        total,
        payment,
        change: payment - total,
      };

      const printed = await BluetoothPrinterService.printReceipt(receiptData, paperSize, receiptLanguage);
      if (printed) {
        Alert.alert('Success', 'Receipt printed successfully');
        resetTransaction();
      } else {
        Alert.alert('Error', 'Failed to print receipt');
      }
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  const scanPrinters = async () => {
    try {
      setScanningPrinters(true);
      console.log('🔍 [BLUETOOTH] Starting printer scan...');

      const hasPermission = await BluetoothPrinterService.requestBluetoothPermissions();
      console.log('🔍 [BLUETOOTH] Permission granted:', hasPermission);
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Bluetooth permissions are required');
        setScanningPrinters(false);
        return;
      }

      const enabled = await BluetoothPrinterService.isBluetoothEnabled();
      console.log('🔍 [BLUETOOTH] Bluetooth enabled:', enabled);
      if (!enabled) {
        const enabledNow = await BluetoothPrinterService.enableBluetooth();
        console.log('🔍 [BLUETOOTH] Bluetooth enabled now:', enabledNow);
        if (!enabledNow) {
          Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth');
          setScanningPrinters(false);
          return;
        }
      }

      console.log('🔍 [BLUETOOTH] Scanning for devices...');
      const devices = await BluetoothPrinterService.scanDevices();
      console.log('🔍 [BLUETOOTH] Found devices:', devices.length, devices);

      setPrinters(devices);

      if (devices.length === 0) {
        Alert.alert('No Devices Found', 'No Bluetooth printers found. Make sure your printer is turned on and in pairing mode.');
      } else {
        Alert.alert('Success', `Found ${devices.length} Bluetooth device(s)`);
      }
    } catch (error) {
      console.error('❌ [BLUETOOTH] Scan error:', error);
      Alert.alert('Error', `Failed to scan for printers: ${error}`);
    } finally {
      setScanningPrinters(false);
    }
  };

  const testPrint = async () => {
    if (!selectedPrinter) {
      Alert.alert('Error', 'Please select a printer first');
      return;
    }

    try {
      const connected = await BluetoothPrinterService.connect(selectedPrinter);
      if (!connected) {
        Alert.alert('Error', 'Failed to connect to printer');
        return;
      }

      const success = await BluetoothPrinterService.testPrint();
      if (success) {
        Alert.alert('Success', 'Test print completed');
      } else {
        Alert.alert('Error', 'Test print failed');
      }
    } catch (error) {
      console.error('Test print error:', error);
      Alert.alert('Error', 'Test print failed');
    }
  };

  // Render landscape layout for tablets
  const renderLandscapeLayout = () => (
    <View style={styles.landscapeContainer}>
      {/* Left Panel - Product Search and List */}
      <View style={styles.landscapeLeftPanel}>
        {/* Search Bar */}
        <View style={styles.landscapeSearchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search by SKU, Barcode, or Name..."
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchProducts(text);
            }}
            autoCapitalize="none"
          />
          {loading && <ActivityIndicator size="small" color="#f59e0b" />}
          <TouchableOpacity
            style={styles.barcodeButton}
            onPress={() => setShowManualItemModal(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.barcodeButton}
            onPress={() => setShowBarcodeScanner(true)}
          >
            <Ionicons name="barcode-outline" size={24} color="#f59e0b" />
          </TouchableOpacity>
        </View>

        {/* Product List - Enhanced for Landscape */}
        <View style={styles.landscapeProductListContainer}>
          {showProductList && products.length > 0 ? (
            <FlatList
              data={products}
              keyExtractor={(item) => `${item.is_bundling ? 'b' : 'p'}-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.landscapeProductItem}
                  onPress={() => addToCart(item)}
                >
                  <View style={styles.landscapeProductInfo}>
                    <View style={styles.landscapeProductHeader}>
                      <Text style={styles.landscapeProductName} numberOfLines={2}>{item.nama}</Text>
                      {item.is_bundling && (
                        <View style={styles.bundlingBadge}>
                          <Text style={styles.bundlingBadgeText}>Bundling</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.landscapeProductDetails}>
                      <View style={styles.landscapeProductDetailRow}>
                        <Text style={styles.landscapeProductLabel}>SKU:</Text>
                        <Text style={styles.landscapeProductValue}>{item.sku}</Text>
                      </View>
                      {item.barcode && (
                        <View style={styles.landscapeProductDetailRow}>
                          <Text style={styles.landscapeProductLabel}>Barcode:</Text>
                          <Text style={styles.landscapeProductValue}>{item.barcode}</Text>
                        </View>
                      )}
                      <View style={styles.landscapeProductDetailRow}>
                        <Text style={styles.landscapeProductLabel}>Stock:</Text>
                        <Text style={[styles.landscapeProductValue, { color: item.stok > 0 ? '#10B981' : '#EF4444' }]}>
                          {item.stok} {item.satuan}
                        </Text>
                      </View>
                      {item.merk && (
                        <View style={styles.landscapeProductDetailRow}>
                          <Text style={styles.landscapeProductLabel}>Brand:</Text>
                          <Text style={styles.landscapeProductValue}>{item.merk}</Text>
                        </View>
                      )}
                      {item.kategori && (
                        <View style={styles.landscapeProductDetailRow}>
                          <Text style={styles.landscapeProductLabel}>Category:</Text>
                          <Text style={styles.landscapeProductValue}>{item.kategori}</Text>
                        </View>
                      )}
                      {item.harga_grosir && item.qty_grosir && (
                        <View style={styles.landscapeProductDetailRow}>
                          <Text style={styles.landscapeProductLabel}>Wholesale:</Text>
                          <Text style={styles.landscapeProductValue}>
                            Rp {item.harga_grosir.toLocaleString('id-ID')} (min {item.qty_grosir})
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.landscapeProductPriceContainer}>
                    <Text style={styles.landscapeProductPrice}>
                      Rp {(item.hargajual || 0).toLocaleString('id-ID')}
                    </Text>
                    {item.hargabeli && (
                      <Text style={styles.landscapeProductCost}>
                        Cost: Rp {item.hargabeli.toLocaleString('id-ID')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.landscapeEmptyProducts}>
              <Ionicons name="search-outline" size={64} color="#D1D5DB" />
              <Text style={styles.landscapeEmptyProductsText}>
                {searchQuery ? 'No products found' : 'Search for products to add to cart'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Right Panel - Cart and Checkout */}
      <View style={styles.landscapeRightPanel}>
        {/* Customer Info */}
        <TouchableOpacity
          style={styles.landscapeCustomerCard}
          onPress={() => setShowCustomerModal(true)}
        >
          <View style={styles.landscapeCustomerInfo}>
            <Ionicons name="person" size={24} color="#f59e0b" />
            <View style={styles.landscapeCustomerTextContainer}>
              <Text style={styles.landscapeCustomerLabel}>Customer</Text>
              <Text style={styles.landscapeCustomerName}>{selectedCustomer.nama}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Cart */}
        <View style={styles.landscapeCartContainer}>
          <View style={styles.landscapeCartHeader}>
            <Text style={styles.landscapeCartTitle}>Cart ({cart.length} items)</Text>
          </View>

          <FlatList
            data={cart}
            keyExtractor={(item, index) => `${item.is_bundling ? 'b' : item.is_manual ? 'm' : 'p'}-${item.id || index}`}
            renderItem={({ item, index }) => (
              <View style={styles.landscapeCartItem}>
                <View style={styles.landscapeCartItemMain}>
                  <View style={styles.landscapeCartItemHeader}>
                    <Text style={styles.landscapeCartItemName} numberOfLines={1}>{item.nama}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(index)}>
                      <Ionicons name="trash" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.landscapeCartItemBadges}>
                    {item.is_manual && (
                      <View style={styles.manualBadge}>
                        <Text style={styles.manualBadgeText}>Manual</Text>
                      </View>
                    )}
                    {item.is_bundling && (
                      <View style={styles.bundlingBadge}>
                        <Text style={styles.bundlingBadgeText}>Bundling</Text>
                      </View>
                    )}
                    {item.is_wholesale && (
                      <View style={styles.wholesaleBadge}>
                        <Text style={styles.wholesaleBadgeText}>Wholesale</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.landscapeCartItemSku}>
                    SKU: {item.sku} {!item.is_manual && `• Stock: ${item.stok} ${item.satuan}`}
                  </Text>
                </View>

                <View style={styles.landscapeCartItemControls}>
                  <View style={styles.landscapePriceQtyRow}>
                    <View style={styles.landscapePriceEdit}>
                      <Text style={styles.landscapePriceLabel}>Price:</Text>
                      <View style={styles.landscapePriceInputContainer}>
                        <Text style={styles.landscapePricePrefix}>Rp </Text>
                        <TextInput
                          style={styles.landscapePriceInput}
                          keyboardType="numeric"
                          value={(item.hargajual || 0).toString()}
                          onChangeText={(val) => updateCartItemPrice(index, val)}
                        />
                      </View>
                    </View>

                    <View style={styles.landscapeQtyControl}>
                      <Text style={styles.landscapeQtyLabel}>Qty:</Text>
                      <View style={styles.landscapeQtyButtons}>
                        <TouchableOpacity
                          onPress={() => updateCartItemQty(index, item.qty - 1)}
                          style={styles.landscapeQtyButton}
                        >
                          <Ionicons name="remove" size={18} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.landscapeQtyText}>{item.qty}</Text>
                        <TouchableOpacity
                          onPress={() => updateCartItemQty(index, item.qty + 1)}
                          style={styles.landscapeQtyButton}
                        >
                          <Ionicons name="add" size={18} color="white" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.landscapeSubtotalRow}>
                    <Text style={styles.landscapeSubtotalLabel}>Subtotal:</Text>
                    <Text style={styles.landscapeSubtotalValue}>
                      Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.landscapeEmptyCart}>
                <Ionicons name="cart-outline" size={64} color="#D1D5DB" />
                <Text style={styles.landscapeEmptyCartText}>Cart is empty</Text>
              </View>
            }
          />
        </View>

        {/* Total and Checkout */}
        <View style={styles.landscapeFooter}>
          <View style={styles.landscapeTotalContainer}>
            <View style={styles.landscapeTotalRow}>
              <Text style={styles.landscapeTotalLabel}>Subtotal:</Text>
              <Text style={styles.landscapeTotalValue}>
                Rp {calculateTotal().subtotal.toLocaleString('id-ID')}
              </Text>
            </View>
            {isPkpActive && (
              <View style={styles.landscapeTotalRow}>
                <Text style={styles.landscapeTotalLabel}>PPN ({ppnRate}%):</Text>
                <Text style={styles.landscapeTotalValue}>
                  Rp {calculateTotal().ppn.toLocaleString('id-ID')}
                </Text>
              </View>
            )}
            <View style={[styles.landscapeTotalRow, styles.landscapeGrandTotalRow]}>
              <Text style={styles.landscapeGrandTotalLabel}>Total:</Text>
              <Text style={styles.landscapeGrandTotalValue}>
                Rp {calculateTotal().total.toLocaleString('id-ID')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.landscapeCheckoutButton, cart.length === 0 && styles.landscapeCheckoutButtonDisabled]}
            onPress={handleCheckout}
            disabled={cart.length === 0}
          >
            <Ionicons name="card-outline" size={24} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.landscapeCheckoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render portrait layout (original)
  const renderPortraitLayout = () => (
    <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search by SKU, Barcode, or Name..."
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchProducts(text);
            }}
            autoCapitalize="none"
          />
          {loading && <ActivityIndicator size="small" color="#f59e0b" />}
          <TouchableOpacity
            style={styles.barcodeButton}
            onPress={() => setShowManualItemModal(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.barcodeButton}
            onPress={() => setShowBarcodeScanner(true)}
          >
            <Ionicons name="barcode-outline" size={24} color="#f59e0b" />
          </TouchableOpacity>
        </View>

        {/* Product List */}
        {showProductList && products.length > 0 && (
          <View style={styles.productListContainer}>
            <FlatList
              data={products}
              keyExtractor={(item) => `${item.is_bundling ? 'b' : 'p'}-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productItem}
                  onPress={() => addToCart(item)}
                >
                  <View style={styles.productInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.productName}>{item.nama}</Text>
                      {item.is_bundling && (
                        <View style={styles.bundlingBadge}>
                          <Text style={styles.bundlingBadgeText}>Bundling</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.productSku}>SKU: {item.sku}</Text>
                    <Text style={styles.productStock}>Stock: {item.stok} {item.satuan}</Text>
                  </View>
                  <Text style={styles.productPrice}>
                    Rp {(item.hargajual || 0).toLocaleString('id-ID')}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.productList}
            />
          </View>
        )}

        {/* Cart */}
        <View style={styles.cartContainer}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Cart ({cart.length} items)</Text>
            <TouchableOpacity onPress={() => setShowCustomerModal(true)}>
              <Text style={styles.customerText}>
                <Ionicons name="person" size={16} /> {selectedCustomer.nama}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={cart}
            keyExtractor={(item, index) => `${item.is_bundling ? 'b' : item.is_manual ? 'm' : 'p'}-${item.id || index}`}
            renderItem={({ item, index }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <View style={styles.cartItemNameRow}>
                    <Text style={styles.cartItemName}>{item.nama}</Text>
                    {item.is_manual && (
                      <View style={styles.manualBadge}>
                        <Text style={styles.manualBadgeText}>Manual</Text>
                      </View>
                    )}
                    {item.is_bundling && (
                      <View style={styles.bundlingBadge}>
                        <Text style={styles.bundlingBadgeText}>Bundling</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cartItemSku}>
                    SKU: {item.sku} {!item.is_manual && `• Stock: ${item.stok} ${item.satuan}`}
                  </Text>
                  {item.is_wholesale && (
                    <Text style={styles.wholesaleTag}>Wholesale Price</Text>
                  )}
                  {/* Editable Price with Quantity */}
                  <View style={styles.priceQtyContainer}>
                    <View style={styles.priceEditContainer}>
                      <Text style={styles.priceEditLabel}>Rp </Text>
                      <TextInput
                        style={styles.priceEditInput}
                        keyboardType="numeric"
                        value={(item.hargajual || 0).toString()}
                        onChangeText={(val) => updateCartItemPrice(index, val)}
                      />
                    </View>
                    <Text style={styles.priceQtyMultiplier}> × </Text>
                    <View style={styles.qtyContainer}>
                      <TouchableOpacity
                        onPress={() => updateCartItemQty(index, item.qty - 1)}
                        style={styles.qtyButton}
                      >
                        <Ionicons name="remove" size={16} color="white" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.qty}</Text>
                      <TouchableOpacity
                        onPress={() => updateCartItemQty(index, item.qty + 1)}
                        style={styles.qtyButton}
                      >
                        <Ionicons name="add" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <View style={styles.cartItemActions}>
                  <Text style={styles.cartItemPrice}>
                    Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                  </Text>
                  <TouchableOpacity onPress={() => removeFromCart(index)}>
                    <Ionicons name="trash" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            style={styles.cartList}
            ListEmptyComponent={
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyCartText}>Cart is empty</Text>
              </View>
            }
          />
        </View>

        {/* Total and Checkout */}
        <View style={styles.footer}>
          <View style={styles.totalContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>
                Rp {calculateTotal().subtotal.toLocaleString('id-ID')}
              </Text>
            </View>
            {isPkpActive && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>PPN ({ppnRate}%):</Text>
                <Text style={styles.totalValue}>
                  Rp {calculateTotal().ppn.toLocaleString('id-ID')}
                </Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>
                Rp {calculateTotal().total.toLocaleString('id-ID')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.checkoutButton, cart.length === 0 && styles.checkoutButtonDisabled]}
            onPress={handleCheckout}
            disabled={cart.length === 0}
          >
            <Text style={styles.checkoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>POS Kasir {orientation.isLandscape && orientation.isTablet && '(Tablet Mode)'}</Text>
        <TouchableOpacity onPress={() => setShowPrinterModal(true)} style={styles.printerButton}>
          <Ionicons name="print" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Conditionally render layout based on orientation */}
      {orientation.isLandscape && orientation.isTablet ? renderLandscapeLayout() : renderPortraitLayout()}

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
            >
              {/* Customer Selector */}
              <View style={styles.customerSelectorContainer}>
                <Text style={styles.inputLabel}>Customer</Text>
                <TouchableOpacity
                  style={styles.customerSelector}
                  onPress={() => setShowCustomerModal(true)}
                >
                  <Text style={styles.customerSelectorText}>
                    {selectedCustomer.nama}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Total Amount */}
              <View style={styles.paymentSummary}>
                <Text style={styles.paymentLabel}>Total Amount:</Text>
                <Text style={styles.paymentTotal}>
                  Rp {calculateTotal().total.toLocaleString('id-ID')}
                </Text>
              </View>

              {/* Bayar (Cash Received) with = button */}
              <View style={styles.bayarContainer}>
                <Text style={styles.inputLabel}>Bayar (Cash Received)</Text>
                <View style={styles.bayarInputRow}>
                  <TextInput
                    style={styles.bayarInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={bayar}
                    onChangeText={(val) => {
                      if (!isNaN(val as any) || val === '') {
                        setBayar(val);
                        const cash = parseFloat(val || '0');
                        const total = calculateTotal().total;
                        // Auto-sync terbayar and kembalian
                        setTerbayar(Math.min(cash, total).toString());
                        setKembalian(Math.max(cash - total, 0));
                      }
                    }}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.equalsButton}
                    onPress={() => {
                      const total = calculateTotal().total;
                      setBayar(total.toString());
                      setTerbayar(total.toString());
                      setKembalian(0);
                    }}
                  >
                    <Ionicons name="calculator" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terbayar (Settled Amount) and Kembalian (Change) */}
              <View style={styles.terbayarKembalianRow}>
                <View style={styles.terbayarContainer}>
                  <Text style={styles.inputLabel}>Terbayar (Settled)</Text>
                  <TextInput
                    style={styles.terbayarInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={terbayar}
                    onChangeText={(val) => {
                      if (!isNaN(val as any) || val === '') {
                        const total = calculateTotal().total;
                        let settled = parseFloat(val || '0');
                        if (settled > total) settled = total; // cap to total
                        setTerbayar(settled.toString());
                      }
                    }}
                  />
                </View>
                <View style={styles.kembalianContainer}>
                  <Text style={styles.inputLabel}>Kembalian</Text>
                  <Text style={styles.kembalianValue}>
                    Rp {kembalian.toLocaleString('id-ID')}
                  </Text>
                </View>
              </View>

              {/* Sisa (Remaining/Piutang) */}
              <View style={styles.sisaContainer}>
                <Text style={styles.sisaLabel}>Sisa (Piutang):</Text>
                <Text style={[
                  styles.sisaValue,
                  (calculateTotal().total - parseFloat(terbayar || '0')) > 0 && styles.sisaValueWarning
                ]}>
                  Rp {(calculateTotal().total - parseFloat(terbayar || '0')).toLocaleString('id-ID')}
                </Text>
              </View>

              {/* Notes */}
              <TextInput
                style={styles.keteranganInput}
                placeholder="Notes (optional)"
                value={keterangan}
                onChangeText={setKeterangan}
                multiline
                numberOfLines={3}
              />

              {/* Payment Method (Bagan Akun) Selector */}
              {parseFloat(terbayar || '0') > 0 && (
                <View style={styles.baganAkunContainer}>
                  <Text style={styles.baganAkunLabel}>Payment Method *</Text>
                  <TouchableOpacity
                    style={styles.baganAkunSelector}
                    onPress={() => setShowBaganAkunModal(true)}
                  >
                    <Text style={selectedBaganAkun ? styles.baganAkunText : styles.baganAkunPlaceholder}>
                      {selectedBaganAkun ? `${selectedBaganAkun.kode} - ${selectedBaganAkun.nama}` : 'Select Payment Method'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Info: Piutang BA Code */}
              {(calculateTotal().total - parseFloat(terbayar || '0')) > 0 && (
                <View style={styles.piutangInfo}>
                  <Ionicons name="information-circle" size={20} color="#f59e0b" />
                  <Text style={styles.piutangInfoText}>
                    Kode BA Piutang pada Customer: 113
                  </Text>
                </View>
              )}

              {/* Process Payment Button */}
              <TouchableOpacity
                style={[
                  styles.payButton,
                  ((calculateTotal().total - parseFloat(terbayar || '0')) < 0 || saving || (parseFloat(terbayar || '0') > 0 && !selectedBaganAkun)) && styles.payButtonDisabled,
                ]}
                onPress={processPayment}
                disabled={(calculateTotal().total - parseFloat(terbayar || '0')) < 0 || saving || (parseFloat(terbayar || '0') > 0 && !selectedBaganAkun)}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.payButtonText}>Simpan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Customer Modal */}
      <Modal visible={showCustomerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={customers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.customerItem,
                    selectedCustomer.id === item.id && styles.customerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setShowCustomerModal(false);
                  }}
                >
                  <Text style={styles.customerName}>{item.nama}</Text>
                  {selectedCustomer.id === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
            />
          </View>
        </View>
      </Modal>

      {/* Printer Modal */}
      <Modal visible={showPrinterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Printer Settings</Text>
              <TouchableOpacity onPress={() => setShowPrinterModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
            >
              <View style={styles.printerSection}>
                <Text style={styles.sectionLabel}>Paper Size</Text>
                <View style={styles.paperSizeContainer}>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, paperSize === '58mm' && styles.paperSizeButtonActive]}
                    onPress={() => savePaperSizeSelection('58mm')}
                  >
                    <Text style={[styles.paperSizeText, paperSize === '58mm' && styles.paperSizeTextActive]}>
                      58mm
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, paperSize === '80mm' && styles.paperSizeButtonActive]}
                    onPress={() => savePaperSizeSelection('80mm')}
                  >
                    <Text style={[styles.paperSizeText, paperSize === '80mm' && styles.paperSizeTextActive]}>
                      80mm
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.printerSection}>
                <Text style={styles.sectionLabel}>Receipt Language</Text>
                <View style={styles.paperSizeContainer}>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, receiptLanguage === 'id' && styles.paperSizeButtonActive]}
                    onPress={() => saveLanguageSelection('id')}
                  >
                    <Text style={[styles.paperSizeText, receiptLanguage === 'id' && styles.paperSizeTextActive]}>
                      🇮🇩 Indonesia
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, receiptLanguage === 'en' && styles.paperSizeButtonActive]}
                    onPress={() => saveLanguageSelection('en')}
                  >
                    <Text style={[styles.paperSizeText, receiptLanguage === 'en' && styles.paperSizeTextActive]}>
                      🇬🇧 English
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.printerSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Available Printers</Text>
                  <TouchableOpacity
                    onPress={scanPrinters}
                    style={styles.scanButton}
                    disabled={scanningPrinters}
                  >
                    {scanningPrinters ? (
                      <ActivityIndicator size="small" color="#f59e0b" />
                    ) : (
                      <Ionicons name="refresh" size={20} color="#f59e0b" />
                    )}
                    <Text style={styles.scanButtonText}>
                      {scanningPrinters ? 'Scanning...' : 'Scan'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {scanningPrinters ? (
                  <View style={styles.scanningContainer}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                    <Text style={styles.scanningText}>Searching for Bluetooth devices...</Text>
                  </View>
                ) : printers.length === 0 ? (
                  <Text style={styles.noPrintersText}>No printers found. Tap Scan to search.</Text>
                ) : (
                  <FlatList
                    data={printers}
                    keyExtractor={(item) => item.address}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.printerItem,
                          selectedPrinter === item.address && styles.printerItemSelected,
                        ]}
                        onPress={() => savePrinterSelection(item.address)}
                      >
                        <View>
                          <Text style={styles.printerName}>{item.name}</Text>
                          <Text style={styles.printerAddress}>{item.address}</Text>
                        </View>
                        {selectedPrinter === item.address && (
                          <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                        )}
                      </TouchableOpacity>
                    )}
                    style={styles.printerList}
                    nestedScrollEnabled
                  />
                )}
              </View>

              {selectedPrinter && (
                <TouchableOpacity style={styles.testPrintButton} onPress={testPrint}>
                  <Ionicons name="print" size={20} color="white" />
                  <Text style={styles.testPrintText}>Test Print</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={showBarcodeScanner} transparent animationType="slide">
        <View style={styles.scannerModalOverlay}>
          <View style={styles.scannerContainer}>
            <View style={styles.scannerHeader}>
              <Text style={styles.scannerTitle}>Scan Barcode</Text>
              <TouchableOpacity onPress={() => setShowBarcodeScanner(false)}>
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
            </View>
            {hasPermission === null ? (
              <View style={styles.scannerPlaceholder}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.scannerPlaceholderText}>Requesting camera permission...</Text>
              </View>
            ) : hasPermission === false ? (
              <View style={styles.scannerPlaceholder}>
                <Ionicons name="camera" size={64} color="#EF4444" />
                <Text style={styles.scannerPlaceholderText}>No access to camera</Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
                  <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
              </View>
            ) : device == null ? (
              <View style={styles.scannerPlaceholder}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.scannerPlaceholderText}>Loading camera...</Text>
              </View>
            ) : (
              <Camera
                style={styles.camera}
                device={device}
                isActive={showBarcodeScanner}
                codeScanner={codeScanner}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerFrame} />
                  <Text style={styles.scannerInstructions}>
                    Position barcode within the frame
                  </Text>
                </View>
              </Camera>
            )}
          </View>
        </View>
      </Modal>

      {/* Manual Item Modal */}
      <Modal visible={showManualItemModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Manual Item</Text>
              <TouchableOpacity onPress={() => {
                setShowManualItemModal(false);
                setManualItemName('');
                setManualItemPrice('');
                setManualItemQty('1');
              }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
            >
              <View style={styles.manualItemForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Item Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter item name"
                    value={manualItemName}
                    onChangeText={setManualItemName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Price (Rp) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter price"
                    value={manualItemPrice}
                    onChangeText={setManualItemPrice}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter quantity"
                    value={manualItemQty}
                    onChangeText={setManualItemQty}
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  style={styles.addManualItemButton}
                  onPress={addManualItemToCart}
                >
                  <Ionicons name="add-circle" size={20} color="white" />
                  <Text style={styles.addManualItemButtonText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bagan Akun (Payment Method) Modal */}
      <Modal visible={showBaganAkunModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Method</Text>
              <TouchableOpacity onPress={() => setShowBaganAkunModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search payment method..."
                value={baganAkunSearch}
                onChangeText={setBaganAkunSearch}
                autoCapitalize="none"
              />
              <FlatList
                data={baganAkunList.filter(item =>
                  item.nama.toLowerCase().includes(baganAkunSearch.toLowerCase()) ||
                  item.kode.toLowerCase().includes(baganAkunSearch.toLowerCase())
                )}
                keyExtractor={(item) => item.kode}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.baganAkunItem,
                      selectedBaganAkun?.kode === item.kode && styles.baganAkunItemSelected,
                    ]}
                    onPress={() => {
                      saveBaganAkunSelection(item);
                      setShowBaganAkunModal(false);
                      setBaganAkunSearch('');
                    }}
                  >
                    <View>
                      <Text style={styles.baganAkunItemCode}>{item.kode}</Text>
                      <Text style={styles.baganAkunItemName}>{item.nama}</Text>
                    </View>
                    {selectedBaganAkun?.kode === item.kode && (
                      <Ionicons name="checkmark-circle" size={24} color="#f59e0b" />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyBaganAkun}>
                    <Ionicons name="wallet-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyBaganAkunText}>No payment methods found</Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  printerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  productListContainer: {
    maxHeight: 200,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  productList: {
    maxHeight: 200,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  productSku: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  productStock: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  cartContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
  },
  cartList: {
    flex: 1,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  manualBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  bundlingBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bundlingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  cartItemSku: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  wholesaleTag: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
    fontWeight: '600',
  },
  cartItemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    padding: 4,
  },
  qtyText: {
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  cartItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 8,
  },
  priceEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceEditLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceEditInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    minWidth: 80,
    textAlign: 'right',
  },
  priceQtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  priceQtyMultiplier: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 4,
    fontWeight: '600',
  },
  priceEditMultiplier: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCartText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalContainer: {
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  checkoutButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalBody: {
    padding: 16,
  },
  // Payment modal styles
  customerSelectorContainer: {
    marginBottom: 16,
  },
  customerSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  customerSelectorText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  paymentSummary: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 4,
  },
  paymentTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  bayarContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  bayarInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bayarInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    fontSize: 18,
  },
  equalsButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  terbayarKembalianRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  terbayarContainer: {
    flex: 1,
  },
  terbayarInput: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  kembalianContainer: {
    flex: 1,
  },
  kembalianValue: {
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  sisaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sisaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  sisaValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
  },
  sisaValueWarning: {
    color: '#DC2626',
  },
  keteranganInput: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  piutangInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  piutangInfoText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  payButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  // Customer modal styles
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  customerItemSelected: {
    backgroundColor: '#FEF3C7',
  },
  customerName: {
    fontSize: 16,
    color: '#111827',
  },
  // Printer modal styles
  printerSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  paperSizeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paperSizeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  paperSizeButtonActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  paperSizeText: {
    fontSize: 16,
    color: '#6B7280',
  },
  paperSizeTextActive: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanButtonText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
  },
  noPrintersText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  scanningContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  scanningText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  printerList: {
    maxHeight: 200,
  },
  printerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  printerItemSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  printerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  printerAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  testPrintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  testPrintText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  barcodeButton: {
    padding: 8,
    marginLeft: 8,
  },
  scannerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  scannerContainer: {
    flex: 1,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerInstructions: {
    marginTop: 20,
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 8,
  },
  scannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scannerPlaceholderText: {
    fontSize: 16,
    color: 'white',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  baganAkunContainer: {
    marginBottom: 16,
  },
  baganAkunLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  baganAkunSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  baganAkunText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  baganAkunPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
  },
  baganAkunItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  baganAkunItemSelected: {
    backgroundColor: '#FEF3C7',
  },
  baganAkunItemCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  baganAkunItemName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  emptyBaganAkun: {
    padding: 40,
    alignItems: 'center',
  },
  emptyBaganAkunText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  // Manual item form styles
  manualItemForm: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addManualItemButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  addManualItemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // Landscape-specific styles
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
  },
  landscapeLeftPanel: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingRight: 8,
  },
  landscapeRightPanel: {
    width: 480,
    backgroundColor: '#F3F4F6',
    paddingLeft: 8,
  },
  landscapeSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  landscapeProductListContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  landscapeProductItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 120,
  },
  landscapeProductInfo: {
    flex: 1,
    marginRight: 16,
  },
  landscapeProductHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  landscapeProductName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  landscapeProductDetails: {
    gap: 4,
  },
  landscapeProductDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  landscapeProductLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    width: 80,
  },
  landscapeProductValue: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
  },
  landscapeProductPriceContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 140,
  },
  landscapeProductPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  landscapeProductCost: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  landscapeEmptyProducts: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  landscapeEmptyProductsText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
    textAlign: 'center',
  },
  landscapeCustomerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  landscapeCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  landscapeCustomerTextContainer: {
    gap: 2,
  },
  landscapeCustomerLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  landscapeCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  landscapeCartContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  landscapeCartHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  landscapeCartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  landscapeCartItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  landscapeCartItemMain: {
    marginBottom: 12,
  },
  landscapeCartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  landscapeCartItemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  landscapeCartItemBadges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  wholesaleBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  wholesaleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
  },
  landscapeCartItemSku: {
    fontSize: 12,
    color: '#6B7280',
  },
  landscapeCartItemControls: {
    gap: 8,
  },
  landscapePriceQtyRow: {
    flexDirection: 'row',
    gap: 16,
  },
  landscapePriceEdit: {
    flex: 1,
  },
  landscapePriceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  landscapePriceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  landscapePricePrefix: {
    fontSize: 14,
    color: '#6B7280',
  },
  landscapePriceInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  landscapeQtyControl: {
    width: 140,
  },
  landscapeQtyLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  landscapeQtyButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  landscapeQtyButton: {
    backgroundColor: '#f59e0b',
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeQtyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    minWidth: 32,
    textAlign: 'center',
  },
  landscapeSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  landscapeSubtotalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  landscapeSubtotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  landscapeEmptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  landscapeEmptyCartText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  landscapeFooter: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    padding: 16,
    elevation: 2,
  },
  landscapeTotalContainer: {
    marginBottom: 16,
  },
  landscapeTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  landscapeTotalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  landscapeTotalValue: {
    fontSize: 14,
    color: '#111827',
  },
  landscapeGrandTotalRow: {
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  landscapeGrandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  landscapeGrandTotalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  landscapeCheckoutButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    elevation: 2,
  },
  landscapeCheckoutButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  landscapeCheckoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default POSKasirScreen;

