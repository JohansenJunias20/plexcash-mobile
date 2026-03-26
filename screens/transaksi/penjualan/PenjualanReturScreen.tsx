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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import ApiService from '../../../services/api';
import ReturPenjualanPINModal from '../../../components/ReturPenjualanPINModal';
import IntervalDatePicker from '../../../components/pembelian/IntervalDatePicker';

// Interfaces
interface PenjualanItem {
  id: number;
  tanggal: string;
  id_customer: number;
  customer: string;
  keterangan: string;
  total: string;
  bayar: string;
  // Item preview fields
  firstItemName?: string;
  firstItemQty?: number;
  itemCount?: number;
}

interface DetailItem {
  id: number;
  id_barang: number;
  nama: string;
  merk?: string;
  qty: number;
  hargajual: number;
  satuan?: string;
  alreadyReturned: number;
  qtyToReturn: number;
}

interface UserPinStatus {
  requires_pin: boolean;
  has_pin: boolean;
}

export default function PenjualanReturScreen() {
  const navigation = useNavigation();

  // Step state: 'search' | 'select' | 'confirm'
  const [step, setStep] = useState<'search' | 'select' | 'confirm'>('search');

  // Search state
  const [showIntervalPicker, setShowIntervalPicker] = useState(true);
  const [intervalDate, setIntervalDate] = useState({ start: '', end: '' });
  const [penjualanList, setPenjualanList] = useState<PenjualanItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  // Selected penjualan state
  const [selectedPenjualan, setSelectedPenjualan] = useState<PenjualanItem | null>(null);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Return form state
  const [tanggalRetur, setTanggalRetur] = useState(moment().format('YYYY-MM-DD'));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [keterangan, setKeterangan] = useState('');

  // PIN state
  const [showPinModal, setShowPinModal] = useState(false);
  const [userPinStatus, setUserPinStatus] = useState<UserPinStatus>({ requires_pin: false, has_pin: false });
  const [validatedPin, setValidatedPin] = useState<string>('');

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  // Check if user requires PIN for retur penjualan
  useEffect(() => {
    checkUserPinRequirement();
  }, []);

  const checkUserPinRequirement = async () => {
    try {
      const result = await ApiService.validateReturPenjualanPIN('');
      // If status is true, user doesn't require PIN or PIN was validated (empty PIN check)
      // If status is false with reason "PIN diperlukan...", user requires PIN
      if (result.reason?.includes('PIN diperlukan') || result.reason?.includes('PIN tidak valid')) {
        setUserPinStatus({ requires_pin: true, has_pin: true });
      } else if (result.reason?.includes('PIN belum diatur')) {
        setUserPinStatus({ requires_pin: true, has_pin: false });
      } else if (result.status || result.message?.includes('PIN not required')) {
        setUserPinStatus({ requires_pin: false, has_pin: false });
      }
    } catch (error) {
      console.error('Error checking PIN requirement:', error);
    }
  };

  // Load penjualan list
  const loadPenjualanList = async (start: string, end: string) => {
    try {
      setLoadingList(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      // Fetch penjualan with customer join
      const penjualanResponse = await fetch(
        `${API_BASE_URL}/get/penjualan/join/customer/interval/${start}/${end}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `authorization=${token}`,
          },
          credentials: 'include',
        }
      );

      const penjualanResult = await penjualanResponse.json();

      if (!penjualanResult.status) {
        Alert.alert('Error', penjualanResult.reason || 'Gagal memuat data penjualan');
        return;
      }

      const penjualanData = penjualanResult.data || [];

      // Create detail map for item previews
      let detailMap: { [id: number]: { nama: string; qty: number }[] } = {};

      // Only fetch details if we have penjualan data
      if (penjualanData.length > 0) {
        const penjualanIds = penjualanData.map((item: any) => item.id);

        // Fetch detail items using POST with array of IDs
        const detailResponse = await fetch(
          `${API_BASE_URL}/get/detailpenjualan/join/masterbarang`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `authorization=${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({ id_penjualan: penjualanIds }),
          }
        );

        const detailResult = await detailResponse.json();

        if (detailResult.status && detailResult.data) {
          detailResult.data.forEach((detail: any) => {
            const penjualanId = detail.id_penjualan;
            if (!detailMap[penjualanId]) {
              detailMap[penjualanId] = [];
            }
            detailMap[penjualanId].push({
              nama: detail.nama || 'Unknown',
              qty: detail.qty || 0,
            });
          });
        }
      }

      // Map and sort penjualan data (most recent first)
      const mappedData: PenjualanItem[] = penjualanData
        .map((item: any) => {
          const details = detailMap[item.id] || [];
          const firstItem = details[0];

          return {
            id: item.id,
            tanggal: item.tanggal?.replace(' ', 'T') || '',
            id_customer: item.id_customer,
            // API returns nama_customer from JOIN
            customer: item.nama_customer || 'TUNAI',
            keterangan: item.keterangan || '',
            total: item.total || '0',
            bayar: item.bayar || '0',
            // Item preview data
            firstItemName: firstItem?.nama,
            firstItemQty: firstItem?.qty,
            itemCount: details.length,
          };
        })
        // Sort by date descending (most recent first)
        .sort((a: PenjualanItem, b: PenjualanItem) => {
          return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
        });

      setPenjualanList(mappedData);
    } catch (error) {
      console.error('Error loading penjualan:', error);
      Alert.alert('Error', 'Gagal memuat data penjualan');
    } finally {
      setLoadingList(false);
    }
  };

  // Load detail penjualan and existing returns
  const loadDetailPenjualan = async (penjualan: PenjualanItem) => {
    try {
      setLoadingDetail(true);
      setSelectedPenjualan(penjualan);

      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      // Fetch detail penjualan
      const detailRes = await fetch(
        `${API_BASE_URL}/get/detailpenjualan/join/masterbarang/${penjualan.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `authorization=${token}`,
          },
          credentials: 'include',
        }
      );

      const detailResult = await detailRes.json();

      // Fetch existing returns for this penjualan
      const returRes = await fetch(
        `${API_BASE_URL}/get/detailreturpenjualan/join/returpenjualan/${penjualan.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `authorization=${token}`,
          },
          credentials: 'include',
        }
      );

      const returResult = await returRes.json();



      if (detailResult.status) {
        // Create a map of already returned quantities
        const returnedQtyMap: { [id_barang: number]: number } = {};
        if (returResult.status && returResult.data) {
          returResult.data.forEach((retur: { id_barang: number; qty_retur: number }) => {
            returnedQtyMap[retur.id_barang] = (returnedQtyMap[retur.id_barang] || 0) + retur.qty_retur;
          });
        }

        // Map detail items with already returned quantities
        // API returns: id_detailpenjualan (from detailpenjualan), id (from masterbarang = id_barang)
        const items: DetailItem[] = (detailResult.data || []).map((item: any) => {
          // The masterbarang.id is returned as 'id' from the JOIN query
          const productId = item.id;
          return {
            id: item.id_detailpenjualan, // detailpenjualan ID
            id_barang: productId, // masterbarang.id (product ID)
            nama: item.nama || 'Unknown',
            merk: item.merk,
            qty: item.qty,
            hargajual: parseFloat(item.harga_jual) || 0,
            satuan: item.satuan,
            alreadyReturned: returnedQtyMap[productId] || 0,
            qtyToReturn: 0,
          };
        });

        setDetailItems(items);
        setStep('select');
      } else {
        Alert.alert('Error', detailResult.reason || 'Gagal memuat detail penjualan');
      }
    } catch (error) {
      console.error('Error loading detail:', error);
      Alert.alert('Error', 'Gagal memuat detail penjualan');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Update qty to return for an item
  const updateQtyToReturn = (index: number, qty: number) => {
    setDetailItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      const maxReturnable = item.qty - item.alreadyReturned;
      updated[index] = {
        ...item,
        qtyToReturn: Math.max(0, Math.min(qty, maxReturnable)),
      };
      return updated;
    });
  };

  // Calculate total return amount
  const calculateTotal = () => {
    return detailItems.reduce((total, item) => {
      return total + (item.qtyToReturn * item.hargajual);
    }, 0);
  };

  // Get items selected for return
  const getSelectedItems = () => {
    return detailItems.filter(item => item.qtyToReturn > 0);
  };

  // Handle PIN validation success
  const handlePinValidated = (pin: string) => {
    setValidatedPin(pin);
    setShowPinModal(false);
    // Proceed to confirmation step
    setStep('confirm');
  };

  // Proceed to confirm step
  const proceedToConfirm = () => {
    const selected = getSelectedItems();
    if (selected.length === 0) {
      Alert.alert('Peringatan', 'Pilih minimal satu barang untuk diretur');
      return;
    }

    // Check if user requires PIN
    if (userPinStatus.requires_pin && !validatedPin) {
      if (!userPinStatus.has_pin) {
        Alert.alert('PIN Belum Diatur', 'Silakan hubungi admin untuk mengatur PIN retur penjualan.');
        return;
      }
      setShowPinModal(true);
      return;
    }

    setStep('confirm');
  };

  // Submit retur
  const submitRetur = async (pin?: string) => {
    try {
      setSubmitting(true);

      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const selectedItems = getSelectedItems();
      const items = selectedItems.map(item => ({
        id: item.id_barang,
        qty: item.qtyToReturn,
        harga_jual: item.hargajual,
      }));

      const body: any = {
        id_penjualan: selectedPenjualan?.id,
        tanggal: tanggalRetur,
        keterangan: keterangan || `Retur dari penjualan #${selectedPenjualan?.id}`,
        items: items,
      };

      // Include PIN if required
      if (pin) {
        body.pin = pin;
      }

      const response = await fetch(`${API_BASE_URL}/returpenjualan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `authorization=${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.status) {
        Alert.alert(
          'Berhasil',
          `Retur penjualan berhasil dibuat dengan ID: ${result.id}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to search screen
                (navigation as any).navigate('PenjualanSearch');
              },
            },
          ]
        );
      } else {
        // Safely get error reason as string
        const errorReason = typeof result.reason === 'string'
          ? result.reason
          : (result.reason?.message || JSON.stringify(result.reason) || 'Gagal membuat retur penjualan');

        // Check if PIN is required
        if (errorReason.includes('PIN diperlukan') || errorReason.includes('PIN tidak valid')) {
          setShowPinModal(true);
        } else {
          Alert.alert('Error', errorReason);
        }
      }
    } catch (error) {
      console.error('Error submitting retur:', error);
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat retur penjualan';
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle interval date selection
  const handleIntervalSelect = (start: string, end: string) => {
    setIntervalDate({ start, end });
    setShowIntervalPicker(false);
    loadPenjualanList(start, end);
  };

  // Filter penjualan list
  const filteredPenjualan = penjualanList.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.customer?.toLowerCase().includes(query) ||
      item.keterangan?.toLowerCase().includes(query) ||
      item.id.toString().includes(query)
    );
  });

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date (without time)
  const formatDate = (dateStr: string) => {
    return moment(dateStr).format('DD MMM YYYY');
  };

  // Format date with time
  const formatDateTime = (dateStr: string) => {
    return moment(dateStr).format('DD MMM YYYY HH:mm');
  };

  // Handle back button
  const handleBack = () => {
    if (step === 'confirm') {
      setStep('select');
    } else if (step === 'select') {
      setStep('search');
      setSelectedPenjualan(null);
      setDetailItems([]);
    } else {
      (navigation as any).navigate('PenjualanSearch');
    }
  };

  // Render search step
  const renderSearchStep = () => (
    <View style={styles.stepContainer}>
      <IntervalDatePicker
        visible={showIntervalPicker}
        onOK={(start, end) => {
          handleIntervalSelect(start, end);
        }}
      />
      {!showIntervalPicker && (
        <>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowIntervalPicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.dateButtonText}>
                {intervalDate.start && intervalDate.end
                  ? `${formatDate(intervalDate.start)} - ${formatDate(intervalDate.end)}`
                  : 'Pilih Periode'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari penjualan..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loadingList ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Memuat data...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredPenjualan}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.penjualanCard}
                  onPress={() => loadDetailPenjualan(item)}
                  disabled={loadingDetail}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardId}>#{item.id}</Text>
                    <Text style={styles.cardDate}>{formatDateTime(item.tanggal)}</Text>
                  </View>
                  <Text style={styles.cardCustomer}>{item.customer}</Text>

                  {/* Item preview */}
                  {item.firstItemName && (
                    <View style={styles.itemPreview}>
                      <Ionicons name="cube-outline" size={14} color="#666" />
                      <Text style={styles.itemPreviewText} numberOfLines={1}>
                        {item.firstItemQty}x {item.firstItemName}
                        {(item.itemCount || 0) > 1 && (
                          <Text style={styles.itemPreviewMore}>
                            {` +${(item.itemCount || 1) - 1} item lainnya`}
                          </Text>
                        )}
                      </Text>
                    </View>
                  )}

                  {item.keterangan ? (
                    <Text style={styles.cardKeterangan} numberOfLines={1}>
                      {item.keterangan}
                    </Text>
                  ) : null}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardTotal}>{formatCurrency(parseFloat(item.total))}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>Tidak ada data penjualan</Text>
                </View>
              }
            />
          )}
        </>
      )}
    </View>
  );


  // Render select items step
  const renderSelectStep = () => (
    <View style={styles.stepContainer}>
      {/* Selected penjualan info */}
      {selectedPenjualan && (
        <View style={styles.selectedInfo}>
          <View style={styles.selectedInfoRow}>
            <Text style={styles.selectedInfoLabel}>Penjualan:</Text>
            <Text style={styles.selectedInfoValue}>#{selectedPenjualan.id}</Text>
          </View>
          <View style={styles.selectedInfoRow}>
            <Text style={styles.selectedInfoLabel}>Customer:</Text>
            <Text style={styles.selectedInfoValue}>{selectedPenjualan.customer}</Text>
          </View>
          <View style={styles.selectedInfoRow}>
            <Text style={styles.selectedInfoLabel}>Tanggal:</Text>
            <Text style={styles.selectedInfoValue}>{formatDate(selectedPenjualan.tanggal)}</Text>
          </View>
        </View>
      )}

      {/* Return date */}
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>Tanggal Retur:</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Text>{formatDate(tanggalRetur)}</Text>
          <Ionicons name="calendar-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(tanggalRetur)}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setTanggalRetur(moment(selectedDate).format('YYYY-MM-DD'));
            }
          }}
        />
      )}

      {/* Notes */}
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>Keterangan:</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Alasan retur..."
          value={keterangan}
          onChangeText={setKeterangan}
          multiline
        />
      </View>

      {/* Items list */}
      <Text style={styles.sectionTitle}>Pilih Barang untuk Diretur:</Text>

      <FlatList
        data={detailItems}
        keyExtractor={(item, index) => `${item.id_barang}-${index}`}
        renderItem={({ item, index }) => {
          const maxReturnable = item.qty - item.alreadyReturned;
          const isFullyReturned = maxReturnable <= 0;

          return (
            <View style={[styles.itemCard, isFullyReturned && styles.itemCardDisabled]}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.nama}</Text>
                {item.merk && <Text style={styles.itemMerk}>{item.merk}</Text>}
                <Text style={styles.itemPrice}>{formatCurrency(item.hargajual)}</Text>
                <Text style={styles.itemStock}>
                  Qty Penjualan: {item.qty} | Sudah Diretur: {item.alreadyReturned}
                </Text>
                {isFullyReturned && (
                  <Text style={styles.fullyReturnedText}>Sudah diretur semua</Text>
                )}
              </View>

              {!isFullyReturned && (
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateQtyToReturn(index, item.qtyToReturn - 1)}
                    disabled={item.qtyToReturn <= 0}
                  >
                    <Ionicons name="remove" size={20} color={item.qtyToReturn <= 0 ? '#ccc' : '#007AFF'} />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.qtyInput}
                    value={item.qtyToReturn.toString()}
                    onChangeText={(text) => {
                      const qty = parseInt(text) || 0;
                      updateQtyToReturn(index, qty);
                    }}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />

                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateQtyToReturn(index, item.qtyToReturn + 1)}
                    disabled={item.qtyToReturn >= maxReturnable}
                  >
                    <Ionicons name="add" size={20} color={item.qtyToReturn >= maxReturnable ? '#ccc' : '#007AFF'} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.maxButton}
                    onPress={() => updateQtyToReturn(index, maxReturnable)}
                  >
                    <Text style={styles.maxButtonText}>Max</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Tidak ada item</Text>
          </View>
        }
      />

      {/* Total and submit button */}
      <View style={styles.bottomBar}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Retur:</Text>
          <Text style={styles.totalValue}>{formatCurrency(calculateTotal())}</Text>
        </View>
        <TouchableOpacity
          style={[styles.submitButton, getSelectedItems().length === 0 && styles.submitButtonDisabled]}
          onPress={proceedToConfirm}
          disabled={getSelectedItems().length === 0}
        >
          <Text style={styles.submitButtonText}>Lanjutkan</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render confirm step
  const renderConfirmStep = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.sectionTitle}>Konfirmasi Retur Penjualan</Text>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Penjualan:</Text>
          <Text style={styles.summaryValue}>#{selectedPenjualan?.id}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Customer:</Text>
          <Text style={styles.summaryValue}>{selectedPenjualan?.customer}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tanggal Retur:</Text>
          <Text style={styles.summaryValue}>{formatDate(tanggalRetur)}</Text>
        </View>
        {keterangan && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Keterangan:</Text>
            <Text style={styles.summaryValue}>{keterangan}</Text>
          </View>
        )}
      </View>

      {/* Items to return */}
      <Text style={styles.sectionTitle}>Barang yang Diretur:</Text>
      {getSelectedItems().map((item, index) => (
        <View key={`confirm-${item.id_barang}-${index}`} style={styles.confirmItemCard}>
          <Text style={styles.itemName}>{item.nama}</Text>
          <View style={styles.confirmItemRow}>
            <Text style={styles.confirmItemQty}>Qty: {item.qtyToReturn}</Text>
            <Text style={styles.confirmItemPrice}>
              @ {formatCurrency(item.hargajual)}
            </Text>
            <Text style={styles.confirmItemSubtotal}>
              = {formatCurrency(item.qtyToReturn * item.hargajual)}
            </Text>
          </View>
        </View>
      ))}

      {/* Total */}
      <View style={styles.totalCard}>
        <Text style={styles.totalCardLabel}>Total Retur:</Text>
        <Text style={styles.totalCardValue}>{formatCurrency(calculateTotal())}</Text>
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
        onPress={() => submitRetur(validatedPin || undefined)}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.confirmButtonText}>Proses Retur</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'search' && 'Pilih Penjualan'}
          {step === 'select' && 'Pilih Barang Retur'}
          {step === 'confirm' && 'Konfirmasi Retur'}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          style={styles.headerButton}
        >
          <Ionicons name="menu" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, step === 'search' && styles.stepDotActive]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, step === 'select' && styles.stepDotActive]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
      </View>

      {/* Content */}
      {step === 'search' && renderSearchStep()}
      {step === 'select' && renderSelectStep()}
      {step === 'confirm' && renderConfirmStep()}

      {/* Loading overlay */}
      {loadingDetail && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat detail...</Text>
        </View>
      )}

      {/* PIN Modal */}
      <ReturPenjualanPINModal
        visible={showPinModal}
        onCancel={() => setShowPinModal(false)}
        onSuccess={handlePinValidated}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  stepDotActive: {
    backgroundColor: '#007AFF',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#ccc',
    marginHorizontal: 8,
  },
  stepContainer: {
    flex: 1,
    padding: 16,
  },
  filterRow: {
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  penjualanCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  cardDate: {
    fontSize: 12,
    color: '#666',
  },
  cardCustomer: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 6,
    gap: 6,
  },
  itemPreviewText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
  },
  itemPreviewMore: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  cardKeterangan: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  selectedInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  selectedInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  selectedInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  formRow: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemCardDisabled: {
    opacity: 0.5,
  },
  itemInfo: {
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  itemMerk: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  itemStock: {
    fontSize: 12,
    color: '#888',
  },
  fullyReturnedText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 60,
    height: 36,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  maxButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  bottomBar: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 'auto',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flexShrink: 1,
    textAlign: 'right',
  },
  confirmItemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  confirmItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  confirmItemQty: {
    fontSize: 13,
    color: '#666',
  },
  confirmItemPrice: {
    fontSize: 13,
    color: '#666',
  },
  confirmItemSubtotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalCard: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  totalCardLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  totalCardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 32,
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});