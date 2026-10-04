import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

interface AppPickerProps {
  selectedValue?: any;
  onValueChange?: (value: any, index: number) => void;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

interface Option {
  label: string;
  value: any;
}

const SEARCH_THRESHOLD = 10;

/**
 * Pengganti drop-in untuk <Picker> dari @react-native-picker/picker.
 *
 * - Android: Picker native (dropdown) seperti biasa.
 * - iOS: Picker native merender roda (wheel) setinggi ~216pt yang terpotong oleh kotak
 *   setinggi 44pt, sehingga terlihat seperti textbox yang tidak merespons saat ditekan.
 *   Di sini iOS menampilkan kotak yang bisa ditekan lalu membuka bottom sheet berisi daftar
 *   pilihan (dengan kolom cari bila pilihan banyak).
 *
 * Pakai <AppPicker.Item label value /> sebagai anak, sama seperti Picker.Item.
 */
function AppPicker(props: AppPickerProps) {
  if (Platform.OS !== 'ios') {
    return <Picker {...(props as any)} />;
  }
  return <IosPicker {...props} />;
}

AppPicker.Item = Picker.Item;

function IosPicker({ selectedValue, onValueChange, enabled = true, style, children }: AppPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options: Option[] = useMemo(
    () =>
      React.Children.toArray(children)
        .filter((c): c is React.ReactElement<any> => React.isValidElement(c))
        .map((c) => ({ label: String(c.props.label ?? ''), value: c.props.value })),
    [children]
  );

  const selected = options.find((o) => o.value === selectedValue);
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={!enabled}
        onPress={() => setOpen(true)}
        style={[styles.field, style, !enabled && styles.fieldDisabled]}
      >
        <Text style={styles.fieldText} numberOfLines={1}>
          {selected ? selected.label : ''}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Pilih</Text>
              <TouchableOpacity onPress={close} hitSlop={8}>
                <Text style={styles.cancel}>Tutup</Text>
              </TouchableOpacity>
            </View>

            {options.length > SEARCH_THRESHOLD && (
              <TextInput
                style={styles.search}
                placeholder="Cari..."
                placeholderTextColor="#9ca3af"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
            )}

            <FlatList
              data={filtered}
              keyExtractor={(o, i) => `${String(o.value)}-${i}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === selectedValue;
                return (
                  <TouchableOpacity
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => {
                      onValueChange?.(item.value, options.indexOf(item));
                      close();
                    }}
                  >
                    <Text style={[styles.rowText, active && styles.rowTextActive]}>{item.label}</Text>
                    {active && <Ionicons name="checkmark" size={18} color="#059669" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>Tidak ada pilihan</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { flex: 1, fontSize: 14, color: '#111827', marginRight: 8 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cancel: { fontSize: 15, color: '#6b7280' },
  search: {
    margin: 12,
    marginBottom: 4,
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowActive: { backgroundColor: '#ecfdf5' },
  rowText: { flex: 1, fontSize: 15, color: '#1f2937', marginRight: 8 },
  rowTextActive: { color: '#059669', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 24 },
});

export default AppPicker;
