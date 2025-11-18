import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import BindingTab from './online/BindingTab';
import UploadTab from './online/UploadTab';
import EditTab from './online/EditTab';

const initialLayout = { width: Dimensions.get('window').width };

interface NewOnlineModalProps {
  visible: boolean;
  productId: number | null;
  onClose: () => void;
}

export default function NewOnlineModal({ visible, productId, onClose }: NewOnlineModalProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'binding', title: 'Binding' },
    { key: 'upload', title: 'Upload' },
    { key: 'edit', title: 'Edit' },
  ]);

  // Reset to binding tab when modal opens
  useEffect(() => {
    if (visible) {
      setIndex(0);
    }
  }, [visible]);

  const renderScene = SceneMap({
    binding: () => <BindingTab productId={productId} />,
    upload: () => <UploadTab productId={productId} />,
    edit: () => <EditTab productId={productId} />,
  });

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={styles.indicator}
      style={styles.tabBar}
      labelStyle={styles.label}
      activeColor="#f59e0b"
      inactiveColor="#6B7280"
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Online Product Management</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Tab View */}
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={initialLayout}
          renderTabBar={renderTabBar}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    marginTop: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  tabBar: {
    backgroundColor: 'white',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  indicator: {
    backgroundColor: '#f59e0b',
    height: 3,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'none',
  },
});

