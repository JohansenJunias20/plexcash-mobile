import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useChatList } from './chat/hooks/useChatList';
import { useWebSocket } from './chat/hooks/useWebSocket';
import ChatListItem from './chat/components/ChatListItem';
import {
  IChatList,
  PlatformFilter,
  ReadStatusFilter,
  IWebSocketChatEvent,
  IWebSocketReplyEvent,
} from './chat/types/chat.types';

export default function EcommerceChatScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('ALL');
  const [readStatusFilter, setReadStatusFilter] = useState<ReadStatusFilter>('ALL');

  // Use custom hooks
  const { chats, loading, error, refreshing, filters, setFilters, refresh } = useChatList();

  // WebSocket for real-time updates
  const handleChatReceived = (event: IWebSocketChatEvent) => {
    console.log('💬 New chat received, refreshing list...', event);
    refresh();
  };

  const handleReplyReceived = (event: IWebSocketReplyEvent) => {
    console.log('💬 New reply received, refreshing list...', event);
    refresh();
  };

  const { connected } = useWebSocket(handleChatReceived, handleReplyReceived);

  // Refresh chat list when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 [EcommerceChatScreen] Screen focused, refreshing chat list...');
      refresh();
    }, [refresh])
  );

  // Update filters when search or filter changes
  useEffect(() => {
    setFilters({
      platform: platformFilter,
      readStatus: readStatusFilter,
      searchQuery: searchQuery,
    });
  }, [searchQuery, platformFilter, readStatusFilter, setFilters]);

  // Handle chat item press
  const handleChatPress = (chat: IChatList) => {
    // Navigate to chat detail screen
    (navigation as any).navigate('EcommerceChatDetail', {
      msgId: chat.msg_id,
      idEcommerce: chat.id_ecommerce,
      buyer: chat.buyer,
      platform: chat.platform,
    });
  };

  // Render filter buttons
  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      {/* Platform filters */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Platform:</Text>
        <View style={styles.filterButtons}>
          {(['ALL', 'SHOPEE', 'LAZADA', 'TIKTOK'] as PlatformFilter[]).map(
            (platform) => (
              <TouchableOpacity
                key={platform}
                style={[
                  styles.filterButton,
                  platformFilter === platform && styles.filterButtonActive,
                ]}
                onPress={() => setPlatformFilter(platform)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    platformFilter === platform && styles.filterButtonTextActive,
                  ]}
                >
                  {platform}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* Read status filters */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Status:</Text>
        <View style={styles.filterButtons}>
          {(['ALL', 'UNREAD', 'READ'] as ReadStatusFilter[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                readStatusFilter === status && styles.filterButtonActive,
              ]}
              onPress={() => setReadStatusFilter(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  readStatusFilter === status && styles.filterButtonTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // Render header
  const renderHeader = () => (
    <View>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by buyer name..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      {renderFilterButtons()}

      {/* WebSocket status */}
      <View style={styles.statusBar}>
        <View style={styles.statusIndicator}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: connected ? '#10B981' : '#EF4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {connected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        <Text style={styles.chatCount}>
          {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
        </Text>
      </View>
    </View>
  );

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No chats found</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery || platformFilter !== 'ALL' || readStatusFilter !== 'ALL'
            ? 'Try adjusting your filters'
            : 'Your customer chats will appear here'}
        </Text>
      </View>
    );
  };

  // Show error
  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Error Loading Chats</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Loading overlay */}
      {loading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      )}

      {/* Chat list */}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.msg_id}
        renderItem={({ item }) => (
          <ChatListItem chat={item} onPress={handleChatPress} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={['#f59e0b']}
            tintColor="#f59e0b"
          />
        }
        contentContainerStyle={chats.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterRow: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#f59e0b',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#f59e0b',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
  },
  chatCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F9FAFB',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});

