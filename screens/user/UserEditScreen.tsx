import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ApiService from '../../services/api';
import type { AppStackParamList } from '../../navigation/RootNavigator';

// Permission structure matching web User.tsx
type Permissions = {
  actions: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  visibility?: {
    hide_harga_beli: boolean;
  };
  master: {
    barang: boolean;
    supplier: boolean;
    customer: boolean;
    satuan: boolean;
    baganakun: boolean;
    user: boolean;
    upload: boolean;
    varian: boolean;
    bundling: boolean;
    import_barang: boolean;
    show_hpp: boolean;
    warehouse: boolean;
  };
  transaksi: {
    pembelian: {
      tambah: boolean;
      search: boolean;
      pelunasan: boolean;
      retur: boolean;
      dp_beli: boolean;
    };
    penjualan: {
      tambah: boolean;
      search: boolean;
      pelunasan: boolean;
      retur: boolean;
    };
    jurnal: {
      tambah: boolean;
      search: boolean;
    };
    detailbaganakun: boolean;
    stokopname: boolean;
    pesanbarang: boolean;
    pc_masuk: boolean;
    spb: boolean;
    pc_keluar: boolean;
    retur_service: boolean;
  };
  laporan: {
    pembelian: boolean;
    neracasaldo: boolean;
    neraca: boolean;
    labarugi: boolean;
    laporanbarang: boolean;
    iklan: boolean;
  };
  setting: boolean;
  ecommerce: {
    pesanan: boolean;
    ecommerce_chat: boolean;
    notifikasi: boolean;
    penarikan: boolean;
    labarugi_online: boolean;
    integration: boolean;
    returonline: boolean;
    booking_orders: boolean;
    ecommerce_tools: {
      product: boolean;
    };
  };
  customer: {
    rakitpc: boolean;
  };
};

type Ecommerce = {
  id: number;
  name: string;
  platform: string;
  status: string;
};

type Props = NativeStackScreenProps<AppStackParamList, 'UserEdit'>;

type Access = { access?: { master?: { user?: boolean } } };

const defaultPermissions: Permissions = {
  actions: { read: false, create: false, update: false, delete: false },
  visibility: { hide_harga_beli: false },
  master: {
    barang: false,
    supplier: false,
    customer: false,
    satuan: false,
    baganakun: false,
    user: false,
    upload: false,
    varian: false,
    bundling: false,
    import_barang: false,
    show_hpp: false,
    warehouse: false,
  },
  transaksi: {
    pembelian: { tambah: false, search: false, pelunasan: false, retur: false, dp_beli: false },
    penjualan: { tambah: false, search: false, pelunasan: false, retur: false },
    jurnal: { tambah: false, search: false },
    detailbaganakun: false,
    stokopname: false,
    pesanbarang: false,
    pc_masuk: false,
    spb: false,
    pc_keluar: false,
    retur_service: false,
  },
  laporan: {
    pembelian: false,
    neracasaldo: false,
    neraca: false,
    labarugi: false,
    laporanbarang: false,
    iklan: false,
  },
  setting: false,
  ecommerce: {
    pesanan: false,
    ecommerce_chat: false,
    notifikasi: false,
    penarikan: false,
    labarugi_online: false,
    integration: false,
    returonline: false,
    booking_orders: false,
    ecommerce_tools: { product: false },
  },
  customer: { rakitpc: false },
};

