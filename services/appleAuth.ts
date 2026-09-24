import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, updateProfile, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { logError } from '../utils/logger';

export type AppleAuthResult =
  | { success: true; user: User; email: string | null }
  | { success: false; cancelled: true }
  | { success: false; error: string; cancelled?: false };

class AppleAuthService {
  /**
   * Determine if the current device/OS supports Apple Authentication.
   * Resolves to true on iOS 13+ devices, false on Android/Web/unsupported environments.
   */
  static async isAvailable(): Promise<boolean> {
    try {
      return await AppleAuthentication.isAvailableAsync();
    } catch (error) {
      console.warn('Error checking Apple Authentication availability:', error);
      return false;
    }
  }

  /**
   * Sign in natively with Apple, link credentials to Firebase Auth,
   * and allow AuthContext's onAuthStateChanged listener to handle backend token exchange.
   */
  static async signInWithApple(): Promise<AppleAuthResult> {
    try {
      console.log('🚀 [APPLE-AUTH] Starting Apple Sign-In flow...');

      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Sign in with Apple is not supported on this device.',
        };
      }

      // Step 1: Generate a cryptographically secure 32-byte raw nonce
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const rawNonce = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Step 2: Compute SHA-256 hash of the nonce for Apple sheet request
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // Step 3: Present native Apple authorization sheet
      console.log('📱 [APPLE-AUTH] Presenting native Apple authorization sheet...');
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { identityToken } = appleCredential;
      if (!identityToken) {
        logError('No identity token received from Apple', { context: 'APPLE-AUTH' });
        return {
          success: false,
          error: 'Apple Sign-In failed: No identity token received.',
        };
      }

      // Step 4: Build Firebase OAuthProvider credential
      console.log('🔥 [APPLE-AUTH] Building Firebase credential with identityToken & rawNonce...');
      const provider = new OAuthProvider('apple.com');
      const authCredential = provider.credential({
        idToken: identityToken,
        rawNonce,
      });

      // Step 5: Sign in to Firebase Auth using credential
      console.log('🔥 [APPLE-AUTH] Signing in to Firebase Auth...');
      const userCredential = await signInWithCredential(auth, authCredential);
      console.log('✅ [APPLE-AUTH] Firebase sign-in successful! UID:', userCredential.user.uid);

      // Step 6: Save fullName if present (Apple only returns fullName on FIRST sign-in)
      if (appleCredential.fullName) {
        const { givenName, middleName, familyName } = appleCredential.fullName;
        const nameParts = [givenName, middleName, familyName].filter(Boolean);
        const displayName = nameParts.join(' ').trim();

        if (displayName && userCredential.user) {
          try {
            await updateProfile(userCredential.user, { displayName });
            console.log('✅ [APPLE-AUTH] Updated Firebase user displayName:', displayName);
          } catch (profileError) {
            console.warn('⚠️ [APPLE-AUTH] Could not update displayName:', profileError);
          }
        }
      }

      // Note: AuthContext's onAuthStateChanged listener will automatically fire,
      // call ApiService.exchangeFirebaseToken(), store the device tokens,
      // and update isAuthenticated = true to navigate to MainScreen.
      return {
        success: true,
        user: userCredential.user,
        email: userCredential.user.email,
      };
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED' || error?.code === 'ERR_CANCELED') {
        console.log('ℹ️ [APPLE-AUTH] User cancelled Apple Sign-In.');
        return {
          success: false,
          cancelled: true,
        };
      }

      logError('Apple Sign-In Error', {
        context: 'APPLE-AUTH',
        data: {
          code: error?.code,
          message: error?.message,
        },
      });
      console.error('❌ [APPLE-AUTH] Apple Sign-In Error:', error);

      return {
        success: false,
        error: error?.message || 'An unexpected error occurred during Apple Sign-In.',
      };
    }
  }
}

export default AppleAuthService;
