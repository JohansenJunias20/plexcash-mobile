import { useState, useEffect, useCallback } from 'react';
import {
  checkForUpdates,
  checkForOTAUpdates,
  shouldCheckForUpdate,
  markVersionChecked,
  skipVersion,
  hasSkippedVersion,
  clearSkippedVersion,
  reloadApp,
  wasJustUpdated,
  VersionInfo,
} from '../services/versionCheck';

export const useAppUpdate = () => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showUpdateSuccessModal, setShowUpdateSuccessModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Check for updates (both store and OTA)
   */
  const performUpdateCheck = useCallback(async (force: boolean = false) => {
    try {
      setIsChecking(true);

      // Check if we should check for updates
      if (!force) {
        const shouldCheck = await shouldCheckForUpdate();
        if (!shouldCheck) {
          console.log('Skipping update check - too soon since last check');
          return;
        }
      }

      // First check for OTA updates (faster, silent)
      const otaUpdateAvailable = await checkForOTAUpdates();
      
      // Then check for store updates (requires backend API)
      const storeVersionInfo = await checkForUpdates();

      if (storeVersionInfo && storeVersionInfo.updateAvailable) {
        // Check if user has skipped this version
        const skipped = await hasSkippedVersion(storeVersionInfo.latestVersionCode.toString());

        // Only show modal if:
        // 1. Force update is required, OR
        // 2. User hasn't skipped this version
        if (storeVersionInfo.forceUpdate || !skipped) {
          setVersionInfo(storeVersionInfo);
          setShowUpdateModal(true);
        }
      } else if (otaUpdateAvailable) {
        // OTA update is available
        console.log('OTA update available - reloading app');
        await reloadApp();
      }

      // Mark that we've checked
      await markVersionChecked();
    } catch (error) {
      console.error('Error performing update check:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Check if app was just updated on mount
   */
  useEffect(() => {
    const checkIfUpdated = async () => {
      const justUpdated = await wasJustUpdated();
      if (justUpdated) {
        console.log('[AppUpdate] App was just updated, showing success modal');
        setShowUpdateSuccessModal(true);
      }
    };

    checkIfUpdated();
  }, []);

  /**
   * Initialize update check on app start
   */
  useEffect(() => {
    // Check for updates after a short delay to not block app startup
    const timer = setTimeout(() => {
      performUpdateCheck();
    }, 2000);

    return () => clearTimeout(timer);
  }, [performUpdateCheck]);

  /**
   * Handle update button press
   */
  const handleUpdate = useCallback(async () => {
    try {
      setIsUpdating(true);

      // Perform OTA update
      const success = await checkForOTAUpdates();
      if (success) {
        await reloadApp();
      }

      // Clear skipped version when user updates
      await clearSkippedVersion();
    } catch (error) {
      console.error('Error updating app:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [versionInfo]);

  /**
   * Handle skip version
   */
  const handleSkip = useCallback(async () => {
    if (versionInfo) {
      await skipVersion(versionInfo.latestVersionCode.toString());
      setShowUpdateModal(false);
    }
  }, [versionInfo]);

  /**
   * Handle later (dismiss modal)
   */
  const handleLater = useCallback(() => {
    setShowUpdateModal(false);
  }, []);

  /**
   * Handle close update success modal
   */
  const handleCloseUpdateSuccess = useCallback(() => {
    setShowUpdateSuccessModal(false);
  }, []);

  /**
   * Manual update check (for settings screen)
   */
  const checkNow = useCallback(async () => {
    await performUpdateCheck(true);
  }, [performUpdateCheck]);

  return {
    showUpdateModal,
    showUpdateSuccessModal,
    versionInfo,
    isUpdating,
    isChecking,
    handleUpdate,
    handleSkip,
    handleLater,
    handleCloseUpdateSuccess,
    checkNow,
  };
};
