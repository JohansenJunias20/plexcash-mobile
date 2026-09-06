import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showMessage } from 'react-native-flash-message';
import {
  fetchUnpaidTemplate,
  saveUnpaidTemplate,
  renderTemplatePreview,
  DEFAULT_UNPAID_TEMPLATE,
} from '../../services/ecommerce/paymentReminderService';

interface UnpaidTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (savedTemplate: string) => void;
}

const DYNAMIC_VARIABLES = [
  { label: '+ Nama Pembeli ({buyer_name})', tag: '{buyer_name}' },
  { label: '+ No. Pesanan ({order_sn})', tag: '{order_sn}' },
  { label: '+ Total ({total})', tag: '{total}' },
  { label: '+ Toko ({shop_name})', tag: '{shop_name}' },
];

export default function UnpaidTemplateModal({
  visible,
  onClose,
  onSaved,
}: UnpaidTemplateModalProps) {
  const [templateText, setTemplateText] = useState(DEFAULT_UNPAID_TEMPLATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const textInputRef = useRef<TextInput>(null);

  // Load template when modal opens
  useEffect(() => {
    if (visible) {
      loadTemplate();
    }
  }, [visible]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const res = await fetchUnpaidTemplate();
      if (res.template) {
        setTemplateText(res.template);
      }
    } catch (error) {
      console.warn('Failed to load unpaid template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    const { start, end } = selection;
    const before = templateText.substring(0, start);
    const after = templateText.substring(end);
    const newText = before + tag + after;

    setTemplateText(newText);

    // Reposition cursor after the inserted tag
    const newCursor = start + tag.length;
    setSelection({ start: newCursor, end: newCursor });

    // Focus input
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  };

  const handleResetDefault = () => {
    setTemplateText(DEFAULT_UNPAID_TEMPLATE);
    setSelection({
      start: DEFAULT_UNPAID_TEMPLATE.length,
      end: DEFAULT_UNPAID_TEMPLATE.length,
    });
  };

  const handleSave = async () => {
    if (!templateText.trim()) {
      showMessage({
        message: 'Template tidak boleh kosong',
        type: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await saveUnpaidTemplate(templateText);
      if (res.status || res.success) {
        showMessage({
          message: 'Berhasil',
          description: res.message || 'Template pengingat pembayaran berhasil disimpan',
          type: 'success',
        });
        if (onSaved) {
          onSaved(templateText);
        }
        onClose();
      } else {
        showMessage({
          message: 'Gagal Menyimpan',
          description: res.reason || 'Terjadi kesalahan saat menyimpan template',
          type: 'danger',
        });
      }
    } catch (error: any) {
      showMessage({
        message: 'Error',
        description: error?.message || 'Gagal menyimpan template',
        type: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const livePreview = renderTemplatePreview(templateText);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="notifications" size={20} color="#D97706" />
              </View>
              <Text style={styles.headerTitle}>Template Pengingat Pembayaran</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D97706" />
              <Text style={styles.loadingText}>Memuat template...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Description */}
              <Text style={styles.subtitle}>
                Pesan ini akan dikirimkan otomatis kepada pembeli ketika tombol "Ingatkan Pembayaran" ditekan pada tab Belum Dibayar.
              </Text>

              {/* Input Label & Reset */}
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Isi Template Pesan</Text>
                <TouchableOpacity onPress={handleResetDefault}>
                  <Text style={styles.resetButtonText}>Reset ke Default</Text>
                </TouchableOpacity>
              </View>

              {/* Text Input */}
              <View style={styles.textInputWrapper}>
                <TextInput
                  ref={textInputRef}
                  style={styles.textInput}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={templateText}
                  onChangeText={setTemplateText}
                  onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                  placeholder="Ketik teks template pengingat di sini..."
                  placeholderTextColor="#9CA3AF"
                />
                <View style={styles.charCountRow}>
                  <Text style={styles.charCountText}>
                    {templateText.length} karakter
                  </Text>
                </View>
              </View>

              {/* Dynamic Variables Chips */}
              <View style={styles.chipsSection}>
                <Text style={styles.chipsSectionTitle}>Variabel Dinamis:</Text>
                <Text style={styles.chipsSectionSubtitle}>
                  Klik tombol di bawah untuk menyisipkan variabel ke dalam teks:
                </Text>
                <View style={styles.chipsContainer}>
                  {DYNAMIC_VARIABLES.map((item) => (
                    <TouchableOpacity
                      key={item.tag}
                      style={styles.chipButton}
                      onPress={() => handleInsertTag(item.tag)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipButtonText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Live Preview Box */}
              <View style={styles.previewSection}>
                <View style={styles.previewHeader}>
                  <Ionicons name="eye-outline" size={16} color="#4B5563" />
                  <Text style={styles.previewTitle}>Live Preview (Pratinjau Nyata)</Text>
                </View>
                <View style={styles.previewBubble}>
                  <Text style={styles.previewText}>{livePreview}</Text>
                </View>
                <Text style={styles.previewNote}>
                  * Variabel di atas otomatis digantikan dengan data pesanan aktual saat pesan dikirim ke pembeli.
                </Text>
              </View>
            </ScrollView>
          )}

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveButtonText}>Simpan Template</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  textInputWrapper: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    padding: 12,
  },
  textInput: {
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    lineHeight: 20,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  charCountText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  chipsSection: {
    marginTop: 16,
  },
  chipsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  chipsSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  previewSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  previewBubble: {
    backgroundColor: '#F3F4F6',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    padding: 14,
    borderRadius: 8,
  },
  previewText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 19,
  },
  previewNote: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFF',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveButton: {
    flex: 1.5,
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
