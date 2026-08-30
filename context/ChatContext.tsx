import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { showMessage } from 'react-native-flash-message';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import ApiService from '../services/api';
import { 
  IWebSocketChatEvent, 
  IWebSocketReplyEvent, 
  IGetChatListResponse 
} from '../screens/ecommerce/chat/types/chat.types';
import { useAuth } from './AuthContext';

const WEBSOCKET_URL = 'wss://ws-1706.plexseller.com:99';

type ChatListener = {
  id: string;
  onChat?: (event: IWebSocketChatEvent) => void;
  onReply?: (event: IWebSocketReplyEvent) => void;
};

interface ChatContextProps {
  connected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (listener: ChatListener) => void;
  unsubscribe: (id: string) => void;
  currentActiveChatMsgId: string | null;
  setCurrentActiveChatMsgId: (msgId: string | null) => void;
}

const ChatContext = createContext<ChatContextProps | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentActiveChatMsgId, setCurrentActiveChatMsgId] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<ChatListener[]>([]);
  const currentActiveChatMsgIdRef = useRef<string | null>(null);
  const navigation = useNavigation<NavigationProp<any>>();
  const { isAuthenticated } = useAuth();

  // Keep ref in sync with state for use inside callbacks
  useEffect(() => {
    currentActiveChatMsgIdRef.current = currentActiveChatMsgId;
  }, [currentActiveChatMsgId]);

  const showChatNotification = async (event: IWebSocketChatEvent) => {
    try {
      // Don't show notification if we are already viewing this chat
      if (currentActiveChatMsgIdRef.current === event.msg_id) {
        return;
      }

      console.log('🔔 [ChatContext] Fetching chat details for notification...', event.msg_id);
      
      // Fetch chat list to get buyer details
      const data: IGetChatListResponse = await ApiService.authenticatedRequest('/get/ecommerce/chats', {
        method: 'GET',
      });

      if (data.status && data.data) {
        const chat = data.data.find(c => c.msg_id === event.msg_id);
        if (chat) {
          let chatDesc = 'Ada pesan masuk.';
          if (typeof chat.chat === 'string' && chat.chat.trim()) {
            chatDesc = chat.chat;
          } else if (chat.chat && typeof chat.chat === 'object') {
            const chatObj: any = chat.chat;
            chatDesc = chatObj.text || chatObj.content || chatObj.msg || 'Ada pesan masuk.';
          }

          showMessage({
            message: `Pesan Baru dari ${chat.buyer?.name || 'Pembeli'}`,
            description: chatDesc,
            type: "info",
            icon: "info",
            duration: 5000,
            onPress: () => {
              // Redirect to EcommerceChatDetail
              navigation.navigate('EcommerceChat', {
                screen: 'EcommerceChatDetail',
                params: {
                  msgId: chat.msg_id,
                  idEcommerce: chat.id_ecommerce,
                  buyer: chat.buyer,
                  platform: chat.platform,
                  shopName: chat.shop_name || chat.toko_name || chat.name_ecommerce || chat.name,
                }
              });
            }
          });
        }
      }
    } catch (err) {
      console.error('❌ [ChatContext] Error displaying notification:', err);
    }
  };

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 [ChatContext] Disconnecting from WebSocket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('⚠️ [ChatContext] Already connected');
      return;
    }

    if (socketRef.current) {
      socketRef.current.connect();
      return;
    }

    try {
      console.log('🔌 [ChatContext] Connecting to WebSocket...', WEBSOCKET_URL);

      const socket = io(WEBSOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      socket.on('connect', () => {
        console.log('✅ [ChatContext] Connected to WebSocket');
        setConnected(true);
        setError(null);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ [ChatContext] Disconnected from WebSocket:', reason);
        setConnected(false);
      });

      socket.on('connect_error', (err) => {
        console.error('❌ [ChatContext] Connection error:', err.message);
        setError(err.message);
        setConnected(false);
      });

      socket.on('error', (err) => {
        console.error('❌ [ChatContext] Socket error:', err);
        setError(err.message || 'WebSocket error');
      });

      socket.on('chat', (event: IWebSocketChatEvent) => {
        console.log('💬 [ChatContext] New chat received:', event);
        
        // Notify all subscribers
        listenersRef.current.forEach(listener => {
          if (listener.onChat) listener.onChat(event);
        });

        // Show push notification
        showChatNotification(event);
      });

      socket.on('reply', (event: IWebSocketReplyEvent) => {
        console.log('💬 [ChatContext] New reply received:', event);
        
        // Notify all subscribers
        listenersRef.current.forEach(listener => {
          if (listener.onReply) listener.onReply(event);
        });
        
        // Show push notification for reply as well
        showChatNotification(event);
      });

      socketRef.current = socket;
    } catch (err: any) {
      console.error('❌ [ChatContext] Error creating socket:', err);
      setError(err.message || 'Failed to create WebSocket connection');
    }
  }, [navigation]);

  // Connect automatically when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  const subscribe = useCallback((listener: ChatListener) => {
    listenersRef.current.push(listener);
  }, []);

  const unsubscribe = useCallback((id: string) => {
    listenersRef.current = listenersRef.current.filter(l => l.id !== id);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        connected,
        error,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
        currentActiveChatMsgId,
        setCurrentActiveChatMsgId
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useGlobalChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useGlobalChat must be used within a ChatProvider');
  }
  return context;
};
