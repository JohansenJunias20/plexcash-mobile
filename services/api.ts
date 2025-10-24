// API service for communicating with the Plexcash backend
// Enhanced with persistent device authorization system

// Get API base URL from environment variable
// TEMPORARY FIX: Use computer's IP address for mobile device access
export const API_BASE_URL = "https://app.plexseller.com";
// export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:80';

// Debug: Log the actual environment variables being used
console.log('[API] Environment Debug:', {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  API_BASE_URL_ENV: process.env.API_BASE_URL,
  Final_API_BASE_URL: API_BASE_URL,
  FORCED_TO_IP: '192.168.1.210:80'
});

// For development/testing - set this to true to simulate successful backend responses
const SIMULATE_BACKEND = process.env.EXPO_PUBLIC_SIMULATE_BACKEND === 'true' || process.env.SIMULATE_BACKEND === 'true' || false;

// Debug mode for additional logging
const DEBUG_MODE = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || process.env.DEBUG_MODE === 'true' || false;

// Helper function for debug logging
const debugLog = (message: string, data: any = null) => {
  if (DEBUG_MODE) {
    console.log(`[API Debug] ${message}`, data || '');
  }
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getTokenAuth, setTokenAuth, clearTokenAuth } from './token';

// Optional imports with fallbacks
let Device: any = null;
let Constants: any = null;

try {
  Device = require('expo-device');
} catch (error) {
  console.warn('expo-device not available, using fallback device info');
}

try {
  Constants = require('expo-constants');
} catch (error) {
  console.warn('expo-constants not available, using fallback constants');
}

type AuthorizeDeviceResponse = {
  success: boolean;
  user?: { email: string; name?: string };
  token?: string;
  authToken?: string;
  deviceId?: string;
  message?: string;
};

class ApiService {
  private static authErrorHandler: null | (() => void) = null;

