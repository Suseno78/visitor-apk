import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/colors';
import { useResponsive } from '../constants/layout';
import { useWorkspace } from '../hooks/useWorkspace';
import { PrimaryButton } from '../components/PrimaryButton';
import { QRScannerModal } from '../components/QRScannerModal';
import { DeviceService } from '../storage/deviceService';
import { VisitorStorage } from '../storage/storage';
import { NoteStorage } from '../storage/noteStorage';
import { supabase } from '../lib/supabase';

export default function WorkspaceSetupScreen() {
  const { reloadWorkspace, enableOfflineMode, exitOfflineMode, isOfflineMode, cachedWorkspaceId } = useWorkspace();
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const [isCreating, setIsCreating] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hasExistingData, setHasExistingData] = useState<boolean>(false);
  const [localDataSummary, setLocalDataSummary] = useState<string>('');

  // ---------------------------------------------------------------------------
  // Helper: Check if device contains existing offline data (including tombstones)
  // ---------------------------------------------------------------------------
  const checkExistingOfflineData = async (): Promise<{ count: number; summary: string }> => {
    try {
      // Include soft-deleted records and all nested visits/attachments
      const visitors = await VisitorStorage.getAll(true);
      const notes = await NoteStorage.getAll(true);

      let totalVisits = 0;
      for (const v of visitors) {
        totalVisits += (v.visits || []).length;
      }

      const totalItems = visitors.length + totalVisits + notes.length;
      return {
        count: totalItems,
        summary: `${visitors.length} Pengunjung (${totalVisits} Kunjungan) & ${notes.length} Catatan`,
      };
    } catch {
      // On read failure, treat as potentially non-empty for safety
      return { count: 1, summary: 'Data lokal tidak dapat diverifikasi' };
    }
  };

  React.useEffect(() => {
    checkExistingOfflineData().then(({ count, summary }) => {
      if (count > 0 || cachedWorkspaceId) {
        setHasExistingData(true);
        setLocalDataSummary(summary);
      }
    });
  }, [cachedWorkspaceId]);

  // ---------------------------------------------------------------------------
  // Action 0: Use Visitra Offline First (Pure Local Mode)
  // ---------------------------------------------------------------------------
  const handleUseOffline = async () => {
    await enableOfflineMode();
    router.replace('/(tabs)/dashboard');
  };

  // ---------------------------------------------------------------------------
  // Action 1: Create First Workspace (Owner Flow)
  // ---------------------------------------------------------------------------
  const executeCreateWorkspace = async () => {
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

      // 4. Safely clear offline mode only AFTER workspace creation and device registration succeed
      // and only because checkExistingOfflineData verified there are 0 local records to adopt
      await exitOfflineMode();

      // 5. Navigate to main tabs
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

  const handleCreateWorkspace = async () => {
    const { count, summary } = await checkExistingOfflineData();
    if (count > 0) {
      Alert.alert(
        'Data Offline Belum Diadopsi',
        `Perangkat ini memiliki ${summary} yang dibuat dalam Mode Offline.\n\n` +
          'Membuat workspace cloud saat ini akan berisiko mengunggah data offline Anda secara otomatis saat sinkronisasi pertama kali.\n\n' +
          'Fitur migrasi aman data offline ke workspace cloud belum tersedia. ' +
          'Tetap gunakan Mode Offline untuk saat ini, atau backup data lokal terlebih dahulu lalu hapus semua data lokal sebelum membuat workspace.',
        [{ text: 'Tetap di Mode Offline', style: 'cancel' }]
      );
      return;
    }

    await executeCreateWorkspace();
  };

  // ---------------------------------------------------------------------------
  // Action 2: Scan QR to Join Workspace (Member Flow)
  // ---------------------------------------------------------------------------
  const executeScanSuccess = async (token: string): Promise<boolean> => {
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
        // Map common backend errors to nontechnical Indonesian explanations
        let msg = rpcError.message || '';
        if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('kedaluwarsa')) {
          msg = 'Kode QR telah kedaluwarsa. Silakan buka kembali menu "Tambah Perangkat" di perangkat utama untuk membuat kode baru.';
        } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('tidak valid')) {
          msg = 'Kode QR pairing tidak valid atau sudah pernah digunakan.';
        } else {
          msg = 'Gagal menghubungkan perangkat ke workspace. Pastikan koneksi internet aktif dan coba lagi.';
        }
        throw new Error(msg);
      }

      // Reload workspace context
      await reloadWorkspace();

      // Safely clear offline mode only AFTER pairing and workspace reload succeed
      // and only because checkExistingOfflineData verified there are 0 local records to adopt
      await exitOfflineMode();

      setShowScanner(false);
      Alert.alert('Berhasil Terhubung', 'Perangkat berhasil dihubungkan ke workspace cloud!', [
        {
          text: 'Mulai Menggunakan',
          onPress: () => router.replace('/(tabs)/dashboard'),
        },
      ]);
      return true;
    } catch (err: any) {
      // Re-throw so QRScannerModal can display the error inline with a 'Coba Lagi' action
      throw err;
    }
  };

  const handleScanSuccess = async (token: string): Promise<boolean> => {
    const { count, summary } = await checkExistingOfflineData();
    if (count > 0) {
      Alert.alert(
        'Data Offline Belum Diadopsi',
        `Perangkat ini memiliki ${summary} yang dibuat dalam Mode Offline.\n\n` +
          'Menghubungkan ke workspace cloud saat ini akan berisiko mengunggah data offline Anda secara otomatis saat sinkronisasi.\n\n' +
          'Fitur migrasi aman data offline ke workspace cloud belum tersedia. ' +
          'Tetap gunakan Mode Offline untuk saat ini, atau backup data lokal terlebih dahulu lalu hapus semua data lokal sebelum menghubungkan perangkat.',
        [{ text: 'Tetap di Mode Offline', style: 'cancel' }]
      );
      return false;
    }

    return executeScanSuccess(token);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
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
            Kelola data buku tamu dan catatan kunjungan Anda dengan aman.
          </Text>
        </View>

        {/* Setup Options Card */}
        <View style={[styles.optionsCard, Shadows.card]}>
          {/* Path 1: Offline Mode (Pure Local) */}
          <View style={styles.optionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="cloud-offline-outline" size={22} color="#16A34A" />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={[Typography.h4, { color: Colors.textPrimary }]}>Gunakan Visitra Offline</Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 3, lineHeight: 18 }]}>
                Mulai catat tamu, kunjungan, foto, dan catatan secara lokal tanpa internet. Sinkronisasi cloud tidak aktif sampai perangkat terhubung ke workspace.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: Spacing.md }}>
            <PrimaryButton
              title="Mulai Mode Offline"
              icon="arrow-forward-outline"
              onPress={handleUseOffline}
              disabled={isCreating}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ATAU HUBUNGKAN CLOUD</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Path 2: Create First Workspace (Owner) */}
          <View style={styles.optionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={[Typography.h4, { color: Colors.textPrimary }]}>Buat Workspace Baru</Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 3, lineHeight: 18 }]}>
                Membuat workspace cloud baru untuk organisasi Anda (perangkat utama). Memerlukan koneksi internet aktif untuk pendaftaran.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: Spacing.md }}>
            <PrimaryButton
              title="Buat Workspace Baru"
              icon="add-circle-outline"
              variant="outline"
              onPress={handleCreateWorkspace}
              loading={isCreating}
              disabled={isCreating}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ATAU</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Path 3: Connect Additional Device (QR Pairing) */}
          <View style={styles.optionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: Colors.surface }]}>
              <Ionicons name="qr-code-outline" size={22} color={Colors.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={[Typography.h4, { color: Colors.textPrimary }]}>Hubungkan Perangkat dengan QR</Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 3, lineHeight: 18 }]}>
                Bergabung ke workspace yang sudah ada. Pindai kode QR dari menu "Tambah Perangkat" di perangkat utama Anda.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: Spacing.md }}>
            <PrimaryButton
              title="Scan QR Pairing"
              icon="scan-outline"
              variant="outline"
              onPress={() => setShowScanner(true)}
              disabled={isCreating}
            />
          </View>

          {/* Recovery path: Device has existing local records or previous workspace membership */}
          {hasExistingData && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>DATA LOKAL TERSEDIA</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.optionHeader}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.primarySurface }]}>
                  <Ionicons name="folder-open-outline" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={[Typography.h4, { color: Colors.textPrimary }]}>Buka Data Lokal di Dashboard</Text>
                  <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 3, lineHeight: 18 }]}>
                    Perangkat ini menyimpan {localDataSummary || 'data kunjungan sebelumnya'}. Anda dapat langsung membuka Dashboard untuk melihat atau mengelola data lokal tanpa mengubah workspace cloud.
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: Spacing.md }}>
                <PrimaryButton
                  title="Buka Dashboard (Data Lokal)"
                  icon="home-outline"
                  variant="outline"
                  onPress={() => router.replace('/(tabs)/dashboard')}
                  disabled={isCreating}
                />
              </View>
            </>
          )}
        </View>

        {/* Offline notice */}
        <View style={styles.footerNotice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textTertiary} />
          <Text style={[Typography.caption, { color: Colors.textTertiary, marginLeft: 6 }]}>
            Data lokal Anda aman. Tidak ada data yang diunggah tanpa persetujuan.
          </Text>
        </View>
      </ScrollView>

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
