import { View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Colors, Spacing, Typography } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const PolicySection = ({ title, content }: { title: string; content: string }) => (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={[Typography.h4, { color: Colors.textPrimary, marginBottom: Spacing.sm }]}>
        {title}
      </Text>
      <Text style={[Typography.body, { color: Colors.textSecondary, lineHeight: 22 }]}>
        {content}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Kebijakan Privasi',
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

      <ScrollView 
        contentContainerStyle={{
          padding: horizontalPadding,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.xxl,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
      >
        <PolicySection 
          title="Penyimpanan Data Lokal" 
          content="Visitra menyimpan seluruh data visitor dan catatan secara lokal di perangkat Anda. Aplikasi ini dirancang untuk bekerja secara offline dan tidak membutuhkan koneksi internet untuk mengelola data." 
        />
        
        <PolicySection 
          title="Tanpa Login dan Database Online" 
          content="Aplikasi Visitra tidak mewajibkan proses pendaftaran atau login. Kami tidak menggunakan database server, Firebase, Supabase, atau layanan cloud lainnya, sehingga data Anda tidak pernah dikirimkan ke server kami." 
        />
        
        <PolicySection 
          title="Backup dan Restore" 
          content="Proses pencadangan (backup) dan pemulihan (restore) data dilakukan sepenuhnya atas inisiatif pengguna secara manual. Tanggung jawab keamanan file backup yang dihasilkan berada di tangan pengguna." 
        />

        <PolicySection 
          title="Penghapusan Data" 
          content="Anda memiliki kontrol penuh atas data Anda. Seluruh data yang tersimpan dapat dihapus kapan saja melalui opsi 'Hapus Semua Data' yang tersedia di halaman pengaturan aplikasi." 
        />
      </ScrollView>
    </View>
  );
}
