import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import moment from 'moment';
import DateTimePicker from '../../../components/AppDateTimePicker';
import ApiService from '../../../services/api';

type Group = 'day' | 'month';

interface IPoint {
  pendapatan: number;
  biaya_pokok: number;
  biaya_marketplace: number;
  laba: number;
}
interface ISeries {
  id_ecommerce: number;
  nama: string;
  platform: string;
  points: IPoint[];
}
interface IStore {
  id: number;
  nama: string;
}

interface Props {
  includeKilat: boolean;
  fifo: boolean;
  onChangeKilat: (v: boolean) => void;
  onChangeFifo: (v: boolean) => void;
}

const COLORS = [
  '#2563eb', '#f97316', '#10b981', '#e11d48', '#8b5cf6',
  '#0891b2', '#ca8a04', '#db2777', '#4b5563', '#65a30d',
];
const TOTAL_COLOR = '#111827';

const PRESETS: Record<Group, { id: string; label: string; getRange: () => { start: Date; end: Date } }[]> = {
  day: [
    { id: '7d', label: '7 Hari', getRange: () => ({ start: moment().subtract(6, 'days').startOf('day').toDate(), end: moment().toDate() }) },
    { id: '14d', label: '14 Hari', getRange: () => ({ start: moment().subtract(13, 'days').startOf('day').toDate(), end: moment().toDate() }) },
    { id: '30d', label: '30 Hari', getRange: () => ({ start: moment().subtract(29, 'days').startOf('day').toDate(), end: moment().toDate() }) },
    { id: 'this_month', label: 'Bulan Ini', getRange: () => ({ start: moment().startOf('month').toDate(), end: moment().toDate() }) },
    { id: 'last_month', label: 'Bulan Lalu', getRange: () => ({ start: moment().subtract(1, 'month').startOf('month').toDate(), end: moment().subtract(1, 'month').endOf('month').toDate() }) },
  ],
  month: [
    { id: '3m', label: '3 Bulan', getRange: () => ({ start: moment().subtract(2, 'months').startOf('month').toDate(), end: moment().toDate() }) },
    { id: '6m', label: '6 Bulan', getRange: () => ({ start: moment().subtract(5, 'months').startOf('month').toDate(), end: moment().toDate() }) },
    { id: '12m', label: '12 Bulan', getRange: () => ({ start: moment().subtract(11, 'months').startOf('month').toDate(), end: moment().toDate() }) },
    { id: 'this_year', label: 'Tahun Ini', getRange: () => ({ start: moment().startOf('year').toDate(), end: moment().toDate() }) },
  ],
};

const DEFAULT_PRESET: Record<Group, string> = { day: '30d', month: '6m' };

const currency = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

// Format singkat (rb/jt/M) untuk angka di ruang sempit; nilai penuh tetap ada di tooltip grafik
const shortCurrency = (num: number) => {
  const a = Math.abs(num);
  const s = num < 0 ? '-' : '';
  if (a >= 1e9) return `${s}Rp ${(a / 1e9).toFixed(1).replace('.0', '')} M`;
  if (a >= 1e6) return `${s}Rp ${(a / 1e6).toFixed(1).replace('.0', '')} jt`;
  if (a >= 1e3) return `${s}Rp ${Math.round(a / 1e3)} rb`;
  return `${s}Rp ${a}`;
};

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatPeriodLabel = (period: string, group: Group) => {
  if (group === 'month') {
    const m = moment(period, 'YYYY-MM');
    return `${BULAN_SINGKAT[m.month()]} ${m.format('YY')}`;
  }
  const m = moment(period, 'YYYY-MM-DD');
  return `${m.format('DD')} ${BULAN_SINGKAT[m.month()]}`;
};

