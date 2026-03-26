import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { UrlFilterConfig as UrlFilterConfigType, UsbProtectionConfig as UsbProtectionConfigType, ApiResponse } from '../../types/perangkat';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';
import UrlFilterConfig from './components/UrlFilterConfig';
import UsbProtectionConfig from './components/UsbProtectionConfig';

type Nav = NativeStackNavigationProp<AppStackParamList, 'PerangkatConfig'>;
type Route = RouteProp<AppStackParamList, 'PerangkatConfig'>;

export default function PerangkatConfigScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { signOut } = useAuth();
  const { client_id, desktop_name } = route.params;

  const [activeTab, setActiveTab] = useState(0); // 0: URL Filter, 1: USB Protection
  const [urlFilterConfig, setUrlFilterConfig] = useState<UrlFilterConfigType | null>(null);
  const [usbProtectionConfig, setUsbProtectionConfig] = useState<UsbProtectionConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      console.log('⚙️ [CONFIG] Loading configs for client:', client_id);
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      // Load both configs in parallel
      const [urlRes, usbRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/winforms/config/url-filter/${client_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/winforms/config/usb-protection/${client_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const urlData: ApiResponse<UrlFilterConfigType> = await urlRes.json();
      const usbData: ApiResponse<UsbProtectionConfigType> = await usbRes.json();

      if (urlData.status && urlData.data) {
        console.log('✅ [CONFIG] URL filter config loaded');
        setUrlFilterConfig(urlData.data);
      } else {
        console.warn('⚠️ [CONFIG] URL filter error:', urlData.reason);
        // Set default config
        setUrlFilterConfig({
          filter_mode: 'BLACKLIST',
          url_list: [],
          is_enabled: false,
          last_updated: Date.now(),
        });
      }

      if (usbData.status && usbData.data) {
        console.log('✅ [CONFIG] USB protection config loaded');
        setUsbProtectionConfig(usbData.data);
      } else {
        console.warn('⚠️ [CONFIG] USB protection error:', usbData.reason);
        // Set default config
        setUsbProtectionConfig({
          is_protection_enabled: false,
          last_updated: Date.now(),
        });
      }
    } catch (e) {
      console.error('❌ [CONFIG] Load error:', e);
      Alert.alert('Error', 'Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const saveUrlFilterConfig = async () => {
    if (!urlFilterConfig) return;

    try {
      setSaving(true);
      console.log('💾 [CONFIG] Saving URL filter config');
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/winforms/config/url-filter/${client_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter_mode: urlFilterConfig.filter_mode,
          url_list: urlFilterConfig.url_list,
          is_enabled: urlFilterConfig.is_enabled,
        }),
      });

      const data: ApiResponse<any> = await res.json();

      if (data.status) {
        console.log('✅ [CONFIG] URL filter saved');
        Alert.alert('Success', 'URL filter configuration saved');
      } else {
        console.warn('⚠️ [CONFIG] Save error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to save configuration');
      }
    } catch (e) {
      console.error('❌ [CONFIG] Save error:', e);
      Alert.alert('Error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveUsbProtectionConfig = async () => {
    if (!usbProtectionConfig) return;

    try {
      setSaving(true);
      console.log('💾 [CONFIG] Saving USB protection config');
      const token = await getTokenAuth();
      
      if (!token) {
        Alert.alert('Session expired', 'Please login');
        signOut && (await signOut());
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/winforms/config/usb-protection/${client_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_protection_enabled: usbProtectionConfig.is_protection_enabled,
        }),
      });

      const data: ApiResponse<any> = await res.json();

      if (data.status) {
        console.log('✅ [CONFIG] USB protection saved');
        Alert.alert('Success', 'USB protection configuration saved');
      } else {
        console.warn('⚠️ [CONFIG] Save error:', data.reason);
        Alert.alert('Error', data.reason || 'Failed to save configuration');
      }
    } catch (e) {
      console.error('❌ [CONFIG] Save error:', e);
      Alert.alert('Error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (activeTab === 0) {
      saveUrlFilterConfig();
    } else {
      saveUsbProtectionConfig();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title} numberOfLines={1}>
            {desktop_name}
          </Text>
          <Text style={styles.subtitle}>Device Configuration</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 0 && styles.activeTab]}
          onPress={() => setActiveTab(0)}
        >
          <Ionicons
            name="filter"
            size={20}
            color={activeTab === 0 ? '#fbbf24' : '#6b7280'}
          />
          <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
            URL Filter
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 1 && styles.activeTab]}
          onPress={() => setActiveTab(1)}
        >
          <Ionicons
            name="lock-closed"
            size={20}
            color={activeTab === 1 ? '#fbbf24' : '#6b7280'}
          />
          <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
            USB Protection
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fbbf24" />
          <Text style={styles.loadingText}>Loading configuration...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {activeTab === 0 ? (
            <UrlFilterConfig
              config={urlFilterConfig}
              onChange={setUrlFilterConfig}
            />
          ) : (
            <UsbProtectionConfig
              config={usbProtectionConfig}
              onChange={setUsbProtectionConfig}
            />
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#ffffff" />
              <Text style={styles.saveText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#fbbf24',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#fbbf24',
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
  content: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf24',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
  },
});
