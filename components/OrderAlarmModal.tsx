import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useOrderAlarm } from '../context/OrderAlarmContext';

// [pause, vibrate] repeated while repeat=true
const VIBRATION_PATTERN = [500, 1000];

const OrderAlarmModal = (): JSX.Element | null => {
  const { activeOrder, dismiss } = useOrderAlarm();
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (!activeOrder) return;

    let isMounted = true;

    const playAlarm = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/warning.mp3'),
          { isLooping: true }
        );
        if (!isMounted) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        await sound.playAsync();
      } catch (error) {
        console.error('❌ [OrderAlarmModal] Failed to play alarm sound:', error);
      }
    };

    playAlarm();
    Vibration.vibrate(VIBRATION_PATTERN, true);

    return () => {
      isMounted = false;
      Vibration.cancel();
      if (soundRef.current) {
        const sound = soundRef.current;
        soundRef.current = null;
        sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
      }
    };
  }, [activeOrder]);

  if (!activeOrder) return null;

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent>
      <LinearGradient colors={['#DC2626', '#B91C1C', '#7F1D1D']} style={styles.container}>
        <View style={styles.iconBadge}>
          <Ionicons name="alarm" size={48} color="#DC2626" />
        </View>
        <Text style={styles.title}>Pesanan Baru Masuk!</Text>
        <Text style={styles.platform}>{activeOrder.platform}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Pembeli</Text>
            <Text style={styles.value}>{activeOrder.buyer || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Item</Text>
            <Text style={styles.value}>{(activeOrder.items || []).join(', ') || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.value}>Rp {activeOrder.total || '-'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconBadge: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { color: 'white', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  platform: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 4, marginBottom: 24 },
  card: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16,
    padding: 18, marginBottom: 32,
  },
  row: { marginBottom: 12 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  value: { color: 'white', fontSize: 17, fontWeight: '600', marginTop: 2 },
  dismissBtn: {
    backgroundColor: 'white', paddingVertical: 16, paddingHorizontal: 48,
    borderRadius: 30,
  },
  dismissText: { color: '#B91C1C', fontSize: 18, fontWeight: 'bold' },
});

export default OrderAlarmModal;
