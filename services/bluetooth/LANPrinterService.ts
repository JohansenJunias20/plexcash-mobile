import { Platform } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
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

export interface LANPrinter {
  id: string;
  name: string;
  ip: string;
  port: number;
  protocol?: 'raw' | 'lpd'; // Protocol to use: 'raw' for RAW TCP (port 9100), 'lpd' for LPD (port 515)
  lastUsed?: Date;
  isDefault?: boolean;
}

// Protocol configuration constants
const RAW_TCP_PORT = 9100;
const LPD_PORT = 515;
const CONNECTION_TIMEOUT = 30000; // 30 seconds

// Protocol fallback result types
export type ProtocolType = 'raw' | 'lpd';

export interface ProtocolTestResult {
  success: boolean;
  protocol: ProtocolType;
  error?: string;
}

// Callback type for user confirmation dialog
export type ProtocolConfirmationCallback = (protocol: ProtocolType) => Promise<boolean>;

/**
 * LAN Printer Service using TCP Socket
 *
 * This service provides LAN printing support for thermal printers
 * using direct RAW TCP socket communication (port 9100) or LPD protocol (port 515).
 * Supports automatic protocol fallback with user confirmation.
 */
class LANPrinterService implements IBluetoothPrinterService {
  private currentPrinter: LANPrinter | null = null;
  private socket: any = null;
  private jobNumber: number = 1; // LPD job number counter

  constructor() {
    console.log('✅ [LAN-PRINTER] LAN Printer service initialized');
  }

  /**
   * Initialize the LAN printer service
   */
  async initialize(): Promise<void> {
    console.log('✅ [LAN-PRINTER] Initialized');
  }

  /**
   * Scan for available LAN printers (not applicable for LAN)
   * Use LANPrinterDiscovery for mDNS discovery instead
   */
  async scanDevices(durationMs?: number): Promise<BluetoothDevice[]> {
    console.log('⚠️ [LAN-PRINTER] scanDevices not applicable for LAN printers. Use LANPrinterDiscovery instead.');
    return [];
  }

  /**
   * Connect to a LAN printer
   * @param address - Format: "ip:port" or "ip:port:protocol" (e.g., "192.168.1.100:9100" or "192.168.1.100:9100:raw")
   */
  async connect(address: string): Promise<boolean> {
    try {
      const parts = address.split(':');
      const ip = parts[0];
      const port = parseInt(parts[1]) || RAW_TCP_PORT;
      const protocol = (parts[2] as ProtocolType) || 'raw';

      console.log(`🔗 [LAN-PRINTER] Connecting to ${ip}:${port} (protocol: ${protocol})...`);

      this.currentPrinter = {
        id: `${ip}:${port}`,
        name: `LAN Printer (${ip})`,
        ip,
        port,
        protocol,
      };

      return true;
    } catch (error) {
      console.error('❌ [LAN-PRINTER] Connection error:', error);
      return false;
    }
  }

  /**
   * Connect with a LANPrinter object directly
   */
  async connectWithPrinter(printer: LANPrinter): Promise<boolean> {
    try {
      console.log(`🔗 [LAN-PRINTER] Connecting to ${printer.ip}:${printer.port} (protocol: ${printer.protocol || 'raw'})...`);
      this.currentPrinter = { ...printer, protocol: printer.protocol || 'raw' };
      return true;
    } catch (error) {
      console.error('❌ [LAN-PRINTER] Connection error:', error);
      return false;
    }
  }

  /**
   * Get the current printer configuration
   */
  getCurrentPrinter(): LANPrinter | null {
    return this.currentPrinter;
  }

  /**
   * Update the protocol for the current printer
   */
  setProtocol(protocol: ProtocolType): void {
    if (this.currentPrinter) {
      this.currentPrinter.protocol = protocol;
      console.log(`🔧 [LAN-PRINTER] Protocol set to: ${protocol}`);
    }
  }

