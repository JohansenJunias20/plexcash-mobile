import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import ApiService from '../../services/api';

const currency = (num: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
};

interface IAccountData {
  keterangan: string;
  kodeBA: string;
  saldo: number;
}

export default function LabaRugiScreen() {
  const navigation = useNavigation();
  const [fetching, setFetching] = useState(true);
  const [dateStart, setDateStart] = useState(moment().subtract(1, 'week').toDate());
  const [dateEnd, setDateEnd] = useState(moment().toDate());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [pendapatan, setPendapatan] = useState<IAccountData[]>([]);
  const [bebanOperasional, setBebanOperasional] = useState<IAccountData[]>([]);
  const [biayaPokok, setBiayaPokok] = useState<IAccountData[]>([]);
  const [biayaPokokFifo, setBiayaPokokFifo] = useState<IAccountData[]>([]);
  const [biayaLainnya, setBiayaLainnya] = useState<IAccountData[]>([]);
  
  const [useNew, setUseNew] = useState(true);
  const [metode, setMetode] = useState<'average' | 'fifo'>('average');

  const fetchData = useCallback(async () => {
    setFetching(true);
    setPendapatan([]);
    setBebanOperasional([]);
    setBiayaPokok([]);
    setBiayaPokokFifo([]);
    setBiayaLainnya([]);

    try {
      const startStr = moment(dateStart).format("YYYY-MM-DD");
      const endStr = moment(dateEnd).format("YYYY-MM-DD");
      const useFifoParam = metode === "fifo" ? 1 : 0;
      const useNewParam = useNew ? 1 : 0;
      
      const response = await ApiService.get(`/get/laporan/labarugi?use_fifo=${useFifoParam}&start=${startStr}&end=${endStr}&use_new=${useNewParam}`);
      
      if (response && response.status && response.data) {
        setPendapatan(response.data.pendapatan || []);
        setBebanOperasional(response.data.beban_operasional || []);
        setBiayaPokok(response.data.beban_pokok || []);
        setBiayaPokokFifo(response.data.biaya_pokok_fifo || response.data.beban_pokok || []);
        setBiayaLainnya(response.data.biaya_lainnya || []);
      }
    } catch (error) {
      console.error('Error fetching laba rugi:', error);
    } finally {
      setFetching(false);
    }
  }, [dateStart, dateEnd, useNew, metode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onStartChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setDateStart(selectedDate);
  };

  const onEndChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setDateEnd(selectedDate);
  };

  const renderSection = (title: string, data: IAccountData[], total: number) => {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionTotal}>{currency(total)}</Text>
        </View>
        {data.filter(item => item.saldo !== 0).sort((a, b) => (a.kodeBA || '').localeCompare(b.kodeBA || '')).map((item, index) => (
          <View key={`${item.kodeBA}-${index}`} style={styles.itemRow}>
            <Text style={styles.itemDesc}>  {item.kodeBA || '-'} {item.keterangan || '-'}</Text>
            <Text style={styles.itemSaldo}>{currency(item.saldo)}</Text>
          </View>
        ))}
      </View>
    );
  };

  const totalPendapatan = pendapatan.reduce((a, b) => a + b.saldo, 0);
  const activeBiayaPokok = metode === "fifo" ? biayaPokokFifo : biayaPokok;
  const totalBiayaPokok = activeBiayaPokok.reduce((a, b) => a + b.saldo, 0);
  const totalBebanOperasional = bebanOperasional.reduce((a, b) => a + b.saldo, 0);
  const totalBiayaLainnya = biayaLainnya.reduce((a, b) => a + b.saldo, 0);
  
  const labaRugi = totalPendapatan + totalBiayaPokok + totalBebanOperasional + totalBiayaLainnya;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan Laba Rugi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Filters */}
        <View style={styles.filterCard}>
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.datePickerBtn}>
              <Ionicons name="calendar-outline" size={18} color="#4b5563" />
              <Text style={styles.dateText}>{moment(dateStart).format('DD MMM YYYY')}</Text>
            </TouchableOpacity>
            
            <Text style={styles.dateDivider}>-</Text>
            
            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.datePickerBtn}>
              <Ionicons name="calendar-outline" size={18} color="#4b5563" />
              <Text style={styles.dateText}>{moment(dateEnd).format('DD MMM YYYY')}</Text>
            </TouchableOpacity>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={dateStart}
              mode="date"
              display="default"
              onChange={onStartChange}
            />
          )}
          
          {showEndPicker && (
            <DateTimePicker
              value={dateEnd}
              mode="date"
              display="default"
              onChange={onEndChange}
            />
          )}

          <View style={styles.optionsRow}>
            <View style={styles.switchContainer}>
              <Text style={styles.optionLabel}>Use New</Text>
              <Switch value={useNew} onValueChange={setUseNew} />
            </View>

            <View style={styles.radioContainer}>
              <Text style={styles.optionLabel}>Metode:</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity 
                  style={[styles.radioButton, metode === 'average' && styles.radioButtonActive]} 
                  onPress={() => setMetode('average')}
                >
                  <Text style={[styles.radioText, metode === 'average' && styles.radioTextActive]}>Average</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.radioButton, metode === 'fifo' && styles.radioButtonActive]} 
                  onPress={() => setMetode('fifo')}
                >
                  <Text style={[styles.radioText, metode === 'fifo' && styles.radioTextActive]}>FIFO</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={fetchData}>
            <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.searchButtonText}>Cari</Text>
          </TouchableOpacity>
        </View>

        {/* Results Data */}
        <View style={styles.resultsContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderTitle}>Tipe Akun</Text>
            <Text style={styles.tableHeaderTitle}>Saldo</Text>
          </View>

          {fetching ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#059669" />
            </View>
          ) : (
            <View style={styles.dataContainer}>
              {renderSection("Pendapatan", pendapatan, totalPendapatan)}
              {renderSection("Biaya Pokok", activeBiayaPokok, totalBiayaPokok)}
              {renderSection("6 Beban Operasional", bebanOperasional, totalBebanOperasional)}
              {renderSection("6 Biaya Lainnya", biayaLainnya, totalBiayaLainnya)}
              
              <View style={[styles.sectionContainer, styles.labaRugiTotalContainer]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.labaRugiTotalLabel}>Laba Rugi</Text>
                  <Text style={[
                    styles.labaRugiTotalValue,
                    labaRugi < 0 ? styles.textRed : styles.textGreen
                  ]}>{currency(labaRugi)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  dateDivider: {
    marginHorizontal: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginRight: 8,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioGroup: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 2,
  },
  radioButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  radioButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  radioText: {
    fontSize: 13,
    color: '#6b7280',
  },
  radioTextActive: {
    color: '#111827',
    fontWeight: '500',
  },
  searchButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  resultsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 32,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderTitle: {
    fontWeight: 'bold',
    color: '#1f2937',
    fontSize: 15,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  dataContainer: {
    marginTop: 8,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#374151',
    fontSize: 14,
  },
  sectionTotal: {
    fontWeight: '600',
    color: '#374151',
    fontSize: 14,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    opacity: 0.75,
  },
  itemDesc: {
    color: '#4b5563',
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  itemSaldo: {
    color: '#4b5563',
    fontSize: 13,
  },
  labaRugiTotalContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  labaRugiTotalLabel: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#111827',
  },
  labaRugiTotalValue: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  textGreen: {
    color: '#059669',
  },
  textRed: {
    color: '#dc2626',
  }
});
