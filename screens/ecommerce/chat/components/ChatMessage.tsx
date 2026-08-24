import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { IChatMessageProps } from '../types/chat.types';

/**
 * ChatMessage Component
 * Displays individual message bubble
 */
const ChatMessage: React.FC<IChatMessageProps> = ({ message, isCurrentUser }) => {
  const navigation = useNavigation<any>();
  const isSeller = message.from === 'seller';
  const isSystem = message.from === 'system';
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');

  // Helper to parse order link from text like "/ecommerce/pesanan/10/26072199C34PMM" or "No. Pesanan: 26072199C34PMM"
  const parseOrderLink = (text?: string) => {
    if (!text || typeof text !== 'string') return null;

    // Pattern 1: /ecommerce/pesanan/{idEcommerce}/{orderSn} or /pesanan/{idEcommerce}/{orderSn}
    const linkRegex = /(?:\/ecommerce)?\/pesanan\/(\d+)\/([A-Za-z0-9_-]+)/i;
    const linkMatch = text.match(linkRegex);
    if (linkMatch) {
      const idEcommerce = parseInt(linkMatch[1], 10);
      const orderSn = linkMatch[2];
      const remainingText = text.replace(linkMatch[0], '').trim();
      return {
        idEcommerce,
        orderSn,
        remainingText,
      };
    }

    // Pattern 2: "No. Pesanan: 26072199C34PMM" or "Order SN: 26072199C34PMM"
    const snRegex = /(?:No\.\s*Pesanan|Order\s*(?:SN|ID)|Nomor\s*Pesanan)[:\s]+([A-Za-z0-9_-]{10,})/i;
    const snMatch = text.match(snRegex);
    if (snMatch) {
      const orderSn = snMatch[1];
      const remainingText = text.replace(snMatch[0], '').trim();
      return {
        idEcommerce: 0,
        orderSn,
        remainingText,
      };
    }

    return null;
  };

  // Render Order Card (Bubble Card for order links)
  const renderOrderCard = (orderSn: string, idEcommerce: number, remainingText?: string) => {
    return (
      <View style={styles.orderCardWrapper}>
        {remainingText ? (
          <Text style={[styles.messageText, isSeller && styles.messageTextSeller, { marginBottom: 8 }]}>
            {remainingText}
          </Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.orderBubbleCard,
            isSeller ? styles.orderBubbleCardSeller : styles.orderBubbleCardBuyer,
          ]}
          onPress={() => {
            console.log('📦 [ChatMessage] Opening OrderDetail for order:', orderSn, 'idEcommerce:', idEcommerce);
            navigation.navigate('OrderDetail', {
              id: orderSn,
              id_ecommerce: idEcommerce,
            });
          }}
          activeOpacity={0.85}
        >
          <View style={styles.orderBubbleHeader}>
            <View style={styles.orderBubbleIconBg}>
              <Ionicons name="bag-handle" size={20} color="#f59e0b" />
            </View>
            <View style={styles.orderBubbleHeaderText}>
              <Text style={styles.orderBubbleTitle}>Pesanan E-Commerce</Text>
              <Text style={styles.orderBubbleSubtitle}>Tap untuk lihat detail pesanan</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </View>

          <View style={styles.orderBubbleDivider} />

          <View style={styles.orderBubbleBody}>
            <Text style={styles.orderBubbleLabel}>No. Pesanan:</Text>
            <Text style={styles.orderBubbleValue} numberOfLines={1}>
              {orderSn}
            </Text>
          </View>

          <View style={styles.orderBubbleFooter}>
            <Text style={styles.orderBubbleActionText}>Buka Detail Pesanan</Text>
            <Ionicons name="open-outline" size={14} color="#f59e0b" />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp > 1e11 ? timestamp : timestamp * 1000);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle showing image preview (for both product and regular images)
  const handleShowImagePreview = (imageUrl: string) => {
    console.log('🖼️ [ChatMessage] Opening image preview:', imageUrl);
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
    // Extract any text content from message object or string
    let rawText = '';
    if (typeof message.msg === 'string') {
      rawText = message.msg;
    } else if (message.msg && typeof message.msg === 'object') {
      rawText = message.msg.text || message.msg.content || (message.msg as any).msg || '';
    }
    if (!rawText) {
      rawText = (message as any).content || (message as any).text || (message as any).msg || (message as any).msg_shopee || '';
    }

    // 1. ALWAYS check if text contains an order link or order SN pattern
    const orderLinkInfo = parseOrderLink(rawText);
    if (orderLinkInfo) {
      return renderOrderCard(
        orderLinkInfo.orderSn,
        orderLinkInfo.idEcommerce || (message as any).id_ecommerce || 0,
        orderLinkInfo.remainingText
      );
    }

    // Handle missing or invalid message content object
    if (!message.msg) {
      if (rawText) {
        return (
          <Text style={[styles.messageText, isSeller && styles.messageTextSeller]}>
            {rawText}
          </Text>
        );
      }
      return (
        <View style={styles.unsupportedContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#9CA3AF" />
          <Text style={styles.unsupportedText}>Pesan E-Commerce</Text>
        </View>
      );
    }

    const msgObj = typeof message.msg === 'object' ? message.msg : { type: 'text', text: rawText };
    const msgType = msgObj.type || (message as any).type || 'text';

    switch (msgType) {
      case 'text':
      case 'chat':
        return (
          <Text style={[styles.messageText, isSeller && styles.messageTextSeller]}>
            {rawText || 'Pesan'}
          </Text>
        );

      case 'image': {
        const imageUrl = msgObj.image || msgObj.image_url || msgObj.url || (message as any).image_url || (message as any).content;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          return (
            <View>
              <TouchableOpacity
                onPress={() => handleShowImagePreview(imageUrl)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              {rawText && rawText !== imageUrl ? (
                <Text style={[styles.messageText, isSeller && styles.messageTextSeller, { marginTop: 6 }]}>
                  {rawText}
                </Text>
              ) : null}
            </View>
          );
        }
        return (
          <View style={styles.unsupportedContainer}>
            <Ionicons name="image-outline" size={16} color="#9CA3AF" />
            <Text style={styles.unsupportedText}>{rawText || 'Gambar'}</Text>
          </View>
        );
      }

      case 'sticker': {
        const stickerUrl = msgObj.sticker_url || msgObj.url || msgObj.image || msgObj.image_url || (message as any).sticker_url;
        if (stickerUrl && typeof stickerUrl === 'string' && stickerUrl.startsWith('http')) {
          return (
            <View>
              <Image
                source={{ uri: stickerUrl }}
                style={styles.stickerImage}
                resizeMode="contain"
              />
            </View>
          );
        }
        return (
          <View style={styles.unsupportedContainer}>
            <Ionicons name="happy-outline" size={16} color="#9CA3AF" />
            <Text style={styles.unsupportedText}>Stiker</Text>
          </View>
        );
      }

      case 'product': {
        const productImage = msgObj.product_image || msgObj.image || msgObj.image_url || (message as any).product_image;
        const productPrice = msgObj.product_price || msgObj.price || (message as any).product_price;

        if (productImage || rawText || productPrice) {
          return (
            <View style={styles.productCard}>
              {productImage ? (
                <TouchableOpacity
                  onPress={() => handleShowImagePreview(productImage)}
                  activeOpacity={0.9}
                >
                  <View style={styles.productImageContainer}>
                    <Image
                      source={{ uri: productImage }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  </View>
                </TouchableOpacity>
              ) : null}
              {rawText ? (
                <Text style={styles.productName} numberOfLines={2}>
                  {rawText}
                </Text>
              ) : null}
              {productPrice ? (
                <Text style={styles.productPrice}>
                  {productPrice}
                </Text>
              ) : null}
            </View>
          );
        }
        return (
          <View style={styles.unsupportedContainer}>
            <Ionicons name="bag-outline" size={16} color="#9CA3AF" />
            <Text style={styles.unsupportedText}>Produk E-Commerce</Text>
          </View>
        );
      }

      case 'order': {
        const orderSn = msgObj.order_id || msgObj.order_sn || msgObj.ordersn || (message as any).order_id || (message as any).order_sn || rawText;
        const idEcommerce = msgObj.id_ecommerce || (message as any).id_ecommerce || 0;
        if (orderSn) {
          return renderOrderCard(orderSn, idEcommerce, rawText && rawText !== orderSn ? rawText : undefined);
        }
        return (
          <View>
            <View style={styles.orderContainer}>
              <Ionicons name="receipt-outline" size={20} color="#3B82F6" />
              <Text style={styles.orderText}>Pesanan</Text>
            </View>
            {rawText ? (
              <Text style={[styles.messageText, isSeller && styles.messageTextSeller]}>
                {rawText}
              </Text>
            ) : null}
          </View>
        );
      }

      case 'unsupported':
        return (
          <View style={styles.unsupportedContainer}>
            <Ionicons name="alert-circle-outline" size={16} color="#9CA3AF" />
            <Text style={styles.unsupportedText}>Format pesan tidak didukung</Text>
          </View>
        );

      default:
        return (
          <Text style={[styles.messageText, isSeller && styles.messageTextSeller]}>
            {rawText || 'Pesan E-Commerce'}
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
  // Order Bubble Card Styles
  orderCardWrapper: {
    width: '100%',
    minWidth: 230,
    maxWidth: 290,
  },
  orderBubbleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  orderBubbleCardSeller: {
    backgroundColor: '#FFFBEB',
  },
  orderBubbleCardBuyer: {
    backgroundColor: '#FFFFFF',
  },
  orderBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderBubbleIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBubbleHeaderText: {
    flex: 1,
  },
  orderBubbleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  orderBubbleSubtitle: {
    fontSize: 10,
    color: '#6B7280',
  },
  orderBubbleDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  orderBubbleBody: {
    marginBottom: 6,
  },
  orderBubbleLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  orderBubbleValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  orderBubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  orderBubbleActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
});

export default ChatMessage;

