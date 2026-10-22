import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startDate: Date, endDate: Date) => void;
  isLoading?: boolean;
}

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatDisplayDate(date: Date): string {
  const day = date.getDate();
  const month = INDO_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function DateRangeExportModal({
  visible,
  onClose,
  onConfirm,
  isLoading = false,
}: Props) {
  // Default range: First day of current month until today
  const [startDate, setStartDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset defaults and error message on open
      const now = new Date();
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
      setEndDate(new Date());
      setActivePicker(null);
      setErrorMessage(null);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
      setActivePicker(null);
    }
  }, [visible]);

  // Validate dates
  const handleStartDateValueChange = (_event: DateTimePickerChangeEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setActivePicker(null);
    }
    if (selectedDate) {
      setStartDate(selectedDate);
      if (selectedDate > endDate) {
        setErrorMessage('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.');
      } else {
        setErrorMessage(null);
      }
    }
  };

  const handleEndDateValueChange = (_event: DateTimePickerChangeEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setActivePicker(null);
    }
    if (selectedDate) {
      setEndDate(selectedDate);
      if (startDate > selectedDate) {
        setErrorMessage('Tanggal akhir tidak boleh lebih awal dari tanggal mulai.');
      } else {
        setErrorMessage(null);
      }
    }
  };

  const handleExport = () => {
    if (startDate > endDate) {
      setErrorMessage('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.');
      return;
    }
    setErrorMessage(null);
    onConfirm(startDate, endDate);
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: Colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
          opacity: fadeAnim,
        }}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={isLoading ? undefined : onClose}
        />
        <Animated.View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.xl,
            padding: Spacing.xl,
            width: '100%',
            maxWidth: 380,
            transform: [{ scale: scaleAnim }],
            ...Shadows.elevated,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: Radius.md,
                backgroundColor: Colors.primarySurface,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: Spacing.sm,
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={[Typography.h3, { color: Colors.textPrimary, flex: 1 }]}>
              Pilih Periode Laporan
            </Text>
          </View>

          <Text
            style={[
              Typography.bodySmall,
              { color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
            ]}
          >
            Hanya kunjungan yang berada dalam rentang tanggal ini yang akan dimasukkan ke dalam laporan Word.
          </Text>

          {/* Start Date Field */}
          <Text
            style={[
              Typography.caption,
              { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.xs },
            ]}
          >
            Dari Tanggal
          </Text>
          <TouchableOpacity
            onPress={() => setActivePicker((prev) => (prev === 'start' ? null : 'start'))}
            activeOpacity={0.7}
            disabled={isLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.background,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: activePicker === 'start' ? Colors.primary : Colors.borderLight,
              paddingHorizontal: Spacing.md,
              height: 48,
              marginBottom: Spacing.md,
            }}
          >
            <Ionicons
              name="calendar"
              size={18}
              color={Colors.primary}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={[Typography.body, { flex: 1, color: Colors.textPrimary }]}>
              {formatDisplayDate(startDate)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          {activePicker === 'start' && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleStartDateValueChange}
              onDismiss={() => setActivePicker(null)}
              onNeutralButtonPress={() => setActivePicker(null)}
            />
          )}

          {/* End Date Field */}
          <Text
            style={[
              Typography.caption,
              { color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.xs },
            ]}
          >
            Sampai Tanggal
          </Text>
          <TouchableOpacity
            onPress={() => setActivePicker((prev) => (prev === 'end' ? null : 'end'))}
            activeOpacity={0.7}
            disabled={isLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.background,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: activePicker === 'end' ? Colors.primary : Colors.borderLight,
              paddingHorizontal: Spacing.md,
              height: 48,
              marginBottom: Spacing.sm,
            }}
          >
            <Ionicons
              name="calendar"
              size={18}
              color={Colors.primary}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={[Typography.body, { flex: 1, color: Colors.textPrimary }]}>
              {formatDisplayDate(endDate)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          {activePicker === 'end' && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleEndDateValueChange}
              onDismiss={() => setActivePicker(null)}
              onNeutralButtonPress={() => setActivePicker(null)}
            />
          )}

          {/* Error Message */}
          {errorMessage && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: Colors.dangerLight,
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.sm,
                paddingVertical: 6,
                marginTop: Spacing.xs,
                marginBottom: Spacing.sm,
              }}
            >
              <Ionicons
                name="alert-circle"
                size={16}
                color={Colors.danger}
                style={{ marginRight: 6 }}
              />
              <Text style={[Typography.caption, { color: Colors.danger, flex: 1 }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg }}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading}
              activeOpacity={0.7}
              style={{
                flex: 1,
                height: 46,
                borderRadius: Radius.md,
                backgroundColor: Colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[Typography.bodySemibold, { color: Colors.textSecondary }]}>
                Batal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExport}
              disabled={isLoading || !!errorMessage}
              activeOpacity={0.85}
              style={{
                flex: 1.2,
                height: 46,
                borderRadius: Radius.md,
                backgroundColor: Colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isLoading || !!errorMessage ? 0.6 : 1,
              }}
            >
              <Text style={[Typography.bodySemibold, { color: Colors.white }]}>
                Buat Laporan
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
