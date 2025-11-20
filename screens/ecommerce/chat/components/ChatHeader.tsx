import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IChatHeaderProps } from '../types/chat.types';

/**
 * ChatHeader Component
 * Header for chat detail screen
 */
const ChatHeader: React.FC<IChatHeaderProps> = ({ buyer, platform, onBack }) => {
  // Get platform icon
  const getPlatformIcon = (): keyof typeof Ionicons.glyphMap => {
    const platformUpper = platform.toUpperCase();
    switch (platformUpper) {
      case 'SHOPEE':
        return 'cart-outline';
      case 'LAZADA':
        return 'bag-outline';
      case 'TOKOPEDIA':
        return 'storefront-outline';
      case 'TIKTOK':
        return 'musical-notes-outline';
      default:
        return 'chatbubble-outline';
    }
  };

  // Get platform color
  const getPlatformColor = (): string => {
    const platformUpper = platform.toUpperCase();
    switch (platformUpper) {
      case 'SHOPEE':
        return '#EE4D2D';
      case 'LAZADA':
        return '#0F156D';
      case 'TOKOPEDIA':
        return '#42B549';
      case 'TIKTOK':
        return '#000000';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {buyer.thumbnail_url ? (
          <Image
            source={{ uri: buyer.thumbnail_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={20} color="#9CA3AF" />
          </View>
        )}
      </View>

      {/* Buyer info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {buyer.name}
        </Text>
        <View style={styles.platformBadge}>
          <Ionicons
            name={getPlatformIcon()}
            size={12}
            color={getPlatformColor()}
          />
          <Text style={[styles.platformText, { color: getPlatformColor() }]}>
            {platform}
          </Text>
        </View>
      </View>

      {/* More options button (optional) */}
      <TouchableOpacity style={styles.moreButton}>
        <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  platformText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreButton: {
    padding: 8,
  },
});

export default ChatHeader;

