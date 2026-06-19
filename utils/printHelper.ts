import { Buffer } from 'buffer';
import moment from 'moment';

export interface ShippingLabelItem {
  order_id: string;
  platform: string;
  type: string;
  data: any;
  refreshed_package_id?: string[];
  error?: boolean;
  reason?: string;
}

export interface ProcessedLabelsResult {
  html?: string;
  pdfUrl?: string;
  error?: string;
}

/**
 * Generate a clean A6-styled HTML template for Shopee structured order data.
 */
export function generateShopeeLabelHtml(data: any, recipesMap: any = {}): string {
  if (!data) return '';

  const resi = data.no_resi || '';
  const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(resi)}&scale=3&rotate=N&includetext`;
  const orderBarcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(data.order_id || '')}&scale=2&rotate=N`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(resi)}`;

  // Formatted deadline
  const formattedDeadline = data.ship_by_date ? moment(data.ship_by_date).format('DD/MM/YY HH:mm') : '';

  // Get recipe mapping for this order
  const orderSkuMap = recipesMap[String(data.order_id)] || {};
  const items = data.items || [];
  
  // Track assigned recipe SKU keys (fallback matching logic)
  const assignedRecipeSkus = new Set<string>();
  const directMatches = items.map((item: any) => {
    const itemSku = item.sku || '';
    const components = orderSkuMap[itemSku];
    if (components && components.length > 0) {
      assignedRecipeSkus.add(itemSku);
      return components;
    }
    return null;
  });

  const unassignedRecipeEntries = Object.entries(orderSkuMap)
    .filter(([recipeSku]) => !assignedRecipeSkus.has(recipeSku));
    
  let fallbackIndex = 0;
  const itemRecipeGroups = directMatches.map((match: any, idx: number) => {
    if (match !== null) return match;
    if (fallbackIndex < unassignedRecipeEntries.length) {
      const [_, fallbackComponents] = unassignedRecipeEntries[fallbackIndex++];
      return fallbackComponents;
    }
    return [];
  });

  const itemsHtml = items.map((it: any, index: number) => {
    const recipeComponents = itemRecipeGroups[index] || [];
    const recipeHtml = recipeComponents.length > 0
      ? `
        <div style="font-weight: bold; margin-top: 1mm; font-size: 6.5pt;">(Resep)</div>
        <div style="font-size: 6pt; margin-left: 2mm; line-height: 1.2;">
          ${recipeComponents.map((comp: any) => {
            const compLabel = comp.stock_type === 'WAREHOUSE' ? (comp.warehouse_name || 'Gudang') : comp.component_nama;
            return `<div>- ${compLabel} x${comp.component_qty}</div>`;
          }).join('')}
        </div>
      `
      : '';

    return `
      <tr style="border-bottom: 0.4mm solid #000; font-size: 7.5pt; page-break-inside: avoid;">
        <td style="padding: 1.5mm; border-right: 0.4mm solid #000; text-align: center; width: 5%;">${index + 1}</td>
        <td style="padding: 1.5mm; border-right: 0.4mm solid #000; text-align: left; width: 45%;">
          <div>${it.name || it.nama || '-'}</div>
          ${recipeHtml}
        </td>
        <td style="padding: 1.5mm; border-right: 0.4mm solid #000; text-align: left; width: 15%;">${it.varian || '-'}</td>
        <td style="padding: 1.5mm; border-right: 0.4mm solid #000; text-align: left; width: 25%;">${it.sku || '-'}</td>
        <td style="padding: 1.5mm; text-align: right; width: 10%; font-size: 11pt; font-weight: bold; vertical-align: middle;">${it.qty || 1}</td>
      </tr>
    `;
  }).join('');

  // Total Qty calculation
  const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0), 0);

  // Formatting COD Currency
  const codVal = Number(data.COD);
  const formattedCod = codVal > 0 ? `Rp ${new Intl.NumberFormat('id-ID').format(codVal)}` : '';

  // Determine courier texts
  let kurirText = (data.kurir || 'STANDARD').toUpperCase();
  const kLower = kurirText.toLowerCase();
  let centerText = '';
  if (kLower.replace(/\s+/g, '').includes('sameday')) {
    centerText = 'SAMEDAY';
  } else if (kLower.includes('instant')) {
    centerText = 'INSTANT';
  } else if (kLower.includes('spx hemat')) {
    centerText = 'ECO';
  } else if (kLower.includes('spx standard')) {
    centerText = 'STD';
  }

  const isBookingShopee = !!(data.booking_sn || data.booking_code);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: A6;
          margin: 0;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 3mm;
          width: 105mm;
          height: 148mm;
          background-color: #fff;
          color: #000;
          -webkit-print-color-adjust: exact;
        }
        .container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .header-warning {
          font-size: 8pt;
          font-weight: bold;
          text-align: center;
          margin-bottom: 2mm;
          text-transform: uppercase;
        }
        .shipping-box {
          border: 0.5mm solid #000;
          padding: 2mm;
          width: 100%;
        }
        .divider-solid {
          border-top: 0.5mm solid #000;
          margin: 1.5mm -2mm;
        }
        .divider-dashed {
          border-top: 0.3mm dashed #000;
          margin: 1.5mm -2mm;
        }
        .flex-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .flex-align-end {
          align-items: flex-end;
        }
        .text-bold {
          font-weight: bold;
        }
        .shopee-logo {
          font-size: 14pt;
          font-weight: bold;
          color: #ff5722;
        }
        .kilat-text {
          font-size: 8.5pt;
          font-weight: bold;
          color: #ff5722;
        }
        .courier-text {
          font-size: 12pt;
          font-weight: bold;
          text-align: right;
        }
        .center-text-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .barcode-img {
          display: block;
          margin: 1.5mm auto;
          height: 14mm;
          max-width: 90%;
        }
        .address-section {
          font-size: 7.5pt;
          line-height: 1.2;
        }
        .address-col {
          width: 65%;
        }
        .info-col {
          width: 35%;
          text-align: right;
        }
        .address-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 2mm;
          margin-top: 1.5mm;
          font-size: 7.5pt;
        }
        .cod-weight-row {
          margin-top: 1.5mm;
          font-size: 7.5pt;
        }
        .qr-code-img {
          width: 14mm;
          height: 14mm;
        }
        .order-barcode-img {
          height: 8mm;
          max-width: 25mm;
        }
        .products-box {
          border: 0.5mm solid #000;
          margin-top: 2.5mm;
          width: 100%;
        }
        .products-table {
          width: 100%;
          border-collapse: collapse;
        }
        .products-table th {
          background-color: #f3f4f6;
          font-weight: bold;
          border-bottom: 0.5mm solid #000;
          border-right: 0.4mm solid #000;
          padding: 1.5mm;
          font-size: 7.5pt;
          text-align: left;
        }
        .products-table th:last-child {
          border-right: none;
        }
        .products-table td {
          border-bottom: 0.4mm solid #000;
          border-right: 0.4mm solid #000;
          padding: 1.5mm;
          vertical-align: top;
        }
        .products-table td:last-child {
          border-right: none;
        }
        .products-table tr:last-child td {
          border-bottom: none;
        }
        .total-row {
          font-weight: bold;
          background-color: #f3f4f6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header-warning">WAJIB VIDEO UNBOXING UNTUK KOMPLAIN</div>
        
        <div class="shipping-box">
          <div class="flex-row">
            <div class="shopee-logo">SHOPEE</div>
            <div class="center-text-col">
              ${isBookingShopee ? `<div class="kilat-text">PENGIRIMAN KILAT</div>` : ''}
              ${centerText ? `<div class="kilat-text" style="color: #000; font-size: 9pt;">${centerText}</div>` : ''}
            </div>
            <div class="courier-text">${kurirText}</div>
          </div>
          
          <div class="divider-solid"></div>
          
          <div class="flex-row" style="font-size: 9pt;">
            <div class="text-bold">${data.first_recipient_sort_code || data.third_recipient_sort_code || ''}</div>
            <div>No resi: <span class="text-bold" style="font-size: 10.5pt;">${resi}</span></div>
          </div>
          
          ${resi ? `<img class="barcode-img" src="${barcodeUrl}" alt="barcode" />` : ''}
          
          <div class="divider-solid"></div>
          
          <div class="flex-row address-section">
            <div class="text-bold">Penerima: ${data.customer_name || ''}</div>
            <div class="text-bold">Pengirim: PlexCash Seller</div>
          </div>
          
          <div class="flex-row address-section" style="margin-top: 1mm; align-items: flex-start;">
            <div class="address-col">${data.full_address || ''}</div>
            <div class="info-col">Telp: ${data.seller_number || '-'}</div>
          </div>
          
          <div class="address-grid">
            <div>${data.city || ''}</div>
            <div>${data.district || ''}</div>
            <div>${data.town || ''}</div>
          </div>
          
          <div class="divider-dashed"></div>
          
          <div class="flex-row cod-weight-row">
            <div class="text-bold">${formattedCod ? `COD: ${formattedCod}` : 'NON-COD'}</div>
            <div class="text-bold">Berat: ${data.berat_total || 0} gr</div>
          </div>
          
          <div class="divider-solid"></div>
          
          <div class="flex-row flex-align-end" style="font-size: 7.5pt; margin-top: 1mm;">
            <div style="line-height: 1.3;">
              <div class="text-bold">No. Pesanan: ${data.order_id}</div>
              ${formattedDeadline ? `<div class="text-bold">Batas Kirim: ${formattedDeadline}</div>` : ''}
            </div>
            <div class="flex-row" style="align-items: center;">
              <img class="order-barcode-img" src="${orderBarcodeUrl}" alt="order barcode" />
              <img class="qr-code-img" src="${qrCodeUrl}" alt="qr code" style="margin-left: 2mm;" />
            </div>
          </div>
        </div>

        ${data.notes ? `
        <div style="font-size: 8.5pt; font-weight: bold; margin-top: 2.5mm; border: 0.3mm solid #000; padding: 1.5mm; border-radius: 1mm; background-color: #f9f9f9;">
          pesan buyer: ${data.notes}
        </div>` : ''}

        <div class="products-box">
          <table class="products-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 45%;">Nama Produk</th>
                <th style="width: 15%;">Variant</th>
                <th style="width: 25%;">SKU</th>
                <th style="width: 10%; text-align: right;">QTY</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              ${totalQty > 0 ? `
              <tr class="total-row">
                <td colspan="4" style="padding: 1.5mm; text-align: right; border-right: 0.4mm solid #000;">Total QTY:</td>
                <td style="padding: 1.5mm; text-align: right;">${totalQty}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Decodes base64 string safely.
 */
