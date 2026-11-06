import { View } from 'react-native';

import { Typography } from './Typography';

export function Notice({ title, children }: { title: string; children: string }) {
  return (
    <View className="gap-1 rounded-2xl border border-line bg-sage p-4">
      <Typography variant="label">{title}</Typography>
      <Typography variant="caption" tone="muted">{children}</Typography>
    </View>
  );
}
