import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Pressable,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import ApiService from '../../services/api';
import { useDeveloperMode } from '../../context/DeveloperModeContext';

const { width, height } = Dimensions.get('window');

// ==================== INTERFACES ====================
interface IPenaltyPoint {
  point: number;
  reason: string;
  create_time: number;
  type: number;
  punishment_name: string;
  punishment_tier: number;
  shop_name: string;
  shop_id: number;
}

interface IMetric {
  metric_name: string;
  current_period: number | null;
  last_period: number | null;
  unit: number; // 1: decimal, 2: %, 4: days
  target: {
    value: number;
    comparator: string;
  };
  shop_name: string;
  shop_id: number;
  overall_performance?: {
    rating: number;
    fulfillment_failed: number;
    listing_failed: number;
    custom_service_failed: number;
  };
}

interface Shop {
  id: number;
  platform: string;
  name: string;
  status: string;
}

// ==================== METADATA MAPS ====================
const METRIC_MAP: Record<string, { label: string; category: string; impact: string; desc: string }> = {
  late_shipment_rate: {
    label: 'Tingkat Keterlambatan Pengiriman Pesanan (LSR)',
    category: 'Pesanan Terselesaikan',
    impact: 'Poin Penalti',
    desc: 'Persentase pesanan yang diserahkan ke jasa kirim terlambat. Jaga agar tetap rendah untuk menghindari poin penalti.'
  },
  non_fulfillment_rate: {
    label: 'Tingkat Pesanan Tidak Terselesaikan (NFR)',
    category: 'Pesanan Terselesaikan',
    impact: 'Poin Penalti',
    desc: 'Persentase pesanan yang dibatalkan oleh sistem atau penjual. Pastikan stok selalu akurat dan proses pesanan tepat waktu.'
  },
  preparation_time: {
    label: 'Waktu Persiapan Toko (APT)',
    category: 'Pesanan Terselesaikan',
    impact: 'Poin Penalti',
    desc: 'Waktu rata-rata yang dibutuhkan untuk memproses dan mengirimkan pesanan. Usahakan di bawah target agar pengiriman cepat.'
  },
  response_rate: {
    label: 'Persentase Chat Dibalas (CRR)',
    category: 'Pelayanan Pembeli',
    impact: 'Kriteria Star',
    desc: 'Persentase pesan chat pembeli yang dibalas dalam waktu 12 jam. Pertahankan di atas 85% untuk memenuhi kualifikasi Star Seller.'
  },
  shop_rating: {
    label: 'Penilaian Toko',
    category: 'Pelayanan Pembeli',
    impact: 'Kriteria Star',
    desc: 'Rata-rata penilaian toko yang diberikan oleh pembeli berdasarkan ulasan bintang mereka. Minimal 4.70 untuk Star Seller.'
  },
  csat_rate: {
    label: 'Persentase Kepuasan Pembeli (CSAT)',
    category: 'Pelayanan Pembeli',
    impact: 'Kriteria Star',
    desc: 'Indikator kepuasan pelanggan secara keseluruhan berdasarkan survei layanan pasca pembelian.'
  },
  pre_order_listing_rate: {
    label: 'Persentase Produk Pre-order',
    category: 'Pelanggaran Produk',
    impact: 'Poin Penalti',
    desc: 'Persentase produk pre-order aktif di toko Anda. Usahakan di bawah 20% agar pembeli tidak menunggu terlalu lama.'
  },
  the_amount_of_pre_order_listing: {
    label: 'Jumlah Produk Pre-order',
    category: 'Pelanggaran Produk',
    impact: 'Poin Penalti',
    desc: 'Jumlah total produk pre-order aktif di toko Anda. Batasi jumlahnya sesuai peraturan Shopee.'
  },
  severe_listing_violations: {
    label: 'Pelanggaran Produk Berat',
    category: 'Pelanggaran Produk',
    impact: 'Poin Penalti',
    desc: 'Pelanggaran produk berat seperti produk terlarang, produk imitasi/palsu, atau manipulasi ulasan.'
  },
  other_listing_violations: {
    label: 'Pelanggaran Produk Lainnya',
    category: 'Pelanggaran Produk',
    impact: 'Poin Penalti',
    desc: 'Pelanggaran produk ringan lainnya seperti spam kata kunci pencarian atau kategori produk salah.'
  },
  prohibited_listings: {
    label: 'Produk yang Dilarang',
    category: 'Pelanggaran Produk',
    impact: 'Poin Penalti',
    desc: 'Jumlah produk yang dilarang dijual menurut regulasi Shopee atau hukum pemerintah.'
  },
  counterfeit_ip_infringement: {
    label: 'Pelanggaran Hak Kekayaan Intelektual',
    category: 'Pelanggaran Produk',
    impact: 'Poin Penalti',
    desc: 'Pelanggaran hak kekayaan intelektual (HAKI) seperti menjual produk tiruan atau menggunakan aset gambar hak cipta orang lain.'
  },
  spam_listings: {
    label: 'Spam Produk',
    category: 'Pelanggaran Produk',
    impact: 'Poin Penalti',
    desc: 'Spam produk seperti produk duplikat atau manipulasi harga dan deskripsi untuk menipu pembeli.'
  }
};