  /**
   * Disconnect from current printer
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        this.socket.destroy();
        console.log('🔌 [LAN-PRINTER] Disconnected from printer');
      } catch (error) {
        console.error('❌ [LAN-PRINTER] Disconnect error:', error);
      }
      this.socket = null;
    }
    this.currentPrinter = null;
  }

  /**
   * Check if currently connected to a printer
   */
  isConnected(): boolean {
    return this.currentPrinter !== null;
  }

  /**
   * Send test print to connected printer
   */
  async testPrint(): Promise<boolean> {
    if (!this.currentPrinter) {
      throw new Error('No printer connected');
    }

    try {
      console.log('🖨️ [LAN-PRINTER] Sending test print...');

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
      data += 'LAN Printer Working!\n';
      data += new Date().toLocaleString('id-ID') + '\n';
      data += '================\n';
      data += '\n\n\n';
      data += GS + 'V' + '\x00'; // Cut paper

      await this.sendDataToPrinter(data);
      console.log('✅ [LAN-PRINTER] Test print sent successfully');
      return true;
    } catch (error) {
      console.error('❌ [LAN-PRINTER] Test print error:', error);
      throw error;
    }
  }

  /**
   * Print receipt data
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this.currentPrinter) {
      throw new Error('No printer connected');
    }

    try {
      console.log('🖨️ [LAN-PRINTER] Printing receipt...');

      const paperWidth = data.paperSize || '80mm';
      const language = data.language || 'id';

      // Generate ESC/POS commands
      const escPosData = this.generateReceiptESCPOS(data, paperWidth, language);
      console.log(`📄 [LAN-PRINTER] Generated receipt data (${escPosData.length} characters)`);

      // Send to printer
      await this.sendDataToPrinter(escPosData);

      console.log('✅ [LAN-PRINTER] Receipt printed successfully');
      return true;
    } catch (error) {
      console.error('❌ [LAN-PRINTER] Print receipt error:', error);
      throw error;
    }
  }

  /**
   * Get library info
   */
  getLibraryInfo(): string {
    return 'LAN Printer (TCP Socket)';
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    console.log('🗑️ [LAN-PRINTER] Service destroyed');
  }

  /**
   * Send raw data to LAN printer using the configured protocol
   */
  private async sendDataToPrinter(data: string): Promise<void> {
    if (!this.currentPrinter) {
      throw new Error('No printer connected');
    }

    const protocol = this.currentPrinter.protocol || 'raw';

    if (protocol === 'lpd') {
      return this.sendDataViaLPD(data);
    } else {
      return this.sendDataViaRawTCP(data);
    }
  }

