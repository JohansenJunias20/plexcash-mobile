import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Animated,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import ApiService from '../../services/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'saldo' | 'riwayat' | 'topup';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  final_balance: number;
  created_at: string;
  date: string;
  status: string;
  payment_method: string | null;
  payment_id: string | null;
}

interface BalanceData {
  balance: number;
  last_topup?: string;
}

interface PriceData {
  price: number;
  fee_type: 'fixed' | 'progressive';
}

interface ProgressiveCalcData {
  order_count: number;
  applicable_tier: { min_orders: number; max_orders: number | null; price: number } | null;
  total_fee: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getBalanceTotal = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
    if (val.total !== undefined) return Number(val.total);
    if (val.balance !== undefined) return Number(val.balance);
  }
  return Number(val) || 0;
};

const formatRupiah = (rawValue: any): string => {
  const value = getBalanceTotal(rawValue);
  if (value === null || value === undefined || isNaN(value)) return 'Rp –';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatRupiahInput = (rawValue: any): string => {
  const value = getBalanceTotal(rawValue);
  if (value === null || value === undefined || isNaN(value)) return '';
  if (value === 0) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

const parseRupiahInput = (raw: string): number => {
  const cleaned = raw.replace(/[^\d]/g, '');
  return parseInt(cleaned || '0', 10);
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '–';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '–';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTransactionColor = (type: string, amount: number) => {
  const t = type.toLowerCase();
  if (t === 'top_up' || amount > 0) return { bg: '#D1FAE5', icon: '#059669', text: '#065F46' };
  if (t === 'subscription_payment' || t === 'withdrawal') return { bg: '#FEE2E2', icon: '#DC2626', text: '#991B1B' };
  if (t === 'refund') return { bg: '#DBEAFE', icon: '#2563EB', text: '#1E40AF' };
  return { bg: '#F3F4F6', icon: '#6B7280', text: '#374151' };
};

const getTransactionIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'top_up') return 'arrow-down-circle';
  if (t === 'subscription_payment') return 'calendar';
  if (t === 'withdrawal') return 'arrow-up-circle';
  if (t === 'refund') return 'refresh-circle';
  if (t === 'adjustment') return 'settings';
  return 'swap-horizontal';
};

const getTransactionLabel = (type: string) => {
  const map: Record<string, string> = {
    top_up: 'Top Up',
    subscription_payment: 'Pembayaran Langganan',
    withdrawal: 'Penarikan',
    refund: 'Refund',
    adjustment: 'Penyesuaian',
  };
  return map[type.toLowerCase()] || type;
};

// ─── Balance Tab ───────────────────────────────────────────────────────────────

interface BalanceTabProps {
  balance: BalanceData | null;
  priceData: PriceData | null;
  progCalc: ProgressiveCalcData | null;
  loading: boolean;
}

const BalanceTab: React.FC<BalanceTabProps> = ({ balance, priceData, progCalc, loading }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Memuat saldo...</Text>
      </View>
    );
  }

  const currentBalance = balance?.balance ?? null;
  const isLow = currentBalance !== null && currentBalance < 50000;

  return (
    <Animated.ScrollView
      style={{ opacity: fadeAnim }}
      contentContainerStyle={styles.tabScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Main Balance Card */}
      <LinearGradient
        colors={isLow ? ['#DC2626', '#B91C1C'] : ['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceGradient}
      >
        <Text style={styles.balanceCardLabel}>Saldo Akun Anda</Text>
        <Text style={styles.balanceAmount}>{formatRupiah(currentBalance)}</Text>
        {isLow && currentBalance !== null && (
          <View style={styles.lowBalanceWarn}>
            <Ionicons name="warning" size={14} color="#FEF3C7" />
            <Text style={styles.lowBalanceText}>Saldo menipis! Segera lakukan top up.</Text>
          </View>
        )}
      </LinearGradient>

      {/* Subscription Package */}
      {priceData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAKET LANGGANAN AKTIF</Text>
          <View style={styles.infoCard}>
            <View style={styles.packageRow}>
              <View style={styles.packageIconWrap}>
                <Ionicons
                  name={priceData.fee_type === 'progressive' ? 'trending-up' : 'remove-circle'}
                  size={22}
                  color="#6366F1"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.packageType}>
                  {priceData.fee_type === 'progressive' ? 'Progressive Tier' : 'Fixed / Flat'}
                </Text>
                {priceData.fee_type === 'fixed' && (
                  <Text style={styles.packagePrice}>{formatRupiah(priceData.price)} / bulan</Text>
                )}
                {priceData.fee_type === 'progressive' && (
                  <Text style={styles.packagePrice}>Berbasis jumlah order</Text>
                )}
              </View>
            </View>

            {/* Progressive calculation if applicable */}
            {priceData.fee_type === 'progressive' && progCalc && (
              <>
                <View style={styles.infoSeparator} />
                <View style={styles.progCalcRow}>
                  <View style={styles.progCalcItem}>
                    <Text style={styles.progCalcLabel}>Order Bulan Ini</Text>
                    <Text style={styles.progCalcValue}>
                      {typeof progCalc.order_count === 'object' && progCalc.order_count !== null 
                        ? (progCalc.order_count as any).total || 0 
                        : progCalc.order_count} order
                    </Text>
                  </View>
                  <View style={styles.progCalcDivider} />
                  <View style={styles.progCalcItem}>
                    <Text style={styles.progCalcLabel}>Estimasi Tagihan</Text>
                    <Text style={[styles.progCalcValue, { color: '#DC2626' }]}>
                      {formatRupiah(progCalc.total_fee)}
                    </Text>
                  </View>
                </View>
                {progCalc.applicable_tier && (
                  <View style={styles.progTierNote}>
                    <Ionicons name="layers" size={13} color="#6366F1" />
                    <Text style={styles.progTierNoteText}>
                      Tier aktif: {progCalc.applicable_tier.min_orders}–
                      {progCalc.applicable_tier.max_orders ?? '∞'} order
                      ({formatRupiah(progCalc.applicable_tier.price)})
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* Info billing */}
      <View style={styles.billingNote}>
        <Ionicons name="information-circle-outline" size={16} color="#6366F1" />
        <Text style={styles.billingNoteText}>
          Saldo akan dipotong secara otomatis setiap awal bulan sesuai paket langganan Anda. Pastikan saldo selalu mencukupi.
        </Text>
      </View>

      <View style={{ height: 32 }} />
    </Animated.ScrollView>
  );
};

// ─── Transaction Row ───────────────────────────────────────────────────────────

const TransactionRow: React.FC<{ item: Transaction }> = ({ item }) => {
  const colors = getTransactionColor(item.type, item.amount);
  const isCredit = item.amount > 0;

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: colors.bg }]}>
        <Ionicons name={getTransactionIcon(item.type) as any} size={20} color={colors.icon} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txLabel}>{getTransactionLabel(item.type)}</Text>
        <Text style={styles.txDesc} numberOfLines={1}>{item.description || '–'}</Text>
        <Text style={styles.txDate}>{formatDate(item.date || item.created_at)}</Text>
      </View>
      <View style={styles.txAmountWrap}>
        <Text style={[styles.txAmount, { color: isCredit ? '#059669' : '#DC2626' }]}>
          {isCredit ? '+' : ''}{formatRupiah(item.amount)}
        </Text>
        <Text style={styles.txFinalBalance}>{formatRupiah(item.final_balance)}</Text>
        {item.status && item.status !== 'completed' && (
          <View style={styles.txStatusBadge}>
            <Text style={styles.txStatusText}>{item.status.toUpperCase()}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ─── History Tab ───────────────────────────────────────────────────────────────

interface HistoryTabProps {
  transactions: Transaction[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({ transactions, loading, refreshing, onRefresh }) => {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Memuat riwayat...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => <TransactionRow item={item} />}
      contentContainerStyle={styles.txList}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#6366F1']}
          tintColor="#6366F1"
        />
      }
      ItemSeparatorComponent={() => <View style={styles.txSeparator} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
          <Text style={styles.emptySubtitle}>
            Riwayat transaksi Anda akan muncul di sini setelah ada aktivitas.
          </Text>
        </View>
      }
    />
  );
};

// ─── Top Up Tab ────────────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000];

interface TopUpTabProps {
  currentBalance: number | null;
  onTopUpSuccess: () => void;
}

const TopUpTab: React.FC<TopUpTabProps> = ({ currentBalance, onTopUpSuccess }) => {
  const [amount, setAmount] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleAmountChange = (text: string) => {
    const raw = parseRupiahInput(text);
    setAmountRaw(raw);
    setAmount(formatRupiahInput(raw));
  };

  const selectQuickAmount = (val: number) => {
    setAmountRaw(val);
    setAmount(formatRupiahInput(val));
  };

  const handleTopUp = async () => {
    if (amountRaw < 10000) {
      Alert.alert('Nominal Tidak Valid', 'Minimal top up adalah Rp 10.000');
      return;
    }
    if (amountRaw > 100000000) {
      Alert.alert('Nominal Terlalu Besar', 'Maksimal top up adalah Rp 100.000.000 per transaksi');
      return;
    }

    setLoading(true);
    try {
      const res = await ApiService.createTopUp(amountRaw);
      if (res.status && res.data?.payment_url) {
        const url = res.data.payment_url;

        Alert.alert(
          'Lanjutkan Pembayaran',
          `Top up ${formatRupiah(amountRaw)} akan diproses melalui Xendit. Anda akan diarahkan ke halaman pembayaran.`,
          [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Bayar Sekarang',
              onPress: async () => {
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                  await Linking.openURL(url);
                  // After returning, prompt to verify
                  setTimeout(() => {
                    Alert.alert(
                      'Verifikasi Pembayaran',
                      'Sudah menyelesaikan pembayaran? Tekan "Verifikasi" untuk memperbarui saldo Anda.',
                      [
                        { text: 'Nanti', style: 'cancel' },
                        {
                          text: 'Verifikasi Saldo',
                          onPress: () => {
                            onTopUpSuccess();
                          },
                        },
                      ]
                    );
                  }, 2000);
                } else {
                  Alert.alert('Error', 'Tidak dapat membuka browser. Silakan coba lagi.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Gagal', res.reason || 'Gagal membuat tagihan top up. Coba lagi.');
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.tabScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Current Balance Mini Card */}
      <View style={styles.miniBalanceCard}>
        <View style={styles.miniBalanceLeft}>
          <Ionicons name="wallet" size={20} color="#6366F1" />
          <Text style={styles.miniBalanceLabel}>Saldo saat ini</Text>
        </View>
        <Text style={styles.miniBalanceValue}>{formatRupiah(currentBalance)}</Text>
      </View>

      {/* Input Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOMINAL TOP UP</Text>

        {/* Quick amounts */}
        <View style={styles.quickAmountsGrid}>
          {QUICK_AMOUNTS.map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.quickChip, amountRaw === val && styles.quickChipActive]}
              onPress={() => selectQuickAmount(val)}
            >
              <Text style={[styles.quickChipText, amountRaw === val && styles.quickChipTextActive]}>
                {formatRupiah(val)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom amount input */}
        <View style={styles.inputWithPrefix}>
          <Text style={styles.inputPrefix}>Rp</Text>
          <TextInput
            style={styles.topupInput}
            placeholder="Nominal lain..."
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={amount}
            onChangeText={handleAmountChange}
          />
        </View>

        {amountRaw > 0 && amountRaw < 10000 && (
          <Text style={styles.inputHintError}>Minimal top up Rp 10.000</Text>
        )}
        {amountRaw >= 10000 && (
          <Text style={styles.inputHintOk}>
            Anda akan top up sebesar {formatRupiah(amountRaw)}
          </Text>
        )}
      </View>

      {/* Xendit payment info */}
      <View style={styles.paymentInfoCard}>
        <View style={styles.paymentInfoRow}>
          <Ionicons name="shield-checkmark" size={18} color="#059669" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.paymentInfoTitle}>Pembayaran aman via Xendit</Text>
            <Text style={styles.paymentInfoDesc}>
              Mendukung transfer bank, virtual account, QRIS, dan kartu kredit. Saldo dikreditkan otomatis setelah pembayaran berhasil.
            </Text>
          </View>
        </View>
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[
          styles.btnTopUp,
          (amountRaw < 10000 || loading) && styles.btnTopUpDisabled,
        ]}
        onPress={handleTopUp}
        disabled={amountRaw < 10000 || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
            <Text style={styles.btnTopUpText}>Lanjutkan Pembayaran</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────

interface Props {
  navigation?: any;
}

const MySubscriptionScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('saldo');

  // Data state
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [progCalc, setProgCalc] = useState<ProgressiveCalcData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentDbName, setCurrentDbName] = useState<string>('');

  // Loading state per tab
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  // ── Tab indicator animation ───────────────────────────────────────────────

  const animateTab = (tab: Tab) => {
    const tabIndex = ['saldo', 'riwayat', 'topup'].indexOf(tab);
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    animateTab(tab);
    if (tab === 'riwayat') {
      // Always re-fetch history when switching to this tab
      // so data reflects the current active database
      fetchHistory();
    }
  };

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    // Clear stale data immediately so old database's data doesn't show
    setBalanceData(null);
    setPriceData(null);
    setProgCalc(null);
    try {
      const [balRes, priceRes] = await Promise.all([
        ApiService.getUserBalance(),
        ApiService.getMySubscriptionPrice(),
      ]);

      if (balRes.status && balRes.data) setBalanceData(balRes.data);
      if (priceRes.status && priceRes.data) {
        setPriceData(priceRes.data);
        if (priceRes.data.fee_type === 'progressive') {
          const calcRes = await ApiService.getProgressiveCalculation();
          if (calcRes.status && calcRes.data) setProgCalc(calcRes.data);
        }
      }
    } catch (e) {
      console.error('Error fetching balance:', e);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshingHistory(true);
    else {
      setLoadingHistory(true);
      // Clear stale data so old database's history doesn't show
      setTransactions([]);
    }
    try {
      const res = await ApiService.getUserTransactions();
      if (res.status && Array.isArray(res.data)) {
        setTransactions(res.data);
      }
    } catch (e) {
      console.error('Error fetching transactions:', e);
    } finally {
      setLoadingHistory(false);
      setRefreshingHistory(false);
    }
  }, []);

  // useFocusEffect: re-fetch setiap kali screen mendapat fokus.
  // Panggil getCurrentDatabase() LEBIH DULU untuk memastikan server sudah
  // menggunakan database aktif yang benar (mengatasi auth-cache race condition).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadData = async () => {
        setActiveTab('saldo');
        tabIndicatorAnim.setValue(0);
        setBalanceData(null);
        setPriceData(null);
        setProgCalc(null);
        setTransactions([]);
        setLoadingBalance(true);

        // Step 1: Verifikasi database aktif dari server
        // Ini juga memaksa server melewati cache dan membaca database_name terbaru
        // dari user_mapping.roles (karena auth cache di-invalidate saat setDatabase)
        try {
          const dbRes = await ApiService.getCurrentDatabase();
          if (!cancelled && dbRes.status && dbRes.data) {
            const dbData = dbRes.data;
            setCurrentDbName(typeof dbData === 'string' ? dbData : dbData.name || JSON.stringify(dbData));
          }
        } catch (e) {
          console.warn('Could not verify active database:', e);
        }

        if (cancelled) return;

        // Step 2: Fetch balance dan harga dengan database yang sudah benar
        try {
          const [balRes, priceRes] = await Promise.all([
            ApiService.getUserBalance(),
            ApiService.getMySubscriptionPrice(),
          ]);

          if (!cancelled) {
            if (balRes.status && balRes.data) setBalanceData(balRes.data);
            if (priceRes.status && priceRes.data) {
              setPriceData(priceRes.data);
              if (priceRes.data.fee_type === 'progressive') {
                const calcRes = await ApiService.getProgressiveCalculation();
                if (!cancelled && calcRes.status && calcRes.data) setProgCalc(calcRes.data);
              }
            }
          }
        } catch (e) {
          console.error('Error fetching balance:', e);
        } finally {
          if (!cancelled) setLoadingBalance(false);
        }
      };

      loadData();

      // Cleanup: batalkan update state jika screen sudah di-unfocus
      return () => { cancelled = true; };
    }, [])
  );

  const handleTopUpSuccess = () => {
    // Refresh balance and switch to riwayat tab
    fetchBalance();
    fetchHistory();
    setActiveTab('saldo');
    animateTab('saldo');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'saldo', label: 'Saldo', icon: 'wallet-outline' },
    { key: 'riwayat', label: 'Riwayat', icon: 'receipt-outline' },
    { key: 'topup', label: 'Top Up', icon: 'add-circle-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header */}
      <LinearGradient
        colors={['#4F46E5', '#6D28D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.screenHeader}
      >
        <View style={styles.headerLeft}>
          {navigation && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Info Langganan</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {currentDbName ? `📦 ${currentDbName}` : (user as any)?.email ? String((user as any).email) : 'Akun Anda'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => { fetchBalance(); if (activeTab === 'riwayat') fetchHistory(true); }}
          style={styles.refreshBtn}
        >
          <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabBtn}
            onPress={() => handleTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#4F46E5' : '#9CA3AF'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === tab.key && styles.tabBtnTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Animated indicator */}
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [
                {
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [0, 120, 240],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'saldo' && (
          <BalanceTab
            balance={balanceData}
            priceData={priceData}
            progCalc={progCalc}
            loading={loadingBalance}
          />
        )}
        {activeTab === 'riwayat' && (
          <HistoryTab
            transactions={transactions}
            loading={loadingHistory}
            refreshing={refreshingHistory}
            onRefresh={() => fetchHistory(true)}
          />
        )}
        {activeTab === 'topup' && (
          <TopUpTab
            currentBalance={balanceData?.balance ?? null}
            onTopUpSuccess={handleTopUpSuccess}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280', marginTop: 8 },

  // ── Header
  screenHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  backBtn: { padding: 4, marginRight: 2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1, maxWidth: 220 },
  refreshBtn: { padding: 8 },

  // ── Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    position: 'relative',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 3,
  },
  tabBtnText: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  tabBtnTextActive: { color: '#4F46E5', fontWeight: '700' },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '33.33%',
    height: 3,
    backgroundColor: '#4F46E5',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  // ── Tab scroll content
  tabScrollContent: {
    padding: 16,
    gap: 12,
  },

  // ── Balance gradient card
  balanceGradient: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 4,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceCardLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginBottom: 8 },
  balanceAmount: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  lowBalanceWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lowBalanceText: { fontSize: 12, color: '#FEF3C7', fontWeight: '600' },

  // ── Section
  section: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },

  // ── Info Card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  packageRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  packageIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageType: { fontSize: 15, fontWeight: '700', color: '#111827' },
  packagePrice: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  infoSeparator: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  // ── Progressive calc
  progCalcRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  progCalcItem: { flex: 1, alignItems: 'center', padding: 12 },
  progCalcDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  progCalcLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  progCalcValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  progTierNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  progTierNoteText: { fontSize: 12, color: '#6366F1', flex: 1 },

  // ── Billing note
  billingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
  },
  billingNoteText: { flex: 1, fontSize: 13, color: '#4338CA', lineHeight: 18 },

  // ── Filter
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  filterChipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  filterChipTextActive: { color: '#4F46E5', fontWeight: '700' },

  // ── Transaction list
  txList: { paddingHorizontal: 16, paddingBottom: 32 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  txSeparator: { height: 8 },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  txDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  txDate: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  txAmountWrap: { alignItems: 'flex-end', gap: 3 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txFinalBalance: { fontSize: 11, color: '#9CA3AF' },
  txStatusBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  txStatusText: { fontSize: 9, fontWeight: '700', color: '#92400E' },

  // ── Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },

  // ── Mini balance
  miniBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 4,
  },
  miniBalanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniBalanceLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  miniBalanceValue: { fontSize: 16, fontWeight: '800', color: '#4F46E5' },

  // ── Quick amounts
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  quickChipActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  quickChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  quickChipTextActive: { color: '#4F46E5' },

  // ── Input
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  inputPrefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1.5,
    borderRightColor: '#E5E7EB',
  },
  topupInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  inputHintError: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
  inputHintOk: { fontSize: 12, color: '#059669', fontWeight: '500' },

  // ── Payment Info
  paymentInfoCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  paymentInfoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  paymentInfoTitle: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  paymentInfoDesc: { fontSize: 12, color: '#047857', lineHeight: 17 },

  // ── Top Up Button
  btnTopUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnTopUpDisabled: { opacity: 0.5, shadowOpacity: 0 },
  btnTopUpText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default MySubscriptionScreen;
