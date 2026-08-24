import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography } from '../constants/colors';

export default function SplashScreen() {
  const router = useRouter();
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
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textFade, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(textSlide, { toValue: 0, friction: 6, tension: 50, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }, 500);

    // Step 3: Navigate
    const timeout = setTimeout(() => {
      router.replace('/(tabs)/dashboard');
    }, 2200);

    return () => clearTimeout(timeout);
  }, []);

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
          source={require('../assets/v-removebg-preview.png')}
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