const buildChartHtml = (
  labels: string[],
  datasets: { label: string; data: number[]; color: string; dashed: boolean }[],
  compact: boolean,
) => {
  const payload = JSON.stringify({ labels, datasets, maxTicks: compact ? 5 : 10, font: compact ? 9 : 10 }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    html, body { margin: 0; padding: 0; background: #fff; font-family: sans-serif; height: 100%; }
    #wrap { position: relative; height: 100%; width: 100%; padding: 4px; box-sizing: border-box; }
    #err { padding: 24px; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div id="wrap"><canvas id="c"></canvas></div>
  <script>
    if (typeof Chart === 'undefined') {
      document.body.innerHTML = '<div id="err">Grafik membutuhkan koneksi internet untuk dimuat.</div>';
    } else {
      var p = ${payload};
      var short = function (v) {
        var a = Math.abs(v), s = v < 0 ? '-' : '';
        if (a >= 1e9) return s + (a / 1e9).toFixed(1).replace('.0', '') + ' M';
        if (a >= 1e6) return s + (a / 1e6).toFixed(1).replace('.0', '') + ' jt';
        if (a >= 1e3) return s + (a / 1e3).toFixed(0) + ' rb';
        return s + a;
      };
      new Chart(document.getElementById('c'), {
        type: 'line',
        data: {
          labels: p.labels,
          datasets: p.datasets.map(function (d) {
            return {
              label: d.label, data: d.data, borderColor: d.color, backgroundColor: d.color,
              borderWidth: d.dashed ? 2 : 2.5, borderDash: d.dashed ? [6, 4] : [],
              pointRadius: p.labels.length > 40 ? 0 : 3, pointHoverRadius: 5, tension: 0.25, fill: false
            };
          })
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (c) { return c.dataset.label + ': Rp ' + Math.round(c.parsed.y).toLocaleString('id-ID'); }
              }
            }
          },
          scales: {
            y: { ticks: { callback: function (v) { return short(v); }, font: { size: p.font }, maxTicksLimit: 6 } },
            x: { ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: p.maxTicks, font: { size: p.font } }, grid: { display: false } }
          }
        }
      });
    }
  </script>
