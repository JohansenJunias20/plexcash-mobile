import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import RNPrint from 'react-native-print';
import ApiService from '../../services/api';

// Import components (to be created)
import BelumPesanTab from './components/BelumPesanTab';
import SudahPesanTab from './components/SudahPesanTab';

// Types
interface ItemBelumPesan {
  id: number;
  nama: string;
  merk: string;
  kategori: string;
  id_supplier: number;
  supplier_nama?: string;
  minstok: number;
  stok: number;
  qty_pesan: number;
  qty_preorder_pending: number;
  total_available: number;
  qty_to_order: number;
}

interface ItemSudahPesan {
  id: number;
  tgl_pesan: string;
  nama: string;
  merk: string;
  kategori: string;
  id_supplier: number;
  supplier_nama: string;
  qty_pesan: number;
  po_status: 'belum_po' | 'sudah_po';
  po_ids: number[];
  po_qty_total: number;
}

interface Supplier {
  id_supplier: number | null;
  nama: string;
}

type TabType = 'belum' | 'sudah';

export default function PesanBarangScreen() {
  const navigation = useNavigation();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('belum');

  // Belum Pesan state
  const [itemsBelumPesan, setItemsBelumPesan] = useState<ItemBelumPesan[]>([]);
  const [loadingBelum, setLoadingBelum] = useState(false);

  // Sudah Pesan state
  const [itemsSudahPesan, setItemsSudahPesan] = useState<ItemSudahPesan[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(0);
  const [poFilterIndex, setPoFilterIndex] = useState(0); // 0: All, 1: Belum PO, 2: Sudah PO
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [loadingSudah, setLoadingSudah] = useState(false);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Fetch Belum Pesan items
  const fetchBelumPesan = async () => {
    try {
      setLoadingBelum(true);
      
      // Fetch both items and suppliers in parallel
      const [response, suppliersRes] = await Promise.all([
        ApiService.get('/get/masterbarang/items-needing-order'),
        ApiService.get('/get/supplier')
      ]);

      let suppliersMap = new Map();
      if (suppliersRes.status && suppliersRes.data) {
        suppliersRes.data.forEach((s: any) => {
          suppliersMap.set(String(s.id), s.nama);
        });
      }

      if (response.status) {
        // Filter to only show items where pesan = 0 (not yet marked as ordered)
        const filteredData = response.data.filter((item: any) => item.pesan === 0 || item.pesan === false);

        const processedData = filteredData.map((item: any) => ({
          ...item,
          qty_pesan: item.qty_pesan || 0,
          supplier_nama: item.supplier_nama || suppliersMap.get(String(item.id_supplier)),
        }));

        setItemsBelumPesan(processedData);
      } else {
        Alert.alert('Error', response.reason || 'Failed to load items');
      }
    } catch (error) {
      console.error('Error fetching belum pesan:', error);
      Alert.alert('Error', 'Failed to load items needing order');
    } finally {
      setLoadingBelum(false);
    }
  };

  // Fetch Sudah Pesan items
  const fetchSudahPesan = async () => {
    try {
      setLoadingSudah(true);

      // Fetch suppliers
      const suppliersRes = await ApiService.get('/get/supplier/sudahpesan');
      if (suppliersRes.status) {
        const processedSuppliers = (suppliersRes.data || []).map((s: any) => ({
          id_supplier: s.id_supplier,
          nama: s.nama || s.supplier_nama || s.nama_supplier || 'Unknown'
        }));
        const supplierData = [{ id_supplier: null, nama: 'ALL' }, ...processedSuppliers];
        setSuppliers(supplierData as Supplier[]);
      }

      // Fetch ordered items with PO status
      const itemsRes = await ApiService.get('/get/masterbarang/sudahpesan/with-po-status');
      if (itemsRes.status) {
        setItemsSudahPesan(itemsRes.data);
      } else {
        Alert.alert('Error', itemsRes.reason || 'Failed to load ordered items');
      }
    } catch (error) {
      console.error('Error fetching sudah pesan:', error);
      Alert.alert('Error', 'Failed to load ordered items');
    } finally {
      setLoadingSudah(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (activeTab === 'belum') {
      fetchBelumPesan();
    } else {
      fetchSudahPesan();
    }
  }, [activeTab]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'belum') {
      await fetchBelumPesan();
    } else {
      await fetchSudahPesan();
    }
    setRefreshing(false);
  };

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedItems([]); // Clear selection when switching tabs
  };

  // Update quantity for Belum Pesan item
  const handleUpdateQtyBelum = (id: number, qty: number) => {
    console.log('[PesanBarang] Updating quantity for item:', id, 'to:', qty);
    setItemsBelumPesan(prev =>
      prev.map(item => (item.id === id ? { ...item, qty_pesan: qty } : item))
    );
  };

  // Update supplier for Belum Pesan item and automatically mark as ordered
  const handleUpdateSupplierBelum = async (id: number, id_supplier: number) => {
    console.log('[PesanBarang] Updating supplier for item:', id, 'to supplier:', id_supplier);

    // Find the item to get its qty_pesan
    const item = itemsBelumPesan.find(item => item.id === id);
    if (!item) {
      console.error('[PesanBarang] Item not found:', id);
      Alert.alert('Error', 'Item not found');
      return;
    }

    // Validate qty_pesan
    if (!item.qty_pesan || item.qty_pesan <= 0) {
      console.warn('[PesanBarang] Invalid qty_pesan for item:', id, 'qty:', item.qty_pesan);
      Alert.alert('Error', 'Please set a valid quantity before selecting a supplier');
      return;
    }

    try {
      console.log('[PesanBarang] Auto-marking item as ordered:', { id, id_supplier, qty_pesan: item.qty_pesan });

      // Make API call to mark as ordered (same as web version)
      const response = await ApiService.patch(`/masterbarang/pesan/${id}`, {
        id_supplier,
        qty_pesan: item.qty_pesan,
      });

      if (response.status) {
        console.log('[PesanBarang] Item auto-marked as ordered successfully');
        Alert.alert('Success', 'Item marked as ordered and moved to "Sudah Pesan" tab');

        // Remove from Belum Pesan list
        setItemsBelumPesan(prev => prev.filter(item => item.id !== id));

        // Refresh Sudah Pesan list to show the newly ordered item
        await fetchSudahPesan();
      } else {
        console.error('[PesanBarang] Failed to auto-mark as ordered:', response.reason);
        Alert.alert('Error', response.reason || 'Failed to mark as ordered');
      }
    } catch (error) {
      console.error('[PesanBarang] Error auto-marking as ordered:', error);
      Alert.alert('Error', 'Failed to mark as ordered');
    }
  };

  // Mark item as ordered
  const handleMarkAsOrdered = async (id: number, id_supplier: number, qty_pesan: number) => {
    try {
      console.log('[PesanBarang] Marking item as ordered:', { id, id_supplier, qty_pesan });
      const response = await ApiService.patch(`/masterbarang/pesan/${id}`, {
        id_supplier,
        qty_pesan,
      });

      if (response.status) {
        console.log('[PesanBarang] Item marked as ordered successfully');
        Alert.alert('Success', 'Item marked as ordered');
        // Remove from Belum Pesan list
        setItemsBelumPesan(prev => prev.filter(item => item.id !== id));
      } else {
        console.error('[PesanBarang] Failed to mark as ordered:', response.reason);
        Alert.alert('Error', response.reason || 'Failed to mark as ordered');
      }
    } catch (error) {
      console.error('[PesanBarang] Error marking as ordered:', error);
      Alert.alert('Error', 'Failed to mark as ordered');
    }
  };

  // Update quantity for Sudah Pesan item (debounced)
  const handleUpdateQtySudah = useCallback(
    async (id: number, qty: number) => {
      try {
        const response = await ApiService.patch(`/masterbarang/pesan/${id}`, {
          qty_pesan: qty,
        });

        if (response.status) {
          // Update local state
          setItemsSudahPesan(prev =>
            prev.map(item => (item.id === id ? { ...item, qty_pesan: qty } : item))
          );
        } else {
          Alert.alert('Error', response.reason || 'Failed to update quantity');
        }
      } catch (error) {
        console.error('Error updating quantity:', error);
        Alert.alert('Error', 'Failed to update quantity');
      }
    },
    []
  );

  // Mark item as not ordered
  const handleMarkAsNotOrdered = async (id: number) => {
    try {
      const response = await ApiService.patch(`/masterbarang/belumpesan/${id}`, {});

      if (response.status) {
        Alert.alert('Success', 'Item marked as not ordered');
        // Refresh both lists
        await fetchSudahPesan();
        await fetchBelumPesan();
      } else {
        Alert.alert('Error', response.reason || 'Failed to mark as not ordered');
      }
    } catch (error) {
      console.error('Error marking as not ordered:', error);
      Alert.alert('Error', 'Failed to mark as not ordered');
    }
  };

  // Toggle item selection
  const handleToggleSelection = (id: number) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  // Transfer to Pre Order
  const handleTransferToPreOrder = () => {
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please select at least one item');
      return;
    }

    // Get selected items
    const selected = itemsSudahPesan.filter(item => selectedItems.includes(item.id));

    // Check if all items have the same supplier
    const supplierIds = [...new Set(selected.map(item => item.id_supplier))];
    if (supplierIds.length > 1) {
      Alert.alert('Error', 'All selected items must have the same supplier');
      return;
    }

    // Prepare transfer data
    const transferData = {
      items: selected,
      supplierId: selected[0].id_supplier,
      supplierName: selected[0].supplier_nama,
    };

    // Navigate to PreOrder screen with transfer data
    Alert.alert(
      'Transfer to Pre Order',
      `Transfer ${selectedItems.length} item(s) to Pre Order?\n\nSupplier: ${transferData.supplierName}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => {
            // Navigate to PreOrder screen with transfer data
            (navigation as any).navigate('PreOrder', { transferData });
            setSelectedItems([]);
          },
        },
      ]
    );
  };

  // Helper to generate PDF HTML
  const generatePdfHtml = (items: ItemSudahPesan[]) => {
    const currentDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const totalQty = items.reduce((sum, item) => sum + (item.qty_pesan || 0), 0);

    const tableRows = items
      .map((item, index) => {
        const formattedDate = new Date(item.tgl_pesan).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const poStatusText = item.po_status === 'sudah_po'
          ? `Sudah PO (${item.po_ids.join(', ')})`
          : 'Belum PO';

        return `
          <tr>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${formattedDate}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${item.nama}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${item.merk || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${item.kategori || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${item.supplier_nama || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${item.qty_pesan}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${poStatusText}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Laporan Pesan Barang</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 20px;
            color: #333;
            font-size: 11px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            color: #2c3e50;
            font-size: 20px;
            text-transform: uppercase;
          }
          .header p {
            margin: 5px 0 0 0;
            color: #7f8c8d;
            font-size: 12px;
          }
          .meta-container {
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            background: #f8f9fa;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
          }
          .meta-item {
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
          }
          th {
            background-color: #2c3e50;
            color: #ffffff;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
            border: 1px solid #34495e;
            padding: 8px;
            text-align: left;
          }
          tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 9px;
            color: #95a5a6;
            border-top: 1px solid #eee;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Laporan Pesan Barang</h1>
          <p>Aplikasi Mobile Plexcash</p>
        </div>
        <div class="meta-container">
          <div class="meta-item">
            <strong>Tanggal Cetak:</strong> ${currentDate}
          </div>
          <div class="meta-item">
            <strong>Total Item:</strong> ${items.length} &nbsp;|&nbsp; 
            <strong>Total Qty:</strong> ${totalQty}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No.</th>
              <th style="width: 12%;">Tanggal</th>
              <th style="width: 25%;">Nama Barang</th>
              <th style="width: 10%;">Merk</th>
              <th style="width: 10%;">Kategori</th>
              <th style="width: 15%;">Supplier</th>
              <th style="width: 8%; text-align: right;">Qty</th>
              <th style="width: 15%;">Status PO</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          Dokumen ini dihasilkan secara otomatis oleh Plexcash Mobile
        </div>
      </body>
      </html>
    `;
  };

  // Export Selected Items to PDF
  const handleExportToPdf = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please select at least one item');
      return;
    }

    const selected = itemsSudahPesan.filter(item => selectedItems.includes(item.id));

    try {
      const html = generatePdfHtml(selected);
      await RNPrint.print({ html });
    } catch (error: any) {
      console.error('[PesanBarang] Export PDF error:', error);
      Alert.alert('Error', 'Failed to export PDF: ' + (error?.message || 'Unknown error'));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pesan Barang</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'belum' && styles.activeTab]}
          onPress={() => handleTabChange('belum')}
        >
          <Text style={[styles.tabText, activeTab === 'belum' && styles.activeTabText]}>
            Belum Pesan
          </Text>
          {itemsBelumPesan.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{itemsBelumPesan.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sudah' && styles.activeTab]}
          onPress={() => handleTabChange('sudah')}
        >
          <Text style={[styles.tabText, activeTab === 'sudah' && styles.activeTabText]}>
            Sudah Pesan
          </Text>
          {itemsSudahPesan.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{itemsSudahPesan.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'belum' ? (
          <BelumPesanTab
            items={itemsBelumPesan}
            loading={loadingBelum}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onUpdateQty={handleUpdateQtyBelum}
            onUpdateSupplier={handleUpdateSupplierBelum}
            onMarkAsOrdered={handleMarkAsOrdered}
          />
        ) : (
          <SudahPesanTab
            items={itemsSudahPesan}
            suppliers={suppliers}
            selectedSupplierIndex={selectedSupplierIndex}
            poFilterIndex={poFilterIndex}
            selectedItems={selectedItems}
            loading={loadingSudah}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onSupplierChange={setSelectedSupplierIndex}
            onPOFilterChange={setPoFilterIndex}
            onToggleSelection={handleToggleSelection}
            onUpdateQty={handleUpdateQtySudah}
            onMarkAsNotOrdered={handleMarkAsNotOrdered}
            onTransferToPreOrder={handleTransferToPreOrder}
            onExportPdf={handleExportToPdf}
          />
        )}
      </View>
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
  },
  refreshButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  badge: {
    marginLeft: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});

