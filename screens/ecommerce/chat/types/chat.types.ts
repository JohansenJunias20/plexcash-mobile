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

export interface IChatFilters {
  platform: PlatformFilter;
  readStatus: ReadStatusFilter;
  searchQuery: string;
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
  disabled?: boolean;
  placeholder?: string;
}

export interface IChatHeaderProps {
  buyer: IChatBuyer;
  platform: string;
  onBack: () => void;
}

// ============================================
// HOOK RETURN TYPES
// ============================================

export interface IUseChatListReturn {
  chats: IChatList[];
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

export interface IUseWebSocketReturn {
  connected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

