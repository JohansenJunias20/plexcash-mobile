/**
 * Payment Reminder Service
 * 
 * Handles sending payment reminders to buyers for unpaid orders
 * and managing the payment reminder message templates.
 */

import ApiService from '../api';

export const DEFAULT_UNPAID_TEMPLATE =
  'Halo Kak {buyer_name}, pesanan Anda dengan no. {order_sn} belum diselesaikan pembayarannya. Mohon segera selesaikan pembayaran agar pesanan dapat segera kami proses dan kirim ya kak. Terima kasih! 🙏';

export interface SendPaymentReminderParams {
  order_id: number | string;
  order_sn: string;
  buyer_id: string | number;
  buyer_username: string;
  id_ecommerce: number;
  shop_id: string;
  platform: string;
  custom_message?: string;
}

export interface PaymentReminderResponse {
  status: boolean;
  success?: boolean;
  message?: string;
  reason?: string;
  chat_response?: any;
}

export interface UnpaidTemplateResponse {
  status: boolean;
  success?: boolean;
  template?: string;
  message?: string;
  reason?: string;
}

/**
 * Send payment reminder chat to the buyer
 * Endpoint: POST /ecommerce/chat/send-payment-reminder
 */
export const sendPaymentReminder = async (
  params: SendPaymentReminderParams
): Promise<PaymentReminderResponse> => {
  const platform = (params.platform || '').toUpperCase();

  // TikTok does not currently provide public Seller Chat API
  if (platform === 'TIKTOK') {
    return {
      status: false,
      reason: 'Platform TikTok belum menyediakan API Seller Chat untuk mengirim pesan langsung ke pembeli.',
    };
  }

  const payload = {
    order_id: params.order_id,
    order_sn: params.order_sn,
    buyer_id: params.buyer_id,
    buyer_username: params.buyer_username || '',
    id_ecommerce: Number(params.id_ecommerce),
    shop_id: String(params.shop_id || ''),
    platform: platform,
    custom_message: params.custom_message || '',
  };

  try {
    console.log('🔔 [paymentReminderService] Sending payment reminder:', payload);
    const response = await ApiService.authenticatedRequest('/ecommerce/chat/send-payment-reminder', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log('🔔 [paymentReminderService] Reminder response:', response);

    if (response?.status === true || response?.success === true) {
      return {
        status: true,
        success: true,
        message: response?.message || 'Pesan pengingat pembayaran berhasil dikirim ke pembeli!',
        chat_response: response?.chat_response,
      };
    }

    return {
      status: false,
      reason: response?.reason || response?.message || 'Gagal mengirim pengingat pembayaran',
    };
  } catch (error: any) {
    console.error('❌ [paymentReminderService] Error sending payment reminder:', error);
    return {
      status: false,
      reason: error?.message || 'Terjadi kesalahan jaringan saat mengirim pengingat pembayaran',
    };
  }
};

/**
 * Fetch unpaid payment reminder template from backend
 * Endpoints: GET /api/ecommerce/chat/unpaid-template or /get/ecommerce/chat/unpaid-template
 */
export const fetchUnpaidTemplate = async (): Promise<UnpaidTemplateResponse> => {
  console.log('📋 [paymentReminderService] Fetching unpaid template...');

  let response: any = null;

  try {
    response = await ApiService.authenticatedRequest('/api/ecommerce/chat/unpaid-template', {
      method: 'GET',
    });
  } catch (err: any) {
    console.warn('⚠️ [paymentReminderService] /api/ecommerce/chat/unpaid-template failed, trying fallback:', err?.message);
    try {
      response = await ApiService.authenticatedRequest('/get/ecommerce/chat/unpaid-template', {
        method: 'GET',
      });
    } catch (fallbackErr: any) {
      console.warn('⚠️ [paymentReminderService] Fallback also failed:', fallbackErr?.message);
    }
  }

  if (response?.status === true || response?.success === true) {
    const tpl = response?.template || response?.data?.template;
    return {
      status: true,
      success: true,
      template: typeof tpl === 'string' && tpl.trim().length > 0 ? tpl : DEFAULT_UNPAID_TEMPLATE,
    };
  }

  return {
    status: false,
    template: DEFAULT_UNPAID_TEMPLATE,
    reason: response?.reason || 'Gagal memuat template dari server, menggunakan template default',
  };
};

/**
 * Save / update unpaid payment reminder template
 * Endpoints: POST /api/ecommerce/chat/unpaid-template or /update/ecommerce/chat/unpaid-template
 */
export const saveUnpaidTemplate = async (template: string): Promise<UnpaidTemplateResponse> => {
  console.log('💾 [paymentReminderService] Saving unpaid template...');

  const payload = { template: template.trim() };
  let response: any = null;

  try {
    response = await ApiService.authenticatedRequest('/api/ecommerce/chat/unpaid-template', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    console.warn('⚠️ [paymentReminderService] /api/ecommerce/chat/unpaid-template failed, trying /update fallback:', err?.message);
    try {
      response = await ApiService.authenticatedRequest('/update/ecommerce/chat/unpaid-template', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (fallbackErr: any) {
      console.warn('⚠️ [paymentReminderService] Fallback also failed:', fallbackErr?.message);
      return {
        status: false,
        reason: fallbackErr?.message || 'Gagal menyimpan template pengingat',
      };
    }
  }

  if (response?.status === true || response?.success === true) {
    return {
      status: true,
      success: true,
      message: response?.message || 'Template pengingat pembayaran berhasil disimpan',
      template: response?.template || payload.template,
    };
  }

  return {
    status: false,
    reason: response?.reason || response?.message || 'Gagal menyimpan template',
  };
};

/**
 * Replace placeholders in template text with actual sample/preview data
 */
export const renderTemplatePreview = (
  template: string,
  sampleData?: {
    buyer_name?: string;
    order_sn?: string;
    total?: string;
    shop_name?: string;
  }
): string => {
  if (!template) return '';

  const data = {
    buyer_name: sampleData?.buyer_name || 'Budi Santoso',
    order_sn: sampleData?.order_sn || '251216FX9NU162',
    total: sampleData?.total || 'Rp 125.000',
    shop_name: sampleData?.shop_name || 'Toko Kami',
  };

  return template
    .replace(/\{buyer_name\}|\{nama_pembeli\}/gi, data.buyer_name)
    .replace(/\{order_sn\}|\{no_pesanan\}/gi, data.order_sn)
    .replace(/\{total\}|\{nominal\}/gi, data.total)
    .replace(/\{shop_name\}|\{nama_toko\}/gi, data.shop_name);
};
