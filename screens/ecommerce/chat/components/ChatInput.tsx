import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IChatInputProps, IChatTemplate } from '../types/chat.types';
import { expandShortcuts } from '../../../../services/ecommerce/chatTemplateService';

/**
 * ChatInput Component
 * Input area for sending text, images, templates, and inline shortcut expansion
 */
const ChatInput: React.FC<IChatInputProps> = ({
  onSendText,
  onSendImage,
  onSendMultipleImages,
  onToggleOrderList,
  onToggleProductList,
  onToggleTemplateList,
  templates = [],
  insertedText,
  onClearInsertedText,
  disabled = false,
  placeholder = 'Ketik pesan atau ketik / untuk template...',
}) => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const [text, setText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  }>({ current: 0, total: 0, percentage: 0 });

  // Shortcut suggestions state
  const [shortcutMatches, setShortcutMatches] = useState<IChatTemplate[]>([]);
  const [activeShortcutPrefix, setActiveShortcutPrefix] = useState<string>('');

  // Handle inserted text from external source (e.g. ChatTemplatePanel "Gunakan")
  useEffect(() => {
    if (insertedText !== undefined && insertedText !== null) {
      setText(insertedText);
      setShortcutMatches([]);
      if (onClearInsertedText) {
        onClearInsertedText();
      }
    }
  }, [insertedText, onClearInsertedText]);

  /**
   * Handle text change with inline shortcut expansion detection
   */
  const handleTextChange = (newText: string) => {
    if (!templates || templates.length === 0) {
      setText(newText);
      setShortcutMatches([]);
      return;
    }

    // Auto-expand shortcut when user types space or newline after a shortcut, e.g. "/halo "
    const spaceMatch = newText.match(/(?:^|\s)(\/[a-zA-Z0-9_\u00C0-\u024F-]+)\s$/);
    if (spaceMatch && spaceMatch[1]) {
      const scWord = spaceMatch[1].toLowerCase();
      const matchedTpl = templates.find((t) => {
        const sc = (t.shortcut || '').toLowerCase();
        const scWithoutSlash = sc.startsWith('/') ? sc.slice(1) : sc;
        return sc === scWord || `/${scWithoutSlash}` === scWord;
      });

      if (matchedTpl && matchedTpl.content) {
        const lastIndex = newText.lastIndexOf(spaceMatch[1]);
        const before = newText.substring(0, lastIndex);
        const replaced = before + matchedTpl.content + ' ';
        setText(replaced);
        setShortcutMatches([]);
        setActiveShortcutPrefix('');
        return;
      }
    }

    setText(newText);

    // Check for trailing word starting with '/'
    const match = newText.match(/(?:^|\s)(\/[a-zA-Z0-9_\u00C0-\u024F-]*)$/);

    if (match && match[1]) {
      const query = match[1].toLowerCase();
      setActiveShortcutPrefix(match[1]);

      const matches = templates.filter((tpl) => {
        const sc = tpl.shortcut ? tpl.shortcut.toLowerCase() : '';
        const title = tpl.title ? tpl.title.toLowerCase() : '';
        const content = tpl.content ? tpl.content.toLowerCase() : '';

        // If query is just '/', show all templates
        if (query === '/') {
          return true;
        }

        // Exact or prefix shortcut match
        if (sc && sc.startsWith(query)) {
          return true;
        }

        // Substring matches for shortcut, title, or content
        const searchWord = query.slice(1);
        if (searchWord.length > 0) {
          return sc.includes(query) || title.includes(searchWord) || content.includes(searchWord);
        }

        return false;
      });

      // Sort exact prefix matches first
      matches.sort((a, b) => {
        const aSc = a.shortcut ? a.shortcut.toLowerCase() : '';
        const bSc = b.shortcut ? b.shortcut.toLowerCase() : '';
        const aPrefix = aSc.startsWith(query) ? 1 : 0;
        const bPrefix = bSc.startsWith(query) ? 1 : 0;
        return bPrefix - aPrefix;
      });

      setShortcutMatches(matches.slice(0, 6));
    } else {
      setShortcutMatches([]);
      setActiveShortcutPrefix('');
    }
  };

  /**
   * Handle selecting a shortcut suggestion
   */
  const handleSelectShortcut = (template: IChatTemplate) => {
    if (!activeShortcutPrefix) {
      setText(template.content);
    } else {
      const lastIndex = text.lastIndexOf(activeShortcutPrefix);
      if (lastIndex !== -1) {
        const before = text.substring(0, lastIndex);
        const replaced = before + template.content;
        setText(replaced);
      } else {
        setText(template.content);
      }
    }
    setShortcutMatches([]);
    setActiveShortcutPrefix('');
  };

  /**
   * Handle send text message
   */
  const handleSendText = async () => {
    if (!text.trim() || sending || disabled) return;

    try {
      setSending(true);
      setShortcutMatches([]);
      // Expand shortcuts before sending (e.g. "/halo" becomes full template content)
      const messageToSend = expandShortcuts(text.trim(), templates);
      await onSendText(messageToSend);
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
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSending(true);
        console.log(`📸 [ChatInput] Selected ${result.assets.length} image(s)`);

        if (result.assets.length > 1 && onSendMultipleImages) {
          const imageUris = result.assets.map((asset) => asset.uri);
          await onSendMultipleImages(imageUris);
        } else {
          const totalImages = result.assets.length;

          for (let i = 0; i < result.assets.length; i++) {
            const asset = result.assets[i];

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

            if (i < result.assets.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your camera'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
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
    <View style={styles.outerWrapper}>
      {/* Inline Shortcut Suggestions Popup */}
      {shortcutMatches.length > 0 && (
        <View style={styles.shortcutPopup}>
          <View style={styles.shortcutHeader}>
            <View style={styles.shortcutHeaderTitleContainer}>
              <Ionicons name="flash" size={14} color="#f59e0b" />
              <Text style={styles.shortcutHeaderTitle}>Template Shortcut</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShortcutMatches([])}
              style={styles.shortcutCloseButton}
            >
              <Ionicons name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={shortcutMatches}
            keyExtractor={(item, index) => `sc-${item.id}-${index}`}
            keyboardShouldPersistTaps="handled"
            style={styles.shortcutList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.shortcutItem}
                onPress={() => handleSelectShortcut(item)}
                activeOpacity={0.7}
              >
                <View style={styles.shortcutItemHeader}>
                  {item.shortcut ? (
                    <View style={styles.shortcutItemBadge}>
                      <Text style={styles.shortcutItemBadgeText}>{item.shortcut}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.shortcutItemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.shortcutItemContent} numberOfLines={1}>
                  {item.content}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Upload Progress Indicator */}
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
                { width: `${uploadProgress.percentage}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Input Container */}
      <View style={[styles.container, { paddingBottom: 12 + bottomInset }]}>
        {/* Template Button */}
        {onToggleTemplateList && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onToggleTemplateList}
            disabled={sending || disabled}
          >
            <Ionicons
              name="chatbox-ellipses-outline"
              size={24}
              color={sending || disabled ? '#D1D5DB' : '#f59e0b'}
            />
          </TouchableOpacity>
        )}

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
          onChangeText={handleTextChange}
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
  outerWrapper: {
    backgroundColor: 'white',
  },
  // Shortcut Popup Styles
  shortcutPopup: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  shortcutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  shortcutHeaderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shortcutHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  shortcutCloseButton: {
    padding: 2,
  },
  shortcutList: {
    maxHeight: 160,
  },
  shortcutItem: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  shortcutItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  shortcutItemBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  shortcutItemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  shortcutItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  shortcutItemContent: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Progress Indicator Styles
  progressContainer: {
    backgroundColor: '#FEF3C7',
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
    color: '#92400E',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#FDE68A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
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
    marginRight: 4,
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
