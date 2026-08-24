import { useRef, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated, Pressable, Platform } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/colors';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = true,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 65, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: Colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
          opacity: fadeAnim,
        }}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onCancel}
        />
        <Animated.View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.xl,
            padding: Spacing.xl,
            width: '100%',
            maxWidth: 340,
            transform: [{ scale: scaleAnim }],
            ...Shadows.elevated,
          }}
        >
          <Text style={[Typography.h3, { color: Colors.textPrimary, marginBottom: Spacing.sm }]}>
            {title}
          </Text>
          <Text
            style={[Typography.body, { color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl }]}
          >
            {message}
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              style={{
                flex: 1,
                height: 46,
                borderRadius: Radius.md,
                backgroundColor: Colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[Typography.bodySemibold, { color: Colors.textSecondary }]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.85}
              style={{
                flex: 1,
                height: 46,
                borderRadius: Radius.md,
                backgroundColor: destructive ? Colors.danger : Colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[Typography.bodySemibold, { color: Colors.white }]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
