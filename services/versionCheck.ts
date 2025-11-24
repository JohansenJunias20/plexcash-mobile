import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';
import { Platform } from 'react-native';

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
  // Fallback to package.json version if expo-application is not available
  try {
    const packageJson = require('../package.json');
    return packageJson.version || '1.0.8';
  } catch {
    return '1.0.8';
  }
};

/**
 * Get current app version code (Android) or build number (iOS)
 */
export const getCurrentVersionCode = (): number => {
  // Return hardcoded version code for now
  return 8;
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
 * Note: OTA updates are currently disabled
 */
export const wasJustUpdated = async (): Promise<boolean> => {
  // OTA updates disabled - expo-updates module not available
  return false;
};

/**
 * Check for OTA updates (Over-The-Air) using Expo Updates
 * Note: OTA updates are currently disabled
 */
export const checkForOTAUpdates = async (): Promise<boolean> => {
  console.log('[OTA] Updates are disabled - expo-updates module not available');
  return false;
};

/**
 * Reload the app with the new OTA update
 * Note: OTA updates are currently disabled
 */
export const reloadApp = async (): Promise<void> => {
  console.log('[OTA] Reload not available - expo-updates module not available');
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
