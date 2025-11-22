import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ApiService from '../../services/api';

// ==================== INTERFACES ====================
interface TimeRange {
  id: string;
  start: string; // HH:mm format
  end: string; // HH:mm format
}

interface DaySchedule {
  enabled: boolean;
  ranges: TimeRange[];
}

interface ShopSchedule {
  id_ecommerce: number;
  enabled: boolean;
  ignore_instant_orders: boolean;
  schedule: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
}

interface EcommerceShop {
  id: number;
  platform: string;
  name: string;
  shop_id: string;
  status: string;
  auto_process_enabled?: boolean;
}

type RouteParams = {
  ProsesOtomatisConfig: {
    shop: EcommerceShop;
  };
};

// ==================== CONSTANTS ====================
const DAYS = [
  { key: 'monday', label: 'Senin' },
  { key: 'tuesday', label: 'Selasa' },
  { key: 'wednesday', label: 'Rabu' },
  { key: 'thursday', label: 'Kamis' },
  { key: 'friday', label: 'Jumat' },
  { key: 'saturday', label: 'Sabtu' },
  { key: 'sunday', label: 'Minggu' },
] as const;

type DayKey = typeof DAYS[number]['key'];

const DEFAULT_DAY_SCHEDULE: DaySchedule = {
  enabled: false,
  ranges: [],
};

const DEFAULT_SCHEDULE: ShopSchedule = {
  id_ecommerce: 0,
  enabled: false,
  ignore_instant_orders: false,
  schedule: {
    monday: { ...DEFAULT_DAY_SCHEDULE },
    tuesday: { ...DEFAULT_DAY_SCHEDULE },
    wednesday: { ...DEFAULT_DAY_SCHEDULE },
    thursday: { ...DEFAULT_DAY_SCHEDULE },
    friday: { ...DEFAULT_DAY_SCHEDULE },
    saturday: { ...DEFAULT_DAY_SCHEDULE },
    sunday: { ...DEFAULT_DAY_SCHEDULE },
  },
};

export default function ProsesOtomatisConfigScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'ProsesOtomatisConfig'>>();
  const { shop } = route.params;

  // ==================== STATE ====================
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ShopSchedule>(DEFAULT_SCHEDULE);
  const [expandedDays, setExpandedDays] = useState<Set<DayKey>>(new Set());

  // Time Picker State
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end'>('start');
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [editingRange, setEditingRange] = useState<{
    dayKey: DayKey;
    rangeId: string | null;
    tempStart: string;
    tempEnd: string;
  } | null>(null);

  // Bulk Time Range Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStartTime, setBulkStartTime] = useState('09:00');
  const [bulkEndTime, setBulkEndTime] = useState('17:00');
  const [showBulkStartPicker, setShowBulkStartPicker] = useState(false);
  const [showBulkEndPicker, setShowBulkEndPicker] = useState(false);

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchSchedule();
  }, []);

  // ==================== FUNCTIONS ====================
  const fetchSchedule = async () => {
    try {
      setLoading(true);
      console.log('📦 [ProsesOtomatisConfig] Fetching schedule for shop:', shop.id);
      const response = await ApiService.get(`/get/auto-process-schedule/${shop.id}`);

      if (response.status && response.data) {
        console.log('✅ [ProsesOtomatisConfig] Fetched schedule:', response.data);
        setSchedule(response.data);
      } else {
        console.log('ℹ️ [ProsesOtomatisConfig] No existing schedule, using default');
        setSchedule({ ...DEFAULT_SCHEDULE, id_ecommerce: shop.id });
      }
    } catch (error) {
      console.error('❌ [ProsesOtomatisConfig] Error fetching schedule:', error);
      setSchedule({ ...DEFAULT_SCHEDULE, id_ecommerce: shop.id });
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async () => {
    try {
      setSaving(true);
      console.log('💾 [ProsesOtomatisConfig] Saving schedule:', schedule);

      // Validate all time ranges before saving
      for (const day of DAYS) {
        const daySchedule = schedule.schedule[day.key];
        if (daySchedule.enabled && daySchedule.ranges.length > 0) {
          const validation = validateTimeRanges(daySchedule.ranges);
          if (!validation.valid) {
            Alert.alert('Validasi Gagal', `${day.label}: ${validation.message}`);
            setSaving(false);
            return;
          }
        }
      }

      const response = await ApiService.post('/post/auto-process-schedule', schedule);

      if (response.status) {
        console.log('✅ [ProsesOtomatisConfig] Schedule saved successfully');
        Alert.alert('Berhasil', 'Jadwal proses otomatis berhasil disimpan', [
          { text: 'OK', onPress: () => navigation.navigate("ProsesOtomatis") },
        ]);
      } else {
        console.error('❌ [ProsesOtomatisConfig] Failed to save schedule:', response.reason);
        Alert.alert('Gagal', response.reason || 'Gagal menyimpan jadwal');
      }
    } catch (error) {
      console.error('❌ [ProsesOtomatisConfig] Error saving schedule:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan jadwal');
    } finally {
      setSaving(false);
    }
  };

  const validateTimeRanges = (ranges: TimeRange[]): { valid: boolean; message?: string } => {
    for (let i = 0; i < ranges.length; i++) {
      const range1 = ranges[i];
      const [h1Start, m1Start] = range1.start.split(':').map(Number);
      const [h1End, m1End] = range1.end.split(':').map(Number);
      const start1Minutes = h1Start * 60 + m1Start;
      const end1Minutes = h1End * 60 + m1End;

      // Check if start < end
      if (start1Minutes >= end1Minutes) {
        return {
          valid: false,
          message: `Waktu mulai harus lebih kecil dari waktu selesai (${range1.start} - ${range1.end})`,
        };
      }

      // Check for overlaps with other ranges
      for (let j = i + 1; j < ranges.length; j++) {
        const range2 = ranges[j];
        const [h2Start, m2Start] = range2.start.split(':').map(Number);
        const [h2End, m2End] = range2.end.split(':').map(Number);
        const start2Minutes = h2Start * 60 + m2Start;
        const end2Minutes = h2End * 60 + m2End;

        if (
          (start1Minutes < end2Minutes && end1Minutes > start2Minutes) ||
          (start2Minutes < end1Minutes && end2Minutes > start1Minutes)
        ) {
          return {
            valid: false,
            message: `Terdapat overlap waktu: ${range1.start}-${range1.end} dengan ${range2.start}-${range2.end}`,
          };
        }
      }
    }
    return { valid: true };
  };

  const toggleMainSwitch = (value: boolean) => {
    setSchedule((prev) => ({ ...prev, enabled: value }));
  };

  const toggleIgnoreInstantOrders = (value: boolean) => {
    setSchedule((prev) => ({ ...prev, ignore_instant_orders: value }));
  };

  const toggleDayEnabled = (dayKey: DayKey, value: boolean) => {
    setSchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey],
          enabled: value,
        },
      },
    }));
  };

  const toggleDayExpanded = (dayKey: DayKey) => {
    setExpandedDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dayKey)) {
        newSet.delete(dayKey);
      } else {
        newSet.add(dayKey);
      }
      return newSet;
    });
  };

  const enableAllDays = () => {
    setSchedule((prev) => {
      const newSchedule = { ...prev.schedule };
      DAYS.forEach((day) => {
        newSchedule[day.key] = { ...newSchedule[day.key], enabled: true };
      });
      return { ...prev, schedule: newSchedule };
    });
    Alert.alert('Berhasil', 'Semua hari telah diaktifkan');
  };

  const disableAllDays = () => {
    setSchedule((prev) => {
      const newSchedule = { ...prev.schedule };
      DAYS.forEach((day) => {
        newSchedule[day.key] = { ...newSchedule[day.key], enabled: false };
      });
      return { ...prev, schedule: newSchedule };
    });
    Alert.alert('Berhasil', 'Semua hari telah dinonaktifkan');
  };

  const addTimeRange = (dayKey: DayKey) => {
    const newRange: TimeRange = {
      id: Date.now().toString(),
      start: '09:00',
      end: '17:00',
    };

    setSchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey],
          ranges: [...prev.schedule[dayKey].ranges, newRange],
        },
      },
    }));

    // Auto expand the day
    setExpandedDays((prev) => new Set(prev).add(dayKey));
  };

  const deleteTimeRange = (dayKey: DayKey, rangeId: string) => {
    Alert.alert('Hapus Range Waktu', 'Apakah Anda yakin ingin menghapus range waktu ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          setSchedule((prev) => ({
            ...prev,
            schedule: {
              ...prev.schedule,
              [dayKey]: {
                ...prev.schedule[dayKey],
                ranges: prev.schedule[dayKey].ranges.filter((r) => r.id !== rangeId),
              },
            },
          }));
        },
      },
    ]);
  };

  const startEditTimeRange = (dayKey: DayKey, range: TimeRange) => {
    setEditingRange({
      dayKey,
      rangeId: range.id,
      tempStart: range.start,
      tempEnd: range.end,
    });
  };

  const openTimePicker = (mode: 'start' | 'end', currentTime: string) => {
    const [hours, minutes] = currentTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    setSelectedTime(date);
    setTimePickerMode(mode);
    setShowTimePicker(true);
  };

  const handleTimePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (selectedDate && editingRange) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      if (timePickerMode === 'start') {
        setEditingRange({ ...editingRange, tempStart: timeString });
      } else {
        setEditingRange({ ...editingRange, tempEnd: timeString });
      }

      if (Platform.OS === 'ios') {
        // On iOS, keep picker open for continuous editing
      }
    }
  };

  const saveEditedTimeRange = () => {
    if (!editingRange) return;

    const { dayKey, rangeId, tempStart, tempEnd } = editingRange;

    // Validate
    const [h1, m1] = tempStart.split(':').map(Number);
    const [h2, m2] = tempEnd.split(':').map(Number);
    const startMinutes = h1 * 60 + m1;
    const endMinutes = h2 * 60 + m2;

    if (startMinutes >= endMinutes) {
      Alert.alert('Validasi Gagal', 'Waktu mulai harus lebih kecil dari waktu selesai');
      return;
    }

    setSchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey],
          ranges: prev.schedule[dayKey].ranges.map((r) =>
            r.id === rangeId ? { ...r, start: tempStart, end: tempEnd } : r
          ),
        },
      },
    }));

    setEditingRange(null);
    setShowTimePicker(false);
  };

  const cancelEditTimeRange = () => {
    setEditingRange(null);
    setShowTimePicker(false);
  };

  const applyBulkTimeRange = () => {
    // Validate
    const [h1, m1] = bulkStartTime.split(':').map(Number);
    const [h2, m2] = bulkEndTime.split(':').map(Number);
    const startMinutes = h1 * 60 + m1;
    const endMinutes = h2 * 60 + m2;

    if (startMinutes >= endMinutes) {
      Alert.alert('Validasi Gagal', 'Waktu mulai harus lebih kecil dari waktu selesai');
      return;
    }

    const newRange: TimeRange = {
      id: Date.now().toString(),
      start: bulkStartTime,
      end: bulkEndTime,
    };

    setSchedule((prev) => {
      const newSchedule = { ...prev.schedule };
      DAYS.forEach((day) => {
        if (newSchedule[day.key].enabled) {
          newSchedule[day.key] = {
            ...newSchedule[day.key],
            ranges: [...newSchedule[day.key].ranges, { ...newRange, id: `${Date.now()}-${day.key}` }],
          };
        }
      });
      return { ...prev, schedule: newSchedule };
    });

    setShowBulkModal(false);
    Alert.alert('Berhasil', 'Range waktu telah ditambahkan ke semua hari yang aktif');
  };

  const handleBulkStartTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowBulkStartPicker(false);
    }

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setBulkStartTime(`${hours}:${minutes}`);
    }
  };

  const handleBulkEndTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowBulkEndPicker(false);
    }

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setBulkEndTime(`${hours}:${minutes}`);
    }
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderDayCard = (day: typeof DAYS[number]) => {
    const daySchedule = schedule.schedule[day.key];
    const isExpanded = expandedDays.has(day.key);

    return (
      <View key={day.key} style={styles.dayCard}>
        {/* Day Header */}
        <TouchableOpacity
          style={styles.dayHeader}
          onPress={() => toggleDayExpanded(day.key)}
          activeOpacity={0.7}
        >
          <View style={styles.dayHeaderLeft}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={24}
              color="#6b7280"
            />
            <Text style={styles.dayLabel}>{day.label}</Text>
            {daySchedule.ranges.length > 0 && (
              <View style={styles.rangeCountBadge}>
                <Text style={styles.rangeCountText}>{daySchedule.ranges.length}</Text>
              </View>
            )}
          </View>
          <Switch
            value={daySchedule.enabled}
            onValueChange={(value) => toggleDayEnabled(day.key, value)}
            trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
            thumbColor={daySchedule.enabled ? '#f59e0b' : '#f3f4f6'}
          />
        </TouchableOpacity>

        {/* Day Content (Expanded) */}
        {isExpanded && (
          <View style={styles.dayContent}>
            {/* Time Ranges */}
            {daySchedule.ranges.length > 0 ? (
              daySchedule.ranges.map((range) => (
                <View key={range.id} style={styles.timeRangeCard}>
                  <View style={styles.timeRangeInfo}>
                    <Ionicons name="time-outline" size={20} color="#f59e0b" />
                    <Text style={styles.timeRangeText}>
                      {range.start} - {range.end}
                    </Text>
                  </View>
                  <View style={styles.timeRangeActions}>
                    <TouchableOpacity
                      style={styles.timeRangeButton}
                      onPress={() => startEditTimeRange(day.key, range)}
                    >
                      <Ionicons name="pencil" size={18} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.timeRangeButton}
                      onPress={() => deleteTimeRange(day.key, range.id)}
                    >
                      <Ionicons name="trash" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noRangesText}>Belum ada range waktu</Text>
            )}

            {/* Add Range Button */}
            <TouchableOpacity
              style={styles.addRangeButton}
              onPress={() => addTimeRange(day.key)}
              disabled={!daySchedule.enabled}
            >
              <Ionicons name="add-circle-outline" size={20} color={daySchedule.enabled ? '#f59e0b' : '#9ca3af'} />
              <Text style={[styles.addRangeText, !daySchedule.enabled && styles.addRangeTextDisabled]}>
                Tambah Range Waktu
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderBulkModal = () => {
    const [bulkStartHours, bulkStartMinutes] = bulkStartTime.split(':').map(Number);
    const [bulkEndHours, bulkEndMinutes] = bulkEndTime.split(':').map(Number);
    const bulkStartDate = new Date();
    bulkStartDate.setHours(bulkStartHours);
    bulkStartDate.setMinutes(bulkStartMinutes);
    const bulkEndDate = new Date();
    bulkEndDate.setHours(bulkEndHours);
    bulkEndDate.setMinutes(bulkEndMinutes);

    return (
      <Modal
        visible={showBulkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBulkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Range Waktu ke Semua Hari</Text>
              <TouchableOpacity onPress={() => setShowBulkModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Range waktu akan ditambahkan ke semua hari yang aktif
              </Text>

              {/* Start Time */}
              <View style={styles.timePickerRow}>
                <Text style={styles.timePickerLabel}>Waktu Mulai:</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowBulkStartPicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#f59e0b" />
                  <Text style={styles.timePickerButtonText}>{bulkStartTime}</Text>
                </TouchableOpacity>
              </View>

              {/* End Time */}
              <View style={styles.timePickerRow}>
                <Text style={styles.timePickerLabel}>Waktu Selesai:</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowBulkEndPicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#f59e0b" />
                  <Text style={styles.timePickerButtonText}>{bulkEndTime}</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowBulkModal(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonApply]}
                  onPress={applyBulkTimeRange}
                >
                  <Text style={styles.modalButtonTextApply}>Terapkan</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Time Pickers */}
            {showBulkStartPicker && (
              <DateTimePicker
                value={bulkStartDate}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleBulkStartTimeChange}
              />
            )}
            {showBulkEndPicker && (
              <DateTimePicker
                value={bulkEndDate}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleBulkEndTimeChange}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // ==================== MAIN RENDER ====================
  if (loading) {
    return (
      <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>Memuat konfigurasi...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('ProsesOtomatis')}>
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Konfigurasi</Text>
            <Text style={styles.headerSubtitle}>{shop.name}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Toggle */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="power" size={24} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Auto Process</Text>
              </View>
              <View style={styles.toggleCard}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Aktifkan Proses Otomatis</Text>
                  <Text style={styles.toggleDescription}>
                    Pesanan akan diproses otomatis sesuai jadwal yang ditentukan
                  </Text>
                </View>
                <Switch
                  value={schedule.enabled}
                  onValueChange={toggleMainSwitch}
                  trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
                  thumbColor={schedule.enabled ? '#f59e0b' : '#f3f4f6'}
                />
              </View>
            </View>

            {/* Ignore Instant Orders */}
            <View style={styles.section}>
              <View style={styles.toggleCard}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Abaikan Pesanan Instant</Text>
                  <Text style={styles.toggleDescription}>
                    Pesanan dengan pengiriman instant tidak akan diproses otomatis
                  </Text>
                </View>
                <Switch
                  value={schedule.ignore_instant_orders}
                  onValueChange={toggleIgnoreInstantOrders}
                  trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
                  thumbColor={schedule.ignore_instant_orders ? '#f59e0b' : '#f3f4f6'}
                />
              </View>
            </View>

            {/* Timezone Info */}
            <View style={styles.infoAlert}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
              <Text style={styles.infoAlertText}>Semua waktu menggunakan zona waktu GMT+7 (WIB)</Text>
            </View>

            {/* Bulk Actions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flash" size={24} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Aksi Cepat</Text>
              </View>
              <View style={styles.bulkActionsContainer}>
                <TouchableOpacity style={styles.bulkActionButton} onPress={enableAllDays}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={styles.bulkActionText}>Aktifkan Semua Hari</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bulkActionButton} onPress={disableAllDays}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                  <Text style={styles.bulkActionText}>Nonaktifkan Semua Hari</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bulkActionButton} onPress={() => setShowBulkModal(true)}>
                  <Ionicons name="time" size={20} color="#f59e0b" />
                  <Text style={styles.bulkActionText}>Tambah Range Waktu</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Day Schedules */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar" size={24} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Jadwal Harian</Text>
              </View>
              {DAYS.map((day) => renderDayCard(day))}
            </View>
          </ScrollView>

          {/* Save Button (FAB) */}
          <TouchableOpacity
            style={[styles.fab, saving && styles.fabDisabled]}
            onPress={saveSchedule}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="save" size={24} color="white" />
                <Text style={styles.fabText}>Simpan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Bulk Modal */}
        {renderBulkModal()}

        {/* Edit Time Range Modal */}
        {editingRange && (
          <Modal
            visible={true}
            transparent
            animationType="slide"
            onRequestClose={cancelEditTimeRange}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Range Waktu</Text>
                  <TouchableOpacity onPress={cancelEditTimeRange}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  {/* Start Time */}
                  <View style={styles.timePickerRow}>
                    <Text style={styles.timePickerLabel}>Waktu Mulai:</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => openTimePicker('start', editingRange.tempStart)}
                    >
                      <Ionicons name="time-outline" size={20} color="#f59e0b" />
                      <Text style={styles.timePickerButtonText}>{editingRange.tempStart}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* End Time */}
                  <View style={styles.timePickerRow}>
                    <Text style={styles.timePickerLabel}>Waktu Selesai:</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => openTimePicker('end', editingRange.tempEnd)}
                    >
                      <Ionicons name="time-outline" size={20} color="#f59e0b" />
                      <Text style={styles.timePickerButtonText}>{editingRange.tempEnd}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={cancelEditTimeRange}
                    >
                      <Text style={styles.modalButtonTextCancel}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonApply]}
                      onPress={saveEditedTimeRange}
                    >
                      <Text style={styles.modalButtonTextApply}>Simpan</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Time Picker */}
                {showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={handleTimePickerChange}
                  />
                )}
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerRight: {
    width: 38,
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  toggleCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  infoAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  infoAlertText: {
    fontSize: 13,
    color: '#1e40af',
    flex: 1,
  },
  bulkActionsContainer: {
    gap: 12,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bulkActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  rangeCountBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rangeCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  dayContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  timeRangeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  timeRangeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeRangeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
  },
  timeRangeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  timeRangeButton: {
    padding: 6,
  },
  noRangesText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  addRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  addRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  addRangeTextDisabled: {
    color: '#9ca3af',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#f59e0b',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabDisabled: {
    backgroundColor: '#9ca3af',
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timePickerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  timePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonApply: {
    backgroundColor: '#f59e0b',
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  modalButtonTextApply: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});

