import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import { Linking, Platform } from 'react-native';
import ApiService from './api';
import { logger, logGoogleAuth, logError, logCritical } from '../utils/logger';

WebBrowser.maybeCompleteAuthSession();

// Backend configuration
const BACKEND_URL = 'https://app.plexseller.com';
const GOOGLE_WEB_CLIENT_ID = '227685404880-cdk3pq80i0d91si864gaakka214tg34l.apps.googleusercontent.com';

const ENABLE_GOOGLE_SIGNIN = true;

// Get the proper redirect URI for the current environment (Expo Go vs standalone)
const getRedirectUri = () => {
  // For Expo Go: exp://...
  // For standalone: plexcash://redirect
  return AuthSession.makeRedirectUri({
    path: 'redirect'
  });
};

class GoogleAuthService {
  /**
   * Generate a consistent device ID for this device
   */
  private static async getDeviceId(): Promise<string> {
    try {
      // Try to get stored device ID
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      let deviceId = await AsyncStorage.getItem('deviceId');

      if (!deviceId) {
        // Generate new device ID
        const randomBytes = await Crypto.getRandomBytesAsync(32);
        deviceId = Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Store for future use
        await AsyncStorage.setItem('deviceId', deviceId);
      }

      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      // Fallback: generate temporary device ID
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      return Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }

  /**
   * Wait for deep link callback from backend
   */
  private static waitForDeepLink(timeoutMs: number = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('[Deep Link] Setting up listener...');
      console.log('[Deep Link] Timeout set to:', timeoutMs, 'ms');

      const timeout = setTimeout(() => {
        console.log('[Deep Link] ❌ TIMEOUT - No deep link received after', timeoutMs, 'ms');
        subscription.remove();
        reject(new Error('Deep link timeout - authentication took too long'));
      }, timeoutMs);

      const subscription = Linking.addEventListener('url', (event) => {
        console.log('[Deep Link] ✅ RECEIVED:', event.url);
        clearTimeout(timeout);
        subscription.remove();
        resolve(event.url);
      });

      console.log('[Deep Link] Listener registered successfully');

      // Also check if there's already a URL waiting (initial URL)
      Linking.getInitialURL().then(url => {
        if (url) {
          console.log('[Deep Link] Found initial URL:', url);
        }
      });
    });
  }

  /**
   * Sign in with Google using backend redirect flow
   */
  static async signInWithGoogle() {
    try {
      logGoogleAuth('🚀 Starting Google Sign-In flow...');

      if (!ENABLE_GOOGLE_SIGNIN) {
        logError('Google Sign-In is disabled', { context: 'GOOGLE-AUTH' });
        return {
          success: false,
          error: 'Google Sign-In is disabled',
          needsConfiguration: true
        } as const;
      }

      if (GOOGLE_WEB_CLIENT_ID.includes('your-web-client-id')) {
        logError('Google Client ID not configured', { context: 'GOOGLE-AUTH' });
        return {
          success: false,
          error: 'Please configure GOOGLE_WEB_CLIENT_ID',
          needsConfiguration: true
        } as const;
      }

      logGoogleAuth('Configuration validated, proceeding with authentication');
      console.log('Starting Google Sign-In with backend redirect flow...');

      // Step 1: Get device ID
      logGoogleAuth('Step 1: Getting device ID...');
      const deviceId = await this.getDeviceId();
      logGoogleAuth('Device ID obtained', { deviceId: deviceId.substring(0, 16) + '...' });
      console.log('Device ID:', deviceId.substring(0, 16) + '...');

      // Step 2: Initialize session with backend
      logGoogleAuth('Step 2: Initializing auth session with backend...');
      console.log('Initializing auth session with backend...');
      const initResponse = await fetch(`${BACKEND_URL}/auth/mobile/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          platform: Platform.OS
        })
      });

      if (!initResponse.ok) {
        logError('Backend init request failed', {
          context: 'GOOGLE-AUTH',
          data: { status: initResponse.status }
        });

        // Check if response is HTML (backend route not registered)
        const contentType = initResponse.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error(
            'Backend OAuth routes not registered yet.\n\n' +
            'Please follow these steps:\n' +
            '1. Open Server/index.ts\n' +
            '2. Add these routes:\n' +
            '   import MobileOAuthController from \'./Controllers/MobileOAuthController\';\n' +
            '   app.post(\'/auth/mobile/init\', MobileOAuthController.initMobileAuth);\n' +
            '   app.get(\'/auth/mobile/callback\', MobileOAuthController.handleMobileCallback);\n' +
            '   app.post(\'/auth/mobile/verify\', MobileOAuthController.verifyMobileSession);\n' +
            '3. Restart the backend server\n\n' +
            'See: MOBILE_OAUTH_README.md for details'
          );
        }

        // Try to parse JSON error
        try {
          const errorData = await initResponse.json();
          throw new Error(errorData.error || 'Failed to initialize authentication');
        } catch (parseError) {
          throw new Error(`Backend error (${initResponse.status}): Failed to initialize authentication`);
        }
      }

      const { sessionId, csrfToken } = await initResponse.json();
      logGoogleAuth('Session initialized successfully', { sessionId: sessionId.substring(0, 8) + '...' });
      console.log('Session initialized:', sessionId.substring(0, 8) + '...');

      // Step 3: Get the proper mobile redirect URI for current environment
      const mobileRedirectUri = getRedirectUri();
      console.log('📱 Mobile Redirect URI for this environment:', mobileRedirectUri);

      // Step 3b: Build Google OAuth URL
      // IMPORTANT: Encode sessionId, csrfToken, AND mobileRedirectUri into state parameter
      const stateParam = JSON.stringify({
        session: sessionId,
        csrf: csrfToken,
        mobileRedirect: mobileRedirectUri
      });
      const backendCallbackUri = BACKEND_URL + '/auth/mobile/callback';

      // IMPORTANT: OAuth parameters for device trust/remembering:
      // - access_type=offline: Get refresh token for long-term access
      // - prompt parameter options:
      //   * 'none': No UI shown, fails if user not already authenticated (best for silent re-auth)
      //   * 'consent': Always show consent screen (forces re-authentication)
      //   * 'select_account': Always show account picker (forces re-authentication + 2FA)
      //   * OMIT prompt: Google decides based on session state (RECOMMENDED for device trust)
      //
      // By OMITTING the prompt parameter, Google will:
      // - Show account picker on first login
      // - Remember the device after 2FA verification
      // - Skip 2FA on subsequent logins from the same device/browser
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(backendCallbackUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `state=${encodeURIComponent(stateParam)}&` +
        `access_type=offline`;

      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔗 GOOGLE OAUTH URL DETAILS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      console.log('📍 Backend URL:', BACKEND_URL);
      console.log('📍 Backend Callback URI:', backendCallbackUri);
      console.log('📍 Mobile Redirect URI:', mobileRedirectUri);
      console.log('📍 Client ID:', GOOGLE_WEB_CLIENT_ID);
      console.log('');
      console.log('🌐 FULL GOOGLE LOGIN URL:');
      console.log('───────────────────────────────────────────────────────────');
      console.log(authUrl);
      console.log('───────────────────────────────────────────────────────────');
      console.log('');
      console.log('⚠️  IMPORTANT: Add this redirect URI to Google Cloud Console:');
      console.log('   1. Go to: https://console.cloud.google.com/apis/credentials');
      console.log('   2. Edit Web OAuth 2.0 Client');
      console.log('   3. Add to "Authorized redirect URIs":', backendCallbackUri);
      console.log('   4. Save and wait 5-10 minutes');
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      // Step 4: Open browser for OAuth using openAuthSessionAsync
      // This method is specifically designed for OAuth flows and handles redirects properly
      logGoogleAuth('Step 3: Opening browser for Google OAuth...');
      console.log('Opening browser for Google OAuth...');
      console.log('Using WebBrowser.openBrowserAsync with manual deep link listener...');

      // Warm up browser for better performance and control
      try {
        await WebBrowser.warmUpAsync();
        console.log('Browser warmed up');
      } catch (e) {
        console.warn('Failed to warm up browser:', e);
      }

      // Set up deep link listener BEFORE opening browser
      const redirectUrlPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Deep link timeout - no redirect received within 5 minutes'));
        }, 5 * 60 * 1000); // 5 minute timeout

        const subscription = Linking.addEventListener('url', (event) => {
          console.log('Deep link received:', event.url);

          // Check if this is our redirect URL
          if (event.url.startsWith(mobileRedirectUri)) {
            clearTimeout(timeout);
            subscription.remove();

            // CRITICAL: Dismiss browser IMMEDIATELY when deep link is received
            // Try multiple times with different delays for maximum compatibility
            console.log('Deep link matched! Dismissing browser with multiple attempts...');

            // Attempt 1: Immediate
            try {
              WebBrowser.dismissBrowser();
            } catch (e) {
              // Ignore
            }

            // Attempt 2: After 50ms
            setTimeout(() => {
              try {
                WebBrowser.dismissBrowser();
              } catch (e) {
                // Ignore
              }
            }, 50);

            // Attempt 3: After 100ms
            setTimeout(() => {
              try {
                WebBrowser.dismissBrowser();
              } catch (e) {
                // Ignore
              }
            }, 100);

            // Attempt 4: After 200ms
            setTimeout(() => {
              try {
                WebBrowser.dismissBrowser();
              } catch (e) {
                // Ignore
              }
            }, 200);

            resolve(event.url);
          }
        });
      });

      // Open browser (non-blocking)
      await WebBrowser.openBrowserAsync(authUrl, {
        showTitle: true,
        enableBarCollapsing: false,
        createTask: false,
      });

      console.log('Browser opened, waiting for deep link redirect...');

      // Wait for deep link
      let redirectUrl: string;
      try {
        redirectUrl = await redirectUrlPromise;
        logGoogleAuth('Received redirect URL from deep link', { url: redirectUrl.substring(0, 50) + '...' });
        console.log('Received redirect URL:', redirectUrl);

        // Give browser a moment to dismiss (already called in deep link handler)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logError('Deep link timeout or error', { context: 'GOOGLE-AUTH', data: { error } });
        console.error('Deep link error:', error);

        // Try to dismiss browser on error
        try {
          await WebBrowser.dismissBrowser();
        } catch (e) {
          // Ignore
        }

        return {
          success: false as const,
          error: 'Authentication timeout - no redirect received'
        };
      }

      // Step 7: Parse redirect URL
      logGoogleAuth('Step 4: Parsing redirect URL...');
      const url = new URL(redirectUrl);
      const returnedSessionId = url.searchParams.get('session');
      const error = url.searchParams.get('error');

      if (error) {
        logError('Authentication error from redirect', {
          context: 'GOOGLE-AUTH',
          data: { error }
        });
        throw new Error(`Authentication error: ${error}`);
      }

      if (!returnedSessionId) {
        logError('No session returned from authentication', { context: 'GOOGLE-AUTH' });
        throw new Error('No session returned from authentication');
      }

      logGoogleAuth('Session ID extracted from redirect', { sessionId: returnedSessionId.substring(0, 8) + '...' });

      // Step 8: Verify session and get Firebase token
      logGoogleAuth('Step 5: Verifying session with backend...');
      console.log('Verifying session with backend...');
      const verifyResponse = await fetch(`${BACKEND_URL}/auth/mobile/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: returnedSessionId,
          deviceId
        })
      });

      if (!verifyResponse.ok) {
        logError('Session verification failed', {
          context: 'GOOGLE-AUTH',
          data: { status: verifyResponse.status }
        });

        // Check if response is HTML (backend route not registered)
        const contentType = verifyResponse.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Backend OAuth routes not registered. See MOBILE_OAUTH_README.md');
        }

        // Try to parse JSON error
        try {
          const errorData = await verifyResponse.json();
          throw new Error(errorData.error || 'Failed to verify session');
        } catch (parseError) {
          throw new Error(`Backend error (${verifyResponse.status}): Failed to verify session`);
        }
      }

      const { token: customToken, email } = await verifyResponse.json();
      logGoogleAuth('Custom Firebase token received', { email });
      console.log('Custom Firebase token received for:', email);

      // Step 8: Sign in to Firebase with custom token to get ID token
      logGoogleAuth('Step 6: Signing in to Firebase with custom token...');
      console.log('Signing in to Firebase with custom token...');
      const { auth } = require('../config/firebase');
      const { signInWithCustomToken } = require('firebase/auth');

      const userCredential = await signInWithCustomToken(auth, customToken);
      logGoogleAuth('✅ Firebase sign-in successful!', { uid: userCredential.user.uid });
      console.log('Firebase sign-in successful!');

      // Get the ID token from the signed-in user
      const idToken = await userCredential.user.getIdToken();
      logGoogleAuth('Firebase ID token obtained');
      console.log('Firebase ID token obtained');

      // Step 9: Exchange Firebase ID token with PlexSeller backend
      logGoogleAuth('Step 7: Exchanging Firebase ID token with backend...');
      console.log('Exchanging Firebase ID token with backend...');
      const loginResponse = await ApiService.exchangeFirebaseToken(idToken);

      if (!loginResponse.status) {
        logError('Backend authentication failed', { context: 'GOOGLE-AUTH' });
        throw new Error('Backend authentication failed');
      }

      logGoogleAuth('✅ Backend authentication successful!');
      console.log('Google Sign-In completed successfully!');

      // CRITICAL: This triggers AuthContext's onAuthStateChanged listener
      // The listener will:
      // 1. Store tokens in AsyncStorage/SecureStore
      // 2. Set isAuthenticated = true
      // 3. Trigger RootNavigator to show MainScreen
      logGoogleAuth('⚠️ IMPORTANT: onAuthStateChanged listener should fire now...');
      logGoogleAuth('Waiting for AuthContext to update authentication state...');

      // Note: Token storage is handled by AuthContext's onAuthStateChanged listener
      // which fires automatically after signInWithCustomToken() completes.
      // This ensures the token is stored BEFORE isAuthenticated is set to true,
      // preventing race conditions where MainScreen tries to make authenticated
      // requests before the token is available.

      return {
        success: true as const,
        email,
        firebaseToken: idToken,
        deviceId,
        ...loginResponse
      };

    } catch (error: any) {
      logError('Google Sign-In Error', {
        context: 'GOOGLE-AUTH',
        data: {
          message: error.message,
          stack: error.stack
        }
      });
      console.error('Google Sign-In Error:', error);
      return {
        success: false as const,
        error: error.message || 'An error occurred during sign-in'
      };
    }
  }

  static getConfigurationStatus() {
    if (!ENABLE_GOOGLE_SIGNIN) {
      return {
        configured: false,
        message: 'Google Sign-In is disabled',
        instructions: [
          '1. Set ENABLE_GOOGLE_SIGNIN to true',
          '2. Configure backend redirect URIs in Google Cloud Console'
        ]
      };
    }

    if (GOOGLE_WEB_CLIENT_ID.includes('your-web-client-id')) {
      return {
        configured: false,
        message: 'Google Client ID not configured',
        instructions: [
          '1. Get Web Client ID from Google Cloud Console',
          '2. Update GOOGLE_WEB_CLIENT_ID in services/googleAuth.ts'
        ]
      };
    }

    return { configured: true, message: 'Google Sign-In is configured and ready' };
  }

  /**
   * Show configuration help
   */
  static showConfigurationHelp() {
    const message = `
📋 GOOGLE OAUTH CONFIGURATION

1. Go to Google Cloud Console:
https://console.cloud.google.com/

2. Navigate to:
APIs & Services > Credentials

3. Edit your Web OAuth 2.0 Client:
${GOOGLE_WEB_CLIENT_ID}

4. Add to "Authorized JavaScript origins":
${BACKEND_URL}

5. Add to "Authorized redirect URIs":
${BACKEND_URL}/auth/mobile/callback

6. Configure OAuth Consent Screen:
- Add test users (your email)
- Add scopes: email, profile, openid

7. Wait 10 minutes and try again!
    `.trim();

    console.log(message);
    return { clientId: GOOGLE_WEB_CLIENT_ID, backendUrl: BACKEND_URL, message };
  }
}

export default GoogleAuthService;

