import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/colors';

interface Props {
  currentStep: number;
  steps: string[];
}

export function StepIndicator({ currentStep, steps }: Props) {
  return (
    <View style={{ paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg }}>
      {/* Progress bar */}
      <View
        style={{
          height: 3,
          backgroundColor: Colors.borderLight,
          borderRadius: 2,
          marginBottom: Spacing.md,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            backgroundColor: Colors.primary,
            borderRadius: 2,
          }}
        />
      </View>

      {/* Step labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {steps.map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;

          return (
            <View key={stepNum} style={{ alignItems: 'center', flex: 1 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isActive || isCompleted ? Colors.primary : Colors.background,
                  borderWidth: isActive || isCompleted ? 0 : 1.5,
                  borderColor: Colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color={Colors.white} />
                ) : (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isActive ? Colors.white : Colors.textTertiary,
                    }}
                  >
                    {stepNum}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  Typography.caption,
                  {
                    color: isActive ? Colors.primary : Colors.textTertiary,
                    fontWeight: isActive ? '600' : '400',
                    textAlign: 'center',
                  },
                ]}
                numberOfLines={2}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
