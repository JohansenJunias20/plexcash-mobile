import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IDefaultBarang {
  id: number | string;
  nama: string;
  sku: string;
  harga_jual: number;
  stok: number;
  imageUrl?: string;
  binded?: boolean;
  status_import?: 'waiting' | 'processing' | 'completed' | 'error';
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

          {item.status_import && (
            <View style={styles.statusRow}>
              {getStatusIcon(item.status_import)}
              <Text style={styles.statusText}>{getStatusText(item.status_import)}</Text>
            </View>
          )}
        </View>
      </View>
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
});

export default ProductCard;

