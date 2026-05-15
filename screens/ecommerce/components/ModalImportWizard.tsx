import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import { Picker } from '@react-native-picker/picker';

interface WizardImportedProduct {
  id: number | string;
  nama: string;
  sku: string;
  stok: number;
  harga_jual: number;
  status: string;
  binded?: boolean;
  id_varian?: number | null;
  gambar?: string;
  varian_name?: string;
  imageUrl?: string;
  row_type?: string;
  variantCount?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shopId: string;
  platform: string;
  idEcommerce: number;
  shopName: string;
}

const STEP_LABELS_DEFAULT = [
  'Selamat Datang',
  'Mengambil Data',
  'Pilih Produk',
  'Bundling?',
  'Pilih Bundling',
  'Opsi Import',
  'Hasil',
];

const Checkbox = ({ checked, onPress }: { checked: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} style={styles.checkbox}>
    {checked ? (
      <Ionicons name="checkbox" size={24} color="#f59e0b" />
    ) : (
      <Ionicons name="square-outline" size={24} color="#9ca3af" />
    )}
  </TouchableOpacity>
);

export default function ModalImportWizard({
  open,
  onClose,
  shopId,
  platform,
  idEcommerce,
  shopName,
}: Props) {
  const [step, setStep] = useState(0);

  // Step 1
  const [fetchMessage, setFetchMessage] = useState('Menghubungi marketplace...');
  const [fetchDone, setFetchDone] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<{ processed: number; total: number } | null>(
    null
  );
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Step 2 & 4
  const [products, setProducts] = useState<WizardImportedProduct[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [gridPage, setGridPage] = useState(0);
  const [gridPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [searchStep2, setSearchStep2] = useState('');
  const [selectAllLoading, setSelectAllLoading] = useState(false);

  // Step 3 & 4
  const [hasBundling, setHasBundling] = useState<boolean | null>(null);
  const [bundlingIds, setBundlingIds] = useState<Array<number | string>>([]);
  const [searchStep4, setSearchStep4] = useState('');

  // Step 7 (Shopee Only)
  const [shopeeKilat, setShopeeKilat] = useState<boolean | null>(null);
  const [shopeeKilatSaving, setShopeeKilatSaving] = useState(false);
  const [shopeeKilatSaveError, setShopeeKilatSaveError] = useState<string | null>(null);

  // Step 5
  const [kodeBAlist, setKodeBAlist] = useState<{ kodeba: string; nama: string }[]>([]);
  const [nomorAkun, setNomorAkun] = useState('');
  const [importStok, setImportStok] = useState(true);
  const [skipEmptySku, setSkipEmptySku] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(
    null
  );

  // Step 6
  const [importResults, setImportResults] = useState<{
    importedCount: number;
    warningCount: number;
    failedCount: number;
    bundlingImportedCount: number;
    bundlingFailedCount: number;
    warnings: { id: any; nama?: string; reason: string }[];
    failures: { id: any; nama?: string; reason: string }[];
  } | null>(null);
  const [bindResults, setBindResults] = useState<{
    boundCount: number;
    alreadyBoundCount: number;
    failedSkuCount: number;
    autoBindAttempted: number;
  } | null>(null);
  const [isAutoBinding, setIsAutoBinding] = useState(false);

  const stepLabels =
    platform === 'SHOPEE' ? [...STEP_LABELS_DEFAULT, 'Pengiriman Kilat'] : STEP_LABELS_DEFAULT;
  const totalSteps = stepLabels.length;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFetchMessage('Menghubungi marketplace...');
    setFetchDone(false);
    setFetchError(null);
    setProducts([]);
    setProductTotal(0);
    setSelectedIds([]);
    setHasBundling(null);
    setBundlingIds([]);
    setNomorAkun('');
    setIsImporting(false);
    setImportProgress(null);
    setFetchProgress(null);
    setImportResults(null);
    setBindResults(null);
    setIsAutoBinding(false);
    setGridPage(0);
    setSearchStep2('');
    setSearchStep4('');
    setSelectAllLoading(false);
    setShopeeKilat(null);

    // Auto-resume check
    if (idEcommerce > 0) {
      ApiService.get(`/get/ecommerce/import-progress/${idEcommerce}`)
        .then((res: any) => {
          if (res.status && res.data) {
            const { import_status, message, progress } = res.data;
            if (import_status === 'in_progress') {
              setStep(1);
              setFetchMessage(message || 'Import sedang berjalan...');
              if (progress?.total) {
                setFetchProgress({ processed: progress.processed || 0, total: progress.total });
              }
              beginPolling();
            } else if (import_status === 'completed') {
              setStep(2);
              setFetchDone(true);
              loadProducts(0, '');
            }
          }
        })
        .catch(() => {});
    }

    // Fetch Bagan Akun
    ApiService.get('/get/baganakun?id_parent=31&getStop=1').then((res1: any) => {
      if (res1.status) {
        ApiService.get('/get/baganakun?id_parent=1&getStop=1').then((res2: any) => {
          const combined = [...res1.data, ...(res2.status ? res2.data : [])];
          setKodeBAlist(combined);
          if (combined.length > 0 && !nomorAkun) {
            setNomorAkun(combined[0].kodeba);
          }
        });
      }
    });

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [open, idEcommerce]);

  const loadProducts = async (page = 0, search = '', append = false) => {
    if (idEcommerce <= 0) return;
    if (!append) setLoadingProducts(true);

    try {
      let params = `id_ecommerce=${idEcommerce}&page=${page + 1}&pageSize=${gridPageSize}`;
      if (search.trim()) {
        params += `&filter=${encodeURIComponent(
          JSON.stringify({ items: [{ field: 'nama', value: search.trim() }] })
        )}`;
      }
      const res = await ApiService.get(`/get/import_barang_paged?${params}`);
      if (res.status && res.data) {
        const rows = res.data.rows || [];
        setProducts(append ? [...products, ...rows] : rows);
        setProductTotal(res.data.total || 0);
      }
    } catch (e) {
      console.error(e);
      if (!append) Alert.alert('Error', 'Gagal memuat produk');
    } finally {
      setLoadingProducts(false);
    }
  };

  const beginPolling = () => {
    const poll = async () => {
      try {
        const pr = await ApiService.get(`/get/ecommerce/import-progress/${idEcommerce}`);
        if (pr.status && pr.data) {
          const { import_status, message, progress } = pr.data;
          if (message) setFetchMessage(message);
          if (progress?.total) {
            setFetchProgress({ processed: progress.processed || 0, total: progress.total });
          }
          if (import_status === 'completed' || import_status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (import_status === 'completed') {
              setFetchDone(true);
              setFetchMessage('Data berhasil diambil!');
              loadProducts(0, '');
              setTimeout(() => setStep(2), 1000);
            } else {
              setFetchError(message || 'Import gagal');
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    pollingRef.current = setInterval(poll, 3000);
  };

  const startFetch = () => {
    setStep(1);
    setFetchDone(false);
    setFetchError(null);
    setFetchMessage('Memerintahkan marketplace...');

    ApiService.get(`/get/ecommerce/import-progress/${idEcommerce}`).then((pr: any) => {
      if (pr.status && pr.data?.import_status === 'in_progress') {
        beginPolling();
      } else {
        ApiService.get(
          `/ecommerce/import-barang?shop_id=${shopId}&platform=${platform}&id_ecommerce=${idEcommerce}`
        )
          .then((res: any) => {
            if (!res.status) {
              setFetchError(res.reason || 'Gagal memulai import');
            } else {
              beginPolling();
            }
          })
          .catch(() => setFetchError('Gagal terhubung ke server'));
      }
    });
  };

  const selectAllProducts = async (search = '') => {
    setSelectAllLoading(true);
    let params = `id_ecommerce=${idEcommerce}&getAllIds=true`;
    if (search.trim()) {
      params += `&filter=${encodeURIComponent(
        JSON.stringify({ items: [{ field: 'nama', value: search.trim() }] })
      )}`;
    }
    try {
      const res = await ApiService.get(`/get/import_barang_paged?${params}`);
      if (res.status && res.allIds) {
        const incoming = res.allIds as Array<number | string>;
        const set = new Set(selectedIds.map(String));
        incoming.forEach((id) => set.add(String(id)));
        setSelectedIds(Array.from(set));
      }
    } finally {
      setSelectAllLoading(false);
    }
  };

  const runImport = async () => {
    if (!nomorAkun) {
      Alert.alert('Error', 'Pilih nomor akun terlebih dahulu');
      return;
    }
    setIsImporting(true);

    const regularIds = hasBundling
      ? selectedIds.filter((id) => !bundlingIds.includes(id))
      : [...selectedIds];
    const bIds = hasBundling ? bundlingIds : [];

    const doImport = async (endpoint: string, ids: Array<number | string>) => {
      if (ids.length === 0) return { imported: 0, warnings: [], failures: [] };
      const CHUNK = 100;
      let imported: any[] = [];
      let warnings: any[] = [];
      let failures: any[] = [];

      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        setImportProgress({ processed: i, total: ids.length });
        try {
          const res = await ApiService.post(endpoint, {
            ids: chunk,
            baganakun: nomorAkun,
            import_stok: importStok,
            buat_baru: true,
            skip_empty_sku: skipEmptySku,
          });
          if (res.status) {
            imported = [...imported, ...(res.data?.imported_ids || [])];
            warnings = [...warnings, ...(res.reason?.warning_list || [])];
            failures = [...failures, ...(res.reason?.rejected_list || [])];
          } else if (res.reason && typeof res.reason === 'object') {
            warnings = [...warnings, ...(res.reason.warning_list || [])];
            failures = [...failures, ...(res.reason.rejected_list || [])];
          }
        } catch (e) {
          console.error(e);
        }
      }
      return { imported: imported.length, warnings, failures };
    };

    const [regular, bundlingResult] = await Promise.all([
      doImport('/import-barang', regularIds),
      doImport('/import-bundling', bIds),
    ]);

    setImportResults({
      importedCount: regular.imported,
      warningCount: regular.warnings.length,
      failedCount: regular.failures.length,
      bundlingImportedCount: bundlingResult.imported,
      bundlingFailedCount: bundlingResult.failures.length,
      warnings: regular.warnings,
      failures: regular.failures,
    });

    const skuGandaPattern = /^(sku ganda:|sku varian ganda:|sku parent varian sudah ada:)/i;
    const autoBindIds = regular.failures.filter((f) => skuGandaPattern.test(f.reason)).map((f) => f.id);

    if (autoBindIds.length > 0) {
      setIsAutoBinding(true);
      try {
        const bindRes = await ApiService.post('/bind-barang-massal', { ids: autoBindIds });
        if (bindRes.status) {
          setBindResults({
            boundCount: bindRes.data?.bound_count || 0,
            alreadyBoundCount: bindRes.data?.already_bound_count || 0,
            failedSkuCount: bindRes.data?.failed_sku_count || 0,
            autoBindAttempted: autoBindIds.length,
          });
        }
      } finally {
        setIsAutoBinding(false);
      }
    }

    try {
      ApiService.post(`/ecommerce/trigger-auto-create-penjualan/${idEcommerce}`, {});
    } catch (e) {}

    setIsImporting(false);
    setImportProgress(null);
    setStep(6);
  };

  const renderProductItem = ({ item, isBundlingStep }: { item: WizardImportedProduct; isBundlingStep: boolean }) => {
    const isSelected = isBundlingStep
      ? bundlingIds.includes(item.id)
      : selectedIds.includes(item.id);

    const toggleSelection = () => {
      if (isBundlingStep) {
        setBundlingIds((prev) =>
          prev.includes(item.id) ? prev.filter((i) => i !== item.id) : [...prev, item.id]
        );
      } else {
        setSelectedIds((prev) =>
          prev.includes(item.id) ? prev.filter((i) => i !== item.id) : [...prev, item.id]
        );
      }
    };

    return (
      <TouchableOpacity style={styles.productCard} onPress={toggleSelection}>
        <Checkbox checked={isSelected} onPress={toggleSelection} />
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image-outline" size={24} color="#9ca3af" />
          </View>
        )}
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.nama}
          </Text>
          <Text style={styles.productSku}>SKU: {item.sku || '-'}</Text>
          <View style={styles.productRow}>
            <Text style={styles.productStock}>Stok: {item.stok}</Text>
            <Text style={styles.productPrice}>Rp {Number(item.harga_jual || 0).toLocaleString('id-ID')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContainerCenter}>
            <Ionicons name="checkmark-circle" size={80} color="#10b981" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Integrasi Berhasil!</Text>
            <Text style={styles.subtitle}>
              Toko {shopName} sudah terhubung. Selanjutnya ambil data produk.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={startFetch}>
              <Text style={styles.primaryButtonText}>Mulai Import Sekarang</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Lewati, nanti saja</Text>
            </TouchableOpacity>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContainerCenter}>
            {fetchError ? (
              <>
                <Ionicons name="warning" size={60} color="#ef4444" />
                <Text style={styles.titleError}>Terjadi Kesalahan</Text>
                <Text style={styles.subtitle}>{fetchError}</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(0)}>
                  <Text style={styles.primaryButtonText}>Coba Lagi</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color="#f59e0b" style={{ marginBottom: 16 }} />
                <Text style={styles.title}>Mengambil Data Produk...</Text>
                <Text style={styles.subtitle}>{fetchMessage}</Text>
                {fetchProgress && fetchProgress.total > 0 && (
                  <Text style={styles.progressText}>
                    {fetchProgress.processed} / {fetchProgress.total}
                  </Text>
                )}
              </>
            )}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainerFull}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama / SKU..."
                value={searchStep2}
                onChangeText={(val) => {
                  setSearchStep2(val);
                  loadProducts(0, val);
                }}
              />
              <TouchableOpacity
                style={styles.outlineButtonSmall}
                onPress={() => selectAllProducts(searchStep2)}
                disabled={selectAllLoading}
              >
                {selectAllLoading ? (
                  <ActivityIndicator size="small" color="#f59e0b" />
                ) : (
                  <Text style={styles.outlineButtonTextSmall}>Pilih Semua</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.summaryText}>
              {productTotal} Produk | {selectedIds.length} Terpilih
            </Text>

            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => renderProductItem({ item, isBundlingStep: false })}
              onEndReached={() => {
                if (products.length < productTotal) {
                  const nextPage = Math.floor(products.length / gridPageSize);
                  setGridPage(nextPage);
                  loadProducts(nextPage, searchStep2, true);
                }
              }}
              onEndReachedThreshold={0.5}
            />

            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.outlineButton} onPress={() => setStep(0)}>
                <Text style={styles.outlineButtonText}>Kembali</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, selectedIds.length === 0 && styles.disabledButton]}
                onPress={() => setStep(3)}
                disabled={selectedIds.length === 0}
              >
                <Text style={styles.primaryButtonText}>Lanjut ({selectedIds.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainerCenter}>
            <Ionicons name="help-circle-outline" size={80} color="#f59e0b" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Apakah Ada Produk Bundling?</Text>
            <Text style={styles.subtitle}>
              Produk bundling adalah produk paket (misal Kopi + Gula).
            </Text>
            <View style={styles.buttonCol}>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => {
                  setHasBundling(true);
                  loadProducts(0, '');
                  setStep(4);
                }}
              >
                <Text style={styles.outlineButtonText}>Ya, Ada Bundling</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setHasBundling(false);
                  setStep(5);
                }}
              >
                <Text style={styles.primaryButtonText}>Tidak, Semua Reguler</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContainerFull}>
            <Text style={styles.title}>Tandai Produk Bundling</Text>
            <Text style={styles.subtitle}>Centang produk yang merupakan paket bundling.</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari..."
              value={searchStep4}
              onChangeText={(val) => {
                setSearchStep4(val);
                loadProducts(0, val);
              }}
            />
            <FlatList
              data={products.filter((p) => selectedIds.includes(p.id))}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => renderProductItem({ item, isBundlingStep: true })}
            />
            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.outlineButton} onPress={() => setStep(3)}>
                <Text style={styles.outlineButtonText}>Kembali</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(5)}>
                <Text style={styles.primaryButtonText}>Lanjut</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 5:
        return (
          <View style={styles.stepContainerCenter}>
            <Text style={styles.title}>Opsi Import</Text>

            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Nomor Akun *</Text>
              {/* Using Picker, or if @react-native-picker/picker is not installed, we would use a dummy view or standard Picker */}
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={nomorAkun}
                  onValueChange={(val) => setNomorAkun(val)}
                  style={{ height: 50, width: '100%' }}
                >
                  <Picker.Item label="Pilih Akun" value="" />
                  {kodeBAlist.map((ba) => (
                    <Picker.Item key={ba.kodeba} label={`${ba.nama} (${ba.kodeba})`} value={ba.kodeba} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Import Stok Marketplace?</Text>
              <TouchableOpacity
                onPress={() => setImportStok(!importStok)}
                style={importStok ? styles.toggleActive : styles.toggleInactive}
              >
                <View style={importStok ? styles.knobActive : styles.knobInactive} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Abaikan Produk Tanpa SKU?</Text>
              <TouchableOpacity
                onPress={() => setSkipEmptySku(!skipEmptySku)}
                style={skipEmptySku ? styles.toggleActive : styles.toggleInactive}
              >
                <View style={skipEmptySku ? styles.knobActive : styles.knobInactive} />
              </TouchableOpacity>
            </View>

            {isImporting && importProgress && (
              <Text style={styles.progressText}>
                Mengimpor {importProgress.processed} / {importProgress.total}
              </Text>
            )}

            <View style={[styles.footerRow, { marginTop: 20 }]}>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => setStep(hasBundling ? 4 : 3)}
                disabled={isImporting}
              >
                <Text style={styles.outlineButtonText}>Kembali</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={runImport}
                disabled={isImporting || !nomorAkun}
              >
                {isImporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Mulai Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      case 6:
        return (
          <ScrollView contentContainerStyle={styles.stepContainerCenter}>
            <Ionicons name="checkmark-circle" size={60} color="#10b981" />
            <Text style={styles.title}>Import Selesai!</Text>

            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: '#d1fae5' }]}>
                <Text style={[styles.statNumber, { color: '#047857' }]}>
                  {importResults?.importedCount || 0}
                </Text>
                <Text style={styles.statLabel}>Berhasil</Text>
              </View>
              {(importResults?.bundlingImportedCount || 0) > 0 && (
                <View style={[styles.statBox, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.statNumber, { color: '#b45309' }]}>
                    {importResults?.bundlingImportedCount}
                  </Text>
                  <Text style={styles.statLabel}>Bundling</Text>
                </View>
              )}
            </View>

            {(importResults?.failedCount || 0) > 0 && (
              <View style={[styles.statBox, { backgroundColor: '#fee2e2', marginTop: 8 }]}>
                <Text style={[styles.statNumber, { color: '#b91c1c' }]}>
                  {importResults?.failedCount}
                </Text>
                <Text style={styles.statLabel}>Gagal Import</Text>
              </View>
            )}

            {bindResults && (
              <View style={[styles.statBox, { backgroundColor: '#e0f2fe', marginTop: 8, width: '100%' }]}>
                <Text style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: 4 }}>Auto-Bind Info</Text>
                <Text style={{ color: '#0c4a6e', fontSize: 13 }}>
                  Berhasil Bind: {bindResults.boundCount}
                </Text>
                <Text style={{ color: '#0c4a6e', fontSize: 13 }}>
                  Sudah Ter-Bind: {bindResults.alreadyBoundCount}
                </Text>
              </View>
            )}

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => {
                  setImportResults(null);
                  setStep(2);
                }}
              >
                <Text style={styles.outlineButtonText}>Import Ulang</Text>
              </TouchableOpacity>

              {platform === 'SHOPEE' ? (
                <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(7)}>
                  <Text style={styles.primaryButtonText}>Lanjut (Pengiriman Kilat)</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
                  <Text style={styles.primaryButtonText}>Selesai</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        );
      case 7:
        return (
          <View style={styles.stepContainerCenter}>
            <Ionicons name="flash" size={60} color="#ef4444" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Pengiriman Kilat?</Text>
            <Text style={styles.subtitle}>
              Apakah Anda memproses Pengiriman Kilat (SPX Express)?
            </Text>

            <View style={styles.buttonCol}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#ef4444' }]}
                onPress={async () => {
                  setShopeeKilatSaving(true);
                  try {
                    await ApiService.post('/settings', { auto_process_bookings: '1' });
                    setShopeeKilat(true);
                    Alert.alert('Sukses', 'Auto Process Bookings diaktifkan');
                  } catch (e) {
                    Alert.alert('Gagal', 'Tidak dapat mengaktifkan');
                  } finally {
                    setShopeeKilatSaving(false);
                    onClose();
                  }
                }}
                disabled={shopeeKilatSaving}
              >
                {shopeeKilatSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Ya, Saya Proses Kilat</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => {
                  setShopeeKilat(false);
                  onClose();
                }}
              >
                <Text style={styles.outlineButtonText}>Tidak</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={styles.headerTitle}>{stepLabels[step]}</Text>
          <Text style={styles.headerSubtitle}>{shopName}</Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={28} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View
          style={[styles.progressBarFill, { width: `${(step / (totalSteps - 1)) * 100}%` }]}
        />
      </View>

      <View style={styles.container}>{renderStep()}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#e5e7eb',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
  },
  stepContainerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  stepContainerFull: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleError: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 160,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  outlineButtonText: {
    color: '#4b5563',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  outlineButtonSmall: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineButtonSmallText: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  outlineButtonTextSmall: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  checkbox: {
    marginRight: 12,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  productSku: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  productStock: {
    fontSize: 12,
    color: '#1f2937',
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonCol: {
    width: '100%',
    gap: 12,
  },
  pickerContainer: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  switchLabel: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  toggleActive: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    padding: 2,
  },
  toggleInactive: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    padding: 2,
  },
  knobActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  knobInactive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  progressText: {
    fontSize: 14,
    color: '#f59e0b',
    marginTop: 16,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    color: '#4b5563',
  },
});
