import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Pressable, Platform } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/colors';
import { VisitorCategory } from '../types';

type TimeFilter = 'all' | 'today' | 'week' | 'month';

interface FilterState {
  category: 'Semua' | VisitorCategory;
  time: TimeFilter;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  currentFilter: FilterState;
  onApply: (filter: FilterState) => void;
}

const CATEGORIES: ('Semua' | VisitorCategory)[] = ['Semua', 'VIP', 'Reguler', 'Family'];
const TIME_OPTIONS: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
];

function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  const activeColor = color || Colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: Radius.pill,
        backgroundColor: active ? activeColor : Colors.background,
        borderWidth: active ? 0 : 1,
        borderColor: Colors.borderLight,
        marginRight: Spacing.sm,
        marginBottom: Spacing.sm,
      }}
    >
      <Text
        style={[
          Typography.bodySmall,
          { fontWeight: active ? '600' : '400', color: active ? Colors.white : Colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function FilterSheet({ visible, onClose, currentFilter, onApply }: Props) {
  const [category, setCategory] = useState(currentFilter.category);
  const [time, setTime] = useState(currentFilter.time);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setCategory(currentFilter.category);
      setTime(currentFilter.time);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 55, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => onClose());
  };

  const handleApply = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => onApply({ category, time }));
  };

  const handleReset = () => {
    setCategory('Semua');
    setTime('all');
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={{ flex: 1, backgroundColor: Colors.overlay, opacity: fadeAnim }}>
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Colors.card,
          borderTopLeftRadius: Radius.xxl,
          borderTopRightRadius: Radius.xxl,
          paddingHorizontal: Spacing.xl,
          paddingBottom: 48,
          transform: [{ translateY: slideAnim }],
          ...Shadows.elevated,
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingVertical: Spacing.md }}>
          <View
            style={{
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: Colors.borderLight,
            }}
          />
        </View>

        {/* Title */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.xl,
          }}
        >
          <Text style={[Typography.h3, { color: Colors.textPrimary }]}>
            Filter Visitor
          </Text>
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <Text style={[Typography.bodySmall, { color: Colors.primary, fontWeight: '600' }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Category Section */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, marginBottom: Spacing.sm, textTransform: 'uppercase' }]}>
          Kategori
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.xl }}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              active={category === cat}
              onPress={() => setCategory(cat)}
              color={cat !== 'Semua' ? Colors.category[cat] : Colors.primary}
            />
          ))}
        </View>

        {/* Time Section */}
        <Text style={[Typography.caption, { color: Colors.textTertiary, marginBottom: Spacing.sm, textTransform: 'uppercase' }]}>
          Periode
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.xxl }}>
          {TIME_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              active={time === opt.key}
              onPress={() => setTime(opt.key)}
            />
          ))}
        </View>

        {/* Apply Button */}
        <TouchableOpacity
          onPress={handleApply}
          activeOpacity={0.85}
          style={{
            backgroundColor: Colors.primary,
            borderRadius: Radius.md,
            height: 50,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[Typography.button, { color: Colors.white }]}>
            Terapkan Filter
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

export type { FilterState };
