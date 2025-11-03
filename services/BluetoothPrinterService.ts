import { Platform, Alert, PermissionsAndroid } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeMotto?: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  date: string;
  cashier?: string;
  customerName?: string;
  items: {
    name: string;
    qty: number;
    price: number;
    total: number;
    subtotal?: number;
  }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  ppn?: number;
  ppnRate?: number;
  total: number;
  payment?: number;
  change?: number;
}

/**
 * Bluetooth Printer Service using react-native-ble-plx
 *
 * This service provides Bluetooth Low Energy (BLE) scanning and connection
 * for thermal printers.
 */
class BluetoothPrinterService {
  private bleManager: BleManager;
  private connectedDevice: Device | null = null;

  constructor() {
    this.bleManager = new BleManager();
    console.log('✅ [BT-SERVICE] Bluetooth service initialized with react-native-ble-plx');
  }

  /**
   * Request Bluetooth permissions (Android only)
   */
  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          return (
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android < 12
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          return (
            granted['android.permission.BLUETOOTH'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_ADMIN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          );
        }
      } catch (error) {
        console.error('❌ [BT-SERVICE] Permission request error:', error);
        return false;
      }
    }
    // iOS permissions are handled automatically via Info.plist
    return true;
  }

  /**
   * Enable Bluetooth
   */
  async enableBluetooth(): Promise<boolean> {
    // BLE manager doesn't have enable method, user must enable manually
    console.log('⚠️ [BT-SERVICE] Please enable Bluetooth manually in device settings');
    return false;
  }

  /**
   * Check if Bluetooth is enabled
   */
  async isBluetoothEnabled(): Promise<boolean> {
    try {
      const state = await this.bleManager.state();
      console.log('🔍 [BT-SERVICE] Bluetooth state:', state);
      return state === 'PoweredOn';
    } catch (error) {
      console.error('❌ [BT-SERVICE] Error checking Bluetooth state:', error);
      return false;
    }
  }

  /**
   * Scan for Bluetooth devices (real BLE scan)
   */
  async scanDevices(): Promise<BluetoothDevice[]> {
    console.log('🔍 [BT-SERVICE] Starting real BLE scan...');

    const deviceMap = new Map<string, BluetoothDevice>();

    return new Promise((resolve, reject) => {
      // Stop any existing scan
      this.bleManager.stopDeviceScan();

      // Start scanning for 5 seconds
      this.bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('❌ [BT-SERVICE] Scan error:', error);
          this.bleManager.stopDeviceScan();
          reject(error);
          return;
        }

        if (device && device.name) {
          // Only add devices with names (likely printers)
          if (!deviceMap.has(device.id)) {
            const btDevice: BluetoothDevice = {
              name: device.name,
              address: device.id,
            };
            deviceMap.set(device.id, btDevice);
            console.log('🔍 [BT-SERVICE] Found device:', btDevice);
          }
        }
      });

      // Stop scan after 5 seconds
      setTimeout(() => {
        this.bleManager.stopDeviceScan();
        const foundDevices = Array.from(deviceMap.values());
        console.log(`🔍 [BT-SERVICE] Scan complete. Found ${foundDevices.length} devices`);
        resolve(foundDevices);
      }, 5000);
    });
  }

  /**
   * Connect to a Bluetooth printer
   */
  async connect(address: string): Promise<boolean> {
    try {
      console.log(`🔗 [BT-SERVICE] Connecting to device: ${address}`);

      // Disconnect if already connected
      if (this.connectedDevice) {
        await this.disconnect();
      }

      // Connect to device
      const device = await this.bleManager.connectToDevice(address);
      await device.discoverAllServicesAndCharacteristics();

      this.connectedDevice = device;
      console.log('✅ [BT-SERVICE] Connected successfully');
      return true;
    } catch (error) {
      console.error('❌ [BT-SERVICE] Connection error:', error);
      return false;
    }
  }

  /**
   * Disconnect from the current Bluetooth printer
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connectedDevice) {
        console.log('🔌 [BT-SERVICE] Disconnecting...');
        await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
        this.connectedDevice = null;
        console.log('✅ [BT-SERVICE] Disconnected');
      }
    } catch (error) {
      console.error('❌ [BT-SERVICE] Disconnect error:', error);
    }
  }

  /**
   * Print a receipt using Bluetooth thermal printer
   */
  async printReceipt(data: ReceiptData, paperWidth: '58mm' | '80mm' = '80mm', language: 'id' | 'en' = 'id'): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        Alert.alert('Error', 'No printer connected. Please connect to a printer first.');
        return false;
      }

      console.log('🖨️ [BT-SERVICE] Printing receipt to Bluetooth printer...');

      // Generate ESC/POS commands for thermal printer
      const escPosData = this.generateReceiptESCPOS(data, paperWidth, language);

      // Send data to printer via BLE
      await this.sendDataToPrinter(escPosData);

      console.log('✅ [BT-SERVICE] Receipt printed successfully');
      return true;
    } catch (err) {
      console.error('❌ [BT-SERVICE] Print receipt error:', err);
      Alert.alert('Print Error', `Failed to print receipt: ${err}`);
      return false;
    }
  }

  /**
   * Generate HTML for receipt printing
   */
  private generateReceiptHTML(data: ReceiptData, paperWidth: '58mm' | '80mm'): string {
    const width = paperWidth === '58mm' ? '58mm' : '80mm';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: ${width} auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              margin: 10px;
              width: ${width};
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 5px 0; }
            .item { display: flex; justify-content: space-between; margin: 2px 0; }
            .total { font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold">${data.storeName}</div>
          <div class="center">${data.storeAddress}</div>
          <div class="center">${data.storePhone}</div>
          <div class="line"></div>

          <div>Invoice: ${data.invoiceNumber}</div>
          <div>Date: ${data.date}</div>
          <div>Cashier: ${data.cashier}</div>
          <div class="line"></div>

          ${data.items.map(item => `
            <div class="bold">${item.name}</div>
            <div class="item">
              <span>${item.qty} x ${this.formatCurrency(item.price)}</span>
              <span>${this.formatCurrency(item.subtotal)}</span>
            </div>
          `).join('')}

          <div class="line"></div>

          <div class="item">
            <span>Subtotal:</span>
            <span>${this.formatCurrency(data.subtotal)}</span>
          </div>

          ${data.ppn && data.ppnRate ? `
            <div class="item">
              <span>PPN (${data.ppnRate}%):</span>
              <span>${this.formatCurrency(data.ppn)}</span>
            </div>
          ` : ''}

          <div class="item total">
            <span>Total:</span>
            <span>${this.formatCurrency(data.total)}</span>
          </div>

          <div class="item">
            <span>Payment:</span>
            <span>${this.formatCurrency(data.payment)}</span>
          </div>

          <div class="item">
            <span>Change:</span>
            <span>${this.formatCurrency(data.change)}</span>
          </div>

          <div class="line"></div>
          <div class="center">Thank You!</div>
          <div class="center">Please Come Again</div>
        </body>
      </html>
    `;
  }

  /**
   * Format currency to Indonesian Rupiah
   */
  private formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return 'Rp 0';
    // Format number with thousand separators
    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    // Add "Rp " prefix with space
    return `Rp ${formatted}`;
  }

  /**
   * Test print to Bluetooth thermal printer
   */
  async testPrint(): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        Alert.alert('Error', 'No printer connected. Please connect to a printer first.');
        return false;
      }

      console.log('🖨️ [BT-SERVICE] Sending test print...');

      // ESC/POS commands for test print
      const ESC = '\x1B';
      const GS = '\x1D';

      let data = '';
      data += ESC + '@'; // Initialize printer
      data += ESC + 'a' + '\x01'; // Center align
      data += GS + '!' + '\x11'; // Double size text
      data += 'TEST PRINT\n';
      data += GS + '!' + '\x00'; // Normal size
      data += ESC + 'a' + '\x01'; // Center align
      data += '================\n';
      data += 'Printer is working!\n';
      data += new Date().toLocaleString('id-ID') + '\n';
      data += '================\n';
      data += '\n\n\n';
      data += GS + 'V' + '\x00'; // Cut paper

      await this.sendDataToPrinter(data);

      console.log('✅ [BT-SERVICE] Test print sent successfully');
      return true;
    } catch (err) {
      console.error('❌ [BT-SERVICE] Test print error:', err);
      Alert.alert('Print Error', `Failed to print: ${err}`);
      return false;
    }
  }

  /**
   * Send raw data to connected Bluetooth printer
   */
  private async sendDataToPrinter(data: string): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No printer connected');
    }

    try {
      console.log('📤 [BT-SERVICE] Sending data to printer...');

      // Convert string to base64 for BLE transmission
      const base64Data = btoa(data);

      // Get services and characteristics
      const services = await this.connectedDevice.services();
      console.log(`🔍 [BT-SERVICE] Found ${services.length} services`);

      // Find the print service (usually the first writable characteristic)
      for (const service of services) {
        const characteristics = await service.characteristics();

        for (const characteristic of characteristics) {
          // Check if characteristic is writable
          if (characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse) {
            console.log(`✍️ [BT-SERVICE] Writing to characteristic: ${characteristic.uuid}`);

            await characteristic.writeWithResponse(base64Data);
            console.log('✅ [BT-SERVICE] Data sent successfully');
            return;
          }
        }
      }

      throw new Error('No writable characteristic found on printer');
    } catch (error) {
      console.error('❌ [BT-SERVICE] Send data error:', error);
      throw error;
    }
  }

  /**
   * Generate ESC/POS commands for receipt printing
   */
  private generateReceiptESCPOS(data: ReceiptData, paperWidth: '58mm' | '80mm', language: 'id' | 'en' = 'id'): string {
    const ESC = '\x1B';
    const GS = '\x1D';

    // Language labels
    const labels = language === 'id' ? {
      date: 'Tanggal',
      receipt: 'No. Struk',
      customer: 'Pelanggan',
      subtotal: 'Subtotal',
      discount: 'Diskon',
      tax: 'Pajak',
      total: 'TOTAL',
      payment: 'Bayar',
      change: 'Kembali',
      thankYou: 'Terima kasih atas kunjungan Anda!',
      comeAgain: 'Sampai jumpa lagi'
    } : {
      date: 'Date',
      receipt: 'Receipt',
      customer: 'Customer',
      subtotal: 'Subtotal',
      discount: 'Discount',
      tax: 'Tax',
      total: 'TOTAL',
      payment: 'Payment',
      change: 'Change',
      thankYou: 'Thank you for your purchase!',
      comeAgain: 'Please come again'
    };

    let output = '';

    // Initialize printer
    output += ESC + '@';

    // Header - Store name (centered, double size)
    output += ESC + 'a' + '\x01'; // Center align
    output += GS + '!' + '\x11'; // Double size
    output += data.storeName + '\n';
    output += GS + '!' + '\x00'; // Normal size

    // Store motto (centered)
    if (data.storeMotto) {
      output += data.storeMotto + '\n';
    }

    // Store address (centered)
    if (data.storeAddress) {
      output += data.storeAddress + '\n';
    }

    // Store phone (centered)
    if (data.storePhone) {
      output += `Tel: ${data.storePhone}\n`;
    }

    // Separator
    output += ESC + 'a' + '\x00'; // Left align
    output += '================================\n';

    // Date and receipt number
    output += `${labels.date}: ${data.date}\n`;
    output += `${labels.receipt}: ${data.receiptNumber}\n`;
    if (data.customerName) {
      output += `${labels.customer}: ${data.customerName}\n`;
    }
    output += '================================\n';

    // Items
    for (const item of data.items) {
      output += `${item.name}\n`;
      output += `  ${item.qty} x ${this.formatCurrency(item.price)}`;
      output += `${' '.repeat(Math.max(0, 20 - item.qty.toString().length - this.formatCurrency(item.price).length))}`;
      output += `${this.formatCurrency(item.total)}\n`;
    }

    output += '================================\n';

    // Totals (right align)
    output += `${labels.subtotal}:${' '.repeat(Math.max(0, 23 - labels.subtotal.length - this.formatCurrency(data.subtotal).length))}${this.formatCurrency(data.subtotal)}\n`;

    if (data.discount && data.discount > 0) {
      output += `${labels.discount}:${' '.repeat(Math.max(0, 23 - labels.discount.length - this.formatCurrency(data.discount).length))}${this.formatCurrency(data.discount)}\n`;
    }

    if (data.tax && data.tax > 0) {
      output += `${labels.tax}:${' '.repeat(Math.max(0, 23 - labels.tax.length - this.formatCurrency(data.tax).length))}${this.formatCurrency(data.tax)}\n`;
    }

    output += '================================\n';
    output += GS + '!' + '\x11'; // Double size
    output += `${labels.total}:${' '.repeat(Math.max(0, 20 - labels.total.length - this.formatCurrency(data.total).length))}${this.formatCurrency(data.total)}\n`;
    output += GS + '!' + '\x00'; // Normal size
    output += '================================\n';

    // Payment info
    if (data.payment) {
      output += `${labels.payment}: ${this.formatCurrency(data.payment)}\n`;
      if (data.change && data.change > 0) {
        output += `${labels.change}: ${this.formatCurrency(data.change)}\n`;
      }
    }

    // Footer
    output += '\n';
    output += ESC + 'a' + '\x01'; // Center align
    output += labels.thankYou + '\n';
    output += labels.comeAgain + '\n';
    output += '\n\n\n';

    // Cut paper
    output += GS + 'V' + '\x00';

    return output;
  }
}

export default new BluetoothPrinterService();

