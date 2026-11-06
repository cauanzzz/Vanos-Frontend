import { TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/tokens';
import { Typography } from './Typography';

export function FormField({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="gap-2">
      <Typography variant="label">{label}</Typography>
      <TextInput accessibilityLabel={label} accessibilityHint={error} placeholderTextColor={colors.muted}
        className="min-h-14 rounded-2xl border bg-surface px-4 py-3 text-base text-ink"
        style={{ borderColor: error ? colors.danger : colors.line }} {...props} />
      {error && <Typography variant="caption" accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Typography>}
    </View>
  );
}
