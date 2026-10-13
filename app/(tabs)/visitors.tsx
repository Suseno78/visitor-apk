import { useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, LayoutAnimation, Keyboard, Animated, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitors } from '../../hooks/useVisitors';
import { VisitorCard } from '../../components/VisitorCard';
import { VisitorStatsRow } from '../../components/VisitorStatsRow';
import { SearchBar } from '../../components/SearchBar';
import { FilterSheet, FilterState } from '../../components/FilterSheet';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { EmptyState } from '../../components/EmptyState';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/colors';
import { useResponsive, TAB_BAR_TOTAL_HEIGHT } from '../../constants/layout';
import { VisitorCategory } from '../../types';

type TabKey = 'Semua' | VisitorCategory;
const tabs: TabKey[] = ['Semua', 'VIP', 'Reguler', 'Family'];

const tabColors: Record<TabKey, string> = {
  Semua: Colors.primary,
  VIP: Colors.category.VIP,
  Reguler: Colors.category.Reguler,
  Family: Colors.category.Family,
};

export default function VisitorsScreen() {
  const router = useRouter();
  const { filterByCategory, getStats, deleteMultipleVisitors } = useVisitors();
  const [selectedTab, setSelectedTab] = useState<TabKey>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filter, setFilter] = useState<FilterState>({ category: 'Semua', time: 'all' });
  const { statusBarPadding, horizontalPadding, isTablet, contentMaxWidth } = useResponsive();
  const stats = getStats();
  const scrollRef = useRef<ScrollView>(null);
  const snackbarAnim = useRef(new Animated.Value(0)).current;

  // Apply filters
  let filtered = filterByCategory(selectedTab);
  if (filter.category !== 'Semua') {
    filtered = filtered.filter((v) => v.category === filter.category);
  }

  // Apply inline search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.occupation || '').toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
    );
  }

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

  const isSelectionMode = selectedIds.length > 0;

  const handleLongPress = useCallback((id: string) => {
    if (!isSelectionMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedIds([id]);
    }
  }, [isSelectionMode]);

  const handlePress = useCallback((id: string) => {
    if (isSelectionMode) {
      setSelectedIds((prev) => {
        const newSelection = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
        if (newSelection.length === 0) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        return newSelection;
      });
    } else {
      router.push(`/visitor/${id}`);
    }
  }, [isSelectionMode]);

  const showSnackbar = useCallback(() => {
    setSnackbarVisible(true);
    Animated.sequence([
      Animated.timing(snackbarAnim, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(2500),
      Animated.timing(snackbarAnim, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => setSnackbarVisible(false));
  }, []);

  const handleDelete = async () => {
    setShowConfirmDelete(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await deleteMultipleVisitors(selectedIds);
    setSelectedIds([]);
    showSnackbar();
  };



  const statsItems = [
    {
      icon: 'people-outline' as const,
      iconColor: Colors.primary,
      iconBg: Colors.primarySurface,
      label: 'Semua',
      value: stats.total,
      subtitle: 'Visitor',
    },
    {
      icon: 'sparkles-outline' as const,
      iconColor: Colors.statsGreen,
      iconBg: Colors.successLight,
      label: 'Baru',
      value: stats.todayNew,
      subtitle: 'Hari ini',
    },
    {
      icon: 'calendar-outline' as const,
      iconColor: Colors.statsAmber,
      iconBg: Colors.warningLight,
      label: 'Kunjungan',
      value: stats.totalVisits,
      subtitle: 'Total',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: Colors.primary,
          paddingTop: statusBarPadding,
          paddingBottom: Spacing.md + 4,
          paddingHorizontal: horizontalPadding,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {isSelectionMode ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSelectedIds([]);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={Colors.white} style={{ marginRight: Spacing.md }} />
              </TouchableOpacity>
              <Text style={[Typography.h2, { color: Colors.white }]}>
                {selectedIds.length} Terpilih
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowConfirmDelete(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: Radius.sm + 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ) : isSearchMode ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onBack={() => toggleSearchMode(false)}
              placeholder="Cari nama, kategori..."
              autoFocus
              style={{ flex: 1, borderWidth: 0, height: 46 }}
            />
          </View>
        ) : (
          <>
            <Text style={[Typography.h2, { color: Colors.white }]}>
              Visitor
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => toggleSearchMode(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: Radius.sm + 2,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="search-outline" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>


      {/* Category Tabs */}
      <View style={{ backgroundColor: Colors.white, ...Shadows.sm }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingVertical: Spacing.md,
            gap: Spacing.sm,
          }}
        >
          {tabs.map((tab) => {
            const isActive = selectedTab === tab;
            const color = tabColors[tab];
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setSelectedTab(tab)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: Spacing.md + 4,
                  paddingVertical: Spacing.sm,
                  borderRadius: Radius.pill,
                  backgroundColor: isActive ? color : Colors.background,
                }}
              >
                <Text
                  style={[
                    Typography.bodySmall,
                    {
                      fontWeight: isActive ? '600' : '500',
                      color: isActive ? Colors.white : Colors.textSecondary,
                    },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={{ flex: 1, alignItems: isTablet ? 'center' : undefined }}>
        <View style={{ flex: 1, maxWidth: isTablet ? contentMaxWidth : undefined, width: '100%' }}>
          {/* Stats Row */}
          <View style={{ paddingHorizontal: horizontalPadding, marginTop: Spacing.md }}>
            <VisitorStatsRow stats={statsItems} />
          </View>

          {/* Daftar Visitor Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: horizontalPadding,
              marginTop: Spacing.md,
              marginBottom: Spacing.sm,
            }}
          >
            <Text style={[Typography.h4, { color: Colors.textPrimary }]}>
              Daftar Visitor
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>

              <TouchableOpacity
                onPress={() => setShowFilter(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: Colors.primarySurface,
                  paddingHorizontal: Spacing.sm + 2,
                  paddingVertical: 5,
                  borderRadius: Radius.pill,
                }}
              >
                <Ionicons name="funnel-outline" size={14} color={Colors.primary} />
                <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600', marginLeft: 4 }}>
                  Filter
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Visitor List */}
          {filtered.length === 0 ? (
            <View style={{ flex: 1, paddingTop: 20 }}>
              <EmptyState />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: horizontalPadding,
                paddingBottom: TAB_BAR_TOTAL_HEIGHT + 80,
              }}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              bounces={false}
              renderItem={({ item }) => (
                <VisitorCard
                  visitor={item}
                  onPress={() => handlePress(item.id)}
                  onLongPress={() => handleLongPress(item.id)}
                  isSelected={selectedIds.includes(item.id)}
                  isSelectionMode={isSelectionMode}
                />
              )}
            />
          )}
        </View>
      </View>

      {/* Floating Action Button */}
      <FloatingActionButton onPress={() => router.push('/visitor/add')} />



      {/* Filter Sheet */}
      <FilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        currentFilter={filter}
        onApply={(f) => {
          setFilter(f);
          if (f.category !== 'Semua') setSelectedTab(f.category);
          setShowFilter(false);
        }}
      />

      <ConfirmationModal
        visible={showConfirmDelete}
        title="Hapus Visitor?"
        message="Data visitor yang dipilih akan dihapus secara permanen dan tidak dapat dikembalikan."
        confirmLabel="Hapus"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirmDelete(false)}
        destructive
      />

      {snackbarVisible && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: TAB_BAR_TOTAL_HEIGHT + Spacing.md,
            left: Spacing.md,
            right: Spacing.md,
            backgroundColor: '#333333',
            borderRadius: Radius.md,
            padding: Spacing.md,
            alignItems: 'center',
            opacity: snackbarAnim,
            transform: [
              {
                translateY: snackbarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
            ...Shadows.md,
          }}
        >
          <Text style={[Typography.bodySemibold, { color: Colors.white }]}>
            Visitor berhasil dihapus
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
