/**
 * Bluetooth Printer Service Interface
 * Abstraction layer to support multiple BLE libraries
 */

export interface BluetoothDevice {
  id: string;
  name: string | null;
  address: string;
}

export interface IBluetoothPrinterService {
  /**
   * Initialize the Bluetooth manager
   */
  initialize(): Promise<void>;

  /**
   * Scan for available Bluetooth devices
   * @param durationMs - Scan duration in milliseconds (default: 5000)
   * @returns Array of discovered devices
   */
  scanDevices(durationMs?: number): Promise<BluetoothDevice[]>;

  /**
   * Connect to a Bluetooth device
   * @param address - Device MAC address
   * @returns true if connected successfully
   */
  connect(address: string): Promise<boolean>;

  /**
   * Disconnect from current device
   */
  disconnect(): Promise<void>;

  /**
   * Check if currently connected to a device
   */
  isConnected(): boolean;

  /**
   * Send test print to connected printer
   */
  testPrint(): Promise<boolean>;

  /**
   * Print receipt data
   * @param data - Receipt data to print
   */
  printReceipt(data: any): Promise<boolean>;

  /**
   * Get the library name/version
   */
  getLibraryInfo(): string;

  /**
   * Cleanup resources
   */
  destroy(): Promise<void>;
}

