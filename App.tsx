import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from './context/AuthContext';
import { AccessProvider } from './context/AccessContext';
import { DeveloperModeProvider, useDeveloperMode } from './context/DeveloperModeContext';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import ApiService from './services/api';
import LogViewer from './components/LogViewer';
import UpdateModal from './components/UpdateModal';
import UpdateSuccessModal from './components/UpdateSuccessModal';
import { useAppUpdate } from './hooks/useAppUpdate';
import * as AuthSession from "expo-auth-session";

// Log app configuration on startup
console.log('[App] Starting PlexSeller...');
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawerNavigator from './navigation/DrawerNavigator';
// import { createDrawerNavigator } from '@react-navigation/drawer';
// import MainScreen from './components/MainScreen';

// Safely log redirect URI only after modules are ready
try {
  console.log(AuthSession.makeRedirectUri({ useProxy: true }));
} catch (error) {
  console.warn('AuthSession not ready yet:', error);
}

// const Drawer = createDrawerNavigator({
//   screens: {
//     MainHome: MainScreen,
//   }
// });

// Inner component that uses DeveloperModeContext
const AppContent = (): JSX.Element => {
  const { isDeveloperMode } = useDeveloperMode();
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
    </View>
  );
};

export default function App(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DeveloperModeProvider>
        <AuthProvider>
          <AccessProvider>
            <AppContent />
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

