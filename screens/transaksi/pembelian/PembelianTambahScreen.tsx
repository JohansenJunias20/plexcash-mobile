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
import { Ionicons } from '@expo/vector-icons';
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

  useEffect(() => {
    loadInitialData();
  }, []);

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
        if (filteredWarehouses.length > 0) {
          setSelectedWarehouse(filteredWarehouses[0].id);
        }
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

  const handleSupplierSelect = (supplier: SupplierItem) => {
    setIdSupplier(supplier.id);
    setSupplierName(supplier.nama);
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setKodeBaganAkun(item.kode);
    setBaganAkunName(item.nama);
  };

  const handleBarangSelect = (items: BarangItem[]) => {
    const newItems: ItemDetail[] = items.map(item => ({
      id: item.id,
      nama: item.nama,
      merk: item.merk || '',
      kategori: item.kategori || '',
      satuan: item.satuan || '',
      qty: '0',
      hargabeli: '',
      dpp: '',
      pricelist: item.hpp?.toString() || '0',
      qty_print: '0',
    }));

    setItemDetails([...itemDetails, ...newItems]);
  };

  const handleTambahBarangDone = (data: NewBarangData) => {
    const newItem: ItemDetail = {
      id: data.id,
      nama: data.nama,
      merk: data.merk,
      kategori: data.kategori,
      satuan: data.satuan,
      qty: '0',
      hargabeli: '',
      dpp: '',
      pricelist: '0',
      qty_print: '0',
    };

    setItemDetails([...itemDetails, newItem]);
  };

  const updateItemDetail = (index: number, field: keyof ItemDetail, value: string) => {
    const updated = [...itemDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate prices based on PPN mode
    if (field === 'hargabeli' || field === 'dpp') {
      if (isPkpActive) {
        if (ppnMode === 'include' && field === 'hargabeli') {
          // Calculate DPP from include price
          const includePrice = parseFloat(value || '0');
          const dpp = includePrice / (1 + ppnRate / 100);
          updated[index].dpp = dpp.toFixed(2);
        } else if (ppnMode === 'exclude' && field === 'dpp') {
          // Calculate include price from DPP
          const excludePrice = parseFloat(value || '0');
          const includePrice = excludePrice * (1 + ppnRate / 100);
          updated[index].hargabeli = includePrice.toFixed(2);
        }
      } else {
        // No PPN, both prices are the same
        if (field === 'hargabeli') {
          updated[index].dpp = value;
        } else {
          updated[index].hargabeli = value;
        }
      }
    }

    setItemDetails(updated);
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
            setItemDetails(updated);
          },
        },
      ]
    );
  };

  const calculateBaseTotal = (): number => {
    return itemDetails.reduce((total, item) => {
      const qty = parseInt(item.qty || '0');
      const dpp = parseFloat(item.dpp || '0');
      return total + (dpp * qty);
    }, 0);
  };

  const calculatePpnAmount = (): number => {
    if (!isPkpActive) return 0;
    const baseTotal = calculateBaseTotal();
    return baseTotal * (ppnRate / 100);
  };

  const calculateTotal = (): number => {
    const itemsTotal = itemDetails.reduce((total, item) => {
      const qty = parseInt(item.qty || '0');
      let includePrice: number;

      if (!isPkpActive) {
        includePrice = parseFloat(item.hargabeli || item.dpp || '0');
      } else {
        if (ppnMode === 'include') {
          includePrice = parseFloat(item.hargabeli || '0');
        } else {
          const excludePrice = parseFloat(item.dpp || '0');
          includePrice = excludePrice * (1 + ppnRate / 100);
        }
      }

      return total + (includePrice * qty);
    }, 0);

    const biaya = parseFloat(biayaTambahan || '0');
    return itemsTotal + biaya;
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

      const detailpembelian = itemDetails.map(item => ({
        id_barang: item.id,
        qty: parseInt(item.qty),
        hargabeli: parseFloat(item.hargabeli || item.dpp || '0'),
        dpp: parseFloat(item.dpp || '0'),
        qty_print: parseInt(item.qty_print || '0'),
      }));

      const payload = {
        data: {
          pembelian: {
            tanggal: new Date().toISOString(),
            tanggal_invoice: tanggalInvoice,
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
            warehouse_id: selectedWarehouse || null,
          },
          detailpembelian,
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
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tambah Pembelian</Text>
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
            <Text style={styles.label}>Bayar (Kontan)</Text>
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
              onChangeText={setBiayaTambahan}
              placeholder="0"
              keyboardType="numeric"
              editable={!saving}
            />
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
                  <Text style={[styles.tableHeaderCell, { width: 60 }]}>ID</Text>
                  <Text style={[styles.tableHeaderCell, { width: 150 }]}>Nama Barang</Text>
                  <Text style={[styles.tableHeaderCell, { width: 80 }]}>Qty</Text>
                  <Text style={[styles.tableHeaderCell, { width: 120 }]}>
                    {isPkpActive
                      ? ppnMode === 'exclude'
                        ? 'Harga (Exc PPN)'
                        : 'Harga (Inc PPN)'
                      : 'Harga Beli'}
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: 120 }]}>Sub Total</Text>
                  <Text style={[styles.tableHeaderCell, { width: 80 }]}>Qty Print</Text>
                  <Text style={[styles.tableHeaderCell, { width: 60 }]}>Aksi</Text>
                </View>

                {/* Table Rows */}
                {itemDetails.map((item, index) => {
                  const qty = parseInt(item.qty || '0');
                  const price = isPkpActive
                    ? ppnMode === 'exclude'
                      ? parseFloat(item.dpp || '0')
                      : parseFloat(item.hargabeli || '0')
                    : parseFloat(item.hargabeli || item.dpp || '0');
                  const subtotal = qty * price;

                  return (
                    <View key={index} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { width: 60 }]}>{item.id}</Text>
                      <View style={[styles.tableCell, { width: 150 }]}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.nama}
                        </Text>
                        {item.merk && (
                          <Text style={styles.itemMeta}>{item.merk}</Text>
                        )}
                      </View>
                      <View style={[styles.tableCell, { width: 80 }]}>
                        <TextInput
                          style={styles.tableCellInput}
                          value={item.qty}
                          onChangeText={(val) => updateItemDetail(index, 'qty', val)}
                          keyboardType="numeric"
                          editable={!saving}
                        />
                      </View>
                      <View style={[styles.tableCell, { width: 120 }]}>
                        <TextInput
                          style={styles.tableCellInput}
                          value={
                            isPkpActive
                              ? ppnMode === 'exclude'
                                ? item.dpp
                                : item.hargabeli
                              : item.hargabeli || item.dpp
                          }
                          onChangeText={(val) =>
                            updateItemDetail(
                              index,
                              isPkpActive
                                ? ppnMode === 'exclude'
                                  ? 'dpp'
                                  : 'hargabeli'
                                : 'hargabeli',
                              val
                            )
                          }
                          keyboardType="numeric"
                          editable={!saving}
                        />
                      </View>
                      <Text style={[styles.tableCell, { width: 120 }]}>
                        {subtotal.toLocaleString('id-ID')}
                      </Text>
                      <View style={[styles.tableCell, { width: 80 }]}>
                        <TextInput
                          style={styles.tableCellInput}
                          value={item.qty_print}
                          onChangeText={(val) => updateItemDetail(index, 'qty_print', val)}
                          keyboardType="numeric"
                          editable={!saving}
                        />
                      </View>
                      <View style={[styles.tableCell, { width: 60 }]}>
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
        {isPkpActive && itemDetails.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rincian PPN</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal (Exclude PPN)</Text>
              <Text style={styles.summaryValue}>
                Rp {baseTotal.toLocaleString('id-ID')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>PPN ({ppnRate}%)</Text>
              <Text style={styles.summaryValue}>
                Rp {ppnAmount.toLocaleString('id-ID')}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowTotal]}>
              <Text style={styles.summaryLabelTotal}>Total (Include PPN)</Text>
              <Text style={styles.summaryValueTotal}>
                Rp {grandTotal.toLocaleString('id-ID')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
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
});

