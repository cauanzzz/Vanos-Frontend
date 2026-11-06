import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { useAuth } from '@/store/auth';

export function AccountScreen() {
  const role = useAuth((state) => state.session?.role);
  const logout = useAuth((state) => state.logout);
  const driver = role === 'Driver';
  return (
    <Screen>
      <Typography className="mb-12 text-[30px] font-bold">vanos.</Typography>
      <Typography variant="caption" tone="forest" className="mb-3 font-semibold tracking-[2px]">{driver ? 'MOTORISTA' : role === 'Parent' ? 'RESPONSÁVEL' : 'ESTUDANTE'}</Typography>
      <Typography variant="display">{driver ? 'Pronto para bons caminhos.' : 'Bom ter você por aqui.'}</Typography>
      <Typography tone="muted" className="mb-8 mt-5">Sua conta está conectada. Este é seu espaço no Vanos.</Typography>
      <Notice title={driver ? 'Sua operação, em breve' : 'Seu acompanhamento, em breve'}>
        {driver ? 'A lista de passageiros e o rastreamento serão disponibilizados na etapa de operação do motorista. Nenhuma localização está sendo coletada.' : 'O mapa e a seleção de passageiros serão disponibilizados na próxima etapa. Nenhuma viagem está sendo exibida neste momento.'}
      </Notice>
      {Platform.OS === 'web' && <Typography variant="caption" tone="muted" className="mt-5">Ao recarregar o navegador, entre novamente. No aplicativo, a sessão é guardada no armazenamento seguro do aparelho.</Typography>}
      <View className="mt-auto pt-10"><Button secondary label="Sair da minha conta" onPress={() => { void logout(); }} /></View>
    </Screen>
  );
}
