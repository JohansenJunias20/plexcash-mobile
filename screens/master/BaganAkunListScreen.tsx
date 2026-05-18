import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';
import { Picker } from '@react-native-picker/picker'; // You might need this or just use a custom dropdown

export interface BaganAkunItem {
  kode: string;
  nama: string;
  kode_induk: string;
  depth: number;
  kelompok: number;
  lock: boolean | null;
  stop: boolean | number;
}

const generateNewKode = (parentKode: string, children: BaganAkunItem[]) => {
  if (children.length === 0) {
    if (parentKode.length >= 3 || parentKode.includes('.')) return parentKode + '.1';
    return parentKode + '1';
  }

  let maxNum = 0;
  let usedDot = false;

  children.forEach((c) => {
    const childKode = c.kode;
    if (childKode.startsWith(parentKode)) {
      let suffixStr = childKode.substring(parentKode.length);
      if (suffixStr.startsWith('.')) {
        usedDot = true;
        suffixStr = suffixStr.substring(1);
      }
      const parsed = parseInt(suffixStr, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  });

  if (maxNum === 0) {
    if (parentKode.length >= 3 || parentKode.includes('.')) return parentKode + '.1';
    return parentKode + '1';
  }

  return parentKode + (usedDot ? '.' : '') + (maxNum + 1);
};

export default function BaganAkunListScreen() {
  const navigation = useNavigation<any>();
  const { signOut } = (require('../../context/AuthContext') as any).useAuth?.() || {};

  const [items, setItems] = useState<BaganAkunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  
  // States for expanding tree nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Action Sheet / Edit state
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BaganAkunItem | null>(null);

  // Form Modal state
  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  const [formData, setFormData] = useState({
    kodeInduk: '',
    kode: '',
    nama: '',
    depth: 1,
    stop: false,
    lock: null as boolean | null,
    editMode: false,
    originalKode: '',
    originalKodeInduk: '',
    originalDepth: 0,
  });

  const [formSaving, setFormSaving] = useState(false);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const res = await fetch(`${API_BASE_URL}/get/baganakun`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const responseText = await res.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        Alert.alert('Error', 'Server returned invalid response');
        return;
      }

      if (data.status) {
        const fetchedItems = data.data.map((item: any) => ({
          ...item,
          stop: !!item.stop,
          lock: item.lock === null ? null : !!item.lock,
        }));
        setItems(fetchedItems);
      } else {
        Alert.alert('Error', data.reason || 'Failed to fetch items');
      }
    } catch (e) {
      console.error('Fetch items error', e);
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
      if (refreshing) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (!text) {
      setExpandedNodes(new Set()); // Reset on clear
      return;
    }

    const lowerQuery = text.toLowerCase();
    const expanded = new Set<string>();

    const matches = items.filter(
      (item) =>
        item.nama.toLowerCase().includes(lowerQuery) ||
        item.kode.toLowerCase().includes(lowerQuery)
    );

    const addParents = (kodeInduk: string) => {
      if (!kodeInduk || kodeInduk === '0' || kodeInduk === '') return;
      expanded.add(kodeInduk);
      const parent = items.find((i) => i.kode === kodeInduk);
      if (parent) {
        addParents(parent.kode_induk);
      }
    };

    matches.forEach((m) => {
      expanded.add(m.kode);
      addParents(m.kode_induk);
    });

    setExpandedNodes(expanded);
  };

  const toggleNode = (kode: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(kode)) {
        newSet.delete(kode);
      } else {
        newSet.add(kode);
      }
      return newSet;
    });
  };

  const hasChildren = (kode: string) => {
    return items.some((item) => item.kode_induk === kode);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    // Validasi memiliki parent/anak tidak bisa
    if (selectedItem.kode === "" || selectedItem.depth === 0) {
      Alert.alert('Error', 'Tidak bisa hapus, masih memiliki parent/child!');
      return;
    }
    if (items.find((item) => item.kode_induk === selectedItem.kode)) {
      Alert.alert('Error', 'Tidak bisa hapus, masih memiliki sub-akun!');
      return;
    }

    Alert.alert(
      'Konfirmasi',
      `Apakah Anda yakin ingin menghapus akun ${selectedItem.kode} - ${selectedItem.nama}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getTokenAuth();
              const res = await fetch(`${API_BASE_URL}/baganakun`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  data: [
                    {
                      kode: selectedItem.kode,
                      kode_induk: selectedItem.kode_induk === '' ? '0' : selectedItem.kode_induk,
                      nama: selectedItem.nama,
                      depth: selectedItem.depth,
                    },
                  ],
                }),
              });

              const data = await res.json();
              if (data.status) {
                Alert.alert('Sukses', 'Akun berhasil dihapus');
                setShowActionSheet(false);
                fetchItems();
              } else {
                Alert.alert('Gagal', data.reason || 'Gagal menghapus akun');
              }
            } catch (e) {
              Alert.alert('Error', 'Network error');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!formData.kode || !formData.nama) {
      Alert.alert('Error', 'Kode dan Nama harus diisi');
      return;
    }

    try {
      setFormSaving(true);
      const token = await getTokenAuth();
      let url = `${API_BASE_URL}/baganakun`;
      let method = formData.editMode ? 'PATCH' : 'POST';
      let body: any;

      if (formData.editMode) {
        body = {
          originalKode: formData.originalKode,
          originalKodeInduk: formData.originalKodeInduk,
          originalDepth: formData.originalDepth,
          kode: formData.kode,
          nama: formData.nama,
          kode_induk: formData.kodeInduk === '' ? '0' : formData.kodeInduk,
          depth: formData.depth,
          stop: formData.stop,
          lock: formData.lock,
        };
      } else {
        body = {
          data: [
            {
              kode: formData.kode,
              nama: formData.nama,
              kode_induk: formData.kodeInduk === '' ? '0' : formData.kodeInduk,
              depth: formData.depth,
              stop: formData.stop,
            },
          ],
        };
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.status) {
        Alert.alert('Sukses', `Akun berhasil ${formData.editMode ? 'diedit' : 'dibuat'}`);
        setShowModal(false);
        fetchItems();
      } else {
        let errorMessage = "Gagal memproses bagan akun";
        if (typeof data.reason === 'string') errorMessage = data.reason;
        else if (data.reason && data.reason.code === 'ER_DUP_ENTRY') {
          errorMessage = `Kode bagan akun '${formData.kode}' sudah ada`;
        }
        Alert.alert('Gagal', errorMessage);
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan jaringan');
    } finally {
      setFormSaving(false);
    }
  };

  const openAddWizard = () => {
    setShowTemplateModal(true);
  };

  const selectTemplate = (type: string) => {
    if (type === 'KUSTOM') {
      setFormData({
        editMode: false,
        kode: '',
        kodeInduk: '',
        nama: '',
        depth: 1,
        stop: false,
        lock: null,
        originalDepth: 0,
        originalKode: '',
        originalKodeInduk: '',
      });
      setShowTemplateModal(false);
      setShowModal(true);
      return;
    }

    let parent: BaganAkunItem | undefined;
    if (type === 'KAS') {
      parent = items.find(i => i.nama.toLowerCase().includes("kas dan bank") || i.nama.toLowerCase() === "kas");
    } else if (type === 'BIAYA_PENJUALAN') {
      parent = items.find(i => i.nama.toLowerCase() === "biaya penjualan" || i.nama.toLowerCase().includes("beban penjualan"));
    } else if (type === 'BIAYA_UMUM') {
      parent = items.find(i => i.nama.toLowerCase() === "biaya umum dan administrasi" || i.nama.toLowerCase() === "biaya umum" || i.nama.toLowerCase() === "beban umum");
      if (!parent) parent = items.find(i => i.nama.toLowerCase().includes("biaya operasional"));
    } else if (type === 'HPP') {
      parent = items.find(i => i.nama.toLowerCase().includes("pokok penjualan") || i.nama.toLowerCase() === "hpp");
    }

    if (!parent) {
      Alert.alert('Info', `Grup induk otomatis untuk template ini tidak ditemukan. Gunakan mode manual (KUSTOM).`);
      return;
    }

    const children = items.filter((i) => i.kode_induk === parent?.kode);
    const newKode = generateNewKode(parent.kode, children);

    setFormData({
      editMode: false,
      kodeInduk: parent.kode,
      depth: parent.depth + 1,
      kode: newKode,
      nama: '',
      stop: true,
      lock: null,
      originalDepth: 0,
      originalKode: '',
      originalKodeInduk: '',
    });
    
    setShowTemplateModal(false);
    setShowModal(true);
  };

  const renderTree = (kodeInduk: string, depth: number) => {
    let children = items.filter((item) => depth === 1 ? item.depth === 1 : item.kode_induk === kodeInduk);
    
    // Filter out items not matching search query if query exists and node is not explicitly expanded because of its parent
    if (query && !expandedNodes.has(kodeInduk) && kodeInduk !== '') {
       // if we are searching, we only show nodes that are in the expandedNodes path
       children = children.filter(item => expandedNodes.has(item.kode));
    }

    if (children.length === 0) return null;

    return children.map((item) => {
      const isExpanded = expandedNodes.has(item.kode);
      const hasChild = hasChildren(item.kode);
      
      const isFilteredOut = query && !expandedNodes.has(item.kode) && !item.nama.toLowerCase().includes(query.toLowerCase()) && !item.kode.toLowerCase().includes(query.toLowerCase());
      
      // if searching, skip nodes that don't match and aren't parents of matches
      if (query && isFilteredOut) return null;

      return (
        <View key={item.kode} style={{ marginLeft: depth === 1 ? 0 : 20 }}>
          <TouchableOpacity
            style={[
              styles.itemRow,
              item.lock ? styles.itemRowLocked : (depth === 1 ? styles.itemRowRoot : styles.itemRowChild)
            ]}
            onPress={() => {
              if (hasChild) {
                toggleNode(item.kode);
              } else {
                setSelectedItem(item);
                setShowActionSheet(true);
              }
            }}
            onLongPress={() => {
              setSelectedItem(item);
              setShowActionSheet(true);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {hasChild && (
                <Ionicons
                  name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={item.lock ? '#6b7280' : '#d97706'}
                  style={{ marginRight: 8, width: 20 }}
                />
              )}
              {!hasChild && <View style={{ width: 28 }} />}
              
              <Text style={[styles.itemKode, item.lock && { color: '#6b7280' }]}>
                {item.kode}
              </Text>
              <Text style={[styles.itemNama, item.lock && { color: '#6b7280' }]} numberOfLines={1}>
                {item.nama}
              </Text>
              
              {item.stop ? (
                <View style={styles.badgeStop}>
                  <Text style={styles.badgeStopText}>STOP</Text>
                </View>
              ) : null}
              {item.lock ? (
                <Ionicons name="lock-closed" size={14} color="#6b7280" style={{ marginLeft: 6 }} />
              ) : null}
            </View>
          </TouchableOpacity>

          {isExpanded && renderTree(item.kode, depth + 1)}
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bagan Akun</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={fetchItems}>
            <Ionicons name="refresh" size={24} color="#f59e0b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari kode atau nama akun..."
            value={query}
            onChangeText={handleSearch}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={{ padding: 16 }}>
            {renderTree('', 1)}
            
            {items.length === 0 && !loading && (
              <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 20 }}>
                Belum ada data bagan akun
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={openAddWizard}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionSheet(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>{selectedItem?.nama}</Text>
              <Text style={styles.actionSheetSubtitle}>Kode: {selectedItem?.kode}</Text>
            </View>
            
            {!selectedItem?.lock && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  setShowActionSheet(false);
                  setFormData({
                    editMode: true,
                    kode: selectedItem!.kode,
                    kodeInduk: selectedItem!.kode_induk,
                    nama: selectedItem!.nama,
                    depth: selectedItem!.depth,
                    stop: !!selectedItem!.stop,
                    lock: selectedItem!.lock,
                    originalKode: selectedItem!.kode,
                    originalKodeInduk: selectedItem!.kode_induk,
                    originalDepth: selectedItem!.depth,
                  });
                  setShowModal(true);
                }}
              >
                <Ionicons name="create-outline" size={22} color="#2563eb" />
                <Text style={styles.actionText}>Edit Akun</Text>
              </TouchableOpacity>
            )}

            {!selectedItem?.lock && (
              <TouchableOpacity style={styles.actionItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color="#dc2626" />
                <Text style={[styles.actionText, { color: '#dc2626' }]}>Hapus Akun</Text>
              </TouchableOpacity>
            )}
            
            {selectedItem?.lock && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Ionicons name="lock-closed" size={32} color="#9ca3af" />
                <Text style={{ color: '#6b7280', marginTop: 10 }}>Akun sistem tidak dapat diubah</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.actionItem, styles.cancelItem]} onPress={() => setShowActionSheet(false)}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Template Wizard Modal */}
      <Modal visible={showTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.wizardCard}>
            <View style={styles.wizardHeader}>
              <Text style={styles.wizardTitle}>✨ Buat Akun Baru</Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={{ color: '#4b5563', marginBottom: 16 }}>
              Pilih template cepat untuk membuat akun yang umum digunakan, atau gunakan mode KUSTOM untuk pengaturan manual.
            </Text>

            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity style={styles.templateBtn} onPress={() => selectTemplate('KUSTOM')}>
                <View style={[styles.iconCircle, { backgroundColor: '#f3f4f6' }]}>
                  <Ionicons name="build" size={20} color="#4b5563" />
                </View>
                <View>
                  <Text style={styles.templateBtnTitle}>⚙️ Kustom / Bebas</Text>
                  <Text style={styles.templateBtnSub}>Atur grup induk & properti sendiri</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.templateBtn} onPress={() => selectTemplate('KAS')}>
                <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="wallet" size={20} color="#16a34a" />
                </View>
                <View>
                  <Text style={styles.templateBtnTitle}>💳 Kas & Bank</Text>
                  <Text style={styles.templateBtnSub}>Rekening Bank, Kas Tunai</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.templateBtn} onPress={() => selectTemplate('BIAYA_UMUM')}>
                <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="receipt" size={20} color="#dc2626" />
                </View>
                <View>
                  <Text style={styles.templateBtnTitle}>🏢 Biaya Umum & Admin</Text>
                  <Text style={styles.templateBtnSub}>Gaji, Listrik, Sewa, Alat Tulis</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.templateBtn} onPress={() => selectTemplate('BIAYA_PENJUALAN')}>
                <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="megaphone" size={20} color="#d97706" />
                </View>
                <View>
                  <Text style={styles.templateBtnTitle}>🛍️ Biaya Penjualan</Text>
                  <Text style={styles.templateBtnSub}>Iklan, Komisi, Ongkir Penjualan</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Form Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.wizardCard, { width: '90%' }]}>
            <View style={styles.wizardHeader}>
              <Text style={styles.wizardTitle}>
                {formData.editMode ? '✍️ Edit Akun' : '📝 Detail Akun'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Group Induk Picker */}
              <Text style={styles.formLabel}>Grup / Kategori Induk</Text>
              <View style={[styles.inputContainer, formData.editMode && { backgroundColor: '#f3f4f6' }]}>
                {/* Note: In a real app, you might want to use a better dropdown like react-native-dropdown-picker */}
                {formData.editMode ? (
                  <Text style={{ padding: 12, color: '#6b7280' }}>
                    {items.find(i => i.kode === formData.kodeInduk)?.nama || 'Root (Top Level)'}
                  </Text>
                ) : (
                  <Picker
                    selectedValue={formData.kodeInduk}
                    onValueChange={(val) => {
                      const parent = items.find((i) => i.kode === val);
                      if (!parent) {
                        setFormData((prev) => ({ ...prev, kodeInduk: val, depth: 1 }));
                        return;
                      }
                      const children = items.filter((i) => i.kode_induk === parent.kode);
                      const newKode = generateNewKode(parent.kode, children);
                      setFormData((prev) => ({
                        ...prev,
                        kodeInduk: parent.kode,
                        depth: parent.depth + 1,
                        kode: newKode,
                        stop: true,
                      }));
                    }}
                    enabled={!formData.editMode}
                    style={{ height: 50 }}
                  >
                    <Picker.Item label="--- Jadikan Grup Utama (Root) ---" value="" />
                    {items.map((it) => (
                      <Picker.Item
                        key={it.kode}
                        label={`${it.kode} - ${it.nama}`}
                        value={it.kode}
                      />
                    ))}
                  </Picker>
                )}
              </View>

              <Text style={styles.formLabel}>Kode Akun</Text>
              <TextInput
                style={styles.inputContainer}
                value={formData.kode}
                onChangeText={(t) => setFormData((p) => ({ ...p, kode: t }))}
                placeholder="Contoh: 111.2"
                editable={!formData.editMode}
              />

              <Text style={styles.formLabel}>Nama Akun</Text>
              <TextInput
                style={styles.inputContainer}
                value={formData.nama}
                onChangeText={(t) => setFormData((p) => ({ ...p, nama: t }))}
                placeholder="Masukkan Nama Akun"
              />

              {/* Checkbox Bukan Induk (STOP) */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setFormData((p) => ({ ...p, stop: !p.stop }))}
              >
                <View style={[styles.checkbox, formData.stop && styles.checkboxChecked]}>
                  {formData.stop && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
                <View>
                  <Text style={styles.checkboxLabel}>Bukan Induk / Bisa Transaksi (STOP)</Text>
                  <Text style={{ fontSize: 11, color: '#6b7280' }}>
                    Centang jika akun ini akan digunakan untuk posting transaksi.
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel, { flex: 1 }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave, { flex: 1 }]}
                onPress={handleSave}
                disabled={formSaving}
              >
                {formSaving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.btnSaveText}>Simpan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  hamburgerButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38, alignItems: 'center' },
  searchContainer: { padding: 12, backgroundColor: 'white' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' },
  listContainer: { flex: 1 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemRowRoot: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  itemRowChild: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
  },
  itemRowLocked: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    elevation: 0,
  },
  itemKode: { fontSize: 14, fontWeight: 'bold', color: '#b45309', marginRight: 8, minWidth: 40 },
  itemNama: { fontSize: 14, color: '#1f2937', flex: 1 },
  badgeStop: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  badgeStopText: { fontSize: 10, fontWeight: 'bold', color: '#dc2626' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  actionSheetHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  actionSheetTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  actionSheetSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 12 },
  actionText: { fontSize: 16, color: '#111827' },
  cancelItem: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 },
  cancelText: { fontSize: 16, color: '#dc2626', fontWeight: '600', textAlign: 'center', flex: 1 },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  wizardCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  wizardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  wizardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  templateBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  templateBtnTitle: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  templateBtnSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  inputContainer: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#d1d5db', marginRight: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  checkboxChecked: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  checkboxLabel: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  
  btn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  btnSave: { backgroundColor: '#f59e0b' },
  btnCancelText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  btnSaveText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
