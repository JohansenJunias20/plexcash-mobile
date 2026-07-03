import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Linking, TextInput, ScrollView, RefreshControl, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, DrawerActions, useIsFocused } from '@react-navigation/native';
import ApiService from '../../services/api';
import { Audio } from 'expo-av';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ScannedOrder {
  orderNumber: string;
  timestamp: Date;
  status: 'success' | 'error';
  message?: string;
}

export default function ScanOutScreen(): JSX.Element {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState(false);
  const [scannedOrders, setScannedOrders] = useState<ScannedOrder[]>([]);
  const [scanning, setScanning] = useState(true);
  const [currentScan, setCurrentScan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pendingScans, setPendingScans] = useState<Set<string>>(new Set()); // Track pending backend requests
  const [manualInput, setManualInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const isCooldownRef = useRef(false);
  const device = useCameraDevice('back');
  const isFocused = useIsFocused();
  
  const [activeTab, setActiveTab] = useState(0);
  const [laporanData, setLaporanData] = useState<any>(null);
  const [laporanLoading, setLaporanLoading] = useState(false);
  
  // Search States
  const [searchResi, setSearchResi] = useState('');
  const [searchStatus, setSearchStatus] = useState<'semua' | 'sudah' | 'belum'>('semua');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchAggregation, setSearchAggregation] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(new Date());
  const [dateTo, setDateTo] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState<{type: 'from' | 'to', visible: boolean}>({type: 'from', visible: false});

  const onDateChange = (event: any, selectedDate?: Date) => {
    const isFrom = showDatePicker.type === 'from';
    if (Platform.OS === 'android') {
      setShowDatePicker({ ...showDatePicker, visible: false });
    }
    if (selectedDate) {
      if (isFrom) setDateFrom(selectedDate);
      else setDateTo(selectedDate);
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'code-39', 'ean-13', 'ean-8'],
    onCodeScanned: (codes) => {
      if (isCooldownRef.current) return;
      if (codes.length > 0 && codes[0].value) {
        handleBarcodeScanned({ data: codes[0].value });
      }
    },
  });

  useEffect(() => {
    checkPermission();
    // Cleanup sounds on unmount
    return () => {
      // Audio sounds are managed individually in playSound with unloadAsync
    };
  }, []);

  const fetchTodayStats = async (statusOverride?: string) => {
    try {
      const currentStatus = statusOverride !== undefined ? statusOverride : searchStatus;
      
      const todayDate = new Date();
      const todayStr = todayDate.getFullYear() + '-' + String(todayDate.getMonth() + 1).padStart(2, '0') + '-' + String(todayDate.getDate()).padStart(2, '0');
      
      let url = `/scanout/search?date_from=${todayStr}&date_to=${todayStr}&include_printed_list=true&limit=1`;
      if (currentStatus === 'sudah') url += '&status_scan=sudah';
      else if (currentStatus === 'belum') url += '&status_scan=belum';
      if (searchResi.trim() !== '') url += `&resi=${encodeURIComponent(searchResi.trim())}`;

      const response = await ApiService.authenticatedRequest(url, { method: 'GET' });
      if (response?.status && response.aggregation) {
        setLaporanData(response.aggregation);
      }
    } catch (error) {
      console.error('Error fetching today stats:', error);
    }
  };

  const fetchSearchResults = async (statusOverride?: string) => {
    setLaporanLoading(true);
    try {
      const currentStatus = statusOverride !== undefined ? statusOverride : searchStatus;
      
      const fromStr = dateFrom.getFullYear() + '-' + String(dateFrom.getMonth() + 1).padStart(2, '0') + '-' + String(dateFrom.getDate()).padStart(2, '0');
      const toStr = dateTo.getFullYear() + '-' + String(dateTo.getMonth() + 1).padStart(2, '0') + '-' + String(dateTo.getDate()).padStart(2, '0');
      
      let url = `/scanout/search?date_from=${fromStr}&date_to=${toStr}&limit=100`;
      if (currentStatus === 'sudah') url += '&status_scan=sudah';
      else if (currentStatus === 'belum') url += '&status_scan=belum';
      if (searchResi.trim() !== '') url += `&resi=${encodeURIComponent(searchResi.trim())}`;
      
      const response = await ApiService.authenticatedRequest(url, { method: 'GET' });
      if (response?.status) {
        if (response.data) setSearchResults(response.data);
        else setSearchResults([]);
        
        if (response.aggregation) setSearchAggregation(response.aggregation);
      } else {
        setSearchResults([]);
        setSearchAggregation(null);
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
      Alert.alert('Error', 'Gagal memuat hasil pencarian.');
    } finally {
      setLaporanLoading(false);
    }
  };

  const handleRefreshLaporan = async (statusOverride?: string) => {
    setLaporanLoading(true);
    await Promise.all([fetchTodayStats(statusOverride), fetchSearchResults(statusOverride)]);
    setLaporanLoading(false);
  };

  useEffect(() => {
    if (activeTab === 1) {
      if (!laporanData) fetchTodayStats();
      if (searchResults.length === 0) fetchSearchResults();
    }
  }, [activeTab]);

  const playSound = async (type: 'success' | 'warning' | 'error') => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        type === 'success' 
          ? require('../../assets/sounds/success.mp3') 
          : type === 'warning' 
            ? require('../../assets/sounds/warning.mp3') 
            : require('../../assets/sounds/error.mp3')
      );
      await sound.playAsync();
      
      // Unload sound after playing (approximate duration)
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const checkPermission = async () => {
    const status = await Camera.getCameraPermissionStatus();
    setHasPermission(status === 'granted');
  };

  const requestPermission = async () => {
    const status = await Camera.requestCameraPermission();
    if (status === 'denied') {
      await Linking.openSettings();
    }
    setHasPermission(status === 'granted');
  };

  const isOrderNumber = (data: string): boolean => {
    // Check if it's a no pesanan (order number) format:
    // - Length is 14 digits
    // - First 6 digits are YYYYMM (year + month)
    if (data.length === 14 && /^\d{14}$/.test(data)) {
      const yearMonth = data.substring(0, 6);
      const year = parseInt(yearMonth.substring(0, 4));
      const month = parseInt(yearMonth.substring(4, 6));

      // Validate year (2020-2099) and month (01-12)
      if (year >= 2020 && year <= 2099 && month >= 1 && month <= 12) {
        return true; // This is a no pesanan (order number)
      }
    }
    return false; // This is likely a resi (tracking number)
  };

  const handleManualSubmit = () => {
    const trimmedInput = manualInput.trim();
    if (trimmedInput) {
      handleBarcodeScanned({ data: trimmedInput });
      setManualInput(''); // Clear input after submission
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (processing || isCooldownRef.current) return;

    // Check if this resi is already being processed (prevent duplicate scans)
    if (pendingScans.has(data)) {
      console.log(`Ignoring duplicate scan for resi: ${data} (already pending)`);
      return; // Silently ignore - no alert, no haptic
    }

    setScanning(false);
    setProcessing(true);
    setCurrentScan(data);

    // Filter out order numbers (no pesanan), only accept resi (tracking numbers)
    if (isOrderNumber(data)) {
      // Trigger HEAVY error vibration (stronger and more noticeable)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await playSound('error');

      // Add to list as error for visual feedback
      const errorOrder: ScannedOrder = {
        orderNumber: data,
        timestamp: new Date(),
        status: 'error',
        message: 'Nomor Pesanan - Bukan Resi',
      };
      setScannedOrders(prev => [errorOrder, ...prev]);

      Alert.alert(
        '⚠️ Nomor Pesanan Terdeteksi',
        'Ini adalah nomor pesanan. Silakan scan barcode RESI (nomor resi) sebagai gantinya.',
        [
          {
            text: 'OK',
            onPress: () => {
              setCurrentScan(null);
              setProcessing(false);
              // Re-enable scanning after 1 second cooldown
              setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, );
            }
          }
        ]
      );
      return;
    }

    // Add to pending scans to prevent duplicates while waiting for backend
    setPendingScans(prev => new Set(prev).add(data));

    try {
      // Send to backend for validation and storage
      const response = await ApiService.authenticatedRequest('/scanout/scan', {
        method: 'POST',
        body: JSON.stringify({ resi: data }),
      });

      // Remove from pending scans after backend responds
      setPendingScans(prev => {
        const newSet = new Set(prev);
        newSet.delete(data);
        return newSet;
      });

      if (response?.status) {
        // Trigger SHORT success vibration (light and quick)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await playSound('success');

        // Success - resi scanned and saved
        const newOrder: ScannedOrder = {
          orderNumber: data,
          timestamp: new Date(response.data.time_scan),
          status: 'success',
          message: response.message,
        };

        setScannedOrders(prev => [newOrder, ...prev]);

        // NO ALERT for success - only visual feedback (green card) and haptic
        setCurrentScan(null);
        setProcessing(false);
        // Re-enable scanning after 1 second cooldown
        setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, );
      } else {
        // Trigger HEAVY error vibration (stronger and more noticeable)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const reason = response?.reason;
        let alertTitle = '✗ Scan Gagal';
        let alertMessage = response?.data?.message || response?.reason || 'Resi sudah pernah di-scan sebelumnya';

        if (reason === 'ORDER_CANCELLED') {
          alertTitle = '🚨 PESANAN DIBATALKAN';
          alertMessage = response?.message || 'Pesanan ini telah dibatalkan. JANGAN DIKIRIM!';
          await playSound('error');
        } else if (reason === 'ALREADY_IN_TRANSIT') {
          alertTitle = '⚠️ SUDAH TERKIRIM';
          alertMessage = response?.message || 'Pesanan ini sudah dalam perjalanan/terkirim.';
          await playSound('warning');
        } else {
          await playSound('error');
        }

        // Error - resi already exists or validation failed
        const errorOrder: ScannedOrder = {
          orderNumber: data,
          timestamp: new Date(),
          status: 'error',
          message: alertTitle.replace('🚨 ', '').replace('⚠️ ', '').replace('✗ ', ''),
        };

        setScannedOrders(prev => [errorOrder, ...prev]);

        Alert.alert(
          alertTitle,
          alertMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentScan(null);
                setProcessing(false);
                // Re-enable scanning after 1 second cooldown
                setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, );
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);

      // Remove from pending scans on error
      setPendingScans(prev => {
        const newSet = new Set(prev);
        newSet.delete(data);
        return newSet;
      });

      // Trigger HEAVY error vibration (stronger and more noticeable)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await playSound('error');

      const errorOrder: ScannedOrder = {
        orderNumber: data,
        timestamp: new Date(),
        status: 'error',
        message: 'Network error',
      };

      setScannedOrders(prev => [errorOrder, ...prev]);

      Alert.alert(
        '✗ Error',
        'Gagal menghubungi server. Periksa koneksi internet Anda.',
        [
          {
            text: 'OK',
            onPress: () => {
              setCurrentScan(null);
              setProcessing(false);
              // Re-enable scanning after 1 second cooldown
              setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, );
            }
          }
        ]
      );
    }
  };

  const clearScans = () => {
    Alert.alert(
      'Clear All Scans',
      'Are you sure you want to clear all scanned orders?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => setScannedOrders([])
        }
      ]
    );
  };

  const removeOrder = (index: number) => {
    setScannedOrders(prev => prev.filter((_, i) => i !== index));
  };