  static setAuthErrorHandler(handler: () => void) {
    this.authErrorHandler = handler;
  }
  /**
   * Get comprehensive device information
   */
  static async getDeviceInfo() {
    try {
      const deviceId = await this.getOrCreateDeviceId();

      // Get device info with fallbacks
      let deviceName = 'Unknown Device';
      let model = 'Unknown';
      let brand = 'Unknown';
      let osVersion = 'Unknown';
      let appVersion = '1.0.0';

      if (Device) {
        deviceName = Device.deviceName || `${Device.brand || ''} ${Device.modelName || ''}`.trim() || 'Unknown Device';
        model = Device.modelName || 'Unknown';
        brand = Device.brand || 'Unknown';
        osVersion = Device.osVersion || (Platform as any).Version?.toString() || 'Unknown';
      } else {
        // Fallback when expo-device is not available
        osVersion = (Platform as any).Version?.toString() || 'Unknown';
        deviceName = `${Platform.OS} Device`;
      }

      if (Constants) {
        appVersion = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';
      }

      return {
        deviceId: deviceId,
        deviceName: deviceName,
        platform: Platform.OS,
        osVersion: osVersion,
        model: model,
        brand: brand,
        appVersion: appVersion,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        deviceId: await this.getOrCreateDeviceId(),
        deviceName: `${Platform.OS} Device`,
        platform: Platform.OS,
        osVersion: (Platform as any).Version?.toString() || 'Unknown',
        model: 'Unknown',
        brand: 'Unknown',
        appVersion: '1.0.0',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get or create a unique device identifier
   */
  static async getOrCreateDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');

      if (!deviceId) {
        // Generate a unique device ID
        deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }

      return deviceId;
    } catch (error) {
      console.error('Error managing device ID:', error);
      return `${Platform.OS}-${Date.now()}-fallback`;
    }
  }

  /**
   * Authorize device using QR code data (NEW - replaces authenticateWithQRCode)
   * This calls the new /auth/authorize-device endpoint for persistent authentication
   */
  static async authorizeDevice(qrCodeData: string): Promise<AuthorizeDeviceResponse> {
    try {
      console.log('Authorizing device with QR code:', qrCodeData.substring(0, 50) + '...');
      debugLog('API Base URL:', API_BASE_URL);
      debugLog('Simulate Backend:', SIMULATE_BACKEND);

      // Log QR data for debugging - backend expects milliseconds timestamp
      let processedQrData = qrCodeData;
      try {
        const parts = qrCodeData.split(':');
        if (parts.length >= 3 && parts[0] === 'plexcash-auth') {
          const timestamp = parseInt(parts[2]);
          const currentTime = Date.now();

          // Log timestamp format for debugging
          console.log('QR timestamp format check:', {
            timestamp,
            length: timestamp.toString().length,
            isMilliseconds: timestamp.toString().length === 13,
            isSeconds: timestamp.toString().length === 10
          });

          // Backend expects milliseconds - no conversion needed if QR already contains milliseconds
          processedQrData = qrCodeData; // Use original QR data as-is

          // Log the time difference for debugging
          const timeDiff = currentTime - timestamp;
          console.log('Time difference check:', {
            currentTime,
            qrTimestamp: timestamp,
            diff: timeDiff,
            diffSeconds: Math.round(timeDiff / 1000),
            diffMinutes: Math.round(timeDiff / 60000)
          });
        }
      } catch (timestampError) {
        console.warn('Failed to process QR timestamp, using original data:', timestampError);
      }

      const deviceInfo = await this.getDeviceInfo();
      debugLog('Device Info:', deviceInfo);

      const response = await fetch(`${API_BASE_URL}/auth/authorize-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData: processedQrData,
          deviceInfo: deviceInfo
        })
      });

      const resultText = await response.text();
      let result: any;
      try { result = JSON.parse(resultText); } catch { result = { success: false, message: resultText }; }
      debugLog('Authorize Device Response:', result);

      if (response.ok && result.success) {
        return {
          success: true,
          user: result.user,
          token: result.token,
          message: result.message,
          deviceId: result.deviceId,
        };
      } else {
        return {
          success: false,
          message: result.message || 'QR code authentication failed'
        };
      }
    } catch (error) {
      console.error('QR code authentication error1:', JSON.stringify(error));
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.'
      };
    }
  }

  /**
   * Store device authentication tokens securely
   */
  static async storeDeviceTokens(authData: { authToken?: string; token?: string; refreshToken?: string; deviceId?: string; user: { email: string } }) {
    try {
      const token = authData.authToken || authData.token || '';

      // Store in AsyncStorage (for device auth system)
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('refreshToken', authData.refreshToken || '');
      await AsyncStorage.setItem('deviceId', authData.deviceId || await this.getOrCreateDeviceId());
      await AsyncStorage.setItem('userEmail', authData.user.email);
      await AsyncStorage.setItem('isDeviceAuthorized', 'true');
      await AsyncStorage.setItem('authMethod', 'device');

      // ALSO store in SecureStore (for screens like Barang that expect it there)
      const { setTokenAuth } = require('./token');
      await setTokenAuth(token);

      console.log('🔐 [STORE] Device tokens stored in both AsyncStorage and SecureStore');
    } catch (error) {
      console.error('❌ [STORE] Error storing device tokens:', error);
      throw error;
    }
  }

  /**
   * Validate device authentication and refresh tokens if needed
   */
  static async validateDeviceAuth(): Promise<AuthorizeDeviceResponse & { user: { email: string } }> {
    try {
      console.log('🔍 [VALIDATE] Starting device validation');
      console.log('🔍 [VALIDATE] API_BASE_URL:', API_BASE_URL);

      const authToken = await AsyncStorage.getItem('authToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const deviceId = await AsyncStorage.getItem('deviceId');
      const isAuthorized = await AsyncStorage.getItem('isDeviceAuthorized');

      console.log('🔍 [VALIDATE] Storage data:', {
        hasAuthToken: !!authToken,
        hasDeviceId: !!deviceId,
        isAuthorized,
        deviceId: deviceId,
        authTokenPreview: authToken ? authToken.substring(0, 50) + '...' : null
      });

      if (!authToken || !deviceId || isAuthorized !== 'true') {
        console.log('❌ [VALIDATE] Device not authorized - missing required data');
        return { success: false, message: 'Device not authorized' } as any;
      }

      if (SIMULATE_BACKEND) {
        return {
          success: true,
          user: {
            email: (await AsyncStorage.getItem('userEmail')) || 'test@plexseller.com'
          },
          message: 'Device validation successful (simulated)'
        } as any;
      }

      console.log('🌐 [VALIDATE] Making request to:', `${API_BASE_URL}/auth/validate-device`);
      console.log('🌐 [VALIDATE] Request payload:', {
        hasAuthToken: !!authToken,
        hasRefreshToken: !!refreshToken,
        deviceId: deviceId
      });

      const response = await fetch(`${API_BASE_URL}/auth/validate-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authToken: authToken,
          refreshToken: refreshToken,
          deviceId: deviceId
        })
      });

      console.log('📡 [VALIDATE] Response status:', response.status);
      console.log('📡 [VALIDATE] Response statusText:', response.statusText);
      console.log('📡 [VALIDATE] Response ok:', response.ok);
      console.log('📡 [VALIDATE] Response headers:', Object.fromEntries(response.headers.entries()));

      let data: any;
      const responseText = await response.text();
      console.log('📡 [VALIDATE] Raw response length:', responseText.length);
      console.log('📡 [VALIDATE] Raw response (full):', responseText);

