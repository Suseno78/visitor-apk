import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Shadows, Radius, Spacing } from '../constants/colors';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number | string;
  subtitle: string;
  trend?: string;
  trendUp?: boolean;
}

export function StatsCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  subtitle,
  trend,
  trendUp = true,
}: Props) {
  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        ...Shadows.card,
      }}
    >
      {/* Icon + label row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.sm + 2,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: Spacing.sm,
          }}
        >
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text
          style={[Typography.caption, { color: Colors.textTertiary, textTransform: 'uppercase', flex: 1 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      <Text
        style={[Typography.statistic, { color: Colors.textPrimary, marginBottom: 6 }]}
      >
        {value}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {trend ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: trendUp ? Colors.successLight : Colors.dangerLight,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: Radius.pill,
            }}
          >
            <Ionicons
              name={trendUp ? 'trending-up' : 'trending-down'}
              size={12}
              color={trendUp ? Colors.trendUp : Colors.trendDown}
              style={{ marginRight: 3 }}
            />
            <Text
              style={{
                fontSize: 11,
                color: trendUp ? Colors.trendUp : Colors.trendDown,
                fontWeight: '600',
              }}
            >
              {trend}
            </Text>
          </View>
        ) : (
          <Text style={[Typography.caption, { color: Colors.textTertiary }]}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
}
