import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type DateTimePickerProps = React.ComponentProps<typeof DateTimePicker>;

export type { DateTimePickerEvent };

const TITLES: Record<string, string> = {
  date: 'Pilih Tanggal',
  time: 'Pilih Jam',
  datetime: 'Pilih Tanggal & Jam',
};

/**
 * Pengganti drop-in untuk DateTimePicker bawaan.
 *
 * - Android: perilaku native (dialog) tidak berubah.
 * - iOS: `display="default"` merender kontrol compact inline yang merusak layout
 *   (pil tanggal muncul di tengah form), jadi picker ditampilkan sebagai bottom sheet
 *   berisi spinner dengan tombol Batal/Selesai. `onChange` baru dipanggil saat Selesai
 *   (event.type 'set') atau Batal (event.type 'dismissed'), jadi pemilihan tidak memicu
 *   refetch/validasi di setiap putaran spinner.
 *
 * Gunakan seperti DateTimePicker biasa dan render secara kondisional ({show && <... />}),
 * lalu tutup (setShow(false)) di handler onChange pada semua platform.
 */
export default function AppDateTimePicker(props: DateTimePickerProps) {
  if (Platform.OS !== 'ios') {
    return <DateTimePicker {...props} />;
  }
  return <IosSheetPicker {...props} />;
}

function IosSheetPicker(props: DateTimePickerProps) {
  const { value, mode = 'date', onChange, display: _display, style: _style, ...rest } = props as any;
  const [temp, setTemp] = useState<Date>(value || new Date());

  const finish = (type: 'set' | 'dismissed') => {
    const date = type === 'set' ? temp : undefined;
    onChange?.(
      { type, nativeEvent: { timestamp: (date || temp).getTime(), utcOffset: 0 } } as DateTimePickerEvent,
      date
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => finish('dismissed')}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => finish('dismissed')} hitSlop={8}>
              <Text style={styles.cancel}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{TITLES[mode] || TITLES.date}</Text>
            <TouchableOpacity onPress={() => finish('set')} hitSlop={8}>
              <Text style={styles.done}>Selesai</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            {...rest}
            value={temp}
            mode={mode}
            display="spinner"
            themeVariant="light"
            onChange={(_e: DateTimePickerEvent, d?: Date) => d && setTemp(d)}
            style={styles.picker}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#ffffff',
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
  done: { fontSize: 15, fontWeight: '600', color: '#059669' },
  picker: { alignSelf: 'center' },
});
