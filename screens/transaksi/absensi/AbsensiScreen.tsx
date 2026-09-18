import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import moment from 'moment';
import ApiService from '../../../services/api';

interface AttendanceRecord {
  tanggal: string;
  jam_masuk: string | null;
  jam_keluar: string | null;
  total_jam_kerja: number | null;
  device_serial_number: string | null;
  keterangan: string | null;
}

interface EmployeeAttendance {
  karyawan_id: number;
  nama: string;
  id_absensi: number | null;
  attendance: AttendanceRecord[];
}

interface Device {
  id?: number;
  serial_number: string;
  device_name: string;
  firmware_version?: string | null;
  is_connected: boolean;
  client_status: string;
  last_heartbeat?: number;
}

export default function AbsensiScreen(): React.JSX.Element {
  const navigation = useNavigation();

  // Date range state (default to start of current month until today)
  const [startDate, setStartDate] = useState<Date>(moment().startOf('month').toDate());
  const [endDate, setEndDate] = useState<Date>(moment().toDate());

  // DateTimePicker modal state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Data state
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);

  // Expanded employee cards
  const [expandedEmployees, setExpandedEmployees] = useState<{ [id: number]: boolean }>({});

  const toggleExpand = (id: number) => {
    setExpandedEmployees((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadDevices = useCallback(async () => {
    try {
      const res = await ApiService.authenticatedRequest('/api/winforms/devices');
      if (res?.status) {
        setDevices(res.data || res.devices || []);
      }
    } catch (e) {
      console.error('Error loading devices:', e);
    }
  }, []);

  const loadAttendance = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setLoading(true);
      try {
        const startStr = moment(startDate).format('YYYY-MM-DD');
        const endStr = moment(endDate).format('YYYY-MM-DD');
        const res = await ApiService.authenticatedRequest(
          `/api/attendance/records?start_date=${startStr}&end_date=${endStr}`
        );

        if (res?.status) {
          setEmployees(res.employees || []);
        }
      } catch (e) {
        console.error('Error loading attendance records:', e);
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate]
  );

  useEffect(() => {
    loadDevices();
    loadAttendance();

    // Auto-refresh devices every 10s and attendance every 15s (like web)
    const deviceTimer = setInterval(() => loadDevices(), 10000);
    const attTimer = setInterval(() => loadAttendance(true), 15000);

    return () => {
      clearInterval(deviceTimer);
      clearInterval(attTimer);
    };
  }, [loadDevices, loadAttendance]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDevices();
    loadAttendance();
  };

  // Trigger manual attendance pull from device
  const handlePullAttendance = async () => {
    try {
      setPulling(true);
      const startStr = moment(startDate).format('YYYY-MM-DD');
      const endStr = moment(endDate).format('YYYY-MM-DD');

      const res = await ApiService.authenticatedRequest('/api/attendance/pull', {
        method: 'POST',
        body: JSON.stringify({
          start_date: startStr,
          end_date: endStr,
        }),
      });

      if (res?.status) {
        Alert.alert(
          'Permintaan Dikirim',
          res.message || 'Perintah penarikan data telah dikirim ke WinForms. Data akan terupdate dalam beberapa detik.'
        );
        setTimeout(() => {
          loadAttendance(true);
        }, 6000);
      } else {
        Alert.alert('Gagal', res?.reason || 'Gagal meminta penarikan data dari device');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menarik data');
    } finally {
      setPulling(false);
    }
  };

  const handleStartDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selected) {
      setStartDate(selected);
    }
  };

  const handleEndDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selected) {
      setEndDate(selected);
    }
  };

  const setPresetRange = (preset: 'today' | '7days' | 'month') => {
    if (preset === 'today') {
      setStartDate(moment().toDate());
      setEndDate(moment().toDate());
    } else if (preset === '7days') {
      setStartDate(moment().subtract(6, 'days').toDate());
      setEndDate(moment().toDate());
    } else if (preset === 'month') {
      setStartDate(moment().startOf('month').toDate());
      setEndDate(moment().endOf('month').toDate());
    }
  };

  const renderEmployeeCard = ({ item }: { item: EmployeeAttendance }) => {
    const isExpanded = Boolean(expandedEmployees[item.karyawan_id]);
    const presentRecords = (item.attendance || []).filter((r) => r.jam_masuk);
    const totalHours = (item.attendance || []).reduce(
      (sum, r) => sum + (Number(r.total_jam_kerja) || 0),
      0
    );

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={0.7}
          onPress={() => toggleExpand(item.karyawan_id)}
        >
          <View style={styles.empAvatar}>
            <Text style={styles.empAvatarText}>
              {item.nama ? item.nama.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{item.nama}</Text>
            <Text style={styles.empId}>
              ID Absensi: {item.id_absensi !== null ? item.id_absensi : '-'}
            </Text>
          </View>
          <View style={styles.statsCol}>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>Hadir</Text>
              <Text style={styles.statValue}>{presentRecords.length} hr</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: '#f3e8ff' }]}>
              <Text style={[styles.statLabel, { color: '#7c3aed' }]}>Jam Kerja</Text>
              <Text style={[styles.statValue, { color: '#7c3aed' }]}>
                {totalHours.toFixed(1)} j
              </Text>
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#9ca3af"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>

        {/* Expanded Daily Logs */}
        {isExpanded && (
          <View style={styles.logList}>
            <View style={styles.logHeader}>
              <Text style={[styles.logCol, { flex: 2 }]}>Tanggal</Text>
              <Text style={[styles.logCol, { flex: 1.5, textAlign: 'center' }]}>Masuk</Text>
              <Text style={[styles.logCol, { flex: 1.5, textAlign: 'center' }]}>Keluar</Text>
              <Text style={[styles.logCol, { flex: 1.5, textAlign: 'right' }]}>Total</Text>
            </View>

            {(item.attendance || []).length === 0 ? (
              <Text style={styles.noLogs}>Tidak ada catatan absensi pada periode ini</Text>
            ) : (
              (item.attendance || []).map((rec, idx) => {
                const hasClockIn = Boolean(rec.jam_masuk);
                const isComplete = Boolean(rec.jam_masuk && rec.jam_keluar);

                return (
                  <View key={idx} style={styles.logRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.logDate}>
                        {moment(rec.tanggal).format('DD/MM/YYYY')}
                      </Text>
                      <Text style={styles.logDay}>
                        {moment(rec.tanggal).format('dddd')}
                      </Text>
                    </View>
                    <View style={{ flex: 1.5, alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.logTime,
                          hasClockIn ? styles.timePresent : styles.timeAbsent,
                        ]}
                      >
                        {rec.jam_masuk ? rec.jam_masuk.substring(0, 5) : '-'}
                      </Text>
                    </View>
                    <View style={{ flex: 1.5, alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.logTime,
                          rec.jam_keluar ? styles.timePresent : styles.timeAbsent,
                        ]}
                      >
                        {rec.jam_keluar ? rec.jam_keluar.substring(0, 5) : '-'}
                      </Text>
                    </View>
                    <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                      <Text style={styles.logHours}>
                        {rec.total_jam_kerja ? `${Number(rec.total_jam_kerja).toFixed(1)} j` : '-'}
                      </Text>
                      {rec.keterangan ? (
                        <Text style={styles.logKet} numberOfLines={1}>
                          {rec.keterangan}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
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
        <Text style={styles.headerTitle}>Absensi Karyawan</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={employees}
        keyExtractor={(item) => String(item.karyawan_id)}
        renderItem={renderEmployeeCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f59e0b']} />
        }
        ListHeaderComponent={
          <View>
            {/* Device Status Banner */}
            <View style={styles.deviceCard}>
              <View style={styles.deviceHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="hardware-chip-outline" size={18} color="#4b5563" />
                  <Text style={styles.deviceTitle}>Mesin Absensi USB (WinForms)</Text>
                </View>
                {devices.length > 0 && devices.some((d) => d.is_connected) ? (
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Terkoneksi</Text>
                  </View>
                ) : (
                  <View style={styles.offlineBadge}>
                    <View style={styles.offlineDot} />
                    <Text style={styles.offlineText}>
                      {devices.length > 0 ? 'Device Terputus' : 'Tidak Terdeteksi'}
                    </Text>
                  </View>
                )}
              </View>

              {devices.length > 0 ? (
                devices.map((dev, idx) => (
                  <View key={idx} style={styles.deviceItem}>
                    <Text style={styles.deviceName}>{dev.device_name || 'USB Fingerprint'}</Text>
                    <Text style={styles.deviceSn}>SN: {dev.serial_number}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.deviceNote}>
                  Pastikan aplikasi PlexSeller WinForms aktif di PC kasir/kantor.
                </Text>
              )}

              {/* Action: Pull from device */}
              <TouchableOpacity
                style={[styles.pullBtn, pulling && { opacity: 0.6 }]}
                disabled={pulling}
                onPress={handlePullAttendance}
              >
                {pulling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={styles.pullBtnText}>Tarik Data dari Device</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Date Range Filter */}
            <View style={styles.filterCard}>
              <Text style={styles.filterTitle}>Periode Absensi</Text>

              {/* Preset Chips */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setPresetRange('today')}
                >
                  <Text style={styles.presetChipText}>Hari Ini</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setPresetRange('7days')}
                >
                  <Text style={styles.presetChipText}>7 Hari</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setPresetRange('month')}
                >
                  <Text style={styles.presetChipText}>Bulan Ini</Text>
                </TouchableOpacity>
              </View>

              {/* Date Input Buttons */}
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text style={styles.dateBtnText}>
                    {moment(startDate).format('DD MMM YYYY')}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.dateTo}>s/d</Text>

                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text style={styles.dateBtnText}>
                    {moment(endDate).format('DD MMM YYYY')}
                  </Text>
                </TouchableOpacity>
              </View>

              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleStartDateChange}
                />
              )}

              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleEndDateChange}
                />
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="finger-print-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Tidak ada data absensi pada rentang tanggal ini</Text>
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
  listContent: { padding: 12, paddingBottom: 40 },

  // Device Card
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  onlineText: { fontSize: 11, fontWeight: '600', color: '#15803d' },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' },
  offlineText: { fontSize: 11, fontWeight: '600', color: '#b91c1c' },
  deviceItem: { paddingVertical: 4 },
  deviceName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  deviceSn: { fontSize: 11, color: '#6b7280' },
  deviceNote: { fontSize: 12, color: '#6b7280', marginVertical: 4 },
  pullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  pullBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Filter Card
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  filterTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  presetChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  presetChipText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  dateBtnText: { fontSize: 13, color: '#111827' },
  dateTo: { fontSize: 12, color: '#6b7280' },

  // Employee card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  empAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  empAvatarText: { fontSize: 16, fontWeight: '700', color: '#b45309' },
  empName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  empId: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statsCol: { flexDirection: 'row', gap: 6 },
  statBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: '#1d4ed8', fontWeight: '500' },
  statValue: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },

  // Logs breakdown
  logList: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fafafa',
    padding: 12,
  },
  logHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 6,
  },
  logCol: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logDate: { fontSize: 12, fontWeight: '600', color: '#111827' },
  logDay: { fontSize: 10, color: '#6b7280' },
  logTime: { fontSize: 12, fontWeight: '700' },
  timePresent: { color: '#16a34a' },
  timeAbsent: { color: '#9ca3af' },
  logHours: { fontSize: 12, fontWeight: '600', color: '#374151' },
  logKet: { fontSize: 10, color: '#6b7280' },
  noLogs: { textAlign: 'center', color: '#9ca3af', fontSize: 12, paddingVertical: 12 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { marginTop: 10, fontSize: 14, color: '#9ca3af' },
});
