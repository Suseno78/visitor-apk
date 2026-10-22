import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/colors';
import { useResponsive } from '../constants/layout';

interface Props {
  name: string;
  onSearchPress?: () => void;
  isOfflineMode?: boolean;
}

export function DashboardHeader({ name, onSearchPress, isOfflineMode }: Props) {
  const { statusBarPadding, horizontalPadding } = useResponsive();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);

  return (
    <View
      style={{
        backgroundColor: Colors.primary,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        paddingTop: statusBarPadding + Spacing.md,
        paddingBottom: 48,
        paddingHorizontal: horizontalPadding,
      }}
    >
      {/* Top row: logo + app name + notification */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: Spacing.xl,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: 'rgba(255,255,255,0.13)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: Spacing.sm + 4,
          }}
        >
          <Image 
            source={require('../assets/logo_v-removebg-preview.png')} 
            style={{ width: 26, height: 26 }} 
            resizeMode="contain"
            tintColor={Colors.white}
          />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: Colors.white,
              letterSpacing: -0.3,
            }}
          >
            Visitra
          </Text>
          {isOfflineMode && (
            <View
              style={{
                marginLeft: Spacing.sm,
                backgroundColor: 'rgba(255,255,255,0.2)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name="cloud-offline-outline" size={12} color={Colors.white} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.white }}>
                Offline
              </Text>
            </View>
          )}
        </View>
        {onSearchPress && (
          <TouchableOpacity
            onPress={onSearchPress}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="search-outline" size={19} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Welcome area */}
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm + 2 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.md,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Ionicons name="person" size={22} color="rgba(255,255,255,0.85)" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>
              Selamat datang,
            </Text>
            <Text style={[Typography.h2, { color: Colors.white }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
        </View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '400',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 18,
            marginTop: 4,
          }}
        >
          Kelola data pengunjung dengan mudah dan efisien.
        </Text>
      </Animated.View>
    </View>
  );
}
