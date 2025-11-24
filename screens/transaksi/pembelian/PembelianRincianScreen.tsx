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
import { useRoute, useNavigation, RouteProp, DrawerActions } from '@react-navigation/native';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import SearchBarangModal, { BarangItem } from '../../../components/SearchBarangModal';
import TambahBarangModal, { NewBarangData } from '../../../components/pembelian/TambahBarangModal';
import EditItemModal, { ItemDetail } from '../../../components/pembelian/EditItemModal';

type RootStackParamList = {
  PembelianRincian: { id: number };
};

type PembelianRincianRouteProp = RouteProp<RootStackParamList, 'PembelianRincian'>;

interface PembelianData {
  id: number;
  tanggal: string;
  tanggal_invoice: string;
  id_supplier: number;
  keterangan: string;
  biaya_tambahan: string;
  bayarKontan: string;
  kodeBA: string;
  useppn: boolean;
  ppn: number;
}

interface PaymentDetail {
  id: string;
  tanggal: string;
  keterangan: string;
  saldo: string;
  kodeBA: string;
}

interface Warehouse {
  id: number;
  name: string;
}

export default function PembelianRincianScreen() {
  const route = useRoute<PembelianRincianRouteProp>();
  const navigation = useNavigation();
  const pembelianId = route.params?.id;

  // Data state
  const [data, setData] = useState<PembelianData>({
    id: 0,
    tanggal: '',
    tanggal_invoice: '',
    id_supplier: 0,
    keterangan: '',
    biaya_tambahan: '0',
    bayarKontan: '0',
    kodeBA: '',
    useppn: false,
    ppn: 0,
  });
  const [itemDetails, setItemDetails] = useState<ItemDetail[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number>(0);
  const [persentaseBiayaTambahan, setPersentaseBiayaTambahan] = useState(0);

  // Modal state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showBaganAkunModal, setShowBaganAkunModal] = useState(false);
  const [showBarangModal, setShowBarangModal] = useState(false);
  const [showTambahBarangModal, setShowTambahBarangModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDetail | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number>(-1);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemDetailsExpanded, setItemDetailsExpanded] = useState(true);
  const [paymentDetailsExpanded, setPaymentDetailsExpanded] = useState(true);

  useEffect(() => {
    if (pembelianId) {
      loadData();
    }
  }, [pembelianId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      // Fetch pembelian data
      const pembelianRes = await fetch(
        `${API_BASE_URL}/get/pembelian/condition/and/id:equal:${pembelianId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const pembelianData = await pembelianRes.json();

      // Fetch item details
      const itemRes = await fetch(
        `${API_BASE_URL}/get/detailpembelian/join/masterbarang/${pembelianId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const itemData = await itemRes.json();

      // Fetch payment details
      const paymentRes = await fetch(
        `${API_BASE_URL}/get/detailpelunasanhutang/join/pelunasanhutang/${pembelianId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const paymentData = await paymentRes.json();

      // Fetch warehouses
      const warehouseRes = await fetch(`${API_BASE_URL}/get/warehouses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const warehouseData = await warehouseRes.json();

      if (pembelianData.status && itemData.status) {
        const pembelian = pembelianData.data[0];
        
        setData({
          id: pembelian.id,
          tanggal: pembelian.tanggal,
          tanggal_invoice: pembelian.tanggal_invoice?.replace(' ', 'T') || '',
          id_supplier: pembelian.id_supplier,
          keterangan: pembelian.keterangan,
          biaya_tambahan: pembelian.biaya_tambahan || '0',
          bayarKontan: pembelian.bayarkontan || '0',
          kodeBA: pembelian.kodeBAbayar || '',
          useppn: !!pembelian.useppn,
          ppn: pembelian.ppn || 0,
        });

        const items = itemData.data.map((item: any) => ({
          id: String(item.id_barang),
          nama: item.nama,
          merk: item.merk,
          kategori: item.kategori,
          qty: item.qty,
          qty_print: String(item.qty),
          hargabeli: item.harga_beli,
          hargabeli_exppn: item.harga_beli_exppn,
          price_list: item.price_list,
          warehouse_id: item.warehouse_id,
        }));
        setItemDetails(items);

        if (items.length > 0 && items[0].warehouse_id) {
          setSelectedWarehouse(items[0].warehouse_id);
        }

        if (paymentData.status) {
          const payments = paymentData.data.map((item: any) => ({
            id: `PELUNASAN/${item.id_pelunasan}`,
            tanggal: item.tanggal.substring(0, item.tanggal.length - 5),
            keterangan: item.keterangan,
            saldo: item.saldo,
            kodeBA: item.kodeBAbayar,
          }));
          setPaymentDetails(payments);
        }

        if (warehouseData.status) {
          setWarehouses(warehouseData.data);
        }

        // Calculate persentase biaya tambahan
        const totalPriceList = items.reduce(
          (total: number, item: any) => total + parseFloat(item.price_list || '0') * item.qty,
          0
        );
        if (totalPriceList > 0) {
          setPersentaseBiayaTambahan(parseFloat(pembelian.biaya_tambahan || '0') / totalPriceList);
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

  const handleSupplierSelect = (supplier: SupplierItem) => {
    setData({ ...data, id_supplier: supplier.id });
    setShowSupplierModal(false);
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setData({ ...data, kodeBA: item.kode });
    setShowBaganAkunModal(false);
  };

  const handleBarangSelect = (items: BarangItem[]) => {
    const newItems = items.map((item) => ({
      id: String(item.id),
      nama: item.nama,
      merk: item.merk || '',
      kategori: item.kategori || '',
      qty: 0,
      qty_print: '0',
      hargabeli: String(item.hpp || 0),
      hargabeli_exppn: String((item.hpp || 0) * 100 / (data.ppn + 100)),
      price_list: String(item.hpp || 0),
    }));
    setItemDetails([...itemDetails, ...newItems]);
    setShowBarangModal(false);
  };

  const handleTambahBarangDone = (newBarang: NewBarangData) => {
    const newItem: ItemDetail = {
      id: String(newBarang.id),
      nama: newBarang.nama,
      merk: newBarang.merk,
      kategori: newBarang.kategori,
      qty: 0,
      qty_print: '0',
      hargabeli: '0',
      hargabeli_exppn: '0',
      price_list: '0',
    };
    setItemDetails([...itemDetails, newItem]);
    setShowTambahBarangModal(false);
  };

  const handleEditItem = (index: number) => {
    setEditingItem(itemDetails[index]);
    setEditingItemIndex(index);
    setShowEditItemModal(true);
  };

  const handleSaveEditItem = (item: ItemDetail) => {
    const newItems = [...itemDetails];
    newItems[editingItemIndex] = item;
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

  const handleSyncStock = async () => {
    try {
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const payload = itemDetails.map((item) => ({ id_barang: parseInt(item.id) }));

      const res = await fetch(`${API_BASE_URL}/ecommerce/sync/stock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status) {
        Alert.alert('Sukses', 'Stock berhasil disinkronkan ke marketplace');
      } else {
        Alert.alert('Error', 'Failed to sync stock');
      }
    } catch (error) {
      console.error('Sync stock error:', error);
      Alert.alert('Error', 'Failed to sync stock');
    }
  };

  const handlePrintBarcode = async () => {
    try {
      // Import react-native-print
      const Print = require('react-native-print');

      // Generate HTML for barcode printing
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { margin: 0; padding: 10mm; font-family: Arial, sans-serif; }
            .label {
              width: 37mm;
              height: 20mm;
              border: 1px solid #000;
              display: inline-block;
              margin: 2mm;
              padding: 2mm;
              text-align: center;
              vertical-align: top;
              page-break-inside: avoid;
            }
            .barcode { font-size: 24px; font-weight: bold; margin: 2mm 0; }
            .product-name { font-size: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
      `;

      itemDetails.forEach((item) => {
        const qtyPrint = parseInt(item.qty_print) || 0;
        const productName = `${item.merk} ${item.kategori} ${item.nama}`.trim().substring(0, 70);

        for (let i = 0; i < qtyPrint; i++) {
          html += `
            <div class="label">
              <div class="barcode">${item.id}</div>
              <div class="product-name">${productName}</div>
            </div>
          `;
        }
      });

      html += `
        </body>
        </html>
      `;

      await Print.print({ html });
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Failed to print barcodes');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const barang = itemDetails.map((item) => ({
        id: item.id,
        nama: item.nama,
        qty: item.qty,
        harga_beli: data.useppn
          ? parseFloat(item.hargabeli_exppn) * (1 + data.ppn / 100)
          : parseFloat(item.hargabeli),
        kodeBA: '51.1',
        harga_beli_exppn: item.hargabeli_exppn,
        price_list: item.price_list,
      }));

      const payload = {
        ID: data.id,
        tanggal: data.tanggal.replace('T', ' '),
        id_supplier: data.id_supplier,
        keterangan: data.keterangan,
        barang,
        warehouse_id: selectedWarehouse || null,
        useppn: data.useppn,
        ppn: data.ppn,
        biaya_tambahan: parseFloat(data.biaya_tambahan) || 0,
        tanggal_invoice: data.tanggal_invoice?.replace('T', ' '),
        bayarKontan: parseFloat(data.bayarKontan),
        kodeBAbayar: parseFloat(data.bayarKontan) === 0 ? null : data.kodeBA,
      };

      const res = await fetch(`${API_BASE_URL}/rincianpembelian`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.status) {
        Alert.alert('Sukses', 'Data berhasil disimpan', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.reason || 'Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save data');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('id-ID');
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('id-ID', options);
  };

  const calculateItemTotal = (): number => {
    return itemDetails.reduce((total, item) => {
      const price = parseFloat(item.hargabeli || '0');
      return total + price * item.qty;
    }, 0);
  };

  const calculatePaymentTotal = (): number => {
    return paymentDetails.reduce((total, item) => {
      return total + parseFloat(item.saldo || '0');
    }, 0);
  };

  const isSaveDisabled = (): boolean => {
    const itemTotal = calculateItemTotal();
    const paymentTotal = calculatePaymentTotal();
    return saving || itemTotal < paymentTotal || itemDetails.length === 0;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Rincian Pembelian</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container}>
      {/* Header Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informasi Pembelian</Text>

        {/* ID */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ID Pembelian:</Text>
          <Text style={styles.infoValue}>#{data.id}</Text>
        </View>

        {/* Tanggal */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tanggal:</Text>
          <Text style={styles.infoValue}>{formatDate(data.tanggal)}</Text>
        </View>

        {/* Tanggal Invoice - Editable */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Tanggal Invoice</Text>
          <TextInput
            style={styles.input}
            value={data.tanggal_invoice}
            onChangeText={(val) => setData({ ...data, tanggal_invoice: val })}
            placeholder="YYYY-MM-DDTHH:mm"
          />
        </View>

        {/* ID Supplier - Editable with Modal */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>ID Supplier</Text>
          <View style={styles.inputWithButton}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={String(data.id_supplier)}
              editable={false}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setShowSupplierModal(true)}
            >
              <Ionicons name="search" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Keterangan - Editable */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Keterangan</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={data.keterangan}
            onChangeText={(val) => setData({ ...data, keterangan: val })}
            placeholder="Keterangan"
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Biaya Tambahan - Editable */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Biaya Tambahan</Text>
          <TextInput
            style={styles.input}
            value={data.biaya_tambahan}
            onChangeText={(val) => {
              if (/^\d*\.?\d*$/.test(val)) {
                setData({ ...data, biaya_tambahan: val });
              }
            }}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>

        {/* Bayar Kontan - Editable */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Bayar Kontan</Text>
          <TextInput
            style={styles.input}
            value={data.bayarKontan}
            onChangeText={(val) => {
              if (/^\d*\.?\d*$/.test(val)) {
                setData({ ...data, bayarKontan: val });
              }
            }}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>

        {/* Kode BA - Editable with Modal */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Kode BA</Text>
          <View style={styles.inputWithButton}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={data.kodeBA}
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

        {/* Warehouse */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Warehouse:</Text>
          <Text style={styles.infoValue}>
            {warehouses.find((w) => w.id === selectedWarehouse)?.name || 'Main Stock'}
          </Text>
        </View>

        {/* PPN */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>PPN:</Text>
          <Text style={styles.infoValue}>
            {data.useppn ? `${data.ppn}%` : 'Tidak menggunakan PPN'}
          </Text>
        </View>
      </View>

      {/* Item Details Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.cardHeaderLeft}
            onPress={() => setItemDetailsExpanded(!itemDetailsExpanded)}
          >
            <Text style={styles.cardTitle}>Rincian Barang ({itemDetails.length})</Text>
            <Ionicons
              name={itemDetailsExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#6b7280"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.syncButton} onPress={handleSyncStock}>
            <Ionicons name="sync" size={20} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {itemDetailsExpanded && (
          <>
            {itemDetails.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemHeaderLeft}>
                    <Text style={styles.itemName}>{item.nama}</Text>
                    <Text style={styles.itemId}>#{item.id}</Text>
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

                {item.merk && (
                  <Text style={styles.itemMerk}>{item.merk}</Text>
                )}
                {item.kategori && (
                  <Text style={styles.itemKategori}>{item.kategori}</Text>
                )}

                <View style={styles.itemDetails}>
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>Qty:</Text>
                    <Text style={styles.itemDetailValue}>{item.qty}</Text>
                  </View>
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>Qty Print:</Text>
                    <Text style={styles.itemDetailValue}>{item.qty_print}</Text>
                  </View>
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>
                      {data.useppn ? 'DPP:' : 'Price List:'}
                    </Text>
                    <Text style={styles.itemDetailValue}>
                      Rp {formatCurrency(data.useppn ? item.hargabeli_exppn : item.price_list)}
                    </Text>
                  </View>
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.itemDetailLabel}>Harga Beli:</Text>
                    <Text style={[styles.itemDetailValue, styles.itemSubtotal]}>
                      Rp {formatCurrency(item.hargabeli)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Add Item Buttons */}
            <View style={styles.addItemButtons}>
              <TouchableOpacity
                style={[styles.addButton, styles.addButtonPrimary]}
                onPress={() => setShowBarangModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addButtonTextPrimary}>Master Barang</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, styles.addButtonSecondary]}
                onPress={() => setShowTambahBarangModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addButtonTextSecondary}>Barang Baru</Text>
              </TouchableOpacity>
            </View>

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>Rp {formatCurrency(calculateItemTotal())}</Text>
            </View>
          </>
        )}
      </View>

      {/* Payment Details Card */}
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
                    <Text style={styles.paymentId}>{payment.id}</Text>
                    <Text style={styles.paymentDate}>{formatDate(payment.tanggal)}</Text>
                  </View>
                  {payment.keterangan && (
                    <Text style={styles.paymentKeterangan}>{payment.keterangan}</Text>
                  )}
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Bayar:</Text>
                    <Text style={styles.paymentDetailValue}>
                      Rp {formatCurrency(payment.saldo)}
                    </Text>
                  </View>
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Kode BA:</Text>
                    <Text style={styles.paymentDetailValue}>{payment.kodeBA}</Text>
                  </View>
                </View>
              ))}

              {/* Total Payment */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Bayar:</Text>
                <Text style={styles.totalValue}>Rp {formatCurrency(calculatePaymentTotal())}</Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ringkasan</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Pembelian:</Text>
          <Text style={styles.summaryValue}>Rp {formatCurrency(calculateItemTotal())}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Bayar:</Text>
          <Text style={styles.summaryValue}>
            Rp {formatCurrency(calculatePaymentTotal())}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelBold}>Sisa:</Text>
          <Text style={[
            styles.summaryValueBold,
            (calculateItemTotal() - calculatePaymentTotal()) > 0 ? styles.sisaPositive : styles.sisaZero
          ]}>
            Rp {formatCurrency(calculateItemTotal() - calculatePaymentTotal())}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.printButton]}
          onPress={handlePrintBarcode}
        >
          <Ionicons name="print-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Print Barcode</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.saveButton,
            isSaveDisabled() && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaveDisabled()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Simpan</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>

    {/* Modals */}
    <SearchSupplierModal
      visible={showSupplierModal}
      onClose={() => setShowSupplierModal(false)}
      onSelect={handleSupplierSelect}
    />
    <SearchBaganAkunModal
      visible={showBaganAkunModal}
      onClose={() => setShowBaganAkunModal(false)}
      onSelect={handleBaganAkunSelect}
      shows={['111']}
    />
    <SearchBarangModal
      visible={showBarangModal}
      onClose={() => setShowBarangModal(false)}
      onSelect={handleBarangSelect}
      multiSelect={true}
      excludeIds={itemDetails.map((item) => parseInt(item.id))}
    />
    <TambahBarangModal
      visible={showTambahBarangModal}
      onClose={() => setShowTambahBarangModal(false)}
      onDone={handleTambahBarangDone}
    />
    <EditItemModal
      visible={showEditItemModal}
      onClose={() => setShowEditItemModal(false)}
      onSave={handleSaveEditItem}
      item={editingItem}
      usePPN={data.useppn}
      ppnRate={data.ppn}
    />
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
    fontSize: 14,
    color: '#6b7280',
  },
  // Card styles (matching PenjualanRincianScreen)
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  syncButton: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  // Info row styles (read-only display)
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
  // Item card styles (matching PenjualanRincianScreen)
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
  itemId: {
    fontSize: 12,
    color: '#9ca3af',
  },
  itemMerk: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  itemKategori: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
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
  // Add item buttons
  addItemButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonPrimary: {
    backgroundColor: '#dc2626',
  },
  addButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  addButtonSecondary: {
    backgroundColor: '#3b82f6',
  },
  addButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Total row
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
  // Payment card styles (matching PenjualanRincianScreen)
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
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
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
  // Summary styles (matching PenjualanRincianScreen)
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
  // Action buttons container
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  printButton: {
    backgroundColor: '#3b82f6',
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacer: {
    height: 24,
  },
});
