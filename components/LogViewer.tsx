/**
 * Log Viewer Component
 * 
 * Displays real-time logs in a floating overlay when developer mode is enabled.
 * Features:
 * - Real-time log streaming
 * - Clear logs
 * - Copy logs to clipboard
 * - Export/share logs
 * - Minimize/maximize
 * - Draggable (optional)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Clipboard,
  Alert,
  Share,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import logger, { LogEntry, LogLevel } from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LogViewerProps {
  visible: boolean;
  onClose?: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLogIndices, setSelectedLogIndices] = useState<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Load existing logs
    const existingLogs = logger.getBufferedLogs();
    setLogs(existingLogs);

    // Subscribe to new logs
    const unsubscribe = logger.subscribe((logEntry: LogEntry) => {
      setLogs(prevLogs => [...prevLogs, logEntry]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [logs, autoScroll]);

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            logger.clearBuffer();
            setLogs([]);
            setSelectedLogIndices(new Set());
          },
        },
      ]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedLogIndices.size === logs.length) {
      // Deselect all
      setSelectedLogIndices(new Set());
    } else {
      // Select all
      setSelectedLogIndices(new Set(logs.map((_, index) => index)));
    }
  };

  const handleToggleLogSelection = (index: number) => {
    const newSelection = new Set(selectedLogIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedLogIndices(newSelection);
  };

  const handleCopyAllLogs = () => {
    const logsText = logs.map(log => log.formattedMessage).join('\n');
    Clipboard.setString(logsText);
    Alert.alert('Success', `All ${logs.length} logs copied to clipboard!`);
  };

  const handleCopySelectedLogs = () => {
    if (selectedLogIndices.size === 0) {
      Alert.alert('No Selection', 'Please select at least one log entry to copy.');
      return;
    }

    const selectedLogs = Array.from(selectedLogIndices)
      .sort((a, b) => a - b)
      .map(index => logs[index].formattedMessage)
      .join('\n');

    Clipboard.setString(selectedLogs);
    Alert.alert('Success', `${selectedLogIndices.size} selected log(s) copied to clipboard!`);
  };

  const handleShareLogs = async () => {
    try {
      const logsText = logs.map(log => log.formattedMessage).join('\n');
      await Share.share({
        message: logsText,
        title: 'PlexCash Developer Logs',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share logs');
    }
  };

  const getLogColor = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return '#60A5FA'; // Blue
      case LogLevel.INFO:
        return '#34D399'; // Green
      case LogLevel.WARN:
        return '#FBBF24'; // Yellow
      case LogLevel.ERROR:
        return '#F87171'; // Red
      case LogLevel.CRITICAL:
        return '#DC2626'; // Dark Red
      default:
        return '#9CA3AF'; // Gray
    }
  };

  const getLogIcon = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.CRITICAL:
        return '🚨';
      default:
        return '📝';
    }
  };

  if (!visible) {
    return null;
  }

  if (isMinimized) {
    return (
      <View style={styles.minimizedContainer}>
        <TouchableOpacity
          style={styles.minimizedButton}
          onPress={() => setIsMinimized(false)}
        >
          <Ionicons name="terminal" size={24} color="white" />
          <Text style={styles.minimizedText}>{logs.length}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="terminal" size={20} color="white" />
              <Text style={styles.headerTitle}>Developer Logs</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{logs.length}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setAutoScroll(!autoScroll)}
              >
                <Ionicons
                  name={autoScroll ? 'lock-closed' : 'lock-open'}
                  size={18}
                  color={autoScroll ? '#34D399' : '#9CA3AF'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setIsMinimized(true)}
              >
                <Ionicons name="remove" size={18} color="white" />
              </TouchableOpacity>
              {onClose && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Logs */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.logsContainer}
            contentContainerStyle={styles.logsContent}
            onScrollBeginDrag={() => setAutoScroll(false)}
          >
            {logs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#6B7280" />
                <Text style={styles.emptyText}>No logs yet</Text>
                <Text style={styles.emptySubtext}>Logs will appear here in real-time</Text>
              </View>
            ) : (
              logs.map((log, index) => {
                const isSelected = selectedLogIndices.has(index);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.logEntry,
                      isSelected && styles.logEntrySelected
                    ]}
                    onPress={() => handleToggleLogSelection(index)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.logHeader}>
                      <View style={styles.logHeaderLeft}>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color="#34D399" style={styles.selectionIcon} />
                        )}
                        <Text style={styles.logIcon}>{getLogIcon(log.level)}</Text>
                        <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                          {log.level}
                        </Text>
                        {log.context && (
                          <View style={styles.logContext}>
                            <Text style={styles.logContextText}>{log.context}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.logTimestamp}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={styles.logMessage}>{log.message}</Text>
                    {log.data && (
                      <Text style={styles.logData}>
                        {JSON.stringify(log.data, null, 2)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Selection Bar */}
          {selectedLogIndices.size > 0 && (
            <View style={styles.selectionBar}>
              <Text style={styles.selectionText}>
                {selectedLogIndices.size} selected
              </Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setSelectedLogIndices(new Set())}
              >
                <Text style={styles.selectionButtonText}>Clear Selection</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={handleToggleSelectAll}
            >
              <Ionicons
                name={selectedLogIndices.size === logs.length ? "checkbox" : "square-outline"}
                size={18}
                color="white"
              />
              <Text style={styles.footerButtonText}>
                {selectedLogIndices.size === logs.length ? "Deselect" : "Select All"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={handleClearLogs}>
              <Ionicons name="trash-outline" size={18} color="white" />
              <Text style={styles.footerButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, selectedLogIndices.size > 0 && styles.footerButtonHighlight]}
              onPress={handleCopySelectedLogs}
            >
              <Ionicons name="copy-outline" size={18} color="white" />
              <Text style={styles.footerButtonText}>Copy Sel.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={handleCopyAllLogs}>
              <Ionicons name="copy" size={18} color="white" />
              <Text style={styles.footerButtonText}>Copy All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, autoScroll && styles.footerButtonActive]}
              onPress={() => {
                setAutoScroll(true);
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }}
            >
              <Ionicons name="arrow-down" size={18} color="white" />
              <Text style={styles.footerButtonText}>Bottom</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    padding: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
  },
  logEntry: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  logEntrySelected: {
    backgroundColor: '#1F2937',
    borderLeftColor: '#34D399',
    borderWidth: 2,
    borderColor: '#34D399',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectionIcon: {
    marginRight: 4,
  },
  logIcon: {
    fontSize: 14,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logContext: {
    backgroundColor: '#4B5563',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logContextText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '600',
  },
  logTimestamp: {
    color: '#9CA3AF',
    fontSize: 10,
    marginLeft: 'auto',
  },
  logMessage: {
    color: '#E5E7EB',
    fontSize: 13,
    lineHeight: 18,
  },
  logData: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'monospace',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1F2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  selectionText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
  },
  selectionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  selectionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  footerButtonActive: {
    backgroundColor: '#3B82F6',
  },
  footerButtonHighlight: {
    backgroundColor: '#059669',
  },
  footerButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  minimizedContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 9999,
  },
  minimizedButton: {
    backgroundColor: '#3B82F6',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  minimizedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default LogViewer;

