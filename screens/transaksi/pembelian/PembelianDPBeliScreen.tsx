import React, { useState, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import SearchSupplierModal, { SupplierItem } from '../../../components/pembelian/SearchSupplierModal';
import SearchBaganAkunModal, { BaganAkunItem } from '../../../components/pembelian/SearchBaganAkunModal';
import SearchDPBeliModal, { DPBeliItem } from '../../../components/pembelian/SearchDPBeliModal';
import { useAccess } from '../../../context/AccessContext';
import AttachmentUploader, { DriveFile } from '../../../components/AttachmentUploader';

// ---------------------------------------------------------------------------
// State shape — mirrors the web interface exactly
// ---------------------------------------------------------------------------
interface Supplier {
  id: number;
  nama: string;
}

export default function PembelianDPBeliScreen() {
  // --- Core form state (matches web State interface) ---
  const [id, setId] = useState('BARU');
  const [tanggal, setTanggal] = useState(
    moment().format('YYYY-MM-DDTHH:mm:ss')
  );
  const [supplier, setSupplier] = useState<Supplier>({ id: 0, nama: '' });
  const [kodeBaganAkun, setKodeBaganAkun] = useState('111.2');
  const [keterangan, setKeterangan] = useState('');
  const [dp, setDp] = useState('');
  const [terpakai, setTerpakai] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isGDriveConnected, setIsGDriveConnected] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<DriveFile[]>([]);

  // --- Modal visibility ---
  const [showSupplier, setShowSupplier] = useState(false);
  const [showBaganAkun, setShowBaganAkun] = useState(false);
  const [showDPBeliSearch, setShowDPBeliSearch] = useState(false);

  // --- Date-time picker (mobile-native replacement for <input type="datetime-local">) ---
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  // Intermediate date object while the picker is open
  const [pickerDate, setPickerDate] = useState(new Date());

  const navigation = useNavigation();
  const { access } = useAccess();

  React.useEffect(() => {
    const checkGDriveStatus = async () => {
      try {
        const token = await getTokenAuth();
        const res = await fetch(`${API_BASE_URL}/google-drive/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setIsGDriveConnected(!!data.connected);
      } catch (e) {
        console.error("Failed to check Google Drive status:", e);
      }
    };
    checkGDriveStatus();
  }, []);

  // Permission flags read from context — identical to web's context.state.access.actions.*
  const canCreate = !!access.actions?.create;
  const canUpdate = !!access.actions?.update;
  const canDelete = !!access.actions?.delete;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /** Reset all fields to default values (web: tombol Baru, R5) */
  const handleBaru = () => {
    setId('BARU');
    setTanggal(moment().format('YYYY-MM-DDTHH:mm:ss'));
    setSupplier({ id: 0, nama: '' });
    setKodeBaganAkun('111.2');
    setKeterangan('');
    setDp('');
    setTerpakai(0);
    setPendingAttachments([]);
  };

  const handleSupplierSelect = (item: SupplierItem) => {
    setSupplier({ id: item.id, nama: item.nama });
    setShowSupplier(false);
  };

  const handleBaganAkunSelect = (item: BaganAkunItem) => {
    setKodeBaganAkun(item.kode);
    setShowBaganAkun(false);
  };

  /**
   * Called by SearchDPBeliModal ONLY when result.status == true (R10).
   * Populate form with selected item.
   */
  const handleDPBeliSelect = (item: DPBeliItem) => {
    setId(item.id.toString());
    setTanggal(item.tanggal.replace(' ', 'T'));        // "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm:ss"
    setSupplier({ id: item.id_supplier, nama: item.nama });
    setKodeBaganAkun(item.kodeBA);
    setKeterangan(item.keterangan || '');
    setDp(item.dp.toString());
    setTerpakai(Number(item.terpakai) || 0);
    setShowDPBeliSearch(false);
  };

  // ---------------------------------------------------------------------------
  // Date-time picker handling (mobile equivalent of <input type="datetime-local">)
  // ---------------------------------------------------------------------------

  const openDatePicker = () => {
    setPickerDate(new Date(tanggal));
    setDatePickerMode('date');
    setShowDatePicker(true);
  };

  const onDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (!selectedDate) return;

    if (datePickerMode === 'date') {
      // After picking date, open time picker
      setPickerDate(selectedDate);
      if (Platform.OS === 'android') {
        // Chain to time picker on Android
        setTimeout(() => {
          setDatePickerMode('time');
          setShowDatePicker(true);
        }, 100);
      } else {
        setDatePickerMode('time');
      }
    } else {
      // Time picked — save final value
      setPickerDate(selectedDate);
      setTanggal(moment(selectedDate).format('YYYY-MM-DDTHH:mm:ss'));
      setShowDatePicker(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete (R3: confirmation dialog as mobile alternative to double-click)
  // ---------------------------------------------------------------------------

  const handleDelete = () => {
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
              Alert.alert('Sukses', 'sukses menghapus');
              handleBaru(); // reset form after delete
            } else {
              Alert.alert(
                'Gagal',
                'Gagal menghapus: ' + (result.reason || 'Terjadi kesalahan')
              );
            }
          } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Gagal menghubungi server');
          }
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Save — validation + POST / PATCH (R1, R2, R6, R7)
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    // R6: guard against double-submit
    if (isSaving) return;

    // --- Validation (matches web exactly) ---
    if (kodeBaganAkun === '') {
      Alert.alert('', 'bagan akun harus diisi!');
      return;
    }

    if (id === 'BARU') {
      // POST validations
      if (supplier.id === 0 || supplier.id == null) {
        Alert.alert('', 'harap isi supplier');
        return;
      }
      if (kodeBaganAkun === '') {
        // Second check (mirrors web source)
        Alert.alert('', 'harap isi bagan akun');
        return;
      }
      if (dp === '0' || dp === '') {
        Alert.alert('', 'harap dp diisi');
        return;
      }
    }
    // (PATCH only needs kode_baganAkun check above)

    // R7: isSaving reset always in finally
    setIsSaving(true);
    try {
      const token = await getTokenAuth();
      if (!token) return;

      if (id === 'BARU') {
        // POST
        const res = await fetch(`${API_BASE_URL}/dpbeli`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tanggal: tanggal.replace('T', ' '),   // R1: space separator
            id_supplier: supplier.id,
            keterangan,
            kodeBA: kodeBaganAkun,
            kodeBAhutang: '21.1',                 // R2: hardcoded
            dp,
          }),
        });
        const result = await res.json();

        if (result.status) {
          Alert.alert('Sukses', 'sukses menyimpan');
          console.log(result);
          
          if (pendingAttachments.length > 0) {
            try {
              await fetch(`${API_BASE_URL}/google-drive/link-attachments`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  type: 'dp_beli',
                  transaction_id: result.id,
                  files: pendingAttachments,
                }),
              });
              setPendingAttachments([]);
            } catch (e) {
              console.error("Failed to link attachments:", e);
            }
          }

          // Switch to edit mode with server-assigned id
          setId(result.id.toString());
        } else {
          Alert.alert('Gagal', 'gagal');
          console.log({ result });
        }
      } else {
        // PATCH
        const res = await fetch(`${API_BASE_URL}/dpbeli`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id,
            tanggal: tanggal.replace('T', ' '),  // R1
            id_supplier: supplier.id,
            keterangan,
            kodeBA: kodeBaganAkun,
            dp,
          }),
        });
        const result = await res.json();

        if (result.status) {
          Alert.alert('Sukses', 'sukses menyimpan');
        } else {
          Alert.alert('Gagal', 'gagal');
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal menghubungi server');
    } finally {
      setIsSaving(false); // R7: always reset
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  /** Display the tanggal in readable format DD/MM/YYYY HH:mm (R11) */
  const displayTanggal = moment(tanggal, 'YYYY-MM-DDTHH:mm:ss').format(
    'DD/MM/YYYY HH:mm'
  );

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Navigation Bar ── */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>DP Beli</Text>
        {/* Search button (3.1) */}
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => setShowDPBeliSearch(true)}
        >
          <Ionicons name="search" size={24} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable Form ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>
            Kelola Down Payment Pembelian
          </Text>
        </View>

        <View style={styles.section}>
          {/* 1. Tanggal */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Tanggal</Text>
            <TouchableOpacity
              style={styles.dateField}
              onPress={openDatePicker}
            >
              <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              <Text style={styles.dateFieldText}>{displayTanggal}</Text>
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* 2. ID (read-only) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>ID</Text>
            <View style={styles.idContainer}>
              <Text style={styles.idText}>{id}</Text>
            </View>
          </View>

          {/* 3. Supplier */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Supplier <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.fieldWithButton}>
              {/* ID field (read-only after selection) */}
              <View style={styles.supplierIdBox}>
                <Text
                  style={[
                    styles.supplierIdText,
                    supplier.id === 0 && styles.placeholderText,
                  ]}
                >
                  {supplier.id === 0 ? '—' : String(supplier.id)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.searchFieldButton}
                onPress={() => setShowSupplier(true)}
              >
                <Ionicons name="search" size={18} color="white" />
              </TouchableOpacity>
            </View>
            {supplier.nama !== '' && (
              <Text style={styles.subLabel}>{supplier.nama}</Text>
            )}
          </View>

          {/* 4. Bagan Akun */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Bagan Akun <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.fieldWithButton}>
              <View style={styles.supplierIdBox}>
                <Text
                  style={[
                    styles.supplierIdText,
                    !kodeBaganAkun && styles.placeholderText,
                  ]}
                >
                  {kodeBaganAkun || '—'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.searchFieldButton}
                onPress={() => setShowBaganAkun(true)}
              >
                <Ionicons name="search" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 5. Keterangan */}
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

          {/* 6. DP */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              DP <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={dp}
              onChangeText={setDp}
              placeholder="0"
              keyboardType="numeric"     // numeric keyboard (mobile note)
            />
          </View>

          {/* 7. Terpakai — only in edit mode (R4) */}
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

          {/* 8. Attachment Uploader */}
          <AttachmentUploader
            transactionType="dp_beli"
            transactionId={id === 'BARU' ? null : id}
            isGDriveConnected={isGDriveConnected}
            onPendingFilesChange={setPendingAttachments}
          />
        </View>
      </ScrollView>

      {/* ── Footer Action Buttons ── */}
      <View style={styles.footer}>
        <View style={styles.actionButtons}>
          {/* Hapus — only when edit mode + delete permission (R3, R9) */}
          {canDelete && id !== 'BARU' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              disabled={isSaving}
            >
              <Ionicons name="trash-outline" size={18} color="white" />
              <Text style={styles.actionButtonText}>Hapus</Text>
            </TouchableOpacity>
          )}

          {/* Baru — only when create permission (R9) */}
          {canCreate && (
            <TouchableOpacity
              style={[styles.actionButton, styles.newButton]}
              onPress={handleBaru}
              disabled={isSaving}
            >
              <Ionicons name="add-circle-outline" size={18} color="white" />
              <Text style={styles.actionButtonText}>Baru</Text>
            </TouchableOpacity>
          )}

          {/* Simpan — conditional on mode + permission (R6, R9) */}
          {((id === 'BARU' && canCreate) || (id !== 'BARU' && canUpdate)) && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.saveButton,
                isSaving && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.actionButtonText}>Menyimpan...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="white" />
                  <Text style={styles.actionButtonText}>Simpan</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Native Date-Time Picker ── */}
      {showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode={datePickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDatePickerChange}
        />
      )}

      {/* ── Modals ── */}
      <SearchSupplierModal
        visible={showSupplier}
        onClose={() => setShowSupplier(false)}
        onSelect={handleSupplierSelect}
      />
      <SearchBaganAkunModal
        visible={showBaganAkun}
        onClose={() => setShowBaganAkun(false)}
        onSelect={handleBaganAkunSelect}
        shows={['111']}  // kas/bank accounts only (section 7)
      />
      <SearchDPBeliModal
        visible={showDPBeliSearch}
        onClose={() => setShowDPBeliSearch(false)}
        onSelect={handleDPBeliSelect}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  // Top nav bar
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },

  // Section header
  sectionHeader: {
    padding: 16,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Form section card
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 8,
  },

  // Form elements
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
    color: '#EF4444',
  },
  subLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginLeft: 4,
  },

  // ID field
  idContainer: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  idText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#92400E',
  },

  // Date picker trigger
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'white',
    gap: 8,
  },
  dateFieldText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },

  // Field + search button row (supplier, bagan akun)
  fieldWithButton: {
    flexDirection: 'row',
    gap: 0,
  },
  supplierIdBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  supplierIdText: {
    fontSize: 15,
    color: '#111827',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  searchFieldButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },

  // Generic text input
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

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    gap: 6,
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
  saveButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
