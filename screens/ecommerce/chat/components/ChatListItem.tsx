import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IChatListItemProps } from '../types/chat.types';

/**
 * ChatListItem Component
 * Displays individual chat item in the list
 */
const ChatListItem: React.FC<IChatListItemProps> = ({ chat, onPress, isSelected }) => {
  // Format timestamp to readable time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      // Show time if today
      return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 48) {
      // Show "Yesterday" if yesterday
      return 'Kemarin';
    } else {
      // Show date if older
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      });
    }
  };

  // Get platform icon
  const getPlatformIcon = (): keyof typeof Ionicons.glyphMap => {
    const platform = chat.platform.toUpperCase();
    switch (platform) {
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
    const platform = chat.platform.toUpperCase();
    switch (platform) {
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

  // Render message preview with icon for non-text messages
  const renderMessagePreview = () => {
    const messageText = chat.chat?.trim() || '';
    const messageType = chat.last_message_type?.toLowerCase();

    // If we have explicit message type from server (future-proof)
    if (messageType) {
      switch (messageType) {
        case 'image':
        case 'image_with_text':
          return (
            <View style={styles.messageWithIcon}>
              <Ionicons name="image-outline" size={16} color="#9CA3AF" />
              <Text style={[styles.message, !chat.isRead && styles.messageUnread]}>
                Foto
              </Text>
            </View>
          );
        case 'product':
          return (
            <View style={styles.messageWithIcon}>
              <Ionicons name="cube-outline" size={16} color="#9CA3AF" />
              <Text style={[styles.message, !chat.isRead && styles.messageUnread]}>
                Produk
              </Text>
            </View>
          );
        case 'sticker':
          return (
            <View style={styles.messageWithIcon}>
              <Ionicons name="happy-outline" size={16} color="#9CA3AF" />
              <Text style={[styles.message, !chat.isRead && styles.messageUnread]}>
                Stiker
              </Text>
            </View>
          );
      }
    }

    // Fallback: If message is empty (no server type info available)
    // Show generic "Lampiran" (Attachment) label
    if (!messageText) {
      return (
        <View style={styles.messageWithIcon}>
          <Ionicons name="attach-outline" size={16} color="#9CA3AF" />
          <Text style={[styles.message, !chat.isRead && styles.messageUnread]}>
            Lampiran
          </Text>
        </View>
      );
    }

    // Regular text message
    return (
      <Text
        style={[styles.message, !chat.isRead && styles.messageUnread]}
        numberOfLines={1}
      >
        {messageText}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.containerSelected]}
      onPress={() => onPress(chat)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {chat.buyer.thumbnail_url ? (
          <Image
            source={{ uri: chat.buyer.thumbnail_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#9CA3AF" />
          </View>
        )}
        {/* Unread badge on avatar */}
        {chat.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {chat.unread_count > 99 ? '99+' : chat.unread_count}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: Name and Time */}
        <View style={styles.topRow}>
          <Text
            style={[styles.name, !chat.isRead && styles.nameUnread]}
            numberOfLines={1}
          >
            {chat.buyer.name}
          </Text>
          <Text style={styles.time}>{formatTime(chat.timestamp)}</Text>
        </View>

        {/* Bottom row: Last message and Platform badge */}
        <View style={styles.bottomRow}>{renderMessagePreview()}</View>

        {/* Platform badge */}
        <View style={styles.platformBadgeContainer}>
          <View
            style={[
              styles.platformBadge,
              { backgroundColor: getPlatformColor() + '20' },
            ]}
          >
            <Ionicons
              name={getPlatformIcon()}
              size={12}
              color={getPlatformColor()}
            />
            <Text style={[styles.platformText, { color: getPlatformColor() }]}>
              {chat.platform}
            </Text>
          </View>
        </View>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  containerSelected: {
    backgroundColor: '#FEF3C7',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: '700',
    color: '#111827',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  bottomRow: {
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
  },
  messageUnread: {
    fontWeight: '600',
    color: '#374151',
  },
  messageWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformBadgeContainer: {
    flexDirection: 'row',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  platformText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ChatListItem;

