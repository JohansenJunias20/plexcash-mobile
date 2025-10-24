import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import SimpleQRScanner from './SimpleQRScanner';
import QRCodeInput from './QRCodeInput';

interface Props { onClose: () => void }

const Settings = ({ onClose }: Props): JSX.Element => {
  const { user, signOut } = useAuth();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRInput, setShowQRInput] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(false);

  const handleQRCodeLogin = () => {
    Alert.alert('QR Code Authentication', 'Choose how you want to authenticate with QR code:', [
      { text: 'Scan with Camera', onPress: () => setShowQRScanner(true) },
      { text: 'Enter Manually', onPress: () => setShowQRInput(true) },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const handleQRScanSuccess = async (user: any, token: string) => {
    try {
      // The device authorization has already been completed by the QR scanner
      // We just need to close the scanner and settings - the AuthContext will handle the redirect
      setShowQRScanner(false);
      setShowQRInput(false);
      onClose(); // Close settings to return to main app
    } catch (error) {
      console.error('QR authentication error:', error);
      Alert.alert('Error', 'Failed to complete authentication');
    }
  };

  const handleQRScanCancel = () => setShowQRScanner(false);
  const handleQRInputCancel = () => setShowQRInput(false);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { try { await signOut(); onClose(); } catch { Alert.alert('Error', 'Failed to sign out'); } } }
    ]);
  };

  if (showQRScanner) {
    return <SimpleQRScanner onScanSuccess={handleQRScanSuccess} onCancel={handleQRScanCancel} />;
  }

  if (showQRInput) {
    return <QRCodeInput onScanSuccess={handleQRScanSuccess} onCancel={handleQRInputCancel} />;
  }

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.userInfo}>
              <Ionicons name="person-circle" size={40} color="white" />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{(user as any)?.email || 'Guest User'}</Text>
                <Text style={styles.userRole}>{(user as any)?.authMethod === 'qr-code' ? 'QR Code User' : 'Email User'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Authentication</Text>
            <TouchableOpacity style={styles.settingItem} onPress={handleQRCodeLogin}>
              <View style={styles.settingLeft}>
                <Ionicons name="qr-code" size={24} color="white" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>QR Code Scanner</Text>
                  <Text style={styles.settingSubtitle}>Authenticate using QR code</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Settings</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="notifications" size={24} color="white" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Notifications</Text>
                  <Text style={styles.settingSubtitle}>Enable push notifications</Text>
                </View>
              </View>
              <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#10B981' }} thumbColor={notifications ? '#ffffff' : '#f4f3f4'} />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="sync" size={24} color="white" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Auto Sync</Text>
                  <Text style={styles.settingSubtitle}>Automatically sync data</Text>
                </View>
              </View>
              <Switch value={autoSync} onValueChange={setAutoSync} trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#10B981' }} thumbColor={autoSync ? '#ffffff' : '#f4f3f4'} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="information-circle" size={24} color="white" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>App Version</Text>
                  <Text style={styles.settingSubtitle}>1.0.0</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="help-circle" size={24} color="white" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Help & Support</Text>
                  <Text style={styles.settingSubtitle}>Get help and contact support</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out" size={24} color="#EF4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { padding: 10 },
  headerText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 44 },
  scrollContainer: { flex: 1 },
  content: { padding: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  userInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 12 },
  userDetails: { marginLeft: 15 },
  userName: { color: 'white', fontSize: 16, fontWeight: '600' },
  userRole: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 12, marginBottom: 10 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingText: { marginLeft: 15, flex: 1 },
  settingTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  settingSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444' },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '600', marginLeft: 10 },
});

export default Settings;

