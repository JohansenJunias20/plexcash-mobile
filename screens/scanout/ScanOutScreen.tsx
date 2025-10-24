import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../../services/api';

interface ScannedOrder {
  orderNumber: string;
  timestamp: Date;
  status: 'success' | 'error';
  message?: string;
}

export default function ScanOutScreen(): JSX.Element {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedOrders, setScannedOrders] = useState<ScannedOrder[]>([]);
  const [scanning, setScanning] = useState(true);
  const [currentScan, setCurrentScan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleBarcodeScanned = async ({ type, data }: BarcodeScanningResult) => {
    if (!scanning || processing) return;

    setScanning(false);
    setProcessing(true);
    setCurrentScan(data);

    try {
      // Send to backend for validation and storage
      const response = await ApiService.authenticatedRequest('/scanout/scan', {
        method: 'POST',
        body: JSON.stringify({ resi: data }),
      });

      if (response?.status) {
        // Success - resi scanned and saved
        const newOrder: ScannedOrder = {
          orderNumber: data,
          timestamp: new Date(response.data.time_scan),
          status: 'success',
          message: response.message,
        };

        setScannedOrders(prev => [newOrder, ...prev]);

        // Show success feedback
        Alert.alert(
          '✓ Scan Berhasil',
          `Resi: ${data}\n\nBerhasil disimpan ke database`,
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentScan(null);
                setProcessing(false);
                // Re-enable scanning after a short delay
                setTimeout(() => setScanning(true), 500);
              }
            }
          ]
        );
      } else {
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
                // Re-enable scanning after a short delay
                setTimeout(() => setScanning(true), 500);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);

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
              setTimeout(() => setScanning(true), 500);
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

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
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

  const renderScannedOrder = ({ item, index }: { item: ScannedOrder; index: number }) => (
    <View style={[
      styles.orderCard,
      { borderLeftColor: item.status === 'success' ? '#10B981' : '#EF4444' }
    ]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons
            name={item.status === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color={item.status === 'success' ? '#10B981' : '#EF4444'}
          />
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        </View>
        <Text style={styles.orderTime}>
          {item.timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </Text>
        {item.message && item.status === 'error' && (
          <Text style={styles.errorMessage}>{item.message}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeOrder(index)}
      >
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView 
          style={styles.camera} 
          facing="back"
          onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e']
          }}
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
        </CameraView>
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
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  orderTime: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 28,
  },
  errorMessage: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 28,
    marginTop: 4,
    fontStyle: 'italic',
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

