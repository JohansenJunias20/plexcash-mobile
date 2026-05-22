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
import { useRoute, useNavigation, RouteProp, DrawerActions } from '@react-navigation/native';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import { useAuth } from '../../../context/AuthContext';

type RootStackParamList = {
  JurnalRincian: { id: number };
};

type JurnalRincianRouteProp = RouteProp<RootStackParamList, 'JurnalRincian'>;

interface JurnalData {
  id: number;
  tanggal: string;
  keterangan: string;
}

interface JurnalDetailItem {
  id_detail?: number;
  kodeBA: string;
  keterangan: string;
  debit: string;
  kredit: string;
}

export default function JurnalRincianScreen() {
  const route = useRoute<JurnalRincianRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const jurnalId = route.params?.id;

  // Data state
  const [data, setData] = useState<JurnalData>({
    id: 0,
    tanggal: '',
    keterangan: '',
  });
  const [itemDetails, setItemDetails] = useState<JurnalDetailItem[]>([]);

  // Modal state
  const [showBaganAkunModal, setShowBaganAkunModal] = useState(false);
  const [selectingBaganAkunIndex, setSelectingBaganAkunIndex] = useState<number | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (jurnalId) {
      loadData();
    }
  }, [jurnalId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      // Fetch jurnal header data
      const jurnalRes = await fetch(
        `${API_BASE_URL}/get/jurnal/condition/and/id:equal:${jurnalId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const jurnalData = await jurnalRes.json();

      // Fetch jurnal details
      const detailRes = await fetch(
        `${API_BASE_URL}/get/jurnaldetail/condition/and/id_jurnal:equal:${jurnalId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const detailData = await detailRes.json();

      if (jurnalData.status) {
        const jurnal = jurnalData.data[0];
        setData({
          id: jurnal.id,
          tanggal: jurnal.tanggal.replace(' ', 'T'),
          keterangan: jurnal.keterangan || '',
        });

        if (detailData.status && detailData.data) {
          const items = detailData.data.map((item: any) => ({
            id_detail: item.id,
            kodeBA: item.kodeBA || '',
            keterangan: item.keterangan || '',
            debit: item.debit ? String(item.debit) : '0',
            kredit: item.kredit ? String(item.kredit) : '0',
          }));
          setItemDetails(items);
        }
      } else {
        Alert.alert('Error', 'Failed to load jurnal data');
      }
    } catch (error) {
      console.error('Load data error:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    if (selectingBaganAkunIndex !== null) {
      const newItems = [...itemDetails];
      newItems[selectingBaganAkunIndex].kodeBA = item.kode;
      
      // Auto fill keterangan with bagan akun name if empty
      if (!newItems[selectingBaganAkunIndex].keterangan) {
        newItems[selectingBaganAkunIndex].keterangan = item.nama;
      }
      
      setItemDetails(newItems);
    }
    setShowBaganAkunModal(false);
    setSelectingBaganAkunIndex(null);
  };

  const openBaganAkunModal = (index: number) => {
    setSelectingBaganAkunIndex(index);
    setShowBaganAkunModal(true);
  };

  const handleUpdateItem = (index: number, field: keyof JurnalDetailItem, value: string) => {
    const newItems = [...itemDetails];
    
    // Numeric validation for debit/kredit
    if (field === 'debit' || field === 'kredit') {
      if (!/^\d*\.?\d*$/.test(value)) return;
      if (value === '') value = '0';
    }
    
    newItems[index] = { ...newItems[index], [field]: value };
    setItemDetails(newItems);
  };

  const handleAddItem = () => {
    const totalDebit = calculateTotalDebit();
    const totalKredit = calculateTotalKredit();
    const selisih = totalDebit - totalKredit;

    let debit = '0';
    let kredit = '0';

    if (selisih > 0) {
      kredit = Math.abs(selisih).toString();
    } else if (selisih < 0) {
      debit = Math.abs(selisih).toString();
    }

    setItemDetails([
      ...itemDetails,
      { kodeBA: '', keterangan: '', debit, kredit }
    ]);
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

  const calculateTotalDebit = (): number => {
    return itemDetails.reduce((total, item) => total + parseFloat(item.debit || '0'), 0);
  };

  const calculateTotalKredit = (): number => {
    return itemDetails.reduce((total, item) => total + parseFloat(item.kredit || '0'), 0);
  };

  const handleSave = async () => {
    const totalDebit = calculateTotalDebit();
    const totalKredit = calculateTotalKredit();

    // Validations
    const userEmail = (user as any)?.email;
    const isSuperAdmin = userEmail === 'johansen.junias17@gmail.com';

    if (!isSuperAdmin && totalDebit !== totalKredit) {
      Alert.alert('Peringatan', 'Total Debit dan Kredit harus seimbang (sama besar).');
      return;
    }

    if (itemDetails.length === 0) {
      Alert.alert('Peringatan', 'Silakan tambahkan minimal 1 item jurnal.');
      return;
    }

    if (!data.tanggal) {
      Alert.alert('Peringatan', 'Tanggal jurnal tidak boleh kosong.');
      return;
    }

    try {
      setSaving(true);
      const token = await getTokenAuth();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const payloadItems = itemDetails.map((item) => ({
        keterangan: item.keterangan,
        debit: parseFloat(item.debit || '0'),
        kredit: parseFloat(item.kredit || '0'),
        tanggal: data.tanggal.replace('T', ' '),
        kodeBA: item.kodeBA,
      }));

      const payload = {
        id: data.id,
        tanggal: data.tanggal.replace('T', ' '),
        keterangan: data.keterangan,
        items: payloadItems,
      };

      const res = await fetch(`${API_BASE_URL}/jurnaldetail`, {
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
        Alert.alert('Error', result.reason || 'Failed to save data');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save data');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('id-ID');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  const totalDebit = calculateTotalDebit();
  const totalKredit = calculateTotalKredit();
  const isBalanced = totalDebit === totalKredit;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Rincian Jurnal</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasi Jurnal</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID Jurnal:</Text>
            <Text style={styles.infoValue}>#{data.id}</Text>
          </View>

          {/* Tanggal - Editable */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Tanggal</Text>
            <TextInput
              style={styles.input}
              value={data.tanggal}
              onChangeText={(val) => setData({ ...data, tanggal: val })}
              placeholder="YYYY-MM-DDTHH:mm:ss"
            />
          </View>

          {/* Keterangan - Editable */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Keterangan</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={data.keterangan}
              onChangeText={(val) => setData({ ...data, keterangan: val })}
              placeholder="Keterangan Jurnal"
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Detail Jurnal ({itemDetails.length})</Text>
          </View>

          {itemDetails.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemIndexLabel}>Baris {index + 1}</Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteItem(index)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Kode Bagan Akun</Text>
                <TouchableOpacity
                  style={styles.searchSelectButton}
                  onPress={() => openBaganAkunModal(index)}
                >
                  <Text style={item.kodeBA ? styles.searchSelectTextValue : styles.searchSelectTextPlaceholder}>
                    {item.kodeBA || 'Pilih Bagan Akun'}
                  </Text>
                  <Ionicons name="search" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Keterangan</Text>
                <TextInput
                  style={styles.input}
                  value={item.keterangan}
                  onChangeText={(val) => handleUpdateItem(index, 'keterangan', val)}
                  placeholder="Keterangan"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, styles.flex1, { marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Debit (Rp)</Text>
                  <TextInput
                    style={styles.input}
                    value={item.debit}
                    onChangeText={(val) => handleUpdateItem(index, 'debit', val)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>

                <View style={[styles.formGroup, styles.flex1, { marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Kredit (Rp)</Text>
                  <TextInput
                    style={styles.input}
                    value={item.kredit}
                    onChangeText={(val) => handleUpdateItem(index, 'kredit', val)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddItem}
          >
            <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
            <Text style={styles.addButtonText}>Tambah Baris Jurnal</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ringkasan Saldo</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Debit:</Text>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>
              Rp {formatCurrency(totalDebit)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Kredit:</Text>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>
              Rp {formatCurrency(totalKredit)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>Status Saldo:</Text>
            <Text style={[
              styles.summaryValueBold,
              isBalanced ? { color: '#059669' } : { color: '#DC2626' }
            ]}>
              {isBalanced ? 'SEIMBANG' : 'TIDAK SEIMBANG'}
            </Text>
          </View>
          {!isBalanced && (
            <Text style={styles.warningText}>
              Selisih: Rp {formatCurrency(Math.abs(totalDebit - totalKredit))}
            </Text>
          )}
        </View>
        
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer / Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (saving || (!isBalanced && (user as any)?.email !== 'johansen.junias17@gmail.com')) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={saving || (!isBalanced && (user as any)?.email !== 'johansen.junias17@gmail.com')}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="white" />
              <Text style={styles.saveButtonText}>Simpan Jurnal</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <SearchBaganAkunModal
        visible={showBaganAkunModal}
        onClose={() => setShowBaganAkunModal(false)}
        onSelect={handleBaganAkunSelect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  hamburgerButton: { padding: 5 },
  topHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    width: 100,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  itemIndexLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  deleteButton: {
    padding: 4,
  },
  searchSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchSelectTextValue: {
    fontSize: 14,
    color: '#111827',
  },
  searchSelectTextPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summaryValueBold: {
    fontSize: 18,
    fontWeight: '700',
  },
  warningText: {
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    fontStyle: 'italic',
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
