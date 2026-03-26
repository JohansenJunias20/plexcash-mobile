import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBind: () => void;
  onMigrate: () => void;
}

const SelectionBar: React.FC<SelectionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBind,
  onMigrate,
}) => {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <TouchableOpacity onPress={onSelectAll} style={styles.selectAllButton}>
          <Ionicons
            name={isAllSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color="#fbbf24"
          />
        </TouchableOpacity>
        <Text style={styles.countText}>
          {selectedCount} dipilih
        </Text>
        {selectedCount > 0 && (
          <TouchableOpacity onPress={onClearSelection} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity
          style={[styles.actionButton, styles.bindButton]}
          onPress={onBind}
          disabled={selectedCount === 0}
        >
          <Ionicons name="link-outline" size={18} color="#ffffff" />
          <Text style={styles.actionButtonText}>Bind</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.migrateButton]}
          onPress={onMigrate}
          disabled={selectedCount === 0}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color="#ffffff" />
          <Text style={styles.actionButtonText}>Migrate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fbbf24',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectAllButton: {
    padding: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  clearButton: {
    padding: 4,
  },
  rightSection: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  bindButton: {
    backgroundColor: '#3b82f6',
  },
  migrateButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default SelectionBar;

