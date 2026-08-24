import { useRef } from 'react';
import { TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../constants/colors';
import { TAB_BAR_TOTAL_HEIGHT } from '../constants/layout';

interface Props {
  onPress: () => void;
  bottom?: number;
}

export function FloatingActionButton({ onPress, bottom }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, friction: 5, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: bottom !== undefined ? bottom : TAB_BAR_TOTAL_HEIGHT + 20,
        right: 20,
        zIndex: 10,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={[
          {
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: Colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...Shadows.lg,
          },
          Platform.OS === 'web'
            ? { boxShadow: '0px 3px 12px rgba(38, 98, 16, 0.25)' }
            : { shadowColor: Colors.primary, shadowOpacity: 0.25 }
        ]}
      >
        <Ionicons name="add" size={26} color={Colors.white} />
      </TouchableOpacity>
    </Animated.View>
  );
}
