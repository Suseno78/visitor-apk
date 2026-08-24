import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius } from '../constants/colors';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'outline' | 'category';
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  color,
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
}: Props) {
  const bgColor =
    variant === 'danger' ? Colors.danger
    : variant === 'outline' ? Colors.white
    : variant === 'category' ? (color || Colors.primary)
    : Colors.primary;

  const textColor = variant === 'outline' ? Colors.primary : Colors.white;
  const borderColor = variant === 'outline' ? Colors.borderLight : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={{
        backgroundColor: bgColor,
        borderRadius: Radius.md,
        height: 50,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor,
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? '100%' : undefined,
        alignSelf: fullWidth ? undefined : 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && (
            <Ionicons name={icon} size={20} color={textColor} style={{ marginRight: 8 }} />
          )}
          <Text style={[Typography.button, { color: textColor }]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
