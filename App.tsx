import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from './context/AuthContext';
import { DeveloperModeProvider, useDeveloperMode } from './context/DeveloperModeContext';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import ApiService from './services/api';
import LogViewer from './components/LogViewer';
import UpdateModal from './components/UpdateModal';
import UpdateSuccessModal from './components/UpdateSuccessModal';
import { useAppUpdate } from './hooks/useAppUpdate';
import * as AuthSession from "expo-auth-session";

// Safely log redirect URI only after modules are ready
try {
  console.log(AuthSession.makeRedirectUri({ useProxy: true }));
} catch (error) {
  console.warn('AuthSession not ready yet:', error);
}

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
        <RootNavigator />
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
    <DeveloperModeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </DeveloperModeProvider>
  );
}

// Register global 401/403 handler to auto-redirect to login
ApiService.setAuthErrorHandler(() => {
  const { useAuth } = require('./context/AuthContext');
  try { const { signOut } = useAuth(); signOut(); } catch {}
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

