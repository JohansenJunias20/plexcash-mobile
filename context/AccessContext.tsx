import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import ApiService from '../services/api';
import { useAuth } from './AuthContext';

interface AccessPermissions {
  master?: {
    user?: boolean;
    barang?: boolean;
    satuan?: boolean;
    upload?: boolean;
    varian?: boolean;
    bundling?: boolean;
    customer?: boolean;
    supplier?: boolean;
    baganakun?: boolean;
    import_barang?: boolean;
    show_hpp?: boolean;
    warehouse?: boolean;
  };
  actions?: {
    read?: boolean;
    create?: boolean;
    delete?: boolean;
    update?: boolean;
  };
  laporan?: {
    neraca?: boolean;
    labarugi?: boolean;
    pembelian?: boolean;
    neracasaldo?: boolean;
    laporanbarang?: boolean;
    iklan?: boolean;
  };
  setting?: boolean;
  customer?: {
    rakitpc?: boolean;
  };
  ecommerce?: {
    pesanan?: boolean;
    penarikan?: boolean;
    notifikasi?: boolean;
    integration?: boolean;
    returonline?: boolean;
    ecommerce_chat?: boolean;
    booking_orders?: boolean;
    naikkan_produk?: boolean;
    proses_otomatis?: boolean;
    ecommerce_tools?: {
      product?: boolean;
    };
    labarugi_online?: boolean;
  };
  transaksi?: {
    spb?: boolean;
    jurnal?: {
      search?: boolean;
      tambah?: boolean;
    };
    rakitpc?: boolean;
    pc_masuk?: boolean;
    pc_keluar?: boolean;
    pembelian?: {
      retur?: boolean;
      search?: boolean;
      tambah?: boolean;
      dp_beli?: boolean;
      pelunasan?: boolean;
    };
    penjualan?: {
      retur?: boolean;
      search?: boolean;
      tambah?: boolean;
      pelunasan?: boolean;
    };
    stokopname?: boolean;
    integration?: boolean;
    pesanbarang?: boolean;
    retur_service?: boolean;
    detailbaganakun?: boolean;
  };
  visibility?: {
    hide_harga_beli?: boolean;
  };
}

interface AccessContextValue {
  access: AccessPermissions;
  isLoading: boolean;
  refreshAccess: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | undefined>(undefined);

export const useAccess = (): AccessContextValue => {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
};

export const AccessProvider = ({ children }: { children: ReactNode }) => {
  const [access, setAccess] = useState<AccessPermissions>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { isAuthenticated } = useAuth();

  const fetchAccess = async () => {
    try {
      setIsLoading(true);
      const response = await ApiService.getUserAccess();
      if (response.status && response.access) {
        setAccess(response.access);
      } else {
        console.warn('Failed to fetch user access:', response.reason);
        // Set default empty access
        setAccess({});
      }
    } catch (error) {
      console.error('Error fetching user access:', error);
      setAccess({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAccess();
    } else {
      setAccess({});
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshAccess = async () => {
    await fetchAccess();
  };

  const value: AccessContextValue = {
    access,
    isLoading,
    refreshAccess,
  };

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
};

