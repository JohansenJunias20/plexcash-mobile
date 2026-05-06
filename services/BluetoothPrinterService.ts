/**
 * Bluetooth Printer Service - Main Export
 *
 * This file exports the Bluetooth service instance from the factory.
 * The factory allows switching between different BLE libraries:
 * - ble-manager (Recommended, better stability on Android/MIUI)
 * - ble-plx (Legacy, original implementation)
 *
 * Usage:
 *   import BluetoothPrinterService from './services/BluetoothPrinterService';
 *   await BluetoothPrinterService.initialize();
 *   const devices = await BluetoothPrinterService.scanDevices();
 *
 * To switch libraries:
 *   import { BluetoothPrinterServiceFactory } from './services/BluetoothPrinterService';
 *   await BluetoothPrinterServiceFactory.switchLibrary('ble-manager');
 */

import BluetoothPrinterServiceFactory from './bluetooth/BluetoothPrinterServiceFactory';

// Export the factory instance as default
const BluetoothPrinterService = BluetoothPrinterServiceFactory.getInstance();
export default BluetoothPrinterService;

// Export factory for switching libraries
export { BluetoothPrinterServiceFactory };

// Export types
export type { BleLibraryType, PrinterLibraryType } from './bluetooth/BluetoothPrinterServiceFactory';
export type { BluetoothDevice, IBluetoothPrinterService, PrintScenario, PrintOptions, BLEPrintOptions, ClassicPrintOptions } from './bluetooth/IBluetoothPrinterService';

export type { ReceiptData } from './bluetooth/BluetoothPrinterService_BLE_PLX';
export type { LANPrinter, ProtocolType, ProtocolTestResult, ProtocolConfirmationCallback } from './bluetooth/LANPrinterService';

// Export LAN printer discovery
export { default as LANPrinterDiscovery } from './bluetooth/LANPrinterDiscovery';

// Export LAN printer service for direct access
export { default as LANPrinterService } from './bluetooth/LANPrinterService';
