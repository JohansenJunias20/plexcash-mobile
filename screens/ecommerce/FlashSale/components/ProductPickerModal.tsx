import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FlashSaleService,
  IFlashSaleProductItem,
  IProductCategory,
} from '../../../../services/ecommerce/flashSaleService';

interface ProductPickerModalProps {
  visible: boolean;
  onClose: () => void;
  idEcommerce: number;
  onSelectProducts: (selectedProducts: IFlashSaleProductItem[]) => void;
  alreadySelectedIds?: (string | number)[];
}

export default function ProductPickerModal({
  visible,
  onClose,
  idEcommerce,
  onSelectProducts,
  alreadySelectedIds = [],
}: ProductPickerModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<IFlashSaleProductItem[]>([]);
  const [categories, setCategories] = useState<IProductCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item IDs (could be parent item_id or variant model_id)
  const [selectedMap, setSelectedMap] = useState<Record<string, IFlashSaleProductItem>>({});
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible && idEcommerce) {
      loadProducts();
      // Initialize pre-selected items map
      const initialMap: Record<string, any> = {};
      alreadySelectedIds.forEach((id) => {
        initialMap[String(id)] = true;
      });
    }
  }, [visible, idEcommerce]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await FlashSaleService.getProductsWithPrice(idEcommerce);
      if (res.status) {
        setProducts(res.data);
        setCategories(res.categories || []);
      }
    } catch (err) {
      console.error('[ProductPickerModal] Load products error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Category filter
      if (selectedCategoryId !== null && prod.category_id !== selectedCategoryId) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (prod.name || '').toLowerCase().includes(q);
        const matchSku = (prod.sku || '').toLowerCase().includes(q);
        const matchModel =
          prod.models &&
          prod.models.some(
            (m) =>
              (m.name || '').toLowerCase().includes(q) ||
              (m.sku || '').toLowerCase().includes(q)
          );
        return matchName || matchSku || matchModel;
      }
      return true;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Toggle variant selection
  const toggleVariant = (parent: IFlashSaleProductItem, variant: IFlashSaleProductItem) => {
    const key = String(variant.item_id);
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          ...variant,
          parent_id: parent.item_id,
          isVariant: true,
          picture: variant.picture || parent.picture,
        };
      }
      return next;
    });
  };

  // Toggle parent selection (selects or deselects all its variants)
  const toggleParent = (parent: IFlashSaleProductItem) => {
    const hasVariants = parent.models && parent.models.length > 0;
    if (hasVariants && parent.models) {
      const allSelected = parent.models.every((m) => !!selectedMap[String(m.item_id)]);
      setSelectedMap((prev) => {
        const next = { ...prev };
        if (allSelected) {
          // Deselect all
          parent.models!.forEach((m) => {
            delete next[String(m.item_id)];
          });
        } else {
          // Select all
          parent.models!.forEach((m) => {
            next[String(m.item_id)] = {
              ...m,
              parent_id: parent.item_id,
              isVariant: true,
              picture: m.picture || parent.picture,
            };
          });
        }
        return next;
      });
    } else {
      // Standalone product
      const key = String(parent.item_id);
      setSelectedMap((prev) => {
        const next = { ...prev };
        if (next[key]) {
          delete next[key];
        } else {
          next[key] = { ...parent, isVariant: false };
        }
        return next;
      });
    }
  };

  const toggleExpand = (parentId: string | number) => {
    const key = String(parentId);
    setExpandedParents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmSelection = () => {
    const selectedList = Object.values(selectedMap);
    onSelectProducts(selectedList);
    onClose();
  };

  const totalSelectedCount = Object.keys(selectedMap).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pilih Produk Flash Sale</Text>
          <TouchableOpacity onPress={handleConfirmSelection} disabled={totalSelectedCount === 0}>
            <Text
              style={[
                styles.confirmHeaderBtn,
                totalSelectedCount === 0 && styles.confirmHeaderBtnDisabled,
              ]}
            >
              Pilih ({totalSelectedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama produk atau SKU..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Pills */}
        {categories.length > 0 && (
          <View style={styles.categoryBar}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: -1, name: 'Semua Kategori' }, ...categories]}
              keyExtractor={(cat) => String(cat.id)}
              renderItem={({ item }) => {
                const isSelected =
                  item.id === -1 ? selectedCategoryId === null : selectedCategoryId === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                    onPress={() => setSelectedCategoryId(item.id === -1 ? null : item.id)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        )}

        {/* Product List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#EE4D2D" />
            <Text style={styles.loadingText}>Memuat produk toko...</Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Tidak ada produk ditemukan</Text>
            <Text style={styles.emptySubtitle}>
              Coba gunakan kata kunci lain atau pilih kategori berbeda.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => String(item.item_id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const hasVariants = item.models && item.models.length > 0;
              const isExpanded = !!expandedParents[String(item.item_id)];

              // Calculate checkbox state
              let isChecked = false;
              let isIndeterminate = false;

              if (hasVariants && item.models) {
                const selectedCount = item.models.filter(
                  (m) => !!selectedMap[String(m.item_id)]
                ).length;
                if (selectedCount === item.models.length) {
                  isChecked = true;
                } else if (selectedCount > 0) {
                  isIndeterminate = true;
                }
              } else {
                isChecked = !!selectedMap[String(item.item_id)];
              }

              return (
                <View style={styles.productCard}>
                  {/* Parent row */}
                  <View style={styles.parentRow}>
                    <TouchableOpacity
                      onPress={() => toggleParent(item)}
                      style={styles.checkboxContainer}
                    >
                      {isChecked ? (
                        <Ionicons name="checkmark-circle" size={22} color="#EE4D2D" />
                      ) : isIndeterminate ? (
                        <Ionicons name="remove-circle" size={22} color="#EE4D2D" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color="#D1D5DB" />
                      )}
                    </TouchableOpacity>

                    {item.picture || item.image || (item.images && item.images[0]) ? (
                      <Image
                        source={{
                          uri: item.picture || item.image || (item.images && item.images[0]),
                        }}
                        style={styles.productThumb}
                      />
                    ) : (
                      <View style={styles.productPlaceholder}>
                        <Ionicons name="image-outline" size={18} color="#9CA3AF" />
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.parentInfo}
                      onPress={() => (hasVariants ? toggleExpand(item.item_id) : toggleParent(item))}
                    >
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <View style={styles.productMetaRow}>
                        <Text style={styles.productPrice}>
                          Rp {(item.price || item.current_price || 0).toLocaleString('id-ID')}
                        </Text>
                        <Text style={styles.productStock}>Stok: {item.stock || 0}</Text>
                      </View>
                      <View style={styles.badgeRow}>
                        {item.is_bound ? (
                          <View style={styles.boundBadge}>
                            <Text style={styles.boundBadgeText}>
                              HPP: Rp {(item.hpp || 0).toLocaleString('id-ID')}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.unboundBadge}>
                            <Text style={styles.unboundBadgeText}>Belum Binding HPP</Text>
                          </View>
                        )}
                        {hasVariants && (
                          <View style={styles.variantCountBadge}>
                            <Text style={styles.variantCountText}>
                              {item.models!.length} Varian
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {hasVariants && (
                      <TouchableOpacity
                        onPress={() => toggleExpand(item.item_id)}
                        style={styles.expandBtn}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Variants sub-list */}
                  {hasVariants && isExpanded && (
                    <View style={styles.variantsList}>
                      {item.models!.map((variant) => {
                        const isVarSelected = !!selectedMap[String(variant.item_id)];
                        return (
                          <TouchableOpacity
                            key={String(variant.item_id)}
                            style={styles.variantRow}
                            onPress={() => toggleVariant(item, variant)}
                          >
                            <View style={styles.checkboxContainer}>
                              {isVarSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color="#EE4D2D" />
                              ) : (
                                <Ionicons name="ellipse-outline" size={20} color="#D1D5DB" />
                              )}
                            </View>
                            <View style={styles.variantInfo}>
                              <Text style={styles.variantName}>{variant.name}</Text>
                              {variant.sku ? (
                                <Text style={styles.variantSku}>SKU: {variant.sku}</Text>
                              ) : null}
                              <View style={styles.variantMetaRow}>
                                <Text style={styles.variantPrice}>
                                  Rp {(variant.price || 0).toLocaleString('id-ID')}
                                </Text>
                                <Text style={styles.variantStock}>Stok: {variant.stock || 0}</Text>
                                {variant.is_bound && variant.hpp ? (
                                  <Text style={styles.variantHpp}>
                                    HPP: Rp {variant.hpp.toLocaleString('id-ID')}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}

        {/* Bottom Floating Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomTextCol}>
            <Text style={styles.selectedCountText}>
              {totalSelectedCount} varian / produk terpilih
            </Text>
            <Text style={styles.selectedSubtext}>Siap dikonfigurasi harga promo & stok</Text>
          </View>
          <TouchableOpacity
            style={[styles.bottomActionBtn, totalSelectedCount === 0 && styles.bottomActionDisabled]}
            disabled={totalSelectedCount === 0}
            onPress={handleConfirmSelection}
          >
            <Text style={styles.bottomActionText}>Tambahkan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  confirmHeaderBtn: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EE4D2D',
  },
  confirmHeaderBtnDisabled: {
    color: '#D1D5DB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    paddingVertical: 0,
  },
  categoryBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: '#DC2626',
    fontWeight: '600',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  checkboxContainer: {
    paddingRight: 8,
  },
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  productPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  parentInfo: {
    flex: 1,
    marginLeft: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EE4D2D',
    marginRight: 10,
  },
  productStock: {
    fontSize: 11,
    color: '#6B7280',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  boundBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  boundBadgeText: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  unboundBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unboundBadgeText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '500',
  },
  variantCountBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  variantCountText: {
    fontSize: 10,
    color: '#4B5563',
  },
  expandBtn: {
    padding: 6,
  },
  variantsList: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingLeft: 24,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  variantInfo: {
    flex: 1,
    marginLeft: 8,
  },
  variantName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  variantSku: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  variantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  variantPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EE4D2D',
  },
  variantStock: {
    fontSize: 11,
    color: '#6B7280',
  },
  variantHpp: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bottomTextCol: {
    flex: 1,
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  selectedSubtext: {
    fontSize: 11,
    color: '#6B7280',
  },
  bottomActionBtn: {
    backgroundColor: '#EE4D2D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bottomActionDisabled: {
    backgroundColor: '#D1D5DB',
  },
  bottomActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
