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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp, NavigationProp, DrawerActions } from '@react-navigation/native';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
// Note: Using pembelian modals temporarily - will need penjualan-specific modals later
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import EditItemModal, { ItemDetail as EditableItemDetail } from '../../../components/pembelian/EditItemModal';

type RootStackParamList = {
  PenjualanSearch: undefined;
  PenjualanRincian: { id: number };
};

type PenjualanRincianRouteProp = RouteProp<RootStackParamList, 'PenjualanRincian'>;
type PenjualanRincianNavigationProp = NavigationProp<RootStackParamList>;

interface PenjualanData {
  id: number;
  tanggal: string;
  tanggal_invoice: string;
  id_customer: number;
  customer: string;
  keterangan: string;
  total: string;
  bayar: string;
  biaya_service: string;
  biaya_tambahan: string;
  service: boolean;
  shop_name?: string;
  online_id?: string;
  online_platform?: string;
  invoice_tokped?: string;
  no_po?: string;
  no_sj?: string;
  faktur_pajak?: string;
  no_invoice?: string;
  lunas?: boolean;
  useppn?: number;
  ppn?: number;
  kodeBAbayar?: string;
  kodeBA?: string;
  bayarKontan?: string;
}

interface ItemDetail {
  id: number;
  id_barang: number;
  nama: string;
  merk?: string;
  kategori?: string;
  qty: number;
  hargajual: string;
  hargajual_exppn?: string;
  subtotal: number;
  id_gudang?: number;
  gudang?: string;
  barcode?: string;
  satuan?: string;
}

interface PaymentDetail {
  id: number;
  id_pelunasan: number;
  tanggal: string;
  keterangan: string;
  saldo: string;
  kodeBA: string;
}

interface Warehouse {
  id: number;
  name: string;
}

