import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { colors } from '@/theme/tokens';
import { Typography } from './Typography';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  loading?: boolean;
  secondary?: boolean;
};

export function Button({ label, loading = false, disabled, secondary = false, ...props }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      className={`min-h-14 justify-center rounded-2xl px-5 py-4 ${secondary ? 'bg-sage' : 'bg-ink'}`}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}
      {...props}
    >
      <View className="flex-row items-center justify-center gap-3">
        {loading && <ActivityIndicator color={secondary ? colors.ink : colors.canvas} />}
        <Typography variant="label" tone={secondary ? 'ink' : 'canvas'} className="text-center">
          {label}
        </Typography>
      </View>
    </Pressable>
  );
}
