import { Platform, Alert, PermissionsAndroid } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { IBluetoothPrinterService, BluetoothDevice, PrintOptions, BLEPrintOptions } from './IBluetoothPrinterService';

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
}

/**
 * Bluetooth Printer Service using react-native-ble-plx (Legacy)
 *
 * This service provides Bluetooth Low Energy (BLE) scanning and connection
 * for thermal printers using the ble-plx library.
 */
class BluetoothPrinterService_BLE_PLX implements IBluetoothPrinterService {
  private bleManager: BleManager;
  private connectedDevice: Device | null = null;

  constructor() {
    this.bleManager = new BleManager();
    console.log('✅ [BT-SERVICE-PLX] Bluetooth service initialized with react-native-ble-plx');
  }

  /**
   * Initialize the Bluetooth manager (IBluetoothPrinterService interface)
   */
  async initialize(): Promise<void> {
    await this.requestBluetoothPermissions();
    console.log('✅ [BT-SERVICE-PLX] Initialized');
  }

  /**
   * Get library info (IBluetoothPrinterService interface)
   */
  getLibraryInfo(): string {
    return 'react-native-ble-plx v3.2.1';
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
            console.error('❌ [BT-SERVICE-PLX] Permissions denied:', granted);
          }

          return allGranted;
        } else {
          // Android < 12 (Android 10/MIUI)
          // CRITICAL FIX: On Android < 12, BLUETOOTH and BLUETOOTH_ADMIN are automatically granted
          // We only need to request ACCESS_FINE_LOCATION
          console.log('🔍 [BT-SERVICE-PLX] Requesting location permission for Android < 12...');

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
            console.error('❌ [BT-SERVICE-PLX] Location permission denied');
          } else {
            console.log('✅ [BT-SERVICE-PLX] Location permission granted');
          }

          return isGranted;
        }
      } catch (error) {
        console.error('❌ [BT-SERVICE-PLX] Permission request error:', error);
        return false;
      }
    }
    // iOS permissions are handled automatically via Info.plist
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

          console.log('🔍 [BT-SERVICE-PLX] Android < 12 permission check - Location:', locationGranted);
          return locationGranted;
        }
      } catch (error) {
        console.error('❌ [BT-SERVICE-PLX] Permission check error:', error);
        return false;
      }
    }
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
    console.log('🔍 [BT-SERVICE-PLX] Starting real BLE scan...');

    try {
      // CRITICAL FIX for MIUI/Xiaomi: Verify permissions before scanning
      const hasPermissions = await this.checkBluetoothPermissions();
      if (!hasPermissions) {
        console.error('❌ [BT-SERVICE-PLX] Permissions not granted, requesting...');
        const granted = await this.requestBluetoothPermissions();
        if (!granted) {
          throw new Error('Bluetooth permissions are required to scan for devices. Please grant all permissions in Settings.');
        }
      }

      // Check Bluetooth state before scanning
      const state = await this.bleManager.state();
      console.log('🔍 [BT-SERVICE-PLX] Bluetooth state:', state);
      if (state !== 'PoweredOn') {
        throw new Error('Bluetooth is not enabled. Please turn on Bluetooth and try again.');
      }

      const deviceMap = new Map<string, BluetoothDevice>();

      return new Promise((resolve, reject) => {
        // Stop any existing scan first (MIUI fix)
        try {
          this.bleManager.stopDeviceScan();
        } catch (stopError) {
          console.log('⚠️ [BT-SERVICE-PLX] No existing scan to stop');
        }

        // Add a small delay before starting scan (MIUI stability fix)
        setTimeout(() => {
          console.log('📡 [BT-SERVICE-PLX] Initiating BLE scan...');

          // Wrap startDeviceScan in try-catch to prevent native crashes
          try {
            // Start scanning for 5 seconds
            this.bleManager.startDeviceScan(null, null, (error, device) => {
              if (error) {
                console.error('❌ [BT-SERVICE-PLX] Scan error:', error);
                this.bleManager.stopDeviceScan();

                // Provide user-friendly error message
                const errorMessage = error?.message || String(error);
                if (errorMessage.includes('permission')) {
                  reject(new Error('Bluetooth permissions denied. Please grant all permissions in Settings and try again.'));
                } else if (errorMessage.includes('PoweredOff') || errorMessage.includes('Unauthorized')) {
                  reject(new Error('Bluetooth is not enabled or authorized. Please check your Bluetooth settings.'));
                } else {
                  reject(new Error(`Bluetooth scan failed: ${errorMessage}`));
                }
                return;
              }

              if (device && device.name) {
                // Only add devices with names (likely printers)
                if (!deviceMap.has(device.id)) {
                  const btDevice: BluetoothDevice = {
                    id: device.id,
                    name: device.name,
                    address: device.id,
                  };
                  deviceMap.set(device.id, btDevice);
                  console.log('🔍 [BT-SERVICE-PLX] Found device:', btDevice);
                }
              }
            });

            console.log('⏳ [BT-SERVICE-PLX] Scanning for 5 seconds...');

            // Stop scan after 5 seconds
            setTimeout(() => {
              try {
                this.bleManager.stopDeviceScan();
                const foundDevices = Array.from(deviceMap.values());
                console.log(`✅ [BT-SERVICE-PLX] Scan complete. Found ${foundDevices.length} devices`);
                resolve(foundDevices);
              } catch (stopError) {
                console.error('❌ [BT-SERVICE-PLX] Error stopping scan:', stopError);
                // Still resolve with found devices
                const foundDevices = Array.from(deviceMap.values());
                resolve(foundDevices);
              }
            }, 5000);
          } catch (startError: any) {
            console.error('❌ [BT-SERVICE-PLX] Error starting scan:', startError);
            reject(new Error(`Failed to start Bluetooth scan: ${startError?.message || startError}`));
          }
        }, 300); // 300ms delay before starting scan (MIUI stability)
      });
    } catch (error: any) {
      console.error('❌ [BT-SERVICE-PLX] Scan preparation error:', error);

      // Stop any ongoing scan
      try {
        this.bleManager.stopDeviceScan();
      } catch (stopError) {
        console.error('❌ [BT-SERVICE-PLX] Error stopping scan on error:', stopError);
      }

      throw error;
    }
  }

  /**
   * Connect to a Bluetooth printer
   */
  async connect(address: string): Promise<boolean> {
    let connectionAttempt = 0;
    const maxAttempts = 2;

    while (connectionAttempt < maxAttempts) {
      connectionAttempt++;
      console.log(`🔗 [BT-SERVICE] Connection attempt ${connectionAttempt}/${maxAttempts} for device: ${address}`);

      try {
        // Check Bluetooth state first
        const state = await this.bleManager.state();
        console.log('🔍 [BT-SERVICE] Bluetooth state before connect:', state);
        if (state !== 'PoweredOn') {
          throw new Error('Bluetooth is not enabled. Please turn on Bluetooth and try again.');
        }

        // Disconnect if already connected
        if (this.connectedDevice) {
          console.log('🔌 [BT-SERVICE] Disconnecting previous device...');
          try {
            await this.disconnect();
            // Wait a bit after disconnect to avoid race conditions
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (disconnectError) {
            console.warn('⚠️ [BT-SERVICE] Disconnect warning:', disconnectError);
            // Continue anyway
          }
        }

        // Check if device is already connected (by another app or previous session)
        try {
          const connectedDevices = await this.bleManager.connectedDevices([]);
          const alreadyConnected = connectedDevices.find(d => d.id === address);
          if (alreadyConnected) {
            console.log('⚠️ [BT-SERVICE] Device already connected, canceling first...');
            await this.bleManager.cancelDeviceConnection(address);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (checkError) {
          console.warn('⚠️ [BT-SERVICE] Could not check connected devices:', checkError);
          // Continue anyway
        }

        // WORKAROUND for Xiaomi/MIUI BLE crash: Destroy and recreate BleManager
        if (connectionAttempt > 1) {
          console.log('� [BT-SERVICE] Recreating BLE Manager for retry...');
          try {
            await this.bleManager.destroy();
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.bleManager = new BleManager();
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (recreateError) {
            console.warn('⚠️ [BT-SERVICE] BLE Manager recreation warning:', recreateError);
          }
        }



        // Connect to device with timeout protection
        console.log('📡 [BT-SERVICE] Initiating connection...');

        // Wrap the entire connection in a Promise to catch native crashes
        const device = await new Promise<Device>((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.bleManager.cancelDeviceConnection(address).catch(() => {});
            reject(new Error('Connection timeout after 10 seconds'));
          }, 10000);

          // Use different connection options for better compatibility
          const connectionOptions = {
            timeout: 10000,
            autoConnect: false, // Disable auto-connect for better control
            requestMTU: 512, // Request larger MTU upfront
          };

          this.bleManager.connectToDevice(address, connectionOptions)
            .then(device => {
              clearTimeout(timeout);
              console.log('✅ [BT-SERVICE] Device object received');
              resolve(device);
            })
            .catch(error => {
              clearTimeout(timeout);
              console.error('❌ [BT-SERVICE] connectToDevice rejected:', error);

              // Handle GATT_ERROR 133 specifically (common Android BLE error)
              const errorStr = String(error);
              if (errorStr.includes('133') || errorStr.includes('GATT')) {
                reject(new Error('Bluetooth connection failed (GATT Error 133). Please try again or restart Bluetooth.'));
              } else if (!error || error === null || error === undefined) {
                // Handle null/undefined error from BLE library bug
                reject(new Error('Bluetooth connection failed with unknown error. Please try again.'));
              } else {
                reject(error);
              }
            });
        });

        console.log('✅ [BT-SERVICE] Device connected, discovering services...');

        // Discover services with timeout protection
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Service discovery timeout after 8 seconds'));
          }, 8000);

          device.discoverAllServicesAndCharacteristics()
            .then(() => {
              clearTimeout(timeout);
              resolve();
            })
            .catch(error => {
              clearTimeout(timeout);
              reject(error);
            });
        });

        console.log('✅ [BT-SERVICE] Services discovered');

        this.connectedDevice = device;
        console.log('✅ [BT-SERVICE] Connected successfully');
        return true;

      } catch (error: any) {
        console.error(`❌ [BT-SERVICE] Connection attempt ${connectionAttempt} error:`, error);

        // Clean up on error
        if (this.connectedDevice) {
          try {
            await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
          } catch (cleanupError) {
            console.error('❌ [BT-SERVICE] Cleanup error:', cleanupError);
          }
          this.connectedDevice = null;
        }

        // Try to cancel the connection attempt
        try {
          await this.bleManager.cancelDeviceConnection(address);
        } catch (cancelError) {
          console.error('❌ [BT-SERVICE] Cancel error:', cancelError);
        }

        // If this was the last attempt, throw the error
        if (connectionAttempt >= maxAttempts) {
          // Provide more specific error message
          const errorMessage = error?.message || String(error);
          if (errorMessage.includes('timeout')) {
            throw new Error('Connection timeout. Please make sure the printer is turned on and in range.');
          } else if (errorMessage.includes('already connected')) {
            throw new Error('Device is already connected. Please try again.');
          } else if (errorMessage.includes('Bluetooth')) {
            throw error; // Re-throw Bluetooth state errors as-is
          } else {
            throw new Error(`Connection failed after ${maxAttempts} attempts: ${errorMessage}`);
          }
        }

        // Wait before retry
        console.log('⏳ [BT-SERVICE] Waiting 2 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Connection failed: Maximum attempts reached');
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
   * @param options - BLE print behaviour overrides (scenarios 2–5)
   */
  async printReceipt(data: ReceiptData, options?: PrintOptions): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        console.error('❌ [BT-SERVICE-PLX] No printer connected');
        Alert.alert('Error', 'No printer connected. Please connect to a printer first.');
        return false;
      }

      console.log('🖨️ [BT-SERVICE-PLX] Printing receipt to Bluetooth printer...');

      // Get paper size and language from data (with defaults)
      const paperWidth = data.paperSize || '80mm';
      const language = data.language || 'id';

      // Generate ESC/POS commands for thermal printer
      const escPosData = this.generateReceiptESCPOS(data, paperWidth, language);
      console.log(`📄 [BT-SERVICE-PLX] Generated receipt data (${escPosData.length} characters)`);

      // Send data to printer via BLE with timeout protection
      const printPromise = this.sendDataToPrinter(escPosData, options?.ble);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Print timeout after 30 seconds')), 30000)
      );

      await Promise.race([printPromise, timeoutPromise]);

      console.log('✅ [BT-SERVICE] Receipt printed successfully');
      return true;
    } catch (err: any) {
      console.error('❌ [BT-SERVICE] Print receipt error:', err);

      // Extract meaningful error message
      const errorMessage = err?.message || String(err);

      // Don't show alert if it's a timeout (user might have already left the screen)
      if (!errorMessage.includes('timeout')) {
        Alert.alert('Print Error', `Failed to print receipt: ${errorMessage}`);
      } else {
        console.error('❌ [BT-SERVICE] Print timeout - printer may be slow or disconnected');
      }

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
              <span>${item.qty} x${item.satuan ? ` ${item.satuan}` : ''} ${this.formatCurrency(item.price)}</span>
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
   * @param options - BLE print behaviour overrides (scenarios 2–5)
   */
  async testPrint(options?: PrintOptions): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        console.error('❌ [BT-SERVICE] No printer connected');
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

      console.log(`📄 [BT-SERVICE] Test print data (${data.length} characters)`);

      // Send with timeout protection, passing BLE options for the active scenario
      const printPromise = this.sendDataToPrinter(data, options?.ble);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test print timeout after 30 seconds')), 30000)
      );

      await Promise.race([printPromise, timeoutPromise]);

      console.log('✅ [BT-SERVICE] Test print sent successfully');
      return true;
    } catch (err: any) {
      console.error('❌ [BT-SERVICE] Test print error:', err);

      // Extract meaningful error message
      const errorMessage = err?.message || String(err);
      Alert.alert('Print Error', `Failed to print: ${errorMessage}`);

      return false;
    }
  }

  /**
   * Send raw data to connected Bluetooth printer.
   *
   * @param data    ESC/POS string to transmit
   * @param options BLE behaviour overrides from the active print scenario:
   *   - forceWriteWithResponse  (Scenario 2) always use ACK writes
   *   - forceWriteWithoutResponse (Scenario 3) always skip ACK
   *   - scanAllUUIDs            (Scenario 4) do not skip any UUID
   *   - skipMTU                 (Scenario 5) do not negotiate MTU
   */
  private async sendDataToPrinter(data: string, options?: BLEPrintOptions): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No printer connected');
    }

    const forceWithResponse    = options?.forceWriteWithResponse    ?? false;
    const forceWithoutResponse = options?.forceWriteWithoutResponse ?? false;
    const scanAllUUIDs         = options?.scanAllUUIDs              ?? false;
    const skipMTU              = options?.skipMTU                   ?? false;

    try {
      console.log('📤 [BT-SERVICE] Sending data to printer...');
      console.log(`🔧 [BT-SERVICE] BLE options: forceWithResponse=${forceWithResponse}, forceWithoutResponse=${forceWithoutResponse}, scanAllUUIDs=${scanAllUUIDs}, skipMTU=${skipMTU}`);

      // Get services and characteristics
      const services = await this.connectedDevice.services();
      console.log(`🔍 [BT-SERVICE] Found ${services.length} services`);

      // Common printer characteristic UUIDs (in order of priority)
      const PRINTER_CHAR_UUIDS = [
        '00002af1-0000-1000-8000-00805f9b34fb', // Common thermal printer write characteristic
        '0000ff02-0000-1000-8000-00805f9b34fb', // Another common write characteristic
        '49535343-8841-43f4-a8d4-ecbe34729bb3', // HM-10 write characteristic
      ];

      // Skip known non-printer characteristics (only when NOT in scanAllUUIDs mode)
      const SKIP_CHAR_UUIDS = [
        '00002a00-0000-1000-8000-00805f9b34fb', // Device Name (read-only)
        '00002a01-0000-1000-8000-00805f9b34fb', // Appearance
        '00002a04-0000-1000-8000-00805f9b34fb', // Peripheral Preferred Connection Parameters
        '00002a05-0000-1000-8000-00805f9b34fb', // Service Changed
      ];

      let printCharacteristic = null;

      // Scenario 4 (scanAllUUIDs): scan every writable characteristic without filtering
      if (scanAllUUIDs) {
        console.log('🔍 [BT-SERVICE] Scenario 4 — scanning ALL writable characteristics...');
        for (const service of services) {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
              console.log(`🔍 [BT-SERVICE] Found writable characteristic (all-scan): ${char.uuid}`);
              printCharacteristic = char;
              break;
            }
          }
          if (printCharacteristic) break;
        }
      } else {
        // Default: try known UUIDs first
        for (const service of services) {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (PRINTER_CHAR_UUIDS.includes(char.uuid.toLowerCase())) {
              if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
                console.log(`✅ [BT-SERVICE] Found known printer characteristic: ${char.uuid}`);
                printCharacteristic = char;
                break;
              }
            }
          }
          if (printCharacteristic) break;
        }

        // Fallback: any writable char that is not a known non-printer UUID
        if (!printCharacteristic) {
          console.log('⚠️ [BT-SERVICE] No known printer characteristic found, searching for writable characteristics...');
          for (const service of services) {
            const characteristics = await service.characteristics();
            for (const char of characteristics) {
              if (SKIP_CHAR_UUIDS.includes(char.uuid.toLowerCase())) {
                console.log(`⏭️ [BT-SERVICE] Skipping non-printer characteristic: ${char.uuid}`);
                continue;
              }
              if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
                console.log(`🔍 [BT-SERVICE] Found writable characteristic: ${char.uuid}`);
                printCharacteristic = char;
                break;
              }
            }
            if (printCharacteristic) break;
          }
        }
      }

      if (!printCharacteristic) {
        throw new Error('No suitable print characteristic found on printer');
      }

      console.log(`✍️ [BT-SERVICE] Writing to characteristic: ${printCharacteristic.uuid}`);

      // Scenario 5 (skipMTU): skip MTU negotiation entirely to avoid crashing older printers
      if (!skipMTU) {
        try {
          await this.connectedDevice.requestMTU(512);
          console.log(`📏 [BT-SERVICE] Requested MTU: 512 bytes`);
        } catch (mtuError) {
          console.log(`⚠️ [BT-SERVICE] Could not request MTU, using default`);
        }
      } else {
        console.log(`📏 [BT-SERVICE] Scenario 5 — skipping MTU negotiation`);
      }

      // Use conservative chunk size to avoid BLE MTU issues
      const chunkSize = 20; // Safe size that works with all BLE devices
      console.log(`📦 [BT-SERVICE] Using chunk size: ${chunkSize} bytes`);

      // Split data into chunks and send
      const dataBytes = new TextEncoder().encode(data);
      const totalChunks = Math.ceil(dataBytes.length / chunkSize);
      console.log(`📊 [BT-SERVICE] Total data size: ${dataBytes.length} bytes, chunks: ${totalChunks}`);

      // Write data with proper error handling and chunking
      try {
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, dataBytes.length);
          const chunk = dataBytes.slice(start, end);

          // Convert chunk to base64 for BLE transmission
          const base64Chunk = btoa(String.fromCharCode(...chunk));

          console.log(`📤 [BT-SERVICE] Sending chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)`);

          // Determine write method based on scenario options and characteristic capability
          const useWithResponse = forceWithResponse
            ? true  // Scenario 2: always ACK
            : forceWithoutResponse
              ? false  // Scenario 3: never ACK
              : !printCharacteristic.isWritableWithoutResponse; // default: prefer without-response

          if (!useWithResponse) {
            // Write without response (faster, Scenario 3 or default when supported)
            await printCharacteristic.writeWithoutResponse(base64Chunk);
            // Small delay between chunks to prevent buffer overflow
            await new Promise(resolve => setTimeout(resolve, 10));
          } else {
            // Write with response (reliable, Scenario 2 or fallback)
            await printCharacteristic.writeWithResponse(base64Chunk);
          }
        }

        console.log('✅ [BT-SERVICE] All data sent successfully');
      } catch (writeError: any) {
        console.error('❌ [BT-SERVICE] Write error:', writeError);

        // Provide more specific error message
        if (writeError.message?.includes('GATT')) {
          throw new Error('Bluetooth communication error. The printer may not support this operation.');
        } else if (writeError.message?.includes('MTU') || writeError.message?.includes('size')) {
          throw new Error('Data too large for printer. Try using a smaller paper size or fewer items.');
        } else {
          throw new Error(`Failed to send data to printer: ${writeError.message || writeError}`);
        }
      }
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

    // Determine max width based on paper size
    const maxChars = paperWidth === '58mm' ? 32 : 48;

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

    // Helper function to format line with right alignment
    const formatRightAlign = (left: string, right: string, maxWidth: number): string => {
      const totalLen = left.length + right.length;
      if (totalLen <= maxWidth) {
        const spaces = maxWidth - totalLen;
        return left + ' '.repeat(spaces) + right;
      }
      // If too long, truncate left side to ensure right side is fully visible
      const maxLeftLen = maxWidth - right.length - 1;
      if (maxLeftLen > 0) {
        return left.substring(0, maxLeftLen) + ' ' + right;
      }
      // If still too long, just return the right side
      return right;
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
    output += '='.repeat(maxChars) + '\n';

    // Date and receipt number
    output += `${labels.date}: ${data.date}\n`;
    output += `${labels.receipt}: ${data.receiptNumber}\n`;
    if (data.customerName) {
      output += `${labels.customer}: ${data.customerName}\n`;
    }
    output += '='.repeat(maxChars) + '\n';

    // Items - ensure price is always on same line as qty, total on separate line if needed
    for (const item of data.items) {
      output += `${item.name}\n`;
      
      const satuanPart = item.satuan ? ` ${item.satuan}` : '';
      const qtyPrice = `  ${item.qty} x${satuanPart} ${this.formatCurrency(item.price)}`;
      const itemTotal = this.formatCurrency(item.total);

      // If combined length is too long for one line, wrap total to next line (right-aligned)
      if (qtyPrice.length + itemTotal.length + 1 > maxChars) {
        output += qtyPrice + '\n';
        output += ' '.repeat(maxChars - itemTotal.length) + itemTotal + '\n';
      } else {
        output += formatRightAlign(qtyPrice, itemTotal, maxChars) + '\n';
      }
    }

    output += '='.repeat(maxChars) + '\n';

    // Totals (right align) - ensure values are always on same line as label
    output += formatRightAlign(labels.subtotal + ':', this.formatCurrency(data.subtotal), maxChars) + '\n';

    if (data.discount && data.discount > 0) {
      output += formatRightAlign(labels.discount + ':', this.formatCurrency(data.discount), maxChars) + '\n';
    }

    if (data.tax && data.tax > 0) {
      output += formatRightAlign(labels.tax + ':', this.formatCurrency(data.tax), maxChars) + '\n';
    }

    output += '='.repeat(maxChars) + '\n';
    
    // Total - use normal size font to prevent overflow, but make it bold
    output += ESC + 'E' + '\x01'; // Bold on
    const totalLine = formatRightAlign(labels.total + ':', this.formatCurrency(data.total), maxChars);
    output += totalLine + '\n';
    output += ESC + 'E' + '\x00'; // Bold off
    output += '='.repeat(maxChars) + '\n';

    // Payment info - ensure values stay on same line
    if (data.payment) {
      output += formatRightAlign(labels.payment + ':', this.formatCurrency(data.payment), maxChars) + '\n';
      if (data.change && data.change > 0) {
        output += formatRightAlign(labels.change + ':', this.formatCurrency(data.change), maxChars) + '\n';
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

  /**
   * Cleanup resources (IBluetoothPrinterService interface)
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    await this.bleManager.destroy();
    console.log('🗑️ [BT-SERVICE-PLX] Service destroyed');
  }

  /**
   * Check if connected (IBluetoothPrinterService interface)
   */
  isConnected(): boolean {
    return this.connectedDevice !== null;
  }
}

export default BluetoothPrinterService_BLE_PLX;

