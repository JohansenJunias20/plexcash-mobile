import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  IWebSocketChatEvent,
  IWebSocketReplyEvent,
  IUseWebSocketReturn,
} from '../types/chat.types';

const WEBSOCKET_URL = 'wss://ws-1706.plexseller.com:99';

/**
 * Custom hook for WebSocket connection
 * Handles real-time chat updates
 */
export const useWebSocket = (
  onChatReceived?: (event: IWebSocketChatEvent) => void,
  onReplyReceived?: (event: IWebSocketReplyEvent) => void
): IUseWebSocketReturn => {
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const onChatReceivedRef = useRef(onChatReceived);
  const onReplyReceivedRef = useRef(onReplyReceived);

  // Update refs when callbacks change
  useEffect(() => {
    onChatReceivedRef.current = onChatReceived;
    onReplyReceivedRef.current = onReplyReceived;
  }, [onChatReceived, onReplyReceived]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 [useWebSocket] Disconnecting from WebSocket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  /**
   * Auto-connect on mount and cleanup on unmount
   */
  useEffect(() => {
    // Prevent multiple connections
    if (socketRef.current) {
      console.log('⚠️ [useWebSocket] Socket already exists, skipping connection');
      return;
    }

    try {
      console.log('🔌 [useWebSocket] Connecting to WebSocket...', WEBSOCKET_URL);

      // Create socket connection
      const socket = io(WEBSOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      // Connection event handlers
      socket.on('connect', () => {
        console.log('✅ [useWebSocket] Connected to WebSocket');
        setConnected(true);
        setError(null);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ [useWebSocket] Disconnected from WebSocket:', reason);
        setConnected(false);
      });

      socket.on('connect_error', (err) => {
        console.error('❌ [useWebSocket] Connection error:', err.message);
        setError(err.message);
        setConnected(false);
      });

      socket.on('error', (err) => {
        console.error('❌ [useWebSocket] Socket error:', err);
        setError(err.message || 'WebSocket error');
      });

      // Chat event handlers
      socket.on('chat', (event: IWebSocketChatEvent) => {
        console.log('💬 [useWebSocket] New chat received:', event);
        if (onChatReceivedRef.current) {
          onChatReceivedRef.current(event);
        }
      });

      socket.on('reply', (event: IWebSocketReplyEvent) => {
        console.log('💬 [useWebSocket] New reply received:', event);
        if (onReplyReceivedRef.current) {
          onReplyReceivedRef.current(event);
        }
      });

      socketRef.current = socket;
    } catch (err: any) {
      console.error('❌ [useWebSocket] Error creating socket:', err);
      setError(err.message || 'Failed to create WebSocket connection');
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('🔌 [useWebSocket] Cleaning up WebSocket connection...');
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Manual connect function (if needed)
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('⚠️ [useWebSocket] Already connected');
      return;
    }

    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  return {
    connected,
    error,
    connect,
    disconnect,
  };
};

