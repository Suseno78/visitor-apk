import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '../constants/colors';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  optional?: boolean;
}

export function FormInput({ label, value, onChangeText, placeholder, optional = false }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: Spacing.md + 4 }}>
      <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: 6 }]}>
        {label}
        {optional && <Text style={{ color: Colors.textTertiary, fontWeight: '400' }}> (opsional)</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || `Masukkan ${label.toLowerCase()}`}
        placeholderTextColor={Colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          borderWidth: 1,
          borderColor: focused ? Colors.primary : Colors.borderLight,
          borderRadius: Radius.md,
          height: 48,
          paddingHorizontal: Spacing.md,
          fontSize: 14,
          color: Colors.textPrimary,
          backgroundColor: Colors.card,
        }}
      />
    </View>
  );
}
