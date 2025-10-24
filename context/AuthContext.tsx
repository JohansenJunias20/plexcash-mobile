import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MainScreen from '../components/MainScreen';
import LoginScreen from '../components/LoginScreen';

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
    const checkExistingAuth = async () => {
      try {
        console.log('🔍 [AUTH] Checking existing authentication');
        const isDeviceAuthorized = await ApiService.isDeviceAuthorized();
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
          setUser({ email: userEmail, authMethod: 'qr-code' });
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error checking existing auth:', error);
      }

      checkFirebaseAuth();
    };

    const checkFirebaseAuth = () => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setIsLoading(true);

        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken();
            const backendResponse = await ApiService.exchangeFirebaseToken(token);

            if (backendResponse.status) {
              setUser(Object.assign(firebaseUser, { authMethod: 'firebase' as const }));
              setIsAuthenticated(true);
              await AsyncStorage.setItem('isAuthenticated', 'true');
              await AsyncStorage.setItem('userEmail', firebaseUser.email ?? '');
            } else {
              setUser(null);
              setIsAuthenticated(false);
              await AsyncStorage.removeItem('isAuthenticated');
              await AsyncStorage.removeItem('userEmail');
            }
          } catch (error) {
            console.error('Authentication error:', error);
            setUser(null);
            setIsAuthenticated(false);
            await AsyncStorage.removeItem('isAuthenticated');
            await AsyncStorage.removeItem('userEmail');
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
          await AsyncStorage.removeItem('isAuthenticated');
          await AsyncStorage.removeItem('userEmail');
        }

        setIsLoading(false);
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
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

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

