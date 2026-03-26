import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WinFormsClient } from '../../../types/perangkat';

interface DeviceCardProps {
  device: WinFormsClient;
  onPress: () => void;
  onDelete: () => void;
  onToggleDlp?: (deviceId: string, enabled: boolean) => void;
  onUpdateCustomName?: (deviceId: string, name: string) => void;
  isSelected?: boolean;
  onToggleSelection?: (deviceId: string) => void;
  selectionMode?: boolean;
}

export default function DeviceCard({
  device,
  onPress,
  onDelete,
  onToggleDlp,
  onUpdateCustomName,
  isSelected = false,
  onToggleSelection,
  selectionMode = false
}: DeviceCardProps): JSX.Element {
  const isOnline = device.status === 'online';
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState(device.custom_device_name || '');

  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate time ago for last heartbeat
  const getTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const handleSaveCustomName = () => {
    if (onUpdateCustomName) {
      onUpdateCustomName(device.client_id, customName.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setCustomName(device.custom_device_name || '');
    setIsEditingName(false);
  };

  const handleDlpToggle = (value: boolean) => {
    if (onToggleDlp) {
      onToggleDlp(device.client_id, value);
    }
  };

  const handleCardPress = () => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(device.client_id);
    } else {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      {/* Selection Checkbox */}
      {selectionMode && onToggleSelection && (
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggleSelection(device.client_id)}
        >
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={24}
            color={isSelected ? "#fbbf24" : "#6b7280"}
          />
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="desktop-outline" size={24} color="#6b7280" style={styles.icon} />
          <View style={styles.nameContainer}>
            {/* Custom Device Name */}
            {isEditingName ? (
              <View style={styles.editNameContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Enter device name..."
                  autoFocus
                  onBlur={handleCancelEdit}
                />
                <TouchableOpacity onPress={handleSaveCustomName} style={styles.saveNameButton}>
                  <Ionicons name="checkmark" size={20} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelNameButton}>
                  <Ionicons name="close" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsEditingName(true)}
                style={styles.nameDisplayContainer}
              >
                <Text style={styles.customDeviceName} numberOfLines={1}>
                  {device.custom_device_name || 'Tap to set name...'}
                </Text>
                <Ionicons name="pencil" size={14} color="#6b7280" style={styles.editIcon} />
              </TouchableOpacity>
            )}
            {/* Desktop Name */}
            <Text style={styles.desktopName} numberOfLines={1}>
              {device.desktop_name || 'Unknown Device'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, isOnline ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.statusText, isOnline ? styles.textOnline : styles.textOffline]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* DLP Status and Toggle */}
      <View style={styles.dlpContainer}>
        <View style={styles.dlpInfo}>
          <Ionicons
            name="shield-checkmark"
            size={18}
            color={device.dlp_enabled ? "#10b981" : "#6b7280"}
          />
          <Text style={[styles.dlpText, device.dlp_enabled && styles.dlpTextEnabled]}>
            DLP {device.dlp_enabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
        {onToggleDlp && (
          <Switch
            value={device.dlp_enabled}
            onValueChange={handleDlpToggle}
            trackColor={{ false: '#d1d5db', true: '#86efac' }}
            thumbColor={device.dlp_enabled ? '#10b981' : '#f3f4f6'}
            disabled={!isOnline}
          />
        )}
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={16} color="#6b7280" />
        <Text style={styles.infoText}>
          Last seen: {getTimeAgo(device.last_heartbeat)}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="calendar-outline" size={16} color="#6b7280" />
        <Text style={styles.infoText}>
          Paired: {formatDate(device.paired_at)}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.configButton}
          onPress={(e) => {
            e.stopPropagation();
            onPress();
          }}
        >
          <Ionicons name="settings-outline" size={20} color="#fbbf24" />
          <Text style={styles.configText}>Configure</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  checkbox: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  icon: {
    marginRight: 8,
    marginTop: 2,
  },
  nameContainer: {
    flex: 1,
  },
  nameDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  editIcon: {
    marginLeft: 4,
  },
  desktopName: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  editNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  saveNameButton: {
    marginLeft: 6,
    padding: 4,
  },
  cancelNameButton: {
    marginLeft: 2,
    padding: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOnline: {
    backgroundColor: '#d1fae5',
  },
  statusOffline: {
    backgroundColor: '#f3f4f6',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#6b7280',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textOnline: {
    color: '#059669',
  },
  textOffline: {
    color: '#6b7280',
  },
  dlpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  dlpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dlpText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    marginLeft: 6,
  },
  dlpTextEnabled: {
    color: '#10b981',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    marginRight: 8,
  },
  configText: {
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: '600',
    marginLeft: 6,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
  },
  deleteText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
    marginLeft: 6,
  },
});

