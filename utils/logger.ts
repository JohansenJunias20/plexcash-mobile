/**
 * Production-Safe Logger
 *
 * This logger ensures that console logs are visible in production APK builds.
 * React Native may strip console.log in production, so we use multiple strategies:
 *
 * 1. Direct console methods (preserved in production)
 * 2. Alert fallback for critical errors (optional)
 * 3. Timestamp and context for better debugging
 * 4. Event emitter for real-time log streaming to UI
 */

import { Platform } from 'react-native';

// Simple event emitter for log events
type LogListener = (log: LogEntry) => void;

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  formattedMessage: string;
}

// Check if we're in production mode
const IS_PRODUCTION = !__DEV__;

// Environment variable for debug mode
const DEBUG_MODE = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true';

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Color codes for different log levels (for terminal/logcat)
const LOG_COLORS = {
  [LogLevel.DEBUG]: '\x1b[36m',    // Cyan
  [LogLevel.INFO]: '\x1b[32m',     // Green
  [LogLevel.WARN]: '\x1b[33m',     // Yellow
  [LogLevel.ERROR]: '\x1b[31m',    // Red
  [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'
};

// Emoji prefixes for better visibility
const LOG_EMOJIS = {
  [LogLevel.DEBUG]: '🔍',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.ERROR]: '❌',
  [LogLevel.CRITICAL]: '🚨'
};

interface LogOptions {
  context?: string;
  data?: any;
  showAlert?: boolean; // Show alert dialog for critical errors
}

class Logger {
  private static instance: Logger;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 500; // Increased buffer size for developer mode
  private listeners: LogListener[] = [];

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Subscribe to log events for real-time updates
   */
  public subscribe(listener: LogListener): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of a new log entry
   */
  private notifyListeners(logEntry: LogEntry) {
    this.listeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch (error) {
        console.error('Error in log listener:', error);
      }
    });
  }

  /**
   * Format log message with timestamp, level, and context
   */
  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const emoji = LOG_EMOJIS[level];
    const contextStr = context ? `[${context}]` : '';
    
    return `${emoji} [${timestamp}] [${level}] ${contextStr} ${message}`;
  }

  /**
   * Core logging method that bypasses React Native's console stripping
   */
  private log(level: LogLevel, message: string, options: LogOptions = {}) {
    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(level, message, options.context);

    // Create log entry
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      context: options.context,
      data: options.data,
      formattedMessage,
    };

    // Add to buffer for later retrieval
    this.addToBuffer(logEntry);

    // Notify listeners for real-time updates
    this.notifyListeners(logEntry);

    // In production, we need to ensure logs are visible
    // Use different console methods that are less likely to be stripped
    if (IS_PRODUCTION) {
      // Strategy 1: Use console.warn and console.error (rarely stripped)
      if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
        console.error(formattedMessage);
        if (options.data) {
          console.error('Data:', JSON.stringify(options.data, null, 2));
        }
      } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage);
        if (options.data) {
          console.warn('Data:', JSON.stringify(options.data, null, 2));
        }
      } else {
        // For INFO and DEBUG, use console.log but also console.info as backup
        console.log(formattedMessage);
        console.info(formattedMessage); // Backup method
        if (options.data) {
          console.log('Data:', JSON.stringify(options.data, null, 2));
          console.info('Data:', JSON.stringify(options.data, null, 2));
        }
      }
    } else {
      // Development mode - use standard console methods
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage, options.data || '');
          break;
        case LogLevel.INFO:
          console.log(formattedMessage, options.data || '');
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, options.data || '');
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          console.error(formattedMessage, options.data || '');
          break;
      }
    }

    // Show alert for critical errors if requested
    if (options.showAlert && (level === LogLevel.ERROR || level === LogLevel.CRITICAL)) {
      // Import Alert dynamically to avoid circular dependencies
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          `${level}: ${options.context || 'Error'}`,
          message,
          [{ text: 'OK' }]
        );
      });
    }
  }

  /**
   * Add log to buffer for later retrieval
   */
  private addToBuffer(logEntry: LogEntry) {
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // Remove oldest log
    }
  }

  /**
   * Get all buffered logs
   */
  public getBufferedLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Get buffered logs as formatted strings
   */
  public getBufferedLogsAsStrings(): string[] {
    return this.logBuffer.map(entry => entry.formattedMessage);
  }

  /**
   * Clear log buffer
   */
  public clearBuffer() {
    this.logBuffer = [];
  }

  /**
   * Debug level logging
   */
  public debug(message: string, options: LogOptions = {}) {
    if (DEBUG_MODE || !IS_PRODUCTION) {
      this.log(LogLevel.DEBUG, message, options);
    }
  }

  /**
   * Info level logging
   */
  public info(message: string, options: LogOptions = {}) {
    this.log(LogLevel.INFO, message, options);
  }

  /**
   * Warning level logging
   */
  public warn(message: string, options: LogOptions = {}) {
    this.log(LogLevel.WARN, message, options);
  }

  /**
   * Error level logging
   */
  public error(message: string, options: LogOptions = {}) {
    this.log(LogLevel.ERROR, message, options);
  }

  /**
   * Critical level logging (always shows, even in production)
   */
  public critical(message: string, options: LogOptions = {}) {
    this.log(LogLevel.CRITICAL, message, options);
  }

  /**
   * Log authentication flow events
   */
  public auth(message: string, data?: any) {
    this.info(message, { context: 'AUTH', data });
  }

  /**
   * Log navigation events
   */
  public navigation(message: string, data?: any) {
    this.info(message, { context: 'NAVIGATION', data });
  }

  /**
   * Log Google authentication events
   */
  public googleAuth(message: string, data?: any) {
    this.info(message, { context: 'GOOGLE-AUTH', data });
  }

  /**
   * Log state changes
   */
  public stateChange(message: string, data?: any) {
    this.info(message, { context: 'STATE-CHANGE', data });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience methods
export const logDebug = (message: string, options?: LogOptions) => logger.debug(message, options);
export const logInfo = (message: string, options?: LogOptions) => logger.info(message, options);
export const logWarn = (message: string, options?: LogOptions) => logger.warn(message, options);
export const logError = (message: string, options?: LogOptions) => logger.error(message, options);
export const logCritical = (message: string, options?: LogOptions) => logger.critical(message, options);

// Export specialized logging methods
export const logAuth = (message: string, data?: any) => logger.auth(message, data);
export const logNavigation = (message: string, data?: any) => logger.navigation(message, data);
export const logGoogleAuth = (message: string, data?: any) => logger.googleAuth(message, data);
export const logStateChange = (message: string, data?: any) => logger.stateChange(message, data);

export default logger;

