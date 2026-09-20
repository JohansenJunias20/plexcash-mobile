import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessProvider } from './context/AccessContext';
import { OrderAlarmProvider } from './context/OrderAlarmContext';
import OrderAlarmModal from './components/OrderAlarmModal';
import { DeveloperModeProvider, useDeveloperMode } from './context/DeveloperModeContext';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import ApiService from './services/api';
import { registerForPushNotificationsAsync, addNotificationListeners, syncFcmTokenWithBackend } from './services/notificationService';
import LogViewer from './components/LogViewer';
import UpdateModal from './components/UpdateModal';
import UpdateSuccessModal from './components/UpdateSuccessModal';
import SubscriptionAlertModal from './components/SubscriptionAlertModal';
import { useAppUpdate } from './hooks/useAppUpdate';
import * as AuthSession from "expo-auth-session";
import { Alert } from 'react-native';
import FlashMessage from 'react-native-flash-message';

// Log app configuration on startup
console.log('[App] Starting PlexSeller...');
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawerNavigator from './navigation/DrawerNavigator';

// Global error handler for BLE library crashes
const setupGlobalErrorHandler = () => {
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const errorStr = String(error);

    // Handle BLE-specific errors
    if (errorStr.includes('PromiseImpl.reject') ||
        errorStr.includes('BlePlxModule') ||
        errorStr.includes('GATT')) {
      console.error('❌ [GLOBAL] Caught BLE error:', error);

      // Don't crash the app for BLE errors
      if (!isFatal) {
        Alert.alert(
          'Bluetooth Error',
          'Failed to connect to printer. Please try again or restart Bluetooth.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    // Call original handler for other errors
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
};

// Setup error handler on app start
setupGlobalErrorHandler();
// import { createDrawerNavigator } from '@react-navigation/drawer';
// import MainScreen from './components/MainScreen';

// Safely log redirect URI only after modules are ready
try {
  console.log(AuthSession.makeRedirectUri({ useProxy: true } as any));
} catch (error) {
  console.warn('AuthSession not ready yet:', error);
}

// Inner component that uses DeveloperModeContext
const AppContent = (): React.JSX.Element => {
  const { isDeveloperMode } = useDeveloperMode();
  const { isAuthenticated } = useAuth();
  const {
    showUpdateModal,
    showUpdateSuccessModal,
    versionInfo,
    isUpdating,
    handleUpdate,
    handleSkip,
    handleLater,
    handleCloseUpdateSuccess,
  } = useAppUpdate();

  // Initialize push notification service & listeners
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        console.log('🔔 [App] Push notification initialized');
      }
    });

    const cleanupListeners = addNotificationListeners(
      (notification) => {
        console.log('🔔 [App] Foreground notification received:', notification.request.content.title);
      },
      (response) => {
        console.log('👆 [App] Notification clicked:', response.notification.request.content.data);
      }
    );

    return () => {
      cleanupListeners();
    };
  }, []);

  // Sync FCM token to backend whenever authentication state is active
  useEffect(() => {
    if (isAuthenticated) {
      syncFcmTokenWithBackend();
    }
  }, [isAuthenticated]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer>
        {/* <RootNavigator /> */}
        <DrawerNavigator />
      </NavigationContainer>

      {/* Update Modal - Always check on app start */}
      <UpdateModal
        visible={showUpdateModal}
        versionInfo={versionInfo}
        onUpdate={handleUpdate}
        onSkip={handleSkip}
        onLater={handleLater}
        isUpdating={isUpdating}
      />

      {/* Update Success Modal - Show after OTA update */}
      <UpdateSuccessModal
        visible={showUpdateSuccessModal}
        onClose={handleCloseUpdateSuccess}
      />

      {/* Developer Mode Log Viewer */}
      {isDeveloperMode && <LogViewer visible={true} />}

      {/* Subscription Alert Modal */}
      <SubscriptionAlertModal />

      {/* Flash Message - Global notification system */}
      <FlashMessage position="top" />

      {/* Instant Order Alarm - full-screen, shows above any screen while app is open */}
      <OrderAlarmModal />
    </View>
  );
};

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DeveloperModeProvider>
        <AuthProvider>
          <AccessProvider>
            <OrderAlarmProvider>
              <AppContent />
            </OrderAlarmProvider>
          </AccessProvider>
        </AuthProvider>
      </DeveloperModeProvider>
    </GestureHandlerRootView>
  );
}

// Register global 401/403 handler to auto-redirect to login
ApiService.setAuthErrorHandler(() => {
  console.log('🚨 [AUTH-ERROR-HANDLER] Token expired or unauthorized - triggering logout');

  // Use the global signOut reference from AuthContext
  const { getGlobalSignOut } = require('./context/AuthContext');
  const signOut = getGlobalSignOut();

  if (signOut) {
    console.log('🚨 [AUTH-ERROR-HANDLER] Calling signOut...');
    signOut().catch((error: any) => {
      console.error('❌ [AUTH-ERROR-HANDLER] Error during signOut:', error);
    });
  } else {
    console.error('❌ [AUTH-ERROR-HANDLER] signOut function not available yet');
  }
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

