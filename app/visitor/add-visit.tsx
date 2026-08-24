import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { FormInput } from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { FormTextArea } from '../../components/FormTextArea';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { Visit } from '../../types';

const HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00',
];
const DURATIONS = ['30 Menit', '1 Jam', '2 Jam', '3 Jam', '4 Jam', '5 Jam', '1 Hari'];

export default function AddVisitScreen() {
  const router = useRouter();
  const { visitorId } = useLocalSearchParams<{ visitorId: string }>();
  const { visitors, addVisit } = useVisitors();
  const { statusBarPadding, horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const visitor = visitors.find((v) => v.id === visitorId);

  const formatIndoDate = (date: Date) => {
    const dNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const mNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${dNames[date.getDay()]}, ${date.getDate()} ${mNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Visit info
  const [visitDateObj, setVisitDateObj] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [visitTime, setVisitTime] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  
  // Purpose
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [purposeNotes, setPurposeNotes] = useState('');

  const handleSave = async () => {
    if (!visitor) return;

    const visitId = `v-${Date.now()}`;
    const visit: Visit = {
      id: visitId,
      date: formatIndoDate(visitDateObj),
      time: visitTime,
      duration: estimatedDuration || undefined,
      problem: problem.trim(),
      solution: solution.trim(),
      notes: purposeNotes.trim() || undefined,
    };

    await addVisit(visitor.id, visit);
    router.back();
  };

  if (!visitor) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
        <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.md }]}>Visitor tidak ditemukan</Text>
      </View>
    );
  }

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
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center', justifyContent: 'center',
            marginRight: Spacing.md,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={[Typography.h3, { color: Colors.white, flex: 1 }]}>
          Tambah Kunjungan
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: 30,
          paddingTop: Spacing.md,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[Typography.body, { color: Colors.textSecondary, marginBottom: Spacing.lg }]}>
          Menambahkan riwayat kunjungan baru untuk <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{visitor.name}</Text>.
        </Text>

        {/* Visit Information */}
        <Text style={[Typography.caption, { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm }]}>
          Informasi Kunjungan
        </Text>
        <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <Text style={[Typography.label, { color: Colors.textPrimary, marginBottom: Spacing.sm }]}>Tanggal Kunjungan</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={{
              height: 52,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: Colors.borderLight,
              backgroundColor: Colors.white,
              paddingHorizontal: Spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
            <Text style={{ flex: 1, fontSize: 15, color: Colors.textPrimary }}>
              {formatIndoDate(visitDateObj)}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={visitDateObj}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={(_event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) setVisitDateObj(selectedDate);
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          )}
          <FormSelect label="Jam Berkunjung" value={visitTime} options={HOURS} onSelect={setVisitTime} placeholder="Pilih jam" />
          <FormSelect label="Estimasi Durasi" value={estimatedDuration} options={DURATIONS} onSelect={setEstimatedDuration} placeholder="Pilih durasi" />
        </View>

        {/* Purpose */}
        <Text style={[Typography.caption, { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm }]}>
          Tujuan Kunjungan
        </Text>
        <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <FormInput label="Masalah" value={problem} onChangeText={setProblem} placeholder="Masukkan masalah" />
          <FormTextArea label="Solusi" value={solution} onChangeText={setSolution} placeholder="Masukkan solusi" minHeight={80} />
          <FormTextArea label="Catatan" value={purposeNotes} onChangeText={setPurposeNotes} placeholder="Catatan tambahan" optional />
        </View>

      </ScrollView>

      {/* Bottom Buttons */}
      <View
        style={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: Spacing.xl,
          paddingTop: Spacing.sm,
          backgroundColor: Colors.background,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
      >
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{
              flex: 1, height: 50, borderRadius: Radius.md,
              backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderLight,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Batal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.8}
            style={{
              flex: 1.3, height: 50, borderRadius: Radius.md,
              backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 14 }}>
              Simpan Kunjungan
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
