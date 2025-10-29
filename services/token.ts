import * as SecureStore from 'expo-secure-store';

const KEY = 'authToken';

export async function getTokenAuth(): Promise<string | null> {
  try {
    console.log('🔑 [TOKEN] Getting auth token from SecureStore');
    const token = await SecureStore.getItemAsync(KEY);
    console.log('🔑 [TOKEN] Token retrieved:', token ? `${token.substring(0, 50)}...` : 'null');
    return token ?? null;
  } catch (err) {
    console.error('❌ [TOKEN] SecureStore getTokenAuth error:', err);
    return null;
  }
}

export async function setTokenAuth(token: string): Promise<void> {
  try {
    console.log('🔐 [TOKEN] Storing auth token in SecureStore');
    await SecureStore.setItemAsync(KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    console.log('🔐 [TOKEN] Auth token stored successfully in SecureStore');
  } catch (err) {
    console.error('❌ [TOKEN] SecureStore setTokenAuth error:', err);
    throw err;
  }
}

export async function clearTokenAuth(): Promise<void> {
  try {
    // Get stack trace to see WHO is calling this
    const stack = new Error().stack;
    console.log('🧹 [TOKEN] ⚠️  CLEARING AUTH TOKEN FROM SECURESTORE ⚠️');
    console.log('🧹 [TOKEN] Called from stack trace:');
    console.log(stack);
    console.log('🧹 [TOKEN] ════════════════════════════════════════');

    await SecureStore.deleteItemAsync(KEY);
    console.log('🧹 [TOKEN] Auth token cleared from SecureStore');
  } catch (err) {
    console.error('❌ [TOKEN] SecureStore clearTokenAuth error:', err);
  }
}

