import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Settings from './Settings';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { useDeveloperMode } from '../context/DeveloperModeContext';

const MainScreen = (): JSX.Element => {
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [currentDatabase, setCurrentDatabase] = useState<string>('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingDatabase, setLoadingDatabase] = useState(true);
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [switchingDatabase, setSwitchingDatabase] = useState(false);
  const navigation = useNavigation<any>();
  const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();

  const isAdmin = (user as any)?.email === 'johansen.junias17@gmail.com';

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  // Fetch database information on mount
  useEffect(() => {
    const fetchDatabaseInfo = async () => {
      try {
        setLoadingDatabase(true);

        // Fetch current database name
        const dbResponse = await ApiService.getCurrentDatabase();
        if (dbResponse.status && dbResponse.data) {
          setCurrentDatabase(dbResponse.data);
        }

        // If admin, also fetch database list
        if (isAdmin) {
          const listResponse = await ApiService.getDatabaseList();
          if (listResponse.status && listResponse.data) {
            setDatabases(listResponse.data);
          }
        }
      } catch (error) {
        console.error('Error fetching database info:', error);
      } finally {
        setLoadingDatabase(false);
      }
    };

    fetchDatabaseInfo();
  }, [isAdmin]);

  const handleDatabaseSwitch = async (newDatabase: string) => {
    if (newDatabase === currentDatabase) {
      setShowDatabasePicker(false);
      return;
    }

    try {
      setSwitchingDatabase(true);
      const response = await ApiService.setDatabase(newDatabase);

      if (response.status) {
        setCurrentDatabase(newDatabase);
        setShowDatabasePicker(false);
        Alert.alert(
          'Database Switched',
          `Successfully switched to database: ${newDatabase}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          response.reason || 'Failed to switch database',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error switching database:', error);
      Alert.alert(
        'Error',
        'An error occurred while switching database',
        [{ text: 'OK' }]
      );
    } finally {
      setSwitchingDatabase(false);
    }
  };

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
              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('POSKasir')}>
                <Ionicons name="cash-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>POS Kasir</Text>
                <Text style={styles.actionSubtitle}>Point of Sale</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('BarangList')}>
                <Ionicons name="cube-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Barang</Text>
                <Text style={styles.actionSubtitle}>Kelola Items</Text>
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

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('UserList')}>
                <Ionicons name="people-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>User</Text>
                <Text style={styles.actionSubtitle}>Manage Users</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('BundlingList')}>
                <Ionicons name="albums-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Bundling</Text>
                <Text style={styles.actionSubtitle}>Paket Produk</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('StokOpname')}>
                <Ionicons name="clipboard-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Stok Opname</Text>
                <Text style={styles.actionSubtitle}>Stock Taking</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Settingscreen')}>
                <Ionicons name="cog-outline" size={32} color="white" />
                <Text style={styles.actionTitle}>Setting</Text>
                <Text style={styles.actionSubtitle}>App Configuration</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>

            {/* Database Indicator */}
            <TouchableOpacity
              style={styles.statusCard}
              onPress={() => isAdmin && setShowDatabasePicker(true)}
              disabled={!isAdmin || loadingDatabase}
            >
              <View style={styles.statusLeft}>
                <Ionicons name="server-outline" size={24} color="#F59E0B" />
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>Database</Text>
                  <Text style={styles.statusSubtitle}>
                    {loadingDatabase ? 'Loading...' : currentDatabase || 'Unknown'}
                  </Text>
                </View>
              </View>
              {isAdmin && !loadingDatabase && (
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              )}
            </TouchableOpacity>

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

      {/* Database Picker Modal (Admin Only) */}
      {isAdmin && (
        <Modal
          visible={showDatabasePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatabasePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Switch Database</Text>
                <TouchableOpacity onPress={() => setShowDatabasePicker(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              {switchingDatabase ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#f59e0b" />
                  <Text style={styles.loadingText}>Switching database...</Text>
                </View>
              ) : (
                <ScrollView style={styles.databaseList}>
                  {databases.map((db) => (
                    <TouchableOpacity
                      key={db}
                      style={[
                        styles.databaseItem,
                        db === currentDatabase && styles.databaseItemActive
                      ]}
                      onPress={() => handleDatabaseSwitch(db)}
                    >
                      <View style={styles.databaseItemLeft}>
                        <Ionicons
                          name="server"
                          size={20}
                          color={db === currentDatabase ? '#f59e0b' : '#6B7280'}
                        />
                        <Text style={[
                          styles.databaseItemText,
                          db === currentDatabase && styles.databaseItemTextActive
                        ]}>
                          {db}
                        </Text>
                      </View>
                      {db === currentDatabase && (
                        <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Developer Mode Toggle Button - Long press (1s) or double-tap to toggle */}
      <TouchableOpacity
        style={[
          styles.devModeButton,
          !isDeveloperMode && styles.devModeButtonHidden
        ]}
        onPress={async () => {
          // Double-tap to disable when in dev mode
          if (isDeveloperMode) {
            await toggleDeveloperMode();
            Alert.alert(
              'Developer Mode',
              'Developer mode has been disabled',
              [{ text: 'OK' }]
            );
          }
        }}
        onLongPress={async () => {
          await toggleDeveloperMode();
          Alert.alert(
            'Developer Mode',
            isDeveloperMode ? 'Developer mode has been disabled' : 'Developer mode has been enabled',
            [{ text: 'OK' }]
          );
        }}
        delayLongPress={1000}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isDeveloperMode ? 'bug' : 'bug-outline'}
          size={isDeveloperMode ? 24 : 16}
          color="white"
        />
        {isDeveloperMode && <View style={styles.devModeIndicator} />}
      </TouchableOpacity>
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
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, color: '#6B7280' },
  databaseList: { maxHeight: 400 },
  databaseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  databaseItemActive: { backgroundColor: '#FEF3C7' },
  databaseItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  databaseItemText: { marginLeft: 12, fontSize: 16, color: '#374151' },
  databaseItemTextActive: { color: '#f59e0b', fontWeight: '600' },
  devModeButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  devModeButtonHidden: {
    opacity: 0.1,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    shadowOpacity: 0,
    elevation: 0,
  },
  devModeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: 'white',
  },
});

export default MainScreen;