export default function UserEditScreen({ route, navigation }: Props): JSX.Element {
  const email = route.params?.email;
  const isNew = !email;

  const [access, setAccess] = useState<Access['access']>();
  const [userEmail, setUserEmail] = useState(email || '');
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);
  const [aksesMP, setAksesMP] = useState<number[]>([]);
  const [ecommerceList, setEcommerceList] = useState<Ecommerce[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState(isNew); // Show search button when creating new user
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    actions: true,
    visibility: false,
    master: false,
    transaksi: false,
    laporan: false,
    setting: false,
    ecommerce: false,
    customer: false,
    marketplace: false,
  });

  useEffect(() => {
    const fetchAccess = async () => {
      try {
        const res = await ApiService.authenticatedRequest('/access');
        if (res?.status) setAccess(res.access);
      } catch (e) {
        console.error('Error fetching access', e);
      }
    };
    fetchAccess();
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Undang User' : 'Edit User Permissions' });
  }, [isNew, navigation]);

  useEffect(() => {
    const loadEcommerce = async () => {
      try {
        const res = await ApiService.authenticatedRequest('/get/ecommerce');
        if (res?.data) {
          const approved = res.data.filter((e: any) => e.status === 'APPROVED');
          setEcommerceList(approved);
        }
      } catch (e) {
        console.error('Load ecommerce error', e);
      }
    };
    loadEcommerce();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!email) return;
      try {
        const res = await ApiService.authenticatedRequest('/get/user');
        if (res?.status && res.data) {
          const found = res.data.find((u: any) => u.email === email);
          if (found) {
            setUserEmail(found.email);
            
            // Merge loaded permissions with defaults to ensure all fields exist
            const loadedPerms = { ...defaultPermissions, ...found.akses };
            if (!loadedPerms.visibility) loadedPerms.visibility = { hide_harga_beli: false };
            
            setPermissions(loadedPerms);
            setAksesMP(found.akses_mp || []);
          }
        }
      } catch (e) {
        console.error('Load user error', e);
      }
    };
    load();
  }, [email]);

  // Reset search mode when email changes (allow searching again)
  useEffect(() => {
    if (isNew && userEmail && !email) {
      setSearchMode(true);
    }
  }, [userEmail, isNew, email]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail || ''), [userEmail]);

  const hasUserAccess = access?.master?.user;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleMarketplace = (id: number) => {
    setAksesMP(prev => 
      prev.includes(id) ? prev.filter(mpId => mpId !== id) : [...prev, id]
    );
  };

  const onSearchUser = async () => {
    if (!emailValid) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await ApiService.authenticatedRequest('/get/user');
      if (res?.status && res.data) {
        const found = res.data.find((u: any) => u.email === userEmail);
        if (found) {
          // User found - load their data
          const loadedPerms = { ...defaultPermissions, ...found.akses };
          if (!loadedPerms.visibility) loadedPerms.visibility = { hide_harga_beli: false };
          
          setPermissions(loadedPerms);
          setAksesMP(found.akses_mp || []);
          setSearchMode(false); // Hide search button, show save
          Alert.alert('Success', `User ${userEmail} ditemukan. Anda bisa edit permissions nya.`);
        } else {
          Alert.alert('Not Found', 'User tidak ditemukan di toko ini. Anda bisa undang user baru dengan email ini.');
          setSearchMode(false); // Allow invite new user
        }
      }
    } catch (e) {
      console.error('Search user error', e);
      Alert.alert('Error', 'Gagal mencari user');
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!hasUserAccess) {
      Alert.alert('Permission', 'You do not have permission to manage users');
      return;
    }
    
    if (!emailValid) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      if (isNew) {
        // Check if user already exists first
        const checkRes = await ApiService.authenticatedRequest('/get/user');
        if (checkRes?.status && checkRes.data) {
          const existingUser = checkRes.data.find((u: any) => u.email === userEmail);
          if (existingUser) {
            Alert.alert('Error', 'Tidak bisa undang, user sudah bagian dari toko');
            setLoading(false);
            return;
          }
        }

        // Invite new user using /user/add endpoint (matching web)
        const res = await ApiService.authenticatedRequest('/user/add', {
          method: 'POST',
          body: JSON.stringify({
            email: userEmail,
            access: permissions,
            access_mp: aksesMP,
          }),
        });
        if (res?.status) {
          Alert.alert('Success', 'User berhasil diundang');
          navigation.navigate('UserList');
        } else {
          Alert.alert('Error', res?.reason || 'Gagal mengundang user');
        }
      } else {
        // Update existing user using /user endpoint (matching web)
        const res = await ApiService.authenticatedRequest('/user', {
          method: 'POST',
          body: JSON.stringify({
            email: userEmail,
            akses: permissions,
            akses_mp: aksesMP,
          }),
        });
        if (res?.status) {
          Alert.alert('Success', 'Permissions updated');
          navigation.navigate('UserList');
        } else {
          Alert.alert('Error', res?.reason || 'Failed to update permissions');
        }
      }
    } catch (e) {
      console.error('Save error', e);
      Alert.alert('Error', 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = () => {
    if (!hasUserAccess) {
      Alert.alert('Permission', 'You do not have permission to delete users');
      return;
    }
    Alert.alert('Hapus User', `Apakah Anda yakin ingin menghapus ${userEmail}?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: doDelete },
    ]);
  };

  const doDelete = async () => {
    try {
      const res = await ApiService.authenticatedRequest('/user', {
        method: 'DELETE',
        body: JSON.stringify({ email: userEmail }),
      });
      if (res?.status) {
        Alert.alert('Deleted', 'User berhasil dihapus');
        navigation.navigate('UserList');
      } else {
        Alert.alert('Error', res?.reason || 'Gagal menghapus user');
      }
    } catch (e) {
      console.error('Delete error', e);
      Alert.alert('Error', 'Terjadi kesalahan');
    }
  };

  const renderCheckbox = (label: string, value: boolean, onChange: (val: boolean) => void) => (
    <View style={styles.checkboxRow}>
      <Text style={styles.checkboxLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
        thumbColor={value ? '#f59e0b' : '#f4f4f5'}
      />
    </View>
  );

  const renderCollapsibleSection = (title: string, key: string, icon: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(key)}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon as any} size={20} color="#f59e0b" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Ionicons 
          name={expandedSections[key] ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#6b7280" 
        />
      </TouchableOpacity>
      {expandedSections[key] && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Email Input with Search Button */}
        <View style={styles.emailCard}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.emailInputRow}>
            <TextInput
              style={[styles.inputWithButton, !emailValid && userEmail.length > 0 && styles.invalid]}
              value={userEmail}
              onChangeText={setUserEmail}
              placeholder="user@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              editable={isNew || searchMode}
            />
            {isNew && searchMode && (
              <TouchableOpacity 
                style={[styles.searchButton, (!emailValid || loading) && styles.buttonDisabled]} 
                onPress={onSearchUser}
                disabled={!emailValid || loading}
              >
                <Ionicons name="search" size={20} color="white" />
                <Text style={styles.searchButtonText}>Cari</Text>
              </TouchableOpacity>
            )}
          </View>
          {!emailValid && userEmail.length > 0 && (
            <Text style={styles.errorText}>Email tidak valid</Text>
          )}
          {isNew && !searchMode && (
            <Text style={styles.hintText}>
              Mode: {userEmail ? 'Undang user baru dengan email ini' : 'Masukkan email untuk cari atau undang user'}
            </Text>
          )}
        </View>

        {/* CRUD Actions */}
        {renderCollapsibleSection('CRUD Permissions', 'actions', 'shield-checkmark-outline', (
          <>
            {renderCheckbox('Create', permissions.actions.create, (v) => 
              setPermissions(p => ({ ...p, actions: { ...p.actions, create: v } }))
            )}
            {renderCheckbox('Read', permissions.actions.read, (v) => 
              setPermissions(p => ({ ...p, actions: { ...p.actions, read: v } }))
            )}
            {renderCheckbox('Update', permissions.actions.update, (v) => 
              setPermissions(p => ({ ...p, actions: { ...p.actions, update: v } }))
            )}
            {renderCheckbox('Delete', permissions.actions.delete, (v) => 
              setPermissions(p => ({ ...p, actions: { ...p.actions, delete: v } }))
            )}
          </>
        ))}

        {/* Visibility */}
        {renderCollapsibleSection('Visibility Settings', 'visibility', 'eye-outline', (
          <>
            {renderCheckbox('Hide Harga Beli (PENJUALAN)', permissions.visibility?.hide_harga_beli || false, (v) => 
              setPermissions(p => ({ ...p, visibility: { ...p.visibility, hide_harga_beli: v } }))
            )}
          </>
        ))}

        {/* Master */}
        {renderCollapsibleSection('Master', 'master', 'filing-outline', (
          <>
            {renderCheckbox('Barang', permissions.master.barang, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, barang: v } }))
            )}
            {renderCheckbox('Supplier', permissions.master.supplier, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, supplier: v } }))
            )}
            {renderCheckbox('Customer', permissions.master.customer, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, customer: v } }))
            )}
            {renderCheckbox('Satuan', permissions.master.satuan, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, satuan: v } }))
            )}
            {renderCheckbox('Bagan Akun', permissions.master.baganakun, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, baganakun: v } }))
            )}
            {renderCheckbox('User', permissions.master.user, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, user: v } }))
            )}
            {renderCheckbox('Upload', permissions.master.upload, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, upload: v } }))
            )}
            {renderCheckbox('Varian', permissions.master.varian, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, varian: v } }))
            )}
            {renderCheckbox('Bundling', permissions.master.bundling, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, bundling: v } }))
            )}
            {renderCheckbox('Import Barang', permissions.master.import_barang, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, import_barang: v } }))
            )}
            {renderCheckbox('Show HPP', permissions.master.show_hpp, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, show_hpp: v } }))
            )}
            {renderCheckbox('Warehouse', permissions.master.warehouse, (v) => 
              setPermissions(p => ({ ...p, master: { ...p.master, warehouse: v } }))
            )}
          </>
        ))}

        {/* Transaksi */}
        {renderCollapsibleSection('Transaksi', 'transaksi', 'swap-horizontal-outline', (
          <>
            <Text style={styles.subSectionTitle}>Pembelian</Text>
            {renderCheckbox('Tambah', permissions.transaksi.pembelian.tambah, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pembelian: { ...p.transaksi.pembelian, tambah: v } } }))
            )}
            {renderCheckbox('Search', permissions.transaksi.pembelian.search, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pembelian: { ...p.transaksi.pembelian, search: v } } }))
            )}
            {renderCheckbox('Pelunasan', permissions.transaksi.pembelian.pelunasan, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pembelian: { ...p.transaksi.pembelian, pelunasan: v } } }))
            )}
            {renderCheckbox('Retur', permissions.transaksi.pembelian.retur, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pembelian: { ...p.transaksi.pembelian, retur: v } } }))
            )}
            {renderCheckbox('DP Beli', permissions.transaksi.pembelian.dp_beli, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pembelian: { ...p.transaksi.pembelian, dp_beli: v } } }))
            )}

            <View style={styles.divider} />
            <Text style={styles.subSectionTitle}>Penjualan</Text>
            {renderCheckbox('Tambah', permissions.transaksi.penjualan.tambah, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, penjualan: { ...p.transaksi.penjualan, tambah: v } } }))
            )}
            {renderCheckbox('Search', permissions.transaksi.penjualan.search, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, penjualan: { ...p.transaksi.penjualan, search: v } } }))
            )}
            {renderCheckbox('Pelunasan', permissions.transaksi.penjualan.pelunasan, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, penjualan: { ...p.transaksi.penjualan, pelunasan: v } } }))
            )}
            {renderCheckbox('Retur', permissions.transaksi.penjualan.retur, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, penjualan: { ...p.transaksi.penjualan, retur: v } } }))
            )}

            <View style={styles.divider} />
            <Text style={styles.subSectionTitle}>Jurnal</Text>
            {renderCheckbox('Tambah', permissions.transaksi.jurnal.tambah, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, jurnal: { ...p.transaksi.jurnal, tambah: v } } }))
            )}
            {renderCheckbox('Search', permissions.transaksi.jurnal.search, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, jurnal: { ...p.transaksi.jurnal, search: v } } }))
            )}

            <View style={styles.divider} />
            <Text style={styles.subSectionTitle}>Lainnya</Text>
            {renderCheckbox('Detail Bagan Akun', permissions.transaksi.detailbaganakun, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, detailbaganakun: v } }))
            )}
            {renderCheckbox('Stok Opname', permissions.transaksi.stokopname, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, stokopname: v } }))
            )}
            {renderCheckbox('Pesan Barang', permissions.transaksi.pesanbarang, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pesanbarang: v } }))
            )}
            {renderCheckbox('PC Masuk', permissions.transaksi.pc_masuk, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pc_masuk: v } }))
            )}
            {renderCheckbox('SPB', permissions.transaksi.spb, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, spb: v } }))
            )}
            {renderCheckbox('PC Keluar', permissions.transaksi.pc_keluar, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, pc_keluar: v } }))
            )}
            {renderCheckbox('Retur Service', permissions.transaksi.retur_service, (v) => 
              setPermissions(p => ({ ...p, transaksi: { ...p.transaksi, retur_service: v } }))
            )}
          </>
        ))}

        {/* Laporan */}
        {renderCollapsibleSection('Laporan', 'laporan', 'document-text-outline', (
          <>
            {renderCheckbox('Pembelian', permissions.laporan.pembelian, (v) => 
              setPermissions(p => ({ ...p, laporan: { ...p.laporan, pembelian: v } }))
            )}
            {renderCheckbox('Neraca Saldo', permissions.laporan.neracasaldo, (v) => 
              setPermissions(p => ({ ...p, laporan: { ...p.laporan, neracasaldo: v } }))
            )}
            {renderCheckbox('Neraca', permissions.laporan.neraca, (v) => 
              setPermissions(p => ({ ...p, laporan: { ...p.laporan, neraca: v } }))
            )}
            {renderCheckbox('Laba Rugi', permissions.laporan.labarugi, (v) => 
              setPermissions(p => ({ ...p, laporan: { ...p.laporan, labarugi: v } }))
            )}
            {renderCheckbox('Laporan Barang', permissions.laporan.laporanbarang, (v) => 
              setPermissions(p => ({ ...p, laporan: { ...p.laporan, laporanbarang: v } }))
            )}
            {renderCheckbox('Iklan', permissions.laporan.iklan, (v) => 
              setPermissions(p => ({ ...p, laporan: { ...p.laporan, iklan: v } }))
            )}
          </>
        ))}

        {/* Settings */}
        {renderCollapsibleSection('Settings', 'setting', 'settings-outline', (
          <>
            {renderCheckbox('Settings', permissions.setting, (v) => 
              setPermissions(p => ({ ...p, setting: v }))
            )}
          </>
        ))}

        {/* Ecommerce */}
        {renderCollapsibleSection('Ecommerce', 'ecommerce', 'cart-outline', (
          <>
            {renderCheckbox('Pesanan', permissions.ecommerce.pesanan, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, pesanan: v } }))
            )}
            {renderCheckbox('Chat', permissions.ecommerce.ecommerce_chat, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, ecommerce_chat: v } }))
            )}
            {renderCheckbox('Notifikasi', permissions.ecommerce.notifikasi, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, notifikasi: v } }))
            )}
            {renderCheckbox('Penarikan', permissions.ecommerce.penarikan, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, penarikan: v } }))
            )}
            {renderCheckbox('Laba Rugi Online', permissions.ecommerce.labarugi_online, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, labarugi_online: v } }))
            )}
            {renderCheckbox('Integration', permissions.ecommerce.integration, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, integration: v } }))
            )}
            {renderCheckbox('Retur Online', permissions.ecommerce.returonline, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, returonline: v } }))
            )}
            {renderCheckbox('Booking Orders', permissions.ecommerce.booking_orders, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, booking_orders: v } }))
            )}
            {renderCheckbox('Tools / Produk', permissions.ecommerce.ecommerce_tools.product, (v) => 
              setPermissions(p => ({ ...p, ecommerce: { ...p.ecommerce, ecommerce_tools: { product: v } } }))
            )}
          </>
        ))}

        {/* Customer */}
        {renderCollapsibleSection('Customer', 'customer', 'people-outline', (
          <>
            {renderCheckbox('Rakit PC', permissions.customer.rakitpc, (v) => 
              setPermissions(p => ({ ...p, customer: { ...p.customer, rakitpc: v } }))
            )}
          </>
        ))}

        {/* Marketplace Access */}
        {renderCollapsibleSection('Marketplace Access', 'marketplace', 'storefront-outline', (
          <>
            {ecommerceList.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada marketplace</Text>
            ) : (
              ecommerceList.map(mp => (
                <View key={mp.id} style={styles.checkboxRow}>
                  <View>
                    <Text style={styles.checkboxLabel}>{mp.name}</Text>
                    <Text style={styles.marketplaceSubtext}>{mp.platform}</Text>
                  </View>
                  <Switch
                    value={aksesMP.includes(mp.id)}
                    onValueChange={() => toggleMarketplace(mp.id)}
                    trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
                    thumbColor={aksesMP.includes(mp.id) ? '#f59e0b' : '#f4f4f5'}
                  />
                </View>
              ))
            )}
          </>
        ))}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.button, (!hasUserAccess || loading || !emailValid) && styles.buttonDisabled]} 
            disabled={!hasUserAccess || loading || !emailValid} 
            onPress={onSave}
          >
            <Text style={styles.buttonText}>{isNew ? 'Undang' : 'Simpan'}</Text>
          </TouchableOpacity>
          {!isNew && (
            <TouchableOpacity 
              style={[styles.buttonDanger, (!hasUserAccess || loading) && styles.buttonDisabled]} 
              disabled={!hasUserAccess || loading} 
              onPress={onDelete}
            >
              <Text style={styles.buttonText}>Hapus</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  emailCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  emailInputRow: { flexDirection: 'row', gap: 8 as any, alignItems: 'flex-start' },
  input: { backgroundColor: '#f9fafb', borderRadius: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#e5e7eb' },
  inputWithButton: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#e5e7eb' },
  searchButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, height: 44, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 as any },
  searchButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  invalid: { borderColor: '#ef4444' },
  errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
  hintText: { fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' },
  section: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, elevation: 2, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fef3c7', borderBottomWidth: 1, borderBottomColor: '#fde68a' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 as any },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#92400e' },
  sectionContent: { padding: 16 },
  checkboxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  checkboxLabel: { fontSize: 14, color: '#374151' },
  subSectionTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 8, marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  marketplaceSubtext: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 12 as any, marginTop: 16 },
  button: { flex: 1, backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonDanger: { flex: 1, backgroundColor: '#ef4444', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
});
