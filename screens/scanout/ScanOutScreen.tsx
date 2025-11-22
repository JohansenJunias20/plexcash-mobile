import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import ApiService from '../../services/api';

interface ScannedOrder {
  orderNumber: string;
  timestamp: Date;
  status: 'success' | 'error';
  message?: string;
}

export default function ScanOutScreen(): JSX.Element {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [scannedOrders, setScannedOrders] = useState<ScannedOrder[]>([]);
  const [scanning, setScanning] = useState(true);
  const [currentScan, setCurrentScan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pendingScans, setPendingScans] = useState<Set<string>>(new Set()); // Track pending backend requests
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'code-39', 'ean-13', 'ean-8'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        handleBarcodeScanned({ data: codes[0].value });
      }
    },
  });

  useEffect(() => {
    checkPermission();
  }, []);

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

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!scanning || processing) return;

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
              setTimeout(() => setScanning(true), 1000);
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
        setTimeout(() => setScanning(true), 1000);
      } else {
        // Trigger HEAVY error vibration (stronger and more noticeable)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        // Error - resi already exists or validation failed
        const errorOrder: ScannedOrder = {
          orderNumber: data,
          timestamp: new Date(),
          status: 'error',
          message: response?.reason || 'Unknown error',
        };

        setScannedOrders(prev => [errorOrder, ...prev]);

        Alert.alert(
          '✗ Scan Gagal',
          response?.data?.message || response?.reason || 'Resi sudah pernah di-scan sebelumnya',
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentScan(null);
                setProcessing(false);
                // Re-enable scanning after 1 second cooldown
                setTimeout(() => setScanning(true), 1000);
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
              setTimeout(() => setScanning(true), 1000);
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

  if (!hasPermission) {
    return (
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
    );
  }

  if (device == null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

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
    <SafeAreaView style={styles.safeContainer}>
      {/* Header with Hamburger Menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Scan Out</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.container}>
        {/* Camera View */}
        <View style={styles.cameraContainer}>
          <Camera
            style={styles.camera}
            device={device}
            isActive={scanning}
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.statusDot, { backgroundColor: processing ? '#F59E0B' : (scanning ? '#10B981' : '#EF4444') }]} />
          <Text style={styles.statusText}>
            {processing ? 'Menyimpan ke database...' : (scanning ? 'Siap scan' : 'Processing...')}
          </Text>
        </View>
        {processing && <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 8 }} />}
      </View>
    </View>
    </SafeAreaView>
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
  topHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
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
});

