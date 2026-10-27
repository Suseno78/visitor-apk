import { useState, useRef } from 'react';
import { View, Text, ScrollView, type ScrollViewInstance, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { StepIndicator } from '../../components/StepIndicator';
import { FormInput } from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { FormTextArea } from '../../components/FormTextArea';
import { Colors, Typography, Spacing, Radius } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { VisitorCategory, Visitor, Visit, VisitAttachment } from '../../types';
import { VisitAttachmentPicker } from '../../components/VisitAttachmentPicker';
import { ImageViewerModal } from '../../components/ImageViewerModal';

const STEPS = ['Data Visitor', 'Informasi', 'Tujuan', 'Selesai'];
const CATEGORIES: VisitorCategory[] = ['VIP', 'Reguler', 'Family'];
const HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00',
];
const DURATIONS = ['30 Menit', '1 Jam', '2 Jam', '3 Jam', '4 Jam', '5 Jam', '1 Hari'];

export default function AddVisitorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ initialName?: string }>();
  const { addVisitor } = useVisitors();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { statusBarPadding, horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const formatIndoDate = (date: Date) => {
    const dNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const mNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${dNames[date.getDay()]}, ${date.getDate()} ${mNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Step 1 — Visitor profile
  const [category, setCategory] = useState<VisitorCategory>('Reguler');
  const [name, setName] = useState(params.initialName ? String(params.initialName).trim() : '');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 — Visit info
  const [visitDateObj, setVisitDateObj] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [visitTime, setVisitTime] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [visitNotes, setVisitNotes] = useState('');

  // Step 3 — Purpose & Photos
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [purposeNotes, setPurposeNotes] = useState('');
  const [attachments, setAttachments] = useState<VisitAttachment[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const [savedId, setSavedId] = useState('');

  const handleAddPhotos = (newAtts: VisitAttachment[]) => {
    setAttachments((prev) => [...prev, ...newAtts]);
  };

  const handleRemovePhoto = (id: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, deletedAt: new Date().toISOString() } : a))
    );
  };

  const validateStep1 = () => {
    if (!name.trim()) { setError('Nama lengkap harus diisi'); return false; }
    if (!address.trim()) { setError('Alamat harus diisi'); return false; }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 3) { handleSave(); return; }
    setError('');
    setStep(step + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleBack = () => {
    if (step === 1) router.back();
    else {
      setStep(step - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const handleSave = async () => {
    const nowIso = new Date().toISOString();
    const visitorId = Date.now().toString();
    const visitId = `v-${Date.now()}`;

    // Build the Visit object
    const visit: Visit = {
      id: visitId,
      remoteId: null,
      date: formatIndoDate(visitDateObj),
      time: visitTime,
      duration: estimatedDuration || undefined,
      problem: problem.trim(),
      solution: solution.trim(),
      notes: purposeNotes.trim() || visitNotes.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
      attachments,
    };

    // Build the Visitor object with the initial visit
    const visitor: Visitor = {
      id: visitorId,
      remoteId: null,
      name: name.trim(),
      category,
      occupation: occupation.trim() || undefined,
      address: address.trim(),
      phone: phone.trim() || undefined,
      visits: [visit],
      status: 'Aktif',
      createdAt: Date.now(),
      updatedAt: nowIso,
      deletedAt: null,
    };

    // addVisitor handles auto-merge if the name already exists
    const resultId = await addVisitor(visitor);
    const finalId = resultId || visitorId;

    setSavedId(finalId);
    setStep(4);
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
        }}
      >
        <TouchableOpacity
          onPress={handleBack}
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
          Tambah Visitor
        </Text>
        <Text style={[Typography.bodySmall, { color: 'rgba(255,255,255,0.6)' }]}>
          {step}/4
        </Text>
      </View>

      {/* Step Indicator */}
      <View style={{ ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}) }}>
        <StepIndicator currentStep={step} steps={STEPS} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: 30,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1 */}
        {step === 1 && (
          <View>
            <Text style={[Typography.h3, { color: Colors.textPrimary, marginBottom: Spacing.lg }]}>
              Data Visitor
            </Text>
            <FormSelect label="Kategori Visitor" value={category} options={CATEGORIES} onSelect={(v) => setCategory(v as VisitorCategory)} placeholder="Pilih Kategori" icon="grid-outline" />
            <FormInput label="Nama Lengkap" value={name} onChangeText={(t) => { setName(t); setError(''); }} placeholder="Masukkan nama lengkap" />
            <FormInput label="Alamat" value={address} onChangeText={(t) => { setAddress(t); setError(''); }} placeholder="Masukkan alamat" />
            <FormInput label="Pekerjaan" value={occupation} onChangeText={setOccupation} placeholder="Masukkan pekerjaan" optional />
            <FormInput label="No. Telp" value={phone} onChangeText={setPhone} placeholder="Masukkan nomor telepon" optional />
            {error ? <Text style={{ color: Colors.danger, fontSize: 13, marginBottom: Spacing.md }}>{error}</Text> : null}
          </View>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <View>
            <Text style={[Typography.h3, { color: Colors.textPrimary, marginBottom: Spacing.lg }]}>
              Informasi Kunjungan
            </Text>
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
            <FormTextArea label="Catatan" value={visitNotes} onChangeText={setVisitNotes} placeholder="Catatan tambahan" optional />
          </View>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <View>
            <Text style={[Typography.h3, { color: Colors.textPrimary, marginBottom: Spacing.lg }]}>
              Tujuan Kunjungan
            </Text>
            <FormInput label="Masalah" value={problem} onChangeText={setProblem} placeholder="Masukkan masalah" />
            <FormTextArea label="Solusi" value={solution} onChangeText={setSolution} placeholder="Masukkan solusi" minHeight={80} />
            <FormTextArea label="Catatan" value={purposeNotes} onChangeText={setPurposeNotes} placeholder="Catatan tambahan" optional />
            
            <VisitAttachmentPicker
              attachments={attachments}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
              onPressPhoto={(idx) => setSelectedImageIndex(idx)}
            />
          </View>
        )}

        {/* Step 4 — Success */}
        {step === 4 && (
          <View style={{ alignItems: 'center', paddingTop: Spacing.xxl }}>
            <View
              style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: Colors.successLight,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: Spacing.xl,
              }}
            >
              <View
                style={{
                  width: 68, height: 68, borderRadius: 34,
                  backgroundColor: Colors.success,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={36} color={Colors.white} />
              </View>
            </View>
            <Text style={[Typography.h2, { color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm }]}>
              Berhasil!
            </Text>
            <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.lg }]}>
              Data visitor telah tersimpan dan{'\n'}dapat dikelola kapan saja.
            </Text>
          </View>
        )}
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
        {step < 4 ? (
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            {step > 1 && (
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.7}
                style={{
                  flex: 1, height: 50, borderRadius: Radius.md,
                  backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderLight,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Kembali</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.8}
              style={{
                flex: step === 1 ? 1 : 1.3, height: 50, borderRadius: Radius.md,
                backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 14 }}>
                {step === 3 ? 'Simpan' : 'Lanjutkan'}
              </Text>
              {step < 3 && <Ionicons name="arrow-forward" size={16} color={Colors.white} style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <TouchableOpacity
              onPress={() => { if (savedId) router.replace(`/visitor/${savedId}`); }}
              activeOpacity={0.7}
              style={{
                flex: 1, height: 50, borderRadius: Radius.md,
                backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderLight,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Lihat Data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/dashboard')}
              activeOpacity={0.8}
              style={{
                flex: 1.3, height: 50, borderRadius: Radius.md,
                backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 14 }}>Selesai</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {selectedImageIndex !== null && (
        <ImageViewerModal
          visible={selectedImageIndex !== null}
          images={attachments.filter((a) => !a.deletedAt)}
          initialIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
        />
      )}
    </View>
  );
}
