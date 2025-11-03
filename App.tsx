import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from './context/AuthContext';
import { DeveloperModeProvider, useDeveloperMode } from './context/DeveloperModeContext';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import ApiService from './services/api';
import LogViewer from './components/LogViewer';
import * as AuthSession from "expo-auth-session";

console.log(AuthSession.makeRedirectUri({ useProxy: true }));

// Inner component that uses DeveloperModeContext
const AppContent = (): JSX.Element => {
  const { isDeveloperMode } = useDeveloperMode();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>

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

