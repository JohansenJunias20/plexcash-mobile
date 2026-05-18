import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';

interface IVariant {
  id: number | string;
  nama: string;
  sku: string;
  stok: number;
  harga_jual: number;
}

interface IDefaultBarang {
  id: number | string;
  nama: string;
  sku: string;
  harga_jual: number;
  stok: number;
  imageUrl?: string;
  binded?: boolean;
  status_import?: 'waiting' | 'processing' | 'completed' | 'error';
  row_type?: string;
  variantCount?: number;
}

interface ProductCardProps {
  item: IDefaultBarang;
  isSelected: boolean;
  onToggleSelection: (id: number | string) => void;
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({
  item,
  isSelected,
  onToggleSelection,
}) => {
  const [variantExpanded, setVariantExpanded] = useState(false);
  const [variants, setVariants] = useState<IVariant[]>([]);
  const [variantLoading, setVariantLoading] = useState(false);

  // row_type === 'VAR_PARENT' is set by server for variant parents.
  // Also check id prefix 'v-' as fallback (legacy format).
  const isVarParent = item.row_type === 'VAR_PARENT' || String(item.id).startsWith('v-');
  const hasVariant = isVarParent && (item.variantCount ?? 0) > 0;

  const handleToggleVariant = useCallback(async (e: any) => {
    // Prevent card selection when tapping variant badge
    if (!variantExpanded && variants.length === 0) {
      setVariantLoading(true);
      try {
        // item.id format for VAR_PARENT is 'v-123', extract numeric ID
        const numericId = String(item.id).replace('v-', '');
        const response = await ApiService.get(`/get/import_barang/variants?parent_id=${numericId}`);
        if (response.data && Array.isArray(response.data)) {
          // Deduplicate by id — JOINs in the query can produce duplicate rows
          const seen = new Set<string>();
          const unique = response.data.filter((v: any) => {
            const key = String(v.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setVariants(unique);
        }
      } catch (err) {
        console.error('Failed to load variants:', err);
      } finally {
        setVariantLoading(false);
      }
    }
    setVariantExpanded(prev => !prev);
  }, [variantExpanded, variants.length, item.id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'bound':
        return <Ionicons name="checkmark-circle" size={20} color="#10b981" />;
      case 'pending':
        return <Ionicons name="time" size={20} color="#fbbf24" />;
      case 'waiting':
        return <Ionicons name="hourglass" size={20} color="#6b7280" />;
      case 'processing':
        return <Ionicons name="sync" size={20} color="#3b82f6" />;
      case 'completed':
        return <Ionicons name="checkmark-done" size={20} color="#10b981" />;
      case 'error':
        return <Ionicons name="alert-circle" size={20} color="#ef4444" />;
      default:
        return <Ionicons name="ellipse-outline" size={20} color="#9ca3af" />;
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'bound':
        return 'Terikat';
      case 'unbound':
        return 'Belum Terikat';
      case 'pending':
        return 'Menunggu';
      case 'waiting':
        return 'Menunggu';
      case 'processing':
        return 'Diproses';
      case 'completed':
        return 'Selesai';
      case 'error':
        return 'Error';
      default:
        return '-';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={() => onToggleSelection(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggleSelection(item.id)}
        >
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? '#fbbf24' : '#9ca3af'}
          />
        </TouchableOpacity>

        {/* Product Image */}
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={32} color="#9ca3af" />
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.nama}
          </Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SKU:</Text>
            <Text style={styles.detailValue}>{item.sku || '-'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stok:</Text>
            <Text style={styles.detailValue}>{item.stok || 0}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(item.harga_jual || 0)}</Text>
            {item.binded ? getStatusIcon('bound') : getStatusIcon('unbound')}
          </View>

          {/* Variant Badge */}
          {hasVariant && (
            <TouchableOpacity
              style={styles.variantBadge}
              onPress={handleToggleVariant}
              activeOpacity={0.7}
            >
              <Ionicons
                name="layers-outline"
                size={13}
                color="#2563eb"
              />
              <Text style={styles.variantBadgeText}>
                {item.variantCount} Varian
              </Text>
              {variantLoading ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ marginLeft: 4 }} />
              ) : (
                <Ionicons
                  name={variantExpanded ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color="#2563eb"
                />
              )}
            </TouchableOpacity>
          )}

          {item.status_import && (
            <View style={styles.statusRow}>
              {getStatusIcon(item.status_import)}
              <Text style={styles.statusText}>{getStatusText(item.status_import)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Variant Expanded List */}
      {hasVariant && variantExpanded && (
        <View style={styles.variantContainer}>
          {variantLoading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ padding: 8 }} />
          ) : variants.length === 0 ? (
            <Text style={styles.variantEmptyText}>Tidak ada data varian</Text>
          ) : (
            variants.map((v, idx) => (
              <View
                key={String(v.id)}
                style={[
                  styles.variantItem,
                  idx < variants.length - 1 && styles.variantItemBorder,
                ]}
              >
                <View style={styles.variantRow}>
                  <Text style={styles.variantName} numberOfLines={1}>{v.nama}</Text>
                  <Text style={styles.variantStock}>Stok: {v.stok ?? 0}</Text>
                </View>
                <View style={styles.variantRow}>
                  <Text style={styles.variantSku}>SKU: {v.sku || '-'}</Text>
                  <Text style={styles.variantPrice}>{formatPrice(v.harga_jual || 0)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSelected: {
    borderColor: '#fbbf24',
    backgroundColor: '#fef3c7',
  },
  cardContent: {
    flexDirection: 'row',
    gap: 12,
  },
  checkbox: {
    padding: 4,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#1f2937',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fbbf24',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    color: '#6b7280',
  },
  variantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  variantBadgeText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
  },
  variantContainer: {
    marginTop: 10,
    marginHorizontal: 4,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  variantItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  variantItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#c7d2fe',
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantName: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  variantSku: {
    fontSize: 11,
    color: '#6b7280',
    flex: 1,
  },
  variantStock: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '500',
  },
  variantPrice: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
  },
  variantEmptyText: {
    fontSize: 12,
    color: '#6b7280',
    padding: 10,
    textAlign: 'center',
  },
});

export default ProductCard;

