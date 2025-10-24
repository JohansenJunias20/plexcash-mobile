import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/RootNavigator';

export default function LabelPreviewScreen({ route }: NativeStackScreenProps<AppStackParamList, 'LabelPreview'>) {
  const { html, title } = route.params as any;
  return (
    <View style={styles.container}>
      <WebView originWhitelist={["*"]} source={{ html }} startInLoadingState />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

