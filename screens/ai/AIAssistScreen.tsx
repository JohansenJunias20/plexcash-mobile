import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import ChatbotService, {
  ChatSession,
  ChatMessage,
  JobStep,
} from '../../services/chatbotService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AttachedFileItem {
  data: string; // base64
  mimeType: string;
  previewUrl: string;
  name: string;
  fileType: 'image' | 'pdf' | 'excel' | 'csv';
  size?: number;
}

interface QueuedMessageItem {
  id: string;
  text: string;
  files: AttachedFileItem[];
}

interface ParsedFile {
  name: string;
  mimeType: string;
  fileType: 'image' | 'pdf' | 'excel' | 'csv';
  url: string;
}

const getFileType = (mimeType: string, fileName: string): 'image' | 'pdf' | 'excel' | 'csv' => {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')
  )
    return 'excel';
  if (mime === 'text/csv' || name.endsWith('.csv')) return 'csv';
  return 'image';
};

const QUICK_PROMPTS = [
  '📷 Input nota pembelian (bisa banyak foto)',
  '⚖️ Rekonsiliasi mutasi rekening bank (PDF/Excel)',
  '📊 Cek mutasi rekening BCA bulan ini',
  'Cek stok barang di toko',
  'Buat barang baru (stok 0)',
  'Buat penjualan kasir baru',
  'Lihat daftar supplier',
];

const WELCOME_CONTENT = `Halo! Saya **AI Assist** 🤖

Saya siap membantu Anda:
- ⚖️ **Rekonsiliasi mutasi rekening bank** otomatis dari berkas **PDF / Excel (.xlsx) / CSV**
- 📷 Mencatat **pembelian supplier** dari foto nota (bisa banyak foto sekaligus)
- 🔍 Mencari produk & cek stok gudang / toko
- 🛒 Membuat transaksi kasir POS offline
- 🏢 Mengelola data supplier, rak barang, dan DP beli

Ada yang bisa saya bantu hari ini?`;

