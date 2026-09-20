import { Platform } from 'react-native';
import { IBluetoothPrinterService } from './IBluetoothPrinterService';
import BluetoothPrinterService_BLE_PLX from './BluetoothPrinterService_BLE_PLX';
import BluetoothPrinterService_Classic from './BluetoothPrinterService_Classic';
import LANPrinterService from './LANPrinterService';

export type PrinterLibraryType = 'ble-plx' | 'bt-classic' | 'lan';
export type BleLibraryType = PrinterLibraryType; // Backward compatibility

/**
 * Factory for creating Printer Service instances
 * Supports Bluetooth (BLE-PLX, BT-Classic) and LAN printers
 */
class BluetoothPrinterServiceFactory {
  private static instance: IBluetoothPrinterService | null = null;
  // Default to BLE-PLX on iOS (Classic BT not supported on iOS) and bt-classic on Android
  private static currentLibrary: PrinterLibraryType = Platform.OS === 'ios' ? 'ble-plx' : 'bt-classic';

  /**
   * Get the current service instance
   */
  static getInstance(): IBluetoothPrinterService {
    if (!this.instance) {
      this.instance = this.createInstance(this.currentLibrary);
    }
    return this.instance;
  }

  /**
   * Switch to a different printer library
   * @param library - The library to switch to
   */
  static async switchLibrary(library: PrinterLibraryType): Promise<void> {
    console.log(`🔄 [PRINTER-FACTORY] Switching library from ${this.currentLibrary} to ${library}`);

    // Destroy current instance if exists
    if (this.instance) {
      try {
        await this.instance.destroy();
      } catch (error) {
        console.error('❌ [PRINTER-FACTORY] Error destroying old instance:', error);
      }
      this.instance = null;
    }

    // Create new instance
    this.currentLibrary = library;
    this.instance = this.createInstance(library);

    console.log(`✅ [PRINTER-FACTORY] Switched to ${library}`);
  }

  /**
   * Get current library type
   */
  static getCurrentLibrary(): PrinterLibraryType {
    return this.currentLibrary;
  }

  /**
   * Create a new service instance
   */
  private static createInstance(library: PrinterLibraryType): IBluetoothPrinterService {
    switch (library) {
      case 'ble-plx':
        console.log('📦 [PRINTER-FACTORY] Creating BLE-PLX instance (Legacy)');
        return new BluetoothPrinterService_BLE_PLX();

      case 'bt-classic':
        if (Platform.OS === 'ios') {
          console.warn('⚠️ [PRINTER-FACTORY] Bluetooth Classic is not supported on iOS, using BLE-PLX');
          return new BluetoothPrinterService_BLE_PLX();
        }
        console.log('📦 [PRINTER-FACTORY] Creating Bluetooth Classic instance (Recommended)');
        return new BluetoothPrinterService_Classic();

      case 'lan':
        console.log('📦 [PRINTER-FACTORY] Creating LAN Printer instance');
        return new LANPrinterService();

      default:
        if (Platform.OS === 'ios') {
          console.warn(`⚠️ [PRINTER-FACTORY] Unknown library: ${library}, defaulting to ble-plx on iOS`);
          return new BluetoothPrinterService_BLE_PLX();
        }
        console.warn(`⚠️ [PRINTER-FACTORY] Unknown library: ${library}, defaulting to bt-classic`);
        return new BluetoothPrinterService_Classic();
    }
  }
}

export default BluetoothPrinterServiceFactory;

