import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FlashSaleService,
  IFlashSaleSession,
  IFlashSaleSessionItem,
  formatEpochTime,
  formatDateTime,
  calculateDiscountPercent,
  calculateHppMargin,
  IShopeeRejection,
} from '../../../../services/ecommerce/flashSaleService';
import ShopeeRejectionModal from './ShopeeRejectionModal';

interface FlashSaleDetailModalProps {
  visible: boolean;
  onClose: () => void;
  session: IFlashSaleSession | null;
  idEcommerce: number;
  onSessionUpdated?: () => void;
}

export default function FlashSaleDetailModal({
  visible,
  onClose,
  session,
  idEcommerce,
  onSessionUpdated,
}: FlashSaleDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<IFlashSaleSessionItem[]>([]);
  const [lookupMap, setLookupMap] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Edit states: itemId -> value
  const [editPriceMap, setEditPriceMap] = useState<Record<string, string>>({});
  const [editStockMap, setEditStockMap] = useState<Record<string, string>>({});

  // Rejection modal
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [rejections, setRejections] = useState<IShopeeRejection[]>([]);
  const [rejectionGeneralReason, setRejectionGeneralReason] = useState('');

  useEffect(() => {
    if (visible && session) {
      loadItems();
      setIsEditing(false);
    }
  }, [visible, session]);

  const loadItems = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [res, catalog] = await Promise.all([
        FlashSaleService.getSessionItems(session.flash_sale_id || session.id, idEcommerce),
        FlashSaleService.getProductCatalog(idEcommerce),
      ]);
      if (catalog && catalog.lookupMap) {
        setLookupMap(catalog.lookupMap);
      }
      if (res.status && Array.isArray(res.data)) {
        setItems(res.data);
        // Init edit maps
        const pMap: Record<string, string> = {};
        const sMap: Record<string, string> = {};
        res.data.forEach((it) => {
          const key = String(it.item_id || it.model_id);
          pMap[key] = String(it.flash_price || '');
          sMap[key] = String(it.stock_allocated || '');
        });
        setEditPriceMap(pMap);
        setEditStockMap(sMap);
      }
    } catch (err) {
      console.error('[FlashSaleDetailModal] Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (key: string, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setEditPriceMap((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleStockChange = (key: string, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setEditStockMap((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleSave = async () => {
    if (!session) return;

    // Validate all items
    const payloadItems: Array<{ item_id: string | number; flash_price: number; stock_allocated: number }> = [];

    for (const item of items) {
      const key = String(item.item_id || item.model_id);
      const priceNum = parseInt(editPriceMap[key] || '0', 10);
      const stockNum = parseInt(editStockMap[key] || '0', 10);

      if (!priceNum || priceNum <= 0) {
        Alert.alert('Perhatian', `Harga flash sale untuk "${item.name || key}" belum diisi.`);
        return;
      }

      const originalPrice = item.original_price || priceNum;
      const discountPct = calculateDiscountPercent(originalPrice, priceNum);

      if (discountPct < 5) {
        Alert.alert(
          'Validasi Shopee Gagal',
          `Diskon untuk "${item.name || key}" adalah ${discountPct}%. Minimal diskon Shopee adalah 5%.`
        );
        return;
      }

      if (stockNum < 1 || stockNum > 350) {
        Alert.alert(
          'Validasi Kuota Shopee',
          `Alokasi stok untuk "${item.name || key}" harus antara 1 sampai 350 unit (saat ini: ${stockNum}).`
        );
        return;
      }

      payloadItems.push({
        item_id: item.item_id || item.model_id!,
        flash_price: priceNum,
        stock_allocated: stockNum,
      });
    }

    setSaving(true);
    try {
      const res = await FlashSaleService.updateSessionItems(
        session.flash_sale_id || session.id,
        payloadItems
      );

      if (res.status) {
        Alert.alert('Sukses', 'Produk pada sesi Flash Sale berhasil diperbarui!');
        setIsEditing(false);
        if (onSessionUpdated) onSessionUpdated();
        loadItems();
      } else {
        if (res.failure_list && res.failure_list.length > 0) {
          setRejections(res.failure_list);
          setRejectionGeneralReason(res.reason || 'Shopee menolak beberapa perubahan item.');
          setRejectionModalVisible(true);
        } else {
          Alert.alert('Gagal Memperbarui', res.reason || 'Terjadi kesalahan saat memperbarui sesi di Shopee.');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal menghubungi server.');
    } finally {
      setSaving(false);
    }
  };

  const isEditable = session?.status === 'active' || session?.status === 'draft';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.headerTitle}>Detail Sesi Flash Sale</Text>
            <Text style={styles.headerSubtitle}>
              ID Shopee: #{session?.flash_sale_id || session?.id || '-'}
            </Text>
          </View>
          {isEditable && (
            <TouchableOpacity
              style={styles.editToggleBtn}
              onPress={() => {
                if (isEditing) {
                  // Cancel edit mode
                  setIsEditing(false);
                  loadItems();
                } else {
                  setIsEditing(true);
                }
              }}
            >
              <Text style={styles.editToggleText}>
                {isEditing ? 'Batal' : 'Edit Harga'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Session Meta Card */}
        {session && (
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color="#EE4D2D" />
              <Text style={styles.metaTimeText}>
                {formatDateTime(session.start_time)} ~ {formatDateTime(session.end_time)}
              </Text>
            </View>
            <View style={styles.metaStatusRow}>
              <View
                style={[
                  styles.statusChip,
                  session.status === 'active'
                    ? styles.statusActive
                    : session.status === 'draft'
                    ? styles.statusDraft
                    : styles.statusEnded,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    session.status === 'active'
                      ? styles.statusTextActive
                      : session.status === 'draft'
                      ? styles.statusTextDraft
                      : styles.statusTextEnded,
                  ]}
                >
                  {session.status === 'active'
                    ? 'SEDANG BERJALAN'
                    : session.status === 'draft'
                    ? 'AKAN DATANG'
                    : 'TELAH BERAKHIR'}
                </Text>
              </View>
              <Text style={styles.metaItemCountText}>
                {items.length} Produk / Varian Terdaftar
              </Text>
            </View>
          </View>
        )}

        {/* Content Items List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#EE4D2D" />
            <Text style={styles.loadingText}>Memuat item sesi dari Shopee...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="pricetags-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Belum ada produk di sesi ini</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it, idx) => `${it.item_id || it.model_id}-${idx}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const key = String(item.item_id || item.model_id);
              const currentPrice = isEditing
                ? parseInt(editPriceMap[key] || '0', 10)
                : item.flash_price;
              const currentStock = isEditing
                ? parseInt(editStockMap[key] || '0', 10)
                : item.stock_allocated;

              const itemIdStr = String(item.item_id);
              const modelIdStr = item.model_id ? String(item.model_id) : '';
              const cat = (modelIdStr && lookupMap[modelIdStr]) || lookupMap[itemIdStr];

              const displayName =
                cat?.name ||
                item.item_name ||
                item.name ||
                item.product_name ||
                `Produk Shopee #${item.item_id}`;
              const displayImage = cat?.picture || item.image || item.picture;
              const displaySku = cat?.sku || item.sku || '';
              const effectiveHpp = item.hpp || cat?.hpp || 0;

              const discountPct = calculateDiscountPercent(item.original_price, currentPrice);
              const hppMargin = effectiveHpp ? calculateHppMargin(currentPrice, effectiveHpp) : null;
              const isBelowHpp = effectiveHpp > 0 && currentPrice < effectiveHpp;
              const isInvalidDiscount = discountPct < 5;

              return (
                <View style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    {displayImage ? (
                      <Image source={{ uri: displayImage }} style={styles.itemThumb} />
                    ) : (
                      <View style={styles.itemThumbPlaceholder}>
                        <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {displayName}
                      </Text>
                      {displaySku ? <Text style={styles.itemSku}>SKU: {displaySku}</Text> : null}
                      <Text style={styles.itemOriginalPrice}>
                        Harga Normal: Rp {(item.original_price || 0).toLocaleString('id-ID')}
                      </Text>
                      {effectiveHpp > 0 ? (
                        <Text style={styles.itemHppText}>
                          Modal (HPP): Rp {effectiveHpp.toLocaleString('id-ID')}
                        </Text>
                      ) : null}
                      {item.sold_count !== undefined ? (
                        <Text style={styles.soldCountText}>
                          Terjual: {item.sold_count} unit
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Pricing / Stock input or display */}
                  <View style={styles.configBox}>
                    <View style={styles.configInputsRow}>
                      <View style={styles.inputCol}>
                        <Text style={styles.inputLabel}>Harga Flash Sale</Text>
                        {isEditing ? (
                          <View style={styles.inputWrapper}>
                            <Text style={styles.prefixText}>Rp</Text>
                            <TextInput
                              style={styles.textInput}
                              keyboardType="numeric"
                              value={editPriceMap[key] || ''}
                              onChangeText={(val) => handlePriceChange(key, val)}
                            />
                          </View>
                        ) : (
                          <Text style={styles.readonlyPrice}>
                            Rp {(item.flash_price || 0).toLocaleString('id-ID')}
                          </Text>
                        )}
                      </View>

                      <View style={styles.inputCol}>
                        <Text style={styles.inputLabel}>Kuota Stok (1-350)</Text>
                        {isEditing ? (
                          <TextInput
                            style={[styles.textInput, { textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={editStockMap[key] || ''}
                            onChangeText={(val) => handleStockChange(key, val)}
                          />
                        ) : (
                          <Text style={styles.readonlyStock}>
                            {item.stock_allocated || 0} unit
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Warnings & Badges */}
                    <View style={styles.badgesContainer}>
                      <View
                        style={[
                          styles.discountBadge,
                          isInvalidDiscount && styles.discountBadgeInvalid,
                        ]}
                      >
                        <Text
                          style={[
                            styles.discountBadgeText,
                            isInvalidDiscount && styles.discountBadgeTextInvalid,
                          ]}
                        >
                          Diskon {discountPct}% {isInvalidDiscount ? '⚠️ Min. 5%' : ''}
                        </Text>
                      </View>

                      {isBelowHpp && (
                        <View style={styles.belowHppBadge}>
                          <Ionicons name="warning" size={12} color="#DC2626" />
                          <Text style={styles.belowHppText}>
                            Di bawah HPP ({hppMargin}%)
                          </Text>
                        </View>
                      )}

                      {!item.is_bound && (
                        <View style={styles.unboundBadge}>
                          <Text style={styles.unboundText}>Belum Binding HPP</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Bottom Save Bar when in Edit Mode */}
        {isEditing && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Simpan Perubahan ke Shopee</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Shopee Rejection Modal */}
        <ShopeeRejectionModal
          visible={rejectionModalVisible}
          onClose={() => setRejectionModalVisible(false)}
          failures={rejections}
          generalReason={rejectionGeneralReason}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  editToggleBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editToggleText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  metaCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaTimeText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  metaStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#DEF7EC',
  },
  statusDraft: {
    backgroundColor: '#FEF08A',
  },
  statusEnded: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#03543F',
  },
  statusTextDraft: {
    color: '#713F12',
  },
  statusTextEnded: {
    color: '#4B5563',
  },
  metaItemCountText: {
    fontSize: 12,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
  },
  itemThumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  itemThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemSku: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  itemOriginalPrice: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  itemHppText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  soldCountText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  configBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  configInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 36,
  },
  prefixText: {
    fontSize: 11,
    color: '#6B7280',
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    padding: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    height: 36,
    paddingHorizontal: 8,
  },
  readonlyPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EE4D2D',
    marginTop: 4,
  },
  readonlyStock: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 4,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  discountBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeInvalid: {
    backgroundColor: '#FEE2E2',
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#03543F',
  },
  discountBadgeTextInvalid: {
    color: '#DC2626',
  },
  belowHppBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  belowHppText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
  },
  unboundBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unboundText: {
    fontSize: 10,
    color: '#92400E',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
  },
  saveBtn: {
    backgroundColor: '#EE4D2D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
