import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';
import Settings from './Settings';
import GoogleAuthService from '../services/googleAuth';
import { useDeveloperMode } from '../context/DeveloperModeContext';

const LoginScreen = (): JSX.Element => {
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();

  const handleQRCodeLogin = () => setShowSettings(true);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      console.log('Starting Google Sign-In...');

      const result = await GoogleAuthService.signInWithGoogle();

      if (result.success) {
        console.log('Google Sign-In successful!');
        console.log('Email:', result.email);

        // The new flow already handles everything:
        // 1. OAuth with Google
        // 2. Backend creates Firebase custom token
        // 3. Mobile signs in with custom token
        // 4. Mobile gets ID token
        // 5. Mobile exchanges ID token with backend
        // All done! AuthContext will handle navigation automatically

        // ✅ DO NOT show Alert here - it blocks navigation!
        // The AuthContext's onAuthStateChanged listener will:
        // 1. Set isAuthenticated = true
        // 2. RootNavigator will automatically switch to MainScreen
        // Showing an Alert here creates a race condition that prevents navigation

        console.log('✅ Login successful! Waiting for AuthContext to navigate to MainScreen...');
      } else if (result.cancelled) {
        // User cancelled, no need to show error
        console.log('Google Sign-In cancelled by user');
      } else if (result.needsConfiguration) {
        Alert.alert('Configuration Required', result.error || 'Google Sign-In needs to be configured', [{ text: 'OK' }]);
      } else {
        // Check if it's an OAuth policy error
        const errorMsg = result.error || '';
        if (errorMsg.toLowerCase().includes('oauth') || errorMsg.toLowerCase().includes('policy') || errorMsg.toLowerCase().includes('blocked')) {
          Alert.alert(
            'Google OAuth Configuration Required',
            'This error occurs because the redirect URI is not configured in Google Cloud Console.\n\n' +
            'Check the console logs for the redirect URI and follow the instructions in FIX_GOOGLE_OAUTH_ERROR.md',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Authentication Failed', result.error || 'Google Sign-In failed', [{ text: 'OK' }]);
        }
      }
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      const errorMsg = error.message || '';

      // Provide helpful error messages
      if (errorMsg.includes('redirect_uri_mismatch')) {
        Alert.alert(
          'Redirect URI Mismatch',
          'The redirect URI is not configured in Google Cloud Console. Check the console logs for the correct URI.',
          [{ text: 'OK' }]
        );
      } else if (errorMsg.includes('invalid_client')) {
        Alert.alert(
          'Invalid Client ID',
          'The Google Client ID is not configured correctly. Please check services/googleAuth.ts',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', errorMsg || 'An unexpected error occurred', [{ text: 'OK' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseSettings = () => setShowSettings(false);

  if (showSettings) {
    return <Settings onClose={handleCloseSettings} />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            {/* Branding Section */}
            <View style={styles.brandingContainer}>
              <View style={styles.logoContainer}>
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoText}>P</Text>
                </View>
                <View style={styles.brandTextContainer}>
                  <Text style={styles.brandTitle}>Plex Seller</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                <Text style={styles.highlightText}>ERP</Text> gratis untuk <Text style={styles.highlightText}>E-Commerce</Text> Indonesia
              </Text>
            </View>

            {/* Features Section */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.featureText}>Integrasi dengan semua marketplace</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.featureText}>Manajemen inventaris</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.featureText}>Laporan akutansi</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.featureText}>Transaksi barang</Text>
              </View>
            </View>

            {/* Login Options Section */}
            <View style={styles.loginFormContainer}>
              <Text style={styles.loginTitle}>Choose Login Method</Text>

              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#f59e0b" />
                  <Text style={styles.loadingText}>Authenticating...</Text>
                </View>
              ) : (
                <>
                  {/* QR Code Login Button */}
                  <TouchableOpacity
                    style={styles.qrButton}
                    onPress={handleQRCodeLogin}
                    activeOpacity={0.8}
                  >
                    <View style={styles.buttonContent}>
                      <Ionicons name="qr-code" size={28} color="white" style={styles.buttonIcon} />
                      <View style={styles.buttonTextContainer}>
                        <Text style={styles.primaryButtonText}>Login with QR Code</Text>
                        <Text style={styles.buttonSubtext}>Scan QR from web app</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Google Login Button */}
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleLogin}
                    activeOpacity={0.8}
                  >
                    <View style={styles.buttonContent}>
                      <Ionicons name="logo-google" size={28} color="#4285F4" style={styles.buttonIcon} />
                      <View style={styles.buttonTextContainer}>
                        <Text style={styles.googleButtonText}>Login with Google Account</Text>
                        <Text style={styles.googleButtonSubtext}>Use your Google credentials</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.footer}>© {new Date().getFullYear()} Plex Seller. All rights reserved.</Text>
            </View>
          </View>
        </ScrollView>

        {/* Developer Mode Toggle Button - Long press (1s) or double-tap to toggle */}
        <TouchableOpacity
          style={[
            styles.devModeButton,
            !isDeveloperMode && styles.devModeButtonHidden
          ]}
          onPress={async () => {
            // Single tap to disable when in dev mode
            if (isDeveloperMode) {
              await toggleDeveloperMode();
              Alert.alert(
                'Developer Mode',
                'Developer mode has been disabled',
                [{ text: 'OK' }]
              );
            }
          }}
          onLongPress={async () => {
            await toggleDeveloperMode();
            Alert.alert(
              'Developer Mode',
              isDeveloperMode ? 'Developer mode has been disabled' : 'Developer mode has been enabled',
              [{ text: 'OK' }]
            );
          }}
          delayLongPress={1000}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isDeveloperMode ? 'bug' : 'bug-outline'}
            size={isDeveloperMode ? 24 : 16}
            color="white"
          />
          {isDeveloperMode && <View style={styles.devModeIndicator} />}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  gradient: {
    flex: 1
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  } as any,
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 24
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  logoText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold'
  },
  brandTextContainer: {
    flex: 1
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24
  },
  highlightText: {
    color: '#d97706',
    fontStyle: 'italic'
  },
  featuresContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  bulletPoint: {
    color: '#d97706',
    fontSize: 16,
    marginRight: 8,
    marginTop: 2
  },
  featureText: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
    lineHeight: 20
  },
  loginFormContainer: {
    alignItems: 'center',
    width: '100%'
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 32
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  qrButton: {
    width: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  } as any,
  googleButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  } as any,
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonTextContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '400',
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  googleButtonSubtext: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
  },
  footer: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  devModeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  devModeButtonHidden: {
    opacity: 0.1,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    shadowOpacity: 0,
    elevation: 0,
  },
  devModeIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: 'white',
  },
});

export default LoginScreen;

