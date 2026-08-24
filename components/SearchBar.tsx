import { useState, useRef } from 'react';
import { TextInput, Animated, Platform, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing, Shadows } from '../constants/colors';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  onBack?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Cari...',
  style,
  autoFocus = false,
  onBack,
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  
  // Animation values for focus state
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.card, Colors.primary],
  });

  const webBoxShadow = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      '0px 1px 4px rgba(6, 59, 0, 0.03)',
      '0px 2px 8px rgba(6, 59, 0, 0.05)',
    ],
  });

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.03, 0.05],
  });
  
  const shadowRadius = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 8],
  });

  const shadowHeight = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });

  const elevation = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Colors.card,
          borderRadius: Radius.xl,
          paddingHorizontal: Spacing.lg,
          height: 54,
          borderWidth: 1,
          borderColor: borderColor,
        },
        Platform.OS === 'web'
          ? { boxShadow: webBoxShadow as any }
          : {
              shadowColor: '#063B00',
              shadowOffset: { width: 0, height: shadowHeight as any },
              shadowOpacity: shadowOpacity as any,
              shadowRadius: shadowRadius as any,
              elevation: elevation as any,
            },
        style,
      ]}
    >
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginRight: Spacing.sm }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}
      {!onBack && (
        <Ionicons
          name="search-outline"
          size={20}
          color={isFocused ? Colors.primary : Colors.textTertiary}
          style={{ marginRight: Spacing.md }}
        />
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        style={[
          Typography.body,
          {
            flex: 1,
            color: Colors.textPrimary,
            // Remove web outline
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
          },
        ]}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
