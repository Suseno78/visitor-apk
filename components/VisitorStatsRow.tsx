import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Shadows, Radius, Spacing } from '../constants/colors';

interface StatItem {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number | string;
  subtitle: string;
}

interface Props {
  stats: StatItem[];
}

export function VisitorStatsRow({ stats }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.sm + 4 }}
      style={{ marginBottom: Spacing.md }}
    >
      {stats.map((stat, idx) => (
        <View
          key={idx}
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            padding: Spacing.md,
            minWidth: 125,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: Radius.sm,
                backgroundColor: stat.iconBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: Spacing.sm,
              }}
            >
              <Ionicons name={stat.icon} size={14} color={stat.iconColor} />
            </View>
            <Text
              style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', flex: 1 }]}
              numberOfLines={1}
            >
              {stat.label}
            </Text>
          </View>
          <Text style={[Typography.statisticSmall, { color: Colors.textPrimary }]}>
            {stat.value}
          </Text>
          <Text style={[Typography.caption, { color: Colors.textTertiary, marginTop: 2 }]}>
            {stat.subtitle}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
