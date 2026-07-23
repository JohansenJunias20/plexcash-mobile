import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MainScreen from '../components/MainScreen';
import LoginScreen from '../components/LoginScreen';
import { logger, logAuth, logStateChange, logError } from '../utils/logger';
import { setTokenAuth, getTokenAuth } from '../services/token';

// Global reference to signOut function for use outside React components
let globalSignOut: (() => Promise<void>) | null = null;

export const getGlobalSignOut = () => globalSignOut;

interface AuthUser {
  email: string;
  name?: string;
  authMethod?: 'qr-code' | 'device' | 'firebase' | 'pin';
  deviceAuthorized?: boolean;
  deviceId?: string;
}

interface AuthContextValue {
  user: AuthUser | (User & { authMethod?: 'firebase' }) | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTokenReady: boolean; // true when token is confirmed fresh and safe for API calls
  signOut: () => Promise<void>;
  authenticateWithQRCode: (user: { email: string }, token: string) => Promise<{ success: boolean; error?: string }>;
  authorizeDeviceWithQRCode: (qrCodeData: string) => Promise<{ success: boolean; message?: string }>;
  authorizePIN: (email: string, pinCode: string) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isTokenReady, setIsTokenReady] = useState<boolean>(false);

  useEffect(() => {
    logAuth('🔄 AuthProvider mounted, initializing authentication check...');

    // CRITICAL FIX: Set up Firebase listener IMMEDIATELY to avoid race conditions
    // This ensures we catch auth state changes from Google OAuth even if they happen
    // while we're still checking existing auth
    logAuth('📡 Setting up Firebase auth state listener IMMEDIATELY (before checking existing auth)...');
    console.log('🔥 [AUTH] Setting up Firebase listener FIRST to catch Google OAuth auth state changes');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        logAuth('🔥 Firebase auth state changed!', {
          hasUser: !!firebaseUser,
          email: firebaseUser?.email || 'null'
        });
        console.log('🔥 [AUTH-STATE-CHANGED] Firebase auth state changed, user:', firebaseUser?.email || 'null');

        // PERSISTENT AUTH FIX: If the user is logged in via QR or PIN, ignore Firebase state changes
        const storedAuthMethod = await AsyncStorage.getItem('authMethod');
        if (storedAuthMethod === 'device' || storedAuthMethod === 'pin') {
          console.log(`⚠️ [AUTH-STATE-CHANGED] Ignoring Firebase auth state because current authMethod is ${storedAuthMethod}`);
          return;
        }

        // If we already have a Firebase session stored, don't blindly exchange token again on startup.
        // The backend token might contain tenant-specific claims (multitenant) which would be lost
        // if we exchange for a new generic token. Let api.ts handle refresh ONLY when 401 occurs.
        const existingAuthToken = await AsyncStorage.getItem('authToken');
        if (firebaseUser && storedAuthMethod === 'firebase' && existingAuthToken) {
           console.log('✅ [AUTH-STATE-CHANGED] Firebase user detected, but stored session exists. Skipping token exchange to preserve multitenant claims.');
           setUser(Object.assign(firebaseUser, { authMethod: 'firebase' as const }));
           setIsAuthenticated(true);
           setIsTokenReady(true);
           setIsLoading(false);
           return;
        }

        // CRITICAL FIX: Always set isLoading = true when processing auth state change
        // But we'll set it to false at the end to ensure navigation works
        logStateChange('Setting isLoading = true (processing auth state change)');
        setIsLoading(true);

        if (firebaseUser) {
          try {
            logAuth('🔥 User detected, getting Firebase ID token...');
            console.log('🔥 [AUTH-STATE-CHANGED] Getting Firebase ID token...');
            const firebaseIdToken = await firebaseUser.getIdToken();
            logAuth('Token obtained, exchanging with backend...');
            console.log('🔥 [AUTH-STATE-CHANGED] Token obtained, exchanging with backend...');
            const backendResponse = await ApiService.exchangeFirebaseToken(firebaseIdToken);
            logAuth('Backend response received', { status: backendResponse.status });
            console.log('🔥 [AUTH-STATE-CHANGED] Backend response:', backendResponse);

            if (backendResponse.status) {
              logAuth('✅ Backend authentication successful!');

              // Use the long-lived persistent JWT from backend (valid 365 days).
              // This prevents lockout when app is closed and Firebase ID token expires.
              // Falls back to Firebase ID token if backend doesn't return persistentToken (older backend).
              const tokenToStore = backendResponse.persistentToken || firebaseIdToken;
              const isPersistent = !!backendResponse.persistentToken;
              logAuth(`🔐 Storing ${isPersistent ? 'persistent JWT (365d)' : 'Firebase ID token'} in SecureStore and AsyncStorage...`);
              console.log(`🔐 [AUTH] Storing ${isPersistent ? 'persistent JWT' : 'Firebase ID token'} in SecureStore and AsyncStorage...`);

              // Store token in both SecureStore and AsyncStorage (for consistency with QR code flow)
              // IMPORTANT: Wait for storage to complete BEFORE setting isAuthenticated = true
              // Pass authMethod: 'firebase' to prevent validateDeviceAuth from being called
              await ApiService.storeDeviceTokens({
                authToken: tokenToStore,
                token: tokenToStore,
                deviceId: await ApiService.getOrCreateDeviceId(),
                user: { email: firebaseUser.email ?? '' },
                authMethod: 'firebase' // ✅ This prevents validateDeviceAuth from being called
              });

              logAuth('✅ Token storage complete!');
              console.log('🔐 [AUTH] Token storage complete, setting authenticated state');

              // Only set authenticated state AFTER token is stored
              logStateChange('Setting user object', { email: firebaseUser.email });
              setUser(Object.assign(firebaseUser, { authMethod: 'firebase' as const }));

              // Store in AsyncStorage FIRST
              await AsyncStorage.setItem('isAuthenticated', 'true');
              await AsyncStorage.setItem('userEmail', firebaseUser.email ?? '');
              logAuth('✅ AsyncStorage updated with authentication state');

              // CRITICAL: Set isAuthenticated last to trigger navigation
              logStateChange('⚠️ CRITICAL: Setting isAuthenticated = TRUE');
              console.log('🔐 [AUTH] Setting isAuthenticated to TRUE...');

              // Set state immediately
              setIsAuthenticated(true);
              setIsTokenReady(true); // Token is confirmed fresh from Firebase exchange

              logStateChange('✅ isAuthenticated is now TRUE - RootNavigator should re-render!');
              console.log('🔐 [AUTH] isAuthenticated is now:', true);

              logAuth('✅ Authentication state fully updated - navigation to MainScreen should occur NOW');
              console.log('✅ [AUTH] Authentication state updated - user should navigate to MainScreen');
            } else {
              logError('Backend response status is false', { context: 'AUTH' });
              console.log('❌ [AUTH-STATE-CHANGED] Backend response status is false');
              
              const authToken = await AsyncStorage.getItem('authToken');
              if (authToken) {
                console.log('⚠️ [AUTH-STATE-CHANGED] Backend response status is false but stored auth exists - maintaining session');
              } else {
                logStateChange('Clearing authentication state');
                setUser(null);
                setIsAuthenticated(false);
                await AsyncStorage.removeItem('isAuthenticated');
                await AsyncStorage.removeItem('userEmail');
              }
            }
          } catch (error) {
            logError('Authentication error in onAuthStateChanged', {
              context: 'AUTH',
              data: error
            });
            console.error('❌ [AUTH-STATE-CHANGED] Authentication error:', error);
            
            const authToken = await AsyncStorage.getItem('authToken');
            if (authToken) {
              console.log('⚠️ [AUTH-STATE-CHANGED] Network error but stored auth exists - maintaining session');
            } else {
              logStateChange('Clearing authentication state due to error');
              setUser(null);
              setIsAuthenticated(false);
              await AsyncStorage.removeItem('isAuthenticated');
              await AsyncStorage.removeItem('userEmail');
            }
          }
        } else {
          // PERSISTENT AUTH FIX: Don't clear auth state if Firebase user is null
          // This prevents automatic logout when Firebase token expires
          // Check if we have a valid session in AsyncStorage first
          const authToken = await AsyncStorage.getItem('authToken');

          if (authToken) {
            logAuth('⚠️ Firebase user is null but we have stored auth - keeping session alive');
            console.log('⚠️ [AUTH-STATE-CHANGED] Firebase user null but stored auth exists - maintaining session');
            // Don't clear auth state - user will remain logged in
          } else {
            logAuth('No Firebase user detected, clearing auth state');
            console.log('🔥 [AUTH-STATE-CHANGED] No Firebase user, clearing auth state');
            logStateChange('Clearing authentication state (no user)');
            setUser(null);
            setIsAuthenticated(false);
            await AsyncStorage.removeItem('isAuthenticated');
            await AsyncStorage.removeItem('userEmail');
          }
        }

        // Always set isLoading = false at the end to ensure navigation works
        logStateChange('Setting isLoading = false (auth change complete)');
        console.log('🔥 [AUTH-STATE-CHANGED] Setting isLoading to false');
        setIsLoading(false);

        logAuth('🔥 Auth state change processing complete', {
          isAuthenticated,
          hasUser: !!user
        });
      });

    // Now check for existing auth (this runs in parallel with the listener being active)
    const checkExistingAuth = async () => {
      try {
        logAuth('🔍 Checking existing authentication...');
        console.log('🔍 [AUTH] Checking existing authentication');
        const isDeviceAuthorized = await ApiService.isDeviceAuthorized();
        logAuth('Device authorization check complete', { isDeviceAuthorized });
        console.log('🔍 [AUTH] Device authorized status:', isDeviceAuthorized);

        if (isDeviceAuthorized) {
          console.log('✅ [AUTH] Device is authorized, validating and refreshing token if needed...');

          // REFRESH TOKEN MECHANISM: Call validateDeviceAuth to refresh token if expired
          // This ensures permanent login even after access token expires (up to 90 days)
          try {
            const validationResult = await ApiService.validateDeviceAuth();

            if (validationResult.success && validationResult.user) {
              console.log('✅ [AUTH] Device validation successful, user:', validationResult.user.email);
              setUser({
                email: validationResult.user.email,
                authMethod: 'device',
                deviceAuthorized: true,
              });
              setIsAuthenticated(true);
              setIsTokenReady(true); // Device token validated and fresh
              setIsLoading(false);
              return;
            } else {
              console.log('❌ [AUTH] Device validation failed:', validationResult.message);
              console.log('⚠️ [AUTH] Ignoring validation failure to keep session active');
              // await ApiService.clearDeviceAuth();
            }
          } catch (error) {
            console.error('❌ [AUTH] Error during device validation:', error);
            console.log('⚠️ [AUTH] Ignoring error to keep session active');
            // await ApiService.clearDeviceAuth();
          }
        } else {
          console.log('🔍 [AUTH] Device not authorized, checking other auth methods');
        }

        const authToken = await AsyncStorage.getItem('authToken');
        const userEmail = await AsyncStorage.getItem('userEmail');
        const isAuth = await AsyncStorage.getItem('isAuthenticated');
        const authMethod = await AsyncStorage.getItem('authMethod');

        // PERSISTENT AUTH FIX: Restore all sessions from AsyncStorage
        // This prevents automatic logouts when token validation fails.
        // We do NOT check `isAuth === 'true'` because device auth does not store this key.
        if (authToken && userEmail) {
          console.log(`✅ [AUTH] Found ${authMethod} auth token, restoring session...`);

          // Ensure the token is also present in SecureStore.
          // SecureStore may be cleared on some devices (e.g. after OS update or full wipe)
          // while AsyncStorage persists. In that case, restore it so getAuthHeader() works.
          try {
            const secureToken = await getTokenAuth();
            if (!secureToken && authToken) {
              console.log('🔐 [AUTH] SecureStore empty but AsyncStorage has token - restoring to SecureStore');
              await setTokenAuth(authToken);
            }
          } catch (secureRestoreError) {
            console.error('❌ [AUTH] Failed to restore token to SecureStore:', secureRestoreError);
          }

          // For Firebase auth: proactively wait for Firebase to restore session, then
          // silently refresh the token so API calls don't hit 401 errors.
          // We still allow the user into the app immediately (optimistic restore), but
          // run a background refresh so the token is up-to-date.
          if (authMethod === 'firebase') {
            console.log('🔥 [AUTH] Firebase auth detected - restoring session optimistically and refreshing token in background...');
            setUser({ email: userEmail, authMethod: 'firebase', deviceAuthorized: false });
            setIsAuthenticated(true);
            setIsLoading(false);

            // REMOVED BACKGROUND TOKEN REFRESH
            // Exchanging token on startup would overwrite the user's multitenant token 
            // that contains their specific database access claims.
            // We rely on api.ts to handle 401 errors and refresh ONLY when needed.
            console.log('✅ [AUTH-STARTUP] Token ready signal sent to app (background refresh disabled for multitenant support)');
            setIsTokenReady(true);

            return; // User is already set as authenticated above
          }

          // PERMANENT AUTH: Skip token validation to prevent automatic logout
          // Users will remain logged in until they manually sign out
          setUser({ email: userEmail, authMethod: (authMethod as any) || 'unknown', deviceAuthorized: isDeviceAuthorized });
          setIsAuthenticated(true);
          setIsTokenReady(true); // Non-firebase auth token restored directly, safe to use immediately
          setIsLoading(false);
          return;
        }

        // If no existing auth found, set isLoading = false
        // The Firebase listener will handle any new auth state changes
        logAuth('No existing auth found, waiting for Firebase listener or user login');
        console.log('🔍 [AUTH] No existing auth found');
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking existing auth:', error);
        setIsLoading(false);
      }
    };

    checkExistingAuth();

    // Cleanup function to unsubscribe from Firebase listener
    return () => {
      logAuth('🔄 AuthProvider unmounting, cleaning up Firebase listener');
      unsubscribe();
    };
  }, []);

  // Task 2: AppState listener for auto-refresh when app comes to foreground
  useEffect(() => {
    console.log('📱 [APP-STATE] Setting up AppState listener for token refresh...');

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('📱 [APP-STATE] App state changed to:', nextAppState);

      // Only refresh when app becomes active (foreground)
      if (nextAppState === 'active' && isAuthenticated) {
        console.log('📱 [APP-STATE] App became active, checking if token refresh needed...');

        try {
          const authMethod = await AsyncStorage.getItem('authMethod');
          console.log('📱 [APP-STATE] Auth method:', authMethod);

          // Only refresh for device/PIN auth (not Firebase)
          if (authMethod === 'device' || authMethod === 'pin') {
            console.log('📱 [APP-STATE] Device/PIN auth detected, refreshing token...');
            const result = await ApiService.validateDeviceAuth();

            if (result.success) {
              console.log('✅ [APP-STATE] Token refresh successful');
            } else {
              console.log('⚠️ [APP-STATE] Token refresh failed:', result.message);
            }
          } else {
            console.log('📱 [APP-STATE] Firebase auth, skipping token refresh');
          }
        } catch (error) {
          console.error('❌ [APP-STATE] Error during token refresh:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      console.log('📱 [APP-STATE] Cleaning up AppState listener');
      subscription.remove();
    };
  }, [isAuthenticated]);

  const authenticateWithQRCode = async (qrUser: { email: string }, token: string) => {
    try {
      await AsyncStorage.setItem('isAuthenticated', 'true');
      await AsyncStorage.setItem('userEmail', qrUser.email);
      await AsyncStorage.setItem('authToken', token);

      setUser({ ...qrUser, authMethod: 'qr-code' });
      setIsAuthenticated(true);
      setIsTokenReady(true);

      return { success: true };
    } catch (error: any) {
      console.error('QR Code authentication storage error:', error);
      return { success: false, error: error.message };
    }
  };

  const authorizeDeviceWithQRCode = async (qrCodeData: string) => {
    try {
      setIsLoading(true);

      const result = await ApiService.authorizeDevice(qrCodeData);

      if (result.success && result.user) {
        // Store the tokens in both AsyncStorage and SecureStore
        await ApiService.storeDeviceTokens({
          authToken: result.token,
          token: result.token,
          refreshToken: result.refreshToken,        // NEW: Pass refresh token
          expiresIn: result.expiresIn,             // NEW: Pass access token expiry
          refreshExpiresIn: result.refreshExpiresIn, // NEW: Pass refresh token expiry
          deviceId: result.deviceId,
          user: { email: result.user.email }
        });

        setUser({
          email: result.user.email,
          name: result.user.name,
          authMethod: 'device',
          deviceAuthorized: true,
          deviceId: result.deviceId,
        });
        setIsAuthenticated(true);
        setIsTokenReady(true);

        return { success: true, message: result.message || 'Device authorized successfully! You will stay logged in.' };
      } else {
        return { success: false, message: result.message || 'Authorization failed' };
      }
    } catch (error) {
      console.error('Device authorization error:', error);
      return { success: false, message: 'Device authorization failed. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const authorizePIN = async (email: string, pinCode: string) => {
    try {
      setIsLoading(true);

      const result = await ApiService.authorizePIN(email, pinCode);

      if (result.success && result.user) {
        // Store the tokens in both AsyncStorage and SecureStore
        await ApiService.storeDeviceTokens({
          authToken: result.token,
          token: result.token,
          refreshToken: result.refreshToken,        // NEW: Pass refresh token
          expiresIn: result.expiresIn,             // NEW: Pass access token expiry
          refreshExpiresIn: result.refreshExpiresIn, // NEW: Pass refresh token expiry
          deviceId: result.deviceId,
          user: { email: result.user.email }
        });

        setUser({
          email: result.user.email,
          name: result.user.name,
          authMethod: 'pin',
          deviceAuthorized: true,
          deviceId: result.deviceId,
        });
        setIsAuthenticated(true);
        setIsTokenReady(true);

        return { success: true, message: result.message || 'Device authorized successfully with PIN! You will stay logged in.' };
      } else {
        return { success: false, message: result.message || 'PIN authorization failed' };
      }
    } catch (error) {
      console.error('PIN authorization error:', error);
      return { success: false, message: 'PIN authorization failed. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 [AUTH] Signing out user...');
      const currentUserEmail = user?.email;

      // 1. Immediately reset React state so UI drops old session
      setUser(null);
      setIsAuthenticated(false);
      setIsTokenReady(false);

      // 2. Notify backend to clear server-side AUTH_CACHE
      try {
        const baseUrl = ApiService.getApiBaseUrl();
        await fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUserEmail })
        });
      } catch (e) {
        console.warn('Backend logout notify error:', e);
      }

      // 3. Sign out of Firebase SDK
      try {
        await auth.signOut();
      } catch (e) {
        console.warn('Firebase sign out error (can be safely ignored):', e);
      }

      // 4. Clear all device tokens and wipe AsyncStorage completely
      await ApiService.clearDeviceAuth();
      await AsyncStorage.clear();

      const { clearTokenAuth } = require('../services/token');
      await clearTokenAuth();

      console.log('✅ [AUTH] User signed out and cache wiped successfully');
    } catch (error) {
      console.error('❌ [AUTH] Sign out error:', error);
      setUser(null);
      setIsAuthenticated(false);
      setIsTokenReady(false);
    }
  };

  // Set global reference for use outside React components (e.g., API error handler)
  useEffect(() => {
    globalSignOut = signOut;
    console.log('🔗 [AUTH] Global signOut reference set');

    return () => {
      globalSignOut = null;
      console.log('🔗 [AUTH] Global signOut reference cleared');
    };
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated,
    isTokenReady,
    signOut,
    authenticateWithQRCode,
    authorizeDeviceWithQRCode,
    authorizePIN,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

