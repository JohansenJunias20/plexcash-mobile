import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Marketplace {
  id_ecommerce: number;
  nama_ecommerce: string;
  nama_toko: string;
  status_import?: 'idle' | 'importing' | 'completed' | 'error';
  import_progress?: number;
  import_total?: number;
}

interface MarketplaceStatus {
  id_ecommerce: number;
  status: 'idle' | 'importing' | 'completed' | 'error';
  progress: number;
  total: number;
  message?: string;
}

interface MarketplaceTabsProps {
  marketplaces: Marketplace[];
  currentIndex: number;
  onSelectMarketplace: (index: number) => void;
  marketplaceStatus: Map<number, MarketplaceStatus>;
}

const MarketplaceTabs: React.FC<MarketplaceTabsProps> = ({
  marketplaces,
  currentIndex,
  onSelectMarketplace,
  marketplaceStatus,
}) => {
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'importing':
        return <ActivityIndicator size="small" color="#fbbf24" />;
      case 'completed':
        return <Ionicons name="checkmark-circle" size={16} color="#10b981" />;
      case 'error':
        return <Ionicons name="alert-circle" size={16} color="#ef4444" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'importing':
        return '#fbbf24';
      case 'completed':
        return '#10b981';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (marketplaces.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Tidak ada marketplace tersedia</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {marketplaces.map((marketplace, index) => {
          const isActive = index === currentIndex;
          const status = marketplaceStatus.get(marketplace.id_ecommerce);
          const statusColor = getStatusColor(status?.status);

          return (
            <TouchableOpacity
              key={marketplace.id_ecommerce}
              style={[
                styles.tab,
                isActive && styles.tabActive,
                { borderBottomColor: isActive ? '#fbbf24' : 'transparent' },
              ]}
              onPress={() => onSelectMarketplace(index)}
            >
              <View style={styles.tabContent}>
                <View style={styles.tabHeader}>
                  <Text style={[styles.tabTitle, isActive && styles.tabTitleActive]}>
                    {marketplace.nama_ecommerce}
                  </Text>
                  {status && getStatusIcon(status.status)}
                </View>
                <Text style={[styles.tabSubtitle, isActive && styles.tabSubtitleActive]}>
                  {marketplace.nama_toko}
                </Text>
                {status && status.status === 'importing' && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${(status.progress / status.total) * 100}%`,
                            backgroundColor: statusColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {status.progress}/{status.total}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  emptyContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderBottomWidth: 3,
    minWidth: 150,
  },
  tabActive: {
    backgroundColor: '#fef3c7',
  },
  tabContent: {
    gap: 4,
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTitleActive: {
    color: '#1f2937',
  },
  tabSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  tabSubtitleActive: {
    color: '#6b7280',
  },
  progressContainer: {
    marginTop: 4,
    gap: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#6b7280',
  },
});

export default MarketplaceTabs;

