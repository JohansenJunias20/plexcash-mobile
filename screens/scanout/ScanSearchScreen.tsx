import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, DrawerActions, useIsFocused } from '@react-navigation/native';
import ApiService from '../../services/api';
import { Audio } from 'expo-av';

interface ScanResult {
  resi: string;
  timestamp: Date;
  status: 'found' | 'not_found' | 'searching';
  orderId?: string;
  idEcommerce?: number;
  invoice?: string;
  platform?: string;
  ecommerceName?: string;
  orderStatus?: string;
}

export default function ScanSearchScreen() {
  const navigation = useNavigation<any>();
  const [hasPermission, setHasPermission] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(true);
  const [currentScan, setCurrentScan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pendingScans, setPendingScans] = useState<Set<string>>(new Set());
  const [manualInput, setManualInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const isCooldownRef = useRef(false);
  const device = useCameraDevice('back');
  const isFocused = useIsFocused();

  // Normalisasi resi dari berbagai format barcode.
  // Label Gojek/GoSend sering menggunakan QR code yang berisi URL tracking
  // atau format berbeda dari nomor resi yang tersimpan di database.
  const normalizeResi = (raw: string): string => {
    if (!raw) return raw;
    const trimmed = raw.trim();

    // ── 1. Ekstrak resi Gojek (GK-XX-XXXXXXXXX) dari manapun di dalam string ──
    // Hanya cocokkan jika format sudah memiliki tanda dash yang benar
    const gojekWithDash = trimmed.match(/\bGK-\d{1,3}-\d{5,}\b/i);
    if (gojekWithDash) return gojekWithDash[0].toUpperCase();

    // ── 2. Cek apakah ini URL tracking ──
    // mis. https://track.gojek.com/s/GK-11-876133085
    //      https://gojek.com/track?tracking=GK-11-876133085
    try {
      const url = new URL(trimmed);
      // Cek query params dulu (lebih spesifik)
      const trackingParam =
        url.searchParams.get('tracking') ||
        url.searchParams.get('resi') ||
        url.searchParams.get('awb') ||
        url.searchParams.get('no') ||
        url.searchParams.get('waybill');
      if (trackingParam && trackingParam.length > 4) return trackingParam;

      // Ambil bagian terakhir URL path
      const pathParts = url.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.length > 4) return lastPart;
    } catch {
      // Bukan URL, lanjut
    }

    // ── 3. Cek apakah JSON ──
    // mis. {"no_resi":"GK-11-876133085","kurir":"GOSEND"}
    try {
      const parsed = JSON.parse(trimmed);
      const resiValue =
        parsed.resi ||
        parsed.no_resi ||
        parsed.tracking_number ||
        parsed.tracking ||
        parsed.awb ||
        parsed.waybill ||
        parsed.id;
      if (resiValue && String(resiValue).length > 4) return String(resiValue);
    } catch {
      // Bukan JSON, gunakan nilai asli
    }

    // ── 4. Fallback: trim saja ──
    return trimmed;
  };

  const codeScanner = useCodeScanner({
    // Tambah format barcode tambahan untuk Gojek/GoSend:
    // - pdf-417: sering digunakan pada label pengiriman
    // - data-matrix: digunakan beberapa kurir
    // - aztec: alternatif QR code
    // - itf: barcode numerik untuk logistik
    // - code-93: varian code-39
    codeTypes: ['qr', 'code-128', 'code-39', 'code-93', 'ean-13', 'ean-8', 'pdf-417', 'data-matrix', 'aztec', 'itf'],
    onCodeScanned: (codes) => {
      if (isCooldownRef.current) return;
      if (codes.length > 0 && codes[0].value) {
        const normalized = normalizeResi(codes[0].value);
        handleBarcodeScanned({ data: normalized });
      }
    },
  });

  useEffect(() => {
    checkPermission();
  }, []);

  const playSound = async (type: 'success' | 'error') => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        type === 'success'
          ? require('../../assets/sounds/success.mp3')
          : require('../../assets/sounds/error.mp3')
      );
      await sound.playAsync();
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

  const handleManualSubmit = () => {
    const trimmedInput = manualInput.trim();
    if (trimmedInput) {
      handleBarcodeScanned({ data: trimmedInput });
      setManualInput('');
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (processing || isCooldownRef.current) return;

    // Normalisasi resi sebelum diproses (kalau belum dinormalisasi dari codeScanner)
    const resi = normalizeResi(data);

    if (pendingScans.has(resi)) return;

    setScanning(false);
    setProcessing(true);
    setCurrentScan(resi);
    setPendingScans(prev => new Set(prev).add(resi));

    console.log(`[ScanSearch] Scan: raw="${data}" normalized="${resi}"`);

    try {
      // Search order by resi number
      const response = await ApiService.authenticatedRequest(
        `/get/ecommerce/order/by_resi?resi=${encodeURIComponent(resi)}`
      );

      setPendingScans(prev => {
        const newSet = new Set(prev);
        newSet.delete(resi);
        return newSet;
      });

      if (response?.status && response?.data) {
        const d = response.data;
        const orderId = String(d.id || d.order_id || '');
        const idEcommerce = Number(d.id_ecommerce || 0);

        // Haptic + sound feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await playSound('success');

        const newResult: ScanResult = {
          resi: resi,
          timestamp: new Date(),
          status: 'found',
          orderId,
          idEcommerce,
          invoice: d.invoice,
          platform: d.from || d.platform,
          ecommerceName: d.ecommerce_name,
          orderStatus: d.status,
        };

        setResults(prev => [newResult, ...prev]);
        setCurrentScan(null);
        setProcessing(false);
        setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, );

        // Auto-navigate to order detail (dalam ScanSearchStack)
        navigation.navigate('OrderDetail', {
          id: orderId,
          id_ecommerce: idEcommerce,
          scan_timestamp: d.scan_timestamp || null,
          print_timestamp: d.print_timestamp || undefined,
          scanned: d.scanned === true || d.scanned === 1 || d.scanned === '1',
        });
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await playSound('error');

        const newResult: ScanResult = {
          resi: resi,
          timestamp: new Date(),
          status: 'not_found',
        };
        setResults(prev => [newResult, ...prev]);

        Alert.alert(
          '🔍 Pesanan Tidak Ditemukan',
          response?.reason || `Tidak ada pesanan dengan resi: ${resi}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentScan(null);
                setProcessing(false);
                setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, );
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error searching by resi:', error);

      setPendingScans(prev => {
        const newSet = new Set(prev);
        newSet.delete(resi);
        return newSet;
      });

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await playSound('error');

      const newResult: ScanResult = {
        resi: resi,
        timestamp: new Date(),
        status: 'not_found',
      };
      setResults(prev => [newResult, ...prev]);

      Alert.alert(
        '✗ Error',
        'Gagal menghubungi server. Periksa koneksi internet Anda.',
        [
          {
            text: 'OK',
            onPress: () => {
              setCurrentScan(null);
              setProcessing(false);
              setTimeout(() => { setScanning(true); isCooldownRef.current = false; }, );
            }
          }
        ]
      );
    }
  };

  const openOrderDetail = (item: ScanResult) => {
    if (item.status === 'found' && item.orderId && item.idEcommerce !== undefined) {
      navigation.navigate('OrderDetail', {
        id: item.orderId,
        id_ecommerce: item.idEcommerce,
      });
    }
  };

  const clearResults = () => {
    Alert.alert(
      'Hapus Riwayat',
      'Apakah Anda yakin ingin menghapus semua riwayat scan?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => setResults([]) }
      ]
    );
  };

  const removeResult = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  };



  const renderResult = ({ item, index }: { item: ScanResult; index: number }) => (
    <TouchableOpacity
      style={[
        styles.resultCard,
        item.status === 'found' ? styles.foundCard : styles.notFoundCard
      ]}
      onPress={() => openOrderDetail(item)}
      disabled={item.status !== 'found'}
    >
      <View style={{ flex: 1 }}>
        {/* Resi number */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons
            name={item.status === 'found' ? 'checkmark-circle' : 'close-circle'}
            size={22}
            color={item.status === 'found' ? '#10B981' : '#FFFFFF'}
          />
          <Text style={[styles.resiNumber, item.status === 'not_found' && styles.notFoundText]}>
            {item.resi}
          </Text>
        </View>

        {/* Time */}
        <Text style={[styles.resultTime, item.status === 'not_found' && styles.notFoundSubText]}>
          {item.timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })}
        </Text>

        {/* Order info if found */}
        {item.status === 'found' && (
          <View style={styles.orderInfo}>
            {item.ecommerceName && (
              <Text style={styles.orderInfoText}>
                🏪 {item.ecommerceName}
              </Text>
            )}
            {item.invoice && (
              <Text style={styles.orderInfoText}>
                📄 {item.invoice}
              </Text>
            )}
            {item.orderStatus && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{item.orderStatus.toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}

        {/* Not found message */}
        {item.status === 'not_found' && (
          <View style={styles.notFoundContainer}>
            <Ionicons name="search-outline" size={14} color="#FEE2E2" />
            <Text style={styles.notFoundMessage}>Pesanan tidak ditemukan</Text>
          </View>
        )}
      </View>

      {/* Action area */}
      <View style={{ alignItems: 'center', gap: 8 }}>
        {item.status === 'found' && (
          <View style={styles.openDetailButton}>
            <Ionicons name="open-outline" size={18} color="#3B82F6" />
          </View>
        )}
        <TouchableOpacity style={styles.removeButton} onPress={() => removeResult(index)}>
          <Ionicons
            name="trash-outline"
            size={18}
            color={item.status === 'not_found' ? '#FFFFFF' : '#9CA3AF'}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header - ALWAYS VISIBLE */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#3B82F6" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Cari by Scan</Text>
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
        <LinearGradient colors={['#3B82F6', '#1D4ED8', '#1E3A8A']} style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="white" />
            <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>
            <Text style={styles.permissionText}>
              Diperlukan akses kamera untuk scan barcode resi dan mencari pesanan terkait.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Berikan Izin</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.container}>
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={18} color="#1D4ED8" />
            <Text style={styles.infoBannerText}>
              Scan barcode resi untuk menemukan dan membuka detail pesanan
            </Text>
          </View>

          {/* Camera View */}
          <View style={styles.cameraContainer}>
            {isCameraActive ? (
              device == null ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>Memuat kamera...</Text>
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
                      Scan barcode resi untuk mencari pesanan
                    </Text>
                    {currentScan && (
                      <View style={styles.scanFeedback}>
                        <ActivityIndicator size="small" color="white" />
                        <Text style={styles.scanFeedbackText}>Mencari pesanan...</Text>
                      </View>
                    )}
                  </View>
                </Camera>
              )
            ) : (
              <View style={[styles.camera, styles.cameraDisabledOverlay]}>
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

          {/* Manual Input */}
          <View style={styles.manualInputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="barcode-outline" size={24} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                ref={inputRef}
                style={styles.manualInput}
                value={manualInput}
                onChangeText={setManualInput}
                onSubmitEditing={handleManualSubmit}
                placeholder="Ketik/scan resi dengan Bluetooth scanner..."
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
              style={[styles.submitButton, (!manualInput.trim() || processing) && styles.submitButtonDisabled]}
              onPress={handleManualSubmit}
              disabled={!manualInput.trim() || processing}
            >
              {processing
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="search" size={20} color="white" />
              }
            </TouchableOpacity>
          </View>

          {/* Results list */}
          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="list" size={20} color="#111827" />
                <Text style={styles.listTitle}>Riwayat Scan ({results.length})</Text>
              </View>
              {results.length > 0 && (
                <TouchableOpacity onPress={clearResults}>
                  <Text style={styles.clearButton}>Hapus Semua</Text>
                </TouchableOpacity>
              )}
            </View>

            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>Belum ada scan</Text>
                <Text style={styles.emptySubtext}>
                  Scan barcode resi untuk menemukan pesanan terkait
                </Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item, index) => `${item.resi}-${index}`}
                renderItem={renderResult}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>

          {/* Status bar */}
          <View style={styles.statusBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[
                styles.statusDot,
                { backgroundColor: processing ? '#F59E0B' : (scanning ? '#10B981' : '#EF4444') }
              ]} />
              <Text style={styles.statusText}>
                {processing ? 'Mencari pesanan...' : (scanning ? 'Siap scan' : 'Kamera dijeda')}
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
    borderBottomColor: '#e5e7eb',
  },
  hamburgerButton: { padding: 5 },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginLeft: 38,
  },
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '500',
    lineHeight: 18,
  },
  cameraContainer: {
    height: 250,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraDisabledOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraDisabledText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  enableCameraButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  enableCameraButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
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
    width: 280,
    height: 120,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#3B82F6',
    borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  instructionText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanFeedback: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -70 }, { translateY: -30 }],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  scanFeedbackText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
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
  inputIcon: { marginRight: 8 },
  manualInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 12,
  },
  clearInputButton: { padding: 4 },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
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
    fontSize: 16,
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
  resultCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  foundCard: {
    backgroundColor: '#F0FDF4',
    borderLeftColor: '#10B981',
  },
  notFoundCard: {
    backgroundColor: '#DC2626',
    borderLeftColor: '#991B1B',
    borderWidth: 2,
    borderColor: '#991B1B',
  },
  resiNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  notFoundText: {
    color: '#FFFFFF',
  },
  resultTime: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 30,
    marginBottom: 6,
  },
  notFoundSubText: {
    color: '#FEE2E2',
  },
  orderInfo: {
    marginLeft: 30,
    gap: 3,
  },
  orderInfoText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  notFoundContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 30,
    gap: 4,
  },
  notFoundMessage: {
    fontSize: 12,
    color: '#FEE2E2',
    fontWeight: '600',
  },
  openDetailButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    padding: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
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
