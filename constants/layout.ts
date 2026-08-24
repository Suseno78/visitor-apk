import { useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BREAKPOINT_TABLET = 768;
const BREAKPOINT_DESKTOP = 1024;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BREAKPOINT_TABLET;
  const isDesktop = width >= BREAKPOINT_DESKTOP;
  const isWeb = Platform.OS === 'web';
  const isPhone = width < BREAKPOINT_TABLET;
  const insets = useSafeAreaInsets();

  const contentMaxWidth = isDesktop ? 600 : isTablet ? 560 : width;
  const horizontalPadding = isTablet ? 32 : 20;
  const statusBarPadding = isWeb ? 16 : Math.max(insets.top, 16);

  return {
    width,
    height,
    isPhone,
    isTablet,
    isDesktop,
    isWeb,
    contentMaxWidth,
    horizontalPadding,
    statusBarPadding,
  };
}

// Tab bar constants
export const TAB_BAR_HEIGHT = 74;
export const TAB_BAR_MARGIN = 0; // No longer floating — kept for backward compat
export const TAB_BAR_TOTAL_HEIGHT = TAB_BAR_HEIGHT;
