import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useAuth } from './AuthContext';

// NOTE: bukan wss://ws-1706.plexseller.com:99 — domain itu diproxy ke service webhook/printer
// (ps_webhook-koi-1), bukan ke server utama yang punya room `orders:${database_name}`.
const WEBSOCKET_URL = 'wss://app.plexseller.com';
const STORAGE_KEY = 'orderAlarmEnabled';

export interface INewOrderEvent {
  id_ecommerce: number;
  order_id: string;
  platform: string;
  buyer: string;
  total: string;
  items: string[];
}

interface OrderAlarmContextProps {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  activeOrder: INewOrderEvent | null;
  dismiss: () => void;
}

const OrderAlarmContext = createContext<OrderAlarmContextProps | undefined>(undefined);

export const OrderAlarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabled, setEnabledState] = useState(false);
  const [activeOrder, setActiveOrder] = useState<INewOrderEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const databaseNameRef = useRef<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Load persisted toggle (default OFF — must be explicitly enabled by user)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value !== null) setEnabledState(value === 'true');
    });
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  }, []);

  const dismiss = useCallback(() => {
    setActiveOrder(null);
  }, []);

  const subscribeToOrders = useCallback(async (socket: Socket) => {
    try {
      const result = await ApiService.getCurrentDatabase();
      if (result.status && result.data) {
        databaseNameRef.current = result.data;
        socket.emit('orders:subscribe', { database_name: result.data });
      }
    } catch (err) {
      console.error('❌ [OrderAlarmContext] Failed to resolve database_name:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log('🔌 [OrderAlarmContext] Connecting to WebSocket...', WEBSOCKET_URL);
    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('✅ [OrderAlarmContext] Connected to WebSocket');
      // Re-subscribe on every (re)connect — server does not persist room membership across reconnects
      subscribeToOrders(socket);
    });

    socket.on('new_order', (event: INewOrderEvent) => {
      console.log('🔔 [OrderAlarmContext] New order received:', event);
      setActiveOrder(event);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ [OrderAlarmContext] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ [OrderAlarmContext] Disconnected from WebSocket:', reason);
    });

    socketRef.current = socket;

    return () => {
      if (databaseNameRef.current) {
        socket.emit('orders:unsubscribe', { database_name: databaseNameRef.current });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, subscribeToOrders]);

  return (
    <OrderAlarmContext.Provider
      value={{
        enabled,
        setEnabled,
        // Toggle is enforced here too (not just at trigger time) so a disabled toggle
        // never surfaces an alarm even if an event slips in right as it's switched off.
        activeOrder: enabled ? activeOrder : null,
        dismiss,
      }}
    >
      {children}
    </OrderAlarmContext.Provider>
  );
};

export const useOrderAlarm = () => {
  const context = useContext(OrderAlarmContext);
  if (context === undefined) {
    throw new Error('useOrderAlarm must be used within an OrderAlarmProvider');
  }
  return context;
};
