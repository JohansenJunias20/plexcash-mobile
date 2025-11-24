import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MainScreen from '../components/MainScreen';
import LoginScreen from '../components/LoginScreen';
import { logger, logAuth, logStateChange, logError } from '../utils/logger';

// Global reference to signOut function for use outside React components
let globalSignOut: (() => Promise<void>) | null = null;

export const getGlobalSignOut = () => globalSignOut;

interface AuthUser {
  email: string;
  name?: string;
  authMethod?: 'qr-code' | 'device' | 'firebase';
  deviceAuthorized?: boolean;
  deviceId?: string;
}

interface AuthContextValue {
  user: AuthUser | (User & { authMethod?: 'firebase' }) | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  authenticateWithQRCode: (user: { email: string }, token: string) => Promise<{ success: boolean; error?: string }>;
  authorizeDeviceWithQRCode: (qrCodeData: string) => Promise<{ success: boolean; message?: string }>;
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

  useEffect(() => {
    logAuth('🔄 AuthProvider mounted, initializing authentication check...');

    const checkExistingAuth = async () => {
      try {
        logAuth('🔍 Checking existing authentication...');
        console.log('🔍 [AUTH] Checking existing authentication');
        const isDeviceAuthorized = await ApiService.isDeviceAuthorized();
        logAuth('Device authorization check complete', { isDeviceAuthorized });
        console.log('🔍 [AUTH] Device authorized status:', isDeviceAuthorized);

        if (isDeviceAuthorized) {
          console.log('🔍 [AUTH] Device is authorized, calling validateDeviceAuth...');
          const validation = await ApiService.validateDeviceAuth();
          console.log('🔍 [AUTH] Validation completed with result:', validation.success);
          console.log('🔍 [AUTH] Full validation response:', JSON.stringify(validation, null, 2));

          if (validation.success) {
            console.log('✅ [AUTH] Validation successful, setting user');
            setUser({
              email: validation.user.email,
              authMethod: 'device',
              deviceAuthorized: true,
            });
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          } else {
            console.log('❌ [AUTH] Validation failed, clearing device auth');
            await ApiService.clearDeviceAuth();
          }
        } else {
          console.log('🔍 [AUTH] Device not authorized, checking other auth methods');
        }

        const authToken = await AsyncStorage.getItem('authToken');
        const userEmail = await AsyncStorage.getItem('userEmail');
        const isAuth = await AsyncStorage.getItem('isAuthenticated');

        if (authToken && userEmail && isAuth === 'true') {
          console.log('🔍 [AUTH] Found QR-code auth token, validating...');

          // Validate the token by making a test API call
          try {
            const validationResult = await ApiService.checkAuthStatus();
            console.log('🔍 [AUTH] Token validation result:', validationResult);

            if (validationResult.status === true) {
              console.log('✅ [AUTH] QR-code token is valid');
              setUser({ email: userEmail, authMethod: 'qr-code' });
              setIsAuthenticated(true);
              setIsLoading(false);
              return;
            } else {
              console.log('❌ [AUTH] QR-code token is invalid/expired, clearing auth');
              await AsyncStorage.removeItem('authToken');
              await AsyncStorage.removeItem('userEmail');
              await AsyncStorage.removeItem('isAuthenticated');
            }
          } catch (error) {
            console.error('❌ [AUTH] Token validation failed:', error);
            // Clear invalid token
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('userEmail');
            await AsyncStorage.removeItem('isAuthenticated');
          }
        }
      } catch (error) {
        console.error('Error checking existing auth:', error);
      }

      checkFirebaseAuth();
    };

    const checkFirebaseAuth = () => {
      logAuth('📡 Setting up Firebase auth state listener...');

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        logAuth('🔥 Firebase auth state changed!', {
          hasUser: !!firebaseUser,
          email: firebaseUser?.email || 'null'
        });
        console.log('🔥 [AUTH-STATE-CHANGED] Firebase auth state changed, user:', firebaseUser?.email || 'null');

        logStateChange('Setting isLoading = true');
        setIsLoading(true);

        if (firebaseUser) {
          try {
            logAuth('🔥 User detected, getting Firebase ID token...');
            console.log('🔥 [AUTH-STATE-CHANGED] Getting Firebase ID token...');
            const token = await firebaseUser.getIdToken();
            logAuth('Token obtained, exchanging with backend...');
            console.log('🔥 [AUTH-STATE-CHANGED] Token obtained, exchanging with backend...');
            const backendResponse = await ApiService.exchangeFirebaseToken(token);
            logAuth('Backend response received', { status: backendResponse.status });
            console.log('🔥 [AUTH-STATE-CHANGED] Backend response:', backendResponse);

            if (backendResponse.status) {
              logAuth('✅ Backend authentication successful!');
              logAuth('🔐 Storing Firebase token in SecureStore and AsyncStorage...');
              console.log('🔐 [AUTH] Storing Firebase token in SecureStore and AsyncStorage...');

              // Store token in both SecureStore and AsyncStorage (for consistency with QR code flow)
              // IMPORTANT: Wait for storage to complete BEFORE setting isAuthenticated = true
              // Pass authMethod: 'firebase' to prevent validateDeviceAuth from being called
              await ApiService.storeDeviceTokens({
                authToken: token,
                token: token,
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
              // Use setTimeout to ensure state update happens in next tick
              // This prevents race conditions in production builds
              logStateChange('⚠️ CRITICAL: Setting isAuthenticated = TRUE');
              console.log('🔐 [AUTH] Setting isAuthenticated to TRUE...');

              // Set state immediately
              setIsAuthenticated(true);

              // Also force a re-render after a small delay to ensure navigation updates
              setTimeout(() => {
                logStateChange('🔄 Force re-render: Confirming isAuthenticated = TRUE');
                setIsAuthenticated(true);
                logAuth('✅ Authentication state confirmed - navigation to MainScreen should be complete');
              }, 100);

              logStateChange('✅ isAuthenticated is now TRUE - RootNavigator should re-render!');
              console.log('🔐 [AUTH] isAuthenticated is now:', true);

              logAuth('✅ Authentication state fully updated - navigation to MainScreen should occur NOW');
              console.log('✅ [AUTH] Authentication state updated - user should navigate to MainScreen');
            } else {
              logError('Backend response status is false', { context: 'AUTH' });
              console.log('❌ [AUTH-STATE-CHANGED] Backend response status is false');
              logStateChange('Clearing authentication state');
              setUser(null);
              setIsAuthenticated(false);
              await AsyncStorage.removeItem('isAuthenticated');
              await AsyncStorage.removeItem('userEmail');
            }
          } catch (error) {
            logError('Authentication error in onAuthStateChanged', {
              context: 'AUTH',
              data: error
            });
            console.error('❌ [AUTH-STATE-CHANGED] Authentication error:', error);
            logStateChange('Clearing authentication state due to error');
            setUser(null);
            setIsAuthenticated(false);
            await AsyncStorage.removeItem('isAuthenticated');
            await AsyncStorage.removeItem('userEmail');
          }
        } else {
          logAuth('No Firebase user detected, clearing auth state');
          console.log('🔥 [AUTH-STATE-CHANGED] No Firebase user, clearing auth state');
          logStateChange('Clearing authentication state (no user)');
          setUser(null);
          setIsAuthenticated(false);
          await AsyncStorage.removeItem('isAuthenticated');
          await AsyncStorage.removeItem('userEmail');
        }

        logStateChange('Setting isLoading = false');
        console.log('🔥 [AUTH-STATE-CHANGED] Setting isLoading to false');
        setIsLoading(false);
        logAuth('🔥 Auth state change processing complete', {
          isAuthenticated,
          hasUser: !!user
        });
      });

      return unsubscribe;
    };

    checkExistingAuth();
  }, []);

  const authenticateWithQRCode = async (qrUser: { email: string }, token: string) => {
    try {
      await AsyncStorage.setItem('isAuthenticated', 'true');
      await AsyncStorage.setItem('userEmail', qrUser.email);
      await AsyncStorage.setItem('authToken', token);

      setUser({ ...qrUser, authMethod: 'qr-code' });
      setIsAuthenticated(true);

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

  const signOut = async () => {
    try {
      console.log('🚪 [AUTH] Signing out user...');

      if ((user as any)?.authMethod !== 'qr-code' && (user as any)?.authMethod !== 'device') {
        await auth.signOut();
      }

      if ((user as any)?.authMethod === 'device') {
        await ApiService.clearDeviceAuth();
      } else {
        await AsyncStorage.removeItem('isAuthenticated');
        await AsyncStorage.removeItem('userEmail');
        await AsyncStorage.removeItem('authToken');
      }

      setUser(null);
      setIsAuthenticated(false);
      console.log('✅ [AUTH] User signed out successfully');
    } catch (error) {
      console.error('❌ [AUTH] Sign out error:', error);
      throw error;
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
    signOut,
    authenticateWithQRCode,
    authorizeDeviceWithQRCode,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

