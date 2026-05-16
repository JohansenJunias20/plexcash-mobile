import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';

interface Props {
    visible: boolean;
    title: string;
    status: string;
    progress: number; // 0 to 1
    processed: number;
    total: number;
}

export default function ProgressModal({ visible, title, status, progress, processed, total }: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ActivityIndicator size="large" color="#D97706" style={{ marginBottom: 16 }} />
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.status}>{status}</Text>
                    
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                    </View>
                    
                    <Text style={styles.progressText}>{processed} / {total}</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    container: { width: '80%', backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center' },
    title: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
    status: { fontSize: 13, color: '#6B7280', marginBottom: 16, textAlign: 'center' },
    progressBarBg: { width: '100%', height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    progressBarFill: { height: '100%', backgroundColor: '#D97706' },
    progressText: { fontSize: 12, fontWeight: '600', color: '#4B5563' }
});
