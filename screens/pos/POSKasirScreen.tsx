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
import {
  BluetoothDevice,
  ReceiptData,
  BluetoothPrinterServiceFactory,
  BleLibraryType,
  PrinterLibraryType,
  LANPrinter,
  LANPrinterDiscovery,
  LANPrinterService,
  ProtocolType,
  PrintScenario,
  PrintOptions,
} from '../../services/BluetoothPrinterService';
import LANPrinterSettings from '../../components/LANPrinterSettings';
import { useAuth } from '../../context/AuthContext';
import { useOrientation } from '../../hooks/useOrientation';

interface BundlingDetail {
  id: number;
  id_masterbarang: number;
  qty_required: number;
  nama: string;
  sku: string;
  satuan?: string;
  merk?: string;
}

interface BundlingVariant {
  id: number;
  nama: string;
  sku: string;
  hargajual: number;
  stok: number;
  satuan?: string;
  items: BundlingDetail[];
}

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
  bundling_variants?: BundlingVariant[]; // Bundling variants that contain this masterbarang
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

interface Employee {
  id: number;
  nama: string;
  pin_hash?: string | null;
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
  const [scannerMode, setScannerMode] = useState<'camera' | 'external'>('camera'); // Scanner mode toggle
  const [externalScannerInput, setExternalScannerInput] = useState('');
  const externalScannerRef = useRef<TextInput>(null);
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
  const [bleLibrary, setBleLibrary] = useState<BleLibraryType>('bt-classic');
  const [printerType, setPrinterType] = useState<'bluetooth' | 'lan'>('bluetooth');
  const [selectedLANPrinter, setSelectedLANPrinter] = useState<LANPrinter | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  /**
   * Active print scenario (1–6).
   * Persisted in AsyncStorage under 'pos_print_scenario'.
   * - '1' = BT Classic (default SPP, most printers)
   * - '2' = BLE + Write With Response (ACK per chunk)
   * - '3' = BLE + Write Without Response (fast, no ACK)
   * - '4' = BLE + All UUID Scan (non-standard UUID)
   * - '5' = BLE + No MTU (older printers)
   * - '6' = BT Classic + No Paper Cut (cut-command disabled)
   */
  const [printScenario, setPrintScenario] = useState<PrintScenario>('1');
  const [showScenarioDropdown, setShowScenarioDropdown] = useState(false);
  const [isPkpActive, setIsPkpActive] = useState(false);
  const [ppnRate, setPpnRate] = useState(11);
  const [saving, setSaving] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Manual item states
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [manualItemQty, setManualItemQty] = useState('1');

