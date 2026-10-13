import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';

export default function SplashScreen() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const { workspace, loading: wsLoading } = useWorkspace();
  const [animationDone, setAnimationDone] = useState(false);

  const logoFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const textSlide = useRef(new Animated.Value(30)).current;
  const textFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Step 1: Logo appears
    Animated.parallel([
      Animated.timing(logoFade, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    // Step 2: Text slides up (after logo)
    const textTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(textFade, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(textSlide, { toValue: 0, friction: 6, tension: 50, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }, 500);

    // Step 3: Wait for minimum splash duration (2.2s)
    const splashTimer = setTimeout(() => {
      setAnimationDone(true);
    }, 2200);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(splashTimer);
    };
  }, []);

  // Navigate once animation finishes and auth + workspace resolution are ready
  useEffect(() => {
    if (animationDone && !authLoading && !wsLoading) {
      if (workspace) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/workspace-setup');
      }
    }
  }, [animationDone, authLoading, wsLoading, workspace]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: logoFade,
          transform: [{ scale: logoScale }],
        }}
      >
        <Image
          source={require('../assets/logo_v-removebg-preview.png')}
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          bottom: 100,
          alignItems: 'center',
          opacity: textFade,
          transform: [{ translateY: textSlide }],
        }}
      >
        <Text style={[Typography.h2, { color: Colors.primary, marginBottom: 4 }]}>
          Visitra
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
          V1.0
        </Text>
      </Animated.View>
    </View>
  );
}
