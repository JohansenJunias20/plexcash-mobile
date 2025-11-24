import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';

interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  title,
  subtitle = 'This feature is under development',
  icon = 'construct-outline'
}) => {
  const navigation = useNavigation();

  return (
    <LinearGradient
      colors={['#fbbf24', '#f59e0b', '#d97706']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header with Hamburger Menu */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={80} color="rgba(255,255,255,0.9)" />
        </View>
        
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.featureName}>{title}</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.subtitle}>{subtitle}</Text>
        
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.infoText}>
            We're working hard to bring this feature to you soon!
          </Text>
        </View>
      </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hamburgerButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white', flex: 1, textAlign: 'center' },
  headerRight: { width: 38 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  featureName: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 20,
    textAlign: 'center',
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 2,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    maxWidth: 350,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
});

export default PlaceholderScreen;

