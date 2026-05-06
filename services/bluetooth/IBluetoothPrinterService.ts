/**
 * Bluetooth Printer Service Interface
 * Abstraction layer to support multiple BLE libraries
 */

export interface BluetoothDevice {
  id: string;
  name: string | null;
  address: string;
}

/**
 * Print scenario options for troubleshooting Bluetooth printer connectivity issues.
 *
 * Skenario troubleshooting ketika printer terkoneksi tapi tidak bisa print:
 * - '1' = BT Classic (SPP) — default, cocok mayoritas thermal printer
 * - '2' = BLE + Write With Response — printer BLE perlu ACK per chunk
 * - '3' = BLE + Write Without Response — printer BLE tidak perlu ACK (lebih cepat)
 * - '4' = BLE + All UUID Scan — UUID non-standar, scan semua writable characteristic
 * - '5' = BLE + No MTU — printer lama tidak support MTU negotiation
 * - '6' = BT Classic + No Paper Cut — printer tidak support cut paper command
 */
export type PrintScenario = '1' | '2' | '3' | '4' | '5' | '6';

/** Options passed to BLE-based print operations */
export interface BLEPrintOptions {
  /** Force write with acknowledgement (scenario 2) */
  forceWriteWithResponse?: boolean;
  /** Force write without acknowledgement (scenario 3) */
  forceWriteWithoutResponse?: boolean;
  /** Scan ALL writable characteristics, not just known UUIDs (scenario 4) */
  scanAllUUIDs?: boolean;
  /** Skip MTU negotiation request (scenario 5) */
  skipMTU?: boolean;
}

/** Options for Classic BT print operations */
export interface ClassicPrintOptions {
  /** Omit paper cut ESC/POS command at end of receipt (scenario 6) */
  noCut?: boolean;
}

/** Combined print options applicable to any service */
export interface PrintOptions {
  ble?: BLEPrintOptions;
  classic?: ClassicPrintOptions;
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
   * @param options - Optional print behaviour overrides for troubleshooting
   */
  testPrint(options?: PrintOptions): Promise<boolean>;

  /**
   * Print receipt data
   * @param data - Receipt data to print
   * @param options - Optional print behaviour overrides for troubleshooting
   */
  printReceipt(data: any, options?: PrintOptions): Promise<boolean>;

  /**
   * Get the library name/version
   */
  getLibraryInfo(): string;

  /**
   * Cleanup resources
   */
  destroy(): Promise<void>;
}


