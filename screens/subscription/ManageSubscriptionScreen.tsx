import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import ApiService from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type FeeType = 'fixed' | 'progressive';

type BalanceValue = number | { offline: number; online: number; total: number };

interface BalanceInfo {
  balance: BalanceValue;
  history_balance: BalanceValue;
  last_checked_at: string | null;
}

interface SubscriptionPrice {
  database_name: string;
  price: number;
  fee_type: FeeType;
}

interface ProgressiveTier {
  id: number;
  database_name: string;
  min_orders: number;
  max_orders: number | null;
  price: number;
}

interface DatabaseRow {
  name: string;
  balance: number | null;
  history_balance: number | null;
  last_checked_at: string | null;
  price: number | null;
  fee_type: FeeType;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVELOPER_EMAILS = ['johansen.junias17@gmail.com', 'josoft.josoft@gmail.com'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getBalanceTotal = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
    if (val.total !== undefined) return Number(val.total);
    if (val.balance !== undefined) return Number(val.balance); // Just in case
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

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return 'Belum pernah dicek';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Belum pernah dicek';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const parseRupiahInput = (raw: string): number => {
  const isNegative = raw.includes('-');
  const cleaned = raw.replace(/[^\d]/g, '');
  const val = parseInt(cleaned || '0', 10);
  return isNegative ? -val : val;
};

const formatRupiahInput = (rawValue: any): string => {
  const value = getBalanceTotal(rawValue);
  if (value === null || value === undefined || isNaN(value)) return '';
  if (value === 0) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FeeBadge: React.FC<{ type: FeeType }> = ({ type }) => (
  <View style={[styles.badge, type === 'fixed' ? styles.badgeFixed : styles.badgeProgressive]}>
    <Text style={styles.badgeText}>{type === 'fixed' ? 'Flat' : 'Progressive'}</Text>
  </View>
);

const SyncIndicator: React.FC<{ 
  balance: number | null; 
  historyBalance: number | null;
  onSync?: () => void;
  syncing?: boolean;
}> = ({
  balance,
  historyBalance,
  onSync,
  syncing = false
}) => {
  const outOfSync =
    balance !== null &&
    historyBalance !== null &&
    balance !== historyBalance;

  return (
    <View style={styles.balanceRow}>
      <View style={styles.balanceItem}>
        <Text style={styles.balanceLabel}>Saldo Terkini</Text>
        <Text style={styles.balanceValue}>{formatRupiah(balance)}</Text>
      </View>
      <View style={[styles.balanceDivider, outOfSync && { backgroundColor: '#FCA5A5' }]} />
      <View style={styles.balanceItem}>
        <Text style={styles.balanceLabel}>Saldo Akhir</Text>
        <Text style={[styles.balanceValue, outOfSync && styles.balanceOutOfSync]}>
          {formatRupiah(historyBalance)}
        </Text>
        {outOfSync && onSync && (
          <TouchableOpacity 
            style={styles.btnSync} 
            onPress={onSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sync" size={12} color="#fff" />
                <Text style={styles.btnSyncText}>Sync</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Database Card ─────────────────────────────────────────────────────────────

interface DatabaseCardProps {
  item: DatabaseRow;
  onPress: () => void;
}

const DatabaseCard: React.FC<DatabaseCardProps> = ({ item, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
    {/* Card header */}
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleRow}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="server" size={18} color="#6366F1" />
        </View>
        <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="middle">
          {item.name}
        </Text>
      </View>
      <FeeBadge type={item.fee_type} />
    </View>

    {/* Balance section */}
    <SyncIndicator balance={item.balance} historyBalance={item.history_balance} />

    {/* Pricing & last-check */}
    <View style={styles.cardFooter}>
      <View style={styles.cardFooterItem}>
        <Ionicons name="pricetag" size={13} color="#9CA3AF" />
        <Text style={styles.cardFooterText}>
          {item.price !== null
            ? `${formatRupiah(item.price)}${item.fee_type === 'fixed' ? '/bln' : ' (tier)'}`
            : 'Belum diatur'}
        </Text>
      </View>
      <View style={styles.cardFooterItem}>
        <Ionicons name="time" size={13} color="#9CA3AF" />
        <Text style={[styles.cardFooterText, { maxWidth: 150 }]} numberOfLines={1}>
          {formatDate(item.last_checked_at)}
        </Text>
      </View>
    </View>

    {/* Chevron */}
    <View style={styles.cardChevron}>
      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </View>
  </TouchableOpacity>
);

// ─── Progressive Tier Row ─────────────────────────────────────────────────────

interface TierRowProps {
  tier: ProgressiveTier;
  onDelete: () => void;
  isReadOnly: boolean;
}

const TierRow: React.FC<TierRowProps> = ({ tier, onDelete, isReadOnly }) => (
  <View style={styles.tierRow}>
    <View style={styles.tierRangeWrap}>
      <Text style={styles.tierRangeText}>
        {tier.min_orders} – {tier.max_orders !== null ? tier.max_orders : '∞'} order
      </Text>
      <Text style={styles.tierPriceText}>{formatRupiah(tier.price)}</Text>
    </View>
    {!isReadOnly && (
      <TouchableOpacity onPress={onDelete} style={styles.tierDeleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash" size={18} color="#EF4444" />
      </TouchableOpacity>
    )}
  </View>
);

// ─── Add Tier Form ─────────────────────────────────────────────────────────────

interface AddTierFormProps {
  existingTiers: ProgressiveTier[];
  onAdd: (min: number, max: number | null, price: number) => void;
  onCancel: () => void;
}

const AddTierForm: React.FC<AddTierFormProps> = ({ existingTiers, onAdd, onCancel }) => {
  const [minOrders, setMinOrders] = useState('');
  const [maxOrders, setMaxOrders] = useState('');
  const [noLimit, setNoLimit] = useState(false);
  const [price, setPrice] = useState('');
  const [priceRaw, setPriceRaw] = useState(0);

  const handlePriceChange = (text: string) => {
    const raw = parseRupiahInput(text);
    setPriceRaw(raw);
    setPrice(formatRupiahInput(raw));
  };

  const validate = (): string | null => {
    const min = parseInt(minOrders, 10);
    const max = noLimit ? null : parseInt(maxOrders, 10);

    if (isNaN(min) || min < 1) return 'Min Orders harus angka positif';
    if (!noLimit && (isNaN(max as number) || (max as number) <= min)) {
      return 'Max Orders harus lebih besar dari Min Orders';
    }
    if (priceRaw <= 0) return 'Harga harus lebih dari 0';

    // Overlap & gap check
    const sorted = [...existingTiers].sort((a, b) => a.min_orders - b.min_orders);
    for (const t of sorted) {
      const tMax = t.max_orders;
      // Overlap check
      if (noLimit || max === null) {
        if (min <= (tMax ?? Infinity)) {
          // could overlap
          if (min >= t.min_orders && (tMax === null || min <= tMax)) {
            return `Min Orders (${min}) tumpang tindih dengan tier ${t.min_orders}–${tMax ?? '∞'}`;
          }
        }
      } else {
        const maxVal = max as number;
        if (min <= (tMax ?? Infinity) && maxVal >= t.min_orders) {
          return `Rentang ${min}–${maxVal} tumpang tindih dengan tier ${t.min_orders}–${tMax ?? '∞'}`;
        }
      }
    }

    // Gap check: if there are existing tiers, the new tier must be contiguous
    if (sorted.length > 0) {
      // Find the max of all existing tiers
      const lastTier = sorted[sorted.length - 1];
      if (lastTier.max_orders !== null) {
        // There is a defined last max. New tier should start at lastMax + 1
        if (min !== lastTier.max_orders + 1) {
          return `Tier baru harus dimulai dari ${lastTier.max_orders + 1} (tidak boleh ada celah)`;
        }
      } else {
        return 'Tier terakhir sudah "Tidak terbatas". Tidak bisa menambah tier baru';
      }
    }

    // Only last tier can have null max_orders
    if (noLimit) {
      const hasOtherUnlimited = existingTiers.some(t => t.max_orders === null);
      if (hasOtherUnlimited) {
        return 'Hanya satu tier yang boleh memiliki Max Orders "Tidak terbatas"';
      }
    }

    return null;
  };

  const handleSubmit = () => {
    const error = validate();
    if (error) {
      Alert.alert('Validasi Gagal', error);
      return;
    }
    const min = parseInt(minOrders, 10);
    const max = noLimit ? null : parseInt(maxOrders, 10);
    onAdd(min, max, priceRaw);
  };

  return (
    <View style={styles.addTierForm}>
      <Text style={styles.addTierTitle}>Tambah Tier Baru</Text>

      <View style={styles.tierInputRow}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>Min Orders</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={minOrders}
            onChangeText={setMinOrders}
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Max Orders</Text>
          <TextInput
            style={[styles.input, noLimit && styles.inputDisabled]}
            placeholder={noLimit ? '∞' : 'e.g. 100'}
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={noLimit ? '' : maxOrders}
            onChangeText={setMaxOrders}
            editable={!noLimit}
          />
        </View>
      </View>

      <View style={styles.noLimitRow}>
        <Switch
          value={noLimit}
          onValueChange={setNoLimit}
          trackColor={{ false: '#D1D5DB', true: '#A78BFA' }}
          thumbColor={noLimit ? '#7C3AED' : '#F3F4F6'}
        />
        <Text style={styles.noLimitLabel}>Tidak Terbatas (Max = ∞)</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Harga per Tier</Text>
        <View style={styles.inputWithPrefix}>
          <Text style={styles.inputPrefix}>Rp</Text>
          <TextInput
            style={[styles.input, { flex: 1, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={price}
            onChangeText={handlePriceChange}
          />
        </View>
      </View>

      <View style={styles.addTierActions}>
        <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
          <Text style={styles.btnCancelText}>Batal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnAdd} onPress={handleSubmit}>
          <Ionicons name="add-circle" size={16} color="#fff" />
          <Text style={styles.btnAddText}>Tambah Tier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Detail Modal ──────────────────────────────────────────────────────────────

interface DetailModalProps {
  visible: boolean;
  database: DatabaseRow | null;
  isReadOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({
  visible,
  database,
  isReadOnly,
  onClose,
  onSaved,
}) => {
  const [feeType, setFeeType] = useState<FeeType>('fixed');
  const [flatPrice, setFlatPrice] = useState('');
  const [flatPriceRaw, setFlatPriceRaw] = useState(0);
  const [tiers, setTiers] = useState<ProgressiveTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddTier, setShowAddTier] = useState(false);

  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [editBalance, setEditBalance] = useState('');
  const [editBalanceRaw, setEditBalanceRaw] = useState(0);
  const [editHistoryBalance, setEditHistoryBalance] = useState('');
  const [editHistoryBalanceRaw, setEditHistoryBalanceRaw] = useState(0);
  const [savingBalance, setSavingBalance] = useState(false);
  const [syncingBalance, setSyncingBalance] = useState(false);

  // Load data when opened
  useEffect(() => {
    if (!visible || !database) return;

    setFeeType(database.fee_type);
    const raw = database.price ?? 0;
    setFlatPriceRaw(raw);
    setFlatPrice(formatRupiahInput(raw));
    setShowAddTier(false);

    setIsEditingBalance(false);
    const bRaw = database.balance ?? 0;
    const hbRaw = database.history_balance ?? 0;
    setEditBalanceRaw(bRaw);
    setEditBalance(formatRupiahInput(bRaw));
    setEditHistoryBalanceRaw(hbRaw);
    setEditHistoryBalance(formatRupiahInput(hbRaw));

    if (database.fee_type === 'progressive') {
      loadTiers(database.name);
    } else {
      setTiers([]);
    }
  }, [visible, database]);

  const loadTiers = async (dbName: string) => {
    setLoadingTiers(true);
    try {
      const res = await ApiService.getProgressiveRules(dbName);
      if (res.status && Array.isArray(res.data)) {
        const sorted = [...res.data].sort((a: ProgressiveTier, b: ProgressiveTier) => a.min_orders - b.min_orders);
        setTiers(sorted);
      }
    } catch (e) {
      console.error('Error loading tiers:', e);
    } finally {
      setLoadingTiers(false);
    }
  };

  const handleSyncBalance = async () => {
    if (!database || database.history_balance === null) return;
    setSyncingBalance(true);
    try {
      const res = await ApiService.syncDatabaseHistory(database.name);
      if (res.status) {
        Alert.alert('Berhasil', res.message || 'Saldo berhasil disinkronkan!');
        onSaved();
      } else {
        Alert.alert('Error', res.reason || 'Gagal menyinkronkan saldo');
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal menyinkronkan saldo. Coba lagi.');
    } finally {
      setSyncingBalance(false);
    }
  };

  const handleFeeTypeToggle = async (type: FeeType) => {
    if (type === feeType || isReadOnly || !database) return;
    try {
      await ApiService.setSubscriptionFeeType(database.name, type);
      setFeeType(type);
      if (type === 'progressive' && tiers.length === 0) {
        loadTiers(database.name);
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal mengubah tipe biaya. Coba lagi.');
    }
  };

  const handleSaveBalance = async () => {
    if (!database) return;
    setSavingBalance(true);
    try {
      const res = await ApiService.setDatabaseBalance(
        database.name,
        editBalanceRaw
      );
      if (res.status) {
        Alert.alert('Berhasil', 'Saldo berhasil diubah!');
        setIsEditingBalance(false);
        onSaved();
      } else {
        Alert.alert('Error', res.reason || 'Gagal mengubah saldo');
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal mengubah saldo. Coba lagi.');
    } finally {
      setSavingBalance(false);
    }
  };

  const handleSaveFlatPrice = async () => {
    if (!database || flatPriceRaw <= 0) {
      Alert.alert('Validasi', 'Harga harus lebih dari 0');
      return;
    }
    setSaving(true);
    try {
      const res = await ApiService.setSubscriptionPrice(database.name, flatPriceRaw);
      if (res.status) {
        Alert.alert('Berhasil', 'Harga berhasil disimpan!');
        onSaved();
      } else {
        Alert.alert('Error', res.reason || 'Gagal menyimpan harga');
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan harga. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = (tier: ProgressiveTier) => {
    Alert.alert(
      'Hapus Tier',
      `Yakin ingin menghapus tier ${tier.min_orders}–${tier.max_orders ?? '∞'} order?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteProgressiveRule(tier.id);
              setTiers(prev => prev.filter(t => t.id !== tier.id));
              onSaved();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus tier. Coba lagi.');
            }
          },
        },
      ]
    );
  };

  const handleAddTier = async (min: number, max: number | null, price: number) => {
    if (!database) return;
    try {
      const res = await ApiService.addProgressiveRule({
        database_name: database.name,
        min_orders: min,
        max_orders: max,
        price,
      });
      if (res.status) {
        setShowAddTier(false);
        loadTiers(database.name);
        onSaved();
      } else {
        Alert.alert('Error', res.reason || 'Gagal menambah tier');
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal menambah tier. Coba lagi.');
    }
  };

  const handleFlatPriceChange = (text: string) => {
    const raw = parseRupiahInput(text);
    setFlatPriceRaw(raw);
    setFlatPrice(formatRupiahInput(raw));
  };

  if (!database) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalSheet}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {database.name}
              </Text>
              {isReadOnly && (
                <View style={styles.readOnlyBanner}>
                  <Ionicons name="lock-closed" size={12} color="#92400E" />
                  <Text style={styles.readOnlyText}>Mode baca saja – Anda bukan developer</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Balance summary */}
            <View style={styles.modalSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>RINGKASAN SALDO</Text>
                {!isReadOnly && !isEditingBalance && (
                  <TouchableOpacity
                    style={styles.btnAddTierSmall}
                    onPress={() => setIsEditingBalance(true)}
                  >
                    <Ionicons name="pencil" size={14} color="#7C3AED" />
                    <Text style={styles.btnAddTierSmallText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isEditingBalance ? (
                <View style={{ marginTop: 12 }}>

                  <View style={styles.tierInputRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.inputLabel}>Saldo Terkini</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={editBalance}
                        onChangeText={(text) => {
                          let formattedText = text;
                          if (text === '-') {
                             setEditBalanceRaw(0);
                             setEditBalance('-');
                             return;
                          }
                          const raw = parseRupiahInput(text);
                          setEditBalanceRaw(raw);
                          setEditBalance(text.includes('-') && raw === 0 ? '-0' : formatRupiahInput(raw));
                        }}
                      />
                    </View>
                  </View>
                  <View style={styles.addTierActions}>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditingBalance(false)}>
                      <Text style={styles.btnCancelText}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAdd, savingBalance && { opacity: 0.7 }]}
                      onPress={handleSaveBalance}
                      disabled={savingBalance}
                    >
                      {savingBalance ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="save" size={16} color="#fff" />
                          <Text style={styles.btnAddText}>Simpan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <SyncIndicator 
                  balance={database.balance} 
                  historyBalance={database.history_balance} 
                  onSync={!isReadOnly ? handleSyncBalance : undefined}
                  syncing={syncingBalance}
                />
              )}

              <View style={styles.lastCheckRow}>
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text style={styles.lastCheckText}>
                  Last check: {formatDate(database.last_checked_at)}
                </Text>
              </View>
            </View>

            {/* Fee type toggle */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>TIPE BIAYA</Text>
              <View style={styles.segmentControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    feeType === 'fixed' && styles.segmentBtnActive,
                  ]}
                  onPress={() => handleFeeTypeToggle('fixed')}
                  disabled={isReadOnly}
                >
                  <Ionicons
                    name="remove-circle"
                    size={16}
                    color={feeType === 'fixed' ? '#fff' : '#6B7280'}
                  />
                  <Text style={[styles.segmentBtnText, feeType === 'fixed' && styles.segmentBtnTextActive]}>
                    Fixed / Flat
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    feeType === 'progressive' && styles.segmentBtnProgressiveActive,
                  ]}
                  onPress={() => handleFeeTypeToggle('progressive')}
                  disabled={isReadOnly}
                >
                  <Ionicons
                    name="trending-up"
                    size={16}
                    color={feeType === 'progressive' ? '#fff' : '#6B7280'}
                  />
                  <Text style={[styles.segmentBtnText, feeType === 'progressive' && styles.segmentBtnTextActive]}>
                    Progressive
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Fixed form */}
            {feeType === 'fixed' && (
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>HARGA BIAYA FLAT (per bulan)</Text>
                <View style={styles.inputWithPrefix}>
                  <Text style={styles.inputPrefix}>Rp</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                      isReadOnly && styles.inputDisabled,
                    ]}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={flatPrice}
                    onChangeText={handleFlatPriceChange}
                    editable={!isReadOnly}
                  />
                </View>
                {!isReadOnly && (
                  <TouchableOpacity
                    style={[styles.btnSave, saving && styles.btnSaveDisabled]}
                    onPress={handleSaveFlatPrice}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="save" size={16} color="#fff" />
                        <Text style={styles.btnSaveText}>Simpan Harga</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Progressive form */}
            {feeType === 'progressive' && (
              <View style={styles.modalSection}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>ATURAN TIER PROGRESSIVE</Text>
                  {!isReadOnly && !showAddTier && (
                    <TouchableOpacity
                      style={styles.btnAddTierSmall}
                      onPress={() => setShowAddTier(true)}
                    >
                      <Ionicons name="add" size={14} color="#7C3AED" />
                      <Text style={styles.btnAddTierSmallText}>Tambah</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {loadingTiers ? (
                  <View style={styles.tierLoading}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text style={styles.tierLoadingText}>Memuat tier...</Text>
                  </View>
                ) : tiers.length === 0 && !showAddTier ? (
                  <View style={styles.tierEmpty}>
                    <Ionicons name="layers-outline" size={32} color="#D1D5DB" />
                    <Text style={styles.tierEmptyText}>Belum ada tier. Tambah tier pertama!</Text>
                  </View>
                ) : (
                  <View style={styles.tierList}>
                    {tiers.map((tier, index) => (
                      <TierRow
                        key={tier.id}
                        tier={tier}
                        onDelete={() => handleDeleteTier(tier)}
                        isReadOnly={isReadOnly}
                      />
                    ))}
                  </View>
                )}

                {showAddTier && (
                  <AddTierForm
                    existingTiers={tiers}
                    onAdd={handleAddTier}
                    onCancel={() => setShowAddTier(false)}
                  />
                )}
              </View>
            )}

            {/* Bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────

const ManageSubscriptionScreen: React.FC = () => {
  const { user } = useAuth();
  const userEmail = (user as any)?.email ?? '';
  const isDeveloper = DEVELOPER_EMAILS.includes(userEmail);

  const [databases, setDatabases] = useState<string[]>([]);
  const [balances, setBalances] = useState<Record<string, BalanceInfo>>({});
  const [prices, setPrices] = useState<SubscriptionPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDb, setSelectedDb] = useState<DatabaseRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [dbRes, balRes, priceRes] = await Promise.all([
        ApiService.getDatabaseList(),
        ApiService.getDatabaseBalances(),
        ApiService.getSubscriptionPrices(),
      ]);

      if (dbRes.status && Array.isArray(dbRes.data)) {
        const validDbs = dbRes.data.map(d => {
          if (typeof d === 'string') return d;
          if (d && typeof d === 'object') {
            return d.name || d.database_name || d.database || JSON.stringify(d);
          }
          return String(d);
        });
        setDatabases(validDbs);
      }
      if (balRes.status && balRes.data) {
        setBalances(balRes.data);
      }
      if (priceRes.status && Array.isArray(priceRes.data)) {
        setPrices(priceRes.data);
      }
    } catch (e) {
      setError('Gagal memuat data. Periksa koneksi dan coba lagi.');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    };
    init();
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // Merge into unified rows
  const rows = useMemo<DatabaseRow[]>(() => {
    return databases.map(name => {
      const bal = balances[name] ?? null;
      const priceInfo = prices.find(p => p.database_name === name);
      return {
        name,
        balance: getBalanceTotal(bal?.balance),
        history_balance: getBalanceTotal(bal?.history_balance),
        last_checked_at: bal?.last_checked_at ?? null,
        price: priceInfo?.price ?? null,
        fee_type: priceInfo?.fee_type ?? 'fixed',
      };
    });
  }, [databases, balances, prices]);

  const filteredRows = useMemo(
    () =>
      search.trim()
        ? rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase().trim()))
        : rows,
    [rows, search]
  );

  const handleCardPress = (item: DatabaseRow) => {
    setSelectedDb(item);
    setModalVisible(true);
  };

  const handleModalSaved = async () => {
    // Refresh prices silently
    try {
      const [balRes, priceRes] = await Promise.all([
        ApiService.getDatabaseBalances(),
        ApiService.getSubscriptionPrices(),
      ]);
      if (balRes.status && balRes.data) setBalances(balRes.data);
      if (priceRes.status && Array.isArray(priceRes.data)) setPrices(priceRes.data);

      // Update selectedDb
      if (selectedDb) {
        const newPriceInfo = (priceRes.data as SubscriptionPrice[]).find(
          p => p.database_name === selectedDb.name
        );
        const newBal = (balRes.data as Record<string, BalanceInfo>)[selectedDb.name];
        setSelectedDb(prev =>
          prev
            ? {
                ...prev,
                price: newPriceInfo?.price ?? prev.price,
                fee_type: newPriceInfo?.fee_type ?? prev.fee_type,
                balance: newBal ? getBalanceTotal(newBal.balance) : prev.balance,
                history_balance: newBal ? getBalanceTotal(newBal.history_balance) : prev.history_balance,
                last_checked_at: newBal?.last_checked_at ?? prev.last_checked_at,
              }
            : prev
        );
      }
    } catch (e) {
      // Silent fail, user can pull to refresh
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Kelola Langganan</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Memuat data langganan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Screen Header */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>Kelola Langganan</Text>
          <Text style={styles.screenSubtitle}>{filteredRows.length} database terdaftar</Text>
        </View>
        {isDeveloper && (
          <View style={styles.devBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#A5F3FC" />
            <Text style={styles.devBadgeText}>Developer</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama database..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.errorRetryBtn}>
            <Text style={styles.errorRetryText}>Coba lagi</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filteredRows}
        keyExtractor={item => item.name}
        renderItem={({ item }) => (
          <DatabaseCard item={item} onPress={() => handleCardPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366F1']}
            tintColor="#6366F1"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="server-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {search ? 'Tidak ditemukan' : 'Tidak ada database'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? `Tidak ada database yang cocok dengan "${search}"`
                : 'Belum ada database yang terdaftar'}
            </Text>
          </View>
        }
      />

      {/* Detail Modal */}
      <DetailModal
        visible={modalVisible}
        database={selectedDb}
        isReadOnly={!isDeveloper}
        onClose={() => setModalVisible(false)}
        onSaved={handleModalSaved}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },

  // ── Screen Header
  screenHeader: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  screenSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  devBadgeText: {
    fontSize: 12,
    color: '#A5F3FC',
    fontWeight: '600',
  },

  // ── Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },

  // ── Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },
  errorRetryBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  errorRetryText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // ── List
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },

  // ── Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardChevron: {
    position: 'absolute',
    right: 12,
    top: 12,
  },

  // ── Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeFixed: { backgroundColor: '#DBEAFE' },
  badgeProgressive: { backgroundColor: '#EDE9FE' },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },

  // ── Balance
  balanceRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  balanceItem: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  balanceOutOfSync: {
    color: '#DC2626',
  },
  btnSync: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  btnSyncText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // ── Card footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardFooterText: {
    fontSize: 12,
    color: '#6B7280',
  },

  // ── Empty / Error State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalClose: {
    padding: 4,
    marginLeft: 12,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  readOnlyText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  modalSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  lastCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  lastCheckText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // ── Segment Control
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#4F46E5',
  },
  segmentBtnProgressiveActive: {
    backgroundColor: '#7C3AED',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentBtnTextActive: {
    color: '#fff',
  },

  // ── Input
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  inputPrefix: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1.5,
    borderRightColor: '#E5E7EB',
  },

  // ── Save Button
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  btnSaveDisabled: {
    opacity: 0.6,
  },
  btnSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Tier
  tierList: {
    gap: 8,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tierRangeWrap: {
    flex: 1,
    gap: 3,
  },
  tierRangeText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  tierPriceText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '700',
  },
  tierDeleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
  tierLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  tierLoadingText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  tierEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  tierEmptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // ── Add Tier Buttons
  btnAddTierSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnAddTierSmallText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
  },

  // ── Add Tier Form
  addTierForm: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  addTierTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
    marginBottom: 12,
  },
  tierInputRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  noLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  noLimitLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  addTierActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btnCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  btnAdd: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  btnAddText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ManageSubscriptionScreen;
