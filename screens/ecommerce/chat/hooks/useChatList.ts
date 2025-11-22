import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../../../services/api';
import ApiService from '../../../../services/api';
import {
  IChatList,
  IChatFilters,
  IGetChatListResponse,
  IUseChatListReturn,
  PlatformFilter,
  ReadStatusFilter,
} from '../types/chat.types';

/**
 * Custom hook for managing chat list
 * Fetches chat list from API and provides filtering capabilities
 */
export const useChatList = (): IUseChatListReturn => {
  const [chats, setChats] = useState<IChatList[]>([]);
  const [filteredChats, setFilteredChats] = useState<IChatList[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<IChatFilters>({
    platform: 'ALL',
    readStatus: 'ALL',
    searchQuery: '',
  });

  /**
   * Fetch chat list from API
   */
  const fetchChatList = useCallback(async (isRefreshing: boolean = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      console.log('📱 [useChatList] Fetching chat list...');

      const data: IGetChatListResponse = await ApiService.authenticatedRequest('/get/ecommerce/chats', {
        method: 'GET',
      });

      console.log('📱 [useChatList] Data received:', {
        status: data.status,
        count: data.data?.length || 0,
      });

      if (data.status && data.data) {
        // Sort by timestamp (newest first)
        const sortedChats = data.data.sort((a, b) => b.timestamp - a.timestamp);
        setChats(sortedChats);
        console.log('✅ [useChatList] Chat list loaded:', sortedChats.length, 'chats');
      } else {
        throw new Error(data.reason || 'Failed to fetch chat list');
      }
    } catch (err: any) {
      console.error('❌ [useChatList] Error fetching chat list:', err);
      setError(err.message || 'Failed to load chats');
      setChats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Apply filters to chat list
   * NOTE: This is NOT wrapped in useCallback to prevent unnecessary re-renders
   * It will be called directly in useEffect with proper dependencies
   */
  const applyFilters = () => {
    let filtered = [...chats];

    // Filter by platform
    if (filters.platform !== 'ALL') {
      filtered = filtered.filter(
        (chat) => chat.platform?.toUpperCase() === filters.platform
      );
    }

    // Filter by read status
    if (filters.readStatus === 'READ') {
      filtered = filtered.filter((chat) => chat.isRead);
    } else if (filters.readStatus === 'UNREAD') {
      filtered = filtered.filter((chat) => !chat.isRead);
    }

    // Filter by search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter((chat) => {
        // Safely check buyer name
        const buyerName = chat.buyer?.name?.toLowerCase() || '';
        // Safely check chat message
        const chatMessage = chat.chat?.toLowerCase() || '';

        return buyerName.includes(query) || chatMessage.includes(query);
      });
    }

    setFilteredChats(filtered);
    console.log('🔍 [useChatList] Filters applied:', {
      platform: filters.platform,
      readStatus: filters.readStatus,
      searchQuery: filters.searchQuery,
      originalCount: chats.length,
      filteredCount: filtered.length,
    });
  };

  /**
   * Refresh chat list
   */
  const refresh = useCallback(async () => {
    await fetchChatList(true);
  }, [fetchChatList]);

  /**
   * Load more chats (for pagination - not implemented yet)
   */
  const loadMore = useCallback(async () => {
    // TODO: Implement pagination if needed
    console.log('📱 [useChatList] Load more not implemented yet');
  }, []);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchChatList();
  }, [fetchChatList]);

  /**
   * Apply filters whenever chats or filters change
   * Using direct dependencies instead of applyFilters function to prevent re-render loop
   */
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, filters.platform, filters.readStatus, filters.searchQuery]);

  return {
    chats: filteredChats,
    loading,
    error,
    refreshing,
    filters,
    setFilters,
    refresh,
    loadMore,
  };
};

