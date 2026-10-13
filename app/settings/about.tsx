import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Stack, router } from 'expo-router';
import { Colors, Spacing, Typography } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const { isTablet, contentMaxWidth } = useResponsive();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Tentang Aplikasi',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: Typography.h3,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16, marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          )
        }} 
      />

      <View 
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: Spacing.xl,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
      >
        <Image 
          source={require('../../assets/logo_v-removebg-preview.png')} 
          style={{ width: 120, height: 120, marginBottom: Spacing.xl }}
          resizeMode="contain"
        />
        
        <Text style={[Typography.h1, { color: Colors.primary, marginBottom: Spacing.xs }]}>
          Visitra
        </Text>
        
        <Text style={[Typography.body, { color: Colors.textSecondary, marginBottom: Spacing.lg }]}>
          Visitor Management & Visit Journal
        </Text>
        
        <View style={{ backgroundColor: Colors.primarySurface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 16, marginBottom: Spacing.xxl }}>
          <Text style={[Typography.caption, { color: Colors.primary, fontWeight: '600' }]}>
            Version 1.0.0
          </Text>
        </View>

        <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }]}>
          Visitra adalah aplikasi manajemen buku tamu dan jurnal kunjungan offline yang dirancang untuk menjaga privasi dan kecepatan pencatatan operasional Anda.
        </Text>
      </View>
    </View>
  );
}
