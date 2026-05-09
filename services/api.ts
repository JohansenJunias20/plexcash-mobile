// API service for communicating with the Plexcash backend
// Enhanced with persistent device authorization system

// Get API base URL from environment variable
// TEMPORARY FIX: Use computer's IP address for mobile device access
// For Android Emulator: use http://10.0.2.2 (maps to host's localhost)
// For Physical Device: use your computer's IP address (e.g., http://192.168.1.210)
export const API_BASE_URL = "https://app.plexseller.com"; // PRODUCTION - jangan dipakai saat development
// export const API_BASE_URL = "http://192.168.1.101:80"; // DEVELOPMENT - local server

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
  refreshToken?: string;        // NEW: Refresh token for permanent login
  expiresIn?: number;           // NEW: Access token expiry in seconds
  refreshExpiresIn?: number;    // NEW: Refresh token expiry in seconds
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
          refreshToken: result.refreshToken,        // NEW: Store refresh token
          expiresIn: result.expiresIn,             // NEW: Store access token expiry
          refreshExpiresIn: result.refreshExpiresIn, // NEW: Store refresh token expiry
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
   * Authorize device using PIN code (NEW - similar to QR authorization)
   * This calls the /auth/authorize-pin endpoint for persistent authentication
   */
  static async authorizePIN(email: string, pinCode: string): Promise<AuthorizeDeviceResponse> {
    try {
      console.log('🔐 [AuthPIN] Authorizing device with PIN code for email:', email);
      console.log('🔐 [AuthPIN] API Base URL:', API_BASE_URL);
      console.log('🔐 [AuthPIN] Simulate Backend:', SIMULATE_BACKEND);

      const deviceInfo = await this.getDeviceInfo();
      console.log('🔐 [AuthPIN] Device Info:', deviceInfo);

      const url = `${API_BASE_URL}/auth/authorize-pin`;
      console.log('🔐 [AuthPIN] Calling URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          pinCode: pinCode,
          deviceInfo: deviceInfo
        })
      });

      console.log('🔐 [AuthPIN] Response status:', response.status);

      const resultText = await response.text();
      console.log('🔐 [AuthPIN] Response text:', resultText);

      let result: any;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        console.error('🔐 [AuthPIN] JSON parse error:', parseError);
        result = { success: false, message: resultText };
      }

      console.log('🔐 [AuthPIN] Parsed result:', result);

      if (response.ok && result.success) {
        console.log('✅ [AuthPIN] Authorization successful!');
        return {
          success: true,
          user: result.user,
          token: result.token,
          refreshToken: result.refreshToken,        // NEW: Store refresh token
          expiresIn: result.expiresIn,             // NEW: Store access token expiry
          refreshExpiresIn: result.refreshExpiresIn, // NEW: Store refresh token expiry
          message: result.message,
          deviceId: result.deviceId,
        };
      } else {
        console.error('❌ [AuthPIN] Authorization failed:', result.message);
        return {
          success: false,
          message: result.message || 'PIN code authentication failed'
        };
      }
    } catch (error: any) {
      console.error('❌ [AuthPIN] Network error:', error);
      console.error('❌ [AuthPIN] Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      });
      return {
        success: false,
        message: `Network error: ${error?.message || 'Please check your connection and try again.'}`
      };
    }
  }

  /**
   * Store device authentication tokens securely
   */
  static async storeDeviceTokens(authData: {
    authToken?: string;
    token?: string;
    refreshToken?: string;
    expiresIn?: number;           // NEW: Access token expiry in seconds
    refreshExpiresIn?: number;    // NEW: Refresh token expiry in seconds
    deviceId?: string;
    user: { email: string };
    authMethod?: 'device' | 'firebase'
  }) {
    try {
      const token = authData.authToken || authData.token || '';
      const authMethod = authData.authMethod || 'device'; // Default to 'device' for backward compatibility

      // Calculate token expiry timestamps
      const now = Date.now();
      const tokenExpiry = authData.expiresIn ? now + (authData.expiresIn * 1000) : now + (10 * 365 * 24 * 3600 * 1000); // Default 10 years for permanent auth
      const refreshTokenExpiry = authData.refreshExpiresIn ? now + (authData.refreshExpiresIn * 1000) : now + (10 * 365 * 24 * 3600 * 1000); // Default 10 years

      // Store in AsyncStorage (for device auth system)
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('refreshToken', authData.refreshToken || '');
      await AsyncStorage.setItem('tokenExpiry', tokenExpiry.toString());           // NEW: Store expiry timestamp
      await AsyncStorage.setItem('refreshTokenExpiry', refreshTokenExpiry.toString()); // NEW: Store refresh expiry timestamp
      await AsyncStorage.setItem('deviceId', authData.deviceId || await this.getOrCreateDeviceId());
      await AsyncStorage.setItem('userEmail', authData.user.email);

      // Only set isDeviceAuthorized for QR code device auth, NOT for Firebase auth
      if (authMethod === 'device') {
        await AsyncStorage.setItem('isDeviceAuthorized', 'true');
        await AsyncStorage.setItem('authMethod', 'device');
      } else {
        // For Firebase auth, don't set isDeviceAuthorized to prevent validateDeviceAuth from being called
        await AsyncStorage.setItem('isDeviceAuthorized', 'false');
        await AsyncStorage.setItem('authMethod', 'firebase');
      }

      // ALSO store in SecureStore (for screens like Barang that expect it there)
      const { setTokenAuth } = require('./token');
      await setTokenAuth(token);

      console.log(`🔐 [STORE] Tokens stored in both AsyncStorage and SecureStore (authMethod: ${authMethod})`);
      console.log(`🔐 [STORE] Token expiry: ${new Date(tokenExpiry).toISOString()}`);
      console.log(`🔐 [STORE] Refresh token expiry: ${new Date(refreshTokenExpiry).toISOString()}`);
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

          // NEW: Update token expiry timestamp when token is refreshed
          if (data.expiresIn) {
            const newExpiry = Date.now() + (data.expiresIn * 1000);
            await AsyncStorage.setItem('tokenExpiry', newExpiry.toString());
            console.log('🔄 [VALIDATE] Token expiry updated:', new Date(newExpiry).toISOString());
          }

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
      const response = await fetch(`${API_BASE_URL}/auth/login/token?source=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: firebaseToken,
          fromMobile: true  // Request long-lived persistent JWT from backend
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
   * Backend now supports both Firebase ID tokens and custom JWTs in Authorization header
   */
  static async getAuthHeader(): Promise<{ Authorization: string }> {
    console.log('🔑 [AUTH-HEADER] Building auth header...');

    // Prefer device token stored via QR authorization
    const deviceToken = await getTokenAuth();
    if (deviceToken) {
      console.log('🔑 [AUTH-HEADER] Using device token from SecureStore');
      console.log('🔑 [AUTH-HEADER] Token (first 50 chars):', deviceToken.substring(0, 50) + '...');
      return { Authorization: `Bearer ${deviceToken}` };
    }

    console.log('🔑 [AUTH-HEADER] No device token, trying Firebase user...');

    // Fallback to Firebase user token
    try {
      const { auth } = require('../config/firebase');
      const user = auth.currentUser as any;
      if (user) {
        console.log('🔑 [AUTH-HEADER] Firebase user found, getting ID token...');
        const idToken = await user.getIdToken();
        console.log('🔑 [AUTH-HEADER] Using Firebase ID token');
        console.log('🔑 [AUTH-HEADER] Token (first 50 chars):', idToken.substring(0, 50) + '...');
        return { Authorization: `Bearer ${idToken}` };
      }
      console.log('🔑 [AUTH-HEADER] No Firebase user found');
    } catch (error) {
      console.log('🔑 [AUTH-HEADER] Error getting Firebase token:', error);
    }

    console.log('❌ [AUTH-HEADER] No authentication available!');
    throw new Error('Not authenticated: no device token and no Firebase user');
  }

  /**
   * Make authenticated API calls using device token or Firebase token
   * @param endpoint - API endpoint to call
   * @param options - Fetch options
   * @param retryCount - Internal retry counter (default: 0)
   */
  static async authenticatedRequest(endpoint: string, options: any = {}, retryCount: number = 0) {
    try {
      console.log(`🌐 [AUTH-REQ] Making authenticated request to: ${endpoint}`);

      // Task 3: Check if token is about to expire and refresh proactively
      const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
      const authMethod = await AsyncStorage.getItem('authMethod');

      if (tokenExpiry && (authMethod === 'device' || authMethod === 'pin')) {
        const expiryTime = parseInt(tokenExpiry);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes buffer

        // If token expires within 5 minutes, refresh it now
        if (now >= expiryTime - fiveMinutes) {
          console.log('⏰ [AUTH-REQ] Token expiring soon, refreshing proactively...');
          console.log(`⏰ [AUTH-REQ] Token expires at: ${new Date(expiryTime).toISOString()}`);
          console.log(`⏰ [AUTH-REQ] Current time: ${new Date(now).toISOString()}`);

          try {
            const refreshResult = await this.validateDeviceAuth();
            if (refreshResult.success) {
              console.log('✅ [AUTH-REQ] Token refreshed successfully before API call');
            } else {
              console.log('⚠️ [AUTH-REQ] Token refresh failed, continuing with existing token');
            }
          } catch (refreshError) {
            console.error('❌ [AUTH-REQ] Error during token refresh:', refreshError);
            console.log('⚠️ [AUTH-REQ] Continuing with existing token despite refresh error');
          }
        } else {
          const timeUntilExpiry = expiryTime - now;
          const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
          console.log(`⏰ [AUTH-REQ] Token valid for ${minutesUntilExpiry} more minutes`);
        }
      }

      const authHeader = await this.getAuthHeader();
      console.log(`🌐 [AUTH-REQ] Auth header obtained:`, authHeader ? 'YES' : 'NO');

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
          ...(options.headers || {}),
        },
      });

      console.log(`🌐 [AUTH-REQ] Response status for ${endpoint}: ${response.status}`);

      // Task 4: Handle 401 errors with token refresh and retry
      if (response.status === 401 || response.status === 403) {
        console.log(`❌ [AUTH-REQ] UNAUTHORIZED (${response.status})`);
        console.log(`❌ [AUTH-REQ] Endpoint: ${endpoint}`);
        console.log(`❌ [AUTH-REQ] Retry count: ${retryCount}`);

        // Only retry once to avoid infinite loops
        if (retryCount === 0) {
          const authMethod = await AsyncStorage.getItem('authMethod');

          // Only attempt refresh for device/PIN auth (not Firebase)
          if (authMethod === 'device' || authMethod === 'pin') {
            console.log('🔄 [AUTH-REQ] Attempting token refresh after 401 error...');

            try {
              const refreshResult = await this.validateDeviceAuth();

              if (refreshResult.success) {
                console.log('✅ [AUTH-REQ] Token refreshed successfully, retrying request...');
                // Retry the request with the new token
                return this.authenticatedRequest(endpoint, options, retryCount + 1);
              } else {
                console.log('❌ [AUTH-REQ] Token refresh failed:', refreshResult.message);
              }
            } catch (refreshError) {
              console.error('❌ [AUTH-REQ] Error during token refresh:', refreshError);
            }
          } else {
            console.log('❌ [AUTH-REQ] Firebase auth - cannot refresh, clearing token');
          }
        } else {
          console.log('❌ [AUTH-REQ] Already retried once, not retrying again');
        }

        // If we reach here, refresh failed or not applicable - clear auth
        console.log(`❌ [AUTH-REQ] CLEARING TOKEN after failed refresh attempt`);
        console.log(`❌ [AUTH-REQ] Stack trace:`);
        console.log(new Error().stack);

        try { await clearTokenAuth(); } catch {}
        if (this.authErrorHandler) this.authErrorHandler();
        throw new Error('Unauthorized');
      }

      console.log(`✅ [AUTH-REQ] Request successful for ${endpoint}`);

      // Try to parse as JSON first, fallback to text if parsing fails
      const responseText = await response.text();
      try {
        const jsonData = JSON.parse(responseText);
        return jsonData;
      } catch (parseError) {
        // If JSON parsing fails, return as text
        console.log(`⚠️ [AUTH-REQ] Response is not JSON for ${endpoint}, returning as text`);
        return responseText;
      }
    } catch (error) {
      console.error(`💥 [AUTH-REQ] Request failed for ${endpoint}:`, error);
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

  /**
   * Get the current database name for the authenticated user
   */
  static async getCurrentDatabase(): Promise<{ status: boolean; data?: string; reason?: string }> {
    try {
      const response = await this.authenticatedRequest('/get/database_name');
      return response;
    } catch (error) {
      console.error('Error fetching current database:', error);
      return { status: false, reason: 'Failed to fetch current database' };
    }
  }

  /**
   * Get list of all databases (admin only)
   */
  static async getDatabaseList(): Promise<{ status: boolean; data?: string[]; reason?: string }> {
    try {
      const response = await this.authenticatedRequest('/get/database/list');
      return response;
    } catch (error) {
      console.error('Error fetching database list:', error);
      return { status: false, reason: 'Failed to fetch database list' };
    }
  }

  /**
   * Set the current database (admin only)
   */
  static async setDatabase(databaseName: string): Promise<{ status: boolean; data?: string; reason?: string }> {
    try {
      const response = await this.authenticatedRequest('/set/database', {
        method: 'POST',
        body: JSON.stringify({ database_name: databaseName })
      });
      return response;
    } catch (error) {
      console.error('Error setting database:', error);
      return { status: false, reason: 'Failed to set database' };
    }
  }

  /**
   * Generic GET request
   */
  static async get(endpoint: string): Promise<any> {
    return this.authenticatedRequest(endpoint, { method: 'GET' });
  }

  /**
   * Generic POST request
   */
  static async post(endpoint: string, body: any): Promise<any> {
    return this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Generic PATCH request
   */
  static async patch(endpoint: string, body: any): Promise<any> {
    return this.authenticatedRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /**
   * Generic DELETE request
   */
  static async delete(endpoint: string, body: any): Promise<any> {
    return this.authenticatedRequest(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get user access permissions
   */
  static async getUserAccess(): Promise<{ status: boolean; access?: any; reason?: string }> {
    try {
      const response = await this.authenticatedRequest('/mobile/user/access');
      return response;
    } catch (error) {
      console.error('Error fetching user access:', error);
      return { status: false, reason: 'Failed to fetch user access' };
    }
  }

  // =====================================================
  // RETUR PENJUALAN PIN MANAGEMENT
  // =====================================================

  /**
   * Generate a new PIN for sales return authorization (admin only)
   */
  static async generateReturPenjualanPIN(email: string): Promise<{
    status: boolean;
    pin?: string;
    message?: string;
    reason?: string
  }> {
    try {
      const response = await this.authenticatedRequest('/user/retur-penjualan/pin/generate', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return response;
    } catch (error) {
      console.error('Error generating retur penjualan PIN:', error);
      return { status: false, reason: 'Failed to generate PIN' };
    }
  }

  /**
   * Validate PIN for sales return
   */
  static async validateReturPenjualanPIN(pin: string): Promise<{
    status: boolean;
    message?: string;
    reason?: string
  }> {
    try {
      const response = await this.authenticatedRequest('/user/retur-penjualan/pin/validate', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      return response;
    } catch (error) {
      console.error('Error validating retur penjualan PIN:', error);
      return { status: false, reason: 'Failed to validate PIN' };
    }
  }

  /**
   * Get PIN for a user (admin only)
   */
  static async getReturPenjualanPIN(email: string): Promise<{
    status: boolean;
    pin?: string;
    pin_created_at?: string;
    requires_pin?: boolean;
    reason?: string
  }> {
    try {
      const response = await this.authenticatedRequest(`/user/retur-penjualan/pin?email=${encodeURIComponent(email)}`);
      return response;
    } catch (error) {
      console.error('Error getting retur penjualan PIN:', error);
      return { status: false, reason: 'Failed to get PIN' };
    }
  }

  /**
   * Update PIN requirement setting for a user
   */
  static async updateReturPenjualanPINRequirement(email: string, requires_pin: boolean): Promise<{
    status: boolean;
    message?: string;
    reason?: string
  }> {
    try {
      const response = await this.authenticatedRequest('/user/retur-penjualan/pin/requirement', {
        method: 'POST',
        body: JSON.stringify({ email, requires_pin }),
      });
      return response;
    } catch (error) {
      console.error('Error updating retur penjualan PIN requirement:', error);
      return { status: false, reason: 'Failed to update PIN requirement' };
    }
  }
}

export default ApiService;