  // Reset/New Sale confirmation modal
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Variant selection modal
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0); // 0 = masterbarang, 1+ = bundling variants
  const [variantQty, setVariantQty] = useState<number>(1);

  // Store settings
  const [storeSettings, setStoreSettings] = useState({
    name: 'PlexSeller',
    address: '',
    motto: '',
    phone: '',
  });

  // Employee authentication states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinEmployee, setPinEmployee] = useState<Employee | null>(null);
  const [pinError, setPinError] = useState('');

  // Product view mode state (grid/list)
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadCustomers();
    loadEmployees();
    loadSettings();
    loadBaganAkun();
    requestCameraPermission();
    loadSavedBaganAkun();
    loadSavedPrinter();
    loadSavedScenario();
    loadSavedViewMode();
    // Focus on search input when screen loads
    setTimeout(() => searchInputRef.current?.focus(), 300);
  }, []);

  // Auto-focus external scanner input when modal opens in external mode
  useEffect(() => {
    if (showBarcodeScanner && scannerMode === 'external') {
      setTimeout(() => externalScannerRef.current?.focus(), 200);
    }
  }, [showBarcodeScanner, scannerMode]);

  // Debounced search effect - wait 600ms after user stops typing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchProducts(searchQuery);
      } else {
        setProducts([]);
        setShowProductList(false);
      }
    }, 600); // 600ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

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
      const savedPrinterType = await AsyncStorage.getItem('printer_type');
      const savedPrinterAddress = await AsyncStorage.getItem('pos_selected_printer');
      const savedLANPrinter = await AsyncStorage.getItem('selected_lan_printer');
      const savedPaperSize = await AsyncStorage.getItem('pos_paper_size');
      const savedLanguage = await AsyncStorage.getItem('pos_receipt_language');

      if (savedPrinterType) {
        setPrinterType(savedPrinterType as 'bluetooth' | 'lan');
        console.log('🖨️ [PRINTER] Loaded printer type:', savedPrinterType);
      }

      if (savedPrinterType === 'lan' && savedLANPrinter) {
        const lanPrinter = JSON.parse(savedLANPrinter);
        setSelectedLANPrinter(lanPrinter);
        console.log('🖨️ [PRINTER] Loaded LAN printer:', lanPrinter);
      } else if (savedPrinterAddress) {
        setSelectedPrinter(savedPrinterAddress);
        console.log('🖨️ [PRINTER] Loaded Bluetooth printer:', savedPrinterAddress);
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

  const saveBleLibrarySelection = async (library: BleLibraryType) => {
    try {
      await AsyncStorage.setItem('pos_ble_library', library);
      setBleLibrary(library);

      // Switch the library
      await BluetoothPrinterServiceFactory.switchLibrary(library);
      console.log('📡 [PRINTER] Switched BLE library to:', library);

      // Clear printer selection and list since we switched libraries
      setPrinters([]);
      setSelectedPrinter('');
      await AsyncStorage.removeItem('pos_selected_printer');

      Alert.alert(
        'Library Switched',
        `Now using ${library === 'bt-classic' ? 'Bluetooth Classic (Recommended)' : 'BLE PLX (Legacy)'}. Please scan for printers again.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error switching BLE library:', error);
      Alert.alert('Error', 'Failed to switch BLE library');
    }
  };

  /** Load saved print scenario from AsyncStorage */
  const loadSavedScenario = async () => {
    try {
      const saved = await AsyncStorage.getItem('pos_print_scenario');
      if (saved && ['1','2','3','4','5','6'].includes(saved)) {
        const scenario = saved as PrintScenario;
        setPrintScenario(scenario);
        // Auto-switch library to match saved scenario
        const libForScenario = scenario === '1' || scenario === '6' ? 'bt-classic' : 'ble-plx';
        setBleLibrary(libForScenario);
        await BluetoothPrinterServiceFactory.switchLibrary(libForScenario);
        console.log(`🎯 [PRINTER] Loaded print scenario: Opsi ${scenario}`);
      }
    } catch (error) {
      console.error('Error loading saved scenario:', error);
    }
  };

  /** Save chosen scenario to AsyncStorage and update library accordingly */
  const saveScenarioSelection = async (scenario: PrintScenario) => {
    try {
      await AsyncStorage.setItem('pos_print_scenario', scenario);
      setPrintScenario(scenario);
      setShowScenarioDropdown(false);

      // Scenario 1 & 6 use BT Classic, the rest use BLE PLX
      const newLib: BleLibraryType = (scenario === '1' || scenario === '6') ? 'bt-classic' : 'ble-plx';
      if (newLib !== bleLibrary) {
        setBleLibrary(newLib);
        await BluetoothPrinterServiceFactory.switchLibrary(newLib);
        // Clear stale printer list
        setPrinters([]);
        setSelectedPrinter('');
        await AsyncStorage.removeItem('pos_selected_printer');
      }
      await AsyncStorage.setItem('pos_ble_library', newLib);
      console.log(`🎯 [PRINTER] Scenario set to Opsi ${scenario} (library: ${newLib})`);
    } catch (error) {
      console.error('Error saving scenario:', error);
    }
  };

  /**
   * Build PrintOptions from the currently active scenario.
   * Classic scenarios return classic options; BLE scenarios return ble options.
   */
  const buildPrintOptions = (): PrintOptions => {
    switch (printScenario) {
      case '2': return { ble: { forceWriteWithResponse: true } };
      case '3': return { ble: { forceWriteWithoutResponse: true } };
      case '4': return { ble: { scanAllUUIDs: true } };
      case '5': return { ble: { skipMTU: true } };
      case '6': return { classic: { noCut: true } };
      default:  return {}; // Opsi 1: BT Classic default, no extra options
    }
  };

  /** Human-readable label for each scenario (for dropdown display) */
  const SCENARIO_OPTIONS: { value: PrintScenario; label: string; description: string }[] = [
    {
      value: '1',
      label: 'Opsi 1 — BT Classic (Default)',
      description: 'Bluetooth Classic (SPP). Cocok untuk mayoritas thermal printer. Coba ini terlebih dahulu.',
    },
    {
      value: '2',
      label: 'Opsi 2 — BLE + Write With Response',
      description: 'BLE dengan konfirmasi (ACK) per data chunk. Cocok bila Opsi 1 tidak merespons sama sekali.',
    },
    {
      value: '3',
      label: 'Opsi 3 — BLE + Write Without Response',
      description: 'BLE tanpa konfirmasi, lebih cepat. Cocok untuk printer BLE (HM-10 module) seperti beberapa merk China.',
    },
    {
      value: '4',
      label: 'Opsi 4 — BLE + Scan Semua UUID',
      description: 'BLE dengan scan semua karakteristik. Coba bila UUID printer non-standar dan Opsi 2/3 gagal.',
    },
    {
      value: '5',
      label: 'Opsi 5 — BLE + Tanpa MTU Negotiation',
      description: 'BLE tanpa negosiasi ukuran MTU. Coba bila printer disconnect/hang saat mengirim data.',
    },
    {
      value: '6',
      label: 'Opsi 6 — BT Classic + Tanpa Paper Cut',
      description: 'BT Classic tanpa perintah potong kertas. Coba bila print berjalan tapi printer hang atau tidak ada output.',
    },
  ];

  const loadSavedViewMode = async () => {
    try {
      const savedViewMode = await AsyncStorage.getItem('pos_product_view_mode');
      if (savedViewMode === 'grid' || savedViewMode === 'list') {
        setProductViewMode(savedViewMode);
        console.log('📋 [POS] Loaded product view mode:', savedViewMode);
      }
    } catch (error) {
      console.error('Error loading saved view mode:', error);
    }
  };

  const saveViewModeSelection = async (mode: 'grid' | 'list') => {
    try {
      await AsyncStorage.setItem('pos_product_view_mode', mode);
      setProductViewMode(mode);
      console.log('📋 [POS] Saved product view mode:', mode);
    } catch (error) {
      console.error('Error saving view mode:', error);
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

      // Load BLE library preference
      const savedBleLibrary = await AsyncStorage.getItem('pos_ble_library');
      if (savedBleLibrary === 'ble-plx' || savedBleLibrary === 'bt-classic') {
        setBleLibrary(savedBleLibrary);
        await BluetoothPrinterServiceFactory.switchLibrary(savedBleLibrary);
        console.log('📡 [SETTINGS] BLE library loaded:', savedBleLibrary);
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

  const loadEmployees = async () => {
    try {
      const token = await getTokenAuth();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      console.log('Loading employees from:', `${API_BASE_URL}/get/karyawan`);
      const response = await fetch(`${API_BASE_URL}/get/karyawan`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      console.log('Employee data received:', data);

      if (data.status) {
        const employeeList = data.data || [];
        console.log('Setting employees:', employeeList.length, 'employees');
        setEmployees(employeeList);
      } else {
        console.error('Failed to load employees:', data.reason);
        setEmployees([]); // Set empty array on failure
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      setEmployees([]); // Set empty array on error
      Alert.alert('Error', 'Failed to load employees. Please check your connection.');
    }
  };

  const handleEmployeeSelect = (employee: Employee) => {
    // If employee has a PIN, require authentication
    if (employee.pin_hash) {
      setPinEmployee(employee);
      setShowEmployeeModal(false);
      setShowPinModal(true);
      setPinInput('');
      setPinError('');
    } else {
      // If no PIN, select employee directly without authentication
      setSelectedEmployee(employee);
      setShowEmployeeModal(false);
      console.log('Employee selected without PIN:', employee.nama);
    }
  };

  const validatePin = async () => {
    if (!pinEmployee) return;

    if (pinInput.length !== 6) {
      setPinError('PIN must be 6 digits');
      return;
    }

    try {
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/karyawan/pin/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id_karyawan: pinEmployee.id,
          pin: pinInput
        })
      });

      const data = await response.json();

      if (data.status) {
        // PIN validated successfully
        setSelectedEmployee(pinEmployee);
        setShowPinModal(false);
        setPinInput('');
        setPinError('');
        Alert.alert('Success', `Welcome, ${pinEmployee.nama}!`);
      } else {
        setPinError(data.reason || 'Invalid PIN');
        setPinInput('');
      }
    } catch (error) {
      console.error('Error validating PIN:', error);
      Alert.alert('Error', 'Failed to validate PIN');
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

      // Strategy: Search both masterbarang and bundling, then group bundling by masterbarang

      // PART 1: Search masterbarang (existing logic)
      // Use the proper /get/masterbarang/search endpoint with OR logic
      const qs = new URLSearchParams({
        nama: query,
        sku: query,
        merk: query,
        kategori: query,
        start: '0',
        end: '50', // Increase limit to capture all variants
        jumlah_online: '2147483647',
        search_mode: 'or'
      });

      console.log('🔍 [POS] Searching products and bundling...');

      const response = await fetch(`${API_BASE_URL}/get/masterbarang/search?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      const barangProducts: Product[] = [];
      const seenIds = new Set<number>();

      if (data.status && data.data) {
        data.data.forEach((product: Product) => {
          if (!seenIds.has(product.id)) {
            barangProducts.push({ ...product, is_bundling: false, bundling_variants: [] });
            seenIds.add(product.id);
          }
        });
      }

      // PART 2: Search bundling with search parameter
      const bundlingParams = new URLSearchParams();
      bundlingParams.set('search', query);
      bundlingParams.set('page', '1');
      bundlingParams.set('pageSize', '50');

      const bundlingResponse = await fetch(`${API_BASE_URL}/get/bundling?${bundlingParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const bundlingData = await bundlingResponse.json();

      if (bundlingData.status && bundlingData.data) {
        // PART 3: Fetch detail for each bundling to get masterbarang composition
        let bundlingDetails: BundlingVariant[] = [];
        const bundlingIds = bundlingData.data.map((b: any) => b.id);
        
        if (bundlingIds.length > 0) {
          try {
            // Fetch all detailbundling in one request using 'or' condition
            const CHUNK_SIZE = 30; // Chunk to prevent URL too long
            let allDetailBundlings: any[] = [];
            
            for (let i = 0; i < bundlingIds.length; i += CHUNK_SIZE) {
              const chunkIds = bundlingIds.slice(i, i + CHUNK_SIZE);
              const detailFormat = chunkIds.map((id: number) => `id_bundling:equal:${id}`).join(',');
              const detailRes = await fetch(`${API_BASE_URL}/get/detailbundling/condition/or/${detailFormat}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const detailJson = await detailRes.json();
              if (detailJson.status && detailJson.data) {
                allDetailBundlings = [...allDetailBundlings, ...detailJson.data];
              }
            }

            // Extract all masterbarang ids
            const mbIds = [...new Set(allDetailBundlings.map((d: any) => d.id_masterbarang))].filter(Boolean);
            
            let allMasterBarangs: any[] = [];
            if (mbIds.length > 0) {
              // Fetch all masterbarang in one request
              for (let i = 0; i < mbIds.length; i += CHUNK_SIZE) {
                const chunkIds = mbIds.slice(i, i + CHUNK_SIZE);
                const mbFormat = chunkIds.map((id: any) => `id:equal:${id}`).join(',');
                const mbRes = await fetch(`${API_BASE_URL}/get/masterbarang/condition/or/${mbFormat}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const mbJson = await mbRes.json();
                if (mbJson.status && mbJson.data) {
                  allMasterBarangs = [...allMasterBarangs, ...mbJson.data];
                }
              }
            }
            
            // Reconstruct the bundlingDetails objects
            bundlingDetails = bundlingData.data.map((bundling: any) => {
              const details = allDetailBundlings.filter((d: any) => d.id_bundling === bundling.id);
              const items = details.map((d: any) => {
                const mb = allMasterBarangs.find(m => m.id === d.id_masterbarang);
                return {
                  id: d.id,
                  id_masterbarang: d.id_masterbarang,
                  qty_required: d.qty_required,
                  berat: mb?.berat || 0,
                  hargajual: mb?.hargajual2 || "0",
                  stok: mb?.stok || 0,
                  nama: mb?.nama || "",
                  sku: mb?.sku || "",
                  hpp: mb?.hpp || 0,
                  satuan: mb?.satuan || "",
                  merk: mb?.merk || ""
                };
              });
              
              // Calculate stock based on minimum available components
              let stok = Infinity;
              if (items.length === 0) {
                stok = 0;
              } else {
                stok = items.reduce((minStok: number, item: any) => {
                  const maxPossible = Math.floor(Number(item.stok || 0) / Number(item.qty_required || 1));
                  return maxPossible < minStok ? maxPossible : minStok;
                }, Infinity);
              }
              
              return {
                id: bundling.id,
                nama: bundling.nama,
                sku: bundling.sku,
                hargajual: bundling.hargajual || 0,
                stok: stok === Infinity ? 0 : stok,
                satuan: bundling.satuan || undefined,
                items: items
              };
            });
          } catch (error) {
            console.error(`Error fetching bulk bundling details:`, error);
          }
        }

        // PART 4: Group bundling by masterbarang
        // Create a map of id_masterbarang -> bundling variants
        const masterbarangToBundling = new Map<number, BundlingVariant[]>();

        bundlingDetails.forEach(bundling => {
          bundling.items.forEach(item => {
            if (!masterbarangToBundling.has(item.id_masterbarang)) {
              masterbarangToBundling.set(item.id_masterbarang, []);
            }
            masterbarangToBundling.get(item.id_masterbarang)!.push(bundling);
          });
        });

        // PART 5: Attach bundling variants to masterbarang products
        barangProducts.forEach(product => {
          const variants = masterbarangToBundling.get(product.id);
          if (variants && variants.length > 0) {
            product.bundling_variants = variants;
          }
        });

        // PART 6: Add standalone bundling (bundling that don't match any masterbarang in search results)
        const bundlingOnlyProducts: Product[] = [];
        bundlingDetails.forEach(bundling => {
          // Check if this bundling is already attached to a masterbarang
          const isAttached = barangProducts.some(p =>
            p.bundling_variants?.some(v => v.id === bundling.id)
          );

          if (!isAttached) {
            // Add as standalone bundling product
            bundlingOnlyProducts.push({
              id: bundling.id,
              nama: bundling.nama,
              sku: bundling.sku,
              hargajual: bundling.hargajual,
              hargabeli: 0,
              stok: bundling.stok,
              satuan: bundling.satuan || 'set',
              is_bundling: true,
              bundling_variants: []
            });
          }
        });

        console.log(`🔍 [POS] Found ${barangProducts.length} masterbarang, ${bundlingDetails.length} bundling items`);
        console.log(`🔍 [POS] ${barangProducts.filter(p => p.bundling_variants && p.bundling_variants.length > 0).length} masterbarang have bundling variants`);
        console.log(`🔍 [POS] ${bundlingOnlyProducts.length} standalone bundling items`);

        // Merge all results
        const allProducts = [...barangProducts, ...bundlingOnlyProducts];
        setProducts(allProducts);
        setShowProductList(allProducts.length > 0);
      } else {
        // No bundling found, just show masterbarang
        setProducts(barangProducts);
        setShowProductList(barangProducts.length > 0);
      }

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

  // Handle external scanner input (for physical barcode scanners)
  const handleExternalScannerSubmit = () => {
    const code = externalScannerInput.trim();
    if (!code) return;

    // Process the barcode
    scanBarcode(code);

    // Clear input and refocus for next scan
    setExternalScannerInput('');
    setTimeout(() => externalScannerRef.current?.focus(), 50);
  };

  const addToCart = (product: Product) => {
    // Check if product has bundling variants
    if (product.bundling_variants && product.bundling_variants.length > 0 && !product.is_bundling) {
      // Show variant selection modal
      setSelectedProductForVariant(product);
      setSelectedVariantIndex(0); // Default to masterbarang
      setVariantQty(1);
      setShowVariantModal(true);
      return;
    }

    // Direct add to cart (no variants)
    addToCartDirect(product, 1);
  };

  const addToCartDirect = (product: Product, qty: number) => {
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
      const newQty = newCart[existingIndex].qty + qty;

      // Check wholesale pricing (only for regular products, not bundling)
      const isWholesale = !isBundling && product.harga_grosir && product.qty_grosir && newQty >= product.qty_grosir;
      const price = isWholesale ? (product.harga_grosir || 0) : (product.hargajual || 0);

      newCart[existingIndex].qty = newQty;
      newCart[existingIndex].subtotal = price * newQty;
      newCart[existingIndex].is_wholesale = !!isWholesale;

      setCart(newCart);
    } else {
      // Add new item
      const isWholesale = !isBundling && product.harga_grosir && product.qty_grosir && qty >= product.qty_grosir;
      const price = isWholesale ? (product.harga_grosir || 0) : (product.hargajual || 0);

      const newItem: CartItem = {
        ...product,
        qty,
        subtotal: price * qty,
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
    // setSearchQuery('');
    // setProducts([]);
    // setShowProductList(false);
    searchInputRef.current?.focus();
  };

  const handleVariantSelection = () => {
    if (!selectedProductForVariant) return;

    let productToAdd: Product;

    if (selectedVariantIndex === 0) {
      // Add masterbarang
      productToAdd = selectedProductForVariant;
    } else {
      // Add bundling variant
      const variant = selectedProductForVariant.bundling_variants![selectedVariantIndex - 1];
      productToAdd = {
        id: variant.id,
        nama: variant.nama,
        sku: variant.sku,
        hargajual: variant.hargajual,
        hargabeli: 0,
        stok: variant.stok,
        satuan: variant.satuan || 'set',
        is_bundling: true,
      };
    }

    addToCartDirect(productToAdd, variantQty);

    // Close modal and reset
    setShowVariantModal(false);
    setSelectedProductForVariant(null);
    setSelectedVariantIndex(0);
    setVariantQty(1);
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
    const bayarAmount = parseFloat(bayar || '0'); // Actual cash received from customer
    const sisa = total - terbayarAmount;

    // Employee selection is now optional - no validation required
    // If no employee is selected, id_karyawan will be null in the transaction

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
              id_karyawan: selectedEmployee?.id || null, // ✅ Add employee ID for accountability
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
                  await printReceipt(data.id, bayarAmount);
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
                printReceipt(data.id, bayarAmount);
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
    setSearchQuery('');
    setProducts([]);
    setShowProductList(false);
    searchInputRef.current?.focus();
  };

  const handleResetConfirm = () => {
    setShowResetConfirmModal(false);
    resetTransaction();
  };

  const printReceipt = async (invoiceId: number, payment: number) => {
    console.log('🖨️ [POS] Starting print receipt process...');

    // Check if any printer is selected
    if (printerType === 'bluetooth' && !selectedPrinter) {
      console.log('⚠️ [POS] No Bluetooth printer selected');
      Alert.alert('No Printer', 'Please select a Bluetooth printer first', [
        { text: 'Select Printer', onPress: () => setShowPrinterModal(true) },
        { text: 'Skip', style: 'cancel' },
      ]);
      return;
    }

    if (printerType === 'lan' && !selectedLANPrinter) {
      console.log('⚠️ [POS] No LAN printer selected');
      Alert.alert('No Printer', 'Please select a LAN printer first', [
        { text: 'Select Printer', onPress: () => setShowPrinterModal(true) },
        { text: 'Skip', style: 'cancel' },
      ]);
      return;
    }

    try {
      // Switch to appropriate printer service
      if (printerType === 'lan') {
        await BluetoothPrinterServiceFactory.switchLibrary('lan');
      } else {
        await BluetoothPrinterServiceFactory.switchLibrary(bleLibrary);
      }

      const service = BluetoothPrinterServiceFactory.getInstance();

      // Connect to printer
      const printerAddress = printerType === 'lan'
        ? `${selectedLANPrinter!.ip}:${selectedLANPrinter!.port}`
        : selectedPrinter;

      console.log(`🔗 [POS] Connecting to ${printerType} printer:`, printerAddress);
      const connected = await service.connect(printerAddress);

      if (!connected) {
        console.error('❌ [POS] Failed to connect to printer');
        Alert.alert(
          'Connection Error',
          printerType === 'lan'
            ? 'Failed to connect to LAN printer. Please check the IP address and network connection.'
            : 'Failed to connect to Bluetooth printer. Please make sure the printer is turned on and in range.'
        );
        return;
      }

      console.log('✅ [POS] Connected to printer, preparing receipt data...');
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
          satuan: item.satuan || undefined,
        })),
        subtotal,
        tax: isPkpActive ? ppn : undefined,
        ppn: isPkpActive ? ppn : undefined,
        ppnRate: isPkpActive ? ppnRate : undefined,
        total,
        payment, // Actual cash received from customer (bayar)
        change: Math.max(payment - total, 0), // Kembalian = bayar - total (0 if no change)
        paperSize,
        language: receiptLanguage,
      };

      console.log('🖨️ [POS] Sending receipt to printer...');
      const printOpts = buildPrintOptions();
      console.log(`🎯 [POS] Using print scenario Opsi ${printScenario}`, printOpts);
      const printed = await service.printReceipt(receiptData, printOpts);

      if (printed) {
        console.log('✅ [POS] Receipt printed successfully');
        Alert.alert('Success', 'Receipt printed successfully');
        resetTransaction();
      } else {
        console.error('❌ [POS] Print failed (returned false)');
        Alert.alert('Print Failed', 'The printer did not respond correctly. Please check the printer and try again.');
      }
    } catch (error: any) {
      console.error('❌ [POS] Print error:', error);

      // Extract meaningful error message
      const errorMessage = error?.message || String(error);
      console.error('❌ [POS] Error message:', errorMessage);

      // Show user-friendly error message
      Alert.alert(
        'Print Error',
        `Failed to print receipt: ${errorMessage}\n\nPlease check your printer connection and try again.`
      );
    } finally {
      console.log('🏁 [POS] Print receipt process completed');
    }
  };

  const scanPrinters = async () => {
    try {
      setScanningPrinters(true);
      console.log('🔍 [BLUETOOTH] Starting printer scan...');

      // Get service instance from factory
      const service = BluetoothPrinterServiceFactory.getInstance();

      // Initialize service (handles permissions internally)
      console.log('🔧 [BLUETOOTH] Initializing service...');
      await service.initialize();

      console.log('🔍 [BLUETOOTH] Scanning for devices...');
      const devices = await service.scanDevices();
      console.log('🔍 [BLUETOOTH] Found devices:', devices.length, devices);

      setPrinters(devices);

      if (devices.length === 0) {
        Alert.alert(
          'No Devices Found',
          'No Bluetooth printers found. Make sure your printer is turned on and in pairing mode.\n\nTroubleshooting:\n• Turn on your printer\n• Enable Bluetooth\n• Grant all permissions\n• Try restarting Bluetooth'
        );
      } else {
        Alert.alert('Success', `Found ${devices.length} Bluetooth device(s)`);
      }
    } catch (error: any) {
      console.error('❌ [BLUETOOTH] Scan error:', error);

      // Extract error message
      const errorMessage = error?.message || String(error);

      // Provide helpful error messages based on error type
      if (errorMessage.includes('permission')) {
        Alert.alert(
          'Permissions Required',
          'Bluetooth permissions are required to scan for printers.\n\nPlease:\n1. Go to Settings\n2. Find this app\n3. Grant Bluetooth and Location permissions\n4. Try again',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                // On Android, you can open app settings
                if (Platform.OS === 'android') {
                  const { Linking } = require('react-native');
                  Linking.openSettings();
                }
              }
            }
          ]
        );
      } else if (errorMessage.includes('enabled') || errorMessage.includes('PoweredOff')) {
        Alert.alert(
          'Bluetooth Not Enabled',
          'Please turn on Bluetooth in your device settings and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Scan Failed',
          `Failed to scan for printers.\n\nError: ${errorMessage}\n\nTry:\n• Restarting Bluetooth\n• Restarting the app\n• Checking permissions`,
          [{ text: 'OK' }]
        );
      }
    } finally {
      setScanningPrinters(false);
    }
  };

  /**
   * Show user confirmation dialog to ask if print was successful
   */
  const showPrintConfirmation = (): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        'Print Confirmation',
        'Did the test print work successfully?',
        [
          {
            text: 'No, try another method',
            onPress: () => resolve(false),
            style: 'cancel',
          },
          {
            text: 'Yes, it printed',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  };

  /**
   * Save successful protocol to printer configuration
   */
  const saveProtocolToLANPrinter = async (printer: LANPrinter, protocol: ProtocolType) => {
    try {
      const updatedPrinter: LANPrinter = { ...printer, protocol };

      // Update current state
      setSelectedLANPrinter(updatedPrinter);

      // Save to AsyncStorage
      await AsyncStorage.setItem('selected_lan_printer', JSON.stringify(updatedPrinter));

      // Also update in saved printers list
      const savedPrintersJson = await AsyncStorage.getItem('lan_printers');
      if (savedPrintersJson) {
        const savedPrinters: LANPrinter[] = JSON.parse(savedPrintersJson);
        const updatedPrinters = savedPrinters.map(p =>
          p.id === printer.id ? { ...p, protocol } : p
        );
        await AsyncStorage.setItem('lan_printers', JSON.stringify(updatedPrinters));
      }

      console.log(`✅ [POS] Saved protocol ${protocol} for printer ${printer.ip}`);
    } catch (error) {
      console.error('❌ [POS] Error saving protocol:', error);
    }
  };

  /**
   * Try printing with a specific protocol
   */
  const tryPrintWithProtocol = async (printer: LANPrinter, protocol: ProtocolType): Promise<boolean> => {
    console.log(`🖨️ [POS] Trying ${protocol.toUpperCase()} protocol on ${printer.ip}...`);

    await BluetoothPrinterServiceFactory.switchLibrary('lan');
    const service = BluetoothPrinterServiceFactory.getInstance() as unknown as LANPrinterService;

    // Connect with protocol specified
    const port = protocol === 'lpd' ? 515 : 9100;
    const connected = await service.connect(`${printer.ip}:${port}:${protocol}`);

    if (!connected) {
      throw new Error('Failed to connect to printer');
    }

    await service.testPrint();
    return true;
  };

  const testPrint = async () => {
    // Prevent multiple simultaneous print jobs
    if (isTestPrinting) {
      console.log('⚠️ [POS] Test print already in progress, ignoring request');
      return;
    }

    console.log('🖨️ [POS] Test print initiated');
    console.log('🖨️ [POS] Printer type:', printerType);
    console.log('🖨️ [POS] Selected Bluetooth printer:', selectedPrinter);
    console.log('🖨️ [POS] Selected LAN printer:', selectedLANPrinter);

    // Check if any printer is selected based on printer type
    if (printerType === 'bluetooth' && !selectedPrinter) {
      console.log('⚠️ [POS] No Bluetooth printer selected for test print');
      Alert.alert('Error', 'Please select a Bluetooth printer first');
      return;
    }

    if (printerType === 'lan' && !selectedLANPrinter) {
      console.log('⚠️ [POS] No LAN printer selected for test print');
      Alert.alert('Error', 'Please select a LAN printer first');
      return;
    }

    // Set loading state
    setIsTestPrinting(true);

    // Safety timeout - automatically re-enable button after 60 seconds
    // This is a fallback in case the operation hangs
    const safetyTimeout = setTimeout(() => {
      console.log('⚠️ [POS] Safety timeout triggered - re-enabling test print button');
      setIsTestPrinting(false);
    }, 60000);

    try {
      // Handle LAN printer with protocol fallback
      if (printerType === 'lan' && selectedLANPrinter) {
        await testPrintLANWithFallback(selectedLANPrinter);
        return;
      }

      // Handle Bluetooth printer (original logic)
      await BluetoothPrinterServiceFactory.switchLibrary(bleLibrary);

      const printerAddress = selectedPrinter;
      console.log(`🔗 [POS] Connecting to Bluetooth printer for test print:`, printerAddress);

      const testPrintPromise = (async () => {
        const service = BluetoothPrinterServiceFactory.getInstance();
        const connected = await service.connect(printerAddress);
        if (!connected) {
          throw new Error('Failed to connect to printer');
        }

        console.log('🖨️ [POS] Sending test print...');
        const printOpts = buildPrintOptions();
        console.log(`🎯 [POS] Test print scenario Opsi ${printScenario}`, printOpts);
        const success = await service.testPrint(printOpts);

        if (!success) {
          throw new Error('Test print failed');
        }

        return true;
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Test print timeout after 30 seconds')), 30000)
      );

      await Promise.race([testPrintPromise, timeoutPromise]);

      console.log('✅ [POS] Test print completed successfully');
      Alert.alert('Success', 'Test print completed');
    } catch (error: any) {
      console.error('❌ [POS] Test print error:', error);
      const errorMessage = error?.message || String(error);
      Alert.alert('Test Print Error', `Failed to print: ${errorMessage}`);
    } finally {
      // Clear safety timeout and re-enable button
      clearTimeout(safetyTimeout);
      setIsTestPrinting(false);
    }
  };

  /**
   * Test print for LAN printers with automatic protocol fallback
   */
  const testPrintLANWithFallback = async (printer: LANPrinter) => {
    // Define protocol order - if printer has a saved protocol, try that first
    const savedProtocol = printer.protocol;
    const protocolOrder: ProtocolType[] = savedProtocol
      ? [savedProtocol, savedProtocol === 'raw' ? 'lpd' : 'raw']
      : ['raw', 'lpd'];

    console.log(`🖨️ [POS] Starting LAN test print with protocol order: ${protocolOrder.join(', ')}`);

    for (const protocol of protocolOrder) {
      try {
        console.log(`🖨️ [POS] Attempting ${protocol.toUpperCase()} protocol...`);

        // Try to print with this protocol
        const printPromise = tryPrintWithProtocol(printer, protocol);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 30000)
        );

        await Promise.race([printPromise, timeoutPromise]);

        console.log(`✅ [POS] Print sent via ${protocol.toUpperCase()}`);

        // Ask user if the print was successful
        const printSuccessful = await showPrintConfirmation();

        if (printSuccessful) {
          // Save the successful protocol
          await saveProtocolToLANPrinter(printer, protocol);
          Alert.alert('Success', 'Printer configured successfully!');
          return;
        }

        // User said print didn't work, try next protocol
        console.log(`⚠️ [POS] User reported ${protocol.toUpperCase()} didn't work, trying next...`);

      } catch (error: any) {
        console.log(`⚠️ [POS] ${protocol.toUpperCase()} protocol failed:`, error?.message);
        // Continue to next protocol
      }
    }

    // All protocols failed
    Alert.alert(
      'Connection Failed',
      `Could not connect to the printer at ${printer.ip}.\n\nPlease check:\n• Printer is powered on\n• IP address is correct\n• Both devices are on the same network`,
      [{ text: 'OK' }]
    );
  };

  // Render landscape layout for tablets
  const renderLandscapeLayout = () => (
    <View style={styles.landscapeContainer}>
      {/* Left Panel - Product Search and List */}
      <View style={styles.landscapeLeftPanel}>
        {/* Employee Selection Card */}
        <TouchableOpacity
          style={[
            styles.employeeCard,
            { backgroundColor: selectedEmployee ? '#10B981' : '#6B7280', marginBottom: 12 }
          ]}
          onPress={() => setShowEmployeeModal(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="person-circle" size={32} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.employeeCardLabel}>Cashier (Optional)</Text>
              <Text style={styles.employeeCardName}>
                {selectedEmployee ? selectedEmployee.nama : 'No Cashier Selected - Tap to Select'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Search Bar */}
        <View style={styles.landscapeSearchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search by SKU, Barcode, or Name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              // Search is now debounced via useEffect - no direct call needed
            }}
            autoCapitalize="none"
          />
          {loading && <ActivityIndicator size="small" color="#f59e0b" />}
          <TouchableOpacity
            style={styles.viewModeToggle}
            onPress={() => saveViewModeSelection(productViewMode === 'grid' ? 'list' : 'grid')}
          >
            <Ionicons
              name={productViewMode === 'grid' ? 'list' : 'grid'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>
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

        {/* Product List - Grid or List Layout for Landscape */}
        <View style={styles.landscapeProductListContainer}>
          {showProductList && products.length > 0 ? (
            productViewMode === 'grid' ? (
              <FlatList
                data={products}
                keyExtractor={(item) => `${item.is_bundling ? 'b' : 'p'}-${item.id}`}
                numColumns={5}
                key="grid-5-columns"
                columnWrapperStyle={styles.gridRow}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gridProductCard}
                    onPress={() => addToCart(item)}
                  >
                    <View style={styles.gridProductInitial}>
                      <Text style={styles.gridProductInitialText}>
                        {item.nama.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.gridProductName} numberOfLines={2}>
                      {item.nama}
                    </Text>
                    {item.is_bundling && (
                      <View style={styles.gridBundlingBadge}>
                        <Text style={styles.gridBundlingBadgeText}>Bundling</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            ) : (
              <FlatList
                data={products}
                keyExtractor={(item) => `${item.is_bundling ? 'b' : 'p'}-${item.id}`}
                key="list-view"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listProductItem}
                    onPress={() => addToCart(item)}
                  >
                    <View style={styles.listProductInitial}>
                      <Text style={styles.listProductInitialText}>
                        {item.nama.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.listProductInfo}>
                      <View style={styles.listProductHeader}>
                        <Text style={styles.listProductName}>{item.nama}</Text>
                        {item.is_bundling && (
                          <View style={styles.listBundlingBadge}>
                            <Text style={styles.listBundlingBadgeText}>Bundling</Text>
                          </View>
                        )}
                        {item.bundling_variants && item.bundling_variants.length > 0 && (
                          <View style={styles.listVariantBadge}>
                            <Text style={styles.listVariantBadgeText}>+{item.bundling_variants.length} varian</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.listProductDetails}>
                        <Text style={styles.listProductSku}>SKU: {item.sku}</Text>
                        <Text style={styles.listProductStock}>Stock: {item.stok} {item.satuan}</Text>
                      </View>
                    </View>
                    <View style={styles.listProductPriceContainer}>
                      <Text style={styles.listProductPrice}>
                        Rp {(item.hargajual || 0).toLocaleString('id-ID')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )
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
        {/* Employee Info */}
        <TouchableOpacity
          style={[styles.landscapeCustomerCard, { backgroundColor: selectedEmployee ? '#10B981' : '#EF4444' }]}
          onPress={() => setShowEmployeeModal(true)}
        >
          <View style={styles.landscapeCustomerInfo}>
            <Ionicons name="person-circle" size={24} color="#FFF" />
            <View style={styles.landscapeCustomerTextContainer}>
              <Text style={[styles.landscapeCustomerLabel, { color: '#FFF' }]}>Cashier</Text>
              <Text style={[styles.landscapeCustomerName, { color: '#FFF' }]}>
                {selectedEmployee ? selectedEmployee.nama : 'Select Employee'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFF" />
        </TouchableOpacity>

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
        {/* Employee Selection Card */}
        <TouchableOpacity
          style={[
            styles.employeeCard,
            { backgroundColor: selectedEmployee ? '#10B981' : '#6B7280' }
          ]}
          onPress={() => setShowEmployeeModal(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="person-circle" size={32} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.employeeCardLabel}>Cashier (Optional)</Text>
              <Text style={styles.employeeCardName}>
                {selectedEmployee ? selectedEmployee.nama : 'No Cashier Selected - Tap to Select'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search by SKU, Barcode, or Name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              // Search is now debounced via useEffect - no direct call needed
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
                      {item.bundling_variants && item.bundling_variants.length > 0 && (
                        <View style={styles.variantBadge}>
                          <Text style={styles.variantBadgeText}>+{item.bundling_variants.length} varian</Text>
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
        <View style={styles.headerRightButtons}>
          <TouchableOpacity onPress={() => setShowPrinterModal(true)} style={styles.headerButton}>
            <Ionicons name="print" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowResetConfirmModal(true)} style={styles.headerButton}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
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
                    placeholderTextColor="#9CA3AF"
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
                    placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
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

      {/* Employee Selection Modal */}
      <Modal visible={showEmployeeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Employee (Optional)</Text>
              <TouchableOpacity onPress={() => setShowEmployeeModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {employees.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="people-outline" size={64} color="#D1D5DB" />
                <Text style={{ marginTop: 16, fontSize: 16, color: '#6B7280', textAlign: 'center' }}>
                  No employees found
                </Text>
                <Text style={{ marginTop: 8, fontSize: 14, color: '#9CA3AF', textAlign: 'center' }}>
                  Please add employees in the admin panel
                </Text>
              </View>
            ) : (
              <FlatList
                data={employees}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.customerItem,
                      selectedEmployee?.id === item.id && { backgroundColor: '#E0F2FE' }
                    ]}
                    onPress={() => handleEmployeeSelect(item)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Text style={styles.customerName}>{item.nama}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!item.pin_hash && (
                          <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                            <Text style={{ color: '#92400E', fontSize: 12 }}>No PIN</Text>
                          </View>
                        )}
                        {item.pin_hash && (
                          <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                            <Text style={{ color: '#065F46', fontSize: 12 }}>PIN Set</Text>
                          </View>
                        )}
                        {selectedEmployee?.id === item.id && (
                          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* PIN Entry Modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={() => {
              setShowPinModal(false);
              setPinInput('');
              setPinError('');
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { maxWidth: 400 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Enter PIN</Text>
                  <TouchableOpacity onPress={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPinError('');
                  }}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={{ padding: 20 }}>
                  <Text style={{ fontSize: 16, marginBottom: 10, color: '#374151' }}>
                    Employee: <Text style={{ fontWeight: 'bold' }}>{pinEmployee?.nama}</Text>
                  </Text>

                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: pinError ? '#EF4444' : '#D1D5DB',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 24,
                      textAlign: 'center',
                      letterSpacing: 8,
                      marginBottom: 10,
                      color: '#111827', // Dark text color for visibility
                      backgroundColor: '#FFFFFF', // Explicit white background
                    }}
                    value={pinInput}
                    onChangeText={(text) => {
                      if (/^\d*$/.test(text) && text.length <= 6) {
                        setPinInput(text);
                        setPinError('');
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                    placeholder="••••••"
                    placeholderTextColor="#9CA3AF" // Gray placeholder for visibility
                    autoFocus
                    onSubmitEditing={validatePin}
                  />

                  {pinError ? (
                    <Text style={{ color: '#EF4444', fontSize: 14, marginBottom: 10 }}>
                      {pinError}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={{
                      backgroundColor: pinInput.length === 6 ? '#10B981' : '#D1D5DB',
                      padding: 15,
                      borderRadius: 8,
                      alignItems: 'center'
                    }}
                    onPress={validatePin}
                    disabled={pinInput.length !== 6}
                  >
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>
                      Validate PIN
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Variant Selection Modal */}
      <Modal visible={showVariantModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Varian</Text>
              <TouchableOpacity onPress={() => setShowVariantModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
            >
              {selectedProductForVariant && (
                <>
                  <Text style={styles.variantProductName}>{selectedProductForVariant.nama}</Text>

                  {/* Variant Options */}
                  <View style={styles.variantOptionsContainer}>
                    {/* Masterbarang Option */}
                    <TouchableOpacity
                      style={[
                        styles.variantOption,
                        selectedVariantIndex === 0 && styles.variantOptionSelected
                      ]}
                      onPress={() => setSelectedVariantIndex(0)}
                    >
                      <View style={styles.variantRadio}>
                        {selectedVariantIndex === 0 && <View style={styles.variantRadioInner} />}
                      </View>
                      <View style={styles.variantOptionInfo}>
                        <Text style={styles.variantOptionName}>
                          {selectedProductForVariant.nama} ({selectedProductForVariant.satuan})
                        </Text>
                        <Text style={styles.variantOptionPrice}>
                          Rp {selectedProductForVariant.hargajual.toLocaleString('id-ID')}
                        </Text>
                        <Text style={styles.variantOptionStock}>
                          Stok: {selectedProductForVariant.stok} {selectedProductForVariant.satuan}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Bundling Variants */}
                    {selectedProductForVariant.bundling_variants?.map((variant, index) => (
                      <TouchableOpacity
                        key={variant.id}
                        style={[
                          styles.variantOption,
                          selectedVariantIndex === index + 1 && styles.variantOptionSelected
                        ]}
                        onPress={() => setSelectedVariantIndex(index + 1)}
                      >
                        <View style={styles.variantRadio}>
                          {selectedVariantIndex === index + 1 && <View style={styles.variantRadioInner} />}
                        </View>
                        <View style={styles.variantOptionInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.variantOptionName}>{variant.nama} (bundling)</Text>
                            <View style={styles.bundlingBadge}>
                              <Text style={styles.bundlingBadgeText}>Bundling</Text>
                            </View>
                          </View>
                          <Text style={styles.variantOptionPrice}>
                            Rp {variant.hargajual.toLocaleString('id-ID')}
                          </Text>
                          <Text style={styles.variantOptionStock}>
                            Stok: {variant.stok} {variant.satuan || 'set'}
                          </Text>
                          {/* Show composition */}
                          <Text style={styles.variantComposition}>
                            Komposisi: {variant.items.map(item =>
                              `${item.qty_required} ${item.satuan || 'pcs'} ${item.nama}`
                            ).join(', ')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Quantity Selector */}
                  <View style={styles.variantQtyContainer}>
                    <Text style={styles.variantQtyLabel}>Jumlah:</Text>
                    <View style={styles.variantQtyControls}>
                      <TouchableOpacity
                        style={styles.variantQtyButton}
                        onPress={() => setVariantQty(Math.max(1, variantQty - 1))}
                      >
                        <Ionicons name="remove" size={20} color="white" />
                      </TouchableOpacity>
                      <Text style={styles.variantQtyText}>{variantQty}</Text>
                      <TouchableOpacity
                        style={styles.variantQtyButton}
                        onPress={() => setVariantQty(variantQty + 1)}
                      >
                        <Ionicons name="add" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Add to Cart Button */}
                  <TouchableOpacity
                    style={styles.variantAddButton}
                    onPress={handleVariantSelection}
                  >
                    <Text style={styles.variantAddButtonText}>Tambah ke Keranjang</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
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
              {/* Printer Type Selection */}
              <View style={styles.printerSection}>
                <Text style={styles.sectionLabel}>Printer Type</Text>
                <View style={styles.paperSizeContainer}>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, printerType === 'bluetooth' && styles.paperSizeButtonActive]}
                    onPress={async () => {
                      setPrinterType('bluetooth');
                      await AsyncStorage.setItem('printer_type', 'bluetooth');
                    }}
                  >
                    <Text style={[styles.paperSizeText, printerType === 'bluetooth' && styles.paperSizeTextActive]}>
                      📶 Bluetooth
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, printerType === 'lan' && styles.paperSizeButtonActive]}
                    onPress={async () => {
                      setPrinterType('lan');
                      await AsyncStorage.setItem('printer_type', 'lan');
                    }}
                  >
                    <Text style={[styles.paperSizeText, printerType === 'lan' && styles.paperSizeTextActive]}>
                      🌐 LAN/Network
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Common Settings - Paper Size and Language (for both Bluetooth and LAN) */}
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

              {/* Bluetooth-specific settings */}
              {printerType === 'bluetooth' && (
                <>
                  {/* === PRINT SCENARIO (Troubleshooting) === */}
                  <View style={styles.printerSection}>
                    <Text style={styles.sectionLabel}>🔧 Skenario Print (Troubleshooting)</Text>
                    <Text style={styles.helperText}>
                      Jika printer terkoneksi tapi tidak bisa print, coba ganti skenario satu per satu.
                    </Text>

                    {/* Dropdown trigger */}
                    <TouchableOpacity
                      style={styles.scenarioDropdownButton}
                      onPress={() => setShowScenarioDropdown(prev => !prev)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.scenarioDropdownLeft}>
                        <Ionicons name="options-outline" size={18} color="#f59e0b" />
                        <Text style={styles.scenarioDropdownValue} numberOfLines={1}>
                          {SCENARIO_OPTIONS.find(s => s.value === printScenario)?.label ?? `Opsi ${printScenario}`}
                        </Text>
                      </View>
                      <Ionicons
                        name={showScenarioDropdown ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#6B7280"
                      />
                    </TouchableOpacity>

                    {/* Dropdown list */}
                    {showScenarioDropdown && (
                      <View style={styles.scenarioDropdownList}>
                        {SCENARIO_OPTIONS.map(opt => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.scenarioDropdownItem,
                              printScenario === opt.value && styles.scenarioDropdownItemActive,
                            ]}
                            onPress={() => saveScenarioSelection(opt.value)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.scenarioDropdownItemRow}>
                              {printScenario === opt.value
                                ? <Ionicons name="radio-button-on" size={16} color="#f59e0b" />
                                : <Ionicons name="radio-button-off" size={16} color="#9CA3AF" />
                              }
                              <Text style={[
                                styles.scenarioDropdownLabel,
                                printScenario === opt.value && styles.scenarioDropdownLabelActive,
                              ]}>
                                {opt.label}
                              </Text>
                            </View>
                            <Text style={styles.scenarioDropdownDesc}>{opt.description}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Active scenario description (collapsed view) */}
                    {!showScenarioDropdown && (
                      <View style={styles.scenarioActiveInfo}>
                        <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
                        <Text style={styles.scenarioActiveDesc}>
                          {SCENARIO_OPTIONS.find(s => s.value === printScenario)?.description}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* BLE Library Selection (hidden when scenario auto-selects it) */}
                  <View style={styles.printerSection}>
                    <Text style={styles.sectionLabel}>Bluetooth Library</Text>
                <View style={styles.paperSizeContainer}>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, bleLibrary === 'bt-classic' && styles.paperSizeButtonActive]}
                    onPress={() => saveBleLibrarySelection('bt-classic')}
                  >
                    <Text style={[styles.paperSizeText, bleLibrary === 'bt-classic' && styles.paperSizeTextActive]}>
                      ✅ BT Classic
                    </Text>
                    <Text style={styles.recommendedBadge}>Recommended</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paperSizeButton, bleLibrary === 'ble-plx' && styles.paperSizeButtonActive]}
                    onPress={() => saveBleLibrarySelection('ble-plx')}
                  >
                    <Text style={[styles.paperSizeText, bleLibrary === 'ble-plx' && styles.paperSizeTextActive]}>
                      🔧 BLE PLX
                    </Text>
                    <Text style={styles.legacyBadge}>Legacy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>
                  {bleLibrary === 'bt-classic'
                    ? '✅ Better for thermal printers. Uses Bluetooth Classic (SPP).'
                    : '⚠️ May crash on some devices. Try BT Classic if you experience issues.'}
                </Text>
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
                <TouchableOpacity
                  style={[
                    styles.testPrintButton,
                    isTestPrinting && styles.testPrintButtonDisabled
                  ]}
                  onPress={testPrint}
                  disabled={isTestPrinting}
                  activeOpacity={isTestPrinting ? 1 : 0.7}
                >
                  {isTestPrinting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="print" size={20} color="white" />
                  )}
                  <Text style={styles.testPrintText}>
                    {isTestPrinting ? 'Testing...' : 'Test Print'}
                  </Text>
                </TouchableOpacity>
              )}
                </>
              )}

              {/* LAN Printer Settings */}
              {printerType === 'lan' && (
                <LANPrinterSettings
                  onPrinterSelected={(printer) => {
                    console.log('🖨️ [POS] LAN printer selected:', printer);
                    setSelectedLANPrinter(printer);
                    AsyncStorage.setItem('selected_lan_printer', JSON.stringify(printer));
                    console.log('✅ [POS] LAN printer state updated and saved');
                  }}
                  selectedPrinterId={selectedLANPrinter?.id}
                />
              )}

              {/* Test Print Button for LAN */}
              {printerType === 'lan' && selectedLANPrinter && (
                <TouchableOpacity
                  style={[
                    styles.testPrintButton,
                    isTestPrinting && styles.testPrintButtonDisabled
                  ]}
                  onPress={testPrint}
                  disabled={isTestPrinting}
                  activeOpacity={isTestPrinting ? 1 : 0.7}
                >
                  {isTestPrinting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="print" size={20} color="white" />
                  )}
                  <Text style={styles.testPrintText}>
                    {isTestPrinting ? 'Testing...' : 'Test Print'}
                  </Text>
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

            {/* Scanner Mode Toggle */}
            <View style={styles.scannerModeToggle}>
              <TouchableOpacity
                style={[
                  styles.scannerModeButton,
                  scannerMode === 'camera' && styles.scannerModeButtonActive
                ]}
                onPress={() => setScannerMode('camera')}
              >
                <Ionicons
                  name="camera"
                  size={20}
                  color={scannerMode === 'camera' ? '#FFF' : '#6B7280'}
                />
                <Text style={[
                  styles.scannerModeButtonText,
                  scannerMode === 'camera' && styles.scannerModeButtonTextActive
                ]}>
                  Camera
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.scannerModeButton,
                  scannerMode === 'external' && styles.scannerModeButtonActive
                ]}
                onPress={() => {
                  setScannerMode('external');
                  // Auto-focus external scanner input when switching to this mode
                  setTimeout(() => externalScannerRef.current?.focus(), 100);
                }}
              >
                <Ionicons
                  name="barcode"
                  size={20}
                  color={scannerMode === 'external' ? '#FFF' : '#6B7280'}
                />
                <Text style={[
                  styles.scannerModeButtonText,
                  scannerMode === 'external' && styles.scannerModeButtonTextActive
                ]}>
                  Scanner Device
                </Text>
              </TouchableOpacity>
            </View>

            {/* Camera Mode */}
            {scannerMode === 'camera' ? (
              hasPermission === null ? (
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
                  isActive={showBarcodeScanner && scannerMode === 'camera'}
                  codeScanner={codeScanner}
                >
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerFrame} />
                    <Text style={styles.scannerInstructions}>
                      Position barcode within the frame
                    </Text>
                  </View>
                </Camera>
              )
            ) : (
              /* External Scanner Mode */
              <View style={styles.externalScannerContainer}>
                <View style={styles.externalScannerContent}>
                  <Ionicons name="barcode-outline" size={80} color="#f59e0b" />
                  <Text style={styles.externalScannerTitle}>External Scanner Ready</Text>
                  <Text style={styles.externalScannerInstructions}>
                    Point your barcode scanner at the input field below and scan
                  </Text>

                  <View style={styles.externalScannerInputContainer}>
                    <TextInput
                      ref={externalScannerRef}
                      style={styles.externalScannerInput}
                      value={externalScannerInput}
                      onChangeText={(text) => {
                        // Handle newline/carriage return from scanner
                        if (text.includes('\n') || text.includes('\r')) {
                          const sanitized = text.replace(/\r?\n/g, '');
                          setExternalScannerInput(sanitized);
                          handleExternalScannerSubmit();
                        } else {
                          setExternalScannerInput(text);
                        }
                      }}
                      onSubmitEditing={handleExternalScannerSubmit}
                      placeholder="Scan barcode here..."
                      placeholderTextColor="#9CA3AF"
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={styles.externalScannerButton}
                      onPress={handleExternalScannerSubmit}
                      disabled={!externalScannerInput.trim()}
                    >
                      <Text style={styles.externalScannerButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.externalScannerHint}>
                    💡 Tip: The input field will stay focused for rapid consecutive scanning
                  </Text>
                </View>
              </View>
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
                    placeholderTextColor="#9CA3AF"
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
                    placeholderTextColor="#9CA3AF"
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
                    placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
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

      {/* Reset Confirmation Modal */}
      <Modal visible={showResetConfirmModal} transparent animationType="fade">
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalHeader}>
              <Ionicons name="warning-outline" size={48} color="#f59e0b" />
            </View>
            <Text style={styles.confirmModalTitle}>Buat Nota Baru?</Text>
            <Text style={styles.confirmModalMessage}>
              Apakah Anda yakin ingin membuat nota baru? Semua data transaksi saat ini akan dihapus.
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonCancel]}
                onPress={() => setShowResetConfirmModal(false)}
              >
                <Text style={styles.confirmModalButtonTextCancel}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonConfirm]}
                onPress={handleResetConfirm}
              >
                <Text style={styles.confirmModalButtonTextConfirm}>Ya, Reset</Text>
              </TouchableOpacity>
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
  headerRightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  employeeCard: {
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeCardLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  employeeCardName: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
    marginTop: 2,
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
    color: '#111827', // Dark text for visibility
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
    color: '#111827', // Dark text for visibility
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
    color: '#111827', // Dark text for visibility
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
    color: '#111827', // Dark text for visibility
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
    color: '#111827', // Dark text for visibility
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
  recommendedBadge: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
    fontWeight: '600',
  },
  legacyBadge: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // --- Print Scenario Dropdown ---
  scenarioDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  scenarioDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  scenarioDropdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  scenarioDropdownList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  scenarioDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  scenarioDropdownItemActive: {
    backgroundColor: '#FFFBEB',
  },
  scenarioDropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  scenarioDropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  scenarioDropdownLabelActive: {
    color: '#d97706',
  },
  scenarioDropdownDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    paddingLeft: 24,
  },
  scenarioActiveInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  scenarioActiveDesc: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    lineHeight: 17,
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
  testPrintButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
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
  scannerModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  scannerModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  scannerModeButtonActive: {
    backgroundColor: '#f59e0b',
  },
  scannerModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  scannerModeButtonTextActive: {
    color: '#FFF',
  },
  externalScannerContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  externalScannerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  externalScannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  externalScannerInstructions: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  externalScannerInputContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  externalScannerInput: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#FFF',
  },
  externalScannerButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  externalScannerButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  externalScannerHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
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
    color: '#111827', // Dark text for visibility
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
  // Grid Layout Styles
  gridRow: {
    gap: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  gridProductCard: {
    flex: 1,
    maxWidth: '18%', // 5 columns with gaps
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  gridProductInitial: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridProductInitialText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  gridProductName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    marginTop: 4,
  },
  gridBundlingBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  gridBundlingBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1E40AF',
  },
  // View Mode Toggle Button
  viewModeToggle: {
    padding: 8,
    marginRight: 8,
  },
  // List View Styles
  listProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  listProductInitial: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listProductInitialText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  listProductInfo: {
    flex: 1,
    marginRight: 12,
  },
  listProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  listProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  listBundlingBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  listBundlingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  listVariantBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  listVariantBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  listProductDetails: {
    gap: 4,
  },
  listProductSku: {
    fontSize: 13,
    color: '#6B7280',
  },
  listProductStock: {
    fontSize: 13,
    color: '#10B981',
  },
  listProductPriceContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 120,
  },
  listProductPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  // Reset Confirmation Modal Styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmModalHeader: {
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmModalButtonCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  confirmModalButtonConfirm: {
    backgroundColor: '#f59e0b',
  },
  confirmModalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmModalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // Variant Selection Modal Styles
  variantBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  variantBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  variantProductName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  variantOptionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  variantOption: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  variantOptionSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  variantRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  variantRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
  },
  variantOptionInfo: {
    flex: 1,
  },
  variantOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  variantOptionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 2,
  },
  variantOptionStock: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  variantComposition: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  variantQtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  variantQtyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  variantQtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  variantQtyButton: {
    backgroundColor: '#f59e0b',
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  variantQtyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    minWidth: 40,
    textAlign: 'center',
  },
  variantAddButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  variantAddButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default POSKasirScreen;

