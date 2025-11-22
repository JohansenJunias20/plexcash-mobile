import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';

interface Item {
  id: number;
  id_dso: number;
  nama: string;
  merk: string;
  kategori: string;
  harga: string;
  qty: string;
  keterangan: string;
  sku: string;
}

interface StokOpname {
  id: string;
  tanggal: string;
  user?: string;
}

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
};

const getCurrentDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const StokOpnameScreen = ({ navigation }: any) => {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [id, setId] = useState<string>('BARU');
  const [tanggal, setTanggal] = useState<string>(getCurrentDateTime());
  const [items, setItems] = useState<Item[]>([]);
  const [lawanmodal, setLawanmodal] = useState<boolean>(true);
  const [stockMode, setStockMode] = useState<'REPLACE' | 'ADJUST'>('ADJUST');
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stokOpnameList, setStokOpnameList] = useState<StokOpname[]>([]);
  const [showSearchBarang, setShowSearchBarang] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  useEffect(() => {
    if (mode === 'list') {
      loadStokOpnameList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Reset search when modal opens/closes
  useEffect(() => {
    if (!showSearchBarang) {
      // Reset when modal closes
      setSearchQuery('');
      setSearchResults([]);
      setSearchLoading(false);
    }
  }, [showSearchBarang]);

  // Debounced search effect
  useEffect(() => {
    if (!showSearchBarang) {
      return;
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        // Use the proper /get/masterbarang/search endpoint with OR logic
        // Backend will detect OR logic when all search params are the same
        // SQL: WHERE (NAMA LIKE '%query%' OR SKU LIKE '%query%' OR MERK LIKE '%query%' OR KATEGORI LIKE '%query%')
        const params = new URLSearchParams({
          nama: searchQuery,
          sku: searchQuery,
          merk: searchQuery,
          kategori: searchQuery,
          start: '0',
          end: '50', // Get up to 50 results
          jumlah_online: '2147483647', // Max int to get all items
          search_mode: 'or' // Explicitly request OR logic
        });

        console.log('🔍 Searching with query:', searchQuery);

        const response = await ApiService.get(`/get/masterbarang/search?${params.toString()}`);

        console.log('📦 Search response:', response.status, 'Results:', response.data?.length || 0);

        if (response.status && response.data) {
          const results = response.data.slice(0, 20); // Limit to 20 results for display
          console.log('✅ Setting search results:', results.length, 'items');
          if (results.length > 0) {
            console.log('First result:', results[0].nama, results[0].sku);
          }
          setSearchResults(results);
        } else {
          console.log('❌ No results or failed response');
          setSearchResults([]);
        }
      } catch (error) {
        console.error('❌ Error searching barang:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery, showSearchBarang]);

  const loadStokOpnameList = async () => {
    try {
      setRefreshing(true);
      const response = await ApiService.get('/get/stokop');
      if (response.status && response.data) {
        setStokOpnameList(response.data);
      }
    } catch (error) {
      console.error('Error loading stok opname list:', error);
      Alert.alert('Error', 'Gagal memuat daftar stok opname');
    } finally {
      setRefreshing(false);
    }
  };

  const loadStokOpname = async (stokOpnameId: string, stokOpnameTanggal?: string) => {
    try {
      setLoading(true);
      const response = await ApiService.get(`/get/detailstokop/join/masterbarang/${stokOpnameId}`);
      if (response.status && response.data) {
        const loadedItems = response.data.map((item: any) => ({
          ...item,
          id: item.id_barang,
        }));
        setItems(loadedItems);
        setId(stokOpnameId);
        if (stokOpnameTanggal) {
          setTanggal(stokOpnameTanggal.replace(' ', 'T'));
        }
        setMode('edit');
      }
    } catch (error) {
      console.error('Error loading stok opname:', error);
      Alert.alert('Error', 'Gagal memuat stok opname');
    } finally {
      setLoading(false);
    }
  };



  const handleSelectBarang = (barang: any) => {
    const exists = items.find(item => item.id === barang.id);
    if (exists) {
      Alert.alert('Info', 'Barang sudah ada dalam daftar');
      return;
    }

    const newItem: Item = {
      id: barang.id,
      id_dso: 0,
      nama: barang.nama,
      merk: barang.merk,
      kategori: barang.kategori,
      harga: barang.hpp?.toString() || barang.harga_beli?.toString() || '0',
      qty: '0',
      keterangan: '',
      sku: barang.sku || '',
    };

    setItems([...items, newItem]);
    setShowSearchBarang(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUpdateItem = (index: number, field: keyof Item, value: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    Alert.alert(
      'Konfirmasi',
      'Hapus barang dari daftar?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            const updatedItems = items.filter((_, i) => i !== index);
            setItems(updatedItems);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Isi barang terlebih dahulu');
      return;
    }

    const hasZeroQty = items.find(item => item.qty === '0' || item.qty === '');
    if (hasZeroQty) {
      Alert.alert('Error', 'Qty tidak boleh 0');
      return;
    }

    try {
      setLoading(true);
      let response: any;
      
      if (id === 'BARU') {
        response = await ApiService.post('/stokopname', {
          tanggal: getCurrentDateTime(),
          items,
          lawanmodal,
          stockMode,
        });
        
        if (response.status) {
          Alert.alert('Sukses', 'Stok opname berhasil dibuat', [
            {
              text: 'OK',
              onPress: () => {
                setId(response.id || 'BARU');
                setMode('list');
                resetForm();
              },
            },
          ]);
        } else {
          Alert.alert('Error', response.reason || 'Gagal menyimpan stok opname');
        }
      } else {
        response = await ApiService.patch('/stokopname', {
          id,
          tanggal: getCurrentDateTime(),
          items,
          stockMode,
        });
        
        if (response.status) {
          Alert.alert('Sukses', 'Stok opname berhasil diupdate', [
            {
              text: 'OK',
              onPress: () => {
                setMode('list');
                resetForm();
              },
            },
          ]);
        } else {
          Alert.alert('Error', response.reason || 'Gagal mengupdate stok opname');
        }
      }
    } catch (error) {
      console.error('Error saving stok opname:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (id === 'BARU') return;

    Alert.alert(
      'Konfirmasi Hapus',
      'Apakah Anda yakin ingin menghapus stok opname ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await ApiService.delete('/stokopname', { id });
              
              if (response.status) {
                Alert.alert('Sukses', 'Stok opname berhasil dihapus', [
                  {
                    text: 'OK',
                    onPress: () => {
                      setMode('list');
                      resetForm();
                    },
                  },
                ]);
              } else {
                Alert.alert('Error', 'Gagal menghapus stok opname');
              }
            } catch (error) {
              console.error('Error deleting stok opname:', error);
              Alert.alert('Error', 'Terjadi kesalahan saat menghapus');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setId('BARU');
    setItems([]);
    setTanggal(getCurrentDateTime());
    setLawanmodal(true);
    setStockMode('ADJUST');
  };

  const handleNewStokOpname = () => {
    resetForm();
    setMode('create');
  };

  // Memoized render functions for better performance
  const renderStokOpnameItem = useCallback(({ item }: { item: StokOpname }) => (
    <TouchableOpacity
      style={styles.listCard}
      onPress={() => loadStokOpname(item.id, item.tanggal)}
    >
      <View style={styles.listCardHeader}>
        <Text style={styles.listCardId}>ID: {item.id}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
      <Text style={styles.listCardDate}>
        {formatDate(item.tanggal)}
      </Text>
      {item.user && (
        <Text style={styles.listCardUser}>User: {item.user}</Text>
      )}
    </TouchableOpacity>
  ), []);

  const renderEmptyList = useMemo(() => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateText}>Belum ada stok opname</Text>
      <TouchableOpacity style={styles.emptyStateButton} onPress={handleNewStokOpname}>
        <Text style={styles.emptyStateButtonText}>Buat Stok Opname Baru</Text>
      </TouchableOpacity>
    </View>
  ), []);

  const keyExtractor = useCallback((item: StokOpname) => item.id, []);

  if (mode === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Stok Opname</Text>
          <TouchableOpacity onPress={handleNewStokOpname} style={styles.addButton}>
            <Ionicons name="add" size={24} color="#f59e0b" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={stokOpnameList}
          renderItem={renderStokOpnameItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadStokOpnameList} />
          }
          ListEmptyComponent={renderEmptyList}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMode('list')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {id === 'BARU' ? 'Stok Opname Baru' : `Edit Stok Opname #${id}`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Info Section */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID</Text>
            <Text style={styles.infoValue}>{id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tanggal</Text>
            <Text style={styles.infoValue}>
              {formatDate(tanggal)}
            </Text>
          </View>
        </View>

        {/* Mode Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mode Penyesuaian</Text>
          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[styles.modeButton, stockMode === 'REPLACE' && styles.modeButtonActive]}
              onPress={() => setStockMode('REPLACE')}
            >
              <Text style={[styles.modeButtonText, stockMode === 'REPLACE' && styles.modeButtonTextActive]}>
                REPLACE
              </Text>
              <Text style={styles.modeButtonDesc}>Set stok = qty</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, stockMode === 'ADJUST' && styles.modeButtonActive]}
              onPress={() => setStockMode('ADJUST')}
            >
              <Text style={[styles.modeButtonText, stockMode === 'ADJUST' && styles.modeButtonTextActive]}>
                ADJUST
              </Text>
              <Text style={styles.modeButtonDesc}>Qty = delta</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lawan Modal Checkbox (only for new) */}
        {id === 'BARU' && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setLawanmodal(!lawanmodal)}
          >
            <Ionicons
              name={lawanmodal ? 'checkbox' : 'square-outline'}
              size={24}
              color="#f59e0b"
            />
            <Text style={styles.checkboxLabel}>Lawan Modal</Text>
          </TouchableOpacity>
        )}

        {/* Items List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Daftar Barang ({items.length})</Text>
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowSearchBarang(true)}
            >
              <Ionicons name="add-circle" size={24} color="#f59e0b" />
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyItemsText}>Belum ada barang</Text>
            </View>
          ) : (
            items.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemHeaderLeft}>
                    <Text style={styles.itemName}>{item.nama}</Text>
                    <Text style={styles.itemDetails}>
                      {item.merk} • {item.kategori}
                    </Text>
                    <Text style={styles.itemSku}>SKU: {item.sku || '-'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.itemInputs}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Harga Opname</Text>
                    <TextInput
                      style={styles.input}
                      value={item.harga}
                      onChangeText={(value) => {
                        if (/^\d*\.?\d*$/.test(value) || value === '') {
                          handleUpdateItem(index, 'harga', value);
                        }
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Qty</Text>
                    <TextInput
                      style={styles.input}
                      value={item.qty}
                      onChangeText={(value) => {
                        if (/^-?\d*$/.test(value) || value === '') {
                          handleUpdateItem(index, 'qty', value);
                        }
                      }}
                      keyboardType="number-pad"
                      placeholder="0"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Keterangan</Text>
                  <TextInput
                    style={styles.input}
                    value={item.keterangan}
                    onChangeText={(value) => handleUpdateItem(index, 'keterangan', value)}
                    placeholder="Catatan (opsional)"
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {id !== 'BARU' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              disabled={loading}
            >
              <Ionicons name="trash-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Hapus</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="white" />
                <Text style={styles.actionButtonText}>Simpan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Search Barang Modal */}
      <Modal
        visible={showSearchBarang}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSearchBarang(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowSearchBarang(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cari Barang</Text>
              <TouchableOpacity onPress={() => setShowSearchBarang(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama, merk, kategori, atau SKU..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            {searchQuery.length < 2 ? (
              <View style={styles.searchEmpty}>
                <Text style={styles.searchEmptyText}>Ketik minimal 2 karakter untuk mencari</Text>
              </View>
            ) : searchLoading ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator size="large" color="#f59e0b" />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item: barang }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => handleSelectBarang(barang)}
                  >
                    <View style={styles.searchResultContent}>
                      <Text style={styles.searchResultName}>{barang.nama}</Text>
                      <Text style={styles.searchResultDetails}>
                        {barang.merk} • {barang.kategori}
                      </Text>
                      <Text style={styles.searchResultSku}>SKU: {barang.sku || '-'}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color="#f59e0b" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.searchEmpty}>
                    <Text style={styles.searchEmptyText}>Barang tidak ditemukan</Text>
                  </View>
                }
                style={styles.searchResults}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={3}
                removeClippedSubviews={true}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // List Mode Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  listCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listCardId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  listCardDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  listCardUser: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // Form Mode Styles
  infoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  addItemButton: {
    padding: 4,
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#f59e0b',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: '#f59e0b',
  },
  modeButtonDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyItemsText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  itemCard: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    marginTop: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemHeaderLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  itemSku: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  itemInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchResults: {
    maxHeight: 400,
  },
  searchLoading: {
    padding: 40,
    alignItems: 'center',
  },
  searchEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  searchResultDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  searchResultSku: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default StokOpnameScreen;
