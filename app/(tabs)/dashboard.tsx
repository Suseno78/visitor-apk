import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, LayoutAnimation, Keyboard, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { useWorkspace } from '../../hooks/useWorkspace';
import { DashboardHeader } from '../../components/DashboardHeader';
import { VisitorCard } from '../../components/VisitorCard';

import { SearchBar } from '../../components/SearchBar';
import { EmptyState } from '../../components/EmptyState';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive, TAB_BAR_TOTAL_HEIGHT } from '../../constants/layout';

// ---------------------------------------------------------------------------
// Quick Category Chip
// ---------------------------------------------------------------------------
function CategoryChip({
  icon,
  label,
  count,
  color,
  bgColor,
  onPress,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  onPress: () => void;
  delay: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.xl,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.sm,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: Colors.borderLight,
          ...Shadows.card,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: bgColor,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.sm,
          }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[Typography.label, { color: Colors.textPrimary, marginBottom: 2 }]}>
          {label}
        </Text>
        <Text style={[Typography.caption, { color: Colors.textTertiary }]}>
          {count} visitor
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------
function SummaryCard({ todayCount, total }: { todayCount: number; total: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, delay: 100, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <View
        style={{
          backgroundColor: Colors.primary,
          borderRadius: Radius.xxl,
          padding: Spacing.lg,
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <View
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 110,
            height: 110,
            borderRadius: 55,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -20,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        />

        {/* Content */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md + 4 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.md,
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                letterSpacing: 0.5,
                color: 'rgba(255,255,255,0.55)',
                textTransform: 'uppercase',
              }}
            >
              Visitor Hari Ini
            </Text>
          </View>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: Radius.pill,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
              Total: {total}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 42,
            fontWeight: '800',
            color: Colors.white,
            letterSpacing: -1.5,
            marginBottom: 4,
          }}
        >
          {todayCount}
        </Text>

        <Text
          style={{
            fontSize: 13,
            fontWeight: '400',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 18,
          }}
        >
          {todayCount === 0
            ? 'Belum ada pengunjung hari ini'
            : todayCount === 1
            ? '1 pengunjung tercatat hari ini'
            : `${todayCount} pengunjung tercatat hari ini`}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Screen
// ---------------------------------------------------------------------------
export default function DashboardScreen() {
  const router = useRouter();
  const { visitors, getStats, getRecent } = useVisitors();
  const { workspaceName, isOfflineMode, membershipStatus } = useWorkspace();
  const stats = getStats();
  const recent = getRecent(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const { horizontalPadding, statusBarPadding, isTablet, contentMaxWidth } = useResponsive();

  // Greeting name for dashboard
  const displayName = 'Wantiono';

  // Calculate today's visits
  const today = new Date();
  const mNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const todayString = `${today.getDate()} ${mNames[today.getMonth()]} ${today.getFullYear()}`;

  const todayCount = visitors.reduce((count, v) => {
    const visitsToday = (v.visits || []).filter((visit) => {
      return visit.date && visit.date.includes(todayString);
    });
    return count + visitsToday.length;
  }, 0);

  const filteredRecent = (searchQuery.trim() || isSearchMode)
    ? visitors.filter(
        (v) =>
          v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (v.occupation || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recent;

  const toggleSearchMode = useCallback((active: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchMode(active);
    if (!active) {
      setSearchQuery('');
      Keyboard.dismiss();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsSearchMode(false);
        setSearchQuery('');
        Keyboard.dismiss();
      };
    }, [])
  );

  // Fade in for recent visitors section
  const recentFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(recentFade, { toValue: 1, duration: 500, delay: 400, useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: TAB_BAR_TOTAL_HEIGHT + 24,
          ...(isTablet ? { alignItems: 'center' } : {}),
        }}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        {/* Hero Header / Search Mode */}
        <View style={{ width: '100%', backgroundColor: Colors.primary }}>
          {isSearchMode ? (
            <View
              style={{
                paddingTop: statusBarPadding + Spacing.md,
                paddingBottom: Spacing.xl,
                paddingHorizontal: horizontalPadding,
                backgroundColor: Colors.primary,
                borderBottomLeftRadius: 28,
                borderBottomRightRadius: 28,
              }}
            >
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onBack={() => toggleSearchMode(false)}
                placeholder="Cari nama, kategori..."
                autoFocus
                style={{ borderWidth: 0 }}
              />
            </View>
          ) : (
            <DashboardHeader
              name={displayName}
              onSearchPress={() => toggleSearchMode(true)}
              isOfflineMode={isOfflineMode}
              membershipStatus={membershipStatus}
            />
          )}
        </View>

        <View
          style={{
            width: '100%',
            maxWidth: isTablet ? contentMaxWidth : undefined,
            paddingHorizontal: horizontalPadding,
          }}
        >

          {/* Summary Card */}
          {!isSearchMode && (
            <View style={{ marginTop: Spacing.lg }}>
              <SummaryCard todayCount={todayCount} total={stats.total} />
            </View>
          )}

          {/* Persistent Quick Action: Catat Pengunjung Baru */}
          {!isSearchMode && (
            <View style={{ marginTop: Spacing.md }}>
              <TouchableOpacity
                onPress={() => router.push('/visitor/add')}
                activeOpacity={0.8}
                style={{
                  backgroundColor: Colors.primary,
                  borderRadius: Radius.xl,
                  paddingVertical: 14,
                  paddingHorizontal: Spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...Shadows.md,
                }}
              >
                <Ionicons name="person-add-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={[Typography.bodySemibold, { color: Colors.white }]}>
                  Catat Pengunjung Baru
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Categories */}
          {!isSearchMode && (
            <View style={{ marginTop: Spacing.lg + 4 }}>
              <Text
                style={[
                  Typography.h4,
                  { color: Colors.textPrimary, marginBottom: Spacing.md },
                ]}
              >
                Kategori
              </Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm + 4 }}>
                <CategoryChip
                  icon="person-outline"
                  label="Reguler"
                  count={stats.reguler}
                  color={Colors.category.Reguler}
                  bgColor={Colors.categoryBg.Reguler}
                  onPress={() => router.push({ pathname: '/(tabs)/visitors', params: { category: 'Reguler' } })}
                  delay={150}
                />
                <CategoryChip
                  icon="diamond-outline"
                  label="VIP"
                  count={stats.vip}
                  color={Colors.category.VIP}
                  bgColor={Colors.categoryBg.VIP}
                  onPress={() => router.push({ pathname: '/(tabs)/visitors', params: { category: 'VIP' } })}
                  delay={250}
                />
                <CategoryChip
                  icon="people-outline"
                  label="Family"
                  count={stats.family}
                  color={Colors.category.Family}
                  bgColor={Colors.categoryBg.Family}
                  onPress={() => router.push({ pathname: '/(tabs)/visitors', params: { category: 'Family' } })}
                  delay={350}
                />
              </View>
            </View>
          )}

          {/* Recent Visitors */}
          <Animated.View
            style={{
              marginTop: Spacing.lg + 4,
              marginBottom: Spacing.lg,
              opacity: recentFade,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: Spacing.md,
              }}
            >
              <Text style={[Typography.h4, { color: Colors.textPrimary }]}>
                {isSearchMode ? 'Hasil Pencarian' : 'Visitor Terbaru'}
              </Text>
              {visitors.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/visitors')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      Typography.bodySmall,
                      { color: Colors.primary, fontWeight: '600' },
                    ]}
                  >
                    Lihat Semua
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {visitors.length === 0 ? (
              <EmptyState onAddPress={() => router.push('/visitor/add')} />
            ) : searchQuery.trim() && filteredRecent.length === 0 ? (
              <View style={{ paddingVertical: Spacing.xxl, alignItems: 'center' }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: Colors.primarySurface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: Spacing.md,
                  }}
                >
                  <Ionicons name="search-outline" size={22} color={Colors.primary} />
                </View>
                <Text
                  style={[
                    Typography.body,
                    { color: Colors.textSecondary, textAlign: 'center' },
                  ]}
                >
                  Tidak ditemukan untuk "{searchQuery}"
                </Text>
              </View>
            ) : (
              filteredRecent.map((visitor) => (
                <VisitorCard
                  key={visitor.id}
                  visitor={visitor}
                  onPress={() => router.push(`/visitor/${visitor.id}`)}
                />
              ))
            )}
          </Animated.View>
        </View>
      </ScrollView>

    </View>
  );
}
