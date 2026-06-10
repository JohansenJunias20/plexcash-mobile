import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showMessage } from 'react-native-flash-message';
import * as ImagePicker from 'expo-image-picker';
import ApiService from '../../../services/api';

interface Marketplace {
  id: number;
  platform: string;
  name?: string;
  shop_id: string;
  status?: string;
}

interface MigrationProgress {
  session_id: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  status: 'running' | 'completed' | 'failed' | 'error';
  current_item?: string;
}

interface MigrateModalProps {
  visible: boolean;
  selectedIds: (number | string)[];
  sourceIdEcommerce: number;
  marketplaces: Marketplace[];
  onClose: () => void;
  onSuccess: () => void;
}

const MigrateModal: React.FC<MigrateModalProps> = ({
  visible,
  selectedIds,
  sourceIdEcommerce,
  marketplaces,
  onClose,
  onSuccess,
}) => {
  const [targetMarketplace, setTargetMarketplace] = useState<number>(0);
  const [twibbonUri, setTwibbonUri] = useState<string | null>(null);
  const [twibbonPath, setTwibbonPath] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Set default target marketplace
  useEffect(() => {
    if (marketplaces.length > 0 && targetMarketplace === 0) {
      setTargetMarketplace(marketplaces[0].id);
    }
  }, [marketplaces]);

  // No longer polling; we update progress manually during chunked processing.

  const handlePickTwibbon = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        showMessage({
          message: 'Peringatan',
          description: 'Izin akses galeri diperlukan',
          type: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setTwibbonUri(result.assets[0].uri);
        // In a real implementation, you would upload the image here
        // and get the server path
        setTwibbonPath('/uploads/twibbon_temp.png');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showMessage({
        message: 'Error',
        description: 'Gagal memilih gambar',
        type: 'danger',
      });
    }
  };

  const handleRemoveTwibbon = () => {
    setTwibbonUri(null);
    setTwibbonPath(null);
  };

  const handleMigrate = async () => {
    if (selectedIds.length === 0) {
      showMessage({
        message: 'Peringatan',
        description: 'Tidak ada produk yang dipilih',
        type: 'warning',
      });
      return;
    }

    if (targetMarketplace === 0) {
      showMessage({
        message: 'Peringatan',
        description: 'Pilih marketplace tujuan',
        type: 'warning',
      });
      return;
    }

    setIsMigrating(true);
    const baseSessionId = `migration_${Date.now()}`;
    
    // Split into chunks of 5
    const CHUNK_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
      chunks.push(selectedIds.slice(i, i + CHUNK_SIZE));
    }

    let processedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;
    let errorMessages: string[] = [];

    setMigrationProgress({
      session_id: baseSessionId,
      total: selectedIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      status: 'running',
    });

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkSessionId = `${baseSessionId}_chunk_${i}`;

        setMigrationProgress(prev => prev ? { ...prev, current_item: `Memproses ${i + 1}/${chunks.length} grup produk` } : null);

        const response = await ApiService.post('/migrate-barang', {
          ids: chunk,
          source_id_ecommerce: sourceIdEcommerce,
          target_id_ecommerce: targetMarketplace,
          with_twibbon: !!twibbonPath,
          twibbon_path: twibbonPath,
          session_id: chunkSessionId,
        });

        processedCount += chunk.length;

        if (response?.status) {
          succeededCount += chunk.length;
        } else {
          // If the backend returned partial success/failures within the chunk
          if (response?.reason?.rejected_list) {
            failedCount += response.reason.rejected_list.length;
            succeededCount += chunk.length - response.reason.rejected_list.length;
          } else {
            failedCount += chunk.length;
          }

          let msg = response?.message || (typeof response?.reason === 'string' ? response.reason : '');
          
          if (!msg && response?.reason?.message) {
            msg = response.reason.message;
          } else if (!msg && response?.error) {
            msg = typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
          } else if (!msg && response?.reason?.rejected_list && Array.isArray(response.reason.rejected_list)) {
            const reasons = response.reason.rejected_list.map((r: any) => {
              if (typeof r === 'string') return r;
              return r?.reason || r?.message || JSON.stringify(r);
            }).filter(Boolean);
            if (reasons.length > 0) {
              msg = reasons.join(', ');
            }
          }

          if (!msg) {
            msg = response?.reason ? JSON.stringify(response.reason) : JSON.stringify(response || {});
          }

          const finalMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
          if (finalMsg && !errorMessages.includes(finalMsg)) {
            errorMessages.push(finalMsg);
          }
        }

        setMigrationProgress(prev => prev ? {
          ...prev,
          processed: processedCount,
          succeeded: succeededCount,
          failed: failedCount,
        } : null);
      }

      setMigrationProgress(prev => prev ? { ...prev, status: 'completed' } : null);
      setIsMigrating(false);

      let messageType: 'success' | 'warning' | 'danger' = 'success';
      let title = 'Berhasil';
      
      if (failedCount > 0 && succeededCount === 0) {
        messageType = 'danger';
        title = 'Gagal';
      } else if (failedCount > 0) {
        messageType = 'warning';
        title = 'Selesai Sebagian';
      }

      let description = `Migration selesai. Berhasil: ${succeededCount}, Gagal: ${failedCount}`;
      if (errorMessages.length > 0) {
        description += `\nError: ${errorMessages.join(', ')}`;
      }

      showMessage({
        message: title,
        description: description,
        type: messageType,
        duration: errorMessages.length > 0 ? 6000 : 4000,
      });
      
      if (failedCount > 0 || errorMessages.length > 0) {
        Alert.alert(title, description, [
          { text: 'OK', onPress: () => onSuccess() }
        ]);
      } else {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error migrating products:', error);
      let rawError = error.response?.data?.message || error.response?.data?.error || error.response?.data || error.message || 'Gagal memigrasikan sebagian produk';
      
      const errorMsg = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);

      showMessage({
        message: 'Error',
        description: errorMsg,
        type: 'danger',
        duration: 6000,
      });

      Alert.alert('Migrasi Gagal', errorMsg);

      setIsMigrating(false);
      setMigrationProgress(prev => prev ? { ...prev, status: 'error' } : null);
    }
  };


  const handleClose = () => {
    if (!isMigrating) {
      setTwibbonUri(null);
      setTwibbonPath(null);
      setMigrationProgress(null);
      setSessionId(null);
      onClose();
    }
  };

  const progressPercentage = migrationProgress
    ? ((migrationProgress.processed || 0) / Math.max(migrationProgress.total || 1, 1)) * 100
    : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Migrate Produk</Text>
            <TouchableOpacity onPress={handleClose} disabled={isMigrating}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={24} color="#10b981" />
              <Text style={styles.infoText}>
                Produk akan di-copy ke marketplace tujuan yang dipilih.
                {'\n\n'}
                Produk yang dipilih: <Text style={styles.infoBold}>{selectedIds.length}</Text>
              </Text>
            </View>

            {/* Target Marketplace Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Target Marketplace:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.marketplaceScroll}
              >
                {marketplaces.map((marketplace) => (
                  <TouchableOpacity
                    key={marketplace.id}
                    style={[
                      styles.marketplaceOption,
                      targetMarketplace === marketplace.id && styles.marketplaceOptionSelected,
                    ]}
                    onPress={() => setTargetMarketplace(marketplace.id)}
                    disabled={isMigrating}
                  >
                    <Text
                      style={[
                        styles.marketplaceName,
                        targetMarketplace === marketplace.id && styles.marketplaceNameSelected,
                      ]}
                    >
                      {marketplace.platform}
                    </Text>
                    <Text
                      style={[
                        styles.marketplaceShop,
                        targetMarketplace === marketplace.id && styles.marketplaceShopSelected,
                      ]}
                    >
                      {marketplace.name || marketplace.shop_id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Twibbon Upload */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add Twibbon (Opsional):</Text>
              {twibbonUri ? (
                <View style={styles.twibbonPreview}>
                  <Image source={{ uri: twibbonUri }} style={styles.twibbonImage} />
                  <TouchableOpacity
                    style={styles.removeTwibbonButton}
                    onPress={handleRemoveTwibbon}
                    disabled={isMigrating}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handlePickTwibbon}
                  disabled={isMigrating}
                >
                  <Ionicons name="cloud-upload-outline" size={32} color="#6b7280" />
                  <Text style={styles.uploadButtonText}>Upload Twibbon</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Migration Progress */}
            {migrationProgress && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Progress:</Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progressPercentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {Math.round(progressPercentage)}% ({migrationProgress.processed}/{migrationProgress.total})
                  </Text>
                </View>

                <View style={styles.progressStats}>
                  <View style={styles.progressStat}>
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    <Text style={styles.progressStatText}>Berhasil: {migrationProgress.succeeded || 0}</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                    <Text style={styles.progressStatText}>Gagal: {migrationProgress.failed}</Text>
                  </View>
                </View>

                {migrationProgress.current_item && (
                  <Text style={styles.currentItem}>
                    Sedang memproses: {migrationProgress.current_item}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isMigrating}
            >
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.migrateButton, isMigrating && styles.buttonDisabled]}
              onPress={handleMigrate}
              disabled={isMigrating}
            >
              {isMigrating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.migrateButtonText}>Migrate Sekarang</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  content: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#065f46',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  marketplaceScroll: {
    gap: 8,
  },
  marketplaceOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    minWidth: 140,
  },
  marketplaceOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: '#d1fae5',
  },
  marketplaceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  marketplaceNameSelected: {
    color: '#065f46',
  },
  marketplaceShop: {
    fontSize: 12,
    color: '#9ca3af',
  },
  marketplaceShopSelected: {
    color: '#059669',
  },
  uploadButton: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  twibbonPreview: {
    position: 'relative',
    alignItems: 'center',
  },
  twibbonImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  removeTwibbonButton: {
    position: 'absolute',
    top: -8,
    right: '35%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    gap: 16,
  },
  progressStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressStatText: {
    fontSize: 13,
    color: '#6b7280',
  },
  currentItem: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  migrateButton: {
    backgroundColor: '#10b981',
  },
  migrateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default MigrateModal;
