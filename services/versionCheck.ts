import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

const VERSION_CHECK_KEY = 'last_version_check';
const SKIP_VERSION_KEY = 'skip_version';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const LAST_UPDATE_ID_KEY = 'last_update_id';

export interface VersionInfo {
  currentVersion: string;
  currentVersionCode: number;
  latestVersionCode: number;
  updateAvailable: boolean;
  forceUpdate: boolean;
}

/**
 * Get current app version
 */
export const getCurrentVersion = (): string => {
  return Application.nativeApplicationVersion || '1.0.1';
};

/**
 * Get current app version code (Android) or build number (iOS)
 */
export const getCurrentVersionCode = (): number => {
  if (Platform.OS === 'android') {
    return parseInt(Application.nativeBuildVersion || '8', 10);
  } else {
    return parseInt(Application.nativeBuildVersion || '1', 10);
  }
};

/**
 * Check if app needs to check for updates
 * Returns true if last check was more than CHECK_INTERVAL ago
 */
export const shouldCheckForUpdate = async (): Promise<boolean> => {
  try {
    const lastCheck = await AsyncStorage.getItem(VERSION_CHECK_KEY);
    if (!lastCheck) return true;
    
    const lastCheckTime = parseInt(lastCheck, 10);
    const now = Date.now();
    
    return (now - lastCheckTime) > CHECK_INTERVAL;
  } catch (error) {
    console.error('Error checking update interval:', error);
    return true;
  }
};

/**
 * Mark that we've checked for updates
 */
export const markVersionChecked = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(VERSION_CHECK_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error marking version checked:', error);
  }
};

/**
 * Check if user has skipped this version
 */
export const hasSkippedVersion = async (version: string): Promise<boolean> => {
  try {
    const skippedVersion = await AsyncStorage.getItem(SKIP_VERSION_KEY);
    return skippedVersion === version;
  } catch (error) {
    console.error('Error checking skipped version:', error);
    return false;
  }
};

/**
 * Mark that user has skipped this version
 */
export const skipVersion = async (version: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(SKIP_VERSION_KEY, version);
  } catch (error) {
    console.error('Error skipping version:', error);
  }
};

/**
 * Clear skipped version (when user updates or new version is available)
 */
export const clearSkippedVersion = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SKIP_VERSION_KEY);
  } catch (error) {
    console.error('Error clearing skipped version:', error);
  }
};

/**
 * Check for app updates from backend API
 */
export const checkForUpdates = async (): Promise<VersionInfo | null> => {
  try {
    const currentVersion = getCurrentVersion();
    const currentVersionCode = getCurrentVersionCode();
    const platform = Platform.OS;

    console.log('[VersionCheck] Checking for updates...', {
      platform,
      currentVersion,
      currentVersionCode,
    });

    // Call backend to get latest version info
    const response = await fetch(`${API_BASE_URL}/get/mobile/latest-version`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[VersionCheck] Version check failed:', response.status);
      return null;
    }

    const result = await response.json();

    if (!result.status || !result.data) {
      console.warn('[VersionCheck] Invalid version check response');
      return null;
    }

    const platformData = platform === 'ios' ? result.data.ios : result.data.android;

    if (!platformData) {
      console.warn('[VersionCheck] No platform data found');
      return null;
    }

    // Compare versions
    let updateAvailable = false;
    let latestVersionCode = 0;

    if (platform === 'android') {
      // For Android, compare versionCode
      latestVersionCode = platformData.versionCode || 0;
      updateAvailable = currentVersionCode < latestVersionCode;
    } else {
      // For iOS, compare buildNumber
      latestVersionCode = parseInt(platformData.buildNumber || '1', 10);
      updateAvailable = currentVersionCode < latestVersionCode;
    }

    console.log('[VersionCheck] Update check result:', {
      updateAvailable,
      currentVersionCode,
      latestVersionCode,
      forceUpdate: platformData.updateRequired,
    });

    return {
      currentVersion,
      currentVersionCode,
      latestVersionCode,
      updateAvailable,
      forceUpdate: platformData.updateRequired || false,
    };
  } catch (error) {
    console.error('[VersionCheck] Error checking for updates:', error);
    return null;
  }
};

/**
 * Check if app was just updated (OTA)
 */
export const wasJustUpdated = async (): Promise<boolean> => {
  try {
    if (!Updates.isEnabled) {
      return false;
    }

    // Check if there's a new update that was just applied
    const currentUpdateId = Updates.updateId;
    const lastUpdateId = await AsyncStorage.getItem(LAST_UPDATE_ID_KEY);

    if (currentUpdateId && currentUpdateId !== lastUpdateId) {
      // Save the new update ID
      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, currentUpdateId);

      // If there was a previous update ID, it means we just updated
      return lastUpdateId !== null;
    }

    return false;
  } catch (error) {
    console.error('Error checking if just updated:', error);
    return false;
  }
};

/**
 * Check for OTA updates (Over-The-Air) using Expo Updates
 * This is for development and EAS Update builds
 */
export const checkForOTAUpdates = async (): Promise<boolean> => {
  try {
    if (!Updates.isEnabled) {
      console.log('[OTA] Updates are disabled');
      return false;
    }

    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      console.log('[OTA] Update available, downloading...');
      await Updates.fetchUpdateAsync();
      console.log('[OTA] Update downloaded successfully');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[OTA] Error checking for updates:', error);
    return false;
  }
};

/**
 * Reload the app with the new OTA update
 */
export const reloadApp = async (): Promise<void> => {
  try {
    await Updates.reloadAsync();
  } catch (error) {
    console.error('Error reloading app:', error);
  }
};

/**
 * Compare version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  
  return 0;
};
