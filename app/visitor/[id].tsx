import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { Visit } from '../../types';

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

function VisitCard({ visit, index, total }: { visit: Visit; index: number; total: number }) {
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
      </View>

      <InfoRow icon="calendar-outline" label="Tanggal" value={visit.date || '-'} />
      <InfoRow icon="time-outline" label="Jam" value={visit.time || '-'} />
      <InfoRow icon="hourglass-outline" label="Durasi" value={visit.duration || '-'} />
      <InfoRow icon="alert-circle-outline" label="Masalah" value={visit.problem || '-'} />
      <InfoRow icon="checkmark-circle-outline" label="Solusi" value={visit.solution || '-'} />
      <InfoRow icon="document-text-outline" label="Catatan" value={visit.notes || '-'} />
    </View>
  );
}

export default function VisitorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { visitors, loading, deleteVisitor } = useVisitors();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
        <TouchableOpacity
          onPress={() => setShowDeleteModal(true)}
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
    </View>
  );
}
