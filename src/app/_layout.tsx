import '../../global.css';
import '@/tasks/driverLocationTask';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionGate } from '@/features/auth/SessionGate';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Screen } from '@/components/ui/Screen';
import { canAccess } from '@/features/auth/session';
import { useSessionLifecycle } from '@/features/auth/useSessionLifecycle';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const { startupError, retryStartup } = useSessionLifecycle();
  const phase = useAuth((state) => state.phase);
  const session = useAuth((state) => state.session);
  const ready = phase === 'anonymous' || phase === 'authenticated';
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {startupError ? <Screen><Notice title="Confira a captura de GPS">Não foi possível confirmar a parada de uma captura anterior. Tente novamente antes de entrar.</Notice><Button label="Tentar novamente" onPress={retryStartup} /></Screen> : ready ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'none' }}>
            <Stack.Screen name="index" />
            <Stack.Protected guard={!session}>
              <Stack.Screen name="access" />
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={canAccess(session, 'driver')}><Stack.Screen name="(driver)" /></Stack.Protected>
            <Stack.Protected guard={canAccess(session, 'passenger')}><Stack.Screen name="(passenger)" /></Stack.Protected>
          </Stack>
        ) : <SessionGate />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
