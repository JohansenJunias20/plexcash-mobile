import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

const VERSION_CHECK_KEY = 'last_version_check';
const SKIP_VERSION_KEY = 'skip_version';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  forceUpdate: boolean;
  updateUrl?: string;
  releaseNotes?: string;
}

/**
 * Get current app version
 */
export const getCurrentVersion = (): string => {
  return Application.nativeApplicationVersion || '1.0.0';
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
 * Check for app updates from your backend API
 */
export const checkForUpdates = async (): Promise<VersionInfo | null> => {
  try {
    const currentVersion = getCurrentVersion();
    
    // Call backend to check for updates
    const response = await fetch(`${API_BASE_URL}/api/app/version-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: Application.applicationId?.includes('ios') ? 'ios' : 'android',
        currentVersion,
      }),
    });

    if (!response.ok) {
      console.warn('Version check failed:', response.status);
      return null;
    }

    const result = await response.json();
    
    if (!result.status || !result.data) {
      console.warn('Invalid version check response');
      return null;
    }

    const data = result.data;
    
    return {
      currentVersion,
      latestVersion: data.latestVersion,
      updateAvailable: data.updateAvailable,
      forceUpdate: data.forceUpdate || false,
      updateUrl: data.updateUrl,
      releaseNotes: data.releaseNotes,
    };
  } catch (error) {
    console.error('Error checking for updates:', error);
    return null;
  }
};

/**
 * Check for OTA updates (Over-The-Air) using Expo Updates
 * This is for development and EAS Update builds
 */
export const checkForOTAUpdates = async (): Promise<boolean> => {
  try {
    if (!Updates.isEnabled) {
      console.log('OTA updates are disabled');
      return false;
    }

    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking for OTA updates:', error);
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
