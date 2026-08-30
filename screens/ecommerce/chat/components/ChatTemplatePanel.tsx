import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IChatTemplate, IChatTemplatePanelProps } from '../types/chat.types';

const ChatTemplatePanel: React.FC<IChatTemplatePanelProps> = ({
  visible,
  groups,
  templates,
  ungrouped,
  loading,
  onClose,
  onSelectTemplate,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | string | 'ALL' | 'UNGROUPED'>('ALL');

  // Filter templates based on selected group & search query
  const filteredTemplates = useMemo(() => {
    let list: IChatTemplate[] = [];

    if (selectedGroupId === 'ALL') {
      list = templates;
    } else if (selectedGroupId === 'UNGROUPED') {
      list = ungrouped;
    } else {
      const group = groups.find((g) => String(g.id) === String(selectedGroupId));
      list = group ? group.templates : [];
    }

    if (!searchQuery.trim()) {
      return list;
    }

    const q = searchQuery.toLowerCase().trim();
    return list.filter((t) => {
      const titleMatch = t.title ? t.title.toLowerCase().includes(q) : false;
      const shortcutMatch = t.shortcut ? t.shortcut.toLowerCase().includes(q) : false;
      const contentMatch = t.content ? t.content.toLowerCase().includes(q) : false;
      return titleMatch || shortcutMatch || contentMatch;
    });
  }, [templates, groups, ungrouped, selectedGroupId, searchQuery]);

  if (!visible) return null;

  const renderTemplateCard = ({ item }: { item: IChatTemplate }) => (
    <View style={styles.templateCard}>
      {/* Card Header: Title, Group Badge, Shortcut */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.templateTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.group_name ? (
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>{item.group_name}</Text>
            </View>
          ) : null}
        </View>

        {item.shortcut ? (
          <View style={styles.shortcutBadge}>
            <Ionicons name="flash" size={12} color="#D97706" style={{ marginRight: 2 }} />
            <Text style={styles.shortcutText}>{item.shortcut}</Text>
          </View>
        ) : null}
      </View>

      {/* Card Body: Message Content Preview */}
      <Text style={styles.templateContent} numberOfLines={4}>
        {item.content}
      </Text>

      {/* Card Footer: Action Buttons */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.insertButton}
          onPress={() => onSelectTemplate(item, false)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={16} color="#4B5563" />
          <Text style={styles.insertButtonText}>Gunakan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => onSelectTemplate(item, true)}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={14} color="white" />
          <Text style={styles.sendButtonText}>Kirim</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbox-ellipses" size={24} color="#f59e0b" />
          <Text style={styles.headerTitle}>Template Pesan</Text>
        </View>
        <View style={styles.headerRight}>
          {onRefresh && (
            <TouchableOpacity onPress={onRefresh} style={styles.iconButton} disabled={loading}>
              <Ionicons name="refresh-outline" size={22} color={loading ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari template (judul, shortcut, pesan)..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Group Category Filter Tabs */}
      <View style={styles.groupsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupsScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* All category */}
          <TouchableOpacity
            style={[
              styles.groupChip,
              selectedGroupId === 'ALL' && styles.groupChipActive,
            ]}
            onPress={() => setSelectedGroupId('ALL')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.groupChipText,
                selectedGroupId === 'ALL' && styles.groupChipTextActive,
              ]}
            >
              Semua ({templates.length})
            </Text>
          </TouchableOpacity>

          {/* Group categories */}
          {groups.map((g) => {
            const count = g.templates ? g.templates.length : 0;
            const isSelected = String(selectedGroupId) === String(g.id);
            return (
              <TouchableOpacity
                key={String(g.id)}
                style={[styles.groupChip, isSelected && styles.groupChipActive]}
                onPress={() => setSelectedGroupId(g.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    isSelected && styles.groupChipTextActive,
                  ]}
                >
                  {g.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Ungrouped category */}
          {ungrouped.length > 0 && (
            <TouchableOpacity
              style={[
                styles.groupChip,
                selectedGroupId === 'UNGROUPED' && styles.groupChipActive,
              ]}
              onPress={() => setSelectedGroupId('UNGROUPED')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.groupChipText,
                  selectedGroupId === 'UNGROUPED' && styles.groupChipTextActive,
                ]}
              >
                Tanpa Grup ({ungrouped.length})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Memuat template pesan...</Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && filteredTemplates.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbox-ellipses-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>Tidak ada template ditemukan</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Coba gunakan kata kunci pencarian yang lain'
              : 'Belum ada template pada grup ini'}
          </Text>
        </View>
      )}

      {/* Template List */}
      {!loading && filteredTemplates.length > 0 && (
        <FlatList
          data={filteredTemplates}
          renderItem={renderTemplateCard}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 520,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 4,
  },
  groupsContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  groupsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  groupChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#f59e0b',
  },
  groupChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  groupChipTextActive: {
    color: '#B45309',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  groupBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  groupBadgeText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  shortcutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginLeft: 8,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  templateContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  insertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  insertButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  emptySubtext: {
    marginTop: 6,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default ChatTemplatePanel;
