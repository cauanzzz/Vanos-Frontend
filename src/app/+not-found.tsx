import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';

export default function NotFoundScreen() {
  return (
    <Screen>
      <View className="flex-1 justify-center gap-5">
        <Typography variant="title">Esse caminho não foi encontrado.</Typography>
        <Typography tone="muted">Volte ao início para continuar.</Typography>
        <Button label="Ir para o início" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
