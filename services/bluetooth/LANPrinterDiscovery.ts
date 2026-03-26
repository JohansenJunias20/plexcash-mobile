import Zeroconf from 'react-native-zeroconf';
import { LANPrinter } from './LANPrinterService';

/**
 * LAN Printer Discovery Service using mDNS/Bonjour
 * 
 * This service discovers network printers using mDNS protocol.
 * It searches for _ipp._tcp and _printer._tcp services.
 */
class LANPrinterDiscovery {
  private zeroconf: Zeroconf;
  private discoveredPrinters: Map<string, LANPrinter>;
  private isScanning: boolean = false;

  constructor() {
    this.zeroconf = new Zeroconf();
    this.discoveredPrinters = new Map();
    console.log('✅ [LAN-DISCOVERY] Discovery service initialized');
  }

  /**
   * Discover LAN printers on the network
   * @param durationMs - Scan duration in milliseconds (default: 10000)
   * @returns Array of discovered LAN printers
   */
  async discoverPrinters(durationMs: number = 10000): Promise<LANPrinter[]> {
    if (this.isScanning) {
      console.warn('⚠️ [LAN-DISCOVERY] Already scanning');
      return Array.from(this.discoveredPrinters.values());
    }

    return new Promise((resolve, reject) => {
      this.discoveredPrinters.clear();
      this.isScanning = true;

      console.log('🔍 [LAN-DISCOVERY] Starting mDNS discovery...');

      // Listen for service resolution
      this.zeroconf.on('resolved', (service: any) => {
        console.log('🖨️ [LAN-DISCOVERY] Found printer:', service);

        // Extract printer information
        const name = service.name || service.host || 'Unknown Printer';
        const host = service.host || service.addresses?.[0];
        const port = service.port || 9100;

        if (host) {
          const printer: LANPrinter = {
            id: `${host}:${port}`,
            name: name,
            ip: host,
            port: port,
          };

          this.discoveredPrinters.set(printer.id, printer);
          console.log(`✅ [LAN-DISCOVERY] Added printer: ${printer.name} (${printer.ip}:${printer.port})`);
        }
      });

      // Listen for errors
      this.zeroconf.on('error', (error: any) => {
        console.error('❌ [LAN-DISCOVERY] Error:', error);
      });

      // Start scanning for printer services
      try {
        // Scan for IPP (Internet Printing Protocol) services
        this.zeroconf.scan('ipp', 'tcp', 'local.');
        
        // Also scan for generic printer services
        setTimeout(() => {
          this.zeroconf.scan('printer', 'tcp', 'local.');
        }, 100);

        // Stop scanning after duration
        setTimeout(() => {
          this.stopDiscovery();
          const printers = Array.from(this.discoveredPrinters.values());
          console.log(`🏁 [LAN-DISCOVERY] Discovery complete. Found ${printers.length} printer(s)`);
          this.isScanning = false;
          resolve(printers);
        }, durationMs);
      } catch (error) {
        console.error('❌ [LAN-DISCOVERY] Scan error:', error);
        this.isScanning = false;
        reject(error);
      }
    });
  }

  /**
   * Stop the discovery process
   */
  stopDiscovery(): void {
    try {
      this.zeroconf.stop();
      console.log('🛑 [LAN-DISCOVERY] Discovery stopped');
    } catch (error) {
      console.error('❌ [LAN-DISCOVERY] Stop error:', error);
    }
  }

  /**
   * Validate IP address format
   */
  static validateIP(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return false;
    }

    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validate port number
   */
  static validatePort(port: number): boolean {
    return port >= 1 && port <= 65535;
  }

  /**
   * Create a manual LAN printer entry
   */
  static createManualPrinter(name: string, ip: string, port: number = 9100): LANPrinter | null {
    if (!this.validateIP(ip)) {
      console.error('❌ [LAN-DISCOVERY] Invalid IP address:', ip);
      return null;
    }

    if (!this.validatePort(port)) {
      console.error('❌ [LAN-DISCOVERY] Invalid port:', port);
      return null;
    }

    return {
      id: `${ip}:${port}`,
      name: name || `Printer (${ip})`,
      ip,
      port,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopDiscovery();
    this.discoveredPrinters.clear();
    console.log('🗑️ [LAN-DISCOVERY] Service destroyed');
  }
}

export default LANPrinterDiscovery;

