import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';

export type SupplierPayload = {
  id?: number;
  nama: string;
  notelp: string;
  nokantor: string;
  email: string;
};

type Props = NativeStackScreenProps<AppStackParamList, 'SupplierEdit'>;

type Access = { access?: { actions?: { create?: boolean; update?: boolean; delete?: boolean } } };

export default function SupplierEditScreen({ route, navigation }: Props): JSX.Element {
  const id = route.params?.id;
  const isNew = !id;

  const [access, setAccess] = useState<Access['access']>();
  const [model, setModel] = useState<SupplierPayload>({ nama: '', notelp: '', nokantor: '', email: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAccess = async () => {
      try { const res = await ApiService.authenticatedRequest('/access'); if (res?.status) setAccess(res.access); } catch {}
    };
    fetchAccess();
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Tambah Supplier' : 'Edit Supplier' });
  }, [isNew, navigation]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const res = await ApiService.authenticatedRequest('/get/supplier');
        if (res?.status) {
          const found = (res.data || []).find((it: any) => Number(it.id) === Number(id));
          if (found) setModel({ nama: found.nama || '', notelp: found.notelp || '', nokantor: found.nokantor || '', email: found.email || '' });
        }
      } catch (e) { console.error('Load supplier error', e); }
    };
    load();
  }, [id]);

  const emailValid = useMemo(() => /.+@.+\..+/.test(model.email || ''), [model.email]);
  const phoneValid = useMemo(() => /^\+?\d[\d\s-]{5,}$/.test(model.notelp || ''), [model.notelp]);
  const nameValid = useMemo(() => (model.nama || '').trim().length > 0, [model.nama]);

  const canSave = isNew ? !!access?.actions?.create : !!access?.actions?.update;

  const onSave = async () => {
    if (!canSave) { Alert.alert('Permission', 'You do not have permission to save'); return; }
    if (!nameValid) { Alert.alert('Validation', 'Nama is required'); return; }
    if (model.email && !emailValid) { Alert.alert('Validation', 'Email is not valid'); return; }
    if (model.notelp && !phoneValid) { Alert.alert('Validation', 'No Telp is not valid'); return; }

    setLoading(true);
    try {
      if (isNew) {
        const res = await ApiService.authenticatedRequest('/supplier', {
          method: 'POST',
          body: JSON.stringify({ data: [{ nama: model.nama, notelp: model.notelp, nokantor: model.nokantor, email: model.email }] })
        });
        if (res?.status) { Alert.alert('Success', 'Supplier created'); navigation.goBack(); }
      } else {
        const res = await ApiService.authenticatedRequest('/supplier', {
          method: 'PATCH',
          body: JSON.stringify({ id: { key: 'id', value: id }, data: [{ nama: model.nama, notelp: model.notelp, nokantor: model.nokantor, email: model.email }] })
        });
        if (res?.status) { Alert.alert('Success', 'Supplier updated'); navigation.goBack(); }
      }
    } catch (e) {
      console.error('Save error', e);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = () => {
    if (!access?.actions?.delete) { Alert.alert('Permission', 'You do not have permission to delete'); return; }
    Alert.alert('Delete Supplier', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const doDelete = async () => {
    try {
      const res = await ApiService.authenticatedRequest('/supplier', {
        method: 'DELETE',
        body: JSON.stringify({ data: [{ id }] })
      });
      if (res?.status) { Alert.alert('Deleted', 'Supplier deleted'); navigation.goBack(); }
    } catch (e) { console.error('Delete error', e); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}> 
          <Text style={styles.label}>Nama</Text>
          <TextInput
            style={[styles.input, !nameValid && styles.invalid]}
            value={model.nama}
            onChangeText={(v) => setModel(s => ({ ...s, nama: v }))}
            placeholder="Nama supplier"
          />
        </View>
        <View style={styles.field}> 
          <Text style={styles.label}>No Telp</Text>
          <TextInput
            style={[styles.input, !!model.notelp && !phoneValid && styles.invalid]}
            value={model.notelp}
            onChangeText={(v) => setModel(s => ({ ...s, notelp: v }))}
            placeholder="08xxxxxxxx"
            keyboardType="phone-pad"
          />
        </View>
        <View style={styles.field}> 
          <Text style={styles.label}>No Kantor</Text>
          <TextInput
            style={styles.input}
            value={model.nokantor}
            onChangeText={(v) => setModel(s => ({ ...s, nokantor: v }))}
            placeholder="Kantor"
          />
        </View>
        <View style={styles.field}> 
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, !!model.email && !emailValid && styles.invalid]}
            value={model.email}
            onChangeText={(v) => setModel(s => ({ ...s, email: v }))}
            placeholder="email@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, (!canSave || loading) && styles.buttonDisabled]} disabled={!canSave || loading} onPress={onSave}>
            <Text style={styles.buttonText}>{isNew ? 'Create' : 'Save'}</Text>
          </TouchableOpacity>
          {!isNew && (
            <TouchableOpacity style={[styles.buttonDanger, (!access?.actions?.delete || loading) && styles.buttonDisabled]} disabled={!access?.actions?.delete || loading} onPress={onDelete}>
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          )}
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
  buttonDanger: { flex: 1, backgroundColor: '#ef4444', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '600' },
});