      try {
        data = JSON.parse(responseText);
        console.log('📡 [VALIDATE] Parsed JSON response:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('❌ [VALIDATE] Failed to parse JSON response, error:', e);
        console.log('❌ [VALIDATE] Response was not valid JSON, treating as error');
        data = { success: false, message: `Invalid response format: ${responseText}` };
      }

      if (response.ok && data.success) {
        console.log('✅ [VALIDATE] Device validation successful');
        if (data.authToken && data.authToken !== authToken) {
          // Update token in both storage systems
          await AsyncStorage.setItem('authToken', data.authToken);
          const { setTokenAuth } = require('./token');
          await setTokenAuth(data.authToken);
          console.log('🔄 [VALIDATE] Auth token refreshed in both storage systems');
        }

        return data;
      } else {
        console.log('❌ [VALIDATE] Device validation failed');
        console.log('❌ [VALIDATE] Response status:', response.status);
        console.log('❌ [VALIDATE] Error message:', data.message);
        console.log('🧹 [VALIDATE] Clearing device auth due to validation failure');

        await this.clearDeviceAuth();

        return {
          success: false,
          message: data.message || 'Device validation failed'
        } as any;
      }
    } catch (error) {
      console.log('💥 [VALIDATE] Network/Exception error occurred');
      console.log('💥 [VALIDATE] Error type:', typeof error);
      console.log('💥 [VALIDATE] Error name:', (error as any)?.name);
      console.log('💥 [VALIDATE] Error message:', (error as any)?.message);
      console.log('💥 [VALIDATE] Error stack:', (error as any)?.stack);
      console.log('💥 [VALIDATE] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      console.log('🧹 [VALIDATE] Clearing device auth due to network error');

      await this.clearDeviceAuth();

      return {
        success: false,
        message: `Network error during device validation: ${(error as any)?.message || 'Unknown error'}`
      } as any;
    }
  }

  /**
   * Clear device authentication data
   */
  static async clearDeviceAuth() {
    try {
      console.log('🧹 [CLEAR] Clearing device authentication data from both storage systems');

      // Clear from AsyncStorage
      await AsyncStorage.multiRemove([
        'authToken',
        'refreshToken',
        'isDeviceAuthorized',
        'userEmail',
        'authMethod'
      ]);

      // ALSO clear from SecureStore
      const { clearTokenAuth } = require('./token');
      await clearTokenAuth();

      console.log('🧹 [CLEAR] Device authentication data cleared from both AsyncStorage and SecureStore');
    } catch (error) {
      console.error('❌ [CLEAR] Error clearing device auth:', error);
    }
  }

  /**
   * Check if device is authorized
   */
  static async isDeviceAuthorized() {
    try {
      const isAuthorized = await AsyncStorage.getItem('isDeviceAuthorized');
      const authToken = await AsyncStorage.getItem('authToken');
      return isAuthorized === 'true' && !!authToken;
    } catch (error) {
      console.error('Error checking device authorization:', error);
      return false;
    }
  }

  /**
   * Exchange Firebase ID token for backend authentication
   * This matches the /auth/login/token endpoint used by the web app
   */
  static async exchangeFirebaseToken(firebaseToken: string) {
    try {
      if (SIMULATE_BACKEND || (API_BASE_URL || '').includes('your-backend-url.com')) {
        console.log('Simulating backend token exchange (development mode)');
        return {
          status: true,
          message: 'Development mode - backend simulation'
        };
      }

      console.log('Calling /auth/login/token endpoint...');
      const response = await fetch(`${API_BASE_URL}/auth/login/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: firebaseToken
        })
      });

      console.log('Backend response status:', response.status);
      const result = await response.json();
      console.log('Backend response:', result);
      return result;
    } catch (error) {
      console.error('Token exchange failed:', error);

      if (SIMULATE_BACKEND || (API_BASE_URL || '').includes('your-backend-url.com')) {
        console.log('Backend not configured, simulating success for development');
        return {
          status: true,
          message: 'Development mode - backend not configured'
        };
      }

      throw new Error('Failed to authenticate with backend');
    }
  }

  /**
   * Build Authorization header preferring device token; fallback to Firebase ID token
   */
  static async getAuthHeader(): Promise<{ Authorization: string }> {
    // Prefer device token stored via QR authorization
    const deviceToken = await getTokenAuth();
    if (deviceToken) {
      return { Authorization: `Bearer ${deviceToken}` };
    }
    // Fallback to Firebase user token
    try {
      const { auth } = require('../config/firebase');
      const user = auth.currentUser as any;
      if (user) {
        const idToken = await user.getIdToken();
        return { Authorization: `Bearer ${idToken}` };
      }
    } catch {}
    throw new Error('Not authenticated: no device token and no Firebase user');
  }

  /**
   * Make authenticated API calls using device token or Firebase token
   */
  static async authenticatedRequest(endpoint: string, options: any = {}) {
    try {
      const authHeader = await this.getAuthHeader();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
          ...(options.headers || {}),
        },
      });

      if (response.status === 401 || response.status === 403) {
        try { await clearTokenAuth(); } catch {}
        if (this.authErrorHandler) this.authErrorHandler();
        throw new Error('Unauthorized');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      console.error('Authenticated request failed:', error);
      throw error;
    }
  }

  static async checkAuthStatus() {
    try {
      return await this.authenticatedRequest('/auth/status');
    } catch (error: any) {
      return { status: false, error: error.message };
    }
  }

  static async authenticateWithQRCode(qrCodeData: string) {
    console.warn('authenticateWithQRCode is deprecated. Use authorizeDevice instead.');
    return this.authorizeDevice(qrCodeData);
  }
}

export default ApiService;