export default function PenjualanRincianScreen() {
  const route = useRoute<PenjualanRincianRouteProp>();
  const navigation = useNavigation<PenjualanRincianNavigationProp>();
  const penjualanId = route.params?.id;

  // Handle back button - navigate back to PenjualanSearch screen
  const handleBack = () => {
    // Navigate back to PenjualanSearch screen instead of using goBack()
    // This ensures we always go to the search screen, not the main screen
    (navigation as any).navigate('PenjualanSearch');
  };

  // Data state
  const [data, setData] = useState<PenjualanData>({
    id: 0,
    tanggal: '',
    tanggal_invoice: '',
    id_customer: 0,
    customer: '',
    keterangan: '',
    total: '0',
    bayar: '0',
    biaya_service: '0',
    biaya_tambahan: '0',
    service: false,
    useppn: 0,
    ppn: 0,
    kodeBAbayar: '',
    kodeBA: '',
    bayarKontan: '0',
  });
  const [itemDetails, setItemDetails] = useState<ItemDetail[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number>(0);
  const [persentaseBiayaTambahan, setPersentaseBiayaTambahan] = useState(0);

  // Modal state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showBaganAkunModal, setShowBaganAkunModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableItemDetail | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number>(-1);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemDetailsExpanded, setItemDetailsExpanded] = useState(true);
  const [paymentDetailsExpanded, setPaymentDetailsExpanded] = useState(true);

  useEffect(() => {
    if (penjualanId) {
      loadData();
    }
  }, [penjualanId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      console.log('[PenjualanRincian] Loading data for ID:', penjualanId);

      // Fetch penjualan data
      const penjualanRes = await fetch(
        `${API_BASE_URL}/get/penjualan/condition/and/id:equal:${penjualanId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('[PenjualanRincian] Penjualan response status:', penjualanRes.status);
      const penjualanText = await penjualanRes.text();
      console.log('[PenjualanRincian] Penjualan response (first 200 chars):', penjualanText.substring(0, 200));

      const penjualanData = JSON.parse(penjualanText);

      // Fetch item details (barang)
      const itemRes = await fetch(
        `${API_BASE_URL}/get/detailpenjualan/join/masterbarang/${penjualanId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const itemData = await itemRes.json();

      // Fetch item details (bundling)
      const bundlingRes = await fetch(
        `${API_BASE_URL}/get/detailpenjualan/join/bundling/${penjualanId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const bundlingData = await bundlingRes.json();

      // Fetch item details (manual)
      const manualRes = await fetch(
        `${API_BASE_URL}/get/detailpenjualan_manual/${penjualanId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const manualData = await manualRes.json();

      // Fetch payment details
      const paymentRes = await fetch(
        `${API_BASE_URL}/get/detailpelunasanpiutang/join/pelunasanpiutang/${penjualanId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const paymentData = await paymentRes.json();

      if (penjualanData.status && penjualanData.data && penjualanData.data.length > 0) {
        const penjualan = penjualanData.data[0];
        setData(penjualan);

        // Combine all item details (barang + bundling + manual)
        const allItems: ItemDetail[] = [];

        // Add barang items
        if (itemData.status && itemData.data) {
          const barangItems = itemData.data.map((item: any) => ({
            id: item.id,
            id_barang: item.id_barang,
            nama: item.nama || 'Unknown',
            merk: item.merk,
            kategori: item.kategori,
            qty: item.qty,
            hargajual: item.hargajual,
            hargajual_exppn: item.hargajual_exppn,
            subtotal: parseFloat(item.hargajual || '0') * item.qty,
          }));
          allItems.push(...barangItems);
        }

        // Add bundling items
        if (bundlingData.status && bundlingData.data) {
          const bundlingItems = bundlingData.data.map((item: any) => ({
            id: item.id,
            id_barang: item.id_bundling,
            nama: `[BUNDLING] ${item.nama || 'Unknown'}`,
            merk: item.merk,
            kategori: item.kategori,
            qty: item.qty,
            hargajual: item.hargajual,
            hargajual_exppn: item.hargajual_exppn,
            subtotal: parseFloat(item.hargajual || '0') * item.qty,
          }));
          allItems.push(...bundlingItems);
        }

        // Add manual items
        if (manualData.status && manualData.data) {
          const manualItems = manualData.data.map((item: any) => ({
            id: item.id,
            id_barang: 0,
            nama: `[MANUAL] ${item.nama || 'Unknown'}`,
            merk: '',
            kategori: '',
            qty: item.qty,
            hargajual: item.hargajual,
            hargajual_exppn: item.hargajual_exppn,
            subtotal: parseFloat(item.hargajual || '0') * item.qty,
          }));
          allItems.push(...manualItems);
        }

        setItemDetails(allItems);

        // Set payment details
        if (paymentData.status && paymentData.data) {
          const payments = paymentData.data.map((item: any) => ({
            id: item.id,
            id_pelunasan: item.id_pelunasan,
            tanggal: item.tanggal?.substring(0, item.tanggal.length - 5) || '',
            keterangan: item.keterangan || '',
            saldo: item.saldo || '0',
            kodeBA: item.kodeBAbayar || '',
          }));
          setPaymentDetails(payments);
        }
      } else {
        Alert.alert('Error', 'Failed to load data');
      }
    } catch (error) {
      console.error('Load data error:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Handler functions
  const handleCustomerSelect = (customer: SupplierItem) => {
    // Note: Using SupplierItem type temporarily - should be CustomerItem
    setData({ ...data, id_customer: customer.id, customer: customer.nama });
    setShowSupplierModal(false);
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setData({ ...data, kodeBA: item.kode });
    setShowBaganAkunModal(false);
  };

  const handleEditItem = (index: number) => {
    const item = itemDetails[index];
    const editableItem: EditableItemDetail = {
      id: String(item.id),
      nama: item.nama,
      merk: item.merk || '',
      kategori: item.kategori || '',
      qty: item.qty,
      qty_print: '0',
      hargabeli: item.hargajual, // Using hargajual as hargabeli for compatibility
      hargabeli_exppn: item.hargajual_exppn || item.hargajual,
      price_list: item.hargajual,
    };
    setEditingItem(editableItem);
    setEditingItemIndex(index);
    setShowEditItemModal(true);
  };

  const handleSaveEditItem = (item: EditableItemDetail) => {
    const newItems = [...itemDetails];
    newItems[editingItemIndex] = {
      ...newItems[editingItemIndex],
      nama: item.nama,
      merk: item.merk,
      kategori: item.kategori,
      qty: item.qty,
      hargajual: item.hargabeli,
      hargajual_exppn: item.hargabeli_exppn,
      subtotal: parseFloat(item.hargabeli) * item.qty,
    };
    setItemDetails(newItems);
    setShowEditItemModal(false);
  };

  const handleDeleteItem = (index: number) => {
    Alert.alert(
      'Hapus Item',
      'Apakah Anda yakin ingin menghapus item ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            const newItems = [...itemDetails];
            newItems.splice(index, 1);
            setItemDetails(newItems);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      // Prepare payload for saving penjualan
      const payload = {
        id: data.id,
        tanggal: data.tanggal,
        tanggal_invoice: data.tanggal_invoice,
        id_customer: data.id_customer,
        keterangan: data.keterangan,
        biaya_service: data.biaya_service,
        biaya_tambahan: data.biaya_tambahan,
        bayarKontan: data.bayarKontan,
        kodeBA: data.kodeBA,
        items: itemDetails.map((item) => ({
          id: item.id,
          id_barang: item.id_barang,
          qty: item.qty,
          hargajual: item.hargajual,
          id_gudang: item.id_gudang,
        })),
      };

      const res = await fetch(`${API_BASE_URL}/update/penjualan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (responseData.status) {
        Alert.alert('Sukses', 'Data berhasil disimpan');
        loadData(); // Reload data
      } else {
        Alert.alert('Error', responseData.message || 'Failed to save data');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save data');
    } finally {
      setSaving(false);
    }
  };

  // Helper functions
  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculateTotal = () => {
    return itemDetails.reduce((total, item) => total + item.subtotal, 0);
  };

  const calculateGrandTotal = () => {
    const itemsTotal = calculateTotal();
    const biayaService = parseFloat(data.biaya_service) || 0;
    const biayaTambahan = parseFloat(data.biaya_tambahan) || 0;
    return itemsTotal + biayaService + biayaTambahan;
  };

  const calculateRemaining = () => {
    const grandTotal = calculateGrandTotal();
    const bayar = parseFloat(data.bayar) || 0;
    return grandTotal - bayar;
  };

  const calculateTotalPayment = () => {
    return paymentDetails.reduce((total, item) => total + parseFloat(item.saldo || '0'), 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Data tidak ditemukan</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <Text style={styles.backButtonText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = calculateTotal();
  const totalPayment = calculateTotalPayment();
  const sisa = total - totalPayment;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#dc2626" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Rincian Penjualan</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container}>
        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Informasi Penjualan</Text>
            <View style={[
              styles.statusBadge,
              data.lunas ? styles.statusLunas : styles.statusBelumLunas
            ]}>
              <Text style={styles.statusText}>
                {data.lunas ? 'LUNAS' : 'BELUM LUNAS'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID Penjualan:</Text>
            <Text style={styles.infoValue}>
              {data.service ? `SER/${data.id}` : `JUAL/${data.id}`}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tanggal:</Text>
            <Text style={styles.infoValue}>{formatDate(data.tanggal)}</Text>
          </View>

          {/* Editable: Customer */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>ID Customer</Text>
            <View style={styles.inputWithButton}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={String(data.id_customer)}
                editable={false}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowSupplierModal(true)}
              >
                <Ionicons name="search" size={18} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoValue}>{data.customer || '-'}</Text>
          </View>

          {/* Editable: Keterangan */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Keterangan</Text>
            <TextInput
              style={styles.input}
              value={data.keterangan}
              onChangeText={(val) => setData({ ...data, keterangan: val })}
              placeholder="Keterangan"
              multiline
            />
          </View>

          {/* Editable: Biaya Service */}
          {data.service && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Biaya Service</Text>
              <TextInput
                style={styles.input}
                value={data.biaya_service}
                onChangeText={(val) => setData({ ...data, biaya_service: val })}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Editable: Biaya Tambahan */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Biaya Tambahan</Text>
            <TextInput
              style={styles.input}
              value={data.biaya_tambahan}
              onChangeText={(val) => setData({ ...data, biaya_tambahan: val })}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>

          {/* Editable: Bayar Kontan */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Bayar Kontan</Text>
            <TextInput
              style={styles.input}
              value={data.bayarKontan || '0'}
              onChangeText={(val) => setData({ ...data, bayarKontan: val })}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>

          {/* Editable: Kode Bagan Akun */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Kode Bagan Akun</Text>
            <View style={styles.inputWithButton}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={data.kodeBA || ''}
                editable={false}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowBaganAkunModal(true)}
              >
                <Ionicons name="search" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>

        {data.shop_name && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Toko:</Text>
            <Text style={styles.infoValue}>{data.shop_name}</Text>
          </View>
        )}

        {data.online_platform === 'tokopedia' && data.invoice_tokped && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Invoice Tokped:</Text>
            <Text style={styles.infoValue}>{data.invoice_tokped}</Text>
          </View>
        )}

        {data.online_platform !== 'tokopedia' && data.online_id && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Online ID:</Text>
            <Text style={styles.infoValue}>{data.online_id}</Text>
          </View>
        )}

        {data.no_po && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>No. PO:</Text>
            <Text style={styles.infoValue}>{data.no_po}</Text>
          </View>
        )}

        {data.no_sj && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>No. SJ:</Text>
            <Text style={styles.infoValue}>{data.no_sj}</Text>
          </View>
        )}

        {data.faktur_pajak && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Faktur Pajak:</Text>
            <Text style={styles.infoValue}>{data.faktur_pajak}</Text>
          </View>
        )}

        {data.no_invoice && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>No. Invoice:</Text>
            <Text style={styles.infoValue}>{data.no_invoice}</Text>
          </View>
        )}

        {data.useppn === 1 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PPN:</Text>
            <Text style={styles.infoValue}>{data.ppn || 0}%</Text>
          </View>
        )}
      </View>

      {/* Item Details */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setItemDetailsExpanded(!itemDetailsExpanded)}
        >
          <Text style={styles.cardTitle}>Detail Barang ({itemDetails.length})</Text>
          <Ionicons
            name={itemDetailsExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#6b7280"
          />
        </TouchableOpacity>

        {itemDetailsExpanded && (
          <>
            {itemDetails.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemHeaderLeft}>
                    <Text style={styles.itemName}>{item.nama}</Text>
                    {item.merk && (
                      <Text style={styles.itemMerk}>{item.merk}</Text>
                    )}
                    {item.kategori && (
                      <Text style={styles.itemKategori}>{item.kategori}</Text>
                    )}
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.itemActionButton}
                      onPress={() => handleEditItem(index)}
                    >
                      <Ionicons name="create-outline" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itemActionButton}
                      onPress={() => handleDeleteItem(index)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>Qty:</Text>
                    <Text style={styles.itemDetailValue}>{item.qty}</Text>
                  </View>

                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>Harga:</Text>
                    <Text style={styles.itemDetailValue}>
                      Rp {formatCurrency(item.hargajual)}
                    </Text>
                  </View>

                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>Subtotal:</Text>
                    <Text style={[styles.itemDetailValue, styles.itemSubtotal]}>
                      Rp {formatCurrency(item.subtotal)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>Rp {formatCurrency(total)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Payment Details */}
      {paymentDetails.length > 0 && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => setPaymentDetailsExpanded(!paymentDetailsExpanded)}
          >
            <Text style={styles.cardTitle}>
              Rincian Pembayaran ({paymentDetails.length})
            </Text>
            <Ionicons
              name={paymentDetailsExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#6b7280"
            />
          </TouchableOpacity>

          {paymentDetailsExpanded && (
            <>
              {paymentDetails.map((payment, index) => (
                <View key={index} style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentId}>
                      PELUNASAN/{payment.id_pelunasan}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {formatDate(payment.tanggal)}
                    </Text>
                  </View>

                  {payment.keterangan && (
                    <Text style={styles.paymentKeterangan}>
                      {payment.keterangan}
                    </Text>
                  )}

                  <View style={styles.paymentDetails}>
                    <View style={styles.paymentDetailRow}>
                      <Text style={styles.paymentDetailLabel}>Bayar:</Text>
                      <Text style={styles.paymentDetailValue}>
                        Rp {formatCurrency(payment.saldo)}
                      </Text>
                    </View>

                    {payment.kodeBA && (
                      <View style={styles.paymentDetailRow}>
                        <Text style={styles.paymentDetailLabel}>Kode BA:</Text>
                        <Text style={styles.paymentDetailValue}>
                          {payment.kodeBA}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Bayar:</Text>
                <Text style={styles.totalValue}>
                  Rp {formatCurrency(totalPayment)}
                </Text>
              </View>

              {sisa > 0 && (
                <View style={styles.sisaRow}>
                  <Text style={styles.sisaLabel}>Sisa:</Text>
                  <Text style={styles.sisaValue}>Rp {formatCurrency(sisa)}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ringkasan</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Barang:</Text>
          <Text style={styles.summaryValue}>Rp {formatCurrency(total)}</Text>
        </View>

        {parseFloat(data.biaya_service || '0') > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Biaya Service:</Text>
            <Text style={styles.summaryValue}>
              Rp {formatCurrency(data.biaya_service)}
            </Text>
          </View>
        )}

        {parseFloat(data.biaya_tambahan || '0') > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Biaya Tambahan:</Text>
            <Text style={styles.summaryValue}>
              Rp {formatCurrency(data.biaya_tambahan)}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelBold}>Grand Total:</Text>
          <Text style={styles.summaryValueBold}>
            Rp {formatCurrency(calculateGrandTotal())}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Bayar:</Text>
          <Text style={styles.summaryValue}>
            Rp {formatCurrency(totalPayment)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelBold}>Sisa:</Text>
          <Text style={[
            styles.summaryValueBold,
            calculateRemaining() > 0 ? styles.sisaPositive : styles.sisaZero
          ]}>
            Rp {formatCurrency(calculateRemaining())}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.cardForButtonAction}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Simpan</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButtonBottom}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backButtonBottomText}>Kembali</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomSpacer} />
    </ScrollView>

    {/* Modals */}
    <SearchSupplierModal
      visible={showSupplierModal}
      onClose={() => setShowSupplierModal(false)}
      onSelect={handleCustomerSelect}
    />

    <SearchBaganAkunModal
      visible={showBaganAkunModal}
      onClose={() => setShowBaganAkunModal(false)}
      onSelect={handleBaganAkunSelect}
    />

    {editingItem && (
      <EditItemModal
        visible={showEditItemModal}
        item={editingItem}
        onClose={() => setShowEditItemModal(false)}
        onSave={handleSaveEditItem}
        usePPN={data.useppn === 1}
        ppnRate={data.ppn || 0}
      />
    )}
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#ef4444',
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardForButtonAction: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusLunas: {
    backgroundColor: '#d1fae5',
  },
  statusBelumLunas: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  // Form group styles (editable fields)
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemHeaderLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  itemMerk: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  itemKategori: {
    fontSize: 12,
    color: '#9ca3af',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemActionButton: {
    padding: 4,
  },
  itemDetails: {
    marginTop: 8,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  itemDetailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  itemSubtotal: {
    fontWeight: '700',
    color: '#3b82f6',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  paymentCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  paymentDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  paymentKeterangan: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  paymentDetails: {
    marginTop: 4,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  paymentDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  paymentDetailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  sisaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sisaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  sisaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '700',
  },
  sisaPositive: {
    color: '#ef4444',
  },
  sisaZero: {
    color: '#10b981',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  // Action buttons
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  backButtonBottom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  backButtonBottomText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 24,
  },
});

