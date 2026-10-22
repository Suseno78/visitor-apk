import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { Visit } from '../../types';
import { DocxReportService } from '../../services/docxReportService';

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: Colors.primarySurface,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: Spacing.md,
        }}
      >
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.caption, { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 2 }]}>
          {label}
        </Text>
        <Text style={[Typography.body, { color: Colors.textPrimary, fontWeight: '500' }]}>
          {value || '-'}
        </Text>
      </View>
    </View>
  );
}

function VisitCard({
  visit,
  index,
  total,
  onPressPhoto,
  onEdit,
  onDelete,
}: {
  visit: Visit;
  index: number;
  total: number;
  onPressPhoto: (photos: { id?: string; localUri: string }[], photoIndex: number) => void;
  onEdit: (visit: Visit) => void;
  onDelete: (visit: Visit) => void;
}) {
  const activePhotos = (visit.attachments || []).filter((a) => !a.deletedAt);

  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        ...Shadows.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: Colors.primarySurface,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: Spacing.sm,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>
            {total - index}
          </Text>
        </View>
        <Text style={[Typography.h4, { color: Colors.textPrimary, flex: 1 }]}>
          Kunjungan #{total - index}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
          <TouchableOpacity
            onPress={() => onEdit(visit)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: Colors.primarySurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(visit)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <InfoRow icon="calendar-outline" label="Tanggal" value={visit.date || '-'} />
      <InfoRow icon="time-outline" label="Jam" value={visit.time || '-'} />
      <InfoRow icon="hourglass-outline" label="Durasi" value={visit.duration || '-'} />
      <InfoRow icon="alert-circle-outline" label="Masalah" value={visit.problem || '-'} />
      <InfoRow icon="checkmark-circle-outline" label="Solusi" value={visit.solution || '-'} />
      <InfoRow icon="document-text-outline" label="Catatan" value={visit.notes || '-'} />

      {/* Evidence Photos */}
      {activePhotos.length > 0 && (
        <View style={{ marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Ionicons name="images-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[Typography.label, { color: Colors.textSecondary }]}>
              Foto / Bukti Kunjungan ({activePhotos.length})
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {activePhotos.map((photo, pIdx) => (
              <TouchableOpacity
                key={photo.id}
                onPress={() =>
                  onPressPhoto(
                    activePhotos.map((p) => ({ id: p.id, localUri: p.localUri })),
                    pIdx
                  )
                }
                activeOpacity={0.8}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: Radius.md,
                  backgroundColor: Colors.card,
                  borderWidth: 1,
                  borderColor: Colors.borderLight,
                  overflow: 'hidden',
                }}
              >
                {photo.localUri ? (
                  <Image
                    source={{ uri: photo.localUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: Colors.card,
                    }}
                  >
                    <Ionicons name="image-outline" size={24} color={Colors.textTertiary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function VisitorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { visitors, loading, deleteVisitor, deleteVisit } = useVisitors();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<Visit | null>(null);
  const [viewerPhotos, setViewerPhotos] = useState<{ id?: string; localUri: string }[]>([]);
  const [initialPhotoIndex, setInitialPhotoIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const { statusBarPadding, horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const visitor = visitors.find((v) => v.id === id);

  if (loading && !visitor) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!visitor) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
        <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.md }]}>Visitor tidak ditemukan</Text>
      </View>
    );
  }

  const avatarBg = Colors.categoryBg[visitor.category] || Colors.categoryBg.Reguler;
  const avatarIcon = Colors.category[visitor.category] || Colors.category.Reguler;

  // Display visits in reverse chronological order (newest first)
  const sortedVisits = [...(visitor.visits || [])].reverse();

  const handleExportWordReport = async () => {
    if (isExporting || !visitor) return;
    setIsExporting(true);
    try {
      const result = await DocxReportService.exportVisitorWordReport(visitor);
      if (!result.success) {
        Alert.alert('Gagal Membuat Laporan', result.error || 'Terjadi kesalahan saat membuat laporan Word.');
      } else if (result.missingPhotosWarning) {
        Alert.alert('Laporan Dibuat dengan Peringatan', result.missingPhotosWarning);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      Alert.alert('Gagal', msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          backgroundColor: Colors.primary,
          paddingTop: statusBarPadding,
          paddingBottom: Spacing.md + 4,
          paddingHorizontal: horizontalPadding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.md,
            }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={[Typography.h3, { color: Colors.white }]}>
            Detail Visitor
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
          <TouchableOpacity
            onPress={handleExportWordReport}
            disabled={isExporting}
            accessibilityLabel="Export Laporan Word (.docx)"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="document-text-outline" size={19} color={Colors.white} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowDeleteModal(true)}
            disabled={isExporting}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: horizontalPadding,
          paddingBottom: 40,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.xl,
            padding: Spacing.lg,
            marginBottom: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: avatarBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.md,
            }}
          >
            <Ionicons name="person" size={24} color={avatarIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.h3, { color: Colors.textPrimary }]}>
              {visitor.name}
            </Text>
            <Text style={[Typography.bodySmall, { color: Colors.textSecondary, marginTop: 2 }]}>
              {visitor.occupation || 'Umum'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: Spacing.sm }}>
              <View
                style={{
                  backgroundColor: Colors.successLight,
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                  borderRadius: Radius.pill,
                }}
              >
                <Text style={[Typography.caption, { color: Colors.success, fontWeight: '700' }]}>
                  {visitor.status || 'Aktif'}
                </Text>
              </View>
              <Text style={[Typography.caption, { color: Colors.textTertiary }]}>
                {visitor.visits?.length || 0} kunjungan
              </Text>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.xl,
            padding: Spacing.lg,
            marginBottom: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          <InfoRow icon="diamond-outline" label="Kategori" value={visitor.category} />
          <InfoRow icon="briefcase-outline" label="Pekerjaan" value={visitor.occupation || '-'} />
          <InfoRow icon="location-outline" label="Alamat" value={visitor.address || '-'} />
          <InfoRow icon="call-outline" label="No. Telp" value={visitor.phone || '-'} />
        </View>

        {/* Word Report Export Action Button */}
        <TouchableOpacity
          onPress={handleExportWordReport}
          disabled={isExporting}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: Colors.card,
            borderRadius: Radius.xl,
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
            opacity: isExporting ? 0.6 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.sm }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: Radius.md,
                backgroundColor: Colors.primarySurface,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: Spacing.md,
              }}
            >
              <Ionicons name="document-text" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.body, { color: Colors.textPrimary, fontWeight: '600' }]}>
                Export Laporan Word (.docx)
              </Text>
              <Text style={[Typography.caption, { color: Colors.textTertiary, marginTop: 1 }]}>
                Unduh riwayat lengkap &amp; lampiran foto
              </Text>
            </View>
          </View>
          {isExporting ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="share-outline" size={19} color={Colors.primary} />
          )}
        </TouchableOpacity>

        {/* Visit History */}
        <Text style={[Typography.h4, { color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.sm }]}>
          Riwayat Kunjungan ({visitor.visits?.length || 0})
        </Text>

        {/* Add Visit Button */}
        <TouchableOpacity
          onPress={() => router.push(`/visitor/add-visit?visitorId=${visitor.id}`)}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: Colors.primarySurface,
            borderRadius: Radius.lg,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.lg,
            borderWidth: 1,
            borderColor: Colors.primary,
            borderStyle: 'dashed',
          }}
        >
          <Ionicons name="add" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 14 }}>
            Tambah Kunjungan
          </Text>
        </TouchableOpacity>

        {sortedVisits.length === 0 ? (
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.xl,
              padding: Spacing.lg,
              marginBottom: Spacing.xl,
              borderWidth: 1,
              borderColor: Colors.borderLight,
              alignItems: 'center',
              ...Shadows.card,
            }}
          >
            <Ionicons name="calendar-outline" size={32} color={Colors.textTertiary} />
            <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
              Belum ada riwayat kunjungan
            </Text>
          </View>
        ) : (
          sortedVisits.map((visit, idx) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              index={idx}
              total={sortedVisits.length}
              onPressPhoto={(photos, photoIdx) => {
                setViewerPhotos(photos);
                setInitialPhotoIndex(photoIdx);
              }}
              onEdit={(v) => {
                router.push(`/visitor/edit-visit?visitorId=${visitor.id}&visitId=${v.id}`);
              }}
              onDelete={(v) => {
                setVisitToDelete(v);
              }}
            />
          ))
        )}

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{
              flex: 1,
              height: 50,
              borderRadius: Radius.md,
              backgroundColor: Colors.background,
              borderWidth: 1,
              borderColor: Colors.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
              Kembali
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/visitor/edit?id=${visitor.id}`)}
            activeOpacity={0.8}
            style={{
              flex: 1.3,
              height: 50,
              borderRadius: Radius.md,
              backgroundColor: Colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 14 }}>
              Edit Visitor
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={showDeleteModal}
        title="Hapus Visitor"
        message={`Yakin ingin menghapus ${visitor.name}? Semua riwayat kunjungan akan ikut terhapus.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => { deleteVisitor(visitor.id); setShowDeleteModal(false); router.back(); }}
        onCancel={() => setShowDeleteModal(false)}
      />

      <ConfirmationModal
        visible={visitToDelete !== null}
        title="Hapus Kunjungan"
        message={`Yakin ingin menghapus riwayat kunjungan tanggal ${visitToDelete?.date || ''} (${visitToDelete?.problem || '-'})?`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={async () => {
          if (visitToDelete) {
            await deleteVisit(visitor.id, visitToDelete.id);
            setVisitToDelete(null);
          }
        }}
        onCancel={() => setVisitToDelete(null)}
      />

      {viewerPhotos.length > 0 && (
        <ImageViewerModal
          visible={viewerPhotos.length > 0}
          images={viewerPhotos}
          initialIndex={initialPhotoIndex}
          onClose={() => setViewerPhotos([])}
        />
      )}

      {/* Loading Overlay while generating report */}
      {isExporting && (
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
            <Text style={[Typography.body, { color: Colors.textPrimary, marginTop: Spacing.md, fontWeight: '500' }]}>
              Menyiapkan Laporan Word...
            </Text>
            <Text style={[Typography.caption, { color: Colors.textTertiary, marginTop: Spacing.xs }]}>
              Memproses foto dan dokumen
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
