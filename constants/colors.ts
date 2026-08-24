// =============================================================================
// Green Color System — Premium Guest Management
// =============================================================================
// Palette inspired by DESIGN.md: Calm, elegant, muted deep greens.
// "Naturalist Premium" — forest greens + warm organic neutrals.
// All shadows tinted with primary to avoid cold/gray look.
// =============================================================================

export const Colors = {
  // ---------------------------------------------------------------------------
  // Primary palette — deep forest green
  // ---------------------------------------------------------------------------
  primary: '#266210',         // Primary container — main interactive color
  primaryLight: '#37821A',    // Lighter variant for hover / secondary emphasis
  primaryDark: '#124900',     // Deepest green — hero gradients, pressed states
  primaryMuted: '#95D878',    // Soft lime green — decorative / accent
  primarySurface: '#EDF6E8',  // Very light green tint — chip bg, icon bg

  // ---------------------------------------------------------------------------
  // Surfaces — warm, organic whites (NOT pure digital white)
  // ---------------------------------------------------------------------------
  background: '#F7FAF5',      // Page background — desaturated green tint
  card: '#FFFFFF',            // Card / elevated surface
  surface: '#FFFFFF',         // General surface
  surfaceElevated: '#FFFFFF', // Elevated panels
  overlay: 'rgba(25, 29, 22, 0.45)', // Overlay — warm-tinted black

  // ---------------------------------------------------------------------------
  // Text — warm dark tones (green-tinted blacks, not blue-blacks)
  // ---------------------------------------------------------------------------
  textPrimary: '#191D16',     // Headings, primary text (on-surface)
  textSecondary: '#41493C',   // Subtitles, labels (on-surface-variant)
  textTertiary: '#717A6B',    // Placeholders, disabled (outline)
  textInverse: '#FFFFFF',     // Text on dark / primary backgrounds

  // ---------------------------------------------------------------------------
  // Borders — organic gray-greens
  // ---------------------------------------------------------------------------
  border: '#C1C9B8',          // Standard border (outline-variant)
  borderLight: '#E6E9DE',     // Subtle dividers (surface-container-high)

  // ---------------------------------------------------------------------------
  // Semantic — restrained, not oversaturated
  // ---------------------------------------------------------------------------
  danger: '#BA1A1A',          // Error / destructive actions
  dangerLight: '#FFDAD6',     // Error surface
  success: '#2F6B19',         // Success — aligned with primary family
  successLight: '#D4EDCB',    // Success surface
  warning: '#7C5D00',         // Warning — warm amber-brown
  warningLight: '#FDEFC1',    // Warning surface

  // ---------------------------------------------------------------------------
  // Neutrals
  // ---------------------------------------------------------------------------
  white: '#FFFFFF',
  black: '#000000',

  // ---------------------------------------------------------------------------
  // Tab Bar
  // ---------------------------------------------------------------------------
  tabBarBg: '#FFFFFF',
  tabBarActive: '#266210',    // Matches primary
  tabBarInactive: '#717A6B',  // Matches textTertiary
  tabBarPill: '#EDF6E8',      // Matches primarySurface

  // ---------------------------------------------------------------------------
  // Category colors — muted, distinguishable, green-compatible
  // ---------------------------------------------------------------------------
  category: {
    VIP: '#6B5B0F',           // Deep warm gold
    Reguler: '#266210',       // Primary green
    Family: '#1A6B5A',        // Teal-green
    Partner: '#5A3D8A',       // Muted plum (cooler contrast)
  } as Record<string, string>,

  categoryBg: {
    VIP: '#F5EDCF',           // Warm cream
    Reguler: '#EDF6E8',       // Light green
    Family: '#D6F0EA',        // Light teal
    Partner: '#EEDFFF',       // Light lavender
  } as Record<string, string>,

  categoryAccent: {
    VIP: '#C9A92C',           // Gold
    Reguler: '#5AA142',       // Medium green
    Family: '#3BA68E',        // Teal
    Partner: '#8B6BBF',       // Lavender
  } as Record<string, string>,

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  statsBlue: '#266210',       // Reuse primary for consistency
  statsGreen: '#2F6B19',      // Deep green
  statsAmber: '#7C5D00',      // Warm amber-brown

  // ---------------------------------------------------------------------------
  // Trend indicators
  // ---------------------------------------------------------------------------
  trendUp: '#2F6B19',         // Positive — matches success
  trendDown: '#BA1A1A',       // Negative — matches danger
};

// =============================================================================
// Typography presets — Inter typeface, "Display-Heavy" hierarchy
// =============================================================================
// Weight strategy:   Bold (700) → page headers
//                    SemiBold (600) → section titles, sub-headers
//                    Regular (400) → body, instructions, input text
// Line height:       Tight for headers, generous (1.5×+) for body
// =============================================================================

export const Typography = {
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 32 },
  h2: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 24 },
  h4: { fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 21 },
  bodySemibold: { fontSize: 14, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 21 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.3, lineHeight: 15 },
  label: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.1, lineHeight: 18 },
  button: { fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.1 },
  buttonSmall: { fontSize: 13, fontWeight: '600' as const },
  statistic: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  statisticSmall: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
} as const;

// =============================================================================
// Spacing — 8px base grid (per DESIGN.md)
// =============================================================================

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// =============================================================================
// Border radius — large, friendly radiuses (per DESIGN.md Shapes section)
// =============================================================================
// Primary cards: rounded-xl (24px)
// Buttons/inputs: rounded-lg (16px)
// Chips/badges: rounded-sm (8px)
// =============================================================================

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 22,
  pill: 9999,
} as const;

// =============================================================================
// Shadow presets — "Natural Ambient" style
// =============================================================================
// Shadows use a subtle primary-dark tint (rgba(6, 59, 0, ...))
// instead of gray/blue to maintain the organic/warm feel.
// =============================================================================

import { Platform } from 'react-native';

const shadowBase = '#063B00'; // Primary-tinted shadow color

const createShadow = (width: number, height: number, opacity: number, radius: number, elevation: number) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${width}px ${height}px ${radius}px rgba(6, 59, 0, ${opacity})`
    };
  }
  return {
    shadowColor: shadowBase,
    shadowOffset: { width, height },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
};

export const Shadows = {
  sm: createShadow(0, 1, 0.03, 4, 1),
  md: createShadow(0, 2, 0.05, 8, 2),
  lg: createShadow(0, 3, 0.06, 12, 4),
  xl: createShadow(0, 4, 0.08, 20, 6),
  card: createShadow(0, 1, 0.03, 10, 1),
  elevated: createShadow(0, 6, 0.08, 24, 8),
} as const;
