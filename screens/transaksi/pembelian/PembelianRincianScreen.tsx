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
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
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
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Pembelian</Text>

          {/* ID */}
          <View style={styles.formRow}>
            <Text style={styles.label}>ID</Text>
            <Text style={styles.valueText}>#{data.id}</Text>
          </View>

          {/* Tanggal */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Tanggal</Text>
            <Text style={styles.valueText}>{formatDate(data.tanggal)}</Text>
          </View>

          {/* Tanggal Invoice */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Tanggal Invoice</Text>
            <TextInput
              style={styles.input}
              value={data.tanggal_invoice}
              onChangeText={(val) => setData({ ...data, tanggal_invoice: val })}
              placeholder="YYYY-MM-DDTHH:mm"
            />
          </View>

          {/* ID Supplier */}
          <View style={styles.formRow}>
            <Text style={styles.label}>ID Supplier</Text>
            <View style={styles.inputWithButton}>
              <TextInput
                style={[styles.input, styles.inputSmall]}
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

          {/* Keterangan */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Keterangan</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={data.keterangan}
              onChangeText={(val) => setData({ ...data, keterangan: val })}
              placeholder="Keterangan"
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Biaya Tambahan */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Biaya Tambahan</Text>
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

          {/* Bayar Kontan */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Bayar Kontan</Text>
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

          {/* Kode BA */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Kode BA</Text>
            <View style={styles.inputWithButton}>
              <TextInput
                style={[styles.input, styles.inputSmall]}
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
          <View style={styles.formRow}>
            <Text style={styles.label}>Warehouse</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>
                {warehouses.find((w) => w.id === selectedWarehouse)?.name || 'Main Stock (Default)'}
              </Text>
            </View>
          </View>

          {/* PPN */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Show PPN</Text>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, data.useppn && styles.checkboxChecked]}
                disabled
              >
                {data.useppn && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                {data.useppn ? `PPN ${data.ppn}%` : 'Tidak menggunakan PPN'}
              </Text>
            </View>
          </View>
        </View>

        {/* Item Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              style={styles.sectionHeaderLeft}
              onPress={() => setItemDetailsExpanded(!itemDetailsExpanded)}
            >
              <Text style={styles.sectionTitle}>Rincian Barang</Text>
              <Ionicons
                name={itemDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.syncButton} onPress={handleSyncStock}>
              <Ionicons name="sync" size={18} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {itemDetailsExpanded && (
            <>
              {itemDetails.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemId}>#{item.id}</Text>
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.itemActionButton}
                        onPress={() => handleEditItem(index)}
                      >
                        <Ionicons name="create-outline" size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.itemActionButton}
                        onPress={() => handleDeleteItem(index)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.itemName}>{item.nama}</Text>

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
                      <Text style={[styles.itemDetailValue, styles.itemDetailValueBold]}>
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
                  <Ionicons name="add-circle-outline" size={20} color="#DC2626" />
                  <Text style={styles.addButtonTextPrimary}>Master Barang</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, styles.addButtonSecondary]}
                  onPress={() => setShowTambahBarangModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
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

        {/* Payment Details Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeaderLeft}
            onPress={() => setPaymentDetailsExpanded(!paymentDetailsExpanded)}
          >
            <Text style={styles.sectionTitle}>Rincian Pembayaran</Text>
            <Ionicons
              name={paymentDetailsExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {paymentDetailsExpanded && (
            <>
              {paymentDetails.length === 0 ? (
                <View style={styles.emptyPayment}>
                  <Text style={styles.emptyPaymentText}>Belum ada pembayaran</Text>
                </View>
              ) : (
                <>
                  {paymentDetails.map((payment, index) => (
                    <View key={index} style={styles.paymentCard}>
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>ID:</Text>
                        <Text style={styles.paymentValue}>{payment.id}</Text>
                      </View>
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Tanggal:</Text>
                        <Text style={styles.paymentValue}>{formatDate(payment.tanggal)}</Text>
                      </View>
                      {payment.keterangan && (
                        <View style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>Keterangan:</Text>
                          <Text style={styles.paymentValue}>{payment.keterangan}</Text>
                        </View>
                      )}
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Bayar:</Text>
                        <Text style={[styles.paymentValue, styles.paymentValueBold]}>
                          Rp {formatCurrency(payment.saldo)}
                        </Text>
                      </View>
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Kode BA:</Text>
                        <Text style={styles.paymentValue}>{payment.kodeBA}</Text>
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
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.actionButton, styles.printButton]}
          onPress={handlePrintBarcode}
        >
          <Ionicons name="print-outline" size={20} color="white" />
          <Text style={styles.actionButtonText}>Print</Text>
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
          <Ionicons name="checkmark-circle-outline" size={20} color="white" />
          <Text style={styles.actionButtonText}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Text>
        </TouchableOpacity>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
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
  section: {
    backgroundColor: 'white',
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButton: {
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  formRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  valueText: {
    fontSize: 15,
    color: '#111827',
    paddingVertical: 8,
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
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
  },
  inputSmall: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  pickerText: {
    fontSize: 15,
    color: '#6B7280',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemActionButton: {
    padding: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  itemDetails: {
    gap: 4,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  itemDetailValue: {
    fontSize: 13,
    color: '#111827',
  },
  itemDetailValueBold: {
    fontWeight: '700',
  },
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
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
  },
  addButtonPrimary: {
    backgroundColor: '#FEE2E2',
  },
  addButtonTextPrimary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  addButtonSecondary: {
    backgroundColor: '#EFF6FF',
  },
  addButtonTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  paymentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paymentLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: 13,
    color: '#111827',
  },
  paymentValueBold: {
    fontWeight: '700',
    color: '#059669',
  },
  emptyPayment: {
    padding: 20,
    alignItems: 'center',
  },
  emptyPaymentText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
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
    backgroundColor: '#3B82F6',
  },
  saveButton: {
    backgroundColor: '#059669',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
