import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { IChatInputProps } from '../types/chat.types';

/**
 * ChatInput Component
 * Input area for sending text and images
 */
const ChatInput: React.FC<IChatInputProps> = ({
  onSendText,
  onSendImage,
  onSendMultipleImages,
  onToggleOrderList,
  onToggleProductList,
  disabled = false,
  placeholder = 'Type a message...',
}) => {
  const [text, setText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  }>({ current: 0, total: 0, percentage: 0 });

  /**
   * Handle send text message
   */
  const handleSendText = async () => {
    if (!text.trim() || sending || disabled) return;

    try {
      setSending(true);
      await onSendText(text.trim());
      setText(''); // Clear input after sending
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  /**
   * Handle pick image from gallery (supports multiple selection)
   */
  const handlePickImage = async () => {
    if (sending || disabled) return;

    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your photos'
        );
        return;
      }

      // Pick image(s) - allow multiple selection
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true, // Enable multiple selection
        quality: 0.8, // Compress to 80% quality
        selectionLimit: 10, // Maximum 10 images
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSending(true);

        console.log(`📸 [ChatInput] Selected ${result.assets.length} image(s)`);

        // If multiple images selected and handler provided, use it
        if (result.assets.length > 1 && onSendMultipleImages) {
          const imageUris = result.assets.map(asset => asset.uri);
          await onSendMultipleImages(imageUris);
        } else {
          // Single image or no multiple handler - send one by one with progress tracking
          const totalImages = result.assets.length;

          for (let i = 0; i < result.assets.length; i++) {
            const asset = result.assets[i];

            // Update progress (only for multiple images)
            if (totalImages > 1) {
              const current = i + 1;
              const percentage = Math.round((current / totalImages) * 100);
              setUploadProgress({
                current,
                total: totalImages,
                percentage,
              });
              console.log(`📊 [ChatInput] Upload progress: ${current}/${totalImages} (${percentage}%)`);
            }

            console.log(`📤 [ChatInput] Sending image ${i + 1}/${totalImages}: ${asset.uri}`);
            await onSendImage(asset.uri);

            // Small delay between sends to avoid overwhelming the server
            if (i < result.assets.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          // Clear progress after all images sent
          setUploadProgress({ current: 0, total: 0, percentage: 0 });
        }
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', error.message || 'Failed to pick image');
    } finally {
      setSending(false);
    }
  };

  /**
   * Handle take photo with camera
   */
  const handleTakePhoto = async () => {
    if (sending || disabled) return;

    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your camera'
        );
        return;
      }

      // Take photo
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // Compress to 80% quality
      });

      if (!result.canceled && result.assets[0]) {
        setSending(true);
        await onSendImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', error.message || 'Failed to take photo');
    } finally {
      setSending(false);
    }
  };

  /**
   * Show image picker options
   */
  const handleImageOptions = () => {
    Alert.alert('Send Image', 'Choose an option', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Gallery', onPress: handlePickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View>
      {/* Upload Progress Indicator (only show when uploading multiple images) */}
      {uploadProgress.total > 1 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Ionicons name="cloud-upload-outline" size={16} color="#f59e0b" />
            <Text style={styles.progressText}>
              Sending {uploadProgress.current}/{uploadProgress.total} images...
            </Text>
            <Text style={styles.progressPercentage}>
              {uploadProgress.percentage}%
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${uploadProgress.percentage}%` }
              ]}
            />
          </View>
        </View>
      )}

      {/* Input Container */}
      <View style={styles.container}>
        {/* Order List button */}
        {onToggleOrderList && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onToggleOrderList}
            disabled={sending || disabled}
          >
            <Ionicons
              name="receipt-outline"
              size={24}
              color={sending || disabled ? '#D1D5DB' : '#f59e0b'}
            />
          </TouchableOpacity>
        )}

        {/* Image button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleImageOptions}
          disabled={sending || disabled}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={sending || disabled ? '#D1D5DB' : '#f59e0b'}
          />
        </TouchableOpacity>

        {/* Product button */}
        {onToggleProductList && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onToggleProductList}
            disabled={sending || disabled}
          >
            <Ionicons
              name="cube-outline"
              size={24}
              color={sending || disabled ? '#D1D5DB' : '#f59e0b'}
            />
          </TouchableOpacity>
        )}

        {/* Text input */}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={1000}
          editable={!sending && !disabled}
          onSubmitEditing={handleSendText}
          blurOnSubmit={false}
        />

        {/* Send button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || sending || disabled) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendText}
          disabled={!text.trim() || sending || disabled}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Progress Indicator Styles
  progressContainer: {
    backgroundColor: '#FEF3C7', // Light amber background
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#FCD34D',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E', // Dark amber text
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b', // Primary amber
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#FDE68A', // Light amber
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b', // Primary amber
    borderRadius: 3,
  },

  // Input Container Styles
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  iconButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#111827',
  },
  sendButton: {
    backgroundColor: '#f59e0b',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
});

export default ChatInput;

