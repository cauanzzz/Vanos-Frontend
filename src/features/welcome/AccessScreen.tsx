import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { isRole } from '@/types/roles';
import { profiles } from './roles';

export function AccessScreen() {
  const { role } = useLocalSearchParams<{ role?: string | string[] }>();
  const profile = isRole(role) ? profiles.find((item) => item.role === role) : undefined;

  return (
    <Screen>
      <View className="mb-10">
        <Button secondary label="← Voltar ao início" onPress={() => router.replace('/')} />
      </View>
      <Typography variant="caption" tone="forest" className="mb-3 font-semibold tracking-[2px]">SEU LUGAR NO VANOS</Typography>
      <Typography variant="display">{profile?.title ?? 'Vamos começar pelo seu perfil.'}</Typography>
      <Typography tone="muted" className="mb-8 mt-5">{profile?.detail ?? 'Entre na sua conta ou escolha seu perfil ao se cadastrar.'}</Typography>
      <Notice title="Uma conta, seu acesso">
        Já tem uma conta? Entre com seu e-mail e senha. O acesso será definido pelo perfil da sua conta.
      </Notice>
      <View className="mt-6 gap-3">
        <Button label="Entrar na minha conta" onPress={() => router.push('/login')} />
        <Button secondary label="Criar uma conta" onPress={() => router.push({ pathname: '/register', params: { role: profile?.role ?? 'Parent' } })} />
      </View>
      <View className="mt-8 border-t border-line pt-5">
        <Typography variant="label">Você no controle</Typography>
        <Typography tone="muted" className="mt-2">O acompanhamento será liberado conforme os vínculos autorizados da sua conta.</Typography>
      </View>
    </Screen>
  );
}
