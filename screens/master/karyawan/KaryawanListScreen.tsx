import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService from '../../../services/api';
import type { AppStackParamList } from '../../../navigation/RootNavigator';

export type KaryawanItem = {
  id: number;
  nama: string;
  id_absensi: number | null;
  device_user_id: string | null;
  kodeBAgaji?: string;
  kodeBApiutang?: string;
  pin_hash?: string | null;
};

type Nav = NativeStackNavigationProp<AppStackParamList, 'KaryawanList'>;

export default function KaryawanListScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<KaryawanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  // PIN modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedKaryawan, setSelectedKaryawan] = useState<KaryawanItem | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const fetchKaryawan = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ApiService.authenticatedRequest('/get/karyawan');
      if (res?.status && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('Error fetching karyawan:', e);
      Alert.alert('Error', 'Gagal memuat data karyawan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKaryawan();
  }, [fetchKaryawan]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchKaryawan();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.nama?.toLowerCase().includes(q) ||
        (it.id_absensi && String(it.id_absensi).includes(q)) ||
        (it.device_user_id && it.device_user_id.toLowerCase().includes(q))
    );
  }, [query, items]);

  const confirmDelete = (item: KaryawanItem) => {
    Alert.alert(
      'Hapus Karyawan',
      `Yakin ingin menghapus karyawan "${item.nama}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await ApiService.authenticatedRequest('/karyawan', {
                method: 'DELETE',
                body: JSON.stringify({ data: [{ id: item.id }] }),
              });
              if (res?.status) {
                Alert.alert('Sukses', 'Karyawan berhasil dihapus');
                fetchKaryawan();
              } else {
                Alert.alert('Gagal', res?.reason || 'Gagal menghapus karyawan');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Terjadi kesalahan saat menghapus');
            }
          },
        },
      ]
    );
  };

  const openPinModal = (item: KaryawanItem) => {
    setSelectedKaryawan(item);
    setNewPin('');
    setConfirmPin('');
    setPinModalVisible(true);
  };

  const handleSavePin = async () => {
    if (!selectedKaryawan) return;

    if (!newPin || newPin.length !== 6) {
      Alert.alert('Validasi', 'PIN harus 6 digit angka');
      return;
    }

    if (!/^\d{6}$/.test(newPin)) {
      Alert.alert('Validasi', 'PIN hanya boleh berisi angka');
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert('Validasi', 'Konfirmasi PIN tidak cocok');
      return;
    }

    try {
      setSavingPin(true);
      const res = await ApiService.authenticatedRequest('/api/karyawan/pin/set', {
        method: 'POST',
        body: JSON.stringify({
          id_karyawan: selectedKaryawan.id,
          pin: newPin,
        }),
      });

      if (res?.status) {
        Alert.alert('Sukses', 'PIN karyawan berhasil diatur');
        setPinModalVisible(false);
        fetchKaryawan();
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal mengatur PIN');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat mengatur PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const renderItem = ({ item }: { item: KaryawanItem }) => {
    const hasPin = Boolean(item.pin_hash);

    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.nama ? item.nama.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.nama} numberOfLines={1}>
              {item.nama}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.badge}>
                <Ionicons name="finger-print" size={12} color="#0284c7" />
                <Text style={styles.badgeText}>
                  ID: {item.id_absensi !== null ? item.id_absensi : '-'}
                </Text>
              </View>
              {item.device_user_id ? (
                <View style={[styles.badge, styles.badgeDevice]}>
                  <Ionicons name="hardware-chip-outline" size={12} color="#7c3aed" />
                  <Text style={[styles.badgeText, styles.badgeDeviceText]}>
                    {item.device_user_id}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.badge,
                  hasPin ? styles.badgePinSet : styles.badgeNoPin,
                ]}
              >
                <Ionicons
                  name={hasPin ? 'lock-closed' : 'lock-open-outline'}
                  size={12}
                  color={hasPin ? '#16a34a' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.badgeText,
                    hasPin ? styles.badgePinSetText : styles.badgeNoPinText,
                  ]}
                >
                  {hasPin ? 'PIN Aktif' : 'No PIN'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.pinBtn]}
            onPress={() => openPinModal(item)}
          >
            <Ionicons name="key-outline" size={15} color="#4b5563" />
            <Text style={styles.actionBtnText}>Atur PIN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => navigation.navigate('KaryawanEdit', { id: item.id })}
          >
            <Ionicons name="create-outline" size={15} color="#2563eb" />
            <Text style={[styles.actionBtnText, { color: '#2563eb' }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => confirmDelete(item)}
          >
            <Ionicons name="trash-outline" size={15} color="#dc2626" />
            <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Hapus</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={26} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Karyawan</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('KaryawanEdit', undefined)}
        >
          <Ionicons name="add" size={26} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari karyawan, ID absensi..."
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Employee List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f59e0b']} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {query ? 'Tidak ada karyawan yang cocok' : 'Belum ada data karyawan'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color="#f59e0b" />
            </View>
          ) : null
        }
      />

      {/* Set PIN Modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Atur PIN Karyawan
              </Text>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Karyawan: <Text style={{ fontWeight: '700' }}>{selectedKaryawan?.nama}</Text>
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PIN Baru (6 Digit Angka)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Contoh: 123456"
                value={newPin}
                onChangeText={setNewPin}
                keyboardType="numeric"
                maxLength={6}
                secureTextEntry
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Konfirmasi PIN</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ulangi 6 digit PIN"
                value={confirmPin}
                onChangeText={setConfirmPin}
                keyboardType="numeric"
                maxLength={6}
                secureTextEntry
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPinModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingPin && { opacity: 0.6 }]}
                disabled={savingPin}
                onPress={handleSavePin}
              >
                {savingPin ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Simpan PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB to Add Employee */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('KaryawanEdit', undefined)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' },
  listContent: { padding: 12, paddingBottom: 80 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#b45309' },
  info: { flex: 1 },
  nama: { fontSize: 15, fontWeight: '600', color: '#111827' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  badgeDevice: { backgroundColor: '#f3e8ff' },
  badgeDeviceText: { color: '#6b21a8' },
  badgePinSet: { backgroundColor: '#dcfce7' },
  badgePinSetText: { color: '#15803d' },
  badgeNoPin: { backgroundColor: '#f1f5f9' },
  badgeNoPinText: { color: '#64748b' },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fafafa',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  pinBtn: { borderRightWidth: 1, borderRightColor: '#e5e7eb' },
  editBtn: { borderRightWidth: 1, borderRightColor: '#e5e7eb' },
  deleteBtn: {},
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 10, fontSize: 14, color: '#9ca3af' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#4b5563', marginBottom: 14 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
  },
  modalSubmitText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
