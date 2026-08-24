import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing } from '../constants/colors';
import { VisitorCategory } from '../types';

interface Props {
  category: VisitorCategory;
  count: number;
  onPress: () => void;
}

const categoryConfig: Record<VisitorCategory, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}> = {
  VIP: { icon: 'diamond-outline', color: Colors.category.VIP, bgColor: Colors.categoryBg.VIP },
  Reguler: { icon: 'person-outline', color: Colors.category.Reguler, bgColor: Colors.categoryBg.Reguler },
  Family: { icon: 'people-outline', color: Colors.category.Family, bgColor: Colors.categoryBg.Family },
  Partner: { icon: 'briefcase-outline', color: Colors.category.Partner, bgColor: Colors.categoryBg.Partner },
};

export function CategoryIcon({ category, count, onPress }: Props) {
  const config = categoryConfig[category];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        alignItems: 'center',
        flex: 1,
        gap: Spacing.xs,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: Radius.md,
          backgroundColor: config.bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={config.icon} size={22} color={config.color} />
      </View>
      <Text style={[Typography.label, { color: Colors.textPrimary }]}>
        {category}
      </Text>
      <Text style={[Typography.caption, { color: Colors.textTertiary }]}>
        {count}
      </Text>
    </TouchableOpacity>
  );
}
