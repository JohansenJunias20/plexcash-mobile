import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FlashSaleService,
  IAutoFlashSaleItem,
  translateShopeeError,
} from '../../../../services/ecommerce/flashSaleService';

interface AutoFlashSaleTabProps {
  idEcommerce: number;
}

export default function AutoFlashSaleTab({ idEcommerce }: AutoFlashSaleTabProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<IAutoFlashSaleItem[]>([]);
  const [lookupMap, setLookupMap] = useState<Record<string, any>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!idEcommerce) return;
    setLoading(true);
    try {
      const [res, catalog] = await Promise.all([
        FlashSaleService.getAutoFlashSaleList(idEcommerce),
        FlashSaleService.getProductCatalog(idEcommerce),
      ]);
      if (catalog && catalog.lookupMap) {
        setLookupMap(catalog.lookupMap);
      }
      if (res.status && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error('[AutoFlashSaleTab] Error fetching auto items:', err);
    } finally {
      setLoading(false);
    }
  }, [idEcommerce]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const selectRejectedOnly = () => {
    const rejectedIds = items
      .filter((i) => i.last_sync_status === 'failed' || !!i.reason_failed)
      .map((i) => i.id);

    if (rejectedIds.length === 0) {
      Alert.alert('Info', 'Tidak ada item yang ditolak oleh Shopee.');
      return;
    }

    setSelectedIds(new Set(rejectedIds));
  };

  const handleDeleteSelected = () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    Alert.alert(
      'Hapus Konfigurasi Otomatis',
      `Apakah Anda yakin ingin menghapus ${idsToDelete.length} item dari pendaftaran otomatis Flash Sale?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await FlashSaleService.deleteAutoFlashSaleItems(
                idEcommerce,
                idsToDelete
              );
              if (res.status) {
                Alert.alert('Sukses', 'Item berhasil dihapus dari konfigurasi otomatis.');
                fetchItems();
              } else {
                Alert.alert('Gagal', res.reason || 'Gagal menghapus item.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Gagal menghubungi server.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const rejectedCount = useMemo(() => {
    return items.filter((i) => i.last_sync_status === 'failed' || !!i.reason_failed).length;
  }, [items]);

  return (
    <View style={styles.container}>
      {/* Action Toolbar */}
      {items.length > 0 && (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={selectAll}>
            <Ionicons
              name={selectedIds.size === items.length ? 'checkbox' : 'square-outline'}
              size={18}
              color="#4B5563"
            />
            <Text style={styles.toolBtnText}>
              {selectedIds.size === items.length ? 'Batal Semua' : 'Pilih Semua'}
            </Text>
          </TouchableOpacity>

          {rejectedCount > 0 && (
            <TouchableOpacity style={styles.rejectedFilterBtn} onPress={selectRejectedOnly}>
              <Ionicons name="filter-circle" size={18} color="#DC2626" />
              <Text style={styles.rejectedFilterText}>
                Pilih Yang Ditolak ({rejectedCount})
              </Text>
            </TouchableOpacity>
          )}

          {selectedIds.size > 0 && (
            <TouchableOpacity
              style={styles.deleteSelectedBtn}
              onPress={handleDeleteSelected}
              disabled={deleting}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.deleteSelectedText}>
                Hapus ({selectedIds.size})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Items List */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#EE4D2D" />
          <Text style={styles.centerText}>Memuat item otomatis...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="repeat-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Belum Ada Produk Auto Flash Sale</Text>
          <Text style={styles.emptySubtitle}>
            Aktifkan opsi "Perbarui flash sale otomatis" saat membuat sesi Flash Sale baru agar produk didaftarkan otomatis ke Shopee setiap hari.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            const isFailed = item.last_sync_status === 'failed' || !!item.reason_failed;
            const friendlyErr = translateShopeeError(item.reason_failed || '');

            const cat = lookupMap[String(item.item_id)];
            const displayName =
              cat?.name ||
              (item.product_name && item.product_name !== 'Unknown Product'
                ? item.product_name
                : '') ||
              item.item_name ||
              item.name ||
              `Produk Shopee #${item.item_id}`;
            const displayImage = cat?.picture || item.picture || item.image;
            const displaySku =
              cat?.sku ||
              (item.sku && item.sku !== '-' ? item.sku : '') ||
              item.item_sku ||
              '';

            return (
              <TouchableOpacity
                style={[styles.itemCard, isFailed && styles.itemCardFailed]}
                activeOpacity={0.9}
                onPress={() => toggleSelect(item.id)}
              >
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    onPress={() => toggleSelect(item.id)}
                    style={styles.checkboxContainer}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isSelected ? '#EE4D2D' : '#9CA3AF'}
                    />
                  </TouchableOpacity>

                  {displayImage ? (
                    <Image
                      source={{ uri: displayImage }}
                      style={styles.productThumb}
                    />
                  ) : (
                    <View style={styles.productThumbPlaceholder}>
                      <Ionicons name="image-outline" size={18} color="#9CA3AF" />
                    </View>
                  )}

                  <View style={styles.cardTitleCol}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {displayName}
                    </Text>
                    {displaySku ? (
                      <Text style={styles.itemSku}>SKU: {displaySku}</Text>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.statusChip,
                      item.status === 'ACTIVE' ? styles.statusChipActive : styles.statusChipEnded,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        item.status === 'ACTIVE' ? styles.statusChipTextActive : styles.statusChipTextEnded,
                      ]}
                    >
                      {item.status === 'ACTIVE' ? 'AKTIF' : 'BERAKHIR'}
                    </Text>
                  </View>
                </View>

                {/* Pricing & Quota row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Harga Promo</Text>
                    <Text style={styles.metaValPrice}>
                      Rp {item.flash_price.toLocaleString('id-ID')}
                    </Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Stok per Sesi</Text>
                    <Text style={styles.metaVal}>{item.stock_allocated} unit</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Berakhir Pada</Text>
                    <Text style={styles.metaVal}>
                      {item.end_date ? item.end_date : 'Selamanya'}
                    </Text>
                  </View>
                </View>

                {/* Error Banner if Shopee Rejected */}
                {isFailed && (
                  <View style={styles.failedBox}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.failedTitle}>Ditolak Shopee saat Sinkronisasi:</Text>
                      <Text style={styles.failedText}>{friendlyErr}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolBtnText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  rejectedFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  rejectedFilterText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  deleteSelectedBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  deleteSelectedText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
  },
  itemCardFailed: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: 8,
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  productThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleCol: {
    flex: 1,
    marginLeft: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemSku: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusChipActive: {
    backgroundColor: '#DEF7EC',
  },
  statusChipEnded: {
    backgroundColor: '#F3F4F6',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusChipTextActive: {
    color: '#03543F',
  },
  statusChipTextEnded: {
    color: '#6B7280',
  },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  metaValPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EE4D2D',
    marginTop: 2,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  failedBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  failedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  failedText: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
    lineHeight: 15,
  },
});
