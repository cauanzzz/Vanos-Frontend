import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionGate } from '@/features/auth/SessionGate';
import { canAccess } from '@/features/auth/session';
import { useSessionLifecycle } from '@/features/auth/useSessionLifecycle';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  useSessionLifecycle();
  const phase = useAuth((state) => state.phase);
  const session = useAuth((state) => state.session);
  const ready = phase === 'anonymous' || phase === 'authenticated';
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {ready ? (
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
