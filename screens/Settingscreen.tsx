import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// import * as Application from 'expo-application';
import ApiService from '../services/api';
import { API_BASE_URL } from '../services/api';
// import { useAppUpdate } from '../hooks/useAppUpdate';
// import UpdateModal from '../components/UpdateModal';

interface Props {
  navigation: any;
}

type TabType = 'GENERAL' | 'ONLINE' | 'MARKETPLACE';

const Settingscreen = ({ navigation }: Props): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabType>('GENERAL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Use app update hook
  // const {
  //   showUpdateModal,
  //   versionInfo,
  //   isUpdating,
  //   isChecking,
  //   handleUpdate,
  //   handleSkip,
  //   handleLater,
  //   checkNow,
  // } = useAppUpdate();

  // General Settings
  const [pkp, setPkp] = useState(false);
  const [columnPj, setColumnPj] = useState<{ [key: string]: boolean }>({});
  const [showPkpWarning, setShowPkpWarning] = useState(false);

  // Printer Settings
  const [namaToko, setNamaToko] = useState('');
  const [motoToko, setMotoToko] = useState('');
  const [alamatToko, setAlamatToko] = useState('');
  const [noTelpToko, setNoTelpToko] = useState('');
  const [footerToko, setFooterToko] = useState('');
  const [noRek, setNoRek] = useState('');
  const [pemilikRek, setPemilikRek] = useState('');
  const [namaBank, setNamaBank] = useState('');
  const [namaPemilik, setNamaPemilik] = useState('');

  // Online Settings
  const [syncPriceEnabled, setSyncPriceEnabled] = useState(false);
  const [syncStockEnabled, setSyncStockEnabled] = useState(false);
  const [penerbitanPenjualan, setPenerbitanPenjualan] = useState<'PESANAN_BARU' | 'DIKIRIM' | 'BELUM DIBAYAR' | null>(null);
  const [pengirimanGagal, setPengirimanGagal] = useState<'OTOMATIS' | 'MANUAL'>('OTOMATIS');
  const [pembatalan, setPembatalan] = useState<{ [platform: string]: 'OTOMATIS' | 'MANUAL' }>({
    SHOPEE: 'OTOMATIS',
    LAZADA: 'OTOMATIS',
    TOKOPEDIA: 'OTOMATIS',
    TIKTOK: 'OTOMATIS',
  });
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false);
  const [autoAcceptPlatforms, setAutoAcceptPlatforms] = useState<{ [platform: string]: boolean }>({
    SHOPEE: false,
    LAZADA: false,
    TOKOPEDIA: false,
    TIKTOK: false,
    BLIBLI: false,
  });
  const [descriptionTemplate, setDescriptionTemplate] = useState('');
  const [censoredSkus, setCensoredSkus] = useState<string[]>([]);
  const [inputSku, setInputSku] = useState('');
  const [shippingLabelSort, setShippingLabelSort] = useState<'NO_SORT' | 'SKU' | 'SKU_QTY_GROUP'>('NO_SORT');

  // Marketplace Settings
  const [marketplacePricingEnabled, setMarketplacePricingEnabled] = useState(false);
  const [basePriceSource, setBasePriceSource] = useState<'hpp' | 'hargajual2'>('hargajual2');
  const [marketplaceFeeStrategies, setMarketplaceFeeStrategies] = useState<{
    marketplace: string;
    percentage_fee: number;
    fixed_fee: number;
  }[]>([
    { marketplace: 'SHOPEE', percentage_fee: 0, fixed_fee: 0 },
    { marketplace: 'TOKOPEDIA', percentage_fee: 0, fixed_fee: 0 },
    { marketplace: 'LAZADA', percentage_fee: 0, fixed_fee: 0 },
    { marketplace: 'TIKTOK', percentage_fee: 0, fixed_fee: 0 },
  ]);
  const [tiktokCategories, setTiktokCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedTiktokCategories, setSelectedTiktokCategories] = useState<string[]>([]);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/get/settings`);
      const result = await response.json();

      if (result.status && Array.isArray(result.data)) {
        const settings = result.data;

        // Load PKP
        const pkpSetting = settings.find((s: any) => s.setting === 'pkp');
        if (pkpSetting) setPkp(pkpSetting.value === '1');

        // Load Printer Settings
        setNamaToko(settings.find((s: any) => s.setting === 'printer:nama_toko')?.value || '');
        setMotoToko(settings.find((s: any) => s.setting === 'printer:moto_toko')?.value || '');
        setAlamatToko(settings.find((s: any) => s.setting === 'printer:alamat_toko')?.value || '');
        setNoTelpToko(settings.find((s: any) => s.setting === 'printer:no_telp_toko')?.value || '');
        setFooterToko(settings.find((s: any) => s.setting === 'printer:footer_toko')?.value || '');
        setNoRek(settings.find((s: any) => s.setting === 'printer:no_rek')?.value || '');
        setPemilikRek(settings.find((s: any) => s.setting === 'printer:pemilik_rek')?.value || '');
        setNamaBank(settings.find((s: any) => s.setting === 'printer:nama_bank')?.value || '');
        setNamaPemilik(settings.find((s: any) => s.setting === 'printer:pemilik_toko')?.value || '');

        // Load Online Settings
        setSyncPriceEnabled(settings.find((s: any) => s.setting === 'sync_price')?.value === 'true');
        setSyncStockEnabled(settings.find((s: any) => s.setting === 'sync_stock')?.value === 'true');
        setPenerbitanPenjualan(settings.find((s: any) => s.setting === 'penerbitan_penjualan')?.value || null);
        setPengirimanGagal(settings.find((s: any) => s.setting === 'pengirimangagal_mode')?.value || 'OTOMATIS');
        setShippingLabelSort(settings.find((s: any) => s.setting === 'shipping_label_sort_method')?.value || 'NO_SORT');

        // Load Auto Accept
        setAutoAcceptEnabled(settings.find((s: any) => s.setting === 'auto_accept_enabled')?.value === 'true');
        const autoAcceptSettings = settings.filter((s: any) => s.setting.startsWith('auto_accept:'));
        const newAutoAccept = { ...autoAcceptPlatforms };
        autoAcceptSettings.forEach((s: any) => {
          const platform = s.setting.split(':')[1].toUpperCase();
          newAutoAccept[platform] = s.value === 'true';
        });
        setAutoAcceptPlatforms(newAutoAccept);

        // Load Pembatalan
        const pembatalanSettings = settings.filter((s: any) => s.setting.startsWith('pembatalan:'));
        const newPembatalan = { ...pembatalan };
        pembatalanSettings.forEach((s: any) => {
          const platform = s.setting.split(':')[1].toUpperCase();
          newPembatalan[platform] = s.value as 'OTOMATIS' | 'MANUAL';
        });
        setPembatalan(newPembatalan);

        // Load Description Template
        setDescriptionTemplate(settings.find((s: any) => s.setting === 'description_template')?.value || '');

        // Load Censored SKUs
        const censoredSkusSetting = settings.find((s: any) => s.setting === 'shipping_censor_skus');
        if (censoredSkusSetting?.value) {
          try {
            const parsed = JSON.parse(censoredSkusSetting.value);
            if (Array.isArray(parsed)) {
              setCensoredSkus(parsed);
            }
          } catch (e) {
            console.error('Error parsing censored SKUs:', e);
          }
        }

        // Load Marketplace Pricing
        setMarketplacePricingEnabled(settings.find((s: any) => s.setting === 'marketplace_pricing_enabled')?.value === 'true');
        setBasePriceSource(settings.find((s: any) => s.setting === 'marketplace_pricing_base_price')?.value || 'hargajual2');
        
        const feeStrategies = settings.find((s: any) => s.setting === 'marketplace_fee_strategies');
        if (feeStrategies?.value) {
          try {
            const parsed = JSON.parse(feeStrategies.value);
            if (Array.isArray(parsed)) {
              setMarketplaceFeeStrategies(parsed);
            }
          } catch (e) {
            console.error('Error parsing fee strategies:', e);
          }
        }

        // Load TikTok Categories
        const tiktokCategoriesSetting = settings.find((s: any) => s.setting === 'tiktok_default_categories');
        if (tiktokCategoriesSetting?.value) {
          try {
            const parsed = JSON.parse(tiktokCategoriesSetting.value);
            if (Array.isArray(parsed)) {
              setSelectedTiktokCategories(parsed);
            }
          } catch (e) {
            console.error('Error parsing TikTok categories:', e);
          }
        }

        // Load Kolom Penjualan
        const pjResponse = await fetch(`${API_BASE_URL}/get/penjualan/columns`);
        const pjResult = await pjResponse.json();
        if (pjResult.status && Array.isArray(pjResult.data)) {
          const columns: { [key: string]: boolean } = {};
          pjResult.data.forEach((col: string) => {
            const setting = settings.find((s: any) => s.setting === `column:penjualan:${col}`);
            columns[col] = setting?.value === '1';
          });
          // Add special columns
          columns['no_po'] = settings.find((s: any) => s.setting === 'column:penjualan:no_po')?.value === '1';
          columns['no_sj'] = settings.find((s: any) => s.setting === 'column:penjualan:no_sj')?.value === '1';
          setColumnPj(columns);
        }
      }

      // Load TikTok categories list
      try {
        const tiktokResponse = await fetch(`${API_BASE_URL}/get/tiktok/categories`);
        const tiktokResult = await tiktokResponse.json();
        if (tiktokResult.status && Array.isArray(tiktokResult.data)) {
          setTiktokCategories(tiktokResult.data);
        }
      } catch (e) {
        console.error('Error loading TikTok categories:', e);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      const settingsData: any = {};

      // General Settings
      settingsData.pkp = pkp;
      Object.entries(columnPj).forEach(([key, value]) => {
        settingsData[`column:penjualan:${key}`] = value;
      });

      // Printer Settings
      settingsData['printer:nama_toko'] = namaToko;
      settingsData['printer:moto_toko'] = motoToko;
      settingsData['printer:alamat_toko'] = alamatToko;
      settingsData['printer:no_telp_toko'] = noTelpToko;
      settingsData['printer:footer_toko'] = footerToko;
      settingsData['printer:no_rek'] = noRek;
      settingsData['printer:pemilik_rek'] = pemilikRek;
      settingsData['printer:nama_bank'] = namaBank;
      settingsData['printer:pemilik_bank'] = pemilikRek;
      settingsData['printer:pemilik_toko'] = namaPemilik;

      // Online Settings
      settingsData.sync_price = syncPriceEnabled ? 'true' : 'false';
      settingsData.sync_stock = syncStockEnabled ? 'true' : 'false';
      settingsData.penerbitan_penjualan = penerbitanPenjualan;
      settingsData.pengirimangagal_mode = pengirimanGagal;
      settingsData.shipping_label_sort_method = shippingLabelSort;
      settingsData.auto_accept_enabled = autoAcceptEnabled ? 'true' : 'false';
      settingsData.description_template = descriptionTemplate;
      settingsData.shipping_censor_skus = JSON.stringify(censoredSkus);

      Object.entries(pembatalan).forEach(([platform, mode]) => {
        settingsData[`pembatalan:${platform}`] = mode;
      });

      Object.entries(autoAcceptPlatforms).forEach(([platform, enabled]) => {
        settingsData[`auto_accept:${platform}`] = enabled ? 'true' : 'false';
      });

      // Marketplace Settings
      settingsData.marketplace_pricing_enabled = marketplacePricingEnabled ? 'true' : 'false';
      settingsData.marketplace_pricing_base_price = basePriceSource;
      settingsData.marketplace_fee_strategies = JSON.stringify(marketplaceFeeStrategies);
      settingsData.tiktok_default_categories = JSON.stringify(selectedTiktokCategories);

      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData),
      });

      const result = await response.json();

      if (result.status) {
        Alert.alert('Success', 'Settings saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const addCensoredSku = () => {
    const sku = inputSku.trim().toUpperCase();
    if (sku && !censoredSkus.includes(sku)) {
      setCensoredSkus([...censoredSkus, sku]);
      setInputSku('');
    }
  };

  const removeCensoredSku = (sku: string) => {
    setCensoredSkus(censoredSkus.filter((s) => s !== sku));
  };

  const toggleTiktokCategory = (categoryId: string) => {
    if (selectedTiktokCategories.includes(categoryId)) {
      setSelectedTiktokCategories(selectedTiktokCategories.filter((id) => id !== categoryId));
    } else {
      setSelectedTiktokCategories([...selectedTiktokCategories, categoryId]);
    }
  };

  const handleSyncStock = async () => {
    try {
      Alert.alert('Sync Stock', 'This will sync stock to all marketplaces. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: async () => {
            const response = await fetch(`${API_BASE_URL}/get/ecommerce/stock/sync`);
            const result = await response.json();
            if (result.status) {
              Alert.alert('Success', 'Stock synced successfully!');
            } else {
              Alert.alert('Error', 'Failed to sync stock');
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to sync stock');
    }
  };

  const handleSyncPrice = async () => {
    try {
      Alert.alert('Sync Price', 'This will sync prices to all marketplaces. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: async () => {
            const response = await fetch(`${API_BASE_URL}/get/ecommerce/price/sync`);
            const result = await response.json();
            if (result.status) {
              Alert.alert('Success', 'Prices synced successfully!');
            } else {
              Alert.alert('Error', 'Failed to sync prices');
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to sync prices');
    }
  };

  const renderTabButton = (tab: TabType, label: string, icon: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons name={icon as any} size={20} color={activeTab === tab ? '#f59e0b' : '#999'} />
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderGeneralTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* App Version & Update - Temporarily disabled */}
      {/* <View style={styles.card}>
        <Text style={styles.cardTitle}>App Version</Text>
        <View style={styles.versionContainer}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Current Version:</Text>
            <Text style={styles.versionValue}>{Application.nativeApplicationVersion || '1.0.0'}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Build Number:</Text>
            <Text style={styles.versionValue}>{Application.nativeBuildVersion || '1'}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.checkUpdateButton, isChecking && styles.checkUpdateButtonDisabled]} 
          onPress={checkNow}
          disabled={isChecking}
        >
          {isChecking ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.checkUpdateButtonText}>Checking...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={20} color="#fff" />
              <Text style={styles.checkUpdateButtonText}>Check for Updates</Text>
            </>
          )}
        </TouchableOpacity>
      </View> */}

      {/* PKP Setting */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>PKP (Pengusaha Kena Pajak)</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Enable PKP</Text>
            <Text style={styles.settingHint}>Tax registered business</Text>
          </View>
          <Switch
            value={pkp}
            onValueChange={(value) => {
              if (value && !pkp) {
                Alert.alert(
                  'Activate PKP',
                  'Once activated, PKP cannot be deactivated. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Activate', onPress: () => setPkp(true) },
                  ]
                );
              } else if (!value && pkp) {
                Alert.alert('Warning', 'PKP cannot be deactivated once enabled');
              }
            }}
            trackColor={{ false: '#ddd', true: '#f59e0b' }}
          />
        </View>
      </View>

      {/* Kolom Penjualan */}
      <TouchableOpacity style={styles.card} onPress={() => toggleSection('kolom_penjualan')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Kolom Penjualan</Text>
          <Ionicons
            name={expandedSections['kolom_penjualan'] ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expandedSections['kolom_penjualan'] && (
        <View style={styles.expandedCard}>
          {Object.entries(columnPj).map(([key, value]) => (
            <View key={key} style={styles.settingRow}>
              <Text style={styles.settingLabel}>{key}</Text>
              <Switch
                value={value}
                onValueChange={(newValue) => setColumnPj({ ...columnPj, [key]: newValue })}
                trackColor={{ false: '#ddd', true: '#f59e0b' }}
              />
            </View>
          ))}
        </View>
      )}

      {/* Printer Settings */}
      <TouchableOpacity style={styles.card} onPress={() => toggleSection('printer')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Printer Settings</Text>
          <Ionicons
            name={expandedSections['printer'] ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expandedSections['printer'] && (
        <View style={styles.expandedCard}>
          <TextInput
            style={styles.input}
            placeholder="Nama Toko"
            placeholderTextColor="#999"
            value={namaToko}
            onChangeText={setNamaToko}
          />
          <TextInput
            style={styles.input}
            placeholder="Moto Toko"
            placeholderTextColor="#999"
            value={motoToko}
            onChangeText={setMotoToko}
          />
          <TextInput
            style={styles.input}
            placeholder="Nama Pemilik"
            placeholderTextColor="#999"
            value={namaPemilik}
            onChangeText={setNamaPemilik}
          />
          <TextInput
            style={styles.input}
            placeholder="Alamat Toko"
            placeholderTextColor="#999"
            value={alamatToko}
            onChangeText={setAlamatToko}
          />
          <TextInput
            style={styles.input}
            placeholder="No Telp"
            placeholderTextColor="#999"
            value={noTelpToko}
            onChangeText={setNoTelpToko}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Footer Struk"
            placeholderTextColor="#999"
            value={footerToko}
            onChangeText={setFooterToko}
            multiline
            numberOfLines={3}
          />
          <TextInput
            style={styles.input}
            placeholder="No Rekening"
            placeholderTextColor="#999"
            value={noRek}
            onChangeText={setNoRek}
          />
          <TextInput
            style={styles.input}
            placeholder="Pemilik Rekening"
            placeholderTextColor="#999"
            value={pemilikRek}
            onChangeText={setPemilikRek}
          />
          <TextInput
            style={styles.input}
            placeholder="Nama Bank"
            placeholderTextColor="#999"
            value={namaBank}
            onChangeText={setNamaBank}
          />
        </View>
      )}
    </ScrollView>
  );

  const renderOnlineTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Sync Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync Settings</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Sync Price</Text>
            <Text style={styles.settingHint}>Auto sync prices to marketplaces</Text>
          </View>
          <Switch
            value={syncPriceEnabled}
            onValueChange={setSyncPriceEnabled}
            trackColor={{ false: '#ddd', true: '#f59e0b' }}
          />
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Sync Stock</Text>
            <Text style={styles.settingHint}>Auto sync stock to marketplaces</Text>
          </View>
          <Switch
            value={syncStockEnabled}
            onValueChange={setSyncStockEnabled}
            trackColor={{ false: '#ddd', true: '#f59e0b' }}
          />
        </View>
        <TouchableOpacity style={styles.syncButton} onPress={handleSyncStock}>
          <Ionicons name="sync" size={20} color="#fff" />
          <Text style={styles.syncButtonText}>Sync Stock Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.syncButton} onPress={handleSyncPrice}>
          <Ionicons name="sync" size={20} color="#fff" />
          <Text style={styles.syncButtonText}>Sync Price Now</Text>
        </TouchableOpacity>
      </View>

      {/* Shipping Label Sort */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shipping Label Sort</Text>
        <Text style={styles.settingHint}>Choose how labels should be ordered</Text>
        <View style={styles.radioGroup}>
          {[
            { value: 'NO_SORT', label: 'No Sort (Original order)' },
            { value: 'SKU', label: 'Sort by SKU (alphabetical)' },
            { value: 'SKU_QTY_GROUP', label: 'Sort by SKU + Qty Grouping' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.radioOption}
              onPress={() => setShippingLabelSort(option.value as any)}
            >
              <View style={styles.radio}>
                {shippingLabelSort === option.value && <View style={styles.radioSelected} />}
              </View>
              <Text style={styles.radioLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Penerbitan Penjualan */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Penerbitan Penjualan</Text>
        <Text style={styles.settingHint}>Sales status from marketplace</Text>
        <View style={styles.radioGroup}>
          {[
            { value: 'PESANAN_BARU', label: 'Pesanan Baru' },
            { value: 'DIKIRIM', label: 'Dikirim' },
            { value: 'BELUM DIBAYAR', label: 'Belum Dibayar' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.radioOption}
              onPress={() => setPenerbitanPenjualan(option.value as any)}
            >
              <View style={styles.radio}>
                {penerbitanPenjualan === option.value && <View style={styles.radioSelected} />}
              </View>
              <Text style={styles.radioLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pengiriman Gagal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pengiriman Gagal Mode</Text>
        <View style={styles.radioGroup}>
          {['OTOMATIS', 'MANUAL'].map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.radioOption}
              onPress={() => setPengirimanGagal(option as any)}
            >
              <View style={styles.radio}>
                {pengirimanGagal === option && <View style={styles.radioSelected} />}
              </View>
              <Text style={styles.radioLabel}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pembatalan */}
      <TouchableOpacity style={styles.card} onPress={() => toggleSection('pembatalan')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Pembatalan Mode</Text>
          <Ionicons
            name={expandedSections['pembatalan'] ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expandedSections['pembatalan'] && (
        <View style={styles.expandedCard}>
          {Object.entries(pembatalan).map(([platform, mode]) => (
            <View key={platform} style={styles.platformSetting}>
              <Text style={styles.platformLabel}>{platform}</Text>
              <View style={styles.radioGroup}>
                {['OTOMATIS', 'MANUAL'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setPembatalan({ ...pembatalan, [platform]: option as any })}
                  >
                    <View style={styles.radio}>
                      {mode === option && <View style={styles.radioSelected} />}
                    </View>
                    <Text style={styles.radioLabel}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Auto Accept */}
      <TouchableOpacity style={styles.card} onPress={() => toggleSection('auto_accept')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Auto Order Acceptance</Text>
          <Ionicons
            name={expandedSections['auto_accept'] ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expandedSections['auto_accept'] && (
        <View style={styles.expandedCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Enable Auto Accept</Text>
            <Switch
              value={autoAcceptEnabled}
              onValueChange={setAutoAcceptEnabled}
              trackColor={{ false: '#ddd', true: '#f59e0b' }}
            />
          </View>
          {Object.entries(autoAcceptPlatforms).map(([platform, enabled]) => (
            <View key={platform} style={styles.settingRow}>
              <Text style={styles.settingLabel}>{platform}</Text>
              <Switch
                value={enabled}
                onValueChange={(value) =>
                  setAutoAcceptPlatforms({ ...autoAcceptPlatforms, [platform]: value })
                }
                trackColor={{ false: '#ddd', true: '#f59e0b' }}
                disabled={!autoAcceptEnabled}
              />
            </View>
          ))}
        </View>
      )}

      {/* Description Template */}
      <TouchableOpacity style={styles.card} onPress={() => toggleSection('description')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Description Template</Text>
          <Ionicons
            name={expandedSections['description'] ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expandedSections['description'] && (
        <View style={styles.expandedCard}>
          <Text style={styles.settingHint}>Use {'{sku}'} to insert SKU in description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter description template..."
            placeholderTextColor="#999"
            value={descriptionTemplate}
            onChangeText={setDescriptionTemplate}
            multiline
            numberOfLines={4}
          />
        </View>
      )}

      {/* Censored SKUs */}
      <TouchableOpacity style={styles.card} onPress={() => toggleSection('censored_skus')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Censored SKUs (Shipping)</Text>
          <Ionicons
            name={expandedSections['censored_skus'] ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expandedSections['censored_skus'] && (
        <View style={styles.expandedCard}>
          <Text style={styles.settingHint}>Hide product names on shipping receipts</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.flexInput]}
              placeholder="Enter SKU..."
              placeholderTextColor="#999"
              value={inputSku}
              onChangeText={setInputSku}
            />
            <TouchableOpacity style={styles.addButton} onPress={addCensoredSku}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.chipContainer}>
            {censoredSkus.map((sku) => (
              <View key={sku} style={styles.chip}>
                <Text style={styles.chipText}>{sku}</Text>
                <TouchableOpacity onPress={() => removeCensoredSku(sku)}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderMarketplaceTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Marketplace Pricing */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Marketplace Pricing Strategies</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Enable Custom Pricing</Text>
            <Text style={styles.settingHint}>Different prices per marketplace</Text>
          </View>
          <Switch
            value={marketplacePricingEnabled}
            onValueChange={setMarketplacePricingEnabled}
            trackColor={{ false: '#ddd', true: '#f59e0b' }}
          />
        </View>
      </View>

      {marketplacePricingEnabled && (
        <>
          {/* Base Price Source */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Base Price Source</Text>
            <View style={styles.radioGroup}>
              {[
                { value: 'hpp', label: 'HPP (Cost Price)' },
                { value: 'hargajual2', label: 'Harga Jual 2' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.radioOption}
                  onPress={() => setBasePriceSource(option.value as any)}
                >
                  <View style={styles.radio}>
                    {basePriceSource === option.value && <View style={styles.radioSelected} />}
                  </View>
                  <Text style={styles.radioLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Marketplace Fees */}
          <TouchableOpacity style={styles.card} onPress={() => toggleSection('marketplace_fees')}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Marketplace Fees</Text>
              <Ionicons
                name={expandedSections['marketplace_fees'] ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#666"
              />
            </View>
          </TouchableOpacity>
          {expandedSections['marketplace_fees'] && (
            <View style={styles.expandedCard}>
              {marketplaceFeeStrategies.map((strategy, index) => (
                <View key={strategy.marketplace} style={styles.feeStrategy}>
                  <Text style={styles.platformLabel}>{strategy.marketplace}</Text>
                  <View style={styles.feeInputRow}>
                    <View style={styles.feeInputContainer}>
                      <Text style={styles.feeLabel}>Percentage (%)</Text>
                      <TextInput
                        style={styles.feeInput}
                        placeholder="0"
                        placeholderTextColor="#999"
                        value={strategy.percentage_fee.toString()}
                        onChangeText={(text) => {
                          const newStrategies = [...marketplaceFeeStrategies];
                          newStrategies[index].percentage_fee = parseFloat(text) || 0;
                          setMarketplaceFeeStrategies(newStrategies);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.feeInputContainer}>
                      <Text style={styles.feeLabel}>Fixed Fee (Rp)</Text>
                      <TextInput
                        style={styles.feeInput}
                        placeholder="0"
                        placeholderTextColor="#999"
                        value={strategy.fixed_fee.toString()}
                        onChangeText={(text) => {
                          const newStrategies = [...marketplaceFeeStrategies];
                          newStrategies[index].fixed_fee = parseFloat(text) || 0;
                          setMarketplaceFeeStrategies(newStrategies);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* TikTok Categories */}
      <TouchableOpacity style={styles.card} onPress={() => toggleSection('tiktok_categories')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>TikTok Default Categories</Text>
          <Ionicons
            name={expandedSections['tiktok_categories'] ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expandedSections['tiktok_categories'] && (
        <View style={styles.expandedCard}>
          <Text style={styles.settingHint}>Select default categories for TikTok Shop</Text>
          <ScrollView style={styles.categoryList} nestedScrollEnabled>
            {tiktokCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryItem}
                onPress={() => toggleTiktokCategory(category.id)}
              >
                <Text style={styles.categoryText}>{category.name}</Text>
                {selectedTiktokCategories.includes(category.id) && (
                  <Ionicons name="checkmark-circle" size={24} color="#f59e0b" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Settings</Text>
        <TouchableOpacity style={styles.saveButton} onPress={saveSettings} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="checkmark" size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTabButton('GENERAL', 'General', 'settings-outline')}
        {renderTabButton('ONLINE', 'Online', 'cloud-outline')}
        {renderTabButton('MARKETPLACE', 'Marketplace', 'storefront-outline')}
      </View>

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'GENERAL' && renderGeneralTab()}
        {activeTab === 'ONLINE' && renderOnlineTab()}
        {activeTab === 'MARKETPLACE' && renderMarketplaceTab()}
      </View>

      {/* Update Modal */}
      {/* <UpdateModal
        visible={showUpdateModal}
        versionInfo={versionInfo}
        onUpdate={handleUpdate}
        onSkip={handleSkip}
        onLater={handleLater}
        isUpdating={isUpdating}
      /> */}

      {/* PKP Warning Modal */}
      <Modal visible={showPkpWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="warning" size={48} color="#f59e0b" />
            <Text style={styles.modalTitle}>Warning</Text>
            <Text style={styles.modalText}>PKP cannot be deactivated once enabled.</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowPkpWarning(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: { padding: 10 },
  headerText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  saveButton: { padding: 10 },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: { backgroundColor: '#FEF3C7' },
  tabButtonText: { fontSize: 12, color: '#999', fontWeight: '600' },
  tabButtonTextActive: { color: '#f59e0b' },
  contentContainer: { flex: 1, marginTop: 20 },
  tabContent: { flex: 1, paddingHorizontal: 20 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  expandedCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginTop: -8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLeft: { flex: 1 },
  settingLabel: { fontSize: 14, color: '#333', fontWeight: '500' },
  settingHint: { fontSize: 12, color: '#999', marginTop: 2 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: '#333',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  radioGroup: { marginTop: 8 },
  radioOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#f59e0b',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#f59e0b' },
  radioLabel: { fontSize: 14, color: '#333' },
  platformSetting: { marginBottom: 16 },
  platformLabel: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  syncButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  syncButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  flexInput: { flex: 1, marginBottom: 0 },
  addButton: {
    backgroundColor: '#f59e0b',
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: { fontSize: 12, color: '#333' },
  feeStrategy: { marginBottom: 16 },
  feeInputRow: { flexDirection: 'row', gap: 12 },
  feeInputContainer: { flex: 1 },
  feeLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  feeInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, fontSize: 14, color: '#333' },
  categoryList: { maxHeight: 300 },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryText: { fontSize: 14, color: '#333', flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  modalText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  modalButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  versionContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  versionValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
  checkUpdateButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  checkUpdateButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  checkUpdateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Settingscreen;
