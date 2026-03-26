/**
 * TypeScript interfaces for Perangkat (WinForms Device Management)
 */

export interface WinFormsClient {
  client_id: string;
  database_name: string;
  status: 'online' | 'offline';
  paired_at: number;
  last_heartbeat: number;
  desktop_name: string;
  custom_device_name?: string;
  client_info: any;
  dlp_enabled: boolean;
}

export interface UrlFilterConfig {
  filter_mode: 'BLACKLIST' | 'WHITELIST';
  url_list: string[];
  is_enabled: boolean;
  last_updated: number;
  updated_by?: string;
}

export interface UsbProtectionConfig {
  is_protection_enabled: boolean;
  last_updated: number;
  updated_by?: string;
}

export interface ApiResponse<T> {
  status: boolean;
  data?: T;
  message?: string;
  reason?: string;
}

