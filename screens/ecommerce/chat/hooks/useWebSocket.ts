import { useEffect, useId } from 'react';
import {
  IWebSocketChatEvent,
  IWebSocketReplyEvent,
  IUseWebSocketReturn,
} from '../types/chat.types';
import { useGlobalChat } from '../../../../context/ChatContext';

/**
 * Custom hook for WebSocket connection
 * Wraps the global ChatContext to provide screen-specific listeners
 */
export const useWebSocket = (
  onChatReceived?: (event: IWebSocketChatEvent) => void,
  onReplyReceived?: (event: IWebSocketReplyEvent) => void
): IUseWebSocketReturn => {
  const { connected, error, connect, disconnect, subscribe, unsubscribe } = useGlobalChat();
  const id = useId();

  useEffect(() => {
    // Subscribe to global chat events
    subscribe({
      id,
      onChat: onChatReceived,
      onReply: onReplyReceived,
    });

    return () => {
      // Unsubscribe on unmount
      unsubscribe(id);
    };
  }, [id, subscribe, unsubscribe, onChatReceived, onReplyReceived]);

  return {
    connected,
    error,
    connect,
    disconnect,
  };
};
