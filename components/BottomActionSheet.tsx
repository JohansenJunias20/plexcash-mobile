import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ActionSheetAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'success';
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions: ActionSheetAction[];
};

export default function BottomActionSheet({ visible, onClose, title, subtitle, actions }: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getButtonStyle = (variant?: string) => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: '#fbbf24', borderColor: '#f59e0b' };
      case 'danger':
        return { backgroundColor: '#EF4444', borderColor: '#DC2626' };
      case 'success':
        return { backgroundColor: '#10B981', borderColor: '#059669' };
      default:
        return { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' };
    }
  };

  const getTextStyle = (variant?: string) => {
    switch (variant) {
      case 'primary':
      case 'danger':
      case 'success':
        return { color: '#FFFFFF' };
      default:
        return { color: '#111827' };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.sheet,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Header */}
              {(title || subtitle) && (
                <View style={styles.header}>
                  {title && <Text style={styles.title}>{title}</Text>}
                  {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
              )}

              {/* Actions */}
              <ScrollView style={styles.actionsContainer} showsVerticalScrollIndicator={false}>
                {actions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.actionButton,
                      getButtonStyle(action.variant),
                      action.disabled && styles.actionButtonDisabled,
                    ]}
                    onPress={() => {
                      if (!action.disabled) {
                        action.onPress();
                      }
                    }}
                    disabled={action.disabled}
                  >
                    {action.icon && (
                      <Ionicons
                        name={action.icon}
                        size={20}
                        color={action.disabled ? '#9CA3AF' : getTextStyle(action.variant).color}
                        style={styles.actionIcon}
                      />
                    )}
                    <Text
                      style={[
                        styles.actionText,
                        getTextStyle(action.variant),
                        action.disabled && styles.actionTextDisabled,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Cancel button */}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionTextDisabled: {
    color: '#9CA3AF',
  },
  cancelButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});