const renderScannedOrder = ({ item, index }: { item: ScannedOrder; index: number }) => (
    <View style={[
      styles.orderCard,
      item.status === 'error' ? styles.errorCard : styles.successCard
    ]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons
            name={item.status === 'success' ? 'checkmark-circle' : 'close-circle'}
            size={24}
            color={item.status === 'success' ? '#10B981' : '#FFFFFF'}
          />
          <Text style={[
            styles.orderNumber,
            item.status === 'error' && styles.errorOrderNumber
          ]}>
            {item.orderNumber}
          </Text>
        </View>
        <Text style={[
          styles.orderTime,
          item.status === 'error' && styles.errorOrderTime
        ]}>
          {item.timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </Text>
        {item.message && item.status === 'error' && (
          <View style={styles.errorMessageContainer}>
            <Ionicons name="warning" size={16} color="#FFFFFF" />
            <Text style={styles.errorMessage}>{item.message}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeOrder(index)}
      >
        <Ionicons
          name="trash-outline"
          size={20}
          color={item.status === 'error' ? '#FFFFFF' : '#EF4444'}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.safeContainer, { paddingTop: insets.top }]}>
      {/* Header with Hamburger Menu - ALWAYS VISIBLE */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Scan Out</Text>
        {activeTab === 0 ? (
          <TouchableOpacity
            style={styles.cameraToggleButton}
            onPress={() => setIsCameraActive(prev => !prev)}
          >
            <Ionicons 
              name={isCameraActive ? "videocam" : "videocam-off"} 
              size={24} 
              color={isCameraActive ? "#10B981" : "#EF4444"} 
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 0 && styles.tabButtonActive]}
          onPress={() => setActiveTab(0)}
        >
          <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>Scan Resi</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 1 && styles.tabButtonActive]}
          onPress={() => setActiveTab(1)}
        >
          <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>Progress & Laporan</Text>
        </TouchableOpacity>
      </View>

      {/* Body Content */}
      {activeTab === 1 ? (
        <ScrollView 
          style={styles.laporanContainer}
          refreshControl={
            <RefreshControl refreshing={laporanLoading} onRefresh={handleRefreshLaporan} colors={['#f59e0b']} />
          }
        >
          {laporanLoading && !laporanData ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={{ marginTop: 10, color: '#6B7280' }}>Memuat laporan...</Text>
            </View>
          ) : laporanData ? (
            <View style={styles.laporanContent}>
              
              {/* Filter Section */}
              <View style={styles.laporanCard}>
                <Text style={styles.laporanCardTitle}>Cari & Filter Scan</Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => setShowDatePicker({ type: 'from', visible: true })}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                    <Text style={styles.datePickerText}>Dari: {dateFrom.toLocaleDateString('id-ID')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => setShowDatePicker({ type: 'to', visible: true })}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                    <Text style={styles.datePickerText}>Sampai: {dateTo.toLocaleDateString('id-ID')}</Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker.visible && (
                  <DateTimePicker
                    value={showDatePicker.type === 'from' ? dateFrom : dateTo}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )}
                
                <View style={styles.statusFilterContainer}>
                  <TouchableOpacity 
                    style={[styles.statusFilterBtn, searchStatus === 'semua' && styles.statusFilterBtnActive]}
                    onPress={() => {
                      setSearchStatus('semua');
                      handleRefreshLaporan('semua');
                    }}
                  >
                    <Text style={[styles.statusFilterText, searchStatus === 'semua' && styles.statusFilterTextActive]}>Semua</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.statusFilterBtn, searchStatus === 'sudah' && styles.statusFilterBtnActive]}
                    onPress={() => {
                      setSearchStatus('sudah');
                      handleRefreshLaporan('sudah');
                    }}
                  >
                    <Text style={[styles.statusFilterText, searchStatus === 'sudah' && styles.statusFilterTextActive]}>Sudah Scan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.statusFilterBtn, searchStatus === 'belum' && styles.statusFilterBtnActive]}
                    onPress={() => {
                      setSearchStatus('belum');
                      handleRefreshLaporan('belum');
                    }}
                  >
                    <Text style={[styles.statusFilterText, searchStatus === 'belum' && styles.statusFilterTextActive]}>Belum Scan</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Nomor Resi..."
                    value={searchResi}
                    onChangeText={setSearchResi}
                    onSubmitEditing={() => handleRefreshLaporan()}
                    returnKeyType="search"
                  />
                  <TouchableOpacity style={styles.searchBtn} onPress={() => handleRefreshLaporan()}>
                    <Ionicons name="search" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.laporanCard}>
                <Text style={styles.laporanCardTitle}>Keseluruhan (Hari Ini)</Text>
                {(() => {
                  const rawTotal = laporanData.overall?.printed || 0;
                  const scanned = laporanData.overall?.scanned || 0;
                  const total = rawTotal < scanned ? scanned : rawTotal;
                  const percent = total > 0 ? Math.round((scanned / total) * 100) : 0;
                  return (
                    <View style={styles.progressRow}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: percent >= 100 ? '#10B981' : '#3B82F6' }]} />
                      </View>
                      <Text style={styles.progressText}>{scanned} / {total} ({percent}%)</Text>
                    </View>
                  );
                })()}
              </View>

              {searchAggregation?.byShop && Object.keys(searchAggregation.byShop).length > 0 && (
                <View style={styles.laporanCard}>
                  <Text style={styles.laporanCardTitle}>Berdasarkan Toko</Text>
                  {Object.keys(searchAggregation.byShop).sort().map(shop => {
                    const rawTotal = searchAggregation.byShop[shop].printed || 0;
                    const scanned = searchAggregation.byShop[shop].scanned || 0;
                    const total = rawTotal < scanned ? scanned : rawTotal;
                    const percent = total > 0 ? Math.round((scanned / total) * 100) : 0;
                    return (
                      <View key={shop} style={styles.progressItem}>
                        <Text style={styles.progressLabel}>{shop}</Text>
                        <View style={styles.progressRow}>
                          <View style={styles.progressBarBgSmall}>
                            <View style={[styles.progressBarFillSmall, { width: `${percent}%`, backgroundColor: percent >= 100 ? '#10B981' : '#F59E0B' }]} />
                          </View>
                          <Text style={styles.progressTextSmall}>{scanned}/{total} ({percent}%)</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {searchAggregation?.byExpedition && Object.keys(searchAggregation.byExpedition).length > 0 && (
                <View style={styles.laporanCard}>
                  <Text style={styles.laporanCardTitle}>Berdasarkan Ekspedisi</Text>
                  {Object.keys(searchAggregation.byExpedition).sort().map(exp => {
                    const rawTotal = searchAggregation.byExpedition[exp].printed || 0;
                    const scanned = searchAggregation.byExpedition[exp].scanned || 0;
                    const total = rawTotal < scanned ? scanned : rawTotal;
                    const percent = total > 0 ? Math.round((scanned / total) * 100) : 0;
                    return (
                      <View key={exp} style={styles.progressItem}>
                        <Text style={styles.progressLabel}>{exp}</Text>
                        <View style={styles.progressRow}>
                          <View style={styles.progressBarBgSmall}>
                            <View style={[styles.progressBarFillSmall, { width: `${percent}%`, backgroundColor: percent >= 100 ? '#10B981' : '#8B5CF6' }]} />
                          </View>
                          <Text style={styles.progressTextSmall}>{scanned}/{total} ({percent}%)</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Search Results List */}
              <View style={styles.laporanCard}>
                <Text style={styles.laporanCardTitle}>Hasil Pencarian ({searchResults.length})</Text>
                {searchResults.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Ionicons name="search-outline" size={40} color="#9CA3AF" />
                    <Text style={{ marginTop: 10, color: '#6B7280' }}>Tidak ada data scan ditemukan</Text>
                  </View>
                ) : (
                  searchResults.map((item, index) => (
                    <View key={item.order_id || index} style={styles.resultCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontWeight: 'bold', color: '#111827' }}>{item.resi}</Text>
                        <Text style={{ fontSize: 12, color: item.time_scan ? '#10B981' : '#EF4444', fontWeight: '500' }}>
                          {item.time_scan ? 'Sudah Scan' : 'Belum Scan'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Ionicons name="storefront-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 13, color: '#4B5563' }}>{item.shop_name || '-'}</Text>
                        {item.platform && (
                          <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                            <Text style={{ fontSize: 10, color: '#4B5563', fontWeight: '600' }}>{item.platform}</Text>
                          </View>
                        )}
                      </View>
                      {item.time_scan && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Ionicons name="time-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            {new Date(item.time_scan).toLocaleString('id-ID')}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280' }}>Data laporan tidak tersedia</Text>
            </View>
          )}
        </ScrollView>
      ) : !hasPermission ? (
        <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="white" />
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionText}>
              We need access to your camera to scan order numbers from shipping labels.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.container}>
          {/* Camera View - Camera always stays mounted to prevent layout recalculation */}
          <View style={styles.cameraContainer}>
            {device == null ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>Loading camera...</Text>
              </View>
            ) : (
              <Camera
                style={styles.camera}
                device={device}
                isActive={isCameraActive && isFocused}
                codeScanner={codeScanner}
              >
                <View style={styles.overlay}>
                  <View style={styles.scanArea}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                  </View>
                  <Text style={styles.instructionText}>
                    Scan order number from shipping label
                  </Text>
                  {currentScan && (
                    <View style={styles.scanFeedback}>
                      <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                      <Text style={styles.scanFeedbackText}>Scanned!</Text>
                    </View>
                  )}
                </View>
              </Camera>
            )}
            {/* Disabled overlay - absolute positioned so Camera never unmounts */}
            {!isCameraActive && (
              <View style={styles.cameraDisabledOverlay}>
                <Ionicons name="videocam-off" size={64} color="rgba(255,255,255,0.5)" />
                <Text style={styles.cameraDisabledText}>Kamera Dinonaktifkan</Text>
                <TouchableOpacity
                  style={styles.enableCameraButton}
                  onPress={() => setIsCameraActive(true)}
                >
                  <Text style={styles.enableCameraButtonText}>Aktifkan Kamera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Manual Input Section for Bluetooth Scanner */}
          <View style={styles.manualInputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="barcode-outline" size={24} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                ref={inputRef}
                style={styles.manualInput}
                value={manualInput}
                onChangeText={setManualInput}
                onSubmitEditing={handleManualSubmit}
                placeholder="Scan with Bluetooth scanner or type manually"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
              />
              {manualInput.length > 0 && (
                <TouchableOpacity
                  style={styles.clearInputButton}
                  onPress={() => setManualInput('')}
                >
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.submitButton, !manualInput.trim() && styles.submitButtonDisabled]}
              onPress={handleManualSubmit}
              disabled={!manualInput.trim() || processing}
            >
              <Ionicons name="checkmark" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Scanned Orders List */}
          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="list" size={20} color="#111827" />
                <Text style={styles.listTitle}>Scanned Orders ({scannedOrders.length})</Text>
              </View>
              {scannedOrders.length > 0 && (
                <TouchableOpacity onPress={clearScans}>
                  <Text style={styles.clearButton}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {scannedOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="scan-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>No orders scanned yet</Text>
                <Text style={styles.emptySubtext}>
                  Point your camera at a barcode or QR code on the shipping label
                </Text>
              </View>
            ) : (
              <FlatList
                data={scannedOrders}
                keyExtractor={(item, index) => `${item.orderNumber}-${index}`}
                renderItem={renderScannedOrder}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>

          {/* Status Indicator */}
          <View style={styles.statusBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.statusDot, { backgroundColor: processing ? '#F59E0B' : (scanning ? '#10B981' : '#EF4444') }]} />
              <Text style={styles.statusText}>
                {processing ? 'Menyimpan ke database...' : (scanning ? 'Siap scan' : 'Kamera dijeda')}
              </Text>
            </View>
            {processing && <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 8 }} />}
            {!processing && !scanning && (
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={() => {
                  setCurrentScan(null);
                  setScanning(true);
                }}
              >
                <Ionicons name="scan-outline" size={16} color="white" />
                <Text style={styles.scanAgainText}>Scan Lagi</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  topHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center', marginLeft: 38 },
  cameraToggleButton: { padding: 5, marginRight: 8 },
  headerRight: { width: 38 },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    height: 300,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 150,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#f59e0b',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  scanFeedback: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    borderRadius: 12,
  },
  scanFeedbackText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  listContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  clearButton: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  successCard: {
    backgroundColor: '#f9fafb',
    borderLeftColor: '#10B981',
  },
  errorCard: {
    backgroundColor: '#DC2626',
    borderLeftColor: '#991B1B',
    borderWidth: 2,
    borderColor: '#991B1B',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  errorOrderNumber: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  orderTime: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 32,
  },
  errorOrderTime: {
    color: '#FEE2E2',
  },
  errorMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 32,
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  errorMessage: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  statusBar: {
    backgroundColor: 'white',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  laporanContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  laporanContent: {
    padding: 16,
  },
  laporanCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  laporanCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  progressItem: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 13,
    color: '#6B7280',
    width: 90,
    textAlign: 'right',
  },
  progressBarBgSmall: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressBarFillSmall: {
    height: '100%',
    borderRadius: 3,
  },
  progressTextSmall: {
    fontSize: 12,
    color: '#6B7280',
    width: 80,
    textAlign: 'right',
  },
  statusFilterContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  datePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    backgroundColor: '#F9FAFB'
  },
  datePickerText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500'
  },
  statusFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  statusFilterBtnActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  statusFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  statusFilterTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },
  searchBtn: {
    backgroundColor: '#f59e0b',
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 12,
  },
  manualInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  manualInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 12,
  },
  clearInputButton: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  cameraDisabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraDisabledText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  enableCameraButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  enableCameraButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  scanAgainText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});

