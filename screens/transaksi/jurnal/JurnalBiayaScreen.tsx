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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import IntervalDatePicker from '../../../components/pembelian/IntervalDatePicker';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import { useAuth } from '../../../context/AuthContext';

interface JurnalItem {
  id: number;
  tanggal: string;
  keterangan: string;
  totalDebit: number;
  totalKredit: number;
  changed?: boolean;
}

export default function JurnalBiayaScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  // Form State
  const [tambahTanggal, setTambahTanggal] = useState('');
  const [tambahKeterangan, setTambahKeterangan] = useState('');
  const [tambahNominal, setTambahNominal] = useState('');
  
  const [biaya, setBiaya] = useState<{ kode: string; nama: string }>({ kode: '', nama: '' });
  const [kas, setKas] = useState<{ kode: string; nama: string }>({ kode: '', nama: '' });

  // Riwayat State
  const [intervalDate, setIntervalDate] = useState({ start: '', end: '' });
  const [showIntervalPicker, setShowIntervalPicker] = useState(true);
  const [riwayat, setRiwayat] = useState<JurnalItem[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal State
  const [showBiayaModal, setShowBiayaModal] = useState(false);
  const [showKasModal, setShowKasModal] = useState(false);

  // Edit Riwayat State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<{ tanggal: string; keterangan: string }>({ tanggal: '', keterangan: '' });

  // Initialize date on mount
  useEffect(() => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
    setTambahTanggal(formattedDate);
  }, []);

  const loadRiwayat = async (start: string, end: string) => {
    try {
      setLoadingRiwayat(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/get/jurnal/interval/${start}/${end}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.status) {
        const biayaItems: JurnalItem[] = [];
        
        // Fetch details to verify it's a Biaya
        // For mobile performance, we could theoretically just fetch and filter
        for (let item of data.data) {
          try {
            const detailRes = await fetch(`${API_BASE_URL}/get/jurnaldetail/condition/and/id_jurnal:equal:${item.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const detailData = await detailRes.json();
            
            if (detailData.status && detailData.data) {
              const isBiaya = detailData.data.some((d: any) => d.kodeBA && String(d.kodeBA).startsWith('6'));
              if (isBiaya) {
                biayaItems.push({
                  id: item.id,
                  tanggal: item.tanggal.replace(' ', 'T'),
                  keterangan: item.keterangan || '',
                  totalDebit: item.totalDebit || 0,
                  totalKredit: item.totalKredit || 0,
                  changed: false
                });
              }
            }
          } catch (e) {
            console.error('Error fetching detail for jurnal', item.id, e);
          }
        }

        biayaItems.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
        setRiwayat(biayaItems);
      } else {
        Alert.alert('Error', data.reason || 'Failed to load riwayat');
      }
    } catch (error) {
      console.error('Load riwayat error:', error);
      Alert.alert('Error', 'Failed to load riwayat');
    } finally {
      setLoadingRiwayat(false);
    }
  };

  const handleIntervalOK = (start: string, end: string) => {
    setIntervalDate({ start, end });
    setShowIntervalPicker(false);
    loadRiwayat(start, end);
  };

  const handleSimpan = async () => {
    if (!tambahTanggal) return Alert.alert('Error', 'Tanggal harus diisi');
    if (!biaya.kode) return Alert.alert('Error', 'Pilih Biaya Operasional');
    if (!kas.kode) return Alert.alert('Error', 'Pilih Sumber Dana (Kas/Bank)');
    
    const nominalNum = parseFloat(tambahNominal);
    if (isNaN(nominalNum) || nominalNum <= 0) return Alert.alert('Error', 'Nominal tidak valid');

    try {
      setSaving(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const payload = {
        tanggal: tambahTanggal.replace('T', ' '),
        keterangan: tambahKeterangan || biaya.nama,
        items: [
          {
            kodeBA: biaya.kode,
            keterangan: biaya.nama,
            debit: nominalNum,
            kredit: 0,
          },
          {
            kodeBA: kas.kode,
            keterangan: kas.nama,
            debit: 0,
            kredit: nominalNum,
          },
        ],
      };

      const res = await fetch(`${API_BASE_URL}/jurnal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (resData.status) {
        Alert.alert('Sukses', 'Berhasil menambah biaya operasional');
        
        // Reset form
        setTambahKeterangan('');
        setBiaya({ kode: '', nama: '' });
        setKas({ kode: '', nama: '' });
        setTambahNominal('');
        
        // Refresh riwayat
        if (intervalDate.start && intervalDate.end) {
          loadRiwayat(intervalDate.start, intervalDate.end);
        }
      } else {
        Alert.alert('Error', resData.reason || 'Gagal menyimpan biaya');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleEditRiwayat = (index: number) => {
    const item = riwayat[index];
    setEditingIndex(index);
    setEditData({
      tanggal: item.tanggal,
      keterangan: item.keterangan,
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleSaveEditRiwayat = async (index: number) => {
    const item = riwayat[index];
    try {
      const token = await getTokenAuth();
      if (!token) return Alert.alert('Error', 'Session expired');

      const payload = {
        id: item.id,
        tanggal: editData.tanggal.replace('T', ' '),
        keterangan: editData.keterangan,
      };

      const res = await fetch(`${API_BASE_URL}/jurnal`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (resData.status) {
        Alert.alert('Sukses', 'Data berhasil diperbarui');
        setEditingIndex(null);
        if (intervalDate.start && intervalDate.end) {
          loadRiwayat(intervalDate.start, intervalDate.end);
        }
      } else {
        Alert.alert('Error', resData.reason || 'Gagal update data');
      }
    } catch (error) {
      Alert.alert('Error', 'Terjadi kesalahan');
    }
  };

  const handleDeleteRiwayat = (id: number) => {
    Alert.alert(
      'Hapus Biaya',
      'Apakah Anda yakin ingin menghapus catatan biaya ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getTokenAuth();
              if (!token) return;

              const res = await fetch(`${API_BASE_URL}/jurnal`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id }),
              });

              const resData = await res.json();
              if (resData.status) {
                Alert.alert('Sukses', 'Biaya berhasil dihapus');
                setRiwayat(riwayat.filter(item => item.id !== id));
              } else {
                Alert.alert('Error', resData.reason || 'Gagal menghapus data');
              }
            } catch (error) {
              Alert.alert('Error', 'Terjadi kesalahan');
            }
          }
        }
      ]
    );
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('id-ID');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (showIntervalPicker) {
    return <IntervalDatePicker visible={showIntervalPicker} onOK={handleIntervalOK} />;
  }

  const renderRiwayatItem = ({ item, index }: { item: JurnalItem; index: number }) => {
    const isEditing = editingIndex === index;

    if (isEditing) {
      return (
        <View style={styles.riwayatCard}>
          <View style={styles.riwayatHeader}>
            <Text style={styles.riwayatId}>#{item.id}</Text>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Tanggal</Text>
            <TextInput
              style={styles.input}
              value={editData.tanggal}
              onChangeText={(val) => setEditData({ ...editData, tanggal: val })}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Keterangan</Text>
            <TextInput
              style={styles.input}
              value={editData.keterangan}
              onChangeText={(val) => setEditData({ ...editData, keterangan: val })}
            />
          </View>
          <View style={styles.editActions}>
            <TouchableOpacity style={[styles.editBtn, styles.cancelBtn]} onPress={handleCancelEdit}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editBtn, styles.saveBtn]} onPress={() => handleSaveEditRiwayat(index)}>
              <Text style={styles.saveBtnText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.riwayatCard}>
        <View style={styles.riwayatHeader}>
          <Text style={styles.riwayatId}>#{item.id}</Text>
          <Text style={styles.riwayatNominal}>Rp {formatCurrency(item.totalDebit)}</Text>
        </View>
        <View style={styles.riwayatContent}>
          <Text style={styles.riwayatDate}><Ionicons name="calendar-outline" size={14} /> {formatDate(item.tanggal)}</Text>
          <Text style={styles.riwayatDesc} numberOfLines={2}>{item.keterangan}</Text>
        </View>
        <View style={styles.riwayatActions}>
          <TouchableOpacity style={[styles.actionBtn, styles.editAction]} onPress={() => handleEditRiwayat(index)}>
            <Ionicons name="create-outline" size={18} color="#3b82f6" />
            <Text style={styles.editActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteAction]} onPress={() => handleDeleteRiwayat(item.id)}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={styles.deleteActionText}>Hapus</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.hamburgerButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Biaya Operasional</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Tambah Biaya Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tambah Biaya Baru</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Tanggal</Text>
            <TextInput
              style={styles.input}
              value={tambahTanggal}
              onChangeText={setTambahTanggal}
              placeholder="YYYY-MM-DDTHH:mm:ss"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Pilih Biaya (Kode 6)</Text>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowBiayaModal(true)}>
              <Text style={biaya.kode ? styles.selectorText : styles.selectorPlaceholder}>
                {biaya.kode ? `${biaya.kode} - ${biaya.nama}` : 'Pilih Biaya Operasional'}
              </Text>
              <Ionicons name="search" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Sumber Dana (Kas/Bank - Kode 111)</Text>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowKasModal(true)}>
              <Text style={kas.kode ? styles.selectorText : styles.selectorPlaceholder}>
                {kas.kode ? `${kas.kode} - ${kas.nama}` : 'Pilih Kas / Bank'}
              </Text>
              <Ionicons name="search" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nominal (Rp)</Text>
            <TextInput
              style={styles.input}
              value={tambahNominal}
              onChangeText={setTambahNominal}
              placeholder="Masukkan Nominal"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Keterangan (Opsional)</Text>
            <TextInput
              style={styles.input}
              value={tambahKeterangan}
              onChangeText={setTambahKeterangan}
              placeholder="Catatan tambahan"
            />
          </View>

          <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={handleSimpan} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : (
              <>
                <Ionicons name="save-outline" size={20} color="white" />
                <Text style={styles.submitBtnText}>Simpan Biaya</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Riwayat Card */}
        <View style={styles.card}>
          <View style={styles.riwayatCardHeader}>
            <Text style={styles.cardTitle}>Riwayat Biaya Berjalan</Text>
            <TouchableOpacity style={styles.changeDateBtn} onPress={() => setShowIntervalPicker(true)}>
              <Ionicons name="calendar" size={18} color="#f59e0b" />
            </TouchableOpacity>
          </View>
          <Text style={styles.riwayatSubtitle}>
            {formatDate(intervalDate.start)} - {formatDate(intervalDate.end)}
          </Text>

          {loadingRiwayat ? (
            <ActivityIndicator size="large" color="#f59e0b" style={{ marginVertical: 20 }} />
          ) : riwayat.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada data biaya pada periode ini.</Text>
          ) : (
            <FlatList
              data={riwayat}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRiwayatItem}
              scrollEnabled={false}
            />
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Modals */}
      <SearchBaganAkunModal
        visible={showBiayaModal}
        onClose={() => setShowBiayaModal(false)}
        onSelect={(item) => {
          setBiaya({ kode: item.kode, nama: item.nama });
          setShowBiayaModal(false);
        }}
        shows={['6']}
      />

      <SearchBaganAkunModal
        visible={showKasModal}
        onClose={() => setShowKasModal(false)}
        onSelect={(item) => {
          setKas({ kode: item.kode, nama: item.nama });
          setShowKasModal(false);
        }}
        shows={['111']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb'
  },
  hamburgerButton: { padding: 5 },
  topHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
  scrollContainer: { padding: 16 },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#111827'
  },
  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  selectorText: { fontSize: 14, color: '#111827' },
  selectorPlaceholder: { fontSize: 14, color: '#9ca3af' },
  submitBtn: {
    flexDirection: 'row', backgroundColor: '#10b981', paddingVertical: 14,
    borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 8
  },
  submitBtnDisabled: { backgroundColor: '#d1d5db' },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  
  riwayatCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeDateBtn: { padding: 8, backgroundColor: '#fef3c7', borderRadius: 8 },
  riwayatSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#6b7280', padding: 20 },
  
  riwayatCard: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, padding: 12, marginBottom: 12
  },
  riwayatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  riwayatId: { fontSize: 14, fontWeight: '700', color: '#111827' },
  riwayatNominal: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
  riwayatContent: { marginBottom: 12, gap: 4 },
  riwayatDate: { fontSize: 13, color: '#4b5563' },
  riwayatDesc: { fontSize: 14, color: '#111827' },
  riwayatActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, borderRadius: 6, gap: 6 },
  editAction: { backgroundColor: '#eff6ff' },
  editActionText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  deleteAction: { backgroundColor: '#fee2e2' },
  deleteActionText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  
  editActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  editBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 6 },
  cancelBtn: { backgroundColor: '#e5e7eb' },
  cancelBtnText: { color: '#4b5563', fontWeight: '600' },
  saveBtn: { backgroundColor: '#10b981' },
  saveBtnText: { color: 'white', fontWeight: '600' }
});
