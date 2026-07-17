import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment, { Moment } from 'moment';
import { WebView } from 'react-native-webview';
import Share from 'react-native-share';
import * as FileSystem from 'expo-file-system'; // Expo standard, usually available in expo bare/managed

import ApiService from '../../../services/api';
import SearchBarangModal, { BarangItem } from '../../../components/SearchBarangModal';
import SearchBundlingModal, { BundlingItem } from '../../../components/penjualan/SearchBundlingModal';

function getDatesBetween(startDate: Moment, endDate: Moment): string[] {
  let dates: string[] = [];
  let currDate = moment(startDate).startOf('day');
  let lastDate = moment(endDate).startOf('day');
  while (currDate.add(1, 'days').diff(lastDate) < 0) {
    dates.push(currDate.clone().format('YYYY-MM-DD'));
  }
  return [startDate.format('YYYY-MM-DD'), ...dates, endDate.format('YYYY-MM-DD')];
}

function getUniqueValuesByKey(array: any[], key: string): any[] {
  return [...new Set(array.map(item => item[key]))];
}

export default function GrafikPenjualanTab() {
  const [startDate, setStartDate] = useState(moment().subtract(7, 'days').toDate());
  const [endDate, setEndDate] = useState(moment().toDate());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [currentBarang, setCurrentBarang] = useState<{ nama: string; id_barang?: number; id_bundling?: number; sku: string } | null>(null);
  const [ecommerceList, setEcommerceList] = useState<{ id: number; name: string }[]>([]);
  const [currentEcommerce, setCurrentEcommerce] = useState<number>(0);
  
  const [openBarang, setOpenBarang] = useState(false);
  const [openBundling, setOpenBundling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [dataEcer, setDataEcer] = useState<any[]>([]);
  const [dataBundling, setDataBundling] = useState<any[]>([]);
  const [dataOfflineEcer, setDataOfflineEcer] = useState<any[]>([]);
  const [dataOfflineBundling, setDataOfflineBundling] = useState<any[]>([]);
  
  // Chart processed data
  const [chartDataAll, setChartDataAll] = useState<{ [id_ecommerce: number]: number[] }>({});
  const [chartDataSingle, setChartDataSingle] = useState<{ [sku: string]: number[] }>({});

  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    ApiService.get("/get/ecommerce").then(response => {
      if (response && response.status && response.data) {
        setEcommerceList(response.data.filter((rd: any) => rd.status == "APPROVED"));
      }
    }).catch(console.error);
  }, []);

  const fetchData = async () => {
    if (!startDate || !endDate) return;
    
    setIsLoading(true);
    try {
      const startStr = moment(startDate).startOf('day').format("YYYY-MM-DD HH:mm:ss");
      const endStr = moment(endDate).endOf('day').format("YYYY-MM-DD HH:mm:ss");
      const idBarang = currentBarang?.id_barang || 0;
      const idBundling = currentBarang?.id_bundling || 0;

      const url = `/get/detailpenjualanonline?id_barang=${idBarang}&id_bundling=${idBundling}&startDate=${startStr}&endDate=${endStr}`;
      const response = await ApiService.get(url);

      if (response && response.status) {
        setDataEcer(response.data || []);
        setDataBundling(response.data2 || []);
        setDataOfflineEcer(response.data_offline || []);
        setDataOfflineBundling(response.data2_offline || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, currentBarang]);

  useEffect(() => {
    if (!startDate || !endDate) return;

    var xaxis = getDatesBetween(moment(startDate), moment(endDate));
    var combinedData = [...dataEcer, ...dataOfflineEcer];
    var combinedBundling = [...dataBundling, ...dataOfflineBundling];

    if (currentBarang) {
      // Single Item view
      if (currentEcommerce !== null) {
        var sku_unique_ecer = getUniqueValuesByKey(combinedData, "sku");
        var sku_unique_bundling = getUniqueValuesByKey(combinedBundling, "sku");

        var final = xaxis.reduce((a, tanggal, idx) => {
          var new_a = { ...a };
          
          sku_unique_ecer.forEach((sku: any) => {
            var ecer = combinedData.find(dt => dt.tanggal == tanggal && dt.id_ecommerce == currentEcommerce && dt.sku == sku);
            if (!new_a.hasOwnProperty(sku)) new_a[sku] = [ecer?.tot_qty || 0];
            else {
              if (new_a[sku][idx] !== undefined) new_a[sku][idx] += (ecer?.tot_qty || 0);
              else new_a[sku].push(ecer?.tot_qty || 0);
            }
          });

          var bundlings = combinedBundling.filter(dt2 => dt2.tanggal == tanggal && dt2.id_ecommerce == currentEcommerce);
          sku_unique_bundling.forEach((sku: any) => {
            var total_bundling = bundlings.filter(bd => bd.sku == sku).reduce((acc, b) => acc + (b.tot_qty * (b.qty_required || 1)), 0);
            if (!new_a.hasOwnProperty(sku)) new_a[sku] = [total_bundling];
            else {
              if (new_a[sku][idx] !== undefined) new_a[sku][idx] += total_bundling;
              else new_a[sku].push(total_bundling);
            }
          });
          return new_a;
        }, {} as { [sku: string]: number[] });

        setChartDataAll({});
        setChartDataSingle(final);
      }
    } else {
      // All items grouped by Ecommerce
      var finalAll = xaxis.reduce((a, b) => {
        if (!a[0]) a[0] = [];
        var find_offline = combinedData.find(dt => dt.tanggal == b && dt.id_ecommerce == 0);
        var finds2_offline = combinedBundling.filter(dt => dt.tanggal == b && dt.id_ecommerce == 0);

        a[0].push(find_offline ? find_offline.tot_qty : 0);
        var len_offline = a[0].length;
        if (finds2_offline.length) {
          a[0][len_offline - 1] += finds2_offline.reduce((acc, bd) => {
            if (bd.children) return acc + bd.children.reduce((childAcc: any, child: any) => childAcc + (bd.tot_qty * child.qty_required), 0);
            return acc + (bd.tot_qty * (bd.qty_required || 0));
          }, 0);
        }

        for (let i = 0; i < ecommerceList.length; i++) {
          const elist = ecommerceList[i];
          var find = combinedData.find(dt => dt.tanggal == b && dt.id_ecommerce == elist.id);
          var finds2 = combinedBundling.filter(dt => dt.tanggal == b && dt.id_ecommerce == elist.id);

          if (!a[elist.id]) a[elist.id] = [];
          a[elist.id].push(find ? find.tot_qty : 0);
          
          var len = a[elist.id].length;
          if (finds2.length) {
            a[elist.id][len - 1] += finds2.reduce((acc, bd) => acc + (bd.tot_qty * (bd.qty_required || 1)), 0);
          }
        }
        return a;
      }, {} as { [id_ecommerce: number]: number[] });

      setChartDataAll(finalAll);
      setChartDataSingle({});
    }
  }, [currentEcommerce, dataEcer, dataBundling, dataOfflineEcer, dataOfflineBundling, startDate, endDate, currentBarang, ecommerceList]);

  const onStartChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndDate(selectedDate);
  };

  const handleExportCsv = async () => {
    try {
      setIsLoading(true);
      const xaxis = getDatesBetween(moment(startDate), moment(endDate));
      let csvContent = 'Data Penjualan\nTanggal,';
      
      const isSingle = !!currentBarang;
      const dataToIterate = isSingle ? chartDataSingle : chartDataAll;
      const seriesKeys = Object.keys(dataToIterate);
      
      // Header row
      seriesKeys.forEach((key, idx) => {
        let label = key;
        if (!isSingle) {
          const id_ecom = parseInt(key);
          label = id_ecom === 0 ? "Offline" : (ecommerceList.find(e => e.id === id_ecom)?.name || `ID ${id_ecom}`);
        }
        csvContent += `"${label}"${idx === seriesKeys.length - 1 ? '' : ','}`;
      });
      csvContent += '\n';

      // Data rows
      xaxis.forEach((date, i) => {
        csvContent += `${date},`;
        seriesKeys.forEach((key, idx) => {
          const val = dataToIterate[key as any][i] || 0;
          csvContent += `${val}${idx === seriesKeys.length - 1 ? '' : ','}`;
        });
        csvContent += '\n';
      });

      const fileUri = `${FileSystem.documentDirectory}LaporanBarang_${moment().format('YYYYMMDD')}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      
      await Share.open({
        url: fileUri,
        title: 'Export Laporan Barang',
        type: 'text/csv'
      });
    } catch (error) {
      console.error('Error export:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat export CSV');
    } finally {
      setIsLoading(false);
    }
  };

  // Build Chart HTML
  const generateChartHtml = () => {
    const xaxis = getDatesBetween(moment(startDate), moment(endDate));
    let datasets: any[] = [];
    
    if (Object.keys(chartDataAll).length > 0) {
      datasets = Object.entries(chartDataAll)
        .filter(([id_ecommerce, values]) => values.some(v => v !== 0) && (currentEcommerce === 0 || currentEcommerce === parseInt(id_ecommerce)))
        .map(([id_ecommerce, values]) => {
          const id_ecom = parseInt(id_ecommerce);
          const label = id_ecom === 0 ? "Offline" : (ecommerceList.find(el => el.id == id_ecom)?.name || `ID ${id_ecom}`);
          return {
            label,
            data: values,
            fill: false,
            borderColor: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
            tension: 0.1
          };
      });
    } else if (Object.keys(chartDataSingle).length > 0) {
      datasets = Object.entries(chartDataSingle)
        .filter(([sku, values]) => values.some(v => v !== 0))
        .map(([sku, values]) => {
          const name = dataEcer.find(d => d.sku == sku)?.nama || dataOfflineEcer.find(d => d.sku == sku)?.nama || dataBundling.find(d => d.sku == sku)?.nama || currentBarang?.nama || sku;
          return {
            label: name.substring(0, 45),
            data: values,
            fill: false,
            borderColor: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
            tension: 0.1
          };
      });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { margin: 0; padding: 10px; background-color: #fff; font-family: sans-serif; }
          #chartContainer { position: relative; height: 95vh; width: 100vw; }
        </style>
      </head>
      <body>
        <div id="chartContainer">
          <canvas id="myChart"></canvas>
        </div>
        <script>
          const ctx = document.getElementById('myChart').getContext('2d');
          const data = {
            labels: ${JSON.stringify(xaxis)},
            datasets: ${JSON.stringify(datasets)}
          };
          new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } }
              },
              scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { ticks: { maxRotation: 45, minRotation: 45 } }
              }
            }
          });
        </script>
      </body>
      </html>
    `;
    return htmlContent;
  };

  return (
    <View style={styles.container}>
      {/* Date Filters */}
      <View style={styles.headerFilters}>
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
            <Ionicons name="calendar-outline" size={16} color="#4b5563" />
            <Text style={styles.dateText}>{moment(startDate).format('DD MMM YYYY')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateDivider}>-</Text>
          <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
            <Ionicons name="calendar-outline" size={16} color="#4b5563" />
            <Text style={styles.dateText}>{moment(endDate).format('DD MMM YYYY')}</Text>
          </TouchableOpacity>
        </View>

        {showStartPicker && (
          <DateTimePicker value={startDate} mode="date" display="default" onChange={onStartChange} />
        )}
        {showEndPicker && (
          <DateTimePicker value={endDate} mode="date" display="default" onChange={onEndChange} />
        )}

        {/* Item Selection */}
        <View style={styles.itemSearchRow}>
          <View style={styles.selectedItemBox}>
            <Text style={styles.selectedItemText} numberOfLines={1}>
              {currentBarang ? currentBarang.nama : 'Semua Barang (Pilih Spesifik)'}
            </Text>
            {currentBarang && (
              <TouchableOpacity onPress={() => setCurrentBarang(null)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={() => setOpenBarang(true)}>
            <Ionicons name="search" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: '#8b5cf6' }]} onPress={() => setOpenBundling(true)}>
            <Ionicons name="layers" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: '#10b981' }]} onPress={handleExportCsv}>
            <Ionicons name="download" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Ecommerce Tabs */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ecomTabs}>
          <TouchableOpacity 
            style={[styles.ecomTab, currentEcommerce === 0 && styles.ecomTabActive]}
            onPress={() => setCurrentEcommerce(0)}
          >
            <Text style={[styles.ecomTabText, currentEcommerce === 0 && styles.ecomTabTextActive]}>SEMUA</Text>
          </TouchableOpacity>
          {ecommerceList.map(ecom => (
            <TouchableOpacity 
              key={ecom.id}
              style={[styles.ecomTab, currentEcommerce === ecom.id && styles.ecomTabActive]}
              onPress={() => setCurrentEcommerce(ecom.id)}
            >
              <Text style={[styles.ecomTabText, currentEcommerce === ecom.id && styles.ecomTabTextActive]}>
                {ecom.name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chart View */}
      <View style={styles.chartContainer}>
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}
        <WebView 
          ref={webViewRef}
          source={{ html: generateChartHtml() }} 
          style={styles.webview} 
          javaScriptEnabled={true}
          scalesPageToFit={true}
        />
      </View>

      {/* Modals */}
      <SearchBarangModal 
        visible={openBarang}
        onClose={() => setOpenBarang(false)}
        onSelect={(items) => {
          if (items.length > 0) {
            const item = items[0];
            setCurrentBarang({ nama: item.nama, id_barang: item.id, sku: item.sku });
          }
          setOpenBarang(false);
        }}
        multiSelect={false}
      />
      
      <SearchBundlingModal
        visible={openBundling}
        onClose={() => setOpenBundling(false)}
        onSelect={(items) => {
          if (items.length > 0) {
            const item = items[0];
            setCurrentBarang({ nama: item.nama, id_bundling: item.id, sku: item.sku });
          }
          setOpenBundling(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerFilters: { padding: 12, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingVertical: 8 },
  dateText: { marginLeft: 6, fontSize: 13, color: '#374151' },
  dateDivider: { marginHorizontal: 8, color: '#9ca3af', fontWeight: 'bold' },
  itemSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedItemBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  selectedItemText: { flex: 1, fontSize: 13, color: '#374151' },
  searchBtn: { backgroundColor: '#3b82f6', width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  ecomTabs: { backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 8 },
  ecomTab: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderColor: 'transparent' },
  ecomTabActive: { borderColor: '#3b82f6' },
  ecomTabText: { fontSize: 12, fontWeight: 'bold', color: '#6b7280' },
  ecomTabTextActive: { color: '#3b82f6' },
  chartContainer: { flex: 1, backgroundColor: 'white', position: 'relative' },
  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, alignItems: 'center', justifyContent: 'center' },
  webview: { flex: 1, opacity: 0.99, overflow: 'hidden' }
});
