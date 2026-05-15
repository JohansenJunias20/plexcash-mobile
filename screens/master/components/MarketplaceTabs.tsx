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
  id: number;
  platform: string;
  name?: string;
  shop_id: string;
  status?: string;
  status_import?: 'idle' | 'importing' | 'completed' | 'error';
  import_progress?: number;
  import_total?: number;
}

interface MarketplaceStatus {
  import_status: 'idle' | 'in_progress' | 'completed' | 'failed';
  progress?: {
    processed: number;
    total: number;
  };
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
      case 'in_progress':
        return <ActivityIndicator size="small" color="#fbbf24" />;
      case 'completed':
        return <Ionicons name="checkmark-circle" size={16} color="#10b981" />;
      case 'failed':
        return <Ionicons name="alert-circle" size={16} color="#ef4444" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'in_progress':
        return '#fbbf24';
      case 'completed':
        return '#10b981';
      case 'failed':
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
          const status = marketplaceStatus.get(marketplace.id);
          const statusColor = getStatusColor(status?.import_status);

          return (
            <TouchableOpacity
              key={marketplace.id}
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
                    {marketplace.platform}
                  </Text>
                  {status && getStatusIcon(status.import_status)}
                </View>
                <Text style={[styles.tabSubtitle, isActive && styles.tabSubtitleActive]}>
                  {marketplace.name || marketplace.shop_id}
                </Text>
                {status && status.import_status === 'in_progress' && status.progress && status.progress.total > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${(status.progress.processed / status.progress.total) * 100}%`,
                            backgroundColor: statusColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {status.progress.processed}/{status.progress.total}
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

