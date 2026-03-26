import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { WinFormsClient, ApiResponse } from '../../types/perangkat';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';
import DeviceCard from './components/DeviceCard';
import { TouchableOpacity } from 'react-native';

type Nav = NativeStackNavigationProp<AppStackParamList, 'PerangkatList'>;

export default function PerangkatListScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const { signOut } = useAuth();
  const [devices, setDevices] = useState<WinFormsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      console.log('📱 [PERANGKAT] Fetching devices...');
      const token = await getTokenAuth();
      
      if (!token) {
        console.log('❌ [PERANGKAT] No token found');
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const url = `${API_BASE_URL}/api/winforms/clients`;
      console.log('📱 [PERANGKAT] Fetching from:', url);
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📱 [PERANGKAT] Response status:', res.status);

      if (res.status === 403) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const responseText = await res.text();
      console.log('📱 [PERANGKAT] Response (first 200 chars):', responseText.substring(0, 200));

      let data: ApiResponse<WinFormsClient[]>;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ [PERANGKAT] JSON parse error:', parseError);
        Alert.alert('Error', 'Server returned invalid response');
        return;
      }

      if (data.status && data.data) {
        console.log('✅ [PERANGKAT] Loaded', data.data.length, 'devices');
        setDevices(data.data);
      } else {
        console.warn('⚠️ [PERANGKAT] Fetch error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to load devices');
      }
    } catch (e) {
      console.error('❌ [PERANGKAT] Fetch error:', e);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDevices();
  };

  const handleDeleteDevice = (device: WinFormsClient) => {
    Alert.alert(
      'Delete Device',
      `Are you sure you want to delete ${device.desktop_name}? This will remove all configurations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => doDelete(device) 
        }
      ]
    );
  };

  const doDelete = async (device: WinFormsClient) => {
    try {
      console.log('🗑️ [PERANGKAT] Deleting device:', device.client_id);
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const url = `${API_BASE_URL}/api/winforms/client/${device.client_id}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data: ApiResponse<any> = await res.json();

      if (data.status) {
        console.log('✅ [PERANGKAT] Device deleted');
        // Remove from local state
        setDevices(prev => prev.filter(d => d.client_id !== device.client_id));
        Alert.alert('Success', 'Device deleted successfully');
      } else {
        console.warn('⚠️ [PERANGKAT] Delete error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to delete device');
      }
    } catch (e) {
      console.error('❌ [PERANGKAT] Delete error:', e);
      Alert.alert('Error', 'Failed to delete device');
    }
  };

  const handleDevicePress = (device: WinFormsClient) => {
    navigation.navigate('PerangkatConfig', {
      client_id: device.client_id,
      desktop_name: device.desktop_name
    });
  };

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev => {
      if (prev.includes(deviceId)) {
        const newSelection = prev.filter(id => id !== deviceId);
        if (newSelection.length === 0) {
          setSelectionMode(false);
        }
        return newSelection;
      } else {
        setSelectionMode(true);
        return [...prev, deviceId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedDeviceIds.length === devices.length) {
      setSelectedDeviceIds([]);
      setSelectionMode(false);
    } else {
      setSelectedDeviceIds(devices.map(d => d.client_id));
      setSelectionMode(true);
    }
  };

  const clearSelection = () => {
    setSelectedDeviceIds([]);
    setSelectionMode(false);
  };

  const handleToggleDlp = async (deviceId: string, enabled: boolean) => {
    try {
      console.log(`🛡️ [DLP] Toggling DLP for device ${deviceId}: ${enabled}`);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const url = `${API_BASE_URL}/api/winforms/config/dlp/${deviceId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dlp_enabled: enabled }),
      });

      const data: ApiResponse<any> = await res.json();

      if (data.status) {
        console.log('✅ [DLP] DLP toggled successfully');
        // Update local state
        setDevices(prev => prev.map(device =>
          device.client_id === deviceId
            ? { ...device, dlp_enabled: enabled }
            : device
        ));
        Alert.alert('Success', `DLP ${enabled ? 'enabled' : 'disabled'} successfully`);
      } else {
        console.warn('⚠️ [DLP] Toggle error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to toggle DLP');
      }
    } catch (e) {
      console.error('❌ [DLP] Toggle error:', e);
      Alert.alert('Error', 'Failed to toggle DLP');
    }
  };

  const handleUpdateCustomName = async (deviceId: string, name: string) => {
    try {
      console.log(`📝 [NAME] Updating custom name for device ${deviceId}: ${name}`);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const url = `${API_BASE_URL}/api/winforms/client/${deviceId}/custom-name`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ custom_device_name: name.trim() || null }),
      });

      const data: ApiResponse<any> = await res.json();

      if (data.status) {
        console.log('✅ [NAME] Custom name updated successfully');
        // Update local state
        setDevices(prev => prev.map(device =>
          device.client_id === deviceId
            ? { ...device, custom_device_name: name.trim() || undefined }
            : device
        ));
        Alert.alert('Success', 'Device name updated successfully');
      } else {
        console.warn('⚠️ [NAME] Update error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to update device name');
      }
    } catch (e) {
      console.error('❌ [NAME] Update error:', e);
      Alert.alert('Error', 'Failed to update device name');
    }
  };

  const handleBulkToggleDlp = async (enabled: boolean) => {
    if (selectedDeviceIds.length === 0) {
      Alert.alert('No Selection', 'Please select devices first');
      return;
    }

    try {
      console.log(`🛡️ [BULK DLP] Toggling DLP for ${selectedDeviceIds.length} devices: ${enabled}`);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const url = `${API_BASE_URL}/api/winforms/bulk/dlp`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_ids: selectedDeviceIds,
          dlp_enabled: enabled,
        }),
      });

      const data: ApiResponse<any> = await res.json();

      if (data.status) {
        console.log('✅ [BULK DLP] DLP toggled successfully');
        // Update local state
        setDevices(prev => prev.map(device =>
          selectedDeviceIds.includes(device.client_id)
            ? { ...device, dlp_enabled: enabled }
            : device
        ));
        Alert.alert('Success', `DLP ${enabled ? 'enabled' : 'disabled'} for ${selectedDeviceIds.length} device(s)`);
        clearSelection();
      } else {
        console.warn('⚠️ [BULK DLP] Toggle error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to toggle DLP');
      }
    } catch (e) {
      console.error('❌ [BULK DLP] Toggle error:', e);
      Alert.alert('Error', 'Failed to toggle DLP');
    }
  };

  const handleBulkUsbProtection = async (enabled: boolean) => {
    if (selectedDeviceIds.length === 0) {
      Alert.alert('No Selection', 'Please select devices first');
      return;
    }

    try {
      console.log(`🔒 [BULK USB] Toggling USB protection for ${selectedDeviceIds.length} devices: ${enabled}`);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const url = `${API_BASE_URL}/api/winforms/bulk/usb-protection`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_ids: selectedDeviceIds,
          is_protection_enabled: enabled,
        }),
      });

      const data: ApiResponse<any> = await res.json();

      if (data.status) {
        console.log('✅ [BULK USB] USB protection toggled successfully');
        Alert.alert('Success', `USB protection ${enabled ? 'enabled' : 'disabled'} for ${selectedDeviceIds.length} device(s)`);
        clearSelection();
      } else {
        console.warn('⚠️ [BULK USB] Toggle error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to toggle USB protection');
      }
    } catch (e) {
      console.error('❌ [BULK USB] Toggle error:', e);
      Alert.alert('Error', 'Failed to toggle USB protection');
    }
  };

  const handleBulkDelete = () => {
    if (selectedDeviceIds.length === 0) {
      Alert.alert('No Selection', 'Please select devices first');
      return;
    }

    Alert.alert(
      'Delete Devices',
      `Are you sure you want to delete ${selectedDeviceIds.length} device(s)? This will remove all configurations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => doBulkDelete()
        }
      ]
    );
  };

  const doBulkDelete = async () => {
    try {
      console.log(`🗑️ [BULK DELETE] Deleting ${selectedDeviceIds.length} devices`);
      const token = await getTokenAuth();

      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const deviceId of selectedDeviceIds) {
        try {
          const url = `${API_BASE_URL}/api/winforms/client/${deviceId}`;
          const res = await fetch(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });

          const data: ApiResponse<any> = await res.json();

          if (data.status) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      if (successCount > 0) {
        console.log(`✅ [BULK DELETE] ${successCount} devices deleted`);
        // Remove deleted devices from local state
        setDevices(prev => prev.filter(d => !selectedDeviceIds.includes(d.client_id)));
        Alert.alert('Success', `${successCount} device(s) deleted successfully`);
      }
      if (failCount > 0) {
        console.warn(`⚠️ [BULK DELETE] ${failCount} devices failed to delete`);
        Alert.alert('Warning', `${failCount} device(s) failed to delete`);
      }

      clearSelection();
    } catch (e) {
      console.error('❌ [BULK DELETE] Delete error:', e);
      Alert.alert('Error', 'Failed to delete devices');
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="desktop-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No Devices Paired</Text>
      <Text style={styles.emptyText}>
        Pair a device from the WinForms desktop application to manage it from here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perangkat WinForms</Text>
        <View style={styles.headerActions}>
          {selectionMode && (
            <TouchableOpacity onPress={toggleSelectAll} style={styles.headerButton}>
              <Ionicons
                name={selectedDeviceIds.length === devices.length ? "checkbox" : "square-outline"}
                size={24}
                color="#1f2937"
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
            <Ionicons name="refresh" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk Action Bar */}
      {selectionMode && selectedDeviceIds.length > 0 && (
        <View style={styles.bulkActionBar}>
          <View style={styles.bulkActionHeader}>
            <Text style={styles.bulkActionText}>
              {selectedDeviceIds.length} selected
            </Text>
            <TouchableOpacity onPress={clearSelection}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.bulkActionButtons}>
            <TouchableOpacity
              style={[styles.bulkButton, styles.bulkButtonSuccess]}
              onPress={() => handleBulkToggleDlp(true)}
            >
              <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
              <Text style={styles.bulkButtonText}>Enable DLP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, styles.bulkButtonWarning]}
              onPress={() => handleBulkToggleDlp(false)}
            >
              <Ionicons name="shield-outline" size={18} color="#ffffff" />
              <Text style={styles.bulkButtonText}>Disable DLP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, styles.bulkButtonPrimary]}
              onPress={() => handleBulkUsbProtection(true)}
            >
              <Ionicons name="lock-closed" size={18} color="#ffffff" />
              <Text style={styles.bulkButtonText}>Lock USB</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, styles.bulkButtonSecondary]}
              onPress={() => handleBulkUsbProtection(false)}
            >
              <Ionicons name="lock-open" size={18} color="#ffffff" />
              <Text style={styles.bulkButtonText}>Unlock USB</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, styles.bulkButtonDanger]}
              onPress={handleBulkDelete}
            >
              <Ionicons name="trash" size={18} color="#ffffff" />
              <Text style={styles.bulkButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fbbf24" />
          <Text style={styles.loadingText}>Loading devices...</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.client_id}
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              onPress={() => handleDevicePress(item)}
              onDelete={() => handleDeleteDevice(item)}
              onToggleDlp={handleToggleDlp}
              onUpdateCustomName={handleUpdateCustomName}
              isSelected={selectedDeviceIds.includes(item.client_id)}
              onToggleSelection={toggleDeviceSelection}
              selectionMode={selectionMode}
            />
          )}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#fbbf24']}
              tintColor="#fbbf24"
            />
          }
          contentContainerStyle={devices.length === 0 ? styles.emptyList : styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
  },
  bulkActionBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bulkActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bulkActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  bulkActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  bulkButtonSuccess: {
    backgroundColor: '#10b981',
  },
  bulkButtonWarning: {
    backgroundColor: '#f59e0b',
  },
  bulkButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  bulkButtonSecondary: {
    backgroundColor: '#6b7280',
  },
  bulkButtonDanger: {
    backgroundColor: '#ef4444',
  },
  bulkButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

