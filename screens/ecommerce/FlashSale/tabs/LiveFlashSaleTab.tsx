import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FlashSaleService,
  IFlashSaleSession,
  formatEpochTime,
  formatDateTime,
} from '../../../../services/ecommerce/flashSaleService';

interface LiveFlashSaleTabProps {
  idEcommerce: number;
  type: 'all' | 'active' | 'draft' | 'ended';
  onOpenDetail: (session: IFlashSaleSession) => void;
}

export default function LiveFlashSaleTab({
  idEcommerce,
  type,
  onOpenDetail,
}: LiveFlashSaleTabProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<IFlashSaleSession[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!idEcommerce) return;
    setLoading(true);
    try {
      const res = await FlashSaleService.getFlashSaleList(idEcommerce, type);
      if (res.status && Array.isArray(res.data)) {
        setSessions(res.data);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error(`[LiveFlashSaleTab - ${type}] Error fetching sessions:`, err);
    } finally {
      setLoading(false);
    }
  }, [idEcommerce, type]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  const handleDeleteSession = (session: IFlashSaleSession) => {
    const sessionId = session.flash_sale_id || session.id;

    Alert.alert(
      'Batalkan Sesi Flash Sale',
      `Apakah Anda yakin ingin membatalkan/menghapus sesi Flash Sale Shopee #${sessionId}?`,
      [
        { text: 'Tidak', style: 'cancel' },
        {
          text: 'Ya, Batalkan',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(sessionId);
            try {
              const res = await FlashSaleService.deleteFlashSaleSession(sessionId, idEcommerce);
              if (res.status) {
                Alert.alert('Sukses', 'Sesi Flash Sale berhasil dibatalkan di Shopee.');
                fetchSessions();
              } else {
                Alert.alert('Gagal Membatalkan', res.reason || 'Terjadi kesalahan sistem Shopee.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Gagal menghubungi server backend.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const getStatusChip = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'ongoing') {
      return {
        bg: '#DEF7EC',
        color: '#03543F',
        label: 'SEDANG BERJALAN',
      };
    }
    if (s === 'draft' || s === 'upcoming') {
      return {
        bg: '#FEF08A',
        color: '#713F12',
        label: 'AKAN DATANG',
      };
    }
    return {
      bg: '#F3F4F6',
      color: '#4B5563',
      label: 'TELAH BERAKHIR',
    };
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#EE4D2D" />
          <Text style={styles.centerText}>Memuat sesi live Shopee...</Text>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Tidak Ada Sesi Flash Sale</Text>
          <Text style={styles.emptySubtitle}>
            Belum ada sesi Flash Sale yang terdaftar di Shopee untuk kategori ini.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.flash_sale_id || item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const statusInfo = getStatusChip(item.status);
            const isDeleting = deletingId === (item.flash_sale_id || item.id);
            const canCancel = item.status === 'draft' || item.status === 'active';

            return (
              <View style={styles.sessionCard}>
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.idBox}>
                    <Text style={styles.idText}>
                      Shopee ID: #{item.flash_sale_id || item.id}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusChipText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                {/* Time range */}
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={16} color="#EE4D2D" />
                  <Text style={styles.timeText}>
                    {formatDateTime(item.start_time)} ~ {formatDateTime(item.end_time)}
                  </Text>
                </View>

                {/* Meta info */}
                <View style={styles.infoRow}>
                  <View style={styles.infoCol}>
                    <Ionicons name="cube-outline" size={14} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {item.item_count !== undefined
                        ? `${item.item_count} Produk / Varian`
                        : item.items
                        ? `${item.items.length} Produk / Varian`
                        : 'Produk Terdaftar'}
                    </Text>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => onOpenDetail(item)}
                  >
                    <Ionicons name="eye-outline" size={16} color="#1F2937" />
                    <Text style={styles.detailBtnText}>Lihat Detail & Edit</Text>
                  </TouchableOpacity>

                  {canCancel && (
                    <TouchableOpacity
                      style={[styles.cancelBtn, isDeleting && styles.cancelBtnDisabled]}
                      onPress={() => handleDeleteSession(item)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={15} color="#DC2626" />
                          <Text style={styles.cancelBtnText}>Batalkan Sesi</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idBox: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  idText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  infoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  detailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  cancelBtnDisabled: {
    opacity: 0.6,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});
