import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { BackupService } from '../../storage/backupService';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive, TAB_BAR_TOTAL_HEIGHT } from '../../constants/layout';
import { Visitor } from '../../types';

function SettingsRow({
  icon,
  label,
  subtitle,
  value,
  onPress,
  danger,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.7, disabled } : {})}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        minHeight: 50,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: Radius.sm + 2,
          backgroundColor: danger ? Colors.dangerLight : Colors.primarySurface,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: Spacing.md,
        }}
      >
        <Ionicons name={icon} size={17} color={danger ? Colors.danger : Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[Typography.body, { color: danger ? Colors.danger : Colors.textPrimary, fontWeight: '500' }]}
        >
          {label}
        </Text>
        {subtitle && (
          <Text style={[Typography.caption, { color: Colors.textTertiary, marginTop: 1 }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {value && (
        <Text style={[Typography.bodySmall, { color: Colors.textTertiary }]}>
          {value}
        </Text>
      )}
      {onPress && !danger && (
        <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} style={{ marginLeft: Spacing.sm }} />
      )}
    </Wrapper>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: Colors.borderLight }} />;
}

export default function SettingsScreen() {
  const { visitors, clearAll, loadVisitors } = useVisitors();
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<Visitor[] | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const { statusBarPadding, horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const isLoading = loadingMessage !== null;

  // -------------------------------------------------------------------------
  // Backup
  // -------------------------------------------------------------------------
  const handleBackup = async () => {
    setLoadingMessage('Menyiapkan backup...');
    const result = await BackupService.createBackup();
    setLoadingMessage(null);
    if (result.error) {
      Alert.alert('Gagal', result.error);
    } else if (result.success) {
      Alert.alert('Berhasil', 'Backup berhasil dibuat.');
    }
  };

  // -------------------------------------------------------------------------
  // Restore (2-phase: pick+validate, then confirm, then commit)
  // -------------------------------------------------------------------------
  const handleRestorePick = async () => {
    setLoadingMessage('Membaca file...');
    const result = await BackupService.pickAndValidateBackup();
    setLoadingMessage(null);

    if (result.error) {
      Alert.alert('Gagal', result.error);
      return;
    }
    if (!result.success || !result.visitors) {
      // User cancelled — do nothing
      return;
    }

    // Store validated visitors and show confirmation
    setPendingRestore(result.visitors);
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    setShowRestoreModal(false);
    if (!pendingRestore) return;

    setLoadingMessage('Memulihkan data...');
    const result = await BackupService.commitRestore(pendingRestore);
    setPendingRestore(null);
    setLoadingMessage(null);

    if (result.error) {
      Alert.alert('Gagal', result.error);
      return;
    }

    await loadVisitors();
    Alert.alert('Berhasil', 'Data berhasil dipulihkan.');
  };

  const handleRestoreCancel = () => {
    setShowRestoreModal(false);
    setPendingRestore(null);
  };

  // -------------------------------------------------------------------------
  // CSV Export
  // -------------------------------------------------------------------------
  const handleExportCSV = async () => {
    setLoadingMessage('Membuat file CSV...');
    const result = await BackupService.exportCSV();
    setLoadingMessage(null);
    if (result.error) {
      Alert.alert('Gagal', result.error);
    } else if (result.success) {
      Alert.alert('Berhasil', 'Export CSV berhasil dibuat.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: statusBarPadding,
          paddingBottom: Spacing.md,
          paddingHorizontal: horizontalPadding,
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.borderLight,
        }}
      >
        <Text style={[Typography.h2, { color: Colors.textPrimary }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: horizontalPadding,
          paddingBottom: TAB_BAR_TOTAL_HEIGHT + 20,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
      >
        {/* App Info */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.lg }]}>
          Informasi
        </Text>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          <SettingsRow icon="server-outline" label="Local Data" value={`${visitors.length} visitor`} />
          <Divider />
          <SettingsRow icon="information-circle-outline" label="Versi Aplikasi" value="1.0.0" />
          <Divider />
          <SettingsRow icon="code-slash-outline" label="Framework" value="Expo SDK 57" />
        </View>

        {/* Data & Penyimpanan */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
          Data & Penyimpanan
        </Text>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          <SettingsRow
            icon="cloud-upload-outline"
            label="Backup Data"
            subtitle="Simpan seluruh data Visitra"
            onPress={handleBackup}
            disabled={isLoading}
          />
          <Divider />
          <SettingsRow
            icon="cloud-download-outline"
            label="Pulihkan Data"
            subtitle="Import backup JSON"
            onPress={handleRestorePick}
            disabled={isLoading}
          />
          <Divider />
          <SettingsRow
            icon="document-text-outline"
            label="Export CSV"
            subtitle="Buka data visitor di Excel"
            onPress={handleExportCSV}
            disabled={isLoading}
          />
        </View>

        {/* Fitur */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
          Fitur
        </Text>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          <SettingsRow 
            icon="document-text-outline" 
            label="Catatan" 
            subtitle="Kelola catatan dan informasi"
            onPress={() => router.push('/notes')} 
          />
        </View>

        {/* Lainnya */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
          Lainnya
        </Text>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          <SettingsRow icon="shield-checkmark-outline" label="Kebijakan Privasi" onPress={() => router.push('/settings/privacy')} />
          <Divider />
          <SettingsRow icon="information-circle-outline" label="Tentang Aplikasi" onPress={() => router.push('/settings/about')} />
        </View>

        {/* Danger Zone */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
          Zona Berbahaya
        </Text>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.dangerLight,
            ...Shadows.card,
          }}
        >
          <SettingsRow
            icon="trash-outline"
            label="Hapus Semua Data"
            onPress={() => setShowClearModal(true)}
            danger
          />
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: Colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
          }}
        >
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.xl,
              paddingHorizontal: Spacing.xl,
              paddingVertical: Spacing.lg,
              alignItems: 'center',
              ...Shadows.elevated,
            }}
          >
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[Typography.body, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
              {loadingMessage}
            </Text>
          </View>
        </View>
      )}

      {/* Clear All Modal */}
      <ConfirmationModal
        visible={showClearModal}
        title="Hapus Semua Data"
        message="Yakin ingin menghapus semua data visitor? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => { clearAll(); setShowClearModal(false); }}
        onCancel={() => setShowClearModal(false)}
      />

      {/* Restore Confirmation Modal */}
      <ConfirmationModal
        visible={showRestoreModal}
        title="Pulihkan Backup?"
        message={`Memulihkan backup akan mengganti seluruh data Visitra saat ini (${visitors.length} visitor). Pastikan Anda sudah mem-backup data yang ada sebelumnya.${pendingRestore ? `\n\nBackup berisi ${pendingRestore.length} visitor.` : ''}`}
        confirmLabel="Pulihkan"
        cancelLabel="Batal"
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
        destructive={false}
      />
    </View>
  );
}
