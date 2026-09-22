import ApiService from '../api';
import { navigationRef } from '../../navigation/navigationRef';
import { IGetChatListResponse } from '../../screens/ecommerce/chat/types/chat.types';

/**
 * Opens the right chat conversation when a "new chat" push notification is tapped.
 * Reuses the same buyer-lookup pattern as ChatContext.tsx's showChatNotification
 * (the FCM payload only carries id_ecommerce/buyer_id, not msg_id, so the exact
 * conversation is resolved client-side from the live chat list).
 */
export async function openChatFromNotification(idEcommerce: string, buyerId: string): Promise<void> {
  if (!navigationRef.isReady()) return;

  try {
    const data: IGetChatListResponse = await ApiService.authenticatedRequest(
      `/get/ecommerce/chats?id_ecommerce=${idEcommerce}`
    );
    const chat = data.status && data.data
      ? data.data.find((c) => String(c.buyer?.id) === String(buyerId))
      : null;

    if (chat) {
      (navigationRef as any).navigate('EcommerceChat', {
        screen: 'EcommerceChatDetail',
        params: {
          msgId: chat.msg_id,
          idEcommerce: chat.id_ecommerce,
          buyer: chat.buyer,
          platform: chat.platform,
          shopName: chat.shop_name || chat.toko_name || chat.name_ecommerce || chat.name,
        },
      });
      return;
    }
  } catch (err) {
    console.warn('[chatNotificationNav] Failed to resolve chat, opening chat list instead:', err);
  }

  // Fallback: conversation not found (race condition, etc.) — still land in the chat list
  (navigationRef as any).navigate('EcommerceChat', { screen: 'EcommerceChatMain' });
}
