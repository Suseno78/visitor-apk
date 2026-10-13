import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { PairingQRModal } from '../../components/PairingQRModal';
import { DeviceService, DeviceRecord } from '../../storage/deviceService';
import { BackupService } from '../../storage/backupService';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive, TAB_BAR_TOTAL_HEIGHT } from '../../constants/layout';
import { Visitor } from '../../types';
import { SyncService } from '../../services/syncService';
import { SyncMetadataService } from '../../storage/syncMetadataService';

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
  const { workspace, workspaceId, workspaceName, role, reloadWorkspace } = useWorkspace();
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<Visitor[] | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const { statusBarPadding, horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  // Device management state
  const [currentDeviceName, setCurrentDeviceName] = useState<string>('Perangkat Ini');
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);

  useEffect(() => {
    DeviceService.getDeviceName().then(setCurrentDeviceName);
  }, []);

  const loadDevices = async () => {
    if (!workspaceId) return;
    setLoadingDevices(true);
    try {
      const list = await DeviceService.getWorkspaceDevices(workspaceId);
      setDevices(list);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      loadDevices();
    }
  }, [workspaceId]);

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

    // Store validated visitors, then show confirmation
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

  // -------------------------------------------------------------------------
  // Cloud Synchronization (Phase 4C)
  // -------------------------------------------------------------------------
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const loadSyncMetadata = async () => {
    const meta = await SyncMetadataService.getMetadata();
    setLastSyncedAt(meta.lastSyncedAt);
  };

  useEffect(() => {
    loadSyncMetadata();
  }, []);

  const handleSync = async () => {
    if (!workspaceId) {
      Alert.alert('Peringatan', 'Workspace belum terhubung.');
      return;
    }

    const isOwner = role === 'owner';
    setLoadingMessage(
      isOwner
        ? 'Mengunggah data ke Cloud...'
        : 'Mengunduh data dari Cloud...'
    );

    const result = await SyncService.syncWorkspace(workspaceId, role);
    setLoadingMessage(null);

    if (!result.success) {
      Alert.alert('Sinkronisasi Gagal', result.error || 'Terjadi kesalahan sinkronisasi.');
      return;
    }

    await loadSyncMetadata();
    await loadVisitors();

    const displayVisitors =
      (result.visitorsUploaded && result.visitorsUploaded > 0)
        ? result.visitorsUploaded
        : result.totalActiveVisitors !== undefined
        ? result.totalActiveVisitors
        : (result.visitorsPulled || 0);

    const displayVisits =
      (result.visitorsUploaded && result.visitorsUploaded > 0)
        ? result.visitsUploaded || 0
        : result.totalActiveVisits !== undefined
        ? result.totalActiveVisits
        : (result.visitsPulled || 0);

    const displayNotes =
      result.totalActiveNotes !== undefined
        ? result.totalActiveNotes
        : (result.notesUploaded || 0) + (result.notesPulled || 0);

    Alert.alert(
      'Sinkronisasi Berhasil',
      `Data berhasil disinkronkan dengan Cloud.\n\nVisitor: ${displayVisitors}\nKunjungan: ${displayVisits}\nCatatan: ${displayNotes}`
    );
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
        {/* Perangkat / Device Management */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.lg }]}>
          Perangkat & Workspace
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
            icon="business-outline"
            label="Workspace"
            value={workspaceName || 'Visitra Workspace'}
          />
          <Divider />
          <SettingsRow
            icon="hardware-chip-outline"
            label="Perangkat Ini"
            subtitle={currentDeviceName}
            value={role ? (role === 'owner' ? 'Owner' : 'Member') : 'Owner'}
          />
          <Divider />
          <SettingsRow
            icon="phone-portrait-outline"
            label="Perangkat Terhubung"
            value={`${devices.length > 0 ? devices.length : 1} perangkat`}
          />

          {/* Owner can generate QR code for new devices */}
          {role === 'owner' && (
            <>
              <Divider />
              <SettingsRow
                icon="qr-code-outline"
                label="Tambah Perangkat"
                subtitle="Tampilkan QR pairing untuk perangkat lain"
                onPress={() => setShowPairingModal(true)}
              />
            </>
          )}
        </View>

        {/* Connected Devices List */}
        {devices.length > 0 && (
          <View style={{ marginTop: Spacing.md }}>
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.lg,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderWidth: 1,
                borderColor: Colors.borderLight,
                ...Shadows.card,
              }}
            >
              {devices.map((dev, idx) => {
                const isCurrent = dev.name === currentDeviceName;
                const formattedDate = new Date(dev.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <View key={dev.id || idx}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text
                            style={[
                              Typography.bodySmall,
                              { color: Colors.textPrimary, fontWeight: isCurrent ? '600' : '400' },
                            ]}
                          >
                            {dev.name}
                          </Text>
                          {isCurrent && (
                            <View
                              style={{
                                marginLeft: 6,
                                backgroundColor: Colors.primarySurface,
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: Radius.pill,
                              }}
                            >
                              <Text style={[Typography.caption, { color: Colors.primary, fontSize: 10, fontWeight: '600' }]}>
                                Ini
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[Typography.caption, { color: Colors.textTertiary, marginTop: 2 }]}>
                          Terdaftar {formattedDate} • {dev.platform || 'device'}
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: dev.revoked_at ? '#FFF0F0' : Colors.primarySurface,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: Radius.pill,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: dev.revoked_at ? Colors.danger : Colors.primary,
                            marginRight: 4,
                          }}
                        />
                        <Text
                          style={[
                            Typography.caption,
                            {
                              color: dev.revoked_at ? Colors.danger : Colors.primary,
                              fontSize: 11,
                              fontWeight: '500',
                            },
                          ]}
                        >
                          {dev.revoked_at ? 'Revoked' : 'Connected'}
                        </Text>
                      </View>
                    </View>
                    {idx < devices.length - 1 && <Divider />}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* App Info */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
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
            icon="sync-outline"
            label="Sinkronisasi Cloud"
            subtitle={
              role === 'owner'
                ? 'Unggah data lokal ke workspace cloud'
                : 'Unduh data terbaru dari workspace cloud'
            }
            value={
              lastSyncedAt
                ? new Date(lastSyncedAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Belum sync'
            }
            onPress={handleSync}
            disabled={isLoading || !workspaceId}
          />
          <Divider />
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

      {/* Pairing QR Modal for Owner */}
      <PairingQRModal
        visible={showPairingModal}
        onClose={() => {
          setShowPairingModal(false);
          loadDevices();
        }}
        workspaceName={workspaceName}
      />
    </View>
  );
}