function decodeBase64(base64Str: string): string {
  try {
    return Buffer.from(base64Str, 'base64').toString('utf-8');
  } catch (e) {
    console.error('Failed to decode base64:', e);
    return '';
  }
}

/**
 * Process a list of shipping label records returned by the backend `/ecommerce/ship_label` endpoint.
 */
export function processShippingLabels(list: any[], recipesMap: any = {}): ProcessedLabelsResult {
  if (!list || list.length === 0) {
    return { error: 'No label data found' };
  }

  // Filter out records that returned errors
  const validItems = list.filter((item: any) => !item.error && item.data);

  if (validItems.length === 0) {
    const errorMsg = list.map((item: any) => item.reason).filter(Boolean).join(', ');
    return { error: errorMsg || 'Gagal mengambil data resi' };
  }

  // Check if we have a PDF URL (usually TikTok)
  const pdfItem = validItems.find((item: any) => item.type === 'PDF_URL');
  if (pdfItem) {
    // If it's a list of PDF URLs, pick the first one (or first item in list of URLs if Array)
    const urls = pdfItem.data;
    const pdfUrl = Array.isArray(urls) ? urls[0] : urls;
    if (pdfUrl) {
      return { pdfUrl };
    }
  }

  // For HTML-based layouts (Tokopedia, Lazada, Shopee data generator), combine them
  const htmlParts: string[] = [];

  for (const item of validItems) {
    if (item.type === 'HTML_ENCODED') {
      const decodedHtml = decodeBase64(item.data);
      if (decodedHtml) {
        htmlParts.push(decodedHtml);
      }
    } else if (item.type === 'data' && item.platform === 'SHOPEE') {
      const shopeeHtml = generateShopeeLabelHtml(item.data, recipesMap);
      if (shopeeHtml) {
        htmlParts.push(shopeeHtml);
      }
    }
  }

  if (htmlParts.length === 0) {
    return { error: 'Format label tidak didukung di mobile' };
  }

  // Combine multiple HTML labels, wrapping each in a page-break block
  const combinedHtml = htmlParts.map((html, index) => {
    // Inject a page break style except for the last item to avoid an empty trailing page
    const pageBreakStyle = index < htmlParts.length - 1 ? 'page-break-after: always; break-after: page;' : '';
    return `<div style="${pageBreakStyle}">${html}</div>`;
  }).join('\n');

  return { html: combinedHtml };
}
