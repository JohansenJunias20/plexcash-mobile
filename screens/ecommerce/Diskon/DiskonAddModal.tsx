import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch, Alert, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DiskonAddModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialItem?: any;
}

export default function DiskonAddModal({ onClose, onSuccess, initialItem }: DiskonAddModalProps) {
  const [namaPromo, setNamaPromo] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(moment().add(6, 'months').toDate());
  
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [promoConflicts, setPromoConflicts] = useState<any[]>([]);
  const [onlineMappings, setOnlineMappings] = useState<any[]>([]);
  const [markupPct, setMarkupPct] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchShops();
    if (initialItem) {
      const newItem = {
        id_masterbarang: initialItem.id || initialItem.ID,
        nama: initialItem.nama || initialItem.NAMA,
        hpp: Number(initialItem.hpp || initialItem.HPP || 0),
        harga_jual_2: Number(initialItem.harga_jual_2 || initialItem.hargajual2 || initialItem.HARGAJUAL2 || 0),
        harga_promo: '',
        persentase_promo: '',
        purchase_limit: '0',
        included_id_onlines: [],
        showMappings: false
      };
      setSelectedItems([newItem]);
    }
  }, []);

  const fetchShops = async () => {
    try {
      const res = await ApiService.get('/get/shopee_shops');
      if (res.success) setShops(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await ApiService.post('/search/masterbarang', {
        id: "", nama: searchQuery, kategori: "", merk: ""
      });
      setSearchResults(res.slice(0, 10));
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectItem = (item: any) => {
    if (selectedItems.find(i => i.id_masterbarang === (item.id || item.ID))) {
      Alert.alert('Info', 'Barang sudah ada di daftar');
      return;
    }
    const newItem = {
      id_masterbarang: item.id || item.ID,
      nama: item.nama || item.NAMA,
      hpp: Number(item.hpp || item.HPP || 0),
      harga_jual_2: Number(item.harga_jual_2 || item.hargajual2 || item.HARGAJUAL2 || 0),
      harga_promo: '',
      persentase_promo: '',
      purchase_limit: '0',
      included_id_onlines: [],
      showMappings: false
    };
    const newItems = [...selectedItems, newItem];
    setSelectedItems(newItems);
    setSearchResults([]);
    setSearchQuery('');
    checkPromoConflicts(selectedShop?.id, newItems);
  };

  const handleRemoveItem = (id: number) => {
    const newItems = selectedItems.filter(i => i.id_masterbarang !== id);
    setSelectedItems(newItems);
    checkPromoConflicts(selectedShop?.id, newItems);
  };

  const checkPromoConflicts = async (shopId: number | undefined, items: any[]) => {
    if (!shopId || items.length === 0) {
      setPromoConflicts([]);
      return;
    }
    setCheckingConflicts(true);
    try {
      const res = await ApiService.post('/check/promo_conflicts', {
        id_masterbarang_list: items.map(i => i.id_masterbarang),
        id_ecommerce: shopId
      });
      if (res.success) {
        setPromoConflicts(res.conflicts || []);
        setOnlineMappings(res.mappings || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleShopChange = (shop: any) => {
    setSelectedShop(shop);
    setShowShopPicker(false);
    checkPromoConflicts(shop.id, selectedItems);
  };

  const applyMarkupFromHpp = () => {
    const pct = parseFloat(markupPct);
    if (isNaN(pct) || pct <= 0) {
      Alert.alert('Error', 'Masukkan persentase markup yang valid');
      return;
    }
    
    setSelectedItems(prev => prev.map(item => {
      const hpp = Number(item.hpp);
      if (!hpp || hpp <= 0) return item;
      
      const hargaCoret = Math.round(hpp * (1 + pct / 100));
      const base = Number(item.harga_jual_2);
      const diskonPct = base > 0 ? ((1 - hargaCoret / base) * 100).toFixed(1) : '';
      
      return {
        ...item,
        harga_promo: hargaCoret.toString(),
        persentase_promo: diskonPct
      };
    }));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.id_masterbarang !== id) return item;
      
      const newItem = { ...item, [field]: value };
      
      if (field === 'harga_promo') {
        const hp = parseFloat(value);
        if (!isNaN(hp) && item.harga_jual_2 > 0) {
          newItem.persentase_promo = ((1 - hp / item.harga_jual_2) * 100).toFixed(1);
        } else {
          newItem.persentase_promo = '';
        }
      } else if (field === 'persentase_promo') {
        const pct = parseFloat(value);
        if (!isNaN(pct) && item.harga_jual_2 > 0) {
          newItem.harga_promo = Math.round(item.harga_jual_2 * (1 - pct / 100)).toString();
        } else {
          newItem.harga_promo = '';
        }
      }
      
      return newItem;
    }));
  };

  const handleSave = async () => {
    if (!namaPromo) return Alert.alert('Error', 'Nama promo harus diisi');
    if (!selectedShop) return Alert.alert('Error', 'Toko belum dipilih');
    if (selectedItems.length === 0) return Alert.alert('Error', 'Pilih minimal 1 barang');

    for (let item of selectedItems) {
      const hp = Number(item.harga_promo);
      if (!hp || hp <= 0) return Alert.alert('Error', `Harga promo untuk "${item.nama}" belum diisi/tidak valid`);
      if (item.harga_jual_2 > 0 && hp >= item.harga_jual_2) {
        return Alert.alert('Error', `Harga promo "${item.nama}" tidak boleh lebih besar atau sama dengan Harga Jual`);
      }
    }

    const payload = {
      nama_promo: namaPromo,
      start_time: moment(startTime).format('YYYY-MM-DDTHH:mm'),
      end_time: moment(endTime).format('YYYY-MM-DDTHH:mm'),
      id_ecommerce: selectedShop.id,
      auto_renew: autoRenew,
      details: selectedItems.map(i => {
        const itemMappings = onlineMappings.filter(m => m.id_masterbarang === i.id_masterbarang);
        let includedIds = i.included_id_onlines;
        if (!includedIds || includedIds.length === 0) {
          includedIds = itemMappings.map(m => m.id_online);
        }
        
        return {
          id_masterbarang: i.id_masterbarang,
          harga_promo: Number(i.harga_promo),
          harga_jual_2: Number(i.harga_jual_2),
          persentase_promo: i.persentase_promo ? Number(i.persentase_promo) : null,
          purchase_limit: Number(i.purchase_limit),
          included_id_onlines: includedIds.length > 0 ? includedIds : null
        };
      })
    };

    setSaving(true);
    try {
      const res = await ApiService.post('/insert/promo_marketplace', payload);
      if (res.success) {
        Alert.alert('Sukses', 'Promo berhasil disimpan di lokal.');
        onSuccess();
      } else {
        Alert.alert('Gagal', res.message || 'Terjadi kesalahan');
      }
    } catch (e) {
      Alert.alert('Gagal', 'Terjadi kesalahan sistem');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const hasConflict = (id_masterbarang: number) => {
    // Basic conflict check matching backend result structure
    // Normally backend returns array of online_masterbarang that has conflicts. 
    // We do a simple check if any conflict exists for this item
    // Due to complexity of variants, we simplify: if conflicts array has anything, we warn.
    return promoConflicts.length > 0; // Simplified for mobile
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buat Promo Baru</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Simpan</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.label}>Nama Promo</Text>
          <TextInput 
            style={styles.input} 
            value={namaPromo} 
            onChangeText={setNamaPromo} 
            placeholder="Contoh: Promo Gajian"
          />

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 8}}>
              <Text style={styles.label}>Mulai</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                <Text>{moment(startTime).format('DD MMM YYYY HH:mm')}</Text>
              </TouchableOpacity>
            </View>
            <View style={{flex: 1, marginLeft: 8}}>
              <Text style={styles.label}>Berakhir</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                <Text>{moment(endTime).format('DD MMM YYYY HH:mm')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startTime}
              mode="datetime"
              display="default"
              onChange={(e, d) => {
                setShowStartPicker(false);
                if (d) setStartTime(d);
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endTime}
              mode="datetime"
              display="default"
              onChange={(e, d) => {
                setShowEndPicker(false);
                if (d) setEndTime(d);
              }}
            />
          )}

          <Text style={[styles.label, {marginTop: 12}]}>Toko Shopee</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => setShowShopPicker(true)}>
            <Text style={{color: selectedShop ? '#111827' : '#9ca3af'}}>
              {selectedShop ? selectedShop.name : 'Pilih Toko...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6b7280" />
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Perpanjang Otomatis</Text>
            <Switch value={autoRenew} onValueChange={setAutoRenew} trackColor={{ true: '#f59e0b', false: '#d1d5db' }}/>
          </View>
        </View>

        {/* Search & Select Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produk Promo</Text>
          
          <View style={styles.searchContainer}>
            <TextInput 
              style={styles.searchInput}
              placeholder="Cari nama barang..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              {searching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.searchResultBox}>
              {searchResults.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.searchResultItem} onPress={() => handleSelectItem(item)}>
                  <Text style={styles.searchResultText} numberOfLines={2}>{item.nama || item.NAMA}</Text>
                  <Ionicons name="add-circle-outline" size={24} color="#f59e0b" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {checkingConflicts && <Text style={{color: '#f59e0b', marginVertical: 8}}>Mengecek konflik promo...</Text>}

          {selectedItems.length > 0 && (
            <View style={styles.bulkMarkupContainer}>
              <Text style={styles.bulkMarkupLabel}>Set Harga Promo Masal (dari HPP)</Text>
              <View style={styles.bulkMarkupRow}>
                <TextInput
                  style={styles.bulkMarkupInput}
                  keyboardType="numeric"
                  placeholder="Markup % (misal: 10)"
                  value={markupPct}
                  onChangeText={setMarkupPct}
                />
                <TouchableOpacity style={styles.bulkMarkupBtn} onPress={applyMarkupFromHpp}>
                  <Text style={styles.bulkMarkupBtnText}>Terapkan</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {selectedItems.map((item) => (
            <View key={item.id_masterbarang} style={styles.selectedCard}>
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedTitle} numberOfLines={2}>{item.nama}</Text>
                <TouchableOpacity onPress={() => handleRemoveItem(item.id_masterbarang)}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.priceInfo}>
                <Text style={styles.priceLabel}>Base: Rp {item.harga_jual_2.toLocaleString('id-ID')}</Text>
                <Text style={styles.priceLabel}>HPP: Rp {item.hpp.toLocaleString('id-ID')}</Text>
              </View>

              {(() => {
                const itemMappings = onlineMappings.filter(m => m.id_masterbarang === item.id_masterbarang);
                if (itemMappings.length <= 1) return null;

                const includedSet = new Set(item.included_id_onlines?.length > 0 ? item.included_id_onlines : itemMappings.map(m => m.id_online));
                
                return (
                  <View style={styles.variantContainer}>
                    <TouchableOpacity 
                      style={styles.variantToggleBtn} 
                      onPress={() => updateItem(item.id_masterbarang, 'showMappings', !item.showMappings)}
                    >
                      <Text style={styles.variantToggleText}>
                        {itemMappings.length} Varian Toko ({includedSet.size} dipilih)
                      </Text>
                      <Ionicons name={item.showMappings ? 'chevron-up' : 'chevron-down'} size={16} color="#3b82f6" />
                    </TouchableOpacity>
                    
                    {item.showMappings && (
                      <View style={styles.variantList}>
                        {itemMappings.map((m: any, idx: number) => {
                          const isIncluded = includedSet.has(m.id_online);
                          return (
                            <TouchableOpacity 
                              key={idx} 
                              style={styles.variantItem}
                              onPress={() => {
                                const newSet = new Set(includedSet);
                                if (isIncluded) newSet.delete(m.id_online);
                                else newSet.add(m.id_online);
                                updateItem(item.id_masterbarang, 'included_id_onlines', Array.from(newSet));
                              }}
                            >
                              <Ionicons 
                                name={isIncluded ? 'checkbox' : 'square-outline'} 
                                size={20} 
                                color={isIncluded ? '#f59e0b' : '#9ca3af'} 
                              />
                              <Text style={styles.variantItemText} numberOfLines={2}>
                                {m.shopee_item_name ? `${m.shopee_item_name} ${m.shopee_model_name ? '- ' + m.shopee_model_name : ''}` : `ID: ${m.id_online}`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })()}

              {promoConflicts.length > 0 && (
                <Text style={styles.conflictWarn}>⚠️ Mungkin konflik dengan promo aktif</Text>
              )}

              <View style={styles.inputGrid}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Harga Promo</Text>
                  <TextInput 
                    style={styles.numberInput} 
                    keyboardType="numeric" 
                    value={item.harga_promo}
                    onChangeText={v => updateItem(item.id_masterbarang, 'harga_promo', v)}
                    placeholder="Rp"
                  />
                  {Number(item.harga_promo) > 0 && Number(item.harga_promo) < item.hpp && (
                    <Text style={styles.errorText}>Di bawah HPP!</Text>
                  )}
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Diskon (%)</Text>
                  <TextInput 
                    style={styles.numberInput} 
                    keyboardType="numeric" 
                    value={item.persentase_promo}
                    onChangeText={v => updateItem(item.id_masterbarang, 'persentase_promo', v)}
                    placeholder="%"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Limit</Text>
                  <TextInput 
                    style={styles.numberInput} 
                    keyboardType="numeric" 
                    value={item.purchase_limit}
                    onChangeText={v => updateItem(item.id_masterbarang, 'purchase_limit', v)}
                  />
                </View>
              </View>
            </View>
          ))}
          
          {selectedItems.length === 0 && (
            <Text style={styles.emptyItemsText}>Belum ada produk yang dipilih.</Text>
          )}
        </View>
        <View style={{height: 100}} />
      </ScrollView>

      {/* Shop Picker Modal */}
      <Modal visible={showShopPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.shopModal}>
            <Text style={styles.shopModalTitle}>Pilih Toko</Text>
            <FlatList
              data={shops}
              keyExtractor={item => item.id.toString()}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.shopItem} onPress={() => handleShopChange(item)}>
                  <Text style={styles.shopItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.shopCancelBtn} onPress={() => setShowShopPicker(false)}>
              <Text style={styles.shopCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    paddingTop: Platform.OS === 'ios' ? 50 : 16
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  saveBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
  label: { fontSize: 13, color: '#4b5563', marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#f9fafb', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  dateBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#f9fafb' },
  shopBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#f9fafb' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  searchContainer: { flexDirection: 'row', marginBottom: 12 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#f9fafb', borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  searchBtn: { backgroundColor: '#f59e0b', padding: 12, borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' },
  searchResultBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 16, maxHeight: 200 },
  searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  searchResultText: { fontSize: 13, color: '#334155', flex: 1, marginRight: 8 },
  selectedCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#fff' },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  selectedTitle: { fontSize: 14, fontWeight: 'bold', color: '#1f2937', flex: 1, marginRight: 8 },
  priceInfo: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  priceLabel: { fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  conflictWarn: { color: '#d97706', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  inputGrid: { flexDirection: 'row', gap: 8 },
  inputCol: { flex: 1 },
  inputLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  numberInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 13, backgroundColor: '#f9fafb', textAlign: 'center' },
  errorText: { color: '#ef4444', fontSize: 10, marginTop: 4, fontWeight: 'bold' },
  emptyItemsText: { textAlign: 'center', color: '#9ca3af', marginTop: 20, fontStyle: 'italic' },
  bulkMarkupContainer: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  bulkMarkupLabel: { fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  bulkMarkupRow: { flexDirection: 'row', gap: 8 },
  bulkMarkupInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 14, backgroundColor: '#f9fafb' },
  bulkMarkupBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 6 },
  bulkMarkupBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  variantContainer: { backgroundColor: '#f8fafc', borderRadius: 6, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  variantToggleBtn: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, alignItems: 'center' },
  variantToggleText: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold' },
  variantList: { borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: 8 },
  variantItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  variantItemText: { fontSize: 12, color: '#4b5563', flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  shopModal: { backgroundColor: 'white', borderRadius: 12, padding: 20, maxHeight: '80%' },
  shopModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  shopItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  shopItemText: { fontSize: 16, color: '#1f2937' },
  shopCancelBtn: { marginTop: 16, padding: 12, alignItems: 'center' },
  shopCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});
