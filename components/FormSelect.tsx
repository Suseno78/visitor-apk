import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing, Shadows } from '../constants/colors';

interface Props {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function FormSelect({ label, value, options, onSelect, placeholder = 'Pilih', icon }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: Spacing.md + 4 }}>
      {label ? (
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: Colors.borderLight,
          borderRadius: Radius.md,
          height: 48,
          paddingHorizontal: Spacing.md,
          backgroundColor: Colors.card,
        }}
      >
        {icon && <Ionicons name={icon} size={18} color={Colors.textTertiary} style={{ marginRight: Spacing.sm }} />}
        <Text
          style={[
            Typography.body,
            { flex: 1, color: value ? Colors.textPrimary : Colors.textTertiary },
          ]}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: 40 }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.xl,
              maxHeight: 340,
              overflow: 'hidden',
              ...Shadows.elevated,
            }}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { onSelect(item); setOpen(false); }}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: Spacing.xl,
                    backgroundColor: item === value ? Colors.primarySurface : Colors.card,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.borderLight,
                  }}
                >
                  <Text
                    style={[
                      Typography.body,
                      {
                        color: item === value ? Colors.primary : Colors.textPrimary,
                        fontWeight: item === value ? '600' : '400',
                      },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
