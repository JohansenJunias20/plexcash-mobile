import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CANCEL_REJECT_REASONS, TCancelRejectReason } from '../services/ecommerce/orderService';

interface Props {
  visible: boolean;
  orderCount: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: TCancelRejectReason) => void;
}

export default function CancelReasonModal({ visible, orderCount, loading, onClose, onConfirm }: Props) {
  const [selectedReason, setSelectedReason] = useState<TCancelRejectReason | null>(null);

  useEffect(() => {
    if (visible) setSelectedReason(null);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !loading && onClose()}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Tolak Pembatalan</Text>
          <Text style={styles.subtitle}>
            Pilih alasan penolakan untuk <Text style={styles.bold}>{orderCount}</Text> pesanan yang dipilih.
          </Text>

          <View style={styles.optionsList}>
            {CANCEL_REJECT_REASONS.map((opt) => {
              const isSelected = selectedReason === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => setSelectedReason(opt.value)}
                  disabled={loading}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !selectedReason && styles.confirmBtnDisabled]}
              onPress={() => selectedReason && onConfirm(selectedReason)}
              disabled={!selectedReason || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>Konfirmasi Tolak</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { width: '100%', maxWidth: 400, backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  title: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  bold: { fontWeight: '700', color: '#1F2937' },
  optionsList: { marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  optionSelected: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: '#EF4444' },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444' },
  optionText: { fontSize: 14, color: '#374151' },
  optionTextSelected: { color: '#B91C1C', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginRight: 8 },
  cancelBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, minWidth: 140, justifyContent: 'center' },
  confirmBtnDisabled: { backgroundColor: '#FCA5A5' },
  confirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
