import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Header navigasi disembunyikan di app ini, jadi layar tanpa SafeAreaView/inset sendiri
 * akan tertimpa status bar (jam, sinyal, baterai) di iPhone. HOC ini memberi jarak atas
 * sebesar safe area tanpa mengubah isi layar. Kalau header native ditampilkan, inset atas = 0.
 */
export default function withTopSafeArea(
  Component: React.ComponentType<any>,
  backgroundColor: string = '#F9FAFB'
): React.ComponentType<any> {
  const Wrapped = (props: any) => {
    const insets = useSafeAreaInsets();
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor }}>
        <Component {...props} />
      </View>
    );
  };
  Wrapped.displayName = `withTopSafeArea(${Component.displayName || Component.name || 'Screen'})`;
  return Wrapped;
}
