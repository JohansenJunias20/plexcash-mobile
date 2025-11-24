import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/RootNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { API_BASE_URL } from '../../services/api';
import { getTokenAuth } from '../../services/token';
import { useAuth } from '../../context/AuthContext';

interface ItemForm {
  id?: number;
  sku: string;
  nama: string;
  merk: string;
  kategori: string;
  satuan: string;
  minstok: number;
  hargajual: number;
  hargajual2: number;
  sync_stock: boolean;
}

type Route = RouteProp<AppStackParamList, 'BarangEdit'>;

type Nav = NativeStackNavigationProp<AppStackParamList, 'BarangEdit'>;

export default function BarangEditScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const id = route.params?.id;

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemForm>({
    sku: '', nama: '', merk: '', kategori: '', satuan: '', minstok: 0, hargajual: 0, hargajual2: 0, sync_stock: false,
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const token = await getTokenAuth();
        if (!token) { Alert.alert('Session expired', 'Please login'); return; }
        const res = await fetch(`${API_BASE_URL}/get/masterbarang/condition/and/id:equal:${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status && data.data?.[0]) {
          const it = data.data[0];
          setForm({
            id: it.id,
            sku: it.sku || '',
            nama: it.nama || '',
            merk: it.merk || '',
            kategori: it.kategori || '',
            satuan: it.satuan || '',
            minstok: Number(it.minstok) || 0,
            hargajual: Number(it.hargajual) || 0,
            hargajual2: Number(it.hargajual2) || 0,
            sync_stock: Boolean(it.sync_stock),
          });
        } else {
          Alert.alert('Error', data.reason || 'Failed to load item');
        }
      } catch (e) {
        Alert.alert('Error', 'Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    try {
      setSaving(true);
      const token = await getTokenAuth();
      if (!token) { Alert.alert('Session expired', 'Please login'); return; }
      if (id) {
        const res = await fetch(`${API_BASE_URL}/masterbarang`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: { key: 'id', value: id }, data: [{
            sku: form.sku, nama: form.nama, merk: form.merk, kategori: form.kategori, satuan: form.satuan,
            minstok: form.minstok, hargajual: form.hargajual, hargajual2: form.hargajual2, sync_stock: form.sync_stock,
          }]})
        });
        const json = await res.json();
        if (!json.status) throw new Error(json.reason || 'Update failed');
        Alert.alert('Success', 'Saved');
        navigation.navigate('BarangList');
      } else {
        const res = await fetch(`${API_BASE_URL}/masterbarang`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: [{
            stok_online: 0, nama: form.nama, merk: form.merk, satuan: form.satuan, kategori: form.kategori,
            hargajual: form.hargajual, hargajual2: form.hargajual2, hargabeli: 0, stok: 0, minstok: form.minstok,
            pesan: false, berat: 0, sku: form.sku, barcode: '', hpp: 0,
          }]})
        });
        const json = await res.json();
        if (!json.status) throw new Error(json.reason || 'Create failed');
        Alert.alert('Success', 'Created');
        navigation.navigate('BarangList');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.label}>SKU</Text>
      <TextInput style={styles.input} value={form.sku} onChangeText={(v) => setForm(s => ({ ...s, sku: v }))} />
      <Text style={styles.label}>Nama</Text>
      <TextInput style={styles.input} value={form.nama} onChangeText={(v) => setForm(s => ({ ...s, nama: v }))} />
      <Text style={styles.label}>Merk</Text>
      <TextInput style={styles.input} value={form.merk} onChangeText={(v) => setForm(s => ({ ...s, merk: v }))} />
      <Text style={styles.label}>Kategori</Text>
      <TextInput style={styles.input} value={form.kategori} onChangeText={(v) => setForm(s => ({ ...s, kategori: v }))} />
      <Text style={styles.label}>Satuan</Text>
      <TextInput style={styles.input} value={form.satuan} onChangeText={(v) => setForm(s => ({ ...s, satuan: v }))} />

      <Text style={styles.label}>Min Stok</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={String(form.minstok)} onChangeText={(v) => setForm(s => ({ ...s, minstok: Number(v) || 0 }))} />

      <Text style={styles.label}>Harga Jual 1</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={String(form.hargajual)} onChangeText={(v) => setForm(s => ({ ...s, hargajual: Number(v) || 0 }))} />
      <Text style={styles.label}>Harga Jual 2</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={String(form.hargajual2)} onChangeText={(v) => setForm(s => ({ ...s, hargajual2: Number(v) || 0 }))} />

      <View style={{ height: 12 }} />
      <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
        <Text style={{ color: 'white', fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 12, marginBottom: 4, color: '#374151', fontWeight: '600' },
  input: { borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 42 },
  save: { backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 10, marginTop: 16 },
});

