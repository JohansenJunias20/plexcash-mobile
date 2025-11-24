import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Settings from './Settings';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import ApiService from '../services/api';
import { useDeveloperMode } from '../context/DeveloperModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVAILABLE_MENUS, DEFAULT_QUICK_ACTIONS, MAX_QUICK_ACTIONS, MenuItem } from '../constants/availableMenus';

const STORAGE_KEY = '@quick_actions_config';

const MainScreen = (): React.JSX.Element => {
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [currentDatabase, setCurrentDatabase] = useState<string>('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingDatabase, setLoadingDatabase] = useState(true);
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [switchingDatabase, setSwitchingDatabase] = useState(false);
  const navigation = useNavigation<any>();
  const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();

  // Quick Actions customization states
  const [quickActions, setQuickActions] = useState<MenuItem[]>([]);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [availableMenus, setAvailableMenus] = useState<MenuItem[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());

  const isAdmin = (user as any)?.email === 'johansen.junias17@gmail.com';

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  // Load Quick Actions configuration from AsyncStorage
  useEffect(() => {
    const loadQuickActions = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const savedIds: string[] = JSON.parse(saved);
          const loadedActions = savedIds
            .map(id => AVAILABLE_MENUS.find(menu => menu.id === id))
            .filter((menu): menu is MenuItem => menu !== undefined);
          setQuickActions(loadedActions);
          setSelectedMenuIds(new Set(savedIds));
        } else {
          // Load default Quick Actions
          const defaultActions = DEFAULT_QUICK_ACTIONS
            .map(id => AVAILABLE_MENUS.find(menu => menu.id === id))
            .filter((menu): menu is MenuItem => menu !== undefined);
          setQuickActions(defaultActions);
          setSelectedMenuIds(new Set(DEFAULT_QUICK_ACTIONS));
        }
        setAvailableMenus(AVAILABLE_MENUS);
      } catch (error) {
        console.error('Error loading quick actions:', error);
        // Fallback to defaults
        const defaultActions = DEFAULT_QUICK_ACTIONS
          .map(id => AVAILABLE_MENUS.find(menu => menu.id === id))
          .filter((menu): menu is MenuItem => menu !== undefined);
        setQuickActions(defaultActions);
        setSelectedMenuIds(new Set(DEFAULT_QUICK_ACTIONS));
        setAvailableMenus(AVAILABLE_MENUS);
      }
    };

    loadQuickActions();
  }, []);

  // Save Quick Actions configuration to AsyncStorage
  const saveQuickActions = async (actions: MenuItem[]) => {
    try {
      const ids = actions.map(action => action.id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      setQuickActions(actions);
      setSelectedMenuIds(new Set(ids));
    } catch (error) {
      console.error('Error saving quick actions:', error);
      Alert.alert('Error', 'Failed to save Quick Actions configuration');
    }
  };

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

  // Quick Actions handlers
  const handleToggleMenu = (menuId: string) => {
    const isSelected = selectedMenuIds.has(menuId);

    if (isSelected) {
      // Remove from selection
      if (selectedMenuIds.size > 1) {
        const newSelected = new Set(selectedMenuIds);
        newSelected.delete(menuId);
        setSelectedMenuIds(newSelected);

        // Also remove from quickActions array
        const newActions = quickActions.filter(item => item.id !== menuId);
        setQuickActions(newActions);
      } else {
        Alert.alert('Warning', 'You must have at least 1 Quick Action');
      }
    } else {
      // Add to selection
      if (selectedMenuIds.size >= MAX_QUICK_ACTIONS) {
        Alert.alert('Limit Reached', `You can only have up to ${MAX_QUICK_ACTIONS} Quick Actions`);
        return;
      }

      const newSelected = new Set(selectedMenuIds);
      newSelected.add(menuId);
      setSelectedMenuIds(newSelected);

      // Also add to quickActions array
      const menuToAdd = AVAILABLE_MENUS.find(menu => menu.id === menuId);
      if (menuToAdd) {
        setQuickActions([...quickActions, menuToAdd]);
      }
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newActions = [...quickActions];
      [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
      setQuickActions(newActions);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < quickActions.length - 1) {
      const newActions = [...quickActions];
      [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
      setQuickActions(newActions);
    }
  };

  const handleSaveCustomization = () => {
    saveQuickActions(quickActions);
    setShowCustomizeModal(false);
    Alert.alert('Success', 'Quick Actions updated successfully');
  };

  const handleResetToDefault = () => {
    Alert.alert(
      'Reset to Default',
      'Are you sure you want to reset Quick Actions to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const defaultActions = DEFAULT_QUICK_ACTIONS
              .map(id => AVAILABLE_MENUS.find(menu => menu.id === id))
              .filter((menu): menu is MenuItem => menu !== undefined);
            saveQuickActions(defaultActions);
            setShowCustomizeModal(false);
          },
        },
      ]
    );
  };

  if (showSettings) {
    return <Settings onClose={handleCloseSettings} />;
  }

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.hamburgerButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={28} color="white" />
          </TouchableOpacity>
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeText}>Welcome!</Text>
            <Text style={styles.userEmail}>{(user as any)?.email || 'Guest'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsIcon} onPress={handleOpenSettings}>
          <Ionicons name="settings" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.dashboard}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <TouchableOpacity
                style={styles.customizeButton}
                onPress={() => setShowCustomizeModal(true)}
              >
                <Ionicons name="settings-outline" size={20} color="white" />
                <Text style={styles.customizeButtonText}>Customize</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionGrid}>
              {quickActions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.actionCard}
                  onPress={() => navigation.navigate(item.route as any)}
                >
                  <Ionicons name={item.icon} size={32} color="white" />
                  <Text style={styles.actionTitle}>{item.label}</Text>
                  <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
                </TouchableOpacity>
              ))}
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

      {/* Customize Quick Actions Modal */}
      <Modal
        visible={showCustomizeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomizeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customizeModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize Quick Actions</Text>
              <TouchableOpacity onPress={() => setShowCustomizeModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuList}>
              {/* Current Quick Actions with Reorder */}
              <View style={styles.menuCategory}>
                <Text style={styles.menuCategoryTitle}>
                  CURRENT QUICK ACTIONS ({quickActions.length}/{MAX_QUICK_ACTIONS})
                </Text>
                <Text style={styles.menuListHint}>
                  Use ↑↓ buttons to reorder
                </Text>
                {quickActions.map((item, index) => (
                  <View key={item.id} style={[styles.menuItem, styles.menuItemSelected]}>
                    <View style={styles.menuItemLeft}>
                      <Ionicons name={item.icon} size={24} color="#f59e0b" />
                      <View style={styles.menuItemText}>
                        <Text style={[styles.menuItemLabel, styles.menuItemLabelSelected]}>
                          {item.label}
                        </Text>
                        <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                      </View>
                    </View>
                    <View style={styles.reorderButtons}>
                      <TouchableOpacity
                        onPress={() => handleMoveUp(index)}
                        disabled={index === 0}
                        style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={20}
                          color={index === 0 ? '#D1D5DB' : '#f59e0b'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMoveDown(index)}
                        disabled={index === quickActions.length - 1}
                        style={[styles.reorderButton, index === quickActions.length - 1 && styles.reorderButtonDisabled]}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={20}
                          color={index === quickActions.length - 1 ? '#D1D5DB' : '#f59e0b'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleToggleMenu(item.id)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Available Menus */}
              <View style={styles.menuCategory}>
                <Text style={styles.menuCategoryTitle}>AVAILABLE MENUS</Text>
                <Text style={styles.menuListHint}>
                  Tap to add to Quick Actions
                </Text>
              </View>

              {/* Group menus by category */}
              {['POS', 'MASTER', 'TRANSAKSI', 'ECOMMERCE', 'LAPORAN', 'SETTING'].map(category => {
                const categoryMenus = availableMenus.filter(
                  menu => menu.category === category && !selectedMenuIds.has(menu.id)
                );
                if (categoryMenus.length === 0) return null;

                return (
                  <View key={category} style={styles.menuCategory}>
                    <Text style={styles.menuCategorySubtitle}>{category}</Text>
                    {categoryMenus.map(menu => (
                      <TouchableOpacity
                        key={menu.id}
                        style={styles.menuItem}
                        onPress={() => handleToggleMenu(menu.id)}
                      >
                        <View style={styles.menuItemLeft}>
                          <Ionicons name={menu.icon} size={24} color="#6B7280" />
                          <View style={styles.menuItemText}>
                            <Text style={styles.menuItemLabel}>{menu.label}</Text>
                            <Text style={styles.menuItemSubtitle}>{menu.subtitle}</Text>
                          </View>
                        </View>
                        <Ionicons name="add-circle-outline" size={24} color="#6B7280" />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.customizeModalFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetToDefault}
              >
                <Ionicons name="refresh-outline" size={20} color="#dc2626" />
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveCustomization}
              >
                <Ionicons name="checkmark-outline" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  welcomeTextContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  welcomeText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  hamburgerButton: {
    padding: 5,
  },
  userEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  settingsIcon: { padding: 10 },
  content: { flex: 1 },
  dashboard: { padding: 20 },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  customizeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6 },
  customizeButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
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
  // Customize Modal Styles
  customizeModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    marginTop: 'auto',
  },
  menuList: {
    maxHeight: 500,
    paddingHorizontal: 20,
  },
  menuListHint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuCategory: {
    marginBottom: 20,
  },
  menuCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCategorySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  menuItemSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#f59e0b',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  menuItemLabelSelected: {
    color: '#92400E',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  reorderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
  },
  reorderButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  removeButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    marginLeft: 4,
  },
  customizeModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  resetButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    flex: 2,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MainScreen;

