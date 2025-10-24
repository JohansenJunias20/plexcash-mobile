import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from './context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import ApiService from './services/api';
import * as AuthSession from "expo-auth-session";

console.log(AuthSession.makeRedirectUri({ useProxy: true }));
export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </View>
    </AuthProvider>
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

