import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    state: any;
    setters: any;
    onApply: () => void;
    filterCounts: any;
    ecommerceList: any[];
}

export default function PesananV2FilterModal({ visible, onClose, state, setters, onApply, filterCounts, ecommerceList }: Props) {
    const { sortMethod, dateType, orderTypeFilter, hasPenjualan, platformFilter, filterCetak, filterScan, filterResep, selectedEcommerces } = state;
    const { setSortMethod, setDateType, setOrderTypeFilter, setHasPenjualan, setPlatformFilter, setFilterCetak, setFilterScan, setFilterResep, setSelectedEcommerces } = setters;

    const OptionChip = ({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) => (
        <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Filter Pesanan</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
                        {/* Sortir */}
                        <Text style={styles.sectionTitle}>Urutkan Berdasarkan</Text>
                        <View style={styles.rowWrap}>
                            <OptionChip label="Terbaru" selected={sortMethod === 'terbaru'} onPress={() => setSortMethod('terbaru')} />
                            <OptionChip label="Terlama" selected={sortMethod === 'terlama'} onPress={() => setSortMethod('terlama')} />
                            <OptionChip label="Deadline" selected={sortMethod === 'deadline'} onPress={() => setSortMethod('deadline')} />
                        </View>

                        {/* Tipe Pesanan */}
                        <Text style={styles.sectionTitle}>Tipe Pesanan</Text>
                        <View style={styles.rowWrap}>
                            <OptionChip label="Semua Tipe" selected={orderTypeFilter === 'semua'} onPress={() => setOrderTypeFilter('semua')} />
                            <OptionChip label="Standard" selected={orderTypeFilter === 'standard'} onPress={() => setOrderTypeFilter('standard')} />
                            <OptionChip label="Pengiriman Kilat" selected={orderTypeFilter === 'kilat'} onPress={() => setOrderTypeFilter('kilat')} />
                        </View>

                        {/* Status Penjualan */}
                        <Text style={styles.sectionTitle}>Status Penjualan (Dibuat)</Text>
                        <View style={styles.rowWrap}>
                            <OptionChip label="Semua" selected={hasPenjualan === 'semua'} onPress={() => setHasPenjualan('semua')} />
                            <OptionChip label={`Sudah (${filterCounts.penjualan?.sudah || 0})`} selected={hasPenjualan === 'sudah'} onPress={() => setHasPenjualan('sudah')} />
                            <OptionChip label={`Belum (${filterCounts.penjualan?.belum || 0})`} selected={hasPenjualan === 'belum'} onPress={() => setHasPenjualan('belum')} />
                        </View>

                        {/* Status Cetak */}
                        <Text style={styles.sectionTitle}>Status Cetak Label</Text>
                        <View style={styles.rowWrap}>
                            <OptionChip label="Semua" selected={filterCetak === 'semua'} onPress={() => setFilterCetak('semua')} />
                            <OptionChip label={`Sudah (${filterCounts.cetak?.sudah || 0})`} selected={filterCetak === 'sudah'} onPress={() => setFilterCetak('sudah')} />
                            <OptionChip label={`Belum (${filterCounts.cetak?.belum || 0})`} selected={filterCetak === 'belum'} onPress={() => setFilterCetak('belum')} />
                        </View>

                        {/* Status Scan */}
                        <Text style={styles.sectionTitle}>Status Scan Out</Text>
                        <View style={styles.rowWrap}>
                            <OptionChip label="Semua" selected={filterScan === 'semua'} onPress={() => setFilterScan('semua')} />
                            <OptionChip label={`Sudah (${filterCounts.scan?.sudah || 0})`} selected={filterScan === 'sudah'} onPress={() => setFilterScan('sudah')} />
                            <OptionChip label={`Belum (${filterCounts.scan?.belum || 0})`} selected={filterScan === 'belum'} onPress={() => setFilterScan('belum')} />
                        </View>

                        {/* Filter Resep */}
                        <Text style={styles.sectionTitle}>Filter Khusus</Text>
                        <View style={styles.rowWrap}>
                            <OptionChip label="Hanya Order Berresep" selected={filterResep === true} onPress={() => setFilterResep(!filterResep)} />
                        </View>

                        {/* Toko */}
                        {ecommerceList.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>Toko</Text>
                                <View style={styles.rowWrap}>
                                    {ecommerceList.map(ec => (
                                        <OptionChip 
                                            key={ec.id} 
                                            label={`${ec.name} (${filterCounts.toko?.[ec.name] || 0})`} 
                                            selected={selectedEcommerces.includes(ec.id)} 
                                            onPress={() => {
                                                const newSel = selectedEcommerces.includes(ec.id) 
                                                    ? selectedEcommerces.filter((id: number) => id !== ec.id) 
                                                    : [...selectedEcommerces, ec.id];
                                                setSelectedEcommerces(newSel);
                                            }} 
                                        />
                                    ))}
                                </View>
                            </>
                        )}
                        
                        <View style={{ height: 40 }} />
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.resetBtn} onPress={() => {
                            setSortMethod('terbaru');
                            setOrderTypeFilter('semua');
                            setHasPenjualan('semua');
                            setFilterCetak('semua');
                            setFilterScan('semua');
                            setFilterResep(false);
                            setSelectedEcommerces([]);
                        }}>
                            <Text style={styles.resetBtnText}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
                            <Text style={styles.applyBtnText}>Terapkan Filter</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
    content: { flexShrink: 1 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginTop: 12, marginBottom: 8 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    chipSelected: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
    chipText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
    chipTextSelected: { color: '#B45309', fontWeight: '700' },
    footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
    resetBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', marginRight: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' },
    resetBtnText: { color: '#4B5563', fontWeight: '600' },
    applyBtn: { flex: 2, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#D97706' },
    applyBtnText: { color: '#FFF', fontWeight: '600' }
});
