import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UsbProtectionConfig as UsbProtectionConfigType } from '../../../types/perangkat';

interface UsbProtectionConfigProps {
  config: UsbProtectionConfigType | null;
  onChange: (config: UsbProtectionConfigType) => void;
}

export default function UsbProtectionConfig({ config, onChange }: UsbProtectionConfigProps): JSX.Element {
  if (!config) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading configuration...</Text>
      </View>
    );
  }

  const handleToggle = (enabled: boolean) => {
    onChange({
      ...config,
      is_protection_enabled: enabled,
    });
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
      <View style={styles.header}>
        <Ionicons name="lock-closed" size={48} color="#fbbf24" />
        <Text style={styles.title}>USB Protection</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchText}>Block USB storage devices</Text>
            <Text style={styles.switchSubtext}>
              Prevent unauthorized data transfer via USB drives
            </Text>
          </View>
          <Switch
            value={config.is_protection_enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle" size={24} color="#3b82f6" />
          <Text style={styles.infoTitle}>How it works</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          <Text style={styles.infoText}>3-layer protection system</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="flash" size={20} color="#10b981" />
          <Text style={styles.infoText}>Real-time enforcement</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={styles.infoText}>Doesn't block USB keyboard/mouse</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="key" size={20} color="#10b981" />
          <Text style={styles.infoText}>Requires admin rights on device</Text>
        </View>
      </View>

      <View style={styles.warningSection}>
        <View style={styles.warningHeader}>
          <Ionicons name="warning" size={20} color="#f59e0b" />
          <Text style={styles.warningTitle}>Important Notes</Text>
        </View>
        <Text style={styles.warningText}>
          • Changes take effect immediately on the device{'\n'}
          • Device must be online to receive updates{'\n'}
          • User may need to restart applications{'\n'}
          • Some USB devices may require whitelisting
        </Text>
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
  header: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  switchSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoSection: {
    backgroundColor: '#eff6ff',
    padding: 16,
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    marginLeft: 12,
  },
  warningSection: {
    backgroundColor: '#fffbeb',
    padding: 16,
    marginBottom: 12,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
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

