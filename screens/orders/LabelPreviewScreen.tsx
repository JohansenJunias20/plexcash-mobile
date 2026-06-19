import React, { useLayoutEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import { Ionicons } from '@expo/vector-icons';
import RNPrint from 'react-native-print';

export default function LabelPreviewScreen({ route, navigation }: NativeStackScreenProps<AppStackParamList, 'LabelPreview'>) {
  const { html, pdfUrl, title } = route.params as any;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title || 'Label Preview',
      headerRight: () => (
        <TouchableOpacity
          onPress={handlePrint}
          style={{ marginRight: 10, padding: 4 }}
        >
          <Ionicons name="print-outline" size={24} color="#f59e0b" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, html, pdfUrl, title]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handlePrint();
    }, 600); // 600ms delay to let the screen mount and WebView start rendering
    return () => clearTimeout(timer);
  }, [html, pdfUrl]);

  const handlePrint = async () => {
    try {
      if (pdfUrl) {
        await RNPrint.print({ filePath: pdfUrl });
      } else if (html) {
        await RNPrint.print({ html });
      } else {
        Alert.alert('Error', 'Tidak ada data resi untuk dicetak');
      }
    } catch (error: any) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Gagal mencetak resi: ' + (error?.message || 'Unknown error'));
    }
  };

  const source = pdfUrl 
    ? { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl)}` }
    : { html: html || '' };

  return (
    <View style={styles.container}>
      <WebView originWhitelist={["*"]} source={source} startInLoadingState />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

