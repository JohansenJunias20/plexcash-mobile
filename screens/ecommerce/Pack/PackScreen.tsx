import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Linking, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, DrawerActions, useIsFocused } from '@react-navigation/native';
import ApiService from '../../../services/api';
import { Audio } from 'expo-av';

interface ScannedOrder {
  orderNumber: string;
  timestamp: Date;
  status: 'success' | 'error';
  message?: string;
}

export default function PackScreen(): React.JSX.Element {
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

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'code-39', 'ean-13', 'ean-8'],
    onCodeScanned: (codes) => {
      if (isCooldownRef.current) return;
      if (codes.length > 0 && codes[0].value) {
        const rawValue = codes[0].value;
        // Aggressive character normalization to strip control characters & trailing carriage returns from scanning hardware
        const normalizedValue = rawValue
          .replace(/[\x00-\x1F\x7F]/g, '') // remove all control characters
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
          .trim();
        handleBarcodeScanned({ data: normalizedValue });
      }
    },
  });

  useEffect(() => {
    checkPermission();
  }, []);

  const playSound = async (type: 'success' | 'warning' | 'error') => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        type === 'success' 
          ? require('../../../assets/sounds/success.mp3') 
          : type === 'warning' 
            ? require('../../../assets/sounds/warning.mp3') 
            : require('../../../assets/sounds/error.mp3')
      );
      await sound.playAsync();
      
      // Unload sound after playing
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
      return; // Silently ignore
    }

    setScanning(false);
    setProcessing(true);
    setCurrentScan(data);

    // Filter out order numbers (no pesanan), only accept resi (tracking numbers)
    if (isOrderNumber(data)) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await playSound('error');

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
              setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, 1000);
            }
          }
        ]
      );
      return;
    }

    // Add to pending scans to prevent duplicates while waiting for backend
    setPendingScans(prev => new Set(prev).add(data));

    try {
      // Send to backend pack scan endpoint
      const response = await ApiService.authenticatedRequest('/pack/scan', {
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
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await playSound('success');

        const newOrder: ScannedOrder = {
          orderNumber: data,
          timestamp: new Date(response.data?.time_pack || new Date()),
          status: 'success',
          message: response.message,
        };

        setScannedOrders(prev => [newOrder, ...prev]);
        setCurrentScan(null);
        setProcessing(false);
        setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, 1000);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const reason = response?.reason;
        let alertTitle = '✗ Pack Gagal';
        let alertMessage = response?.data?.message || response?.reason || 'Resi sudah pernah di-pack sebelumnya';

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
                setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, 1000);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);

      setPendingScans(prev => {
        const newSet = new Set(prev);
        newSet.delete(data);
        return newSet;
      });

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
              setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, 1000);
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
        {item.message && (
          <View style={styles.errorMessageContainer}>
            <Ionicons name="warning" size={16} color={item.status === 'error' ? '#FFFFFF' : '#047857'} />
            <Text style={[styles.errorMessage, item.status === 'success' && styles.successMessageText]}>{item.message}</Text>
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
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Pack Menu</Text>
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
        <View style={styles.headerRight} />
      </View>

      {/* Body Content */}
      {!hasPermission ? (
        <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="white" />
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionText}>
              We need access to your camera to scan shipping labels for packing.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.container}>
          {/* Camera View */}
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
                    Scan tracking number (resi) from label
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
            {/* Disabled overlay */}
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

          {/* Manual Input Section */}
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
                <Ionicons name="cube-outline" size={20} color="#111827" />
                <Text style={styles.listTitle}>Packed Packages ({scannedOrders.length})</Text>
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
                <Text style={styles.emptyText}>No packages packed yet</Text>
                <Text style={styles.emptySubtext}>
                  Point your camera at a tracking barcode or scan with a Bluetooth device
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
                {processing ? 'Menyimpan ke database...' : (scanning ? 'Siap scan resi' : 'Kamera dijeda')}
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
    height: 220,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraDisabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraDisabledText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 16,
  },
  enableCameraButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  enableCameraButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 280,
    height: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#f59e0b',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderLeftWidth: 4,
    borderTopWidth: 4,
  },
  topRight: {
    top: -2,
    right: -2,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  instructionText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  scanFeedback: {
    position: 'absolute',
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  scanFeedbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  manualInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  manualInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    height: '100%',
  },
  clearInputButton: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#f59e0b',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  clearButton: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  successCard: {
    backgroundColor: 'white',
    borderLeftWidth: 5,
    borderLeftColor: '#10B981',
  },
  errorCard: {
    backgroundColor: '#EF4444',
    borderLeftWidth: 5,
    borderLeftColor: '#B91C1C',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 8,
  },
  errorOrderNumber: {
    color: 'white',
  },
  orderTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  errorOrderTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  errorMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  errorMessage: {
    fontSize: 12,
    color: 'white',
    marginLeft: 6,
    fontWeight: '500',
  },
  successMessageText: {
    color: '#065F46',
  },
  removeButton: {
    padding: 8,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scanAgainText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
