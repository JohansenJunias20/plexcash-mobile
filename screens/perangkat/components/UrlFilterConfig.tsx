import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UrlFilterConfig as UrlFilterConfigType } from '../../../types/perangkat';
import AddUrlModal from './AddUrlModal';

interface UrlFilterConfigProps {
  config: UrlFilterConfigType | null;
  onChange: (config: UrlFilterConfigType) => void;
}

export default function UrlFilterConfig({ config, onChange }: UrlFilterConfigProps): JSX.Element {
  const [showAddModal, setShowAddModal] = useState(false);

  if (!config) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading configuration...</Text>
      </View>
    );
  }

  const handleModeChange = (mode: 'BLACKLIST' | 'WHITELIST') => {
    onChange({
      ...config,
      filter_mode: mode,
    });
  };

  const handleEnabledChange = (enabled: boolean) => {
    onChange({
      ...config,
      is_enabled: enabled,
    });
  };

  const handleAddUrl = (url: string) => {
    // Check for duplicates
    if (config.url_list.includes(url)) {
      Alert.alert('Duplicate', 'This URL pattern already exists');
      return;
    }

    onChange({
      ...config,
      url_list: [...config.url_list, url],
    });
  };

  const handleRemoveUrl = (url: string) => {
    Alert.alert(
      'Remove URL',
      `Remove ${url} from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onChange({
              ...config,
              url_list: config.url_list.filter(u => u !== url),
            });
          }
        }
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Filter Mode</Text>
        
        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => handleModeChange('WHITELIST')}
        >
          <View style={styles.radioButton}>
            {config.filter_mode === 'WHITELIST' && <View style={styles.radioButtonInner} />}
          </View>
          <View style={styles.radioLabel}>
            <Text style={styles.radioText}>Whitelist (Allow only listed URLs)</Text>
            <Text style={styles.radioSubtext}>Block all except URLs in the list</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => handleModeChange('BLACKLIST')}
        >
          <View style={styles.radioButton}>
            {config.filter_mode === 'BLACKLIST' && <View style={styles.radioButtonInner} />}
          </View>
          <View style={styles.radioLabel}>
            <Text style={styles.radioText}>Blacklist (Block listed URLs)</Text>
            <Text style={styles.radioSubtext}>Allow all except URLs in the list</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>Enable Filter</Text>
          <Switch
            value={config.is_enabled}
            onValueChange={handleEnabledChange}
            trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            URL List ({config.url_list.length})
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="#fbbf24" />
            <Text style={styles.addButtonText}>Add URL</Text>
          </TouchableOpacity>
        </View>

        {config.url_list.length === 0 ? (
          <View style={styles.emptyList}>
            <Ionicons name="link-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No URLs added yet</Text>
            <Text style={styles.emptySubtext}>Tap "Add URL" to get started</Text>
          </View>
        ) : (
          <FlatList
            data={config.url_list}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.urlItem}>
                <Ionicons name="link-outline" size={20} color="#6b7280" />
                <Text style={styles.urlText}>{item}</Text>
                <TouchableOpacity onPress={() => handleRemoveUrl(item)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
            style={styles.urlList}
          />
        )}
      </View>

      {config.last_updated && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {formatDate(config.last_updated)}
          </Text>
          {config.updated_by && (
            <Text style={styles.footerText}>By: {config.updated_by}</Text>
          )}
        </View>
      )}

      <AddUrlModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddUrl}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fbbf24',
  },
  radioLabel: {
    flex: 1,
  },
  radioText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  radioSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fbbf24',
    marginLeft: 6,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  urlList: {
    maxHeight: 300,
  },
  urlItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  urlText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 12,
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
});
