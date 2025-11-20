import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IChatMessageProps } from '../types/chat.types';

/**
 * ChatMessage Component
 * Displays individual message bubble
 */
const ChatMessage: React.FC<IChatMessageProps> = ({ message, isCurrentUser }) => {
  const isSeller = message.from === 'seller';
  const isSystem = message.from === 'system';
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle showing image preview (for both product and regular images)
  const handleShowImagePreview = (imageUrl: string) => {
    console.log('�️ [ChatMessage] Opening image preview:', imageUrl);
    setPreviewImageUrl(imageUrl);
    setImagePreviewVisible(true);
  };

  // Handle closing image preview
  const handleCloseImagePreview = () => {
    console.log('❌ [ChatMessage] Closing image preview');
    setImagePreviewVisible(false);
    setPreviewImageUrl('');
  };

  // Render message content based on type
  const renderMessageContent = () => {
    // Handle missing or invalid message content
    if (!message.msg || typeof message.msg !== 'object') {
      return (
        <View style={styles.unsupportedContainer}>
          <Ionicons name="alert-circle-outline" size={16} color="#9CA3AF" />
          <Text style={styles.unsupportedText}>Invalid message format</Text>
        </View>
      );
    }

    switch (message.msg.type) {
      case 'text':
        return (
          <Text style={[styles.messageText, isSeller && styles.messageTextSeller]}>
            {message.msg.text || ''}
          </Text>
        );

      case 'image':
        return (
          <View>
            {message.msg.image && (
              <TouchableOpacity
                onPress={() => handleShowImagePreview(message.msg.image!)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: message.msg.image }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          </View>
        );

      case 'sticker':
        return (
          <View>
            {message.msg.sticker_url && (
              <Image
                source={{ uri: message.msg.sticker_url }}
                style={styles.stickerImage}
                resizeMode="contain"
              />
            )}
          </View>
        );

      case 'product':
        console.log('🛍️ [ChatMessage] Rendering product:', {
          has_image: !!message.msg.product_image,
          image_url: message.msg.product_image,
          product_name: message.msg.text,
        });

        return (
          <View style={styles.productCard}>
            {/* Product Image */}
            {message.msg.product_image && (
              <TouchableOpacity
                onPress={() => handleShowImagePreview(message.msg.product_image!)}
                activeOpacity={0.9}
              >
                <View style={styles.productImageContainer}>
                  <Image
                    source={{ uri: message.msg.product_image }}
                    style={styles.productImage}
                    resizeMode="cover"
                    onError={(error) => {
                      console.error('❌ [ChatMessage] Image load error:', {
                        error: error.nativeEvent.error,
                        url: message.msg.product_image,
                      });
                    }}
                    onLoad={() => {
                      console.log('✅ [ChatMessage] Image loaded successfully:', {
                        url: message.msg.product_image,
                      });
                    }}
                    onLoadStart={() => {
                      console.log('🔄 [ChatMessage] Image loading started:', {
                        url: message.msg.product_image,
                      });
                    }}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Product Name */}
            {message.msg.text && (
              <Text style={styles.productName} numberOfLines={2}>
                {message.msg.text}
              </Text>
            )}

            {/* Product Price */}
            {message.msg.product_price && (
              <Text style={styles.productPrice}>
                {message.msg.product_price}
              </Text>
            )}

            {/* View Product Button */}
            {message.msg.product_image && (
              <TouchableOpacity
                style={styles.viewProductButton}
                onPress={() => handleShowImagePreview(message.msg.product_image!)}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={16} color="#FFFFFF" />
                <Text style={styles.viewProductText}>View Product</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'order':
        return (
          <View>
            <View style={styles.orderContainer}>
              <Ionicons name="receipt-outline" size={20} color="#3B82F6" />
              <Text style={styles.orderText}>Order</Text>
            </View>
            {message.msg.text && (
              <Text
                style={[styles.messageText, isSeller && styles.messageTextSeller]}
              >
                {message.msg.text}
              </Text>
            )}
          </View>
        );

      case 'unsupported':
        return (
          <View style={styles.unsupportedContainer}>
            <Ionicons name="alert-circle-outline" size={16} color="#9CA3AF" />
            <Text style={styles.unsupportedText}>Unsupported message type</Text>
          </View>
        );

      default:
        return (
          <Text style={[styles.messageText, isSeller && styles.messageTextSeller]}>
            {message.msg.text || 'No content'}
          </Text>
        );
    }
  };

  // System messages (centered)
  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{message.msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isSeller ? styles.containerSeller : styles.containerBuyer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isSeller ? styles.bubbleSeller : styles.bubbleBuyer,
        ]}
      >
        {renderMessageContent()}

        {/* Time and Read status */}
        <View style={styles.footer}>
          <Text
            style={[styles.time, isSeller && styles.timeSeller]}
          >
            {formatTime(message.timestamp)}
          </Text>
          {isSeller && (
            <Ionicons
              name={message.isRead ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={message.isRead ? '#3B82F6' : '#9CA3AF'}
            />
          )}
        </View>
      </View>

      {/* Image Preview Modal */}
      <Modal
        visible={imagePreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseImagePreview}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseImagePreview}
        >
          <View style={styles.modalContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCloseImagePreview}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Preview Image */}
            {previewImageUrl && (
              <Image
                source={{ uri: previewImageUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}

            {/* Product Info (only show for product messages) */}
            {message.msg.type === 'product' && (
              <View style={styles.previewInfo}>
                {message.msg.text && (
                  <Text style={styles.previewProductName} numberOfLines={2}>
                    {message.msg.text}
                  </Text>
                )}
                {message.msg.product_price && (
                  <Text style={styles.previewProductPrice}>
                    {message.msg.product_price}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
  },
  containerSeller: {
    alignItems: 'flex-end',
  },
  containerBuyer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    padding: 10,
    borderRadius: 16,
  },
  bubbleSeller: {
    backgroundColor: '#FEF3C7',
    borderBottomRightRadius: 4,
  },
  bubbleBuyer: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  messageTextSeller: {
    color: '#78350F',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 6,
  },
  stickerImage: {
    width: 150,
    height: 150,
    marginTop: 4,
  },
  productContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  productText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f59e0b',
  },
  productCard: {
    width: '100%',
    maxWidth: 280,
    padding: 8,
  },
  productImageContainer: {
    width: '90%',
    aspectRatio: 1, // Square container
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 8,
  },
  viewProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
    width: '100%', // Fix overflow - constrain to container width
  },
  viewProductText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  orderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  linkText: {
    fontSize: 12,
    color: '#3B82F6',
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  unsupportedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unsupportedText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  time: {
    fontSize: 11,
    color: '#6B7280',
  },
  timeSeller: {
    color: '#92400E',
  },
  systemContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemBubble: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  systemText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Image Preview Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: -50,
    right: 0,
    zIndex: 10,
    padding: 8,
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    backgroundColor: '#1F2937',
  },
  previewInfo: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  previewProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  previewProductPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
});

export default ChatMessage;

