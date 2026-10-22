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
          title="Penyimpanan Data Lokal (Local-First)" 
          content="Visitra dirancang dengan pendekatan local-first. Seluruh data pengunjung, riwayat kunjungan, dan catatan operasional disimpan terlebih dahulu secara lokal di perangkat Anda, sehingga pencatatan harian dapat tetap berjalan tanpa koneksi internet." 
        />
        
        <PolicySection 
          title="Layanan Cloud & Sinkronisasi Workspace" 
          content="Untuk fitur kolaborasi multi-perangkat dan pencadangan terpusat, Visitra menggunakan layanan Supabase. Saat pengguna menjalankan sinkronisasi, data pengunjung, kunjungan, catatan, dan foto lampiran diunggah ke database dan storage Supabase. Akses ke data cloud diatur oleh keanggotaan workspace dan kebijakan keamanan Row Level Security (RLS)." 
        />

        <PolicySection 
          title="Koneksi Internet" 
          content="Koneksi internet diperlukan saat inisialisasi awal workspace, menghubungkan perangkat baru melalui kode QR, serta saat melakukan sinkronisasi data manual ke cloud. Fitur pencatatan dasar, ekspor Word/Excel/CSV, serta backup/restore lokal tetap dapat berjalan secara offline." 
        />
        
        <PolicySection 
          title="Backup dan Restore Mandiri" 
          content="Proses pencadangan (backup) dan pemulihan (restore) berkas ZIP dilakukan secara mandiri oleh pengguna. File arsip cadangan disimpan di perangkat atau dibagikan ke media penyimpanan pilihan pengguna, dan keamanan berkas arsip tersebut berada di bawah kendali pengguna." 
        />

        <PolicySection 
          title="Penghapusan Data Lokal" 
          content="Anda memiliki kendali atas data pada perangkat ini. Seluruh data lokal (visitor, kunjungan, catatan, dan berkas foto di perangkat) dapat dibersihkan melalui opsi 'Hapus Semua Data Lokal' di pengaturan. Tindakan ini tidak menghapus data yang telah tersinkronisasi di cloud workspace." 
        />
      </ScrollView>
    </View>
  );
}
