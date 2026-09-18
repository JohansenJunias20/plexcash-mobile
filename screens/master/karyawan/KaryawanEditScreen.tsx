import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ApiService from '../../../services/api';
import type { AppStackParamList } from '../../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AppStackParamList, 'KaryawanEdit'>;

interface ScheduleDay {
  masuk: string;
  keluar: string;
}

export default function KaryawanEditScreen({ route, navigation }: Props): React.JSX.Element {
  const id = route.params?.id;
  const isNew = !id;

  const [activeTab, setActiveTab] = useState<'karyawan' | 'gaji' | 'penalty' | 'jadwal' | 'pin'>('karyawan');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Karyawan form
  const [nama, setNama] = useState('');
  const [idAbsensi, setIdAbsensi] = useState('');
  const [deviceUserId, setDeviceUserId] = useState('');
  const [kodeBAgaji, setKodeBAgaji] = useState('');
  const [kodeBApiutang, setKodeBApiutang] = useState('');

  // Gaji form
  const [gajiHarian, setGajiHarian] = useState('');
  const [gajiBulanan, setGajiBulanan] = useState('');

  // Penalty form
  const [penaltyPerMenit, setPenaltyPerMenit] = useState('1000');
  const [maxPenaltyAmount, setMaxPenaltyAmount] = useState('50000');
  const [maxPenaltyMinutes, setMaxPenaltyMinutes] = useState('60');

  // PIN form
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Schedule form
  const [isExempt, setIsExempt] = useState(false);
  const [senin, setSenin] = useState<ScheduleDay>({ masuk: '08:00', keluar: '17:00' });
  const [selasa, setSelasa] = useState<ScheduleDay>({ masuk: '08:00', keluar: '17:00' });
  const [rabu, setRabu] = useState<ScheduleDay>({ masuk: '08:00', keluar: '17:00' });
  const [kamis, setKamis] = useState<ScheduleDay>({ masuk: '08:00', keluar: '17:00' });
  const [jumat, setJumat] = useState<ScheduleDay>({ masuk: '08:00', keluar: '17:00' });
  const [sabtu, setSabtu] = useState<ScheduleDay>({ masuk: '08:00', keluar: '15:00' });
  const [minggu, setMinggu] = useState<ScheduleDay>({ masuk: '', keluar: '' });

  useEffect(() => {
    navigation.setOptions({
      title: isNew ? 'Tambah Karyawan' : 'Edit Karyawan',
    });
  }, [isNew, navigation]);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await ApiService.authenticatedRequest(`/api/karyawan/complete/${id}`);
        if (res?.status && res.data) {
          const { karyawan, salary, penalty, schedule } = res.data;

          // Karyawan
          if (karyawan) {
            setNama(karyawan.nama || '');
            setIdAbsensi(karyawan.id_absensi !== null && karyawan.id_absensi !== undefined ? String(karyawan.id_absensi) : '');
            setDeviceUserId(karyawan.device_user_id || '');
            setKodeBAgaji(karyawan.kodeBAgaji || '');
            setKodeBApiutang(karyawan.kodeBApiutang || '');
          }

          // Salary
          if (salary) {
            setGajiHarian(salary.gaji_harian ? String(salary.gaji_harian) : '');
            setGajiBulanan(salary.gaji_bulanan ? String(salary.gaji_bulanan) : '');
          }

          // Penalty
          if (penalty) {
            setPenaltyPerMenit(penalty.penalty_per_minute !== undefined ? String(penalty.penalty_per_minute) : '1000');
            setMaxPenaltyAmount(penalty.max_penalty_amount ? String(penalty.max_penalty_amount) : '');
            setMaxPenaltyMinutes(penalty.max_penalty_minutes ? String(penalty.max_penalty_minutes) : '');
          }

          // Schedule
          if (schedule) {
            setIsExempt(Boolean(schedule.is_exempt));
            if (schedule.senin_masuk || schedule.senin_keluar) setSenin({ masuk: schedule.senin_masuk || '', keluar: schedule.senin_keluar || '' });
            if (schedule.selasa_masuk || schedule.selasa_keluar) setSelasa({ masuk: schedule.selasa_masuk || '', keluar: schedule.selasa_keluar || '' });
            if (schedule.rabu_masuk || schedule.rabu_keluar) setRabu({ masuk: schedule.rabu_masuk || '', keluar: schedule.rabu_keluar || '' });
            if (schedule.kamis_masuk || schedule.kamis_keluar) setKamis({ masuk: schedule.kamis_masuk || '', keluar: schedule.kamis_keluar || '' });
            if (schedule.jumat_masuk || schedule.jumat_keluar) setJumat({ masuk: schedule.jumat_masuk || '', keluar: schedule.jumat_keluar || '' });
            if (schedule.sabtu_masuk || schedule.sabtu_keluar) setSabtu({ masuk: schedule.sabtu_masuk || '', keluar: schedule.sabtu_keluar || '' });
            if (schedule.minggu_masuk || schedule.minggu_keluar) setMinggu({ masuk: schedule.minggu_masuk || '', keluar: schedule.minggu_keluar || '' });
          }
        }
      } catch (err) {
        console.error('Error loading employee complete data:', err);
        Alert.alert('Error', 'Gagal memuat detail karyawan');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // Save new or edit basic employee
  const handleSaveKaryawan = async () => {
    if (!nama.trim()) {
      Alert.alert('Validasi', 'Nama karyawan wajib diisi');
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        const res = await ApiService.authenticatedRequest('/karyawan', {
          method: 'POST',
          body: JSON.stringify({
            data: [
              {
                nama: nama.trim(),
                id_absensi: idAbsensi ? parseInt(idAbsensi, 10) : null,
                device_user_id: deviceUserId.trim() || null,
              },
            ],
          }),
        });

        if (res?.status) {
          Alert.alert('Sukses', 'Karyawan berhasil ditambahkan');
          navigation.goBack();
        } else {
          Alert.alert('Gagal', res?.reason || 'Gagal menambahkan karyawan');
        }
      } else {
        const res = await ApiService.authenticatedRequest('/karyawan', {
          method: 'PATCH',
          body: JSON.stringify({
            id: { key: 'id', value: id },
            data: [
              {
                nama: nama.trim(),
                id_absensi: idAbsensi ? parseInt(idAbsensi, 10) : null,
                device_user_id: deviceUserId.trim() || null,
                kodeBAgaji: kodeBAgaji.trim() || null,
                kodeBApiutang: kodeBApiutang.trim() || null,
              },
            ],
          }),
        });

        if (res?.status) {
          Alert.alert('Sukses', 'Data karyawan berhasil diperbarui');
        } else {
          Alert.alert('Gagal', res?.reason || 'Gagal menyimpan perubahan');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  // Save Salary
  const handleSaveSalary = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const res = await ApiService.authenticatedRequest('/api/karyawan/salary', {
        method: 'POST',
        body: JSON.stringify({
          karyawan_id: id,
          gaji_harian: gajiHarian ? parseFloat(gajiHarian) : null,
          gaji_bulanan: gajiBulanan ? parseFloat(gajiBulanan) : null,
        }),
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Data gaji berhasil disimpan');
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal menyimpan gaji');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  // Save Penalty
  const handleSavePenalty = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const res = await ApiService.authenticatedRequest('/api/karyawan/penalty', {
        method: 'POST',
        body: JSON.stringify({
          karyawan_id: id,
          penalty_per_minute: parseFloat(penaltyPerMenit) || 0,
          max_penalty_amount: maxPenaltyAmount ? parseFloat(maxPenaltyAmount) : null,
          max_penalty_minutes: maxPenaltyMinutes ? parseInt(maxPenaltyMinutes, 10) : null,
        }),
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Pengaturan penalty berhasil disimpan');
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal menyimpan penalty');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  // Save Schedule
  const handleSaveSchedule = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const res = await ApiService.authenticatedRequest('/api/karyawan/schedule', {
        method: 'POST',
        body: JSON.stringify({
          karyawan_id: id,
          is_exempt: isExempt,
          senin_masuk: senin.masuk || null,
          senin_keluar: senin.keluar || null,
          selasa_masuk: selasa.masuk || null,
          selasa_keluar: selasa.keluar || null,
          rabu_masuk: rabu.masuk || null,
          rabu_keluar: rabu.keluar || null,
          kamis_masuk: kamis.masuk || null,
          kamis_keluar: kamis.keluar || null,
          jumat_masuk: jumat.masuk || null,
          jumat_keluar: jumat.keluar || null,
          sabtu_masuk: sabtu.masuk || null,
          sabtu_keluar: sabtu.keluar || null,
          minggu_masuk: minggu.masuk || null,
          minggu_keluar: minggu.keluar || null,
        }),
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Jadwal kerja berhasil disimpan');
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal menyimpan jadwal kerja');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  // Save PIN
  const handleSavePin = async () => {
    if (!id) return;
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
      setSaving(true);
      const res = await ApiService.authenticatedRequest('/api/karyawan/pin/set', {
        method: 'POST',
        body: JSON.stringify({
          id_karyawan: id,
          pin: newPin,
        }),
      });

      if (res?.status) {
        Alert.alert('Sukses', 'PIN berhasil disimpan');
        setNewPin('');
        setConfirmPin('');
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal menyimpan PIN');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat data karyawan...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Tabs (Only shown when editing existing employee) */}
      {!isNew && (
        <View style={styles.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'karyawan' && styles.tabItemActive]}
              onPress={() => setActiveTab('karyawan')}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={activeTab === 'karyawan' ? '#f59e0b' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === 'karyawan' && styles.tabTextActive]}>
                Data
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'gaji' && styles.tabItemActive]}
              onPress={() => setActiveTab('gaji')}
            >
              <Ionicons
                name="cash-outline"
                size={16}
                color={activeTab === 'gaji' ? '#f59e0b' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === 'gaji' && styles.tabTextActive]}>
                Gaji
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'penalty' && styles.tabItemActive]}
              onPress={() => setActiveTab('penalty')}
            >
              <Ionicons
                name="warning-outline"
                size={16}
                color={activeTab === 'penalty' ? '#f59e0b' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === 'penalty' && styles.tabTextActive]}>
                Denda
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'jadwal' && styles.tabItemActive]}
              onPress={() => setActiveTab('jadwal')}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={activeTab === 'jadwal' ? '#f59e0b' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === 'jadwal' && styles.tabTextActive]}>
                Jadwal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'pin' && styles.tabItemActive]}
              onPress={() => setActiveTab('pin')}
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={activeTab === 'pin' ? '#f59e0b' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === 'pin' && styles.tabTextActive]}>
                PIN
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* TAB 1: Karyawan Basic Data */}
          {(isNew || activeTab === 'karyawan') && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Informasi Karyawan</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Nama Karyawan <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Masukkan nama lengkap"
                  value={nama}
                  onChangeText={setNama}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>ID Absensi (Fingerprint)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: 1, 2, 3"
                  value={idAbsensi}
                  onChangeText={setIdAbsensi}
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>
                  ID pengguna yang terdaftar di mesin absensi Solution / ZKTeco
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Device User ID (Opsional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: USR001"
                  value={deviceUserId}
                  onChangeText={setDeviceUserId}
                />
              </View>

              {!isNew && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Kode BA Beban Gaji (CoA)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Contoh: 5101"
                      value={kodeBAgaji}
                      onChangeText={setKodeBAgaji}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Kode BA Piutang Karyawan (CoA)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Contoh: 1141"
                      value={kodeBApiutang}
                      onChangeText={setKodeBApiutang}
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={handleSaveKaryawan}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isNew ? 'Tambah Karyawan' : 'Simpan Perubahan'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 2: Gaji */}
          {!isNew && activeTab === 'gaji' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pengaturan Gaji</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Gaji Harian (Rp)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: 100000"
                  value={gajiHarian}
                  onChangeText={setGajiHarian}
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>
                  Digunakan untuk perhitungan gaji harian berdasarkan absensi hadir
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Gaji Bulanan (Rp)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: 3000000"
                  value={gajiBulanan}
                  onChangeText={setGajiBulanan}
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>
                  Gaji pokok per bulan untuk karyawan bulanan
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={handleSaveSalary}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Simpan Data Gaji</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 3: Denda / Penalty */}
          {!isNew && activeTab === 'penalty' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pengaturan Denda Keterlambatan</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Denda per Menit (Rp)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1000"
                  value={penaltyPerMenit}
                  onChangeText={setPenaltyPerMenit}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Maksimal Denda per Hari (Rp)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="50000"
                  value={maxPenaltyAmount}
                  onChangeText={setMaxPenaltyAmount}
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>Kosongkan jika tidak ada batas maksimal</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Maksimal Menit Denda (Menit)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="60"
                  value={maxPenaltyMinutes}
                  onChangeText={setMaxPenaltyMinutes}
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>Batas toleransi menit yang dihitung denda</Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={handleSavePenalty}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Simpan Pengaturan Denda</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 4: Jadwal Kerja */}
          {!isNew && activeTab === 'jadwal' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Jadwal Jam Kerja Karyawan</Text>

              {/* Exempt Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Bebas Jadwal (Exempt)</Text>
                  <Text style={styles.hint}>
                    Karyawan tidak dikenakan denda keterlambatan jika diaktifkan
                  </Text>
                </View>
                <Switch
                  value={isExempt}
                  onValueChange={setIsExempt}
                  trackColor={{ false: '#d1d5db', true: '#fde68a' }}
                  thumbColor={isExempt ? '#f59e0b' : '#f4f3f4'}
                />
              </View>

              <View style={styles.divider} />

              {/* Days Schedule */}
              {[
                { name: 'Senin', state: senin, setState: setSenin },
                { name: 'Selasa', state: selasa, setState: setSelasa },
                { name: 'Rabu', state: rabu, setState: setRabu },
                { name: 'Kamis', state: kamis, setState: setKamis },
                { name: 'Jumat', state: jumat, setState: setJumat },
                { name: 'Sabtu', state: sabtu, setState: setSabtu },
                { name: 'Minggu', state: minggu, setState: setMinggu },
              ].map((day) => (
                <View key={day.name} style={styles.dayRow}>
                  <Text style={styles.dayName}>{day.name}</Text>
                  <View style={styles.timeInputs}>
                    <TextInput
                      style={styles.timeInput}
                      placeholder="08:00"
                      value={day.state.masuk}
                      onChangeText={(val) => day.setState({ ...day.state, masuk: val })}
                    />
                    <Text style={styles.timeSeparator}>-</Text>
                    <TextInput
                      style={styles.timeInput}
                      placeholder="17:00"
                      value={day.state.keluar}
                      onChangeText={(val) => day.setState({ ...day.state, keluar: val })}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={handleSaveSchedule}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Simpan Jadwal Kerja</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 5: PIN */}
          {!isNew && activeTab === 'pin' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Atur PIN Karyawan</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>PIN Baru (6 Digit Angka)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: 123456"
                  value={newPin}
                  onChangeText={setNewPin}
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Konfirmasi PIN</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ulangi 6 digit PIN"
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={handleSavePin}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Simpan PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#4b5563' },
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabScroll: { paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  tabItemActive: { backgroundColor: '#fef3c7' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#b45309' },
  scrollContent: { padding: 14, paddingBottom: 60 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
  formGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  required: { color: '#ef4444' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  hint: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  submitBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dayName: { fontSize: 14, fontWeight: '600', color: '#374151', width: 70 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    width: 76,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  timeSeparator: { fontSize: 14, color: '#6b7280' },
});
