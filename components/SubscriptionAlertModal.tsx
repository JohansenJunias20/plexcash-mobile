import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

const SubscriptionAlertModal = () => {
  const { isAuthenticated } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkBalance = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await ApiService.get('/get/user/balance');
        if (response && response.status) {
          const b = typeof response.balance === 'number' ? response.balance : (typeof response.data?.balance === 'number' ? response.data.balance : 0);
          if (isMounted) {
            setBalance(b);
            if (b < 0) {
              setModalVisible(true);
              setCountdown(5);
              setCanClose(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching balance for subscription alert:', error);
      }
    };

    checkBalance();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (modalVisible && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (modalVisible && countdown <= 0) {
      setCanClose(true);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [modalVisible, countdown]);

  if (!modalVisible) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => {
        if (canClose) setModalVisible(false);
      }}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={48} color="#d32f2f" />
          </View>
          <Text style={styles.modalTitle}>Peringatan Saldo</Text>
          <Text style={styles.modalText}>
            Saldo akun Anda tidak cukup. Langganan Anda dapat ditangguhkan jika saldo tidak mencukupi untuk pembayaran berikutnya. 
          </Text>
          
          <TouchableOpacity
            style={[styles.button, canClose ? styles.buttonActive : styles.buttonDisabled]}
            onPress={() => {
              if (canClose) setModalVisible(false);
            }}
            disabled={!canClose}
          >
            <Text style={styles.textStyle}>
              {canClose ? 'Mengerti' : `Tunggu ${countdown} detik`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '85%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 15,
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  modalText: {
    marginBottom: 25,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
    elevation: 2,
    minWidth: 150,
  },
  buttonActive: {
    backgroundColor: '#d32f2f',
  },
  buttonDisabled: {
    backgroundColor: '#9e9e9e',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default SubscriptionAlertModal;
