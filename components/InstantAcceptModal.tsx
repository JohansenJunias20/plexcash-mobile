import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

interface Props {
  visible: boolean;
  orderCount: number;
  loading: boolean;
  onClose: () => void;
  onSelectNow: () => void;
  onSelectDelay: (delayMinutes: number) => void;
}

export default function InstantAcceptModal({
  visible,
  orderCount,
  loading,
  onClose,
  onSelectNow,
  onSelectDelay,
}: Props) {
  const [selectedOption, setSelectedOption] = useState<'now' | 15 | 30 | 60>('now');

  const options: Array<{
    key: 'now' | 15 | 30 | 60;
    label: string;
    sublabel: string;
    icon: keyof typeof Ionicons.glyphMap;
    badgeColor?: string;
  }> = [
    {
      key: 'now',
      label: 'Sekarang',
      sublabel: 'Terima pesanan langsung saat ini juga',
      icon: 'flash-outline',
      badgeColor: '#10B981',
    },
    {
      key: 15,
      label: '15 Menit Lagi',
      sublabel: `Diterima otomatis pk ${moment().add(15, 'minutes').format('HH:mm')}`,
      icon: 'time-outline',
      badgeColor: '#3B82F6',
    },
    {
      key: 30,
      label: '30 Menit Lagi',
      sublabel: `Diterima otomatis pk ${moment().add(30, 'minutes').format('HH:mm')}`,
      icon: 'timer-outline',
      badgeColor: '#F59E0B',
    },
    {
      key: 60,
      label: '1 Jam Lagi',
      sublabel: `Diterima otomatis pk ${moment().add(60, 'minutes').format('HH:mm')}`,
      icon: 'alarm-outline',
      badgeColor: '#8B5CF6',
    },
  ];

  const handleConfirm = () => {
    if (selectedOption === 'now') {
      onSelectNow();
    } else {
      onSelectDelay(selectedOption);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !loading && onClose()}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="bicycle-outline" size={22} color="#0284C7" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.title}>Waktu Penerimaan Instan</Text>
              <Text style={styles.subtitle}>
                {orderCount > 1
                  ? `${orderCount} pesanan menggunakan kurir Instan/Sameday.`
                  : 'Pesanan menggunakan kurir Instan/Sameday.'}
              </Text>
            </View>
          </View>

          <Text style={styles.promptText}>Pilih kapan pesanan ingin diterima:</Text>

          <View style={styles.optionsList}>
            {options.map((opt) => {
              const isSelected = selectedOption === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => setSelectedOption(opt.key)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: isSelected ? '#E0F2FE' : '#F3F4F6' }]}>
                    <Ionicons name={opt.icon} size={20} color={isSelected ? '#0284C7' : '#6B7280'} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.optionSub}>{opt.sublabel}</Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color="#0369A1" style={{ marginRight: 6 }} />
            <Text style={styles.infoText}>
              Jika pembeli membatalkan pesanan sebelum jadwal tercapai, sistem akan otomatis membatalkan jadwal tanpa menerima pesanan.
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>
                    {selectedOption === 'now' ? 'Terima Sekarang' : 'Jadwalkan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  promptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  optionsList: {
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  optionCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  optionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  optionTitleSelected: {
    color: '#0369A1',
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#0284C7',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#0284C7',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 130,
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#7DD3FC',
  },
  confirmBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
