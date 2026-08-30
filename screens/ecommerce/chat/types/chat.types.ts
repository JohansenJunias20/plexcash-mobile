/**
 * Type definitions for E-commerce Chat feature
 * Based on Server/API/interfaces/EcommerceInterfaces.d.ts
 */

// ============================================
// CHAT LIST TYPES
// ============================================

export interface IChatBuyer {
  name: string;
  id: string;
  thumbnail_url: string;
}

export interface IChatList {
  buyer: IChatBuyer;
  unread_count: number;
  msg_id: string;
  id_ecommerce: number;
  timestamp: number;
  chat: string;
  isRead: boolean;
  platform: string; // "SHOPEE" | "LAZADA" | "TOKOPEDIA" | "TIKTOK"
  last_message_type?: string; // Optional: "text" | "image" | "product" | etc. (for future server support)
  last_message_from_seller?: boolean; // true jika pesan terakhir dari seller, false jika dari buyer
  last_sender?: 'seller' | 'buyer';   // 'seller' | 'buyer'
  shop_name?: string;
  toko_name?: string;
  name_ecommerce?: string;
  name?: string;
}

// ============================================
// CHAT MESSAGE TYPES
// ============================================

export type MessageType = "text" | "image" | "product" | "sticker" | "order" | "refund" | "unsupported";
export type MessageFrom = "buyer" | "seller" | "system";

export interface IChatMessageContent {
  type: MessageType;
  text?: string;
  image?: string; // URL for image messages
  sticker_url?: string; // URL for sticker messages
  product_id?: string;
  product_image?: string; // Product image URL
  product_price?: string; // Product price (formatted string)
  product_url?: string; // Product URL
  order_id?: string;
  refund_id?: string;
}

export interface IChatDetail {
  from: MessageFrom;
  id: string;
  timestamp: number;
  msg: IChatMessageContent;
  isRead: boolean;
  msg_id: string;
  name: string;
  thumbnail_url: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface IGetChatListResponse {
  status: boolean;
  data: IChatList[];
  reason?: string;
}

export interface IGetChatMessagesResponse {
  status: boolean;
  data: IChatDetail[];
  reason?: string;
}

export interface ISendChatResponse {
  status: boolean;
  data?: any;
  reason?: string;
}

// ============================================
// WEBSOCKET EVENT TYPES
// ============================================

export interface IWebSocketChatEvent {
  msg_id: string;
  shop_id: string;
}

export interface IWebSocketReplyEvent {
  msg_id: string;
  shop_id: string;
}

// ============================================
// FILTER & SEARCH TYPES
// ============================================

export type PlatformFilter = "ALL" | "SHOPEE" | "LAZADA" | "TOKOPEDIA" | "TIKTOK";
export type ReadStatusFilter = "ALL" | "READ" | "UNREAD";
export type ReplyStatusFilter = "ALL" | "UNREPLIED" | "REPLIED";

export interface IChatFilters {
  platform: PlatformFilter;
  readStatus: ReadStatusFilter;
  replyStatus: ReplyStatusFilter;
  searchQuery: string;
  selectedShopId?: number | 'ALL';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Helper function to determine whether a conversation is replied by seller or not
 */
export function isChatReplied(chat: IChatList, cachedMessages?: any[]): boolean {
  if (!chat) return false;
  // 1. Jika pesan detail untuk chat ini ada di cache/state lokal:
  if (cachedMessages && cachedMessages.length > 0) {
    const lastMsg = cachedMessages[cachedMessages.length - 1];
    // Periksa apakah pesan terakhir dikirim oleh seller (fromMe / from === 'seller')
    return Boolean(lastMsg?.fromMe || lastMsg?.from === 'seller');
  }
  // 2. Gunakan properti dari backend API:
  if (typeof chat.last_message_from_seller === 'boolean') {
    return chat.last_message_from_seller;
  }
  if (chat.last_sender === 'seller') return true;
  if (chat.last_sender === 'buyer') return false;
  // 3. Fallback: jika ada pesan belum dibaca (unread > 0), berarti buyer mengirim pesan -> belum dibalas
  if (chat.unread_count && chat.unread_count > 0) {
    return false;
  }
  return chat.isRead !== false;
}

// ============================================
// CHAT TEMPLATE & GROUP TYPES
// ============================================

export interface IChatTemplate {
  id: number | string;
  group_id?: number | string | null;
  group_name?: string | null;
  title: string;
  shortcut?: string;
  content: string;
  sort_order?: number;
}

export interface IChatTemplateGroup {
  id: number | string;
  name: string;
  sort_order?: number;
  templates: IChatTemplate[];
}

export interface IGetChatTemplatesResponse {
  status?: boolean;
  success?: boolean;
  groups?: IChatTemplateGroup[];
  templates?: IChatTemplate[];
  ungrouped?: IChatTemplate[];
  data?: {
    groups?: IChatTemplateGroup[];
    templates?: IChatTemplate[];
    ungrouped?: IChatTemplate[];
  } | IChatTemplate[];
  reason?: string;
  message?: string;
}

// ============================================
// COMPONENT PROPS TYPES
// ============================================

export interface IChatListItemProps {
  chat: IChatList;
  onPress: (chat: IChatList) => void;
  isSelected?: boolean;
}

export interface IChatMessageProps {
  message: IChatDetail;
  isCurrentUser: boolean;
}

export interface IChatInputProps {
  onSendText: (text: string) => void;
  onSendImage: (imageUri: string) => void;
  onSendMultipleImages?: (imageUris: string[]) => void; // Optional: for multiple image selection
  onToggleOrderList?: () => void; // Optional: toggle order list panel
  onToggleProductList?: () => void; // Optional: toggle product list panel
  onToggleTemplateList?: () => void; // Optional: toggle template list panel
  templates?: IChatTemplate[]; // Optional: list of templates for inline shortcut expansion
  insertedText?: string | null; // Optional: text passed to insert/replace into input
  onClearInsertedText?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface IChatHeaderProps {
  buyer: IChatBuyer;
  platform: string;
  shopName?: string;
  onBack: () => void;
}

export interface IChatTemplatePanelProps {
  visible: boolean;
  groups: IChatTemplateGroup[];
  templates: IChatTemplate[];
  ungrouped: IChatTemplate[];
  loading: boolean;
  onClose: () => void;
  onSelectTemplate: (template: IChatTemplate, autoSend?: boolean) => void;
  onRefresh?: () => void;
}

// ============================================
// HOOK RETURN TYPES
// ============================================

export interface IUseChatListReturn {
  chats: IChatList[];
  rawChats: IChatList[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  filters: IChatFilters;
  setFilters: (filters: IChatFilters) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export interface IUseChatMessagesReturn {
  messages: IChatDetail[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendImage: (imageUri: string) => Promise<void>;
  sendProduct: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface IUseChatTemplatesReturn {
  groups: IChatTemplateGroup[];
  templates: IChatTemplate[];
  ungrouped: IChatTemplate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface IUseWebSocketReturn {
  connected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

