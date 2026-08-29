import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IChatListItemProps, isChatReplied } from '../types/chat.types';

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
    let messageText = '';
    if (typeof chat.chat === 'string') {
      messageText = chat.chat.trim();
    } else if (chat.chat && typeof chat.chat === 'object') {
      const chatObj: any = chat.chat;
      messageText = (typeof chatObj.text === 'string' ? chatObj.text.trim() : '') ||
        (typeof chatObj.content === 'string' ? chatObj.content.trim() : '') ||
        (typeof chatObj.msg === 'string' ? chatObj.msg.trim() : '');
    }

    const messageType = (
      chat.last_message_type ||
      (chat.chat && typeof chat.chat === 'object' ? (chat.chat as any).type : '')
    )?.toLowerCase();

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

  const replied = isChatReplied(chat);

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

        {/* Bottom row: Last message */}
        <View style={styles.bottomRow}>{renderMessagePreview()}</View>

        {/* Footer Badges: Platform/Shop badge & Reply status badge */}
        <View style={styles.footerBadgesContainer}>
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
            <Text
              style={[styles.platformText, { color: getPlatformColor() }]}
              numberOfLines={1}
            >
              {chat.shop_name || chat.toko_name || chat.name_ecommerce || chat.name || chat.platform}
            </Text>
          </View>

          {/* Reply Status Badge */}
          <View
            style={[
              styles.replyBadge,
              replied ? styles.replyBadgeReplied : styles.replyBadgeUnreplied,
            ]}
          >
            <View
              style={[
                styles.replyDot,
                replied ? styles.replyDotReplied : styles.replyDotUnreplied,
              ]}
            />
            <Text
              style={[
                styles.replyText,
                replied ? styles.replyTextReplied : styles.replyTextUnreplied,
              ]}
              numberOfLines={1}
            >
              {replied ? 'Sudah Dibalas' : 'Belum Dibalas'}
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
  footerBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    gap: 4,
    maxWidth: '55%',
  },
  platformText: {
    fontSize: 11,
    fontWeight: '600',
  },
  replyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  replyBadgeReplied: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  replyBadgeUnreplied: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
  },
  replyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  replyDotReplied: {
    backgroundColor: '#22c55e',
  },
  replyDotUnreplied: {
    backgroundColor: '#ea580c',
  },
  replyText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  replyTextReplied: {
    color: '#15803d',
  },
  replyTextUnreplied: {
    color: '#c2410c',
  },
});

export default ChatListItem;

