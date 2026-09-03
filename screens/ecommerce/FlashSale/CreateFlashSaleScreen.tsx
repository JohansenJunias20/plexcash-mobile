import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import {
  FlashSaleService,
  ITimeslot,
  IFlashSaleProductItem,
  formatEpochTime,
  formatDateTime,
  calculateDiscountPercent,
  calculateHppMargin,
  IShopeeRejection,
} from '../../../services/ecommerce/flashSaleService';
import ProductPickerModal from './components/ProductPickerModal';
import ShopeeRejectionModal from './components/ShopeeRejectionModal';

type CreateFlashSaleRouteParams = {
  CreateFlashSale: {
    id_ecommerce: number;
    shop_name?: string;
  };
};

export default function CreateFlashSaleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<CreateFlashSaleRouteParams, 'CreateFlashSale'>>();
  const { id_ecommerce, shop_name } = route.params;

  // Step 1: Basic Info States
  const [timeslots, setTimeslots] = useState<ITimeslot[]>([]);
  const [selectedTimeslot, setSelectedTimeslot] = useState<ITimeslot | null>(null);
  const [loadingTimeslots, setLoadingTimeslots] = useState(false);
  const [showTimeslotPicker, setShowTimeslotPicker] = useState(false);

  const [autoRenew, setAutoRenew] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Step 2: Selected Products & Pricing
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState<IFlashSaleProductItem[]>([]);

  // Item pricing and quota state maps (key: item_id)
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});
  const [stockMap, setStockMap] = useState<Record<string, string>>({});

  // Submitting states
  const [submitting, setSubmitting] = useState(false);

  // Shopee rejection feedback modal
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [rejectionList, setRejectionList] = useState<IShopeeRejection[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchTimeslots();
  }, [id_ecommerce]);

  const fetchTimeslots = async () => {
    setLoadingTimeslots(true);
    try {
      const res = await FlashSaleService.getTimeSlots(id_ecommerce);
      if (res.status && Array.isArray(res.timeslot_list)) {
        setTimeslots(res.timeslot_list);
        if (res.timeslot_list.length > 0) {
          setSelectedTimeslot(res.timeslot_list[0]);
        }
      }
    } catch (err) {
      console.error('[CreateFlashSaleScreen] Error fetching timeslots:', err);
    } finally {
      setLoadingTimeslots(false);
    }
  };

  const handleProductsSelected = (newItems: IFlashSaleProductItem[]) => {
    setSelectedItems(newItems);

    // Initialize default prices and stock
    const nextPriceMap = { ...priceMap };
    const nextStockMap = { ...stockMap };

    newItems.forEach((it) => {
      const key = String(it.item_id);
      if (!nextPriceMap[key]) {
        // Default to 10% discount from original price if available
        const originalPrice = it.price || it.current_price || 0;
        const defaultPromo = Math.round(originalPrice * 0.9);
        nextPriceMap[key] = String(defaultPromo);
      }
      if (!nextStockMap[key]) {
        // Default to min(stock, 10)
        const defaultStock = Math.min(Math.max(1, it.stock || 1), 20);
        nextStockMap[key] = String(defaultStock);
      }
    });

    setPriceMap(nextPriceMap);
    setStockMap(nextStockMap);
  };

  const handlePriceChange = (key: string, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setPriceMap((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleStockChange = (key: string, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setStockMap((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleRemoveItem = (key: string) => {
    setSelectedItems((prev) => prev.filter((it) => String(it.item_id) !== key));
  };

  const handleSubmit = async () => {
    if (!selectedTimeslot) {
      Alert.alert('Perhatian', 'Pilih slot waktu terlebih dahulu.');
      return;
    }

    if (selectedItems.length === 0) {
      Alert.alert('Perhatian', 'Tambahkan minimal 1 produk untuk Flash Sale.');
      return;
    }

    // Validate prices and quotas for all items
    const invalidDiscounts: string[] = [];
    const invalidStocks: string[] = [];
    const itemsPayload: Array<{
      item_id: number | string;
      isVariant: boolean;
      flash_price: number;
      stock: number;
      parent_id?: number | string;
    }> = [];

    for (const item of selectedItems) {
      const key = String(item.item_id);
      const originalPrice = item.price || item.current_price || 0;
      const flashPrice = parseInt(priceMap[key] || '0', 10);
      const stock = parseInt(stockMap[key] || '0', 10);

      const discountPct = calculateDiscountPercent(originalPrice, flashPrice);

      if (discountPct < 5 || discountPct > 100) {
        invalidDiscounts.push(`${item.name} (${discountPct}%)`);
      }

      if (stock < 1 || stock > 350) {
        invalidStocks.push(`${item.name} (${stock} unit)`);
      }

      itemsPayload.push({
        item_id: item.item_id,
        isVariant: !!item.isVariant,
        parent_id: item.parent_id || undefined,
        flash_price: flashPrice,
        stock: stock,
      });
    }

    if (invalidDiscounts.length > 0) {
      Alert.alert(
        'Diskon Tidak Memenuhi Syarat Shopee',
        `Diskon Shopee wajib antara 5% - 100%:\n• ${invalidDiscounts.slice(0, 3).join('\n• ')}`
      );
      return;
    }

    if (invalidStocks.length > 0) {
      Alert.alert(
        'Kuota Stok Tidak Valid',
        `Alokasi stok harus 1 - 350 unit per sesi:\n• ${invalidStocks.slice(0, 3).join('\n• ')}`
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create session at Shopee
      const createRes = await FlashSaleService.createFlashSaleSession(
        id_ecommerce,
        selectedTimeslot.timeslot_id,
        selectedTimeslot.start_time,
        selectedTimeslot.end_time
      );

      if (!createRes.status || !createRes.flash_sale_id) {
        Alert.alert(
          'Gagal Membuat Sesi Shopee',
          createRes.reason || 'Shopee menolak pembuatan sesi untuk slot waktu ini.'
        );
        setSubmitting(false);
        return;
      }

      const flashSaleId = createRes.flash_sale_id;

      // 2. Add items to session
      const addRes = await FlashSaleService.addItemsToSession(flashSaleId, itemsPayload);

      if (!addRes.status) {
        if (addRes.failure_list && addRes.failure_list.length > 0) {
          setRejectionList(addRes.failure_list);
          setRejectionReason(
            addRes.reason || 'Shopee menolak beberapa item yang dimasukkan ke Flash Sale.'
          );
          setRejectionModalVisible(true);
        } else {
          Alert.alert('Gagal Menambahkan Item', addRes.reason || 'Terjadi kesalahan sistem.');
        }
        setSubmitting(false);
        return;
      }

      // 3. Register auto flash sale if toggled
      if (autoRenew) {
        const autoProducts = itemsPayload.map((p) => ({
          item_id: p.item_id,
          flash_price: p.flash_price,
          stock_allocated: p.stock,
        }));

        const formattedEndDate = endDate ? moment(endDate).format('YYYY-MM-DD') : null;

        await FlashSaleService.createAutoFlashSale(
          id_ecommerce,
          autoProducts,
          formattedEndDate
        );
      }

      Alert.alert(
        'Flash Sale Berhasil Dibuat! 🎉',
        `Sesi Flash Sale #${flashSaleId} berhasil terdaftar di Shopee.${
          autoRenew ? ' Konfigurasi otomatis juga telah aktif.' : ''
        }`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.appBarBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle}>Buat Flash Sale Shopee</Text>
          <Text style={styles.appBarSubtitle}>{shop_name || 'Toko Shopee'}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Step 1: Timeslot Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={18} color="#EE4D2D" />
            <Text style={styles.sectionTitle}>1. Informasi Slot Waktu</Text>
          </View>

          <Text style={styles.fieldLabel}>Slot Waktu (48 Jam Ke Depan)</Text>
          {loadingTimeslots ? (
            <ActivityIndicator size="small" color="#EE4D2D" style={{ marginVertical: 10 }} />
          ) : timeslots.length === 0 ? (
            <View style={styles.emptyTimeslotBox}>
              <Text style={styles.emptyTimeslotText}>
                Tidak ada slot waktu Flash Sale yang tersedia di Shopee untuk 48 jam ke depan.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.timeslotSelector}
              onPress={() => setShowTimeslotPicker(!showTimeslotPicker)}
            >
              <Text style={styles.timeslotSelectorText}>
                {selectedTimeslot
                  ? `${formatDateTime(selectedTimeslot.start_time)} ~ ${formatDateTime(
                      selectedTimeslot.end_time
                    )}`
                  : 'Pilih slot waktu...'}
              </Text>
              <Ionicons
                name={showTimeslotPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#6B7280"
              />
            </TouchableOpacity>
          )}

          {/* Timeslot Options Dropdown */}
          {showTimeslotPicker && (
            <View style={styles.timeslotDropdown}>
              {timeslots.map((ts) => {
                const isSelected = selectedTimeslot?.timeslot_id === ts.timeslot_id;
                return (
                  <TouchableOpacity
                    key={ts.timeslot_id}
                    style={[styles.timeslotOption, isSelected && styles.timeslotOptionSelected]}
                    onPress={() => {
                      setSelectedTimeslot(ts);
                      setShowTimeslotPicker(false);
                    }}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={isSelected ? '#EE4D2D' : '#9CA3AF'}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.timeslotOptionText,
                        isSelected && styles.timeslotOptionTextSelected,
                      ]}
                    >
                      {formatDateTime(ts.start_time)} ~ {formatDateTime(ts.end_time)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Auto-renew Switch */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.switchTitle}>Perbarui Flash Sale Otomatis</Text>
              <Text style={styles.switchSubtitle}>
                Server akan mendaftarkan produk ini ke slot Flash Sale Shopee setiap hari secara berkala.
              </Text>
            </View>
            <Switch
              value={autoRenew}
              onValueChange={setAutoRenew}
              trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
              thumbColor={autoRenew ? '#EE4D2D' : '#F3F4F6'}
            />
          </View>

          {/* End Date if Auto-renew is active */}
          {autoRenew && (
            <View style={styles.endDateRow}>
              <Text style={styles.fieldLabel}>Tanggal Berakhir Promo (Opsional)</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={16} color="#4B5563" />
                <Text style={styles.datePickerBtnText}>
                  {endDate ? moment(endDate).format('DD MMMM YYYY') : 'Selamanya (Tanpa Batas)'}
                </Text>
                {endDate && (
                  <TouchableOpacity onPress={() => setEndDate(null)}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={endDate || new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    setShowDatePicker(false);
                    if (selected) setEndDate(selected);
                  }}
                />
              )}
            </View>
          )}
        </View>

        {/* Step 2: Selected Products Configuration */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag" size={18} color="#EE4D2D" />
              <Text style={styles.sectionTitle}>
                2. Produk & Kuota ({selectedItems.length})
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addProductBtn}
              onPress={() => setProductPickerVisible(true)}
            >
              <Ionicons name="add" size={16} color="#EE4D2D" />
              <Text style={styles.addProductBtnText}>+ Tambah Produk</Text>
            </TouchableOpacity>
          </View>

          {selectedItems.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyProductBox}
              onPress={() => setProductPickerVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={36} color="#EE4D2D" />
              <Text style={styles.emptyProductTitle}>Pilih Produk untuk Flash Sale</Text>
              <Text style={styles.emptyProductSub}>
                Ketuk di sini untuk memilih produk atau varian dari katalog Shopee toko Anda.
              </Text>
            </TouchableOpacity>
          ) : (
            selectedItems.map((item) => {
              const key = String(item.item_id);
              const originalPrice = item.price || item.current_price || 0;
              const flashPriceNum = parseInt(priceMap[key] || '0', 10);
              const stockNum = parseInt(stockMap[key] || '0', 10);

              const discountPct = calculateDiscountPercent(originalPrice, flashPriceNum);
              const isInvalidDiscount = discountPct < 5 || discountPct > 100;
              const isInvalidStock = stockNum < 1 || stockNum > 350;
              const isBelowHpp = item.hpp && flashPriceNum < item.hpp;
              const hppMargin = item.hpp ? calculateHppMargin(flashPriceNum, item.hpp) : null;

              return (
                <View key={key} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    {item.picture || item.image || (item.images && item.images[0]) ? (
                      <Image
                        source={{ uri: item.picture || item.image || (item.images && item.images[0]) }}
                        style={styles.itemThumb}
                      />
                    ) : (
                      <View style={styles.itemPlaceholder}>
                        <Ionicons name="image-outline" size={18} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {item.sku ? <Text style={styles.itemSku}>SKU: {item.sku}</Text> : null}
                      <Text style={styles.itemOriginalPrice}>
                        Harga Reguler: Rp {originalPrice.toLocaleString('id-ID')}
                      </Text>
                      {item.hpp ? (
                        <Text style={styles.itemHpp}>
                          Modal (HPP): Rp {item.hpp.toLocaleString('id-ID')}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(key)}
                      style={styles.deleteItemBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  </View>

                  {/* Configuration Input Row */}
                  <View style={styles.configRow}>
                    <View style={styles.configCol}>
                      <Text style={styles.configLabel}>Harga Flash Sale</Text>
                      <View
                        style={[
                          styles.inputBox,
                          isInvalidDiscount && styles.inputBoxError,
                        ]}
                      >
                        <Text style={styles.inputPrefix}>Rp</Text>
                        <TextInput
                          style={styles.configInput}
                          keyboardType="numeric"
                          value={priceMap[key] || ''}
                          onChangeText={(val) => handlePriceChange(key, val)}
                        />
                      </View>
                    </View>

                    <View style={styles.configCol}>
                      <Text style={styles.configLabel}>Kuota Stok (1-350)</Text>
                      <View
                        style={[
                          styles.inputBox,
                          isInvalidStock && styles.inputBoxError,
                        ]}
                      >
                        <TextInput
                          style={[styles.configInput, { textAlign: 'center' }]}
                          keyboardType="numeric"
                          value={stockMap[key] || ''}
                          onChangeText={(val) => handleStockChange(key, val)}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Status Badges & Warnings */}
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.discountChip,
                        isInvalidDiscount && styles.discountChipError,
                      ]}
                    >
                      <Text
                        style={[
                          styles.discountChipText,
                          isInvalidDiscount && styles.discountChipTextError,
                        ]}
                      >
                        Diskon {discountPct}% {isInvalidDiscount ? '⚠️ Min. 5%' : ''}
                      </Text>
                    </View>

                    {isBelowHpp && (
                      <View style={styles.hppChip}>
                        <Ionicons name="warning" size={11} color="#DC2626" />
                        <Text style={styles.hppChipText}>
                          Di bawah HPP ({hppMargin}%)
                        </Text>
                      </View>
                    )}

                    {!item.is_bound && (
                      <View style={styles.unboundChip}>
                        <Text style={styles.unboundChipText}>Belum Binding HPP</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Floating Submit Bar */}
      <View style={styles.bottomSubmitBar}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          disabled={submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              Konfirmasi & Buat Flash Sale ({selectedItems.length} Item)
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Product Selection Modal */}
      <ProductPickerModal
        visible={productPickerVisible}
        onClose={() => setProductPickerVisible(false)}
        idEcommerce={id_ecommerce}
        alreadySelectedIds={selectedItems.map((i) => i.item_id)}
        onSelectProducts={handleProductsSelected}
      />

      {/* Shopee Rejection Details Modal */}
      <ShopeeRejectionModal
        visible={rejectionModalVisible}
        onClose={() => setRejectionModalVisible(false)}
        failures={rejectionList}
        generalReason={rejectionReason}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  appBarBtn: {
    padding: 4,
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  appBarSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  emptyTimeslotBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  emptyTimeslotText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
  },
  timeslotSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  timeslotSelectorText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  timeslotDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  timeslotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timeslotOptionSelected: {
    backgroundColor: '#FEF2F2',
  },
  timeslotOptionText: {
    fontSize: 12,
    color: '#4B5563',
  },
  timeslotOptionTextSelected: {
    color: '#EE4D2D',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 4,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  switchSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15,
  },
  endDateRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  datePickerBtnText: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  addProductBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EE4D2D',
  },
  emptyProductBox: {
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBFB',
  },
  emptyProductTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginTop: 8,
  },
  emptyProductSub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  itemPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemSku: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  itemOriginalPrice: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
  itemHpp: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  deleteItemBtn: {
    padding: 4,
  },
  configRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  configCol: {
    flex: 1,
  },
  configLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 36,
  },
  inputBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputPrefix: {
    fontSize: 11,
    color: '#6B7280',
    marginRight: 4,
  },
  configInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    padding: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  discountChip: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountChipError: {
    backgroundColor: '#FEE2E2',
  },
  discountChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#03543F',
  },
  discountChipTextError: {
    color: '#DC2626',
  },
  hppChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  hppChipText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
  },
  unboundChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unboundChipText: {
    fontSize: 10,
    color: '#92400E',
  },
  bottomSubmitBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 14,
  },
  submitBtn: {
    backgroundColor: '#EE4D2D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