  /**
   * Send raw data to LAN printer via RAW TCP socket (port 9100)
   */
  private async sendDataViaRawTCP(data: string, customPort?: number): Promise<void> {
    if (!this.currentPrinter) {
      throw new Error('No printer connected');
    }

    const printer = this.currentPrinter;
    const port = customPort || printer.port || RAW_TCP_PORT;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
        }
        reject(new Error('Connection timeout after 30 seconds'));
      }, CONNECTION_TIMEOUT);

      try {
        console.log(`📤 [LAN-PRINTER] RAW TCP connecting to ${printer.ip}:${port}...`);

        // Create TCP socket
        this.socket = TcpSocket.createConnection(
          {
            port: port,
            host: printer.ip,
          },
          () => {
            console.log('✅ [LAN-PRINTER] RAW TCP socket connected');

            // Convert string to buffer and send in chunks
            const buffer = Buffer.from(data, 'binary');
            const chunkSize = 1024; // 1KB chunks to prevent buffer overflow

            let offset = 0;
            const sendChunk = () => {
              if (offset >= buffer.length) {
                console.log('✅ [LAN-PRINTER] All data sent via RAW TCP');
                clearTimeout(timeout);

                // Wait a bit for printer to process, then close
                setTimeout(() => {
                  if (this.socket) {
                    this.socket.destroy();
                  }
                  resolve();
                }, 1000);
                return;
              }

              const chunk = buffer.slice(offset, offset + chunkSize);
              this.socket.write(chunk, () => {
                offset += chunkSize;
                sendChunk();
              });
            };

            sendChunk();
          }
        );

        this.socket.on('error', (error: Error) => {
          console.error('❌ [LAN-PRINTER] RAW TCP socket error:', error);
          clearTimeout(timeout);
          if (this.socket) {
            this.socket.destroy();
          }
          reject(error);
        });

        this.socket.on('close', () => {
          console.log('🔌 [LAN-PRINTER] RAW TCP socket closed');
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error('❌ [LAN-PRINTER] RAW TCP send error:', error);
        reject(error);
      }
    });
  }

  /**
   * Send raw data to LAN printer via LPD protocol (port 515)
   * LPD uses a simple protocol with control and data files
   */
  private async sendDataViaLPD(data: string, customPort?: number): Promise<void> {
    if (!this.currentPrinter) {
      throw new Error('No printer connected');
    }

    const printer = this.currentPrinter;
    const port = customPort || LPD_PORT;
    const jobNum = (this.jobNumber++ % 999) + 1; // Job numbers 1-999
    const jobId = String(jobNum).padStart(3, '0');
    const hostname = 'plexcash';
    const username = 'pos';
    const queueName = 'raw'; // Most thermal printers accept 'raw' queue

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
        }
        reject(new Error('LPD connection timeout after 30 seconds'));
      }, CONNECTION_TIMEOUT);

      try {
        console.log(`📤 [LAN-PRINTER] LPD connecting to ${printer.ip}:${port}...`);

        this.socket = TcpSocket.createConnection(
          {
            port: port,
            host: printer.ip,
          },
          () => {
            console.log('✅ [LAN-PRINTER] LPD socket connected');

            const dataBuffer = Buffer.from(data, 'binary');

            // LPD Protocol steps:
            // 1. Send receive job command: \x02{queue}\n
            // 2. Wait for acknowledgment (single byte \x00)
            // 3. Send control file info: \x02{size} cfA{job}{host}\n
            // 4. Wait for acknowledgment
            // 5. Send control file content
            // 6. Send null byte + wait for ack
            // 7. Send data file info: \x03{size} dfA{job}{host}\n
            // 8. Wait for acknowledgment
            // 9. Send data file content
            // 10. Send null byte + wait for ack

            // Control file content
            const controlFile = `H${hostname}\nP${username}\nldfA${jobId}${hostname}\nUdfA${jobId}${hostname}\nN${hostname}\n`;
            const controlBuffer = Buffer.from(controlFile, 'ascii');

            let step = 0;

            const processLPD = () => {
              switch (step) {
                case 0:
                  // Step 1: Send receive job command
                  console.log('📤 [LPD] Sending receive job command...');
                  this.socket.write(Buffer.from(`\x02${queueName}\n`, 'ascii'));
                  step++;
                  break;

                case 1:
                  // Step 3: Send control file info
                  console.log('📤 [LPD] Sending control file info...');
                  this.socket.write(Buffer.from(`\x02${controlBuffer.length} cfA${jobId}${hostname}\n`, 'ascii'));
                  step++;
                  break;

                case 2:
                  // Step 5: Send control file content + null byte
                  console.log('📤 [LPD] Sending control file...');
                  this.socket.write(Buffer.concat([controlBuffer, Buffer.from([0x00])]));
                  step++;
                  break;

                case 3:
                  // Step 7: Send data file info
                  console.log('📤 [LPD] Sending data file info...');
                  this.socket.write(Buffer.from(`\x03${dataBuffer.length} dfA${jobId}${hostname}\n`, 'ascii'));
                  step++;
                  break;

                case 4:
                  // Step 9: Send data file content + null byte
                  console.log('📤 [LPD] Sending print data...');
                  this.socket.write(Buffer.concat([dataBuffer, Buffer.from([0x00])]));
                  step++;
                  break;

                case 5:
                  // Done!
                  console.log('✅ [LAN-PRINTER] All data sent via LPD');
                  clearTimeout(timeout);
                  setTimeout(() => {
                    if (this.socket) {
                      this.socket.destroy();
                    }
                    resolve();
                  }, 1000);
                  break;
              }
            };

            // Handle data (acknowledgments)
            this.socket.on('data', (ackData: Buffer) => {
              const ack = ackData[0];
              if (ack === 0x00) {
                console.log('✅ [LPD] Received ACK');
                processLPD();
              } else {
                console.error('❌ [LPD] Received NAK:', ack);
                clearTimeout(timeout);
                if (this.socket) {
                  this.socket.destroy();
                }
                reject(new Error(`LPD error: received NAK (${ack})`));
              }
            });

            // Start the LPD protocol
            processLPD();
          }
        );

        this.socket.on('error', (error: Error) => {
          console.error('❌ [LAN-PRINTER] LPD socket error:', error);
          clearTimeout(timeout);
          if (this.socket) {
            this.socket.destroy();
          }
          reject(error);
        });

        this.socket.on('close', () => {
          console.log('🔌 [LAN-PRINTER] LPD socket closed');
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error('❌ [LAN-PRINTER] LPD send error:', error);
        reject(error);
      }
    });
  }

  /**
   * Test print with a specific protocol (for protocol detection)
   */
  async testPrintWithProtocol(protocol: ProtocolType): Promise<boolean> {
    if (!this.currentPrinter) {
      throw new Error('No printer connected');
    }

    // Temporarily set the protocol
    const originalProtocol = this.currentPrinter.protocol;
    this.currentPrinter.protocol = protocol;

    // Set the correct port for the protocol
    const originalPort = this.currentPrinter.port;
    this.currentPrinter.port = protocol === 'lpd' ? LPD_PORT : RAW_TCP_PORT;

    try {
      console.log(`🖨️ [LAN-PRINTER] Testing print with ${protocol.toUpperCase()} protocol...`);

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
      data += 'LAN Printer Working!\n';
      data += new Date().toLocaleString('id-ID') + '\n';
      data += '================\n';
      data += '\n\n\n';
      data += GS + 'V' + '\x00'; // Cut paper

      await this.sendDataToPrinter(data);
      console.log(`✅ [LAN-PRINTER] Test print sent successfully via ${protocol.toUpperCase()}`);
      return true;
    } catch (error) {
      console.error(`❌ [LAN-PRINTER] Test print error with ${protocol}:`, error);
      throw error;
    } finally {
      // Restore original protocol and port
      this.currentPrinter.protocol = originalProtocol;
      this.currentPrinter.port = originalPort;
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

    // Items
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

    // Totals
    output += formatRightAlign(labels.subtotal + ':', this.formatCurrency(data.subtotal), maxChars) + '\n';

    if (data.discount && data.discount > 0) {
      output += formatRightAlign(labels.discount + ':', this.formatCurrency(data.discount), maxChars) + '\n';
    }

    if (data.tax && data.tax > 0) {
      output += formatRightAlign(labels.tax + ':', this.formatCurrency(data.tax), maxChars) + '\n';
    }

    output += '='.repeat(maxChars) + '\n';

    // Total - bold
    output += ESC + 'E' + '\x01'; // Bold on
    const totalLine = formatRightAlign(labels.total + ':', this.formatCurrency(data.total), maxChars);
    output += totalLine + '\n';
    output += ESC + 'E' + '\x00'; // Bold off
    output += '='.repeat(maxChars) + '\n';

    // Payment info
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
   * Format currency to Indonesian Rupiah
   */
  private formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return 'Rp 0';
    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return `Rp ${formatted}`;
  }
}

export default LANPrinterService;

