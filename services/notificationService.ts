import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './api';

const FCM_TOKEN_STORAGE_KEY = 'plexseller_fcm_token';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

/**
 * Configure Android notification channels
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // High-priority channel for new order alerts
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Pesanan Baru & Transaksi',
      description: 'Notifikasi saat ada pesanan baru masuk dari marketplace atau POS',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f59e0b',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Channel for new chat messages from buyers
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Pesan Chat Baru',
      description: 'Notifikasi saat ada pesan chat baru dari pembeli',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f59e0b',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Default channel for general system updates
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Pemberitahuan Umum',
      description: 'Informasi status sistem, stok, dan akun',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    console.log('✅ [NotificationService] Android notification channels configured');
  } catch (error) {
    console.warn('⚠️ [NotificationService] Failed to set up notification channels:', error);
  }
}

/**
 * Request notification permissions and fetch native FCM token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // 1. Setup Android channels
    await setupNotificationChannels();

    // 2. Request / verify permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('ℹ️ [NotificationService] Notification permission not granted:', finalStatus);
      return null;
    }

    // 3. Get native device push token (FCM registration token on Android)
    let token: string | null = null;
    try {
      const tokenResult = await Notifications.getDevicePushTokenAsync();
      token = tokenResult.data;
      console.log('📱 [NotificationService] Native Device Push Token (FCM):', token);
    } catch (fcmError) {
      console.warn('⚠️ [NotificationService] Could not fetch native device push token directly:', fcmError);
      // Fallback: try Expo Push Token if device push token is unavailable
      try {
        const expoTokenResult = await Notifications.getExpoPushTokenAsync();
        token = expoTokenResult.data;
        console.log('📱 [NotificationService] Fallback Expo Push Token:', token);
      } catch (expoError) {
        console.warn('⚠️ [NotificationService] Could not fetch fallback push token:', expoError);
      }
    }

    if (token) {
      await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      // Automatically sync with backend if user is already authenticated
      syncFcmTokenWithBackend(token).catch(err => {
        console.warn('⚠️ [NotificationService] Failed to auto-sync token with backend:', err);
      });
    }

    return token;
  } catch (error) {
    console.error('❌ [NotificationService] Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Get cached FCM token from local storage
 */
export async function getStoredFcmToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Send the FCM token to the backend server to associate with the current authorized device
 */
export async function syncFcmTokenWithBackend(token?: string): Promise<boolean> {
  try {
    const fcmToken = token || (await getStoredFcmToken());
    if (!fcmToken) {
      console.log('ℹ️ [NotificationService] No FCM token available to sync');
      return false;
    }

    const response = await ApiService.updateFcmToken(fcmToken);
    if (response && response.success) {
      console.log('✅ [NotificationService] FCM token successfully synced to backend');
      return true;
    } else {
      console.warn('⚠️ [NotificationService] Backend returned error syncing FCM token:', response?.message);
      return false;
    }
  } catch (error) {
    console.error('❌ [NotificationService] Exception syncing FCM token to backend:', error);
    return false;
  }
}

/**
 * Setup listeners for incoming notifications and user interaction
 */
export function addNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
): () => void {
  // Listener when notification is received while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('🔔 [NotificationService] Notification received (foreground):', notification.request.content);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener when user taps / interacts with notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 [NotificationService] Notification clicked by user:', response.notification.request.content);
    if (onNotificationResponse) {
      onNotificationResponse(response);
    }
  });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Helper to trigger a local test notification
 */
export async function sendLocalTestNotification(title: string = 'Test Notifikasi', body: string = 'Push notifikasi PlexSeller berhasil diinisialisasi!'): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: 'test_notification', timestamp: Date.now() },
    },
    trigger: null, // immediately
  });
}
