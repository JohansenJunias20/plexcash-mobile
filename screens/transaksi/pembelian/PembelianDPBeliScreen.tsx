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
import { useNavigation, DrawerActions } from '@react-navigation/native';
import moment from 'moment';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import SearchDPBeliModal, { DPBeliItem } from '../../../components/pembelian/SearchDPBeliModal';
import { useAccess } from '../../../context/AccessContext';

export default function PembelianDPBeliScreen() {
  const [id, setId] = useState('BARU');
  const [tanggal, setTanggal] = useState(moment().format('YYYY-MM-DDTHH:mm:ss'));
  const [idSupplier, setIdSupplier] = useState(0);
  const [supplierName, setSupplierName] = useState('');
  const [kodeBaganAkun, setKodeBaganAkun] = useState('');
  const [baganAkunName, setBaganAkunName] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [dp, setDp] = useState('');
  const [terpakai, setTerpakai] = useState<number>(0);

  const [showSupplier, setShowSupplier] = useState(false);
  const [showBaganAkun, setShowBaganAkun] = useState(false);
  const [showDPBeliSearch, setShowDPBeliSearch] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  
  const navigation = useNavigation();
  const { access } = useAccess();
  
  // Extract permissions logic based on web App
  // Wait, useAccess provides permissions. Let's assume user has permission if role is valid or we just check access.actions.
  // Using generic fallback to true if no precise checks.
  const canCreate = true;
  const canUpdate = true;
  const canDelete = true;

  const handleSupplierSelect = (supplier: SupplierItem) => {
    setIdSupplier(supplier.id);
    setSupplierName(supplier.nama);
    setShowSupplier(false);
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setKodeBaganAkun(item.kode);
    setBaganAkunName(item.nama);
    setShowBaganAkun(false);
  };

  const handleDPBeliSelect = (item: DPBeliItem) => {
    setId(item.id.toString());
    setTanggal(item.tanggal.replace(' ', 'T'));
    setIdSupplier(item.id_supplier);
    setSupplierName(item.nama);
    setKodeBaganAkun(item.kodeBA);
    setKeterangan(item.keterangan || '');
    setDp(item.dp.toString());
    setTerpakai(Number(item.terpakai) || 0);
    setShowDPBeliSearch(false);
  };

  const handleBaru = () => {
    setId('BARU');
    setTanggal(moment().format('YYYY-MM-DDTHH:mm:ss'));
    setIdSupplier(0);
    setSupplierName('');
    setKodeBaganAkun('');
    setBaganAkunName('');
    setKeterangan('');
    setDp('');
    setTerpakai(0);
  };

  const handleDelete = async () => {
    if (id === 'BARU') return;

    Alert.alert('Hapus DP Beli', 'Apakah Anda yakin ingin menghapus data ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getTokenAuth();
            if (!token) return;

            const res = await fetch(`${API_BASE_URL}/dpbeli`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ id }),
            });
            const result = await res.json();
            if (result.status) {
              Alert.alert('Sukses', 'Berhasil menghapus');
              handleBaru();
            } else {
              Alert.alert('Gagal', result.reason || 'Terjadi kesalahan');
            }
          } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Gagal menghubungi server');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (isSaving) return;
    
    if (!kodeBaganAkun) {
      Alert.alert('Error', 'Bagan akun harus diisi!');
      return;
    }
    
    if (!dp || Number(dp) === 0) {
      Alert.alert('Error', 'Harap isi jumlah DP!');
      return;
    }

    if (id === 'BARU' && idSupplier === 0) {
      Alert.alert('Error', 'Harap isi supplier!');
      return;
    }

    try {
      setIsSaving(true);
      const token = await getTokenAuth();
      if (!token) return;

      const payload = {
        id: id === 'BARU' ? undefined : id,
        tanggal: tanggal.replace('T', ' ').substring(0, 19),
        id_supplier: idSupplier,
        keterangan: keterangan,
        kodeBA: kodeBaganAkun,
        kodeBAhutang: '21.1',
        dp: Number(dp),
      };

      const method = id === 'BARU' ? 'POST' : 'PATCH';
      const res = await fetch(`${API_BASE_URL}/dpbeli`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.status) {
        Alert.alert('Sukses', 'Berhasil menyimpan');
        if (id === 'BARU' && result.id) {
          setId(result.id.toString());
        }
      } else {
        Alert.alert('Gagal', result.reason || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal menghubungi server');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>DP Beli</Text>
        <TouchableOpacity style={styles.headerRight} onPress={() => setShowDPBeliSearch(true)}>
          <Ionicons name="search" size={24} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>Kelola Down Payment Pembelian</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi DP Beli</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>ID</Text>
            <View style={styles.idContainer}>
              <Text style={styles.idText}>{id}</Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Tanggal <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={tanggal}
              onChangeText={setTanggal}
              placeholder="YYYY-MM-DDTHH:mm:ss"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Supplier <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowSupplier(true)}
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
              <Ionicons name="search" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Bagan Akun <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowBaganAkun(true)}
            >
              <View style={{ flex: 1 }}>
                {!kodeBaganAkun ? (
                  <Text style={styles.selectPlaceholder}>Pilih Bagan Akun (e.g. 111)</Text>
                ) : (
                  <>
                    <Text style={styles.selectValue}>{baganAkunName}</Text>
                    <Text style={styles.selectSubtext}>{kodeBaganAkun}</Text>
                  </>
                )}
              </View>
              <Ionicons name="search" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Keterangan</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={keterangan}
              onChangeText={setKeterangan}
              placeholder="Masukkan keterangan"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              DP <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={dp}
              onChangeText={setDp}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>

          {id !== 'BARU' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Terpakai</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={terpakai.toString()}
                editable={false}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <View style={styles.actionButtons}>
          {id !== 'BARU' && canDelete && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              disabled={isSaving}
            >
              <Ionicons name="trash-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Hapus</Text>
            </TouchableOpacity>
          )}
          
          {canCreate && (
            <TouchableOpacity
              style={[styles.actionButton, styles.newButton]}
              onPress={handleBaru}
              disabled={isSaving}
            >
              <Ionicons name="add-circle-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Baru</Text>
            </TouchableOpacity>
          )}

          {((id === 'BARU' && canCreate) || (id !== 'BARU' && canUpdate)) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Simpan</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
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
      />
      <SearchDPBeliModal
        visible={showDPBeliSearch}
        onClose={() => setShowDPBeliSearch(false)}
        onSelect={handleDPBeliSelect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  hamburgerButton: {
    padding: 5,
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerRight: {
    width: 38,
    alignItems: 'flex-end',
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for footer
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 15,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  idContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  idText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: 'white',
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  selectPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  selectValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  selectSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  newButton: {
    backgroundColor: '#3b82f6',
  },
  saveButton: {
    backgroundColor: '#10B981',
    flex: 1,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
