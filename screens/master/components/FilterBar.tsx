import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type BindedFilter = 'all' | 'bound' | 'unbound';

const BINDED_OPTIONS: { value: BindedFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'bound', label: 'Sudah Bind' },
  { value: 'unbound', label: 'Belum Bind' },
];

interface FilterBarProps {
  skuFilter: string;
  nameFilter: string;
  bindedFilter: BindedFilter;
  onSkuFilterChange: (value: string) => void;
  onNameFilterChange: (value: string) => void;
  onBindedFilterChange: (value: BindedFilter) => void;
  onClearFilters: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  skuFilter,
  nameFilter,
  bindedFilter,
  onSkuFilterChange,
  onNameFilterChange,
  onBindedFilterChange,
  onClearFilters,
}) => {
  const [localSkuFilter, setLocalSkuFilter] = useState(skuFilter);
  const [localNameFilter, setLocalNameFilter] = useState(nameFilter);

  // Debounce SKU filter
  useEffect(() => {
    const timer = setTimeout(() => {
      onSkuFilterChange(localSkuFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSkuFilter]);

  // Debounce name filter
  useEffect(() => {
    const timer = setTimeout(() => {
      onNameFilterChange(localNameFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [localNameFilter]);

  // Sync with parent state
  useEffect(() => {
    setLocalSkuFilter(skuFilter);
  }, [skuFilter]);

  useEffect(() => {
    setLocalNameFilter(nameFilter);
  }, [nameFilter]);

  const hasFilters = skuFilter || nameFilter || bindedFilter !== 'all';

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {/* SKU Filter */}
        <View style={styles.inputContainer}>
          <Ionicons name="barcode-outline" size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Filter SKU..."
            value={localSkuFilter}
            onChangeText={setLocalSkuFilter}
            placeholderTextColor="#9ca3af"
          />
          {localSkuFilter ? (
            <TouchableOpacity onPress={() => setLocalSkuFilter('')} style={styles.clearIcon}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Name Filter */}
        <View style={styles.inputContainer}>
          <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Filter Nama..."
            value={localNameFilter}
            onChangeText={setLocalNameFilter}
            placeholderTextColor="#9ca3af"
          />
          {localNameFilter ? (
            <TouchableOpacity onPress={() => setLocalNameFilter('')} style={styles.clearIcon}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Bound Filter */}
      <View style={styles.chipRow}>
        <Text style={styles.chipLabel}>Bound:</Text>
        {BINDED_OPTIONS.map(opt => {
          const active = bindedFilter === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onBindedFilterChange(opt.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Clear All Button */}
      {hasFilters && (
        <TouchableOpacity style={styles.clearButton} onPress={onClearFilters}>
          <Ionicons name="close-outline" size={16} color="#ef4444" />
          <Text style={styles.clearButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  chipText: {
    fontSize: 13,
    color: '#4b5563',
  },
  chipTextActive: {
    fontWeight: '600',
    color: '#92400e',
  },
  clearIcon: {
    padding: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
});

export default FilterBar;

