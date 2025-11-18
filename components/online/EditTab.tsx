import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ApiService from '../../services/api';

interface EditTabProps {
  productId: number | null;
}

export default function EditTab({ productId }: EditTabProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (productId) {
      fetchData();
    }
  }, [productId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const response = await ApiService.authenticatedRequest(
        `/get/ecommerce/ALL/product?id_database=${productId}&from=masterbarang`
      );

      console.log('🔍 [EDIT] API Response:', JSON.stringify(response, null, 2));

      if (response?.status && response.data) {
        console.log('🔍 [EDIT] First platform data:', response.data[0]);
        setPlatforms(response.data);
        if (response.data.length > 0) {
          setSelectedPlatform(response.data[0]);
          loadPlatformData(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load product data');
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformData = (platform: any) => {
    // Use 'nama' field like web version, fallback to product_name
    setName(platform.nama || platform.product_name || '');
    setSku(platform.sku || '');
    setWeight(platform.weight?.toString() || '');
    setDescription(platform.description || '');
    setImages(platform.images || []);

    console.log('🔍 [EDIT] Loaded platform data:', {
      name: platform.nama || platform.product_name,
      sku: platform.sku,
      platform: platform.platform
    });
  };

  const handlePlatformChange = (platform: any) => {
    setSelectedPlatform(platform);
    loadPlatformData(platform);
  };

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 images allowed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - images.length,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleUpdate = () => {
    if (!name || !sku) {
      Alert.alert('Validation Error', 'Please fill in required fields');
      return;
    }

    Alert.alert('Update', 'Update functionality will be implemented');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (platforms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color="#9CA3AF" />
        <Text style={styles.emptyText}>No platforms connected</Text>
        <Text style={styles.emptySubtext}>Connect a platform first to edit products</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Platform Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {platforms.map((platform, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.platformChip,
                selectedPlatform?.id_ecommerce === platform.id_ecommerce && styles.platformChipActive,
              ]}
              onPress={() => handlePlatformChange(platform)}
            >
              <Text
                style={[
                  styles.platformChipText,
                  selectedPlatform?.id_ecommerce === platform.id_ecommerce && styles.platformChipTextActive,
                ]}
              >
                {platform.platform}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Rest of the edit form - similar to UploadTab */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Product Images</Text>
        <Text style={styles.sectionSubtitle}>Up to 5 images</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {images.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={24} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ))}

          {images.length < 5 && (
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <Ionicons name="add" size={32} color="#9CA3AF" />
              <Text style={styles.addImageText}>Add Image</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Product Information</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter product name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>SKU *</Text>
          <TextInput
            style={styles.input}
            value={sku}
            onChangeText={setSku}
            placeholder="Enter SKU"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Weight (grams)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="Enter weight"
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter product description"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
          <Ionicons name="save-outline" size={20} color="white" />
          <Text style={styles.updateButtonText}>Update Product</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  platformChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginRight: 8,
  },
  platformChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  platformChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  platformChipTextActive: {
    color: 'white',
  },
  imageScroll: {
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  addImageText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: 'white',
  },
  textArea: {
    height: 100,
    paddingTop: 10,
  },
  footer: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 12,
    marginBottom: 20,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

