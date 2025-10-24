import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Settings from './Settings';
import { useNavigation } from '@react-navigation/native';

const MainScreen = (): JSX.Element => {
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const navigation = useNavigation<any>();

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  if (showSettings) {
    return <Settings onClose={handleCloseSettings} />;
  }

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.welcomeText}>Welcome!</Text>
          <Text style={styles.userEmail}>{(user as any)?.email || 'Guest'}</Text>
        </View>
        <TouchableOpacity style={styles.settingsIcon} onPress={handleOpenSettings}>
          <Ionicons name="settings" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.dashboard}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionCard} onPress={handleOpenSettings}>
                <Ionicons name="qr-code-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>QR Scanner</Text>
                <Text style={styles.actionSubtitle}>Scan QR codes</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('BarangList')}>
                <Ionicons name="cube-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Barang</Text>
                <Text style={styles.actionSubtitle}>Kelola Items</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SupplierList')}>
                <Ionicons name="people-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Supplier</Text>
                <Text style={styles.actionSubtitle}>Kelola Supplier</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerList')}>
                <Ionicons name="person-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Customer</Text>
                <Text style={styles.actionSubtitle}>Kelola Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('OrdersList')}>
                <Ionicons name="cart-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Pesanan</Text>
                <Text style={styles.actionSubtitle}>Ecommerce Orders</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ScanOut')}>
                <Ionicons name="scan-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Scan Out</Text>
                <Text style={styles.actionSubtitle}>Scan Shipping Labels</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusLeft}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>Authentication</Text>
                  <Text style={styles.statusSubtitle}>
                    {(user as any)?.authMethod === 'qr-code' ? 'QR Code Login' : 'Email Login'}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusValue}>Active</Text>
            </View>

            <View style={styles.statusCard}>
              <View style={styles.statusLeft}>
                <Ionicons name="cloud-outline" size={24} color="#6366F1" />
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>Sync Status</Text>
                  <Text style={styles.statusSubtitle}>Last synced 5 min ago</Text>
                </View>
              </View>
              <Text style={styles.statusValue}>Online</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Information</Text>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color="white" />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>QR Code Authentication</Text>
                <Text style={styles.infoDescription}>
                  Use the QR Scanner in Settings to authenticate with web applications quickly and securely.
                </Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  headerLeft: { flex: 1 },
  welcomeText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  userEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  settingsIcon: { padding: 10 },
  content: { flex: 1 },
  dashboard: { padding: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.15)', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 15 },
  actionTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginTop: 10 },
  actionSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 5 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 12, marginBottom: 10 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusText: { marginLeft: 15 },
  statusTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  statusSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  statusValue: { color: '#10B981', fontSize: 14, fontWeight: '600' },
  infoCard: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 12 },
  infoText: { marginLeft: 15, flex: 1 },
  infoTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 5 },
  infoDescription: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20 },
});

export default MainScreen;

