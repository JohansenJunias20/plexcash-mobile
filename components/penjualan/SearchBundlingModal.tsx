import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import {
  loadingTimeEstimator,
  LoadingEstimate,
  LoadingProgress,
} from '../../services/ecommerce/loadingTimeEstimator';

export interface BundlingItem {
  id: number;
  nama: string;
  sku: string;
  merk?: string;
  kategori?: string;
  satuan?: string;
  hargabeli: number;
  hargajual: number;
  hargajual2: number;
  stok: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (items: BundlingItem[]) => void;
  exceptions?: number[]; // id_bundling yang sudah dipilih
}

export default function SearchBundlingModal({ visible, onClose, onSelect, exceptions = [] }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bundlings, setBundlings] = useState<BundlingItem[]>([]);
  const [filteredBundlings, setFilteredBundlings] = useState<BundlingItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<BundlingItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Loading time estimation state
  const [loadingEstimate, setLoadingEstimate] = useState<LoadingEstimate | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const loadingStartTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize loading time estimator
  useEffect(() => {
    loadingTimeEstimator.initialize();
  }, []);

  useEffect(() => {
    if (visible) {
      loadBundlings();
      setSelectedItems([]);
    } else {
      // Clear progress tracking when modal closes
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setLoadingProgress(null);
      setLoadingEstimate(null);
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBundlings(bundlings.filter(b => !exceptions.includes(b.id)));
    } else {
      const filtered = bundlings.filter(
        (bundling) =>
          !exceptions.includes(bundling.id) &&
          (bundling.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bundling.sku.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredBundlings(filtered);
    }
  }, [searchQuery, bundlings, exceptions]);

  const loadBundlings = async () => {
    try {
      setLoading(true);

      // Get initial estimate and start tracking
      const estimate = loadingTimeEstimator.getEstimate();
      setLoadingEstimate(estimate);
      loadingStartTimeRef.current = Date.now();

      console.log('📦 [SearchBundling] Loading bundlings...');
      console.log('⏱️ [SearchBundling] Estimated loading time:', {
        seconds: estimate.estimatedSeconds,
        range: `${estimate.estimatedRange.min}-${estimate.estimatedRange.max}s`,
        confidence: estimate.confidence,
      });

      // Start progress tracking
      progressIntervalRef.current = setInterval(() => {
        const progress = loadingTimeEstimator.calculateProgress(
          loadingStartTimeRef.current,
          estimate
        );
        setLoadingProgress(progress);
      }, 500);

      const token = await getTokenAuth();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/get/bundling`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      // Calculate actual loading time
      const loadingDuration = Date.now() - loadingStartTimeRef.current;

      if (data.status && data.data) {
        console.log('✅ [SearchBundling] Bundlings loaded:', data.data.length);
        console.log('⏱️ [SearchBundling] Actual loading time:', (loadingDuration / 1000).toFixed(1), 'seconds');

        // Record loading time for future estimates
        await loadingTimeEstimator.recordLoadingTime(data.data.length, loadingDuration);

        setBundlings(data.data);
        setFilteredBundlings(data.data.filter((b: BundlingItem) => !exceptions.includes(b.id)));
      }
    } catch (error) {
      console.error('Load bundlings error:', error);
    } finally {
      setLoading(false);
      // Clear progress tracking
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  };

  const toggleSelect = (bundling: BundlingItem) => {
    const isSelected = selectedItems.some(item => item.id === bundling.id);
    if (isSelected) {
      setSelectedItems(selectedItems.filter(item => item.id !== bundling.id));
    } else {
      setSelectedItems([...selectedItems, bundling]);
    }
  };

  const handleDone = () => {
    if (selectedItems.length > 0) {
      onSelect(selectedItems);
      onClose();
      setSearchQuery('');
      setSelectedItems([]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Pilih Bundling</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari bundling (nama, SKU)..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#dc2626" />
              <Text style={styles.loadingTitle}>Memuat data bundling...</Text>

              {loadingProgress && (
                <View style={styles.progressContainer}>
                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${loadingProgress.progressPercentage}%` }
                      ]}
                    />
                  </View>

                  {/* Progress Info */}
                  <View style={styles.progressInfo}>
                    <Text style={styles.progressText}>
                      {loadingProgress.progressPercentage}%
                    </Text>
                    <Text style={styles.progressText}>
                      {loadingProgress.elapsedSeconds}s / ~{loadingProgress.estimatedTotalSeconds}s
                    </Text>
                  </View>

                  {/* Status Message */}
                  <Text style={styles.statusText}>
                    {loadingProgress.status === 'starting' && '🚀 Memulai...'}
                    {loadingProgress.status === 'loading' && '⏳ Memuat data...'}
                    {loadingProgress.status === 'almost-done' && '⚡ Hampir selesai...'}
                    {loadingProgress.status === 'finishing' && '✨ Menyelesaikan...'}
                  </Text>

                  {loadingEstimate && (
                    <Text style={styles.estimateText}>
                      Estimasi: {loadingEstimate.estimatedRange.min}-{loadingEstimate.estimatedRange.max} detik ({loadingEstimate.confidence === 'high' ? '🎯 Akurat' : loadingEstimate.confidence === 'medium' ? '📊 Cukup Akurat' : '📈 Perkiraan'})
                    </Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredBundlings}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedItems.some(selected => selected.id === item.id);
                return (
                  <TouchableOpacity
                    style={[styles.item, isSelected && styles.itemSelected]}
                    onPress={() => toggleSelect(item)}
                  >
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName}>{item.nama}</Text>
                      <Text style={styles.itemDetail}>SKU: {item.sku}</Text>
                      <Text style={styles.itemDetail}>Stok: {item.stok || 0} | Harga: Rp {(item.hargajual2 || 0).toLocaleString()}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color="#2563eb" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Tidak ada bundling ditemukan</Text>
              }
            />
          )}

          {selectedItems.length > 0 && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{selectedItems.length} item dipilih</Text>
              <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                <Text style={styles.doneButtonText}>Tambahkan</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  loader: {
    marginTop: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#dc2626',
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
    textAlign: 'center',
  },
  estimateText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemSelected: {
    backgroundColor: '#eff6ff',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  doneButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

