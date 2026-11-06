import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme/tokens';

export function SessionGate() {
  const phase = useAuth((state) => state.phase);
  const notice = useAuth((state) => state.notice);
  const recovery = useAuth((state) => state.recovery);
  const restore = useAuth((state) => state.restore);
  const logout = useAuth((state) => state.logout);
  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 py-10" accessibilityLiveRegion="polite">
        <Typography variant="title">{phase === 'storageError' ? 'Precisamos conferir sua sessão.' : phase === 'signingOut' ? 'Encerrando sua sessão…' : 'Preparando seu caminho…'}</Typography>
        {phase === 'storageError' ? (
          <>
            <Typography>{notice}</Typography>
            <Button label="Tentar novamente" onPress={() => { void (recovery === 'restore' ? restore() : logout()); }} />
            {recovery === 'restore' && <Button secondary label="Apagar sessão deste aparelho" onPress={() => { void logout(); }} />}
          </>
        ) : <ActivityIndicator accessibilityLabel="Aguarde" color={colors.forest} />}
      </View>
    </Screen>
  );
}
