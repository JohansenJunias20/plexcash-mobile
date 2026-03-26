import { Platform, PermissionsAndroid } from 'react-native';
import RNBluetoothClassic, { BluetoothDevice as RNBluetoothDevice } from 'react-native-bluetooth-classic';
import { IBluetoothPrinterService, BluetoothDevice } from './IBluetoothPrinterService';

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
    satuan?: string;
  }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  ppn?: number;
  ppnRate?: number;
  total: number;
  payment?: number;
  change?: number;
  paperSize?: '58mm' | '80mm';
  language?: 'id' | 'en';
}

/**
 * Bluetooth Printer Service using react-native-bluetooth-classic
 *
 * This service provides Bluetooth Classic (SPP) scanning and connection
 * for thermal printers. Better suited for thermal printers than BLE.
 */
class BluetoothPrinterService_Classic implements IBluetoothPrinterService {
  private connectedDevice: RNBluetoothDevice | null = null;
  private isInitialized = false;

  constructor() {
    console.log('✅ [BT-SERVICE-CLASSIC] Bluetooth Classic service initialized');
  }

  /**
   * Initialize the Bluetooth manager
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 [BT-SERVICE-CLASSIC] Initializing...');

      // Request permissions
      await this.requestBluetoothPermissions();

      // Check if Bluetooth is enabled
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled) {
        console.warn('⚠️ [BT-SERVICE-CLASSIC] Bluetooth is not enabled');
        if (Platform.OS === 'android') {
          await RNBluetoothClassic.requestBluetoothEnabled();
        }
      }

      this.isInitialized = true;
      console.log('✅ [BT-SERVICE-CLASSIC] Initialized successfully');
    } catch (error) {
      console.error('❌ [BT-SERVICE-CLASSIC] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Get library info
   */
  getLibraryInfo(): string {
    return 'react-native-bluetooth-classic v1.60.3';
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

          const allGranted = (
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            console.error('❌ [BT-SERVICE-CLASSIC] Permissions denied:', granted);
          }

          return allGranted;
        } else {
          // Android < 12 (Android 10/MIUI)
          // CRITICAL FIX: On Android < 12, BLUETOOTH and BLUETOOTH_ADMIN are automatically granted
          // We only need to request ACCESS_FINE_LOCATION
          console.log('🔍 [BT-SERVICE-CLASSIC] Requesting location permission for Android < 12...');

          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs location permission to scan for Bluetooth devices.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;

          if (!isGranted) {
            console.error('❌ [BT-SERVICE-CLASSIC] Location permission denied');
          } else {
            console.log('✅ [BT-SERVICE-CLASSIC] Location permission granted');
          }

          return isGranted;
        }
      } catch (error) {
        console.error('❌ [BT-SERVICE-CLASSIC] Permission request error:', error);
        return false;
      }
    }
    return true;
  }

  /**
   * Check if all required Bluetooth permissions are granted
   */
  async checkBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          // Android 12+
          const scanGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
          const connectGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          const locationGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

          return scanGranted && connectGranted && locationGranted;
        } else {
          // Android < 12 (Android 10/MIUI)
          // CRITICAL FIX: On Android < 12, BLUETOOTH and BLUETOOTH_ADMIN are automatically granted
          // We only need to check ACCESS_FINE_LOCATION
          const locationGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

          console.log('🔍 [BT-SERVICE-CLASSIC] Android < 12 permission check - Location:', locationGranted);
          return locationGranted;
        }
      } catch (error) {
        console.error('❌ [BT-SERVICE-CLASSIC] Permission check error:', error);
        return false;
      }
    }
    return true;
  }

  /**
   * Scan for available Bluetooth devices
   */
  async scanDevices(durationMs: number = 5000): Promise<BluetoothDevice[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🔍 [BT-SERVICE-CLASSIC] Starting discovery for ${durationMs}ms...`);

      // CRITICAL FIX for MIUI/Xiaomi: Verify permissions before scanning
      const hasPermissions = await this.checkBluetoothPermissions();
      if (!hasPermissions) {
        console.error('❌ [BT-SERVICE-CLASSIC] Permissions not granted, requesting...');
        const granted = await this.requestBluetoothPermissions();
        if (!granted) {
          throw new Error('Bluetooth permissions are required to scan for devices. Please grant all permissions in Settings.');
        }
      }

      // Check if Bluetooth is enabled before scanning
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled) {
        throw new Error('Bluetooth is not enabled. Please turn on Bluetooth and try again.');
      }

      // Cancel any existing discovery first (MIUI fix)
      try {
        await RNBluetoothClassic.cancelDiscovery();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (cancelError) {
        console.log('⚠️ [BT-SERVICE-CLASSIC] No existing discovery to cancel');
      }

      // Start discovery with error handling
      console.log('📡 [BT-SERVICE-CLASSIC] Initiating Bluetooth discovery...');
      const discovering = await RNBluetoothClassic.startDiscovery();
      if (!discovering) {
        throw new Error('Failed to start Bluetooth discovery. Please try again.');
      }

      console.log('⏳ [BT-SERVICE-CLASSIC] Scanning...');
      // Wait for scan duration
      await new Promise(resolve => setTimeout(resolve, durationMs));

      // Stop discovery
      console.log('🛑 [BT-SERVICE-CLASSIC] Stopping discovery...');
      await RNBluetoothClassic.cancelDiscovery();

      // Get discovered devices
      const devices = await RNBluetoothClassic.getDiscoveredDevices();

      console.log(`🔍 [BT-SERVICE-CLASSIC] Discovery complete. Found ${devices?.length || 0} devices`);

      // Convert to our BluetoothDevice format
      const bluetoothDevices: BluetoothDevice[] = (devices || [])
        .filter(device => device.name && device.name.trim() !== '')
        .map(device => ({
          id: device.address,
          name: device.name || 'Unknown',
          address: device.address,
        }));

      console.log(`✅ [BT-SERVICE-CLASSIC] Found ${bluetoothDevices.length} named devices`);
      return bluetoothDevices;
    } catch (error: any) {
      console.error('❌ [BT-SERVICE-CLASSIC] Scan error:', error);

      // Try to cancel discovery on error
      try {
        await RNBluetoothClassic.cancelDiscovery();
      } catch (cancelError) {
        console.error('❌ [BT-SERVICE-CLASSIC] Error canceling discovery:', cancelError);
      }

      // Provide user-friendly error messages
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('permission')) {
        throw new Error('Bluetooth permissions denied. Please grant all permissions in Settings and try again.');
      } else if (errorMessage.includes('enabled')) {
        throw error; // Re-throw Bluetooth enabled errors as-is
      } else {
        throw new Error(`Bluetooth scan failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Connect to a Bluetooth device
   */
  async connect(address: string): Promise<boolean> {
    try {
      console.log(`🔗 [BT-SERVICE-CLASSIC] Connecting to ${address}...`);

      // Disconnect if already connected
      if (this.connectedDevice) {
        await this.disconnect();
      }

      // Get list of bonded devices
      const bondedDevices = await RNBluetoothClassic.getBondedDevices();
      let device = bondedDevices.find(d => d.address === address);

      // If not bonded, get from unpaired devices
      if (!device) {
        const unpairedDevices = await RNBluetoothClassic.getUnpairedDevices();
        device = unpairedDevices.find(d => d.address === address);
      }

      if (!device) {
        throw new Error(`Device ${address} not found`);
      }

      // Connect to device
      const connected = await device.connect();
      if (!connected) {
        throw new Error('Failed to connect');
      }

      this.connectedDevice = device;
      console.log(`✅ [BT-SERVICE-CLASSIC] Connected to ${device.name}`);
      return true;
    } catch (error) {
      console.error('❌ [BT-SERVICE-CLASSIC] Connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        console.log('🔌 [BT-SERVICE-CLASSIC] Disconnecting...');
        await this.connectedDevice.disconnect();
        this.connectedDevice = null;
        console.log('✅ [BT-SERVICE-CLASSIC] Disconnected');
      } catch (error) {
        console.error('❌ [BT-SERVICE-CLASSIC] Disconnect error:', error);
        this.connectedDevice = null;
      }
    }
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  /**
   * Send test print
   */
  async testPrint(): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      console.log('🖨️ [BT-SERVICE-CLASSIC] Sending test print...');

      // ESC/POS commands for test print
      const commands = [
        '\x1B\x40',           // Initialize printer
        '\x1B\x61\x01',       // Center align
        '\x1B\x21\x30',       // Double size
        'TEST PRINT\n',
        '\x1B\x21\x00',       // Normal size
        '\x1B\x61\x00',       // Left align
        '------------------------\n',
        'Printer: OK\n',
        'Connection: Bluetooth Classic\n',
        '------------------------\n',
        '\n\n\n',
        '\x1D\x56\x00',       // Cut paper
      ];

      const data = commands.join('');
      await this.connectedDevice.write(data);

      console.log('✅ [BT-SERVICE-CLASSIC] Test print sent');
      return true;
    } catch (error) {
      console.error('❌ [BT-SERVICE-CLASSIC] Test print error:', error);
      throw error;
    }
  }

  /**
   * Print receipt
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      console.log('🖨️ [BT-SERVICE-CLASSIC] Printing receipt...');

      // Get paper size and language from data
      const paperWidth = data.paperSize || '80mm';
      const language = data.language || 'id';

      // Generate ESC/POS commands
      const escPosData = this.generateReceiptESCPOS(data, paperWidth, language);

      // Send to printer
      await this.connectedDevice.write(escPosData);

      console.log('✅ [BT-SERVICE-CLASSIC] Receipt printed');
      return true;
    } catch (error) {
      console.error('❌ [BT-SERVICE-CLASSIC] Print receipt error:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    console.log('🗑️ [BT-SERVICE-CLASSIC] Service destroyed');
  }


  /**
   * Generate ESC/POS commands for receipt
   */
  private generateReceiptESCPOS(data: ReceiptData, paperWidth: string, language: string): string {
    const maxWidth = paperWidth === '58mm' ? 32 : 48;
    const commands: string[] = [];

    // Initialize printer
    commands.push('\x1B\x40');

    // Header - Store Name (centered, double size)
    commands.push('\x1B\x61\x01'); // Center align
    commands.push('\x1B\x21\x30'); // Double size
    commands.push(`${data.storeName}\n`);
    commands.push('\x1B\x21\x00'); // Normal size

    // Store details
    if (data.storeAddress) {
      commands.push(`${data.storeAddress}\n`);
    }
    if (data.storePhone) {
      commands.push(`${data.storePhone}\n`);
    }
    if (data.storeMotto) {
      commands.push(`${data.storeMotto}\n`);
    }

    commands.push('\x1B\x61\x00'); // Left align
    commands.push(this.repeatChar('=', maxWidth) + '\n');

    // Invoice info
    if (data.invoiceNumber) {
      commands.push(`No: ${data.invoiceNumber}\n`);
    }
    commands.push(`${language === 'id' ? 'Tanggal' : 'Date'}: ${data.date}\n`);
    if (data.cashier) {
      commands.push(`${language === 'id' ? 'Kasir' : 'Cashier'}: ${data.cashier}\n`);
    }
    if (data.customerName) {
      commands.push(`${language === 'id' ? 'Pelanggan' : 'Customer'}: ${data.customerName}\n`);
    }

    commands.push(this.repeatChar('=', maxWidth) + '\n');

    // Items
    data.items.forEach(item => {
      const itemName = this.truncate(item.name, maxWidth);
      commands.push(`${itemName}\n`);

      const satuanPart = item.satuan ? ` ${item.satuan}` : '';
      const qtyPrice = `${item.qty} x${satuanPart} ${this.formatCurrency(item.price)}`;
      const total = this.formatCurrency(item.total);

      // If combined length is too long for one line, wrap total to next line (right-aligned)
      if (qtyPrice.length + total.length + 1 > maxWidth) {
        commands.push(`${qtyPrice}\n`);
        commands.push(`${this.repeatChar(' ', maxWidth - total.length)}${total}\n`);
      } else {
        const spacing = maxWidth - qtyPrice.length - total.length;
        commands.push(`${qtyPrice}${this.repeatChar(' ', spacing)}${total}\n`);
      }
    });

    commands.push(this.repeatChar('-', maxWidth) + '\n');

    // Totals
    commands.push(this.formatLine('Subtotal', this.formatCurrency(data.subtotal), maxWidth));

    if (data.discount) {
      commands.push(this.formatLine(language === 'id' ? 'Diskon' : 'Discount', this.formatCurrency(data.discount), maxWidth));
    }

    if (data.ppn) {
      const ppnLabel = `PPN ${data.ppnRate || 11}%`;
      commands.push(this.formatLine(ppnLabel, this.formatCurrency(data.ppn), maxWidth));
    }

    commands.push(this.repeatChar('=', maxWidth) + '\n');
    commands.push('\x1B\x21\x10'); // Bold
    commands.push(this.formatLine('TOTAL', this.formatCurrency(data.total), maxWidth));
    commands.push('\x1B\x21\x00'); // Normal

    if (data.payment) {
      commands.push(this.formatLine(language === 'id' ? 'Bayar' : 'Payment', this.formatCurrency(data.payment), maxWidth));
    }

    if (data.change) {
      commands.push(this.formatLine(language === 'id' ? 'Kembali' : 'Change', this.formatCurrency(data.change), maxWidth));
    }

    commands.push(this.repeatChar('=', maxWidth) + '\n');

    // Footer
    commands.push('\x1B\x61\x01'); // Center align
    commands.push(`\n${language === 'id' ? 'Terima Kasih' : 'Thank You'}\n`);
    commands.push(`${language === 'id' ? 'Selamat Berbelanja Kembali' : 'Please Come Again'}\n`);
    commands.push('\x1B\x61\x00'); // Left align

    // Feed and cut
    commands.push('\n\n\n');
    commands.push('\x1D\x56\x00'); // Cut paper

    return commands.join('');
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  private formatLine(label: string, value: string, maxWidth: number): string {
    const spacing = maxWidth - label.length - value.length;
    return `${label}${this.repeatChar(' ', spacing)}${value}\n`;
  }

  private repeatChar(char: string, count: number): string {
    return char.repeat(Math.max(0, count));
  }

  private truncate(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  }
}

export default BluetoothPrinterService_Classic;