const CATEGORIES = ['Pesanan Terselesaikan', 'Pelanggaran Produk', 'Pelayanan Pembeli'];

export default function KesehatanTokoScreen() {
  const navigation = useNavigation();
  const { isDeveloperMode } = useDeveloperMode();
  const scrollViewRef = useRef<ScrollView>(null);

  // Layout References for scrolling
  const metricsLayoutY = useRef<number>(0);
  const penaltiesLayoutY = useRef<number>(0);

  // State Management
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | 'all'>('all');
  const [selectedShopName, setSelectedShopName] = useState<string>('Semua Toko');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [penaltyPoints, setPenaltyPoints] = useState<IPenaltyPoint[]>([]);
  const [metrics, setMetrics] = useState<IMetric[]>([]);
  
  // UI States
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [selectedMetricDetail, setSelectedMetricDetail] = useState<{ metric: IMetric; map: any } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'Pesanan Terselesaikan': false,
    'Pelanggaran Produk': false,
    'Pelayanan Pembeli': false
  });

  // Fetch Shopee Shops List
  const fetchShops = async () => {
    try {
      const res = await ApiService.get('/get/ecommerce');
      if (res.status && res.data) {
        const shopeeApproved = res.data.filter(
          (s: Shop) => s.status === 'APPROVED' && s.platform === 'SHOPEE'
        );
        setShops(shopeeApproved);
        if (shopeeApproved.length > 0) {
          // Default to first shop
          setSelectedShopId(shopeeApproved[0].id);
          setSelectedShopName(shopeeApproved[0].name);
          fetchHealthData(shopeeApproved[0].id);
        } else {
          setSelectedShopId('all');
          setSelectedShopName('Semua Toko');
          fetchHealthData('all');
        }
      }
    } catch (error) {
      console.error('[KesehatanToko] Error fetching shops:', error);
      fetchHealthData('all');
    }
  };

  // Fetch Health Data from Endpoint
  const fetchHealthData = async (shopId: number | 'all') => {
    setLoading(true);
    try {
      let url = `/get/ecommerce/kesehatan_toko/SHOPEE?shop_id=${shopId}`;
      const res = await ApiService.get(url);
      if (res.status && res.data) {
        setPenaltyPoints(res.data.penalty_points || []);
        setMetrics(res.data.performance_metrics || []);
      } else {
        Alert.alert('Gagal Memuat Data', res.reason || 'Terjadi kesalahan sistem backend.');
      }
    } catch (error) {
      console.error('[KesehatanToko] Error fetching health data:', error);
      Alert.alert('Error', 'Gagal terhubung ke server backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHealthData(selectedShopId);
    setRefreshing(false);
  };

  const handleSelectShop = (id: number | 'all', name: string) => {
    setSelectedShopId(id);
    setSelectedShopName(name);
    setShowShopSelector(false);
    fetchHealthData(id);
  };

  const toggleSection = (category: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // ==================== CALCULATION LOGIC ====================
  const isFailed = (current: number | null | undefined, target: { value: number; comparator: string }) => {
    if (current === null || current === undefined) return false;
    const curVal = parseFloat(current as any);
    const tarVal = parseFloat(target.value as any);
    switch (target.comparator) {
      case '<': return curVal >= tarVal;
      case '<=': return curVal > tarVal;
      case '>': return curVal <= tarVal;
      case '>=': return curVal < tarVal;
      default: return false;
    }
  };

  const formatValue = (value: number | null | undefined, unit: number, name: string) => {
    if (value === null || value === undefined) return '-';
    const val = parseFloat(value as any);
    if (unit === 2) return `${val.toFixed(2)}%`;
    if (unit === 4) return `${val.toFixed(2)} hari`;
    if (name === 'shop_rating') return `${val.toFixed(2)} / 5.0`;
    return val.toString();
  };

  const formatTarget = (target: { value: number; comparator: string }, unit: number) => {
    let comp = target.comparator;
    if (comp === '<=') comp = '≤';
    if (comp === '>=') comp = '≥';
    
    let valStr = target.value.toString();
    if (unit === 2) valStr = `${target.value}%`;
    if (unit === 4) valStr = `${target.value} hari`;
    
    return `${comp} ${valStr}`;
  };

  const totalPenaltyPoints = penaltyPoints.reduce((sum, p) => sum + (Number(p.point) || 0), 0);
  const failedMetrics = metrics.filter(m => isFailed(m.current_period, m.target));
  const failedCount = failedMetrics.length;

  // Health Status determination
  let healthStatus = 'Baik';
  let healthColors = {
    bg: '#ECFDF5', // Emerald 50
    border: '#A7F3D0', // Emerald 200
    text: '#059669', // Emerald 600
    dot: '#10B981' // Emerald 500
  };
  let healthMessage = 'Hebat! Semua metrik performa toko Anda berjalan dengan sangat baik.';

  if (failedCount > 0 || totalPenaltyPoints > 0) {
    if (totalPenaltyPoints >= 3 || failedCount >= 2) {
      healthStatus = 'Perlu Tindakan';
      healthColors = {
        bg: '#FFF1F2', // Rose 50
        border: '#FECDD3', // Rose 200
        text: '#E11D48', // Rose 600
        dot: '#F43F5E' // Rose 500
      };
      healthMessage = `${failedCount} metrik gagal dan memiliki ${totalPenaltyPoints} poin penalti. Cek rincian di bawah untuk memperbaiki performa toko.`;
    } else {
      healthStatus = 'Cukup';
      healthColors = {
        bg: '#FFFBEB', // Amber 50
        border: '#FDE68A', // Amber 200
        text: '#D97706', // Amber 600
        dot: '#F59E0B' // Amber 500
      };
      healthMessage = `${failedCount} metrik gagal mencapai target. Cek rincian di bawah untuk meningkatkan performa toko.`;
    }
  }

  // Helper to calculate pin position on progress bar (0 - 15 points max)
  const getPinLeftPercent = (points: number) => {
    if (points <= 0) return 0;
    if (points <= 3) return (points / 3) * 20; // 0% - 20%
    if (points <= 6) return 20 + ((points - 3) / 3) * 20; // 20% - 40%
    if (points <= 12) return 40 + ((points - 6) / 6) * 40; // 40% - 80%
    return Math.min(80 + ((points - 12) / 3) * 20, 100); // 80% - 100%
  };

  // Scroll triggers
  const scrollToMetrics = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: metricsLayoutY.current - 10, animated: true });
    }
  };

  const scrollToPenalties = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: penaltiesLayoutY.current - 10, animated: true });
    }
  };

  // Star Seller Criteria Calculations
  // Poin Penalti < 3
  const isStarPenaltyPassed = totalPenaltyPoints < 3;
  
  // Tingkat Chat Dibalas >= 85.00%
  const chatResponseMetric = metrics.find(m => m.metric_name === 'response_rate');
  const chatResponseVal = chatResponseMetric ? chatResponseMetric.current_period : null;
  const isStarChatPassed = chatResponseVal !== null ? chatResponseVal >= 85.00 : false;
  
  // Penilaian Toko >= 4.70
  const shopRatingMetric = metrics.find(m => m.metric_name === 'shop_rating');
  const shopRatingVal = shopRatingMetric ? shopRatingMetric.current_period : null;
  const isStarRatingPassed = shopRatingVal !== null ? shopRatingVal >= 4.70 : false;

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
      {/* ==================== FILTER TOOLBAR / HEADER ==================== */}
      <View style={styles.headerToolbar}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Kesehatan Toko</Text>
          <View style={styles.platformBadge}>
            <Text style={styles.platformBadgeText}>Shopee</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.shopSelectorBtn}
          onPress={() => setShowShopSelector(true)}
        >
          <Text style={styles.shopSelectorBtnText} numberOfLines={1}>
            {selectedShopName}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#4B5563" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EE4D2D" />
          <Text style={styles.loadingText}>Memuat skor kesehatan toko...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EE4D2D']} />
          }
        >
          {/* ==================== DYNAMIC HEALTH STATUS BANNER ==================== */}
          <View style={[styles.healthBanner, { backgroundColor: healthColors.bg, borderColor: healthColors.border }]}>
            <View style={styles.healthBannerHeader}>
              <View style={[styles.statusDot, { backgroundColor: healthColors.dot }]} />
              <Text style={[styles.statusTextLabel, { color: healthColors.text }]}>Status Toko:</Text>
              <Text style={[styles.statusTextValue, { color: healthColors.text }]}>{healthStatus}</Text>
            </View>
            <Text style={styles.healthBannerSubtext}>{healthMessage}</Text>
          </View>

          {/* ==================== CARD STATISTIK UTAMA (HORIZONTAL ROW) ==================== */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRow}
          >
            <TouchableOpacity style={styles.statsCard} onPress={scrollToMetrics}>
              <Text style={styles.statsCardTitle}>Performa Metrik</Text>
              <Text style={[styles.statsCardNumber, failedCount > 0 ? styles.textOrange : styles.textDark]}>
                {failedCount}
              </Text>
              <Text style={styles.statsCardSub}>Metrik gagal target</Text>
              <View style={styles.statsCardFooter}>
                <Text style={styles.statsCardFooterText}>Lihat Metrik</Text>
                <Ionicons name="arrow-forward" size={12} color="#EE4D2D" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statsCard} onPress={scrollToPenalties}>
              <Text style={styles.statsCardTitle}>Penalti Saya</Text>
              <Text style={[styles.statsCardNumber, totalPenaltyPoints > 0 ? styles.textRose : styles.textDark]}>
                {totalPenaltyPoints}
              </Text>
              <Text style={styles.statsCardSub}>Total poin penalti</Text>
              <View style={styles.statsCardFooter}>
                <Text style={styles.statsCardFooterText}>Lihat Riwayat</Text>
                <Ionicons name="arrow-forward" size={12} color="#EE4D2D" />
              </View>
            </TouchableOpacity>

            <View style={styles.statsCard}>
              <Text style={styles.statsCardTitle}>Banding Proses</Text>
              <Text style={[styles.statsCardNumber, styles.textDark]}>0</Text>
              <Text style={styles.statsCardSub}>Pengajuan banding aktif</Text>
              <View style={styles.statsCardFooterDisabled}>
                <Text style={styles.statsCardFooterTextDisabled}>Tidak ada banding</Text>
              </View>
            </View>
          </ScrollView>

          {/* ==================== KARTU TARGET PENJUAL STAR ==================== */}
          <LinearGradient
            colors={['#FFF8F0', '#FFF2E0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.starSellerCard}
          >
            <View style={styles.starSellerHeader}>
              <View style={styles.starSellerIconBg}>
                <Ionicons name="star" size={24} color="#D97706" />
              </View>
              <View style={styles.starSellerHeaderTextCol}>
                <Text style={styles.starSellerTitle}>Kriteria Penjual Star</Text>
                <Text style={styles.starSellerSubtitle}>
                  Skor minimum untuk mempertahankan status keanggotaan Star Seller Anda.
                </Text>
              </View>
            </View>

            <View style={styles.starCriteriaList}>
              <View style={styles.starCriteriaItem}>
                <Text style={styles.starCriteriaLabel}>Poin Penalti Kuartal</Text>
                <View style={styles.starCriteriaStatusContainer}>
                  <Ionicons
                    name={isStarPenaltyPassed ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={isStarPenaltyPassed ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[styles.starCriteriaVal, { color: isStarPenaltyPassed ? '#047857' : '#B91C1C' }]}>
                    {totalPenaltyPoints} Poin (Target &lt; 3)
                  </Text>
                </View>
              </View>

              <View style={styles.starCriteriaItem}>
                <Text style={styles.starCriteriaLabel}>Tingkat Chat Dibalas</Text>
                <View style={styles.starCriteriaStatusContainer}>
                  <Ionicons
                    name={isStarChatPassed ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={isStarChatPassed ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[styles.starCriteriaVal, { color: isStarChatPassed ? '#047857' : '#B91C1C' }]}>
                    {chatResponseVal !== null ? `${chatResponseVal.toFixed(2)}%` : '-'} (Target ≥ 85.00%)
                  </Text>
                </View>
              </View>

              <View style={styles.starCriteriaItem}>
                <Text style={styles.starCriteriaLabel}>Penilaian Toko</Text>
                <View style={styles.starCriteriaStatusContainer}>
                  <Ionicons
                    name={isStarRatingPassed ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={isStarRatingPassed ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[styles.starCriteriaVal, { color: isStarRatingPassed ? '#047857' : '#B91C1C' }]}>
                    {shopRatingVal !== null ? `${shopRatingVal.toFixed(2)} / 5.0` : '-'} (Target ≥ 4.70)
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.learnMoreBtn}
              onPress={() => Alert.alert('Kriteria Star Seller', 'Program Star Seller mengapresiasi penjual dengan performa toko dan pelayanan pelanggan yang sangat baik. Untuk bergabung, toko Anda harus memelihara performa yang memenuhi kriteria di atas secara konsisten.')}
            >
              <Text style={styles.learnMoreBtnText}>Pelajari Kriteria</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* ==================== PROGRESS BAR AKUMULASI POIN PENALTI ==================== */}
          <View
            onLayout={(event) => {
              penaltiesLayoutY.current = event.nativeEvent.layout.y;
            }}
            style={styles.penaltySectionCard}
          >
            <View style={styles.penaltySectionHeader}>
              <Text style={styles.sectionHeading}>Poin Penalti Kuartal Ini</Text>
              <Text style={styles.sectionSubHeading}>
                Penalti poin disesuaikan setiap hari Senin minggu pertama kuartal baru.
              </Text>
            </View>

            <View style={styles.penaltyProgressWrapper}>
              <View style={styles.pointsDisplay}>
                <Text style={styles.bigPointsNum}>{totalPenaltyPoints}</Text>
                <Text style={styles.bigPointsLabel}>poin penalti</Text>
              </View>

              {/* Progress Bar with Ticks & Pin */}
              <View style={styles.progressBarContainer}>
                {/* Visual segmented bar */}
                <View style={styles.barSegmentsRow}>
                  {/* Segment 1: Green 0-3 (20%) */}
                  <View style={[styles.barSegment, { width: '20%', backgroundColor: '#10B981', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
                  {/* Segment 2: Yellow 3-6 (20%) */}
                  <View style={[styles.barSegment, { width: '20%', backgroundColor: '#F59E0B' }]} />
                  {/* Segment 3: Orange 6-12 (40%) */}
                  <View style={[styles.barSegment, { width: '40%', backgroundColor: '#EF6C00' }]} />
                  {/* Segment 4: Red 12-15+ (20%) */}
                  <View style={[styles.barSegment, { width: '20%', backgroundColor: '#EF4444', borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
                </View>

                {/* Pointer Pin (Proportional Left) */}
                <View
                  style={[
                    styles.pointerPin,
                    { left: `${getPinLeftPercent(totalPenaltyPoints)}%` }
                  ]}
                >
                  <View style={styles.pointerCircleOuter}>
                    <View style={styles.pointerCircleInner} />
                  </View>
                </View>

                {/* Ticks underneath */}
                <View style={styles.ticksRow}>
                  <Text style={styles.tickText}>0</Text>
                  <Text style={styles.tickText}>3</Text>
                  <Text style={styles.tickText}>6</Text>
                  <Text style={styles.tickText}>12</Text>
                  <Text style={styles.tickText}>15+</Text>
                </View>
              </View>

              <View style={styles.warningNoteRow}>
                <Ionicons name="warning-outline" size={16} color="#D97706" style={styles.warningNoteIcon} />
                <Text style={styles.warningNoteText}>
                  Toko yang mencapai ≥ 3 poin penalti akan mendapatkan pemblokiran fitur promosi dan pembatasan operasional bertahap.
                </Text>
              </View>
            </View>

            {/* ==================== LIST PENALTI AKTIF ==================== */}
            <View style={styles.activePenaltiesSection}>
              <Text style={styles.subSectionHeading}>Penalti yang Sedang Berjalan</Text>

              {penaltyPoints.length === 0 ? (
                <View style={styles.noPenaltiesCard}>
                  <View style={styles.thumbIconBg}>
                    <Ionicons name="thumbs-up" size={28} color="#10B981" />
                  </View>
                  <Text style={styles.noPenaltiesTitle}>Hebat! Tidak Ada Penalti Aktif</Text>
                  <Text style={styles.noPenaltiesSub}>
                    Toko Anda bersih dari penalti kuartal berjalan. Pertahankan kinerja luar biasa ini!
                  </Text>
                </View>
              ) : (
                <View style={styles.penaltyListContainer}>
                  {penaltyPoints.map((penalty, index) => (
                    <View key={index} style={styles.penaltyItemCard}>
                      <View style={styles.penaltyItemLeft}>
                        <View style={styles.penaltyBadge}>
                          <Text style={styles.penaltyBadgeText}>{penalty.point} Poin</Text>
                        </View>
                        <Text style={styles.penaltyReason} numberOfLines={2}>
                          {penalty.reason}
                        </Text>
                        {penalty.punishment_name ? (
                          <Text style={styles.punishmentApplied}>
                            Hukuman: {penalty.punishment_name}
                          </Text>
                        ) : null}
                        <View style={styles.penaltyMetaRow}>
                          <Text style={styles.penaltyMetaText}>Toko: {penalty.shop_name}</Text>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.penaltyMetaText}>
                            Tanggal: {moment(penalty.create_time * 1000).format('DD MMM YYYY')}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.appealBtn}
                        onPress={() => Alert.alert('Banding Penalti', `Mengajukan banding untuk pelanggaran: "${penalty.reason}". Silakan siapkan dokumen bukti pendukung di portal Seller Centre.`)}
                      >
                        <Text style={styles.appealBtnText}>Banding</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* ==================== TABEL METRIK KINERJA (COLLAPSIBLE ACCORDIONS) ==================== */}
          <View
            onLayout={(event) => {
              metricsLayoutY.current = event.nativeEvent.layout.y;
            }}
            style={styles.metricsContainerCard}
          >
            <View style={styles.metricsHeader}>
              <Text style={styles.sectionHeading}>Metrik Kinerja & Kesehatan Toko</Text>
              <Text style={styles.sectionSubHeading}>
                Rincian parameter operasional berdasarkan data live Shopee Performance Center.
              </Text>
            </View>

            {CATEGORIES.map((category) => {
              // Filter metrics in this category
              const catMetrics = metrics.filter(m => {
                const map = METRIC_MAP[m.metric_name];
                return map && map.category === category;
              });

              if (catMetrics.length === 0) return null;
              const isCollapsed = collapsedSections[category];

              return (
                <View key={category} style={styles.accordionContainer}>
                  {/* Category Header (Tap to Expand/Collapse) */}
                  <TouchableOpacity
                    style={styles.accordionHeader}
                    onPress={() => toggleSection(category)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.accordionTitle}>{category}</Text>
                    <Ionicons
                      name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>

                  {/* Collapsible Content */}
                  {!isCollapsed && (
                    <View style={styles.accordionContent}>
                      {catMetrics.map((metric, index) => {
                        const mapInfo = METRIC_MAP[metric.metric_name];
                        const isMetricFailed = isFailed(metric.current_period, metric.target);

                        return (
                          <View key={index} style={styles.metricRow}>
                            <View style={styles.metricRowLeftCol}>
                              <Text style={styles.metricLabel}>
                                {mapInfo?.label || metric.metric_name}
                              </Text>
                              {selectedShopId === 'all' && (
                                <View style={styles.metricShopLabelContainer}>
                                  <Text style={styles.metricShopLabel}>Toko: {metric.shop_name}</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.metricStatsGrid}>
                              {/* Current Period */}
                              <View style={styles.metricCol}>
                                <Text style={styles.metricSubLabel}>Sekarang</Text>
                                <View style={styles.currentValWithIcon}>
                                  <Ionicons
                                    name={isMetricFailed ? 'close-circle-sharp' : 'checkmark-circle-sharp'}
                                    size={14}
                                    color={isMetricFailed ? '#EF4444' : '#10B981'}
                                    style={styles.statusIcon}
                                  />
                                  <Text style={[styles.metricMainValue, isMetricFailed ? styles.textRose : styles.textEmerald]}>
                                    {formatValue(metric.current_period, metric.unit, metric.metric_name)}
                                  </Text>
                                </View>
                              </View>

                              {/* Target */}
                              <View style={styles.metricCol}>
                                <Text style={styles.metricSubLabel}>Target</Text>
                                <Text style={styles.metricTargetVal}>
                                  {formatTarget(metric.target, metric.unit)}
                                </Text>
                              </View>

                              {/* Action Detail */}
                              <TouchableOpacity
                                style={styles.rowDetailBtn}
                                onPress={() => setSelectedMetricDetail({ metric, map: mapInfo })}
                              >
                                <Text style={styles.rowDetailBtnText}>Detail</Text>
                                <Ionicons name="chevron-forward" size={14} color="#EE4D2D" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ==================== MODAL SHOP SELECTOR ==================== */}
      <Modal
        visible={showShopSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShopSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBgPressable} onPress={() => setShowShopSelector(false)} />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Pilih Toko Shopee</Text>
              <TouchableOpacity onPress={() => setShowShopSelector(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.bottomSheetList}>
              <TouchableOpacity
                style={[
                  styles.bottomSheetItem,
                  selectedShopId === 'all' && styles.bottomSheetItemActive
                ]}
                onPress={() => handleSelectShop('all', 'Semua Toko')}
              >
                <View style={styles.bottomSheetItemLeft}>
                  <Ionicons
                    name="grid"
                    size={20}
                    color={selectedShopId === 'all' ? '#EE4D2D' : '#6B7280'}
                  />
                  <Text style={[
                    styles.bottomSheetItemText,
                    selectedShopId === 'all' && styles.bottomSheetItemTextActive
                  ]}>
                    Semua Toko ({shops.length})
                  </Text>
                </View>
                {selectedShopId === 'all' && (
                  <Ionicons name="checkmark" size={20} color="#EE4D2D" />
                )}
              </TouchableOpacity>

              {shops.map((shop) => (
                <TouchableOpacity
                  key={shop.id}
                  style={[
                    styles.bottomSheetItem,
                    selectedShopId === shop.id && styles.bottomSheetItemActive
                  ]}
                  onPress={() => handleSelectShop(shop.id, shop.name)}
                >
                  <View style={styles.bottomSheetItemLeft}>
                    <Ionicons
                      name="storefront-outline"
                      size={20}
                      color={selectedShopId === shop.id ? '#EE4D2D' : '#6B7280'}
                    />
                    <Text style={[
                      styles.bottomSheetItemText,
                      selectedShopId === shop.id && styles.bottomSheetItemTextActive
                    ]}>
                      {shop.name}
                    </Text>
                  </View>
                  {selectedShopId === shop.id && (
                    <Ionicons name="checkmark" size={20} color="#EE4D2D" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL METRIC DETAIL ==================== */}
      <Modal
        visible={selectedMetricDetail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMetricDetail(null)}
      >
        <View style={styles.metricDetailOverlay}>
          <Pressable style={styles.modalBgPressable} onPress={() => setSelectedMetricDetail(null)} />
          <View style={styles.metricDetailCard}>
            <View style={styles.metricDetailHeader}>
              <Text style={styles.metricDetailTitle}>
                {selectedMetricDetail?.map?.label || selectedMetricDetail?.metric?.metric_name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedMetricDetail(null)}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.metricDetailBody}>
              <Text style={styles.detailSectionLabel}>Deskripsi Metrik:</Text>
              <Text style={styles.detailSectionDesc}>
                {selectedMetricDetail?.map?.desc || 'Tidak tersedia penjelasan tambahan untuk metrik ini.'}
              </Text>

              <View style={styles.detailStatsBlock}>
                <View style={styles.detailStatItem}>
                  <Text style={styles.detailStatLabel}>Nilai Saat Ini</Text>
                  <Text
                    style={[
                      styles.detailStatVal,
                      selectedMetricDetail?.metric &&
                      isFailed(selectedMetricDetail.metric.current_period, selectedMetricDetail.metric.target)
                        ? styles.textRose
                        : styles.textEmerald
                    ]}
                  >
                    {selectedMetricDetail &&
                      formatValue(
                        selectedMetricDetail.metric.current_period,
                        selectedMetricDetail.metric.unit,
                        selectedMetricDetail.metric.metric_name
                      )}
                  </Text>
                </View>

                <View style={styles.detailStatItem}>
                  <Text style={styles.detailStatLabel}>Batas Target</Text>
                  <Text style={styles.detailStatValDark}>
                    {selectedMetricDetail &&
                      formatTarget(selectedMetricDetail.metric.target, selectedMetricDetail.metric.unit)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailMetaInfo}>
                <View style={styles.detailMetaRow}>
                  <Text style={styles.detailMetaLabel}>Kategori:</Text>
                  <Text style={styles.detailMetaVal}>{selectedMetricDetail?.map?.category}</Text>
                </View>
                <View style={styles.detailMetaRow}>
                  <Text style={styles.detailMetaLabel}>Berdampak Pada:</Text>
                  <Text style={styles.detailMetaValAccent}>{selectedMetricDetail?.map?.impact}</Text>
                </View>
                <View style={styles.detailMetaRow}>
                  <Text style={styles.detailMetaLabel}>Toko:</Text>
                  <Text style={styles.detailMetaVal}>{selectedMetricDetail?.metric?.shop_name}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.detailCloseBtn}
              onPress={() => setSelectedMetricDetail(null)}
            >
              <Text style={styles.detailCloseBtnText}>Tutup Rincian</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  headerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 }
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  platformBadge: {
    marginLeft: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  platformBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280'
  },
  shopSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    maxWidth: width * 0.45
  },
  shopSelectorBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginRight: 4
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  },
  healthBanner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  },
  healthBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  statusTextLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  statusTextValue: {
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 6
  },
  healthBannerSubtext: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
    fontWeight: '500'
  },
  statsRow: {
    paddingRight: 16,
    marginBottom: 16,
    flexDirection: 'row'
  },
  statsCard: {
    width: width * 0.35,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  statsCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  statsCardNumber: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4
  },
  statsCardSub: {
    fontSize: 10,
    color: '#9CA3AF',
    lineHeight: 14,
    height: 28
  },
  statsCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    marginTop: 8
  },
  statsCardFooterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EE4D2D',
    marginRight: 4
  },
  statsCardFooterDisabled: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  statsCardFooterTextDisabled: {
    fontSize: 11,
    fontWeight: '500',
    color: '#D1D5DB'
  },
  textOrange: { color: '#EE4D2D' },
  textRose: { color: '#EF4444' },
  textEmerald: { color: '#10B981' },
  textDark: { color: '#111827' },
  starSellerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2'
  },
  starSellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  starSellerIconBg: {
    width: 44,
    height: 44,
    backgroundColor: '#FEF3C7',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  },
  starSellerHeaderTextCol: {
    marginLeft: 12,
    flex: 1
  },
  starSellerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  starSellerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 14,
    marginTop: 1
  },
  starCriteriaList: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 215, 170, 0.3)',
    marginBottom: 12
  },
  starCriteriaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6
  },
  starCriteriaLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500'
  },
  starCriteriaStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  starCriteriaVal: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4
  },
  learnMoreBtn: {
    borderWidth: 1,
    borderColor: '#EE4D2D',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  learnMoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EE4D2D'
  },
  penaltySectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  },
  penaltySectionHeader: {
    marginBottom: 16
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  sectionSubHeading: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 14
  },
  penaltyProgressWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    marginBottom: 16
  },
  pointsDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12
  },
  bigPointsNum: {
    fontSize: 36,
    fontWeight: '900',
    color: '#EF4444'
  },
  bigPointsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 6
  },
  progressBarContainer: {
    position: 'relative',
    marginVertical: 12
  },
  barSegmentsRow: {
    height: 10,
    flexDirection: 'row',
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB'
  },
  barSegment: {
    height: '100%'
  },
  pointerPin: {
    position: 'absolute',
    top: -4,
    width: 18,
    height: 18,
    transform: [{ translateX: -9 }],
    justifyContent: 'center',
    alignItems: 'center'
  },
  pointerCircleOuter: {
    width: 18,
    height: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  },
  pointerCircleInner: {
    width: 8,
    height: 8,
    backgroundColor: '#EF4444',
    borderRadius: 4
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 6
  },
  tickText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF'
  },
  warningNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8
  },
  warningNoteIcon: {
    marginTop: 2
  },
  warningNoteText: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
    marginLeft: 6,
    flex: 1
  },
  activePenaltiesSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    marginTop: 8
  },
  subSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12
  },
  noPenaltiesCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5'
  },
  thumbIconBg: {
    width: 52,
    height: 52,
    backgroundColor: '#D1FAE5',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  noPenaltiesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46'
  },
  noPenaltiesSub: {
    fontSize: 11,
    color: '#047857',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
    paddingHorizontal: 8
  },
  penaltyListContainer: {
    gap: 12
  },
  penaltyItemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  penaltyItemLeft: {
    flex: 1,
    paddingRight: 8
  },
  penaltyBadge: {
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6
  },
  penaltyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444'
  },
  penaltyReason: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 16
  },
  punishmentApplied: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
    marginTop: 4
  },
  penaltyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  penaltyMetaText: {
    fontSize: 10,
    color: '#6B7280'
  },
  metaDot: {
    fontSize: 10,
    color: '#9CA3AF',
    marginHorizontal: 6
  },
  appealBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EE4D2D'
  },
  appealBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EE4D2D'
  },
  metricsContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 16,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  },
  metricsHeader: {
    paddingHorizontal: 16,
    marginBottom: 12
  },
  accordionContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB'
  },
  accordionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  accordionContent: {
    backgroundColor: '#FFFFFF'
  },
  metricRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  metricRowLeftCol: {
    marginBottom: 10
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 18
  },
  metricShopLabelContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4
  },
  metricShopLabel: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '500'
  },
  metricStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  metricCol: {
    flex: 1
  },
  metricSubLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 2
  },
  currentValWithIcon: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusIcon: {
    marginRight: 4
  },
  metricMainValue: {
    fontSize: 13,
    fontWeight: '800'
  },
  metricTargetVal: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600'
  },
  rowDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFF5F5'
  },
  rowDetailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EE4D2D',
    marginRight: 2
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end'
  },
  modalBgPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.6,
    paddingTop: 16,
    paddingBottom: 24,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: -3 }
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  bottomSheetList: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  bottomSheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 4
  },
  bottomSheetItemActive: {
    backgroundColor: '#FFF5F5'
  },
  bottomSheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  bottomSheetItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginLeft: 12
  },
  bottomSheetItemTextActive: {
    color: '#EE4D2D',
    fontWeight: '700'
  },
  metricDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  metricDetailCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 }
  },
  metricDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
    marginBottom: 16
  },
  metricDetailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    paddingRight: 8
  },
  metricDetailBody: {
    marginBottom: 20
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  detailSectionDesc: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 16
  },
  detailStatsBlock: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
    marginBottom: 16
  },
  detailStatItem: {
    flex: 1
  },
  detailStatLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4
  },
  detailStatVal: {
    fontSize: 18,
    fontWeight: '800'
  },
  detailStatValDark: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827'
  },
  detailMetaInfo: {
    gap: 8
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailMetaLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 100
  },
  detailMetaVal: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600'
  },
  detailMetaValAccent: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '700'
  },
  detailCloseBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
