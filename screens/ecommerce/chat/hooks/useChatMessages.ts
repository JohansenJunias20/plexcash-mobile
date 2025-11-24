import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import ApiService from '../../../../services/api';
import {
  IChatDetail,
  IGetChatMessagesResponse,
  ISendChatResponse,
  IUseChatMessagesReturn,
} from '../types/chat.types';

/**
 * Custom hook for managing chat messages
 * Handles fetching messages, sending text/images
 */
export const useChatMessages = (
  msgId: string,
  idEcommerce: number,
  buyerId?: string
): IUseChatMessagesReturn => {
  const [messages, setMessages] = useState<IChatDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch chat messages from API
   */
  const fetchMessages = useCallback(async () => {
    if (!msgId || !idEcommerce) {
      console.log('⚠️ [useChatMessages] Missing msgId or idEcommerce');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📱 [useChatMessages] Fetching messages...', {
        msgId,
        idEcommerce,
      });

      const data: IGetChatMessagesResponse = await ApiService.authenticatedRequest(
        `/get/ecommerce/chat?msg_id=${msgId}&id_ecommerce=${idEcommerce}`,
        {
          method: 'GET',
        }
      );

      console.log('📱 [useChatMessages] Data received:', {
        status: data.status,
        count: data.data?.length || 0,
      });

      if (data.status && data.data) {
        // Handle case where data.data might not be an array
        const messagesArray = Array.isArray(data.data) ? data.data : [];

        // Transform API data to expected format
        // DO NOT group by message_id - each message should be displayed separately
        const transformedMessages: any[] = messagesArray.map((item: any) => {
          // If msg already exists and is valid, use it
          if (item.msg && typeof item.msg === 'object') {
            return item;
          }

          // SPECIAL CASE: Lazada/Tiktok product messages come as single message with type="product"
          // and already have product_image, product_price, product_url fields
          if (item.type === 'product') {
            const msg: any = {
              type: 'product',
              text: item.content || '',
              product_image: item.product_image || '',
              product_price: item.product_price || '',
              product_url: item.product_url || '',
              product_id: item.product_id || '',
            };

            console.log('🛍️ [useChatMessages] Lazada/Tiktok product message:', {
              message_id: item.message_id || item.id,
              product_name: msg.text,
              product_image: msg.product_image,
              product_price: msg.product_price,
              has_image: !!msg.product_image,
            });

            return {
              ...item,
              msg,
            };
          }

          // Transform flat structure to nested structure
          // Detect sticker: backend sends sticker as type="image" but with sticker_url field or message_type="sticker"
          const isSticker = (item as any).sticker_url || (item as any).message_type === 'sticker';

          const msg: any = {
            type: item.type === 'chat' ? 'text' : isSticker ? 'sticker' : item.type,
            text: item.content || item.msg || item.msg_shopee || '',
          };

          // Add type-specific fields
          if (isSticker) {
            // Sticker: use sticker_url or content
            msg.sticker_url = item.content || (item as any).sticker_url || (item as any).image_url;
            msg.text = ''; // Stickers don't have text
          } else if (item.type === 'image') {
            // Regular image
            msg.image = item.content || (item as any).image || (item as any).image_url;
          } else if (item.type === 'sticker') {
            // Fallback for old sticker format (should not happen with current backend)
            msg.sticker_url = item.content || (item as any).sticker_url || (item as any).image_url;
            msg.text = ''; // Stickers don't have text
          } else if (item.type === 'order') {
            msg.order_id = (item as any).order_id;
          } else if (item.type === 'refund') {
            msg.refund_id = (item as any).refund_id;
          }

          return {
            ...item,
            msg,
          };
        });

        // Sort by timestamp (oldest first for chat display)
        const sortedMessages = transformedMessages.sort((a, b) => a.timestamp - b.timestamp);

        setMessages(sortedMessages);
        console.log('✅ [useChatMessages] Messages loaded:', sortedMessages.length);
      } else {
        throw new Error(data.reason || 'Failed to fetch messages');
      }
    } catch (err: any) {
      console.error('❌ [useChatMessages] Error fetching messages:', err);
      setError(err.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [msgId, idEcommerce]);

  /**
   * Send text message
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        console.log('⚠️ [useChatMessages] Empty message, skipping send');
        return;
      }

      try {
        console.log('📤 [useChatMessages] Sending text message...', {
          text,
          buyerId,
          msgId,
          idEcommerce
        });

        // Build request body - include 'to' parameter for Shopee
        const requestBody: any = {
          content: text,
          type: 'chat',
        };

        // Add 'to' parameter if buyerId is provided (required for Shopee)
        if (buyerId) {
          requestBody.to = buyerId;
        }

        console.log('📤 [useChatMessages] Request payload:', requestBody);

        const data: ISendChatResponse = await ApiService.authenticatedRequest(
          `/ecommerce/chat/reply?id_ecommerce=${idEcommerce}&msg_id=${msgId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        console.log('📡 [useChatMessages] Send response:', {
          status: data.status,
          reason: data.reason,
          reasonType: typeof data.reason,
          reasonIsEmpty: data.reason && typeof data.reason === 'object' && Object.keys(data.reason).length === 0,
        });

        // Backend returns status: false even when message sends successfully
        // Check if reason is empty object {} as indicator of success
        const isEmptyReason = data.reason && typeof data.reason === 'object' && Object.keys(data.reason).length === 0;

        if (data.status || isEmptyReason) {
          console.log('✅ [useChatMessages] Message sent successfully (status or empty reason)');
          // Refresh messages to show the new message
          await fetchMessages();
        } else {
          // Only throw error if there's an actual error message
          const errorMsg = typeof data.reason === 'string' ? data.reason : 'Failed to send message';
          throw new Error(errorMsg);
        }
      } catch (err: any) {
        console.error('❌ [useChatMessages] Error sending message:', err);
        throw err;
      }
    },
    [msgId, idEcommerce, fetchMessages]
  );

  /**
   * Send image message
   */
  const sendImage = useCallback(
    async (imageUri: string) => {
      try {
        console.log('📤 [useChatMessages] Sending image...', { imageUri });

        // Convert image to base64
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const reader = new FileReader();

        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = reader.result as string;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const base64Image = await base64Promise;

        // Build request body - include 'to' parameter for Shopee
        const requestBody: any = {
          content: base64Image,
          type: 'image',
        };

        // Add 'to' parameter if buyerId is provided (required for Shopee)
        if (buyerId) {
          requestBody.to = buyerId;
        }

        console.log('📤 [useChatMessages] Send image request payload:', {
          type: requestBody.type,
          has_to: !!requestBody.to,
          buyerId,
        });

        const data: ISendChatResponse = await ApiService.authenticatedRequest(
          `/ecommerce/chat/reply?id_ecommerce=${idEcommerce}&msg_id=${msgId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        console.log('📡 [useChatMessages] Send image response:', {
          status: data.status,
          reason: data.reason,
          reasonIsEmpty: data.reason && typeof data.reason === 'object' && Object.keys(data.reason).length === 0,
        });

        // Backend returns status: false even when image sends successfully
        // Check if reason is empty object {} as indicator of success
        const isEmptyReason = data.reason && typeof data.reason === 'object' && Object.keys(data.reason).length === 0;

        if (data.status || isEmptyReason) {
          console.log('✅ [useChatMessages] Image sent successfully (status or empty reason)');
          // Refresh messages to show the new image
          await fetchMessages();
        } else {
          // Only throw error if there's an actual error message
          const errorMsg = typeof data.reason === 'string' ? data.reason : 'Failed to send image';
          throw new Error(errorMsg);
        }
      } catch (err: any) {
        console.error('❌ [useChatMessages] Error sending image:', err);
        throw err;
      }
    },
    [msgId, idEcommerce, fetchMessages]
  );

  /**
   * Send product message
   * @param productId - The product ID to send
   */
  const sendProduct = useCallback(
    async (productId: string) => {
      if (!msgId || !idEcommerce) {
        console.error('❌ [useChatMessages] Cannot send product: missing msgId or idEcommerce');
        return;
      }

      try {
        console.log('📦 [useChatMessages] Sending product message...', {
          productId,
          buyerId,
          msgId,
          idEcommerce,
        });

        // Build request body
        const requestBody: any = {
          content: productId,
          type: 'product',
        };

        // Add 'to' parameter if buyerId is provided (required for Shopee)
        if (buyerId) {
          requestBody.to = buyerId;
        }

        console.log('📦 [useChatMessages] Send product request payload:', requestBody);

        const data: ISendChatResponse = await ApiService.authenticatedRequest(
          `/ecommerce/chat/reply?id_ecommerce=${idEcommerce}&msg_id=${msgId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        console.log('📡 [useChatMessages] Send product response:', data);

        // Note: Some platforms return status: false even when product is sent successfully
        // We'll refresh messages regardless to check if the product was actually sent
        console.log('🔄 [useChatMessages] Refreshing messages to verify product was sent...');
        await fetchMessages();

        // Check if status is false with a meaningful error reason
        if (!data.status && data.reason && typeof data.reason === 'string' && data.reason.trim() !== '') {
          console.warn('⚠️ [useChatMessages] API returned status: false, but product may have been sent. Reason:', data.reason);
          // Don't throw error - product might still be sent successfully
        } else if (!data.status) {
          console.log('ℹ️ [useChatMessages] API returned status: false with empty/no reason - product likely sent successfully');
        } else {
          console.log('✅ [useChatMessages] Product sent successfully (status: true)');
        }
      } catch (err: any) {
        console.error('❌ [useChatMessages] Error sending product:', {
          error: err.message || err,
          stack: err.stack,
        });
        // Don't re-throw - let the UI handle it gracefully
        // The product might have been sent despite the error
      }
    },
    [msgId, idEcommerce, buyerId, fetchMessages]
  );

  /**
   * Refresh messages
   */
  const refresh = useCallback(async () => {
    await fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    sendImage,
    sendProduct,
    refresh,
  };
};