export default function AIAssistScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();

  // Chat states
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [messageQueue, setMessageQueue] = useState<QueuedMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [activeJobSteps, setActiveJobSteps] = useState<JobStep[]>([]);

  // Modals
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const messageQueueRef = useRef<QueuedMessageItem[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    messageQueueRef.current = messageQueue;
  }, [messageQueue]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    loadSessions();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, messageQueue, attachedFiles]);

  // Load chat sessions (7-day TTL)
  const loadSessions = async () => {
    try {
      const res = await ChatbotService.getSessions();
      if (res.status && Array.isArray(res.data)) {
        setSessions(res.data);
        if (res.data.length > 0 && !currentSessionIdRef.current) {
          selectSession(res.data[0].id);
        } else if (res.data.length === 0) {
          startNewChat();
        }
      } else {
        startNewChat();
      }
    } catch (err) {
      console.error('Gagal memuat sesi chat:', err);
      startNewChat();
    }
  };

  // Load messages of selected session
  const selectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    currentSessionIdRef.current = sessionId;
    setShowSessionsModal(false);
    try {
      const res = await ChatbotService.getSessionMessages(sessionId);
      if (res.status && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat pesan sesi:', err);
    }
  };

  // Start fresh chat session
  const startNewChat = () => {
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    setMessageQueue([]);
    messageQueueRef.current = [];
    setMessages([
      {
        role: 'model',
        content: WELCOME_CONTENT,
      },
    ]);
    setShowSessionsModal(false);
  };

  // Delete a session
  const handleDeleteSession = (sessionId: string) => {
    Alert.alert('Hapus Sesi', 'Apakah Anda yakin ingin menghapus sesi percakapan ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await ChatbotService.deleteSession(sessionId);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            if (currentSessionId === sessionId) {
              startNewChat();
            }
          } catch (err) {
            console.error('Gagal menghapus sesi:', err);
          }
        },
      },
    ]);
  };

  // Pick images from gallery (supports multiple selection)
  const pickImagesFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Izin Ditolak', 'Izin akses galeri dibutuhkan untuk melampirkan foto nota.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles: AttachedFileItem[] = result.assets
          .filter((a) => a.base64)
          .map((a, idx) => ({
            data: a.base64 || '',
            mimeType: a.mimeType || 'image/jpeg',
            previewUrl: a.uri,
            name: a.fileName || `nota_${Date.now()}_${idx}.jpg`,
            fileType: 'image',
          }));

        setAttachedFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error('Gagal memilih gambar dari galeri:', err);
      Alert.alert('Error', 'Gagal memuat gambar dari galeri.');
    }
  };

  // Take photo from camera
  const takePhotoWithCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Izin Ditolak', 'Izin kamera dibutuhkan untuk memotret nota pembelian.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const newFile: AttachedFileItem = {
            data: asset.base64,
            mimeType: asset.mimeType || 'image/jpeg',
            previewUrl: asset.uri,
            name: asset.fileName || `nota_cam_${Date.now()}.jpg`,
            fileType: 'image',
          };
          setAttachedFiles((prev) => [...prev, newFile]);
        }
      }
    } catch (err) {
      console.error('Gagal memotret gambar:', err);
      Alert.alert('Error', 'Gagal membuka kamera.');
    }
  };

  // Pick Document files (PDF, Excel, CSV)
  const pickDocumentFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/comma-separated-values',
          '*/*',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const addedItems: AttachedFileItem[] = [];

        for (const asset of result.assets) {
          const name = asset.name || 'document';
          const mime = asset.mimeType || '';
          const fType = getFileType(mime, name);

          let base64 = '';
          try {
            base64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
            });
          } catch (readErr) {
            console.warn('Failed to read file as base64 via FileSystem:', readErr);
          }

          if (base64) {
            let normalizedMime = mime;
            if (!normalizedMime) {
              if (fType === 'pdf') normalizedMime = 'application/pdf';
              else if (fType === 'excel') normalizedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              else if (fType === 'csv') normalizedMime = 'text/csv';
              else normalizedMime = 'application/octet-stream';
            }

            addedItems.push({
              data: base64,
              mimeType: normalizedMime,
              previewUrl: asset.uri,
              name,
              fileType: fType,
              size: asset.size,
            });
          }
        }

        if (addedItems.length > 0) {
          setAttachedFiles((prev) => [...prev, ...addedItems]);
        }
      }
    } catch (err) {
      console.error('Gagal memilih dokumen:', err);
      Alert.alert('Error', 'Gagal membuka pemilih berkas dokumen.');
    }
  };

  const handleOpenAttachmentMenu = () => {
    Alert.alert(
      'Lampirkan Berkas / Foto',
      'Pilih jenis berkas yang ingin Anda kirim ke AI Assist:',
      [
        { text: '📷 Ambil Foto Nota (Kamera)', onPress: takePhotoWithCamera },
        { text: '🖼️ Pilih Foto dari Galeri (Bisa Banyak)', onPress: pickImagesFromGallery },
        { text: '📄 Lampirkan Dokumen (PDF / Excel / CSV)', onPress: pickDocumentFiles },
        { text: 'Batal', style: 'cancel' },
      ]
    );
  };

  // Open or share document files (PDF, Excel, CSV)
  const openDocument = async (file: ParsedFile | AttachedFileItem) => {
    try {
      let filePath = (file as any).previewUrl || (file as any).url || '';
      if (!filePath) return;

      if (filePath.startsWith('data:')) {
        const base64Data = filePath.split(',')[1] || filePath;
        const ext =
          file.fileType === 'pdf'
            ? '.pdf'
            : file.fileType === 'excel'
            ? '.xlsx'
            : file.fileType === 'csv'
            ? '.csv'
            : '';
        const cleanName = file.name
          ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          : `berkas_${Date.now()}${ext}`;
        const targetUri = `${(FileSystem as any).cacheDirectory || ''}${cleanName}`;
        await FileSystem.writeAsStringAsync(targetUri, base64Data, {
          encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
        });
        filePath = targetUri;
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Tidak Didukung', 'Fitur berbagi berkas tidak tersedia di perangkat ini.');
        return;
      }

      await Sharing.shareAsync(filePath, {
        mimeType: file.mimeType || 'application/octet-stream',
        dialogTitle: file.name || 'Dokumen',
      });
    } catch (err: any) {
      if (err && err.message && !err.message.includes('cancel')) {
        console.warn('Gagal membuka berkas:', err);
      }
    }
  };

  // Helper to parse stored image/file data
  const parseMessageFiles = (imageData?: string | null): ParsedFile[] => {
    if (!imageData) return [];
    if (imageData.startsWith('[')) {
      try {
        const arr = JSON.parse(imageData);
        if (Array.isArray(arr)) {
          return arr
            .map((item, idx) => {
              if (typeof item === 'string') {
                const ft = item.includes('application/pdf')
                  ? 'pdf'
                  : item.includes('csv')
                  ? 'csv'
                  : item.includes('spreadsheet') || item.includes('excel')
                  ? 'excel'
                  : 'image';
                return {
                  name:
                    ft === 'pdf'
                      ? `Dokumen_${idx + 1}.pdf`
                      : ft === 'excel'
                      ? `Data_${idx + 1}.xlsx`
                      : ft === 'csv'
                      ? `Data_${idx + 1}.csv`
                      : `Foto_${idx + 1}`,
                  mimeType:
                    ft === 'pdf'
                      ? 'application/pdf'
                      : ft === 'excel'
                      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      : 'image/jpeg',
                  fileType: ft,
                  url: item.startsWith('data:') ? item : `data:image/jpeg;base64,${item}`,
                };
              } else if (item && typeof item === 'object') {
                const mime = item.mimeType || 'image/jpeg';
                const name = item.name || 'Berkas';
                return {
                  name,
                  mimeType: mime,
                  fileType: getFileType(mime, name),
                  url: item.data || item.url || '',
                };
              }
              return null;
            })
            .filter(Boolean) as ParsedFile[];
        }
      } catch {}
    }
    if (imageData.startsWith('{')) {
      try {
        const obj = JSON.parse(imageData);
        if (obj && typeof obj === 'object') {
          const mime = obj.mimeType || 'image/jpeg';
          const name = obj.name || 'Berkas';
          return [
            {
              name,
              mimeType: mime,
              fileType: getFileType(mime, name),
              url: obj.data || obj.url || '',
            },
          ];
        }
      } catch {}
    }
    const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ft = getFileType(mime, '');
    return [
      {
        name:
          ft === 'pdf'
            ? 'Dokumen.pdf'
            : ft === 'excel'
            ? 'Data.xlsx'
            : ft === 'csv'
            ? 'Data.csv'
            : 'Foto Nota',
        mimeType: mime,
        fileType: ft,
        url:
          imageData.startsWith('data:') || imageData.startsWith('http') || imageData.startsWith('file://')
            ? imageData
            : `data:image/jpeg;base64,${imageData}`,
      },
    ];
  };

  // Send message or queue it if agent is currently busy
  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : inputPrompt;
    const filesToSend = [...attachedFiles];

    if (!text.trim() && filesToSend.length === 0) return;

    if (loading) {
      const queuedItem: QueuedMessageItem = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        text: text.trim(),
        files: filesToSend,
      };

      const queuedUserMsg: ChatMessage = {
        role: 'user',
        content:
          text.trim() ||
          (filesToSend.length === 1
            ? `(Lampiran ${filesToSend[0].name})`
            : `(${filesToSend.length} Berkas Terlampir)`),
        image_data: JSON.stringify(
          filesToSend.map((f) => ({
            name: f.name,
            mimeType: f.mimeType,
            data: f.previewUrl,
          }))
        ),
        created_at: new Date().toISOString(),
        isQueued: true,
      };

      setMessages((prev) => [...prev, queuedUserMsg]);
      setMessageQueue((prev) => [...prev, queuedItem]);
      messageQueueRef.current = [...messageQueueRef.current, queuedItem];

      setInputPrompt('');
      setAttachedFiles([]);
      return;
    }

    executeSendMessage(text.trim(), filesToSend);
  };

  // Execute sending a message and polling the job
  const executeSendMessage = async (text: string, files: AttachedFileItem[]) => {
    const msgText =
      text ||
      (files.length === 1
        ? files[0].fileType === 'image'
          ? 'Tolong inputkan nota pembelian ini ke sistem.'
          : 'Tolong periksa dan analisis berkas ini.'
        : `Tolong proses ${files.length} berkas yang saya lampirkan.`);

    setMessages((prev) => {
      const queuedIdx = prev.findIndex((m) => m.isQueued && m.role === 'user');
      if (queuedIdx !== -1) {
        return prev.map((m, idx) => (idx === queuedIdx ? { ...m, isQueued: false } : m));
      } else {
        return [
          ...prev,
          {
            role: 'user',
            content: msgText,
            image_data:
              files.length > 0
                ? JSON.stringify(
                    files.map((f) => ({
                      name: f.name,
                      mimeType: f.mimeType,
                      data: f.previewUrl,
                    }))
                  )
                : null,
            created_at: new Date().toISOString(),
          },
        ];
      }
    });

    setInputPrompt('');
    setAttachedFiles([]);
    setLoading(true);
    setCurrentStepText('Menghubungkan ke AI Assist...');
    setActiveJobSteps([]);

    try {
      const data = await ChatbotService.sendMessage({
        sessionId: currentSessionIdRef.current,
        message: msgText,
        files:
          files.length > 0
            ? files.map((f) => ({
                data: f.data,
                mimeType: f.mimeType,
                fileName: f.name,
                fileType: f.fileType,
              }))
            : undefined,
        images: files
          .filter((f) => f.fileType === 'image')
          .map((img) => ({
            data: img.data,
            mimeType: img.mimeType,
          })),
      });

      if (data.status && data.jobId) {
        if (data.sessionId) {
          setCurrentSessionId(data.sessionId);
          currentSessionIdRef.current = data.sessionId;
        }

        const jobId = data.jobId;
        let isDone = false;
        let pollAttempts = 0;
        const maxPolls = 400; // ~5 minutes max
        let consecutiveErrors = 0;

        while (!isDone && pollAttempts < maxPolls) {
          pollAttempts++;
          await new Promise((resolve) => setTimeout(resolve, 800));

          try {
            const pollData = await ChatbotService.pollJobStatus(jobId);

            if (pollData.status) {
              consecutiveErrors = 0;

              if (pollData.currentStepText) {
                setCurrentStepText(pollData.currentStepText);
              }
              if (Array.isArray(pollData.steps)) {
                setActiveJobSteps(pollData.steps);
              }

              if (pollData.state === 'completed') {
                isDone = true;
                const botMsg: ChatMessage = {
                  role: 'model',
                  content: pollData.reply || 'Selesai.',
                  tool_calls: pollData.toolExecutions?.map((t: any) => ({
                    tool: t.toolName,
                    args: t.args,
                  })),
                  tool_responses: pollData.toolExecutions?.map((t: any) => t.result),
                  created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, botMsg]);
                loadSessions();
                break;
              } else if (pollData.state === 'failed') {
                isDone = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'model',
                    content: `⚠️ Maaf, terjadi kesalahan: ${pollData.error || 'Gagal memproses permintaan.'}`,
                  },
                ]);
                break;
              }
            } else {
              consecutiveErrors++;
              if (consecutiveErrors >= 5) {
                isDone = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'model',
                    content: `⚠️ Sesi pemrosesan terputus: ${pollData.reason || 'Server tidak merespons.'}`,
                  },
                ]);
                break;
              }
            }
          } catch (pollErr) {
            consecutiveErrors++;
            if (consecutiveErrors >= 6) {
              isDone = true;
              setMessages((prev) => [
                ...prev,
                {
                  role: 'model',
                  content: '⚠️ Terputus dari server saat menunggu respons AI Assist. Silakan periksa koneksi internet Anda.',
                },
              ]);
              break;
            }
          }
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            content: `⚠️ Maaf, gagal mengirim pesan: ${data.reason || 'Terjadi kesalahan sistem.'}`,
          },
        ]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: `⚠️ Kendala koneksi ke server: ${err?.message || String(err)}`,
        },
      ]);
    } finally {
      if (messageQueueRef.current.length > 0) {
        const nextItem = messageQueueRef.current[0];
        const remaining = messageQueueRef.current.slice(1);
        setMessageQueue(remaining);
        messageQueueRef.current = remaining;

        executeSendMessage(nextItem.text, nextItem.files);
      } else {
        setLoading(false);
        setCurrentStepText('');
        setActiveJobSteps([]);
      }
    }
  };

  // Enhanced markdown text renderer for bold, lists, and tables
  const renderFormattedContent = (content: string) => {
    if (!content) return null;

    const rawLines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Table detection
      if (trimmed.startsWith('|')) {
        const tableLines: string[] = [];
        while (i < rawLines.length) {
          const cur = rawLines[i].trim();
          if (cur.startsWith('|')) {
            tableLines.push(cur);
            i++;
          } else if (!cur && i + 1 < rawLines.length && rawLines[i + 1].trim().startsWith('|')) {
            i++;
          } else {
            break;
          }
        }

        if (tableLines.length >= 2) {
          const parseCells = (rowStr: string) => {
            const trimmedRow = rowStr.replace(/^\|/, '').replace(/\|$/, '');
            return trimmedRow.split('|').map((c) => c.trim());
          };

          const headerCells = parseCells(tableLines[0]);
          let dataStartIndex = 1;
          if (tableLines.length > 1 && /^[\s\|\:\-]+$/.test(tableLines[1])) {
            dataStartIndex = 2;
          }

          const rows = tableLines.slice(dataStartIndex).map(parseCells);

          elements.push(
            <ScrollView horizontal key={`table-${i}`} style={styles.tableWrapper} showsHorizontalScrollIndicator={true}>
              <View style={styles.tableContainer}>
                <View style={styles.tableHeaderRow}>
                  {headerCells.map((h, hIdx) => {
                    const hLower = h.toLowerCase();
                    const isCenter = hIdx === 0 || hLower.includes('qty') || hLower === 'no';
                    const isRight =
                      hLower.includes('harga') ||
                      hLower.includes('subtotal') ||
                      hLower.includes('total') ||
                      hLower.includes('nominal');
                    return (
                      <View
                        key={hIdx}
                        style={[
                          styles.tableCell,
                          styles.tableHeaderCell,
                          isCenter ? styles.tableCellCenter : isRight ? styles.tableCellRight : null,
                          hIdx === 1 || hIdx === 2 ? { minWidth: 130 } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tableHeaderText,
                            isCenter && { textAlign: 'center' },
                            isRight && { textAlign: 'right' },
                          ]}
                        >
                          {h}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {rows.map((row, rIdx) => (
                  <View
                    key={rIdx}
                    style={[styles.tableRow, rIdx % 2 === 1 ? styles.tableRowAlt : null]}
                  >
                    {row.map((cell, cIdx) => {
                      const cLower = cell.toLowerCase();
                      const isCocok =
                        cLower.includes('cocok') ||
                        cLower.includes('sudah ada') ||
                        cell.includes('Terdaftar');
                      const isBelumAda = cLower.includes('belum');
                      const isFirst = cIdx === 0;
                      const isQtyCol = cIdx === 3;
                      const isPriceCol = cIdx === 4 || cIdx === 5 || cIdx === 6;

                      return (
                        <View
                          key={cIdx}
                          style={[
                            styles.tableCell,
                            (isFirst || isQtyCol)
                              ? styles.tableCellCenter
                              : isPriceCol
                              ? styles.tableCellRight
                              : null,
                            cIdx === 1 || cIdx === 2 ? { minWidth: 130 } : null,
                          ]}
                        >
                          {isCocok ? (
                            <View style={styles.pillGreen}>
                              <Text style={styles.pillGreenText}>{cell}</Text>
                            </View>
                          ) : isBelumAda ? (
                            <View style={styles.pillAmber}>
                              <Text style={styles.pillAmberText}>{cell}</Text>
                            </View>
                          ) : (
                            <Text
                              style={[
                                styles.tableCellText,
                                isFirst && styles.tableCellTextFirst,
                                isQtyCol && styles.tableCellTextQty,
                                isPriceCol && styles.tableCellTextPrice,
                              ]}
                            >
                              {renderInlineText(cell)}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
          continue;
        }
      }

      // Horizontal Divider
      if (trimmed === '---' || trimmed === '***') {
        elements.push(<View key={i} style={styles.horizontalDivider} />);
        i++;
        continue;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        const headingText = trimmed.replace(/^###\s+/, '');
        elements.push(
          <View key={i} style={styles.heading3Row}>
            <View style={styles.headingAccent} />
            <Text style={styles.heading3Text}>{renderInlineText(headingText)}</Text>
          </View>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <Text key={i} style={styles.heading2}>
            {renderInlineText(trimmed.replace(/^##\s+/, ''))}
          </Text>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <Text key={i} style={styles.heading1}>
            {renderInlineText(trimmed.replace(/^#\s+/, ''))}
          </Text>
        );
        i++;
        continue;
      }

      // List Items (- or * or 1.)
      const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
      const isNumbered = /^\d+\.\s/.test(trimmed);

      if (isBullet || isNumbered) {
        const bulletSymbol = isBullet ? '•' : trimmed.match(/^\d+\./)?.[0] || '•';
        const itemText = isBullet
          ? trimmed.replace(/^[\-\*]\s+/, '')
          : trimmed.replace(/^\d+\.\s+/, '');

        elements.push(
          <View key={i} style={styles.listItemRow}>
            <Text style={styles.listBullet}>{bulletSymbol}</Text>
            <Text style={styles.listItemText}>{renderInlineText(itemText)}</Text>
          </View>
        );
        i++;
        continue;
      }

      // Regular Paragraph
      if (trimmed) {
        elements.push(
          <Text key={i} style={styles.paragraph}>
            {renderInlineText(line)}
          </Text>
        );
      } else {
        elements.push(<View key={i} style={{ height: 6 }} />);
      }
      i++;
    }

    return elements;
  };

  // Helper for inline **bold** text
  const renderInlineText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={idx} style={styles.boldText}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return <Text key={idx}>{part}</Text>;
    });
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
      {/* Header Bar */}
      <LinearGradient
        colors={['#0284c7', '#2563eb', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topNavbar}
      >
        <View style={styles.navbarLeft}>
          <TouchableOpacity
            style={styles.navIconButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.dispatch(DrawerActions.openDrawer());
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.navTitleText}>🤖 AI Assist</Text>
              <View style={styles.betaPill}>
                <Text style={styles.betaText}>BETA</Text>
              </View>
              <View style={styles.onlinePill}>
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>
            <Text style={styles.navSubtitleText} numberOfLines={1}>
              Gemini 2.5 Flash • Mutasi Bank & Kasir ERP
            </Text>
          </View>
        </View>

        <View style={styles.navbarRight}>
          <TouchableOpacity
            style={styles.navActionIcon}
            onPress={() => setShowSessionsModal(true)}
            accessibilityLabel="Riwayat Chat"
          >
            <Ionicons name="time-outline" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navNewChatBtn}
            onPress={startNewChat}
            accessibilityLabel="Chat Baru"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.navNewChatText}>Baru</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main Chat Area */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const parsedFiles = parseMessageFiles(msg.image_data);
            const showConfirmationActions =
              !isUser &&
              !loading &&
              (msg.content.toLowerCase().includes('buatkan barang baru') ||
                msg.content.toLowerCase().includes('lanjutkan pembelian') ||
                msg.content.toLowerCase().includes('konfirmasi') ||
                msg.content.toLowerCase().includes('mengonfirmasi'));

            return (
              <View
                key={index}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowModel,
                ]}
              >
                {/* Avatar */}
                <View
                  style={[
                    styles.avatarCircle,
                    isUser ? styles.avatarUser : styles.avatarModel,
                  ]}
                >
                  <Ionicons
                    name={isUser ? 'person' : 'hardware-chip-outline'}
                    size={16}
                    color="#fff"
                  />
                </View>

                {/* Message Bubble Container */}
                <View
                  style={[
                    styles.bubbleContainer,
                    isUser ? styles.bubbleContainerUser : styles.bubbleContainerModel,
                  ]}
                >
                  {/* Tool Call Badges */}
                  {!isUser && msg.tool_calls && msg.tool_calls.length > 0 && (
                    <View style={styles.toolCallsWrapper}>
                      {msg.tool_calls.map((tc: any, tIdx: number) => (
                        <View key={tIdx} style={styles.toolCallBadge}>
                          <Ionicons name="construct-outline" size={13} color="#4338ca" />
                          <Text style={styles.toolCallText}>
                            Eksekusi tool: <Text style={styles.toolCallName}>{tc.tool}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Main Bubble */}
                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.bubbleUser : styles.bubbleModel,
                    ]}
                  >
                    {/* Attached Files (Images, PDF, Excel, CSV) */}
                    {parsedFiles.length > 0 && (
                      <View style={styles.messageFilesContainer}>
                        {parsedFiles.map((file, fIdx) => {
                          if (file.fileType === 'image') {
                            return (
                              <TouchableOpacity
                                key={fIdx}
                                activeOpacity={0.85}
                                onPress={() => setPreviewImageUrl(file.url)}
                                style={styles.imageFileCard}
                              >
                                <Image
                                  source={{ uri: file.url }}
                                  style={styles.imageFileThumbnail}
                                  resizeMode="cover"
                                />
                                <View style={styles.imageFileBadge}>
                                  <Text style={styles.imageFileBadgeText}>
                                    {fIdx + 1}/{parsedFiles.length}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          } else if (file.fileType === 'pdf') {
                            return (
                              <TouchableOpacity
                                key={fIdx}
                                activeOpacity={0.8}
                                onPress={() => openDocument(file)}
                                style={[
                                  styles.docFileCard,
                                  isUser ? styles.docFileCardUser : styles.docFileCardPdf,
                                ]}
                              >
                                <Ionicons
                                  name="document-text"
                                  size={22}
                                  color={isUser ? '#fca5a5' : '#dc2626'}
                                />
                                <View style={styles.docFileTextCol}>
                                  <Text
                                    style={[
                                      styles.docFileName,
                                      isUser ? styles.docFileNameUser : styles.docFileNamePdf,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {file.name}
                                  </Text>
                                  <Text style={styles.docFileMeta}>Dokumen PDF • Buka</Text>
                                </View>
                                <Ionicons
                                  name="open-outline"
                                  size={16}
                                  color={isUser ? 'rgba(255,255,255,0.7)' : '#dc2626'}
                                />
                              </TouchableOpacity>
                            );
                          } else if (file.fileType === 'excel') {
                            return (
                              <TouchableOpacity
                                key={fIdx}
                                activeOpacity={0.8}
                                onPress={() => openDocument(file)}
                                style={[
                                  styles.docFileCard,
                                  isUser ? styles.docFileCardUser : styles.docFileCardExcel,
                                ]}
                              >
                                <Ionicons
                                  name="grid"
                                  size={22}
                                  color={isUser ? '#86efac' : '#16a34a'}
                                />
                                <View style={styles.docFileTextCol}>
                                  <Text
                                    style={[
                                      styles.docFileName,
                                      isUser ? styles.docFileNameUser : styles.docFileNameExcel,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {file.name}
                                  </Text>
                                  <Text style={styles.docFileMeta}>Spreadsheet Excel • Buka</Text>
                                </View>
                                <Ionicons
                                  name="open-outline"
                                  size={16}
                                  color={isUser ? 'rgba(255,255,255,0.7)' : '#16a34a'}
                                />
                              </TouchableOpacity>
                            );
                          } else {
                            return (
                              <TouchableOpacity
                                key={fIdx}
                                activeOpacity={0.8}
                                onPress={() => openDocument(file)}
                                style={[
                                  styles.docFileCard,
                                  isUser ? styles.docFileCardUser : styles.docFileCardCsv,
                                ]}
                              >
                                <Ionicons
                                  name="document-attach"
                                  size={22}
                                  color={isUser ? '#99f6e4' : '#0d9488'}
                                />
                                <View style={styles.docFileTextCol}>
                                  <Text
                                    style={[
                                      styles.docFileName,
                                      isUser ? styles.docFileNameUser : styles.docFileNameCsv,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {file.name}
                                  </Text>
                                  <Text style={styles.docFileMeta}>Berkas CSV • Buka</Text>
                                </View>
                                <Ionicons
                                  name="open-outline"
                                  size={16}
                                  color={isUser ? 'rgba(255,255,255,0.7)' : '#0d9488'}
                                />
                              </TouchableOpacity>
                            );
                          }
                        })}
                      </View>
                    )}

                    {/* Text Body */}
                    {isUser ? (
                      <Text style={styles.userTextContent}>{msg.content}</Text>
                    ) : (
                      <View style={styles.modelContentWrapper}>
                        {renderFormattedContent(msg.content)}
                      </View>
                    )}

                    {/* Queued badge */}
                    {msg.isQueued && (
                      <View style={styles.queuedBadgeBubble}>
                        <ActivityIndicator size="small" color="#fef08a" />
                        <Text style={styles.queuedBadgeText}>
                          Dalam antrean (akan dikirim setelah respons selesai)
                        </Text>
                      </View>
                    )}

                    {/* Quick Confirmation Actions */}
                    {showConfirmationActions && (
                      <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity
                          style={styles.confirmActionButton}
                          onPress={() =>
                            handleSendMessage('Ya, buatkan barang baru dan lanjutkan pembelian')
                          }
                          disabled={loading}
                        >
                          <Text style={styles.confirmActionText}>
                            ✅ Ya, Buatkan Barang Baru & Lanjutkan
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelActionButton}
                          onPress={() =>
                            handleSendMessage('Batalkan pembuatan pembelian ini')
                          }
                          disabled={loading}
                        >
                          <Text style={styles.cancelActionText}>❌ Batalkan</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Timestamp */}
                  {msg.created_at && (
                    <Text style={styles.messageTimestamp}>
                      {new Date(msg.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Active Job Real-Time Polling Indicator */}
          {loading && (
            <View style={styles.loadingProgressCard}>
              <View style={styles.loadingHeader}>
                <ActivityIndicator size="small" color="#4f46e5" />
                <Text style={styles.loadingStepTitle}>
                  {currentStepText || 'AI Assist sedang menganalisis & memproses...'}
                </Text>
              </View>

              {activeJobSteps.length > 0 && (
                <View style={styles.jobStepsList}>
                  {activeJobSteps.slice(-4).map((st, idx) => (
                    <View key={idx} style={styles.jobStepRow}>
                      <Text style={styles.jobStepIcon}>
                        {st.type === 'tool_result' ? '✅' : st.type === 'tool_call' ? '⚡' : 'ℹ️'}
                      </Text>
                      <Text
                        style={[
                          styles.jobStepText,
                          st.type === 'tool_call' ? styles.jobStepToolCall : null,
                        ]}
                        numberOfLines={2}
                      >
                        {st.message}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestion Chips (when conversation is fresh) */}
        {messages.length <= 2 && !loading && (
          <View style={styles.chipsContainer}>
            <Text style={styles.chipsLabel}>Contoh cepat:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {QUICK_PROMPTS.map((prompt, pIdx) => (
                <TouchableOpacity
                  key={pIdx}
                  style={styles.suggestionChip}
                  onPress={() => {
                    if (prompt.includes('Input nota')) {
                      handleOpenAttachmentMenu();
                    } else if (prompt.includes('Rekonsiliasi mutasi')) {
                      pickDocumentFiles();
                    } else {
                      handleSendMessage(prompt);
                    }
                  }}
                >
                  <Text style={styles.suggestionChipText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Contextual Approval Sticky Bar when AI asks for confirmation */}
        {!loading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === 'model' &&
          (() => {
            const lastContent = (messages[messages.length - 1].content || '').toLowerCase();
            const isAskingConfirmation =
              lastContent.includes('konfirmasi') ||
              lastContent.includes('mengonfirmasi') ||
              lastContent.includes('lanjutkan pembelian') ||
              lastContent.includes('tindakan yang diperlukan');

            if (isAskingConfirmation) {
              return (
                <View style={styles.stickyApprovalBar}>
                  <Text style={styles.stickyApprovalTitle}>Persetujuan:</Text>
                  <View style={styles.stickyApprovalButtonsRow}>
                    <TouchableOpacity
                      style={styles.stickyConfirmButton}
                      onPress={() =>
                        handleSendMessage('Ya, buatkan barang baru dan lanjutkan pembelian')
                      }
                    >
                      <Text style={styles.stickyConfirmText}>
                        ✅ Ya, Buatkan Barang Baru & Lanjutkan
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stickyCancelButton}
                      onPress={() =>
                        handleSendMessage('Batalkan pembuatan pembelian ini')
                      }
                    >
                      <Text style={styles.stickyCancelText}>❌ Batalkan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            return null;
          })()}

        {/* Message Queue Notification Banner */}
        {messageQueue.length > 0 && (
          <View style={styles.queueBanner}>
            <View style={styles.queueBannerLeft}>
              <ActivityIndicator size="small" color="#d97706" />
              <Text style={styles.queueBannerText}>
                <Text style={{ fontWeight: '700' }}>{messageQueue.length} pesan</Text> dalam
                antrean • otomatis dikirim.
              </Text>
            </View>
            <View style={styles.queueActiveBadge}>
              <Text style={styles.queueActiveText}>Antrean Aktif</Text>
            </View>
          </View>
        )}

        {/* Attached Multi-File Preview Tray */}
        {attachedFiles.length > 0 && (
          <View style={styles.attachedImagesTray}>
            <View style={styles.attachedTrayHeader}>
              <View style={styles.trayTitleRow}>
                <Ionicons name="attach" size={18} color="#2563eb" />
                <Text style={styles.trayTitleText}>
                  {attachedFiles.length} Berkas Terlampir (Foto / PDF / Excel / CSV)
                </Text>
              </View>
              <View style={styles.trayActionsRow}>
                <TouchableOpacity
                  style={styles.trayActionBtn}
                  onPress={handleOpenAttachmentMenu}
                >
                  <Text style={styles.trayActionAddText}>+ Tambah</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.trayActionBtn}
                  onPress={() => setAttachedFiles([])}
                >
                  <Text style={styles.trayActionClearText}>Hapus Semua</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trayThumbnailsScroll}>
              {attachedFiles.map((file, idx) => (
                <View key={idx} style={styles.trayFileItem}>
                  {file.fileType === 'image' ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setPreviewImageUrl(file.previewUrl)}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <Image source={{ uri: file.previewUrl }} style={styles.trayThumbnail} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => openDocument(file)}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <View
                        style={[
                          styles.trayDocBadge,
                          file.fileType === 'pdf'
                            ? styles.trayDocPdf
                            : file.fileType === 'excel'
                            ? styles.trayDocExcel
                            : styles.trayDocCsv,
                        ]}
                      >
                        <Ionicons
                          name={
                            file.fileType === 'pdf'
                              ? 'document-text'
                              : file.fileType === 'excel'
                              ? 'grid'
                              : 'document-attach'
                          }
                          size={24}
                          color={
                            file.fileType === 'pdf'
                              ? '#dc2626'
                              : file.fileType === 'excel'
                              ? '#16a34a'
                              : '#0d9488'
                          }
                        />
                        <Text
                          style={[
                            styles.trayDocTag,
                            file.fileType === 'pdf'
                              ? styles.trayDocTagPdf
                              : file.fileType === 'excel'
                              ? styles.trayDocTagExcel
                              : styles.trayDocTagCsv,
                          ]}
                        >
                          {file.fileType.toUpperCase()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.trayRemoveBadge}
                    onPress={() =>
                      setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.trayItemFooter}>
                    <Text style={styles.trayItemFooterText} numberOfLines={1}>
                      {file.name}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom Input Area */}
        <View style={styles.bottomInputBar}>
          <TouchableOpacity
            style={[
              styles.attachButton,
              attachedFiles.length > 0 ? styles.attachButtonActive : null,
            ]}
            onPress={handleOpenAttachmentMenu}
            accessibilityLabel="Lampirkan berkas nota / mutasi bank"
          >
            <Ionicons
              name="attach"
              size={24}
              color={attachedFiles.length > 0 ? '#2563eb' : '#64748b'}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={
              attachedFiles.length > 0
                ? `Instruksi untuk ${attachedFiles.length} berkas...`
                : loading
                ? 'AI sedang memproses... Ketik untuk antrean'
                : 'Tanya AI Assist atau instruksikan sesuatu...'
            }
            placeholderTextColor="#9ca3af"
            value={inputPrompt}
            onChangeText={setInputPrompt}
            multiline
            maxLength={3000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              inputPrompt.trim() || attachedFiles.length > 0
                ? loading
                  ? styles.sendButtonQueue
                  : styles.sendButtonActive
                : styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputPrompt.trim() && attachedFiles.length === 0}
          >
            <Ionicons
              name={loading ? 'time-outline' : 'send'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Footer info note */}
        <View style={styles.footerNoteContainer}>
          <Text style={styles.footerNoteText}>
            💡 Riwayat chat disimpan 7 hari. Mendukung foto nota, dokumen PDF, spreadsheet Excel, dan CSV.
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Sessions History Modal */}
      <Modal
        visible={showSessionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSessionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sessionsModalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Riwayat Chat AI Assist</Text>
                <Text style={styles.modalSubtitle}>Disimpan hingga 7 hari</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSessionsModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newChatModalButton} onPress={startNewChat}>
              <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
              <Text style={styles.newChatModalText}>Mulai Percakapan Baru</Text>
            </TouchableOpacity>

            <ScrollView style={styles.sessionsListScroll}>
              {sessions.length === 0 ? (
                <View style={styles.emptySessions}>
                  <Text style={styles.emptySessionsText}>Belum ada riwayat percakapan.</Text>
                </View>
              ) : (
                sessions.map((sess) => (
                  <TouchableOpacity
                    key={sess.id}
                    style={[
                      styles.sessionItem,
                      currentSessionId === sess.id ? styles.sessionItemActive : null,
                    ]}
                    onPress={() => selectSession(sess.id)}
                  >
                    <View style={styles.sessionItemLeft}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={20}
                        color={currentSessionId === sess.id ? '#2563eb' : '#6b7280'}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={[
                            styles.sessionTitle,
                            currentSessionId === sess.id ? styles.sessionTitleActive : null,
                          ]}
                          numberOfLines={1}
                        >
                          {sess.title || 'Percakapan Baru'}
                        </Text>
                        <Text style={styles.sessionDate}>
                          {new Date(sess.updated_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteSession(sess.id)}
                      style={styles.deleteSessionButton}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={styles.imagePreviewClose}
            onPress={() => setPreviewImageUrl(null)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topNavbar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  navbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navIconButton: {
    padding: 4,
    marginRight: 8,
  },
  navTitleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  betaPill: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  betaText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#78350f',
  },
  onlinePill: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#064e3b',
  },
  navSubtitleText: {
    fontSize: 11,
    color: '#e0e7ff',
    marginTop: 2,
  },
  navbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navActionIcon: {
    padding: 6,
  },
  navNewChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  navNewChatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  chatArea: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  messagesContent: {
    padding: 14,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  messageRowModel: {
    flexDirection: 'row',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginTop: 4,
  },
  avatarUser: {
    backgroundColor: '#2563eb',
  },
  avatarModel: {
    backgroundColor: '#7c3aed',
  },
  bubbleContainer: {
    maxWidth: '82%',
  },
  bubbleContainerUser: {
    alignItems: 'flex-end',
  },
  bubbleContainerModel: {
    alignItems: 'flex-start',
    flex: 1,
  },
  toolCallsWrapper: {
    marginBottom: 6,
  },
  toolCallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
    gap: 4,
  },
  toolCallText: {
    fontSize: 11,
    color: '#3730a3',
  },
  toolCallName: {
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bubble: {
    borderRadius: 18,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  bubbleUser: {
    backgroundColor: '#2563eb',
    borderTopRightRadius: 4,
  },
  bubbleModel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopLeftRadius: 4,
    width: '100%',
  },
  messageFilesContainer: {
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageFileCard: {
    width: 104,
    height: 104,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e2e8f0',
  },
  imageFileThumbnail: {
    width: '100%',
    height: '100%',
  },
  imageFileBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  imageFileBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  docFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    maxWidth: 240,
  },
  docFileCardUser: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  docFileCardPdf: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  docFileCardExcel: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  docFileCardCsv: {
    backgroundColor: '#f0fdfa',
    borderColor: '#99f6e4',
  },
  docFileTextCol: {
    flex: 1,
  },
  docFileName: {
    fontSize: 12,
    fontWeight: '700',
  },
  docFileNameUser: {
    color: '#ffffff',
  },
  docFileNamePdf: {
    color: '#991b1b',
  },
  docFileNameExcel: {
    color: '#166534',
  },
  docFileNameCsv: {
    color: '#115e59',
  },
  docFileMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  userTextContent: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  modelContentWrapper: {
    width: '100%',
  },
  paragraph: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 21,
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  heading1: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 4,
  },
  heading2: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginVertical: 3,
  },
  heading3: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginVertical: 2,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  listBullet: {
    width: 18,
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '700',
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  tableWrapper: {
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  tableContainer: {
    minWidth: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 90,
    justifyContent: 'center',
  },
  tableHeaderCell: {
    backgroundColor: '#f1f5f9',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  heading3Row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
    gap: 6,
  },
  headingAccent: {
    width: 3,
    height: 14,
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
  heading3Text: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  tableCellCenter: {
    alignItems: 'center',
  },
  tableCellRight: {
    alignItems: 'flex-end',
  },
  tableCellTextFirst: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tableCellTextQty: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#334155',
  },
  tableCellTextPrice: {
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#1e293b',
    fontWeight: '600',
  },
  pillGreen: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'center',
  },
  pillGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  pillAmber: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'center',
  },
  pillAmberText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  stickyApprovalBar: {
    backgroundColor: '#eff6ff',
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'column',
    gap: 6,
  },
  stickyApprovalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
  },
  stickyApprovalButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  stickyConfirmButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 1,
  },
  stickyConfirmText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  stickyCancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stickyCancelText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  tableCellText: {
    fontSize: 12,
    color: '#1e293b',
  },
  queuedBadgeBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  queuedBadgeText: {
    fontSize: 11,
    color: '#fef08a',
    flex: 1,
  },
  actionButtonsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  confirmActionButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelActionButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelActionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  messageTimestamp: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 3,
    paddingHorizontal: 4,
  },
  loadingProgressCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 16,
    padding: 12,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4338ca',
    flex: 1,
  },
  jobStepsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 4,
  },
  jobStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  jobStepIcon: {
    fontSize: 11,
    marginTop: 1,
  },
  jobStepText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
    lineHeight: 16,
  },
  jobStepToolCall: {
    color: '#312e81',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  chipsContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipsLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  suggestionChip: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  suggestionChipText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  queueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  queueBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  queueBannerText: {
    fontSize: 11,
    color: '#92400e',
    flex: 1,
  },
  queueActiveBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  queueActiveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b45309',
  },
  attachedImagesTray: {
    backgroundColor: '#f0f9ff',
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  attachedTrayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trayTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  trayActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  trayActionBtn: {
    paddingVertical: 2,
  },
  trayActionAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  trayActionClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  trayThumbnailsScroll: {
    paddingVertical: 2,
  },
  trayFileItem: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    backgroundColor: '#fff',
  },
  trayThumbnail: {
    width: '100%',
    height: '100%',
  },
  trayDocBadge: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  trayDocPdf: {
    backgroundColor: '#fef2f2',
  },
  trayDocExcel: {
    backgroundColor: '#f0fdf4',
  },
  trayDocCsv: {
    backgroundColor: '#f0fdfa',
  },
  trayDocTag: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  trayDocTagPdf: {
    color: '#b91c1c',
  },
  trayDocTagExcel: {
    color: '#15803d',
  },
  trayDocTagCsv: {
    color: '#0f766e',
  },
  trayRemoveBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  trayItemFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 1,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  trayItemFooterText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bottomInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  attachButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginBottom: 2,
  },
  attachButtonActive: {
    backgroundColor: '#e0f2fe',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: '#2563eb',
  },
  sendButtonQueue: {
    backgroundColor: '#d97706',
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  footerNoteContainer: {
    backgroundColor: '#fff',
    paddingBottom: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  footerNoteText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sessionsModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 4,
  },
  newChatModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 12,
    gap: 8,
  },
  newChatModalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  sessionsListScroll: {
    paddingHorizontal: 14,
    marginTop: 8,
  },
  emptySessions: {
    padding: 24,
    alignItems: 'center',
  },
  emptySessionsText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 3,
    backgroundColor: '#f8fafc',
  },
  sessionItemActive: {
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  sessionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  sessionTitleActive: {
    color: '#3730a3',
    fontWeight: '700',
  },
  sessionDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  deleteSessionButton: {
    padding: 6,
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH * 0.95,
    height: '80%',
  },
});
