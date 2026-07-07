import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Linking, TextInput, Switch, useWindowDimensions, RefreshControl, Modal, ScrollView } from 'react-native';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { WebView } from 'react-native-webview';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, DrawerActions, useIsFocused } from '@react-navigation/native';
import ApiService, { API_BASE_URL } from '../../../services/api';
import { getTokenAuth } from '../../../services/token';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

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
  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [enableVideoRecord, setEnableVideoRecord] = useState(true);
  const enableVideoRecordRef = useRef(enableVideoRecord);
  useEffect(() => { enableVideoRecordRef.current = enableVideoRecord; }, [enableVideoRecord]);

  const [workflowMode, setWorkflowMode] = useState<'BUTTON_TO_SCAN' | 'SCAN_TO_BUTTON'>('BUTTON_TO_SCAN');
  const [recordingStatus, setRecordingStatus] = useState<'IDLE' | 'RECORDING_VIA_BUTTON' | 'RECORDING_VIA_SCAN'>('IDLE');
  const recordingStatusRef = useRef(recordingStatus);
  useEffect(() => { recordingStatusRef.current = recordingStatus; }, [recordingStatus]);

  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(isRecording);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  const workflowModeRef = useRef(workflowMode);
  useEffect(() => { workflowModeRef.current = workflowMode; }, [workflowMode]);

  const gdriveConnectedRef = useRef(gdriveConnected);
  useEffect(() => { gdriveConnectedRef.current = gdriveConnected; }, [gdriveConnected]);

  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const pendingVideoResiRef = useRef<string | null>(null);
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
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'scan', title: 'Scan' },
    { key: 'preview', title: 'Preview' },
  ]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');

  // Modal Detail Pesanan
  const [orderDetailsModalVisible, setOrderDetailsModalVisible] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);

  const viewOrderDetails = async (resi: string, order_id?: number) => {
    setOrderDetailsModalVisible(true);
    setOrderDetailsLoading(true);
    setOrderDetails(null);
    try {
      let url = `/pack/order-details?resi=${encodeURIComponent(resi || '')}`;
      if (order_id) {
        url += `&order_id=${order_id}`;
      }
      const response = await ApiService.authenticatedRequest(url);
      if (response?.status) {
        setOrderDetails(response.data);
      } else {
        Alert.alert('Error', response?.reason || 'Gagal memuat detail pesanan');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Gagal memuat detail pesanan');
    } finally {
      setOrderDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (index === 1) {
      fetchPreviewData();
    }
  }, [index]);

  const fetchPreviewData = async () => {
    setPreviewLoading(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        date_from: date,
        date_to: date,
        page: '1',
        limit: '50'
      });
      const response = await ApiService.authenticatedRequest(`/pack/search?${params.toString()}`);
      if (response?.status && response?.data) {
        const sortedData = [...response.data].sort((a, b) => new Date(b.time_pack).getTime() - new Date(a.time_pack).getTime());
        setPreviewData(sortedData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  };

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
    checkGDriveConnection();
  }, []);

  const checkGDriveConnection = async () => {
    try {
      const response = await ApiService.authenticatedRequest('/google-drive/status');
      if (response?.status && response?.connected) {
        setGdriveConnected(true);
      } else {
        setGdriveConnected(false);
      }
    } catch (error) {
      console.log('Error checking GDrive connection:', error);
      setGdriveConnected(false);
    }
  };

  const startVideoRecording = async (resi?: string) => {
    if (!gdriveConnected) return;
    try {
      if (resi) {
        pendingVideoResiRef.current = resi;
      }
      setIsRecording(true);
      cameraRef.current?.startRecording({
        onRecordingFinished: async (video) => {
          const resiToUpload = pendingVideoResiRef.current;
          pendingVideoResiRef.current = null;

          if (!resiToUpload) return;
          setIsVideoUploading(true);
          try {
            const token = await getTokenAuth();
            const formData = new FormData();
            
            let videoPath = video.path;
            if (videoPath.startsWith('file://')) {
              videoPath = videoPath.substring(7);
            }
            const uriToUpload = `file://${videoPath}`;
            
            formData.append('file', {
              uri: uriToUpload,
              name: `Pack_${resiToUpload}_${new Date().getTime()}.mp4`,
              type: 'video/mp4'
            } as any);

            const response = await fetch(`${API_BASE_URL}/google-drive/upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData,
            });
            
            const rawText = await response.text();
            console.log('Upload response text:', rawText);
            
            let uploadResponse;
            try {
              uploadResponse = JSON.parse(rawText);
            } catch (e) {
              console.error("Gagal parse response JSON", e);
              throw new Error("Respons server tidak valid (bukan JSON).");
            }

            if (uploadResponse?.status && uploadResponse?.file_id) {
              const linkRes = await ApiService.authenticatedRequest('/pack/video', {
                method: 'POST',
                body: JSON.stringify({
                  resi: resiToUpload,
                  video_file_id: uploadResponse.file_id,
                  video_web_view_link: uploadResponse.web_view_link
                }),
              });
              
              if (linkRes?.status) {
                console.log(`Video untuk resi ${resiToUpload} berhasil diunggah.`);
                Alert.alert('Sukses', `Video packing resi ${resiToUpload} berhasil diunggah ke Google Drive.`);
              } else {
                console.warn(`Video upload sukses, tapi gagal melink: ${linkRes?.reason}`);
                Alert.alert('Upload GDrive Sukses, tapi Gagal Disimpan', `Video masuk GDrive tapi gagal disambungkan ke database: ${linkRes?.reason || 'Unknown error'}`);
              }
            } else {
              throw new Error(uploadResponse?.reason || 'Gagal upload. Response: ' + rawText.substring(0, 50));
            }
          } catch (error: any) {
            console.error('Error uploading video:', error);
            Alert.alert('Error Upload Video', `Gagal mengunggah video untuk resi ${resiToUpload}: ${error.message}`);
          } finally {
            setIsVideoUploading(false);
          }
        },
        onRecordingError: (error) => {
          console.error('Recording Error:', error);
        },
      });
    } catch (e) {
      console.error("Error starting recording", e);
    }
  };

  const stopAndUploadVideo = async (resi: string) => {
    if (!isRecordingRef.current) {
       console.log('stopAndUploadVideo aborted: isRecording is false');
       return;
    }
    console.log(`Stopping video recording for resi: ${resi}`);
    pendingVideoResiRef.current = resi;
    cameraRef.current?.stopRecording();
    setIsRecording(false);
  };

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
    const micStatus = await Camera.getMicrophonePermissionStatus();
    setHasPermission(status === 'granted' && micStatus === 'granted');
  };

  const requestPermission = async () => {
    const status = await Camera.requestCameraPermission();
    const micStatus = await Camera.requestMicrophonePermission();
    if (status === 'denied' || micStatus === 'denied') {
      await Linking.openSettings();
    }
    setHasPermission(status === 'granted' && micStatus === 'granted');
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

    if (workflowModeRef.current === 'BUTTON_TO_SCAN' && recordingStatusRef.current === 'IDLE' && gdriveConnectedRef.current) {
      Alert.alert('Perhatian', 'Mode 1 aktif: Harap klik "Mulai Rekam" terlebih dahulu sebelum men-scan resi.');
      return;
    }

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

        if (!enableVideoRecordRef.current) return;

        if (workflowModeRef.current === 'SCAN_TO_BUTTON') {
          if (recordingStatusRef.current === 'IDLE' && gdriveConnectedRef.current) {
             setRecordingStatus('RECORDING_VIA_SCAN');
             startVideoRecording(data);
          }
        } else if (workflowModeRef.current === 'BUTTON_TO_SCAN') {
          if (recordingStatusRef.current === 'RECORDING_VIA_BUTTON') {
             stopAndUploadVideo(data);
             setRecordingStatus('IDLE');
          }
        }
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

  const renderScanRoute = () => (
      !hasPermission ? (
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
          {gdriveConnected ? (
            <View style={[styles.recordToggle, { padding: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: enableVideoRecord ? 8 : 0, borderBottomWidth: enableVideoRecord ? 1 : 0, borderBottomColor: '#f3f4f6', marginBottom: enableVideoRecord ? 8 : 0 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recordToggleText, { fontSize: 13, marginBottom: 2 }]}>Aktifkan Rekaman Video</Text>
                </View>
                <Switch
                  value={enableVideoRecord}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }], height: 24 }}
                  onValueChange={(val) => {
                    setEnableVideoRecord(val);
                    if (!val && isRecording) {
                       cameraRef.current?.stopRecording();
                       setIsRecording(false);
                       setRecordingStatus('IDLE');
                    }
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#f59e0b' }}
                  thumbColor={enableVideoRecord ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              {enableVideoRecord && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <View style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, backgroundColor: 'white', justifyContent: 'center', marginRight: 8 }}>
                    <Picker
                      selectedValue={workflowMode}
                      onValueChange={(itemValue) => {
                        setWorkflowMode(itemValue);
                        Speech.stop();
                        if (itemValue === 'BUTTON_TO_SCAN') {
                          Speech.speak('Klik tombol rekam untuk mulai merekam', { language: 'id-ID' });
                        } else if (itemValue === 'SCAN_TO_BUTTON') {
                          Speech.speak('Scan Resi untuk mulai merekam', { language: 'id-ID' });
                        }
                      }}
                      enabled={recordingStatus === 'IDLE'}
                    >
                      <Picker.Item label="Mode 1: Mulai->Scan" value="BUTTON_TO_SCAN" style={{fontSize: 13}} />
                      <Picker.Item label="Mode 2: Scan->Selesai" value="SCAN_TO_BUTTON" style={{fontSize: 13}} />
                    </Picker>
                  </View>

                  <View>
                    {workflowMode === 'BUTTON_TO_SCAN' ? (
                      <TouchableOpacity 
                        style={[
                          styles.actionButton, 
                          { 
                            paddingVertical: 10, paddingHorizontal: 12, minWidth: 110, borderRadius: 6,
                            backgroundColor: recordingStatus === 'RECORDING_VIA_BUTTON' ? '#EF4444' : '#3B82F6'
                          }
                        ]}
                        onPress={async () => {
                           if (recordingStatus === 'RECORDING_VIA_BUTTON') {
                               pendingVideoResiRef.current = null;
                               cameraRef.current?.stopRecording();
                               setIsRecording(false);
                               setRecordingStatus('IDLE');
                           } else if (recordingStatus === 'IDLE') {
                               setRecordingStatus('RECORDING_VIA_BUTTON');
                               pendingVideoResiRef.current = null;
                               await startVideoRecording();
                           }
                        }}
                      >
                        <Ionicons name={recordingStatus === 'RECORDING_VIA_BUTTON' ? "stop-circle" : "videocam"} size={18} color="white" />
                        <Text style={[styles.actionBtnText, { fontSize: 13, marginLeft: 6 }]}>
                          {recordingStatus === 'RECORDING_VIA_BUTTON' ? 'Batal' : 'Mulai'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={[
                          styles.actionButton, 
                          { 
                            paddingVertical: 10, paddingHorizontal: 12, minWidth: 110, borderRadius: 6,
                            backgroundColor: recordingStatus === 'RECORDING_VIA_SCAN' ? '#10B981' : '#D1D5DB'
                          }
                        ]}
                        disabled={recordingStatus !== 'RECORDING_VIA_SCAN'}
                        onPress={() => {
                           if (recordingStatus === 'RECORDING_VIA_SCAN' && pendingVideoResiRef.current) {
                               stopAndUploadVideo(pendingVideoResiRef.current);
                           } else if (recordingStatus === 'RECORDING_VIA_BUTTON') {
                               pendingVideoResiRef.current = null;
                               cameraRef.current?.stopRecording();
                               setIsRecording(false);
                           }
                           setRecordingStatus('IDLE');
                        }}
                      >
                        <Ionicons name={recordingStatus === 'RECORDING_VIA_SCAN' ? "checkmark-circle" : "close-circle"} size={18} color="white" />
                        <Text style={[styles.actionBtnText, { fontSize: 13, marginLeft: 6 }]}>
                          {recordingStatus === 'RECORDING_VIA_SCAN' ? 'Selesai' : 'Batal'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.recordToggle}>
              <Text style={styles.recordToggleText}>G-Drive Tidak Terhubung</Text>
            </View>
          )}

          {/* Camera View */}
          <View style={styles.cameraContainer}>
            {device == null ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>Loading camera...</Text>
              </View>
            ) : (!isFocused || index !== 0 || orderDetailsModalVisible) ? (
              <View style={[styles.loadingContainer, { backgroundColor: '#000' }]}>
                 <Ionicons name="videocam-off" size={48} color="#4B5563" />
                 <Text style={styles.loadingText}>Kamera dinonaktifkan sementara</Text>
              </View>
            ) : (
              <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={isCameraActive && isFocused && index === 0}
                codeScanner={codeScanner}
                video={true}
                audio={true}
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
              <View style={[styles.statusDot, { backgroundColor: isVideoUploading ? '#3B82F6' : (processing ? '#F59E0B' : (scanning ? '#10B981' : '#EF4444')) }]} />
              <Text style={styles.statusText}>
                {isVideoUploading ? 'Mengunggah video ke GDrive...' : (processing ? 'Menyimpan ke database...' : (scanning ? 'Siap scan resi' : 'Kamera dijeda'))}
              </Text>
            </View>
            {(processing || isVideoUploading) && <ActivityIndicator size="small" color={isVideoUploading ? "#3B82F6" : "#F59E0B"} style={{ marginLeft: 8 }} />}
            {!processing && !scanning && !isVideoUploading && (
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
      )
  );

  const renderPreviewRoute = () => {
    const filteredData = previewData.filter(item => 
      (item.resi || '').toLowerCase().includes(previewSearchQuery.toLowerCase()) || 
      (item.buyer_username || '').toLowerCase().includes(previewSearchQuery.toLowerCase())
    );
    
    return (
      <View style={styles.container}>
        <View style={{ padding: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10 }}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 16 }}
              placeholder="Cari Resi atau Pembeli..."
              value={previewSearchQuery}
              onChangeText={setPreviewSearchQuery}
            />
            {previewSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setPreviewSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <FlatList
          data={filteredData}
          keyExtractor={(item, idx) => `preview-${item.id}-${idx}`}
          refreshControl={
            <RefreshControl refreshing={previewLoading} onRefresh={fetchPreviewData} colors={['#f59e0b']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
               <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
               <Text style={styles.emptyText}>{previewLoading ? 'Memuat data...' : 'Tidak ada data'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.previewCard}
              onPress={() => viewOrderDetails(item.resi, item.order_id)}
              activeOpacity={0.7}
            >
               <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                 <Text style={styles.previewResi}>{item.resi}</Text>
                 <Text style={styles.previewStatus}>{item.status}</Text>
               </View>
               <Text style={styles.previewShop}>{item.shop_name} - {item.platform}</Text>
               <Text style={styles.previewDate}>{new Date(item.time_pack).toLocaleString('id-ID')}</Text>
               <Text style={styles.previewBuyer}>{item.buyer_username}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  };

  const renderScene = ({ route }: { route: any }) => {
    switch (route.key) {
      case 'scan':
        return renderScanRoute();
      case 'preview':
        return renderPreviewRoute();
      default:
        return null;
    }
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        </View>
      </View>

      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={props => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: '#f59e0b' }}
            style={{ backgroundColor: 'white' }}
            activeColor="#f59e0b"
            inactiveColor="#6B7280"
          />
        )}
      />

      {/* Order Details Modal */}
      <Modal
        visible={orderDetailsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOrderDetailsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detail Pesanan</Text>
            <TouchableOpacity onPress={() => setOrderDetailsModalVisible(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          
          {orderDetailsLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={{ marginTop: 12 }}>Memuat detail...</Text>
            </View>
          ) : orderDetails ? (
            <ScrollView style={styles.modalContent}>
              {orderDetails.video_web_view_link && (
                <View style={styles.videoContainer}>
                  <Text style={styles.sectionTitle}>Preview Rekaman Packing</Text>
                  <View style={styles.webviewWrapper}>
                    <WebView 
                      source={{ uri: orderDetails.video_web_view_link.replace('/view', '/preview') }}
                      style={{ flex: 1, backgroundColor: 'black' }}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      allowsInlineMediaPlayback={true}
                      mediaPlaybackRequiresUserAction={false}
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.openBrowserButton}
                    onPress={() => Linking.openURL(orderDetails.video_web_view_link)}
                  >
                    <Ionicons name="open-outline" size={16} color="white" />
                    <Text style={styles.openBrowserText}>Buka di Browser / GDrive</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Order ID</Text>
                <Text style={styles.detailValue}>{orderDetails.id_order}</Text>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, { color: orderDetails.status === 'COMPLETED' ? '#10B981' : '#3B82F6' }]}>
                  {orderDetails.status}
                </Text>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Toko</Text>
                <Text style={styles.detailValue}>{orderDetails.shop_name} ({orderDetails.platform})</Text>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Resi</Text>
                <Text style={styles.detailValue}>{orderDetails.no_resi}</Text>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Pembeli</Text>
                <Text style={styles.detailValue}>{orderDetails.buyer_username || '-'} - {orderDetails.buyer_city || '-'}</Text>
              </View>

              <View style={styles.itemsContainer}>
                <Text style={styles.sectionTitle}>Daftar Barang</Text>
                {orderDetails.items?.map((item: any, idx: number) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.nama}</Text>
                    <Text style={styles.itemQty}>{item.qty}x</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.modalLoading}>
              <Text>Gagal memuat detail pesanan.</Text>
            </View>
          )}
        </View>
      </Modal>

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
    fontWeight: 'bold',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionBtnText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  controlsContainer: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  recordToggle: {
    padding: 12,
    backgroundColor: '#fee2e2',
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
    alignItems: 'center',
  },
  recordToggleText: {
    color: '#991b1b',
    fontWeight: 'bold',
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
  previewCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  previewResi: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  previewStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  previewShop: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  previewDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  previewBuyer: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  videoContainer: {
    marginBottom: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  webviewWrapper: {
    height: 300,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'black',
    marginBottom: 12,
  },
  openBrowserButton: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openBrowserText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  detailCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  itemsContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginRight: 12,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  controlsContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
    height: 50,
  },
  picker: {
    height: 50,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1d5db',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#3B82F6',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
