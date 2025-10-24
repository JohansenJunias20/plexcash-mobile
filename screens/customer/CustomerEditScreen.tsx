import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';

export type CustomerPayload = { id?: number; nama: string; notelp: string; alamat: string };

type Props = NativeStackScreenProps<AppStackParamList, 'CustomerEdit'>;

type Access = { access?: { actions?: { create?: boolean } } };

export default function CustomerEditScreen({ route, navigation }: Props): JSX.Element {
  const id = route.params?.id;
  const isNew = !id;

  const [access, setAccess] = useState<Access['access']>();
  const [model, setModel] = useState<CustomerPayload>({ nama: '', notelp: '', alamat: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { navigation.setOptions({ title: isNew ? 'Tambah Customer' : 'Customer' }); }, [isNew, navigation]);

  useEffect(() => { (async () => { try { const res = await ApiService.authenticatedRequest('/access'); if (res?.status) setAccess(res.access); } catch {} })(); }, []);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const res = await ApiService.authenticatedRequest('/get/customer');
        if (res?.status) {
          const found = (res.data || []).find((it: any) => Number(it.id) === Number(id));
          if (found) setModel({ nama: found.nama || '', notelp: found.notelp || '', alamat: found.alamat || '' });
        }
      } catch (e) { console.error('Load customer error', e); }
    };
    load();
  }, [id]);

  const phoneValid = useMemo(() => /^\+?\d[\d\s-]{5,}$/.test(model.notelp || ''), [model.notelp]);
  const nameValid = useMemo(() => (model.nama || '').trim().length > 0, [model.nama]);

  const canCreate = !!access?.actions?.create;

  const onSave = async () => {
    if (!canCreate) { Alert.alert('Permission', 'You do not have permission to create'); return; }
    if (!nameValid) { Alert.alert('Validation', 'Nama is required'); return; }
    if (model.notelp && !phoneValid) { Alert.alert('Validation', 'No Telp is not valid'); return; }

    setLoading(true);
    try {
      const res = await ApiService.authenticatedRequest('/customer', {
        method: 'POST',
        body: JSON.stringify({ data: [{ nama: model.nama, notelp: model.notelp, alamat: model.alamat }] })
      });
      if (res?.status) { Alert.alert('Success', 'Customer created'); navigation.goBack(); }
    } catch (e) { console.error('Save error', e); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}> 
          <Text style={styles.label}>Nama</Text>
          <TextInput style={[styles.input, !nameValid && styles.invalid]} value={model.nama} onChangeText={(v) => setModel(s => ({ ...s, nama: v }))} placeholder="Nama customer" />
        </View>
        <View style={styles.field}> 
          <Text style={styles.label}>No Telp</Text>
          <TextInput style={[styles.input, !!model.notelp && !phoneValid && styles.invalid]} value={model.notelp} onChangeText={(v) => setModel(s => ({ ...s, notelp: v }))} placeholder="08xxxxxxxx" keyboardType="phone-pad" />
        </View>
        <View style={styles.field}> 
          <Text style={styles.label}>Alamat</Text>
          <TextInput style={styles.input} value={model.alamat} onChangeText={(v) => setModel(s => ({ ...s, alamat: v }))} placeholder="Alamat" />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, (!canCreate || loading) && styles.buttonDisabled]} disabled={!canCreate || loading} onPress={onSave}>
            <Text style={styles.buttonText}>{isNew ? 'Create' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  field: { marginBottom: 12 },
  label: { fontSize: 14, color: '#374151', marginBottom: 6 },
  input: { backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#e5e7eb' },
  invalid: { borderColor: '#ef4444' },
  actions: { flexDirection: 'row', gap: 12 as any, marginTop: 8 },
  button: { flex: 1, backgroundColor: '#2563eb', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '600' },
});

