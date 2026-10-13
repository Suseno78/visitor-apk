import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/colors';
import { useResponsive } from '../constants/layout';
import { useWorkspace } from '../hooks/useWorkspace';
import { PrimaryButton } from '../components/PrimaryButton';
import { QRScannerModal } from '../components/QRScannerModal';
import { DeviceService } from '../storage/deviceService';
import { supabase } from '../lib/supabase';

export default function WorkspaceSetupScreen() {
  const { reloadWorkspace } = useWorkspace();
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const [isCreating, setIsCreating] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // ---------------------------------------------------------------------------
  // Action 1: Create First Workspace (Owner Flow)
  // ---------------------------------------------------------------------------
  const handleCreateWorkspace = async () => {
    setIsCreating(true);
    try {
      // 1. Call public.create_workspace
      const { data: newWsId, error: rpcError } = await supabase.rpc('create_workspace', {
        p_name: 'Visitra Workspace',
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!newWsId) {
        throw new Error('Gagal membuat workspace.');
      }

      // 2. Register current device into public.devices
      await DeviceService.registerDevice(newWsId);

      // 3. Reload workspace context so state updates to role: 'owner'
      await reloadWorkspace();

      // 4. Navigate to main tabs
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      Alert.alert(
        'Gagal Membuat Workspace',
        err.message || 'Terjadi kesalahan jaringan atau server. Pastikan perangkat terhubung ke internet.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action 2: Scan QR to Join Workspace (Member Flow)
  // ---------------------------------------------------------------------------
  const handleScanSuccess = async (token: string): Promise<boolean> => {
    try {
      const deviceName = await DeviceService.getDeviceName();
      const platform = Platform.OS;

      // Call public.consume_pairing_token
      const { data, error: rpcError } = await supabase.rpc('consume_pairing_token', {
        p_token: token,
        p_device_name: deviceName,
        p_platform: platform,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Reload workspace context
      await reloadWorkspace();

      setShowScanner(false);
      Alert.alert('Berhasil', 'Perangkat berhasil dihubungkan ke workspace!', [
        {
          text: 'Mulai',
          onPress: () => router.replace('/(tabs)/dashboard'),
        },
      ]);
      return true;
    } catch (err: any) {
      Alert.alert(
        'Gagal Menghubungkan',
        err.message || 'Kode QR tidak valid atau telah kedaluwarsa.'
      );
      return false;
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.contentWrapper,
          {
            paddingHorizontal: horizontalPadding,
            ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
          },
        ]}
      >
        {/* App Logo & Welcome */}
        <View style={styles.headerSection}>
          <Image
            source={require('../assets/logo_v.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[Typography.h1, styles.title]}>Selamat Datang di Visitra</Text>
          <Text style={[Typography.body, styles.subtitle]}>
            Visitra membantu mengelola data tamu dan catatan secara aman dan terorganisir.
          </Text>
        </View>

        {/* Setup Options Card */}
        <View style={[styles.optionsCard, Shadows.card]}>
          <View style={styles.optionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={[Typography.h4, { color: Colors.textPrimary }]}>Perangkat Utama?</Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                Buat workspace baru jika ini adalah instalasi pertama Anda.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: Spacing.md }}>
            <PrimaryButton
              title="Buat Workspace"
              icon="add-circle-outline"
              onPress={handleCreateWorkspace}
              loading={isCreating}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ATAU</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.optionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: Colors.surface }]}>
              <Ionicons name="qr-code-outline" size={22} color={Colors.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={[Typography.h4, { color: Colors.textPrimary }]}>Perangkat Tambahan?</Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                Hubungkan perangkat ini dengan memindai kode QR dari perangkat utama.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: Spacing.md }}>
            <PrimaryButton
              title="Hubungkan Perangkat"
              icon="scan-outline"
              variant="outline"
              onPress={() => setShowScanner(true)}
              disabled={isCreating}
            />
          </View>
        </View>

        {/* Offline notice */}
        <View style={styles.footerNotice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textTertiary} />
          <Text style={[Typography.caption, { color: Colors.textTertiary, marginLeft: 6 }]}>
            Tanpa password atau login email. Pairing instan & aman.
          </Text>
        </View>
      </View>

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  contentWrapper: {
    paddingVertical: Spacing.xxl,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  optionsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.md,
    fontWeight: '600',
  },
  footerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
});
