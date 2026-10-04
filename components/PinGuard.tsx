import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';

interface Props {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}

// Padanan mobile dari PinGuard web (Laporan/PinGuard.tsx): memakai PIN keamanan yang sama
// (/get/pin/status, /verify, /forgot). Terkunci lagi setiap layar dibuka ulang.
export default function PinGuard({ title, onCancel, children }: Props) {
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const checkPinStatus = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await ApiService.get('/get/pin/status');
      if (data && typeof data === 'object' && data.status) {
        if (data.bypassed) {
          setIsUnlocked(true);
        } else {
          setHasPin(data.hasPin === true);
        }
      } else {
        setErrorMsg((data && data.reason) || 'Gagal memeriksa status PIN');
        setHasPin(null);
      }
    } catch (err: any) {
      setErrorMsg('Gagal terhubung ke server: ' + (err?.message || err));
      setHasPin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPinStatus();
  }, [checkPinStatus]);

  const handleVerify = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!pin) {
      setErrorMsg('Silakan masukkan PIN Anda');
      return;
    }
    setSubmitting(true);
    try {
      const data = await ApiService.post('/get/pin/verify', { pin });
      if (data && typeof data === 'object' && data.status) {
        setPin('');
        setIsUnlocked(true);
      } else {
        setErrorMsg((data && data.reason) || 'PIN yang Anda masukkan salah');
      }
    } catch (err: any) {
      setErrorMsg('Terjadi kesalahan saat memverifikasi PIN');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSendingEmail(true);
    try {
      const data = await ApiService.post('/get/pin/forgot', {});
      if (data && typeof data === 'object' && data.status) {
        setSuccessMsg(
          data.message ||
            'Link reset PIN telah dikirim ke email admin/owner toko Anda. Minta admin/owner untuk mengecek Inbox atau folder Spam.'
        );
      } else {
        setErrorMsg((data && data.reason) || 'Gagal mengirimkan email reset PIN');
      }
    } catch (err: any) {
      setErrorMsg('Terjadi kesalahan saat mengirimkan permintaan reset PIN');
    } finally {
      setSendingEmail(false);
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.subtitle}>Memeriksa otentikasi keamanan...</Text>
        </View>
      );
    }

    if (hasPin === null) {
      return (
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="lock-closed" size={28} color="#dc2626" />
          </View>
          <Text style={styles.title}>Akses Terkunci</Text>
          <Text style={styles.errorBox}>{errorMsg || 'Gagal terhubung ke server'}</Text>
          <Text style={styles.subtitle}>
            Tidak dapat memuat status PIN keamanan. Periksa koneksi atau sesi login Anda.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={onCancel}>
              <Text style={styles.btnOutlineText}>Kembali</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={checkPinStatus}>
              <Text style={styles.btnPrimaryText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (hasPin === false) {
      return (
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="key" size={28} color="#d97706" />
          </View>
          <Text style={styles.title}>PIN Keamanan Belum Diatur</Text>
          <Text style={styles.subtitle}>
            Untuk mengakses {title}, buat PIN Keamanan terlebih dahulu lewat web PlexSeller di menu
            Setting &gt; Keamanan.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={onCancel}>
              <Text style={styles.btnOutlineText}>Kembali</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={checkPinStatus}>
              <Text style={styles.btnPrimaryText}>Periksa Lagi</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: '#dbeafe' }]}>
          <Ionicons name="lock-closed" size={28} color="#2563eb" />
        </View>
        <Text style={styles.title}>Masukkan PIN Keamanan</Text>
        <Text style={styles.subtitle}>Masukkan PIN untuk membuka menu {title}.</Text>

        {errorMsg ? <Text style={styles.errorBox}>{errorMsg}</Text> : null}
        {successMsg ? <Text style={styles.successBox}>{successMsg}</Text> : null}

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="PIN Anda"
            placeholderTextColor="#9ca3af"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry={!showPin}
            editable={!submitting}
            autoFocus
            onSubmitEditing={handleVerify}
          />
          <TouchableOpacity onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
            <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleForgot} disabled={sendingEmail} style={styles.forgotBtn}>
          <Text style={styles.forgotText}>
            {sendingEmail ? 'Mengirim link reset...' : 'Lupa PIN?'}
          </Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, { flex: 0.35 }]}
            onPress={onCancel}
            disabled={submitting}
          >
            <Text style={styles.btnOutlineText}>Batal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { flex: 0.65 }, submitting && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Masuk</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex}>{renderBody()}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center', padding: 20 },
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { alignItems: 'center', gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  errorBox: {
    alignSelf: 'stretch',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    fontSize: 13,
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  successBox: {
    alignSelf: 'stretch',
    backgroundColor: '#ecfdf5',
    color: '#047857',
    fontSize: 13,
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  inputWrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  input: { flex: 1, height: 48, fontSize: 18, letterSpacing: 4, color: '#111827' },
  eyeBtn: { padding: 6 },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 10 },
  forgotText: { color: '#d97706', fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 8 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  btnOutlineText: { color: '#4b5563', fontWeight: '600', fontSize: 15 },
  btnPrimary: { backgroundColor: '#10b981' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
