import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';

export type User = {
  email: string;
  akses?: any;
  akses_mp?: number[];
};

type Nav = NativeStackNavigationProp<AppStackParamList, 'UserList'>;

type Access = { access?: { master?: { user?: boolean } } };

export default function UserListScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState<Access['access']>();

  const fetchAccess = useCallback(async () => {
    try {
      const res = await ApiService.authenticatedRequest('/access');
      if (res?.status) setAccess(res.access);
    } catch (e) {
      console.error('Error fetching access', e);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiService.authenticatedRequest('/get/user');
      
      if (res?.status && Array.isArray(res.data)) {
        const data: User[] = res.data.map((it: any) => ({
          email: String(it.email || ''),
          akses: it.akses || {},
          akses_mp: it.akses_mp || [],
        }));
        setItems(data);
      } else {
        console.log('❌ [USER-LIST] Invalid response format:', res);
        setItems([]);
      }
    } catch (e) {
      console.error('❌ [USER-LIST] User fetch error', e);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchAccess(); 
    fetchAll(); 
  }, [fetchAccess, fetchAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => it.email.toLowerCase().includes(q));
  }, [query, items]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const confirmDelete = (item: User) => {
    Alert.alert(
      'Hapus User',
      `Apakah Anda yakin ingin menghapus ${item.email}?`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => doDelete(item) },
      ]
    );
  };

  const doDelete = async (item: User) => {
    try {
      const res = await ApiService.authenticatedRequest('/user', {
        method: 'DELETE',
        body: JSON.stringify({ email: item.email }),
      });
      if (res?.status) {
        Alert.alert('Success', 'User berhasil dihapus');
        const updated = items.filter(it => it.email !== item.email);
        setItems(updated);
      } else {
        Alert.alert('Error', res?.reason || 'Gagal menghapus user');
      }
    } catch (e) {
      console.error('Delete user error', e);
      Alert.alert('Error', 'Gagal menghapus user');
    }
  };

  const renderItem = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('UserEdit', { email: item.email })}>
      <View style={{ flex: 1 }}>
        <View style={styles.emailRow}>
          <Ionicons name="person-circle" size={20} color="#f59e0b" />
          <Text style={styles.title} numberOfLines={1}>{item.email}</Text>
        </View>
        <Text style={styles.subtitle}>
          Tap to edit permissions
        </Text>
      </View>
      <TouchableOpacity style={styles.kebab} onPress={() => confirmDelete(item)}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const hasUserAccess = access?.master?.user;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Hamburger Menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Management</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.input}
          placeholder={'Search user by email'}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.email}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>Tidak ada user</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, !hasUserAccess && styles.fabDisabled]}
        onPress={() => hasUserAccess ? navigation.navigate('UserEdit', undefined) : Alert.alert('Permission', 'You do not have permission to create')}
        activeOpacity={hasUserAccess ? 0.7 : 1}
      >
        <Ionicons name="person-add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  hamburgerButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8 as any, padding: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  input: { flex: 1, paddingHorizontal: 8, height: 40 },
  card: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 12, marginVertical: 6, padding: 16, borderRadius: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 as any, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  subtitle: { fontSize: 12, color: '#6B7280', marginLeft: 28 },
  kebab: { paddingHorizontal: 8, justifyContent: 'center' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  fabDisabled: { opacity: 0.4 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
});