</body>
</html>`;
};

export default function LabaRugiGrafik({ includeKilat, fifo, onChangeKilat, onChangeFifo }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const compact = screenWidth < 380;
  const chartHeight = Math.round(Math.min(320, Math.max(240, screenWidth * 0.8)));
  const [group, setGroup] = useState<Group>('day');
  const [activePreset, setActivePreset] = useState<string | null>(DEFAULT_PRESET.day);
  const [dateStart, setDateStart] = useState(PRESETS.day[2].getRange().start);
  const [dateEnd, setDateEnd] = useState(PRESETS.day[2].getRange().end);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showOmset, setShowOmset] = useState(true);
  const [showLaba, setShowLaba] = useState(true);
  const [showTotal, setShowTotal] = useState(true);

  const [stores, setStores] = useState<IStore[]>([{ id: 0, nama: 'Offline / Toko' }]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [storesLoaded, setStoresLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [series, setSeries] = useState<ISeries[]>([]);

  // Daftar toko (hanya yang APPROVED) + Offline; default semua terpilih
  useEffect(() => {
    ApiService.get('/get/ecommerce')
      .then((response: any) => {
        const list: IStore[] = [{ id: 0, nama: 'Offline / Toko' }];
        if (response && response.status && Array.isArray(response.data)) {
          response.data
            .filter((e: any) => e.status === 'APPROVED')
            .forEach((e: any) => list.push({ id: e.id, nama: e.name || `${e.platform} #${e.id}` }));
        }
        setStores(list);
        setSelectedIds(list.map((s) => s.id));
      })
      .catch(console.error)
      .finally(() => setStoresLoaded(true));
  }, []);

  const colorOf = useCallback(
    (id: number) => COLORS[Math.max(0, stores.findIndex((s) => s.id === id)) % COLORS.length],
    [stores],
  );

  const fetchData = useCallback(async () => {
    if (!storesLoaded) return;
    if (selectedIds.length === 0) {
      setSeries([]);
      setPeriods([]);
      setErrorMsg(null);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const qs = [
        `start=${moment(dateStart).format('YYYY-MM-DD')}`,
        `end=${moment(dateEnd).format('YYYY-MM-DD')}`,
        `group=${group}`,
        `id_ecommerce=${selectedIds.join(',')}`,
        `include_kilat=${includeKilat ? 1 : 0}`,
        `use_fifo=${fifo ? 1 : 0}`,
      ].join('&');
      const response = await ApiService.get(`/get/laporan/labarugi/grafik?${qs}`);
      if (response && response.status && response.data) {
        setPeriods(response.data.periods || []);
        setSeries(response.data.series || []);
      } else {
        setSeries([]);
        setPeriods([]);
        setErrorMsg(response?.reason || 'Gagal memuat data grafik');
      }
    } catch (error: any) {
      console.error('Error fetching grafik laba rugi:', error);
      setErrorMsg(error?.message || 'Gagal memuat data grafik');
    } finally {
      setLoading(false);
    }
  }, [storesLoaded, selectedIds, dateStart, dateEnd, group, includeKilat, fifo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChangeGroup = (g: Group) => {
    if (g === group) return;
    setGroup(g);
    const preset = PRESETS[g].find((p) => p.id === DEFAULT_PRESET[g])!;
    const { start, end } = preset.getRange();
    setActivePreset(preset.id);
    setDateStart(start);
    setDateEnd(end);
  };

  const handleSelectPreset = (p: (typeof PRESETS)['day'][number]) => {
    const { start, end } = p.getRange();
    setActivePreset(p.id);
    setDateStart(start);
    setDateEnd(end);
  };

  const toggleStore = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSelected = stores.length > 0 && selectedIds.length === stores.length;

  const nameOf = useCallback(
    (s: ISeries) => stores.find((st) => st.id === s.id_ecommerce)?.nama || s.nama,
    [stores],
  );

  const totals = useMemo(() => {
    return periods.map((_, i) =>
      series.reduce(
        (acc, s) => {
          const p = s.points[i];
          if (!p) return acc;
          return {
            pendapatan: acc.pendapatan + p.pendapatan,
            biaya_pokok: acc.biaya_pokok + p.biaya_pokok,
            biaya_marketplace: acc.biaya_marketplace + p.biaya_marketplace,
            laba: acc.laba + p.laba,
          };
        },
        { pendapatan: 0, biaya_pokok: 0, biaya_marketplace: 0, laba: 0 } as IPoint,
      ),
    );
  }, [periods, series]);

  const chartHtml = useMemo(() => {
    const datasets: { label: string; data: number[]; color: string; dashed: boolean }[] = [];
    series
      .filter((s) => s.points.some((p) => p.pendapatan || p.biaya_pokok || p.biaya_marketplace || p.laba))
      .forEach((s) => {
        const color = colorOf(s.id_ecommerce);
        // Dua garis per toko, warna sama: omset (utuh) dan laba bersih (putus-putus)
        if (showOmset) datasets.push({ label: `${nameOf(s)} · Omset`, data: s.points.map((p) => p.pendapatan), color, dashed: false });
        if (showLaba) datasets.push({ label: `${nameOf(s)} · Laba`, data: s.points.map((p) => p.laba), color, dashed: true });
      });
    if (showTotal && series.length > 1) {
      if (showOmset) datasets.push({ label: 'Total · Omset', data: totals.map((t) => t.pendapatan), color: TOTAL_COLOR, dashed: false });
      if (showLaba) datasets.push({ label: 'Total · Laba', data: totals.map((t) => t.laba), color: TOTAL_COLOR, dashed: true });
    }
    return buildChartHtml(periods.map((p) => formatPeriodLabel(p, group)), datasets, compact);
  }, [series, periods, showOmset, showLaba, showTotal, totals, group, nameOf, colorOf, compact]);

  const grandTotal = totals.reduce(
    (acc, t) => ({
      pendapatan: acc.pendapatan + t.pendapatan,
      biaya_pokok: acc.biaya_pokok + t.biaya_pokok,
      biaya_marketplace: acc.biaya_marketplace + t.biaya_marketplace,
      laba: acc.laba + t.laba,
    }),
    { pendapatan: 0, biaya_pokok: 0, biaya_marketplace: 0, laba: 0 },
  );

  const sumSeries = (s: ISeries): IPoint =>
    s.points.reduce(
      (acc, p) => ({
        pendapatan: acc.pendapatan + p.pendapatan,
        biaya_pokok: acc.biaya_pokok + p.biaya_pokok,
        biaya_marketplace: acc.biaya_marketplace + p.biaya_marketplace,
        laba: acc.laba + p.laba,
      }),
      { pendapatan: 0, biaya_pokok: 0, biaya_marketplace: 0, laba: 0 },
    );

  const renderSumRow = (key: string, name: string, color: string, t: IPoint, isTotal: boolean) => (
    <View key={key} style={[styles.sumRow, isTotal && styles.sumTotalRow]}>
      <View style={styles.sumTop}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.sumName, isTotal && { fontWeight: 'bold' }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.sumLaba, t.laba < 0 ? styles.red : styles.green]} numberOfLines={1}>
          {compact ? shortCurrency(t.laba) : currency(t.laba)}
        </Text>
      </View>
      <View style={styles.sumCols}>
        {([['Pendapatan', t.pendapatan], ['Biaya Pokok', t.biaya_pokok], ['Biaya Mkt', t.biaya_marketplace]] as [string, number][]).map(
          ([label, value]) => (
            <View key={label} style={styles.sumCol}>
              <Text style={styles.sumColLabel}>{label}</Text>
              <Text style={styles.sumColValue} numberOfLines={1}>{shortCurrency(value)}</Text>
            </View>
          ),
        )}
      </View>
    </View>
  );

  return (
    <View>
      {/* Filter */}
      <View style={[styles.card, compact && styles.cardCompact]}>
        <Text style={styles.label}>Tampilkan per:</Text>
        <View style={styles.segment}>
          {(['day', 'month'] as Group[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.segmentBtn, group === g && styles.segmentBtnActive]}
              onPress={() => handleChangeGroup(g)}
            >
              <Text style={[styles.segmentText, group === g && styles.segmentTextActive]}>
                {g === 'day' ? 'Hari' : 'Bulan'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Periode:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {PRESETS[group].map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, activePreset === p.id && styles.chipActive]}
              onPress={() => handleSelectPreset(p)}
            >
              <Text style={[styles.chipText, activePreset === p.id && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
            <Ionicons name="calendar-outline" size={16} color="#4b5563" />
            <Text style={[styles.dateText, compact && styles.dateTextCompact]}>{moment(dateStart).format(compact ? 'DD MMM YY' : 'DD MMM YYYY')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateDivider}>-</Text>
          <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
            <Ionicons name="calendar-outline" size={16} color="#4b5563" />
            <Text style={[styles.dateText, compact && styles.dateTextCompact]}>{moment(dateEnd).format(compact ? 'DD MMM YY' : 'DD MMM YYYY')}</Text>
          </TouchableOpacity>
        </View>
        {showStartPicker && (
          <DateTimePicker
            value={dateStart}
            mode="date"
            display="default"
            onChange={(event: any, d?: Date) => {
              setShowStartPicker(false);
              if (event?.type !== 'dismissed' && d) {
                setDateStart(d);
                setActivePreset(null);
              }
            }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={dateEnd}
            mode="date"
            display="default"
            onChange={(event: any, d?: Date) => {
              setShowEndPicker(false);
              if (event?.type !== 'dismissed' && d) {
                setDateEnd(d);
                setActivePreset(null);
              }
            }}
          />
        )}

        <View style={styles.optionRow}>
          <Text style={[styles.label, { marginBottom: 0, marginRight: 8 }]}>Metode:</Text>
          <View style={styles.segment}>
            {([false, true] as boolean[]).map((isFifo) => (
              <TouchableOpacity
                key={String(isFifo)}
                style={[styles.segmentBtn, fifo === isFifo && styles.segmentBtnActive]}
                onPress={() => onChangeFifo(isFifo)}
              >
                <Text style={[styles.segmentText, fifo === isFifo && styles.segmentTextActive]}>
                  {isFifo ? 'FIFO' : 'Average'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.optionRow}>
          <Text style={[styles.label, { marginBottom: 0, flex: 1 }]}>Termasuk Pengiriman Kilat (Booking)</Text>
          <Switch
            value={includeKilat}
            onValueChange={onChangeKilat}
            trackColor={{ false: '#d1d5db', true: '#10b981' }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.storeHeader}>
          <Text style={styles.label}>Toko / Marketplace:</Text>
          <TouchableOpacity onPress={() => setSelectedIds(allSelected ? [] : stores.map((s) => s.id))}>
            <Text style={styles.linkText}>{allSelected ? 'Kosongkan' : 'Pilih semua'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.storeWrap}>
          {stores.map((s) => {
            const on = selectedIds.includes(s.id);
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.storeChip, on && { borderColor: colorOf(s.id), backgroundColor: '#f9fafb' }]}
                onPress={() => toggleStore(s.id)}
              >
                <View style={[styles.dot, { backgroundColor: on ? colorOf(s.id) : '#d1d5db' }]} />
                <Text style={[styles.storeChipText, on && styles.storeChipTextOn]} numberOfLines={1}>
                  {s.nama}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Grafik */}
      <View style={[styles.card, compact && styles.cardCompact]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.chip, showOmset && styles.chipActive]}
            onPress={() => (showLaba || !showOmset) && setShowOmset((v) => !v)}
          >
            <Text style={[styles.chipText, showOmset && styles.chipTextActive]}>— Omset (garis utuh)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, showLaba && styles.chipActive]}
            onPress={() => (showOmset || !showLaba) && setShowLaba((v) => !v)}
          >
            <Text style={[styles.chipText, showLaba && styles.chipTextActive]}>- - Laba Bersih (putus-putus)</Text>
          </TouchableOpacity>
        </ScrollView>
        {series.length > 1 && (
          <TouchableOpacity style={styles.totalToggle} onPress={() => setShowTotal((v) => !v)}>
            <Ionicons name={showTotal ? 'checkbox' : 'square-outline'} size={18} color="#059669" />
            <Text style={styles.totalToggleText}>Tampilkan garis Total (hitam)</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.chartBox, { height: chartHeight }]}>
          {loading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color="#059669" />
            </View>
          )}
          {selectedIds.length === 0 ? (
            <Text style={styles.emptyText}>Pilih minimal satu toko untuk menampilkan grafik.</Text>
          ) : errorMsg ? (
            <Text style={[styles.emptyText, { color: '#dc2626' }]}>{errorMsg}</Text>
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html: chartHtml }}
              style={styles.webview}
              javaScriptEnabled
              scrollEnabled={false}
              nestedScrollEnabled
            />
          )}
        </View>
        <Text style={styles.hint}>
          Omset = total penjualan toko. Laba Bersih = Omset − Biaya Pokok − Biaya Marketplace (admin, ongkir, voucher), sudah dikurangi retur.
          Beban operasional umum (gaji, sewa, dll.) tidak dipetakan ke toko, jadi tidak ikut di grafik ini.
        </Text>
      </View>

      {/* Ringkasan per toko */}
      {series.length > 0 && (
        <View style={[styles.card, compact && styles.cardCompact]}>
          <Text style={styles.sectionTitle}>Ringkasan Periode</Text>
          {series.map((s) => renderSumRow(String(s.id_ecommerce), nameOf(s), colorOf(s.id_ecommerce), sumSeries(s), false))}
          {series.length > 1 && renderSumRow('total', 'Total', TOTAL_COLOR, grandTotal, true)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 6, padding: 2, alignSelf: 'flex-start' },
  segmentBtn: { paddingVertical: 6, paddingHorizontal: 20, borderRadius: 4 },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  segmentText: { fontSize: 13, color: '#6b7280' },
  segmentTextActive: { color: '#111827', fontWeight: '600' },
  chip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#ecfdf5', borderColor: '#10b981' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#4b5563' },
  chipTextActive: { color: '#059669', fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dateText: { marginLeft: 8, fontSize: 14, color: '#374151' },
  dateTextCompact: { marginLeft: 6, fontSize: 13 },
  cardCompact: { padding: 12, marginBottom: 12 },
  dateDivider: { marginHorizontal: 12, fontWeight: 'bold', color: '#6b7280' },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  storeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 13, color: '#059669', fontWeight: '600', marginBottom: 8 },
  storeWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: '100%',
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  storeChipText: { fontSize: 13, color: '#9ca3af', flexShrink: 1 },
  storeChipTextOn: { color: '#111827', fontWeight: '500' },
  totalToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  totalToggleText: { marginLeft: 6, fontSize: 13, color: '#374151' },
  chartBox: { height: 300, marginTop: 12, position: 'relative', justifyContent: 'center' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', color: '#6b7280', fontSize: 13, paddingHorizontal: 16 },
  hint: { fontSize: 11, color: '#6b7280', marginTop: 8 },
  sectionTitle: { fontWeight: 'bold', fontSize: 15, color: '#1f2937', marginBottom: 8 },
  sumRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  sumTotalRow: { borderTopColor: '#e5e7eb', borderTopWidth: 1.5 },
  sumTop: { flexDirection: 'row', alignItems: 'center' },
  sumName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  sumLaba: { fontSize: 14, fontWeight: 'bold', marginLeft: 8, flexShrink: 0 },
  sumCols: { flexDirection: 'row', marginTop: 4, marginLeft: 16 },
  sumCol: { flex: 1 },
  sumColLabel: { fontSize: 10, color: '#9ca3af' },
  sumColValue: { fontSize: 12, color: '#4b5563', marginTop: 1 },
  green: { color: '#059669' },
  red: { color: '#dc2626' },
});
