import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { FormInput } from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { FormTextArea } from '../../components/FormTextArea';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { VisitorCategory } from '../../types';

const CATEGORIES: VisitorCategory[] = ['VIP', 'Reguler', 'Family'];
const HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00',
];
const DURATIONS = ['30 Menit', '1 Jam', '2 Jam', '3 Jam', '4 Jam', '5 Jam', '1 Hari'];

export default function EditVisitorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { visitors, loading, updateVisitor } = useVisitors();
  const { statusBarPadding, horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const existing = visitors.find((v) => v.id === id);
  const latestVisit = existing?.visits?.[existing.visits.length - 1];

  // Profile fields
  const initialCategory: VisitorCategory =
    existing?.category === 'VIP' || existing?.category === 'Family' ? existing.category : 'Reguler';
  const [category, setCategory] = useState<VisitorCategory>(initialCategory);
  const [name, setName] = useState(existing?.name || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [occupation, setOccupation] = useState(existing?.occupation || '');
  const [phone, setPhone] = useState(existing?.phone || '');

  // Latest visit fields
  const [visitTime, setVisitTime] = useState(latestVisit?.time || '');
  const [estimatedDuration, setEstimatedDuration] = useState(latestVisit?.duration || '');
  const [problem, setProblem] = useState(latestVisit?.problem || '');
  const [solution, setSolution] = useState(latestVisit?.solution || '');
  const [purposeNotes, setPurposeNotes] = useState(latestVisit?.notes || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing) {
      const cat: VisitorCategory =
        existing.category === 'VIP' || existing.category === 'Family' ? existing.category : 'Reguler';
      setCategory(cat);
      setName(existing.name || '');
      setAddress(existing.address || '');
      setOccupation(existing.occupation || '');
      setPhone(existing.phone || '');

      const lv = existing.visits?.[existing.visits.length - 1];
      if (lv) {
        setVisitTime(lv.time || '');
        setEstimatedDuration(lv.duration || '');
        setProblem(lv.problem || '');
        setSolution(lv.solution || '');
        setPurposeNotes(lv.notes || '');
      }
    }
  }, [existing?.id]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Nama lengkap harus diisi'); return; }
    if (!existing) return;

    // Update the latest visit if it exists
    const updatedVisits = [...(existing.visits || [])];
    if (updatedVisits.length > 0) {
      const lastIdx = updatedVisits.length - 1;
      updatedVisits[lastIdx] = {
        ...updatedVisits[lastIdx],
        time: visitTime,
        duration: estimatedDuration || undefined,
        problem: problem.trim(),
        solution: solution.trim(),
        notes: purposeNotes.trim() || undefined,
      };
    }

    await updateVisitor({
      ...existing,
      name: name.trim(),
      category,
      occupation: occupation.trim() || undefined,
      address: address.trim(),
      phone: phone.trim() || undefined,
      visits: updatedVisits,
    });
    router.back();
  };

  if (loading && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!existing) {
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
        <Text style={[Typography.h3, { color: Colors.white }]}>
          Edit Visitor
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: horizontalPadding,
          paddingBottom: 40,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Data Section */}
        <Text style={[Typography.caption, { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.md }]}>
          Data Visitor
        </Text>
        <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <FormSelect label="Kategori" value={category} options={CATEGORIES} onSelect={(v) => setCategory(v as VisitorCategory)} placeholder="Pilih" icon="grid-outline" />
          <FormInput label="Nama Lengkap" value={name} onChangeText={(t) => { setName(t); setError(''); }} />
          <FormInput label="Alamat" value={address} onChangeText={setAddress} />
          <FormInput label="Pekerjaan" value={occupation} onChangeText={setOccupation} optional />
          <FormInput label="No. Telp" value={phone} onChangeText={setPhone} optional />
        </View>

        {/* Visit Section — edits the latest visit */}
        {latestVisit && (
          <>
            <Text style={[Typography.caption, { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm }]}>
              Kunjungan Terakhir
            </Text>
            <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
              <FormSelect label="Jam Berkunjung" value={visitTime} options={HOURS} onSelect={setVisitTime} placeholder="Pilih jam" />
              <FormSelect label="Estimasi Durasi" value={estimatedDuration} options={DURATIONS} onSelect={setEstimatedDuration} placeholder="Pilih durasi" />
            </View>

            <Text style={[Typography.caption, { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm }]}>
              Tujuan Kunjungan
            </Text>
            <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
              <FormInput label="Masalah" value={problem} onChangeText={setProblem} />
              <FormTextArea label="Solusi" value={solution} onChangeText={setSolution} minHeight={80} />
              <FormTextArea label="Catatan" value={purposeNotes} onChangeText={setPurposeNotes} optional />
            </View>
          </>
        )}

        {error ? <Text style={{ color: Colors.danger, fontSize: 13, marginBottom: Spacing.md }}>{error}</Text> : null}
      </ScrollView>

      {/* Bottom Buttons */}
      <View
        style={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: Spacing.xl,
          paddingTop: Spacing.sm,
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
            <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 14 }}>Simpan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}