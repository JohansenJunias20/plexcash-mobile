import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import GrafikPenjualanTab from './components/GrafikPenjualanTab';
import BarangTidakLakuTab from './components/BarangTidakLakuTab';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const initialLayout = { width: Dimensions.get('window').width };

const renderScene = SceneMap({
  grafik: GrafikPenjualanTab,
  tidakLaku: BarangTidakLakuTab,
});

export default function LaporanBarangScreen() {
  const navigation = useNavigation();
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'grafik', title: 'Grafik Penjualan' },
    { key: 'tidakLaku', title: 'Barang Tidak Laku' },
  ]);

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={{ backgroundColor: '#2196f3' }}
      style={{ backgroundColor: 'white' }}
      activeColor="#2196f3"
      inactiveColor="gray"
      renderLabel={({ route, focused, color }) => (
        <Text style={{ color, fontWeight: focused ? 'bold' : 'normal', margin: 8 }}>
          {route.title}
        </Text>
      )}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan Barang</Text>
        <View style={{ width: 40 }} />
      </View>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
});
