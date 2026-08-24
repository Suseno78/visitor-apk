import { useRef, useEffect } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './PrimaryButton';
import { Colors, Typography, Spacing } from '../constants/colors';

interface Props {
  onAddPress?: () => void;
  title?: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({ onAddPress, title, description, icon }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, delay: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xxl + 16,
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      {/* Layered icon */}
      <View style={{ marginBottom: Spacing.lg + 4 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 32,
            backgroundColor: Colors.primarySurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: Colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: Colors.borderLight,
            }}
          >
            <Ionicons name={icon || "people-outline"} size={30} color={Colors.primary} />
          </View>
        </View>
      </View>

      <Text
        style={[
          Typography.h3,
          { color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
        ]}
      >
        {title || 'Belum ada visitor'}
      </Text>
      <Text
        style={[
          Typography.body,
          {
            color: Colors.textTertiary,
            textAlign: 'center',
            marginBottom: Spacing.xl,
            lineHeight: 22,
            maxWidth: 260,
          },
        ]}
      >
        {description || 'Mulai tambahkan visitor pertama Anda dan kelola kunjungan dengan mudah.'}
      </Text>
      {onAddPress && (
        <PrimaryButton
          title="Tambah Visitor Pertama"
          icon="add"
          onPress={onAddPress}
          fullWidth={false}
        />
      )}
    </Animated.View>
  );
}
