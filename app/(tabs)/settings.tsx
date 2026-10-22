import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { PairingQRModal } from '../../components/PairingQRModal';
import { DeviceService, DeviceRecord } from '../../storage/deviceService';
import { BackupService, ParsedBackupResult } from '../../storage/backupService';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive, TAB_BAR_TOTAL_HEIGHT } from '../../constants/layout';
import { Visitor } from '../../types';
import { SyncService } from '../../services/syncService';
import { Note } from '../../types';
import { SyncMetadataService } from '../../storage/syncMetadataService';
import { DocxReportService } from '../../services/docxReportService';
import { XlsxExportService } from '../../services/xlsxExportService';
import { DateRangeExportModal } from '../../components/DateRangeExportModal';
import { NoteStorage } from '../../storage/noteStorage';
import { PhotoService } from '../../storage/photoService';
import { VisitPhotoService } from '../../storage/visitPhotoService';
import { NotePhotoService } from '../../storage/notePhotoService';

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
  const { workspace, workspaceId, workspaceName, role, reloadWorkspace, loading: workspaceLoading, isOfflineMode } = useWorkspace();
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<ParsedBackupResult | null>(null);
  const [isLegacyWorkspaceBackup, setIsLegacyWorkspaceBackup] = useState(false);
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
    // Requirement 1: If active workspace is still loading, block restore
    if (workspaceLoading) {
      Alert.alert(
        'Workspace Belum Siap',
        'Informasi workspace aktif sedang dimuat. Harap tunggu beberapa saat sebelum memulihkan data.'
      );
      return;
    }

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

    // Requirement 1: Enforce workspace protection
    // Check if backup contains a workspace ID that differs from active workspace
    if (result.workspaceId && workspaceId && result.workspaceId !== workspaceId) {
      Alert.alert(
        'Workspace Tidak Cocok',
        `File backup ini berasal dari workspace lain:\nID: ${result.workspaceId}\n\nWorkspace aktif saat ini:\nID: ${workspaceId} (${workspaceName || 'Visitra'})\n\nProses pemulihan ditolak demi mencegah pencampuran atau penimpaan data antar workspace.`
      );
      return;
    }

    // Check if backup has a workspace ID but current device has no active workspace
    if (result.workspaceId && !workspaceId) {
      Alert.alert(
        'Perangkat Belum Terhubung',
        `File backup ini milik workspace "${result.workspaceId}", tetapi perangkat ini belum terhubung ke workspace mana pun. Hubungkan perangkat ke workspace terlebih dahulu sebelum memulihkan data.`
      );
      return;
    }

    // Flag legacy backups that lack a workspace ID
    const isLegacyNoWs = !result.workspaceId;
    setIsLegacyWorkspaceBackup(isLegacyNoWs);

    // Store entire parsed result, then show confirmation
    setPendingRestore(result);
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    setShowRestoreModal(false);
    if (!pendingRestore || !pendingRestore.visitors) return;

    // Requirement 1: Re-validate workspace immediately before commit
    if (pendingRestore.workspaceId && workspaceId && pendingRestore.workspaceId !== workspaceId) {
      Alert.alert(
        'Pemulihan Dibatalkan',
        'Workspace aktif telah berubah atau tidak cocok dengan file backup. Pemulihan dibatalkan.'
      );
      setPendingRestore(null);
      setIsLegacyWorkspaceBackup(false);
      return;
    }

    setLoadingMessage('Memulihkan data...');
    const result = await BackupService.commitRestore(
      pendingRestore.visitors,
      pendingRestore.notes,
      pendingRestore.visitPhotos,
      pendingRestore.notePhotos,
    );
    setPendingRestore(null);
    setIsLegacyWorkspaceBackup(false);
    setLoadingMessage(null);

    if (result.error) {
      Alert.alert('Gagal', result.error);
      return;
    }

    await loadVisitors();

    const parts = ['Data berhasil dipulihkan.'];
    if (result.restoredVisitPhotos && result.restoredVisitPhotos > 0) {
      parts.push(`Foto kunjungan: ${result.restoredVisitPhotos}`);
    }
    if (result.restoredNotePhotos && result.restoredNotePhotos > 0) {
      parts.push(`Foto catatan: ${result.restoredNotePhotos}`);
    }
    Alert.alert('Berhasil', parts.join('\n'));
  };

  const handleRestoreCancel = () => {
    setShowRestoreModal(false);
    setPendingRestore(null);
    setIsLegacyWorkspaceBackup(false);
  };

  // -------------------------------------------------------------------------
  // Clear All Local Data
  // -------------------------------------------------------------------------
  const handleClearLocalData = async () => {
    setShowClearModal(false);
    setLoadingMessage('Menghapus data lokal perangkat...');

    const failures: string[] = [];

    // 1. Clear local visitors and visits from AsyncStorage
    try {
      await clearAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`Data pengunjung: ${msg}`);
    }

    // 2. Clear local notes from AsyncStorage
    try {
      await NoteStorage.clearAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`Data catatan: ${msg}`);
    }

    // 3. Clear local photo files (legacy visitor photos, visit photos, note photos)
    try {
      PhotoService.clearAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`Berkas foto profil: ${msg}`);
    }

    try {
      VisitPhotoService.clearAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`Berkas foto kunjungan: ${msg}`);
    }

    try {
      NotePhotoService.clearAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`Berkas foto catatan: ${msg}`);
    }

    setLoadingMessage(null);

    if (failures.length > 0) {
      Alert.alert(
        'Pembersihan Sebagian Gagal',
        `Beberapa data lokal tidak dapat dibersihkan:\n• ${failures.join('\n• ')}\n\nSilakan periksa izin penyimpanan perangkat Anda.`
      );
    } else {
      Alert.alert(
        'Berhasil',
        'Seluruh data lokal (pengunjung, kunjungan, catatan, dan berkas foto) pada perangkat ini telah berhasil dibersihkan.'
      );
    }
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
  // Word Report Export - All Visitors (.docx)
  // -------------------------------------------------------------------------
  const handleExportAllVisitorsWord = async () => {
    if (visitors.length === 0) {
      Alert.alert('Data Kosong', 'Belum ada data pengunjung untuk diekspor ke Word.');
      return;
    }

    setLoadingMessage('Menyiapkan Laporan Word...');
    try {
      const result = await DocxReportService.exportAllVisitorsWordReport(visitors);
      setLoadingMessage(null);

      if (!result.success) {
        Alert.alert('Gagal Membuat Laporan', result.error || 'Terjadi kesalahan saat membuat laporan Word.');
      } else if (result.missingPhotosWarning) {
        Alert.alert('Laporan Dibuat dengan Peringatan', result.missingPhotosWarning);
      }
    } catch (err: unknown) {
      setLoadingMessage(null);
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      Alert.alert('Gagal', msg);
    }
  };

  // -------------------------------------------------------------------------
  // Word Report Export - Date Range Filter (.docx)
  // -------------------------------------------------------------------------
  const handleOpenDateRangeModal = () => {
    if (visitors.length === 0) {
      Alert.alert('Data Kosong', 'Belum ada data pengunjung untuk diekspor ke Word.');
      return;
    }
    setShowDateRangeModal(true);
  };

  const handleExportDateRangeWord = async (startDate: Date, endDate: Date) => {
    setShowDateRangeModal(false);
    setLoadingMessage('Menyiapkan Laporan Periode Word...');
    try {
      const result = await DocxReportService.exportDateRangeWordReport(visitors, startDate, endDate);
      setLoadingMessage(null);

      if (!result.success) {
        Alert.alert('Gagal Membuat Laporan', result.error || 'Terjadi kesalahan saat membuat laporan Word.');
      } else if (result.missingPhotosWarning) {
        Alert.alert('Laporan Dibuat dengan Peringatan', result.missingPhotosWarning);
      }
    } catch (err: unknown) {
      setLoadingMessage(null);
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      Alert.alert('Gagal', msg);
    }
  };

  // -------------------------------------------------------------------------
  // Excel Export - All Data (.xlsx)
  // -------------------------------------------------------------------------
  const handleExportExcel = async () => {
    setLoadingMessage('Menyiapkan Export Excel...');
    try {
      const result = await XlsxExportService.exportAllDataExcel();
      setLoadingMessage(null);

      if (!result.success) {
        Alert.alert('Gagal Membuat Excel', result.error || 'Terjadi kesalahan saat membuat file Excel.');
      }
    } catch (err: unknown) {
      setLoadingMessage(null);
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      Alert.alert('Gagal', msg);
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

    const displayVisitPhotos =
      result.totalActiveVisitPhotos !== undefined
        ? result.totalActiveVisitPhotos
        : (result.visitPhotosUploaded || 0) + (result.visitPhotosDownloaded || 0);

    Alert.alert(
      'Sinkronisasi Berhasil',
      `Data berhasil disinkronkan dengan Cloud.\n\nVisitor: ${displayVisitors}\nKunjungan: ${displayVisits}\nFoto Kunjungan: ${displayVisitPhotos}\nCatatan: ${displayNotes}`
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
          {isOfflineMode || !workspaceId ? (
            <>
              <SettingsRow
                icon="cloud-offline-outline"
                label="Status Workspace"
                subtitle="Data tersimpan lokal di perangkat ini"
                value="Mode Offline"
              />
              <Divider />
              <SettingsRow
                icon="hardware-chip-outline"
                label="Perangkat Ini"
                subtitle={currentDeviceName}
                value="Lokal"
              />
              <Divider />
              <SettingsRow
                icon="cloud-upload-outline"
                label="Hubungkan ke Cloud"
                subtitle="Buat workspace baru atau hubungkan via QR"
                onPress={() => router.push('/workspace-setup')}
              />
            </>
          ) : (
            <>
              <SettingsRow
                icon="business-outline"
                label="Workspace"
                value={workspaceName || 'Wantiono'}
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
            subtitle="Ringkasan total data pengunjung, kunjungan & catatan"
            onPress={handleExportCSV}
            disabled={isLoading}
          />
          <Divider />
          <SettingsRow
            icon="document-attach-outline"
            label="Export Semua Pengunjung (Word .docx)"
            subtitle="Satu laporan lengkap seluruh pengunjung, riwayat & foto"
            onPress={handleExportAllVisitorsWord}
            disabled={isLoading}
          />
          <Divider />
          <SettingsRow
            icon="calendar-outline"
            label="Export Laporan Berdasarkan Periode (Word .docx)"
            subtitle="Laporan kunjungan dalam rentang tanggal tertentu"
            onPress={handleOpenDateRangeModal}
            disabled={isLoading}
          />
          <Divider />
          <SettingsRow
            icon="grid-outline"
            label="Export Semua Data (Excel .xlsx)"
            subtitle="Data pengunjung, kunjungan & catatan dalam spreadsheet"
            onPress={handleExportExcel}
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
            label="Hapus Semua Data Lokal"
            subtitle="Bersihkan data visitor, catatan, dan foto di perangkat ini"
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

      {/* Clear All Local Data Modal */}
      <ConfirmationModal
        visible={showClearModal}
        title="Hapus Semua Data Lokal"
        message={`Tindakan ini hanya berlaku pada perangkat ini:\n\n1. Seluruh data pengunjung, kunjungan, catatan, dan berkas foto lokal di perangkat ini akan dihapus secara permanen.\n\n2. Setiap data atau perubahan baru yang belum disinkronkan ke cloud akan hilang secara permanen dan tidak dapat dipulihkan.\n\n3. Data yang sudah berhasil disinkronkan ke Cloud Workspace tetap aman di server dan dapat diunduh kembali saat sinkronisasi berikutnya dilakukan.\n\nLanjutkan penghapusan data lokal?`}
        confirmLabel="Hapus Data Lokal"
        cancelLabel="Batal"
        onConfirm={handleClearLocalData}
        onCancel={() => setShowClearModal(false)}
      />

      {/* Restore Confirmation Modal */}
      <ConfirmationModal
        visible={showRestoreModal}
        title={isLegacyWorkspaceBackup ? 'Pulihkan Backup (Tanpa ID Workspace)?' : 'Pulihkan Backup?'}
        message={
          isLegacyWorkspaceBackup
            ? `PERINGATAN: File backup ini tidak memiliki identitas workspace (format legacy v1/v2).\n\nAsal workspace file ini tidak dapat diverifikasi dengan workspace aktif (${workspaceName || 'Visitra'}). Jika dipulihkan, data visitor lama akan menggantikan data visitor saat ini (${visitors.length} visitor), sedangkan Catatan yang ada akan tetap dipertahankan.\n\nLanjutkan pemulihan?`
            : `Memulihkan backup akan mengganti seluruh data visitor saat ini (${visitors.length} visitor)${pendingRestore?.notes !== undefined ? ' dan catatan' : ''}. Pastikan Anda sudah mem-backup data sebelumnya jika diperlukan.${pendingRestore?.visitors ? `\n\nIsi backup:\n• ${pendingRestore.visitors.length} visitor${pendingRestore.notes && pendingRestore.notes.length > 0 ? `\n• ${pendingRestore.notes.length} catatan` : ''}${pendingRestore.visitPhotos && Object.keys(pendingRestore.visitPhotos).length > 0 ? `\n• ${Object.keys(pendingRestore.visitPhotos).length} foto kunjungan` : ''}${pendingRestore.notePhotos && Object.keys(pendingRestore.notePhotos).length > 0 ? `\n• ${Object.keys(pendingRestore.notePhotos).length} foto catatan` : ''}` : ''}`
        }
        confirmLabel={isLegacyWorkspaceBackup ? 'Saya Mengerti, Pulihkan' : 'Pulihkan'}
        cancelLabel="Batal"
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
        destructive={isLegacyWorkspaceBackup}
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

      {/* Date Range Word Export Modal */}
      <DateRangeExportModal
        visible={showDateRangeModal}
        onClose={() => setShowDateRangeModal(false)}
        onConfirm={handleExportDateRangeWord}
        isLoading={isLoading}
      />
    </View>
  );
}
