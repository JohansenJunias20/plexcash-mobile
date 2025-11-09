import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { VersionInfo } from '../services/versionCheck';

interface UpdateModalProps {
  visible: boolean;
  versionInfo: VersionInfo | null;
  onUpdate: () => void;
  onSkip?: () => void;
  onLater?: () => void;
  isUpdating?: boolean;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  versionInfo,
  onUpdate,
  onSkip,
  onLater,
  isUpdating = false,
}) => {
  if (!versionInfo) return null;

  const handleUpdate = () => {
    // Trigger update action
    onUpdate();
  };

  const isForceUpdate = versionInfo.forceUpdate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isForceUpdate && onLater) {
          onLater();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🚀</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isForceUpdate ? 'Update Diperlukan' : 'Update Tersedia'}
          </Text>

          {/* Version Info */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>
              Version Code Saat Ini: <Text style={styles.versionNumber}>{versionInfo.currentVersionCode}</Text>
            </Text>
            <Text style={styles.versionText}>
              Version Code Terbaru: <Text style={styles.versionNumber}>{versionInfo.latestVersionCode}</Text>
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            {isForceUpdate
              ? 'Aplikasi perlu diupdate ke versi terbaru untuk melanjutkan.'
              : 'Versi baru aplikasi tersedia dengan perbaikan dan fitur terbaru.'}
          </Text>

          {/* Loading Indicator */}
          {isUpdating && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text style={styles.loadingText}>Mengunduh update...</Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {/* Update Button */}
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
              disabled={isUpdating}
            >
              <Text style={styles.updateButtonText}>
                Update Sekarang
              </Text>
            </TouchableOpacity>

            {/* Skip/Later Buttons - only show if not force update */}
            {!isForceUpdate && (
              <View style={styles.secondaryButtonContainer}>
                {onLater && (
                  <TouchableOpacity
                    style={[styles.button, styles.laterButton]}
                    onPress={onLater}
                    disabled={isUpdating}
                  >
                    <Text style={styles.laterButtonText}>Nanti</Text>
                  </TouchableOpacity>
                )}
                {onSkip && (
                  <TouchableOpacity
                    style={[styles.button, styles.skipButton]}
                    onPress={onSkip}
                    disabled={isUpdating}
                  >
                    <Text style={styles.skipButtonText}>Lewati Versi Ini</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  versionContainer: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  versionNumber: {
    fontWeight: '600',
    color: '#1f2937',
  },
  description: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  releaseNotesContainer: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  releaseNotes: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#92400e',
  },
  buttonContainer: {
    gap: 12,
  },
  secondaryButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButton: {
    backgroundColor: '#f59e0b',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  laterButtonText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default UpdateModal;
