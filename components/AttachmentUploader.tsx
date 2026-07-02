import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { API_BASE_URL } from '../services/api';
import { getTokenAuth } from '../services/token';

export interface DriveFile {
  id?: number;
  file_id: string;
  file_name: string;
  mime_type?: string;
  web_view_link?: string;
  _pending?: boolean;
}

interface Props {
  transactionType: "penjualan" | "pembelian" | "ecommerce_pesanan" | "preorder" | "dp_beli";
  transactionId: number | string | null;
  isGDriveConnected: boolean;
  onPendingFilesChange?: (files: DriveFile[]) => void;
  hideButton?: boolean;
}

const TOOLTIP_NOT_CONNECTED = "Upload attachment memerlukan koneksi Google Drive.";

export default function AttachmentUploader({
  transactionType,
  transactionId,
  isGDriveConnected,
  onPendingFilesChange,
  hideButton,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [linkedFiles, setLinkedFiles] = useState<DriveFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transactionId && transactionId !== 'BARU') {
      fetchAttachments();
    }
  }, [transactionId]);

  const fetchAttachments = async () => {
    try {
      const token = await getTokenAuth();
      const res = await fetch(
        `${API_BASE_URL}/google-drive/attachments?type=${transactionType}&id=${transactionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.status) setLinkedFiles(data.data as DriveFile[]);
    } catch (e) {
      console.error("Failed to fetch attachments", e);
    }
  };

  useEffect(() => {
    onPendingFilesChange?.(pendingFiles);
  }, [pendingFiles]);

  const handlePickFiles = async () => {
    if (!isGDriveConnected) {
      Alert.alert("Gagal", TOOLTIP_NOT_CONNECTED);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploading(true);
        setError(null);
        
        const token = await getTokenAuth();

        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          const formData = new FormData();
          
          formData.append('file', {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
          } as any);

          try {
            const res = await fetch(`${API_BASE_URL}/google-drive/upload`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                // Fetch in React Native will set the Content-Type to multipart/form-data with boundary automatically
              },
              body: formData,
            });
            const data = await res.json();

            if (!data.status) {
              setError(data.reason || "Upload gagal");
              continue;
            }

            const driveFile: DriveFile = {
              file_id: data.file_id,
              file_name: data.file_name,
              mime_type: data.mime_type,
              web_view_link: data.web_view_link,
            };

            if (transactionId && transactionId !== 'BARU') {
              // Link immediately
              await fetch(`${API_BASE_URL}/google-drive/link-attachments`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  type: transactionType,
                  transaction_id: transactionId,
                  files: [driveFile],
                }),
              });
              setLinkedFiles((prev) => [...prev, driveFile]);
            } else {
              setPendingFiles((prev) => [...prev, driveFile]);
            }
          } catch (uploadErr) {
            console.error(uploadErr);
            setError(String(uploadErr));
          }
        }
        setUploading(false);
      }
    } catch (err) {
      console.error(err);
      setError(String(err));
      setUploading(false);
    }
  };

  const handleDeleteLinked = async (file: DriveFile) => {
    if (!file.id) return;
    try {
      const token = await getTokenAuth();
      await fetch(`${API_BASE_URL}/google-drive/attachment/${file.id}?type=${transactionType}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setLinkedFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDeletePending = (file_id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.file_id !== file_id));
  };

  const allFiles = [
    ...linkedFiles,
    ...pendingFiles.map((f) => ({ ...f, _pending: true })),
  ];

  return (
    <View style={styles.container}>
      {!hideButton && (
        <Text style={styles.title}>Lampiran</Text>
      )}

      {!hideButton && (
        <TouchableOpacity
          style={[styles.uploadButton, (!isGDriveConnected || uploading) && styles.uploadButtonDisabled]}
          disabled={!isGDriveConnected || uploading}
          onPress={handlePickFiles}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Ionicons name="attach" size={20} color={isGDriveConnected ? "#3b82f6" : "#9CA3AF"} />
          )}
          <Text style={[styles.uploadButtonText, !isGDriveConnected && styles.disabledText]}>
            {uploading ? "Mengupload..." : "Upload Lampiran"}
          </Text>
        </TouchableOpacity>
      )}

      {!isGDriveConnected && !hideButton && (
        <Text style={styles.warningText}>{TOOLTIP_NOT_CONNECTED}</Text>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {allFiles.length > 0 && (
        <View style={styles.fileList}>
          {allFiles.map((f: any) => (
            <View key={f._pending ? `pending-${f.file_id}` : `linked-${f.id || f.file_id}`} style={styles.fileItem}>
              <View style={styles.fileInfo}>
                <Ionicons name="document-text-outline" size={20} color="#6B7280" />
                <Text style={styles.fileName} numberOfLines={1}>{f.file_name}</Text>
                {f._pending && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>Belum tersimpan</Text>
                  </View>
                )}
              </View>

              <View style={styles.fileActions}>
                {f.web_view_link && (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => Linking.openURL(f.web_view_link)}
                  >
                    <Ionicons name="open-outline" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => f._pending ? handleDeletePending(f.file_id) : handleDeleteLinked(f)}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 6,
  },
  uploadButtonDisabled: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  uploadButtonText: {
    color: '#3b82f6',
    fontWeight: '500',
    fontSize: 14,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  fileList: {
    marginTop: 12,
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  fileName: {
    fontSize: 14,
    color: '#374151',
    flexShrink: 1,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  pendingText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '500',
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
});
