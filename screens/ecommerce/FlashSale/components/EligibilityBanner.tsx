import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ISellerEligibilityResponse, IUnmetCriterion } from '../../../../services/ecommerce/flashSaleService';

interface EligibilityBannerProps {
  eligibility: ISellerEligibilityResponse | null;
  loading?: boolean;
}

export default function EligibilityBanner({ eligibility, loading }: EligibilityBannerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  if (loading || !eligibility) {
    return null;
  }

  if (eligibility.is_eligible) {
    return (
      <View style={styles.eligibleBanner}>
        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
        <Text style={styles.eligibleText}>
          Toko memenuhi semua kriteria kelayakan Flash Sale Shopee.
        </Text>
      </View>
    );
  }

  const unmetList: IUnmetCriterion[] = eligibility.unmet_criteria || [];

  return (
    <>
      <TouchableOpacity
        style={styles.ineligibleBanner}
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.bannerIconCol}>
          <Ionicons name="alert-circle" size={24} color="#EF4444" />
        </View>
        <View style={styles.bannerTextCol}>
          <Text style={styles.bannerTitle}>Toko Tidak Memenuhi Kriteria Penjual</Text>
          <Text style={styles.bannerSubtitle}>
            {unmetList.length > 0
              ? `${unmetList.length} kriteria performa belum tercapai. Ketuk untuk rincian.`
              : eligibility.reason || 'Performa toko saat ini belum memenuhi syarat Shopee.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Modal Detail Kriteria */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="warning" size={24} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Kriteria Kelayakan Shopee</Text>
                <Text style={styles.modalSubtitle}>
                  {eligibility.shop_name || 'Toko Shopee'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.criteriaIntro}>
                Shopee membatasi pembuatan Flash Sale hanya untuk toko yang memenuhi standar operasional & performa berikut:
              </Text>

              {unmetList.map((item, idx) => (
                <View key={`${item.metric_name}-${idx}`} style={styles.criteriaCard}>
                  <View style={styles.criteriaHeader}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Text style={styles.criteriaTitle}>{item.title || item.metric_name}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Target Shopee</Text>
                      <Text style={styles.targetVal}>{item.target}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color="#9CA3AF" style={{ marginHorizontal: 8 }} />
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Capaian Toko Anda</Text>
                      <Text style={styles.currentVal}>{item.current}</Text>
                    </View>
                  </View>
                  {item.description ? (
                    <Text style={styles.criteriaDesc}>{item.description}</Text>
                  ) : null}
                </View>
              ))}

              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
                <Text style={styles.noticeText}>
                  Perbaiki performa toko Anda melalui Shopee Seller Centre agar fitur Flash Sale Toko Saya dapat dibuka kembali oleh Shopee.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeModalBtnText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  eligibleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
  },
  eligibleText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
    flex: 1,
  },
  ineligibleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
  },
  bannerIconCol: {
    marginRight: 10,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  modalScroll: {
    flexGrow: 0,
    maxHeight: 380,
  },
  modalScrollContent: {
    padding: 16,
  },
  criteriaIntro: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  criteriaCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  criteriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  criteriaTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 6,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  metricBox: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  targetVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  currentVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 2,
  },
  criteriaDesc: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    alignItems: 'flex-start',
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#1E40AF',
    marginLeft: 8,
    lineHeight: 16,
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  closeModalBtn: {
    backgroundColor: '#374151',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
