import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AddUrlModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (url: string) => void;
}

export default function AddUrlModal({ visible, onClose, onAdd }: AddUrlModalProps): JSX.Element {
  const [url, setUrl] = useState('');

  const handleAdd = () => {
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) {
      Alert.alert('Error', 'Please enter a URL or pattern');
      return;
    }

    // Basic validation
    if (trimmedUrl.length < 3) {
      Alert.alert('Error', 'URL pattern is too short');
      return;
    }

    onAdd(trimmedUrl);
    setUrl('');
    onClose();
  };

  const handleClose = () => {
    setUrl('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Add URL Pattern</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>URL or Pattern</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="e.g., *.facebook.com or youtube.com"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                Use * as wildcard. Examples:{'\n'}
                • *.facebook.com (blocks all Facebook){'\n'}
                • youtube.com (blocks YouTube){'\n'}
                • *.google.* (blocks all Google domains)
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addText}>Add</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    marginLeft: 8,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  addButton: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

