import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANPrinter } from '../services/BluetoothPrinterService';
import LANPrinterDiscovery from '../services/bluetooth/LANPrinterDiscovery';

interface LANPrinterSettingsProps {
  onPrinterSelected: (printer: LANPrinter) => void;
  selectedPrinterId?: string;
}

const LANPrinterSettings: React.FC<LANPrinterSettingsProps> = ({
  onPrinterSelected,
  selectedPrinterId,
}) => {
  const [discoveredPrinters, setDiscoveredPrinters] = useState<LANPrinter[]>([]);
  const [savedPrinters, setSavedPrinters] = useState<LANPrinter[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  
  // Manual entry fields
  const [manualName, setManualName] = useState('');
  const [manualIP, setManualIP] = useState('');
  const [manualPort, setManualPort] = useState('9100');

  const discovery = new LANPrinterDiscovery();

  useEffect(() => {
    loadSavedPrinters();
    return () => {
      discovery.destroy();
    };
  }, []);

  const loadSavedPrinters = async () => {
    try {
      const saved = await AsyncStorage.getItem('lan_printers');
      if (saved) {
        setSavedPrinters(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved printers:', error);
    }
  };

  const savePrinter = async (printer: LANPrinter) => {
    try {
      const existing = savedPrinters.find(p => p.id === printer.id);
      if (existing) {
        Alert.alert('Info', 'Printer already saved');
        return;
      }

      const updated = [...savedPrinters, { ...printer, lastUsed: new Date() }];
      await AsyncStorage.setItem('lan_printers', JSON.stringify(updated));
      setSavedPrinters(updated);
      Alert.alert('Success', 'Printer saved successfully');
    } catch (error) {
      console.error('Error saving printer:', error);
      Alert.alert('Error', 'Failed to save printer');
    }
  };

  const deletePrinter = async (printerId: string) => {
    try {
      const updated = savedPrinters.filter(p => p.id !== printerId);
      await AsyncStorage.setItem('lan_printers', JSON.stringify(updated));
      setSavedPrinters(updated);
    } catch (error) {
      console.error('Error deleting printer:', error);
      Alert.alert('Error', 'Failed to delete printer');
    }
  };

  const discoverPrinters = async () => {
    setIsDiscovering(true);
    try {
      const printers = await discovery.discoverPrinters(10000);
      setDiscoveredPrinters(printers);
      
      if (printers.length === 0) {
        Alert.alert(
          'No Printers Found',
          'No LAN printers were discovered. Make sure your printer is connected to the same network and supports network printing.'
        );
      } else {
        Alert.alert('Success', `Found ${printers.length} printer(s)`);
      }
    } catch (error) {
      console.error('Discovery error:', error);
      Alert.alert('Error', 'Failed to discover printers. Please try manual entry.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const addManualPrinter = () => {
    const printer = LANPrinterDiscovery.createManualPrinter(
      manualName || `Printer (${manualIP})`,
      manualIP,
      parseInt(manualPort) || 9100
    );

    if (!printer) {
      Alert.alert('Invalid Input', 'Please enter a valid IP address and port number');
      return;
    }

    savePrinter(printer);
    setManualName('');
    setManualIP('');
    setManualPort('9100');
    setShowManualEntry(false);
  };

  const renderPrinterItem = (printer: LANPrinter, isSaved: boolean = false) => (
    <View style={styles.printerItem}>
      <TouchableOpacity
        style={[
          styles.printerInfo,
          selectedPrinterId === printer.id && styles.printerSelected,
        ]}
        onPress={() => onPrinterSelected(printer)}
      >
        <View>
          <Text style={styles.printerName}>{printer.name}</Text>
          <Text style={styles.printerAddress}>{printer.ip}:{printer.port}</Text>
        </View>
        {selectedPrinterId === printer.id && (
          <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
        )}
      </TouchableOpacity>

      {!isSaved && (
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => savePrinter(printer)}
        >
          <Ionicons name="bookmark-outline" size={20} color="#10B981" />
        </TouchableOpacity>
      )}

      {isSaved && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              'Delete Printer',
              'Are you sure you want to delete this printer?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deletePrinter(printer.id) },
              ]
            );
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Auto Discovery Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Auto Discovery</Text>
          <TouchableOpacity
            style={styles.discoverButton}
            onPress={discoverPrinters}
            disabled={isDiscovering}
          >
            {isDiscovering ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : (
              <Ionicons name="search" size={20} color="#f59e0b" />
            )}
            <Text style={styles.discoverButtonText}>
              {isDiscovering ? 'Discovering...' : 'Discover'}
            </Text>
          </TouchableOpacity>
        </View>

        {discoveredPrinters.length > 0 && (
          <FlatList
            data={discoveredPrinters}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderPrinterItem(item, false)}
            style={styles.printerList}
            nestedScrollEnabled
          />
        )}
      </View>

      {/* Saved Printers Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Printers</Text>
        {savedPrinters.length === 0 ? (
          <Text style={styles.emptyText}>No saved printers</Text>
        ) : (
          <FlatList
            data={savedPrinters}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderPrinterItem(item, true)}
            style={styles.printerList}
            nestedScrollEnabled
          />
        )}
      </View>

      {/* Manual Entry Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.manualEntryToggle}
          onPress={() => setShowManualEntry(!showManualEntry)}
        >
          <Text style={styles.sectionTitle}>Manual Entry</Text>
          <Ionicons
            name={showManualEntry ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>

        {showManualEntry && (
          <View style={styles.manualForm}>
            <TextInput
              style={styles.input}
              placeholder="Printer Name (optional)"
              value={manualName}
              onChangeText={setManualName}
            />
            <TextInput
              style={styles.input}
              placeholder="IP Address (e.g., 192.168.1.100)"
              value={manualIP}
              onChangeText={setManualIP}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Port (default: 9100)"
              value={manualPort}
              onChangeText={setManualPort}
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>
              💡 Most thermal printers use port 9100 (RAW TCP). If auto-discovery found your printer on a different port (e.g., 515), try port 9100 instead for better compatibility.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={addManualPrinter}
            >
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.addButtonText}>Add Printer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  discoverButtonText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
  },
  printerList: {
    maxHeight: 200,
  },
  printerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  printerInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  printerSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#FEF3C7',
  },
  printerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  printerAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  saveButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  manualEntryToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manualForm: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    marginTop: -4,
  },
});

export default LANPrinterSettings;

