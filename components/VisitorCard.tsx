import React, { memo } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Visitor } from '../types';
import { CategoryBadge } from './CategoryBadge';
import { Colors, Typography, Shadows, Radius, Spacing } from '../constants/colors';

interface Props {
  visitor: Visitor;
  onPress: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}

function VisitorCardComponent({ visitor, onPress, onLongPress, isSelected, isSelectionMode }: Props) {
  const avatarBg = Colors.categoryBg[visitor.category] || Colors.categoryBg.Reguler;
  const avatarColor = Colors.category[visitor.category] || Colors.category.Reguler;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: isSelected ? Colors.primarySurface : Colors.card,
        borderRadius: Radius.xl,
        padding: Spacing.md,
        marginBottom: Spacing.sm + 4,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: isSelected ? Colors.primary : Colors.borderLight,
        ...Shadows.card,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: Spacing.md,
        }}
      >
        <Ionicons name="person" size={20} color={avatarColor} />
      </View>

      {/* Info */}
      <View style={{ flex: 1, marginRight: Spacing.sm }}>
        <Text
          style={[Typography.bodySemibold, { color: Colors.textPrimary, marginBottom: 2 }]}
          numberOfLines={1}
        >
          {visitor.name}
        </Text>
        <Text
          style={[Typography.bodySmall, { color: Colors.textTertiary, marginBottom: 6 }]}
          numberOfLines={1}
        >
          {visitor.occupation || 'Umum'}
        </Text>
        <CategoryBadge category={visitor.category} />
      </View>

      {/* Checkbox / Chevron */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: Radius.sm,
          backgroundColor: isSelected ? Colors.primary : (isSelectionMode ? 'transparent' : Colors.primarySurface),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: isSelectionMode && !isSelected ? 2 : 0,
          borderColor: Colors.borderLight,
        }}
      >
        {isSelected ? (
          <Ionicons name="checkmark" size={16} color={Colors.white} />
        ) : !isSelectionMode ? (
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export const VisitorCard = memo(VisitorCardComponent);
