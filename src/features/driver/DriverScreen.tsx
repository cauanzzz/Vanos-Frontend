import { useState } from 'react';
import { FlatList, Linking, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Typography } from '@/components/ui/Typography';
import { useAuth } from '@/store/auth';
import { driverOperation, driverRoster, loadDriverRoster } from './runtime';
import { useDriverRuntime } from './useDriverRuntime';

const connectionLabels = { idle: 'Aguardando início', connecting: 'Conectando ao serviço…', connected: 'Conectado ao serviço', reconnecting: 'Reconectando ao serviço…', offline: 'Sem rede · envio interrompido', paused: 'Envio pausado · volte ao aplicativo' };
export function DriverScreen() {
  const now = useDriverRuntime();
  const operation = useStore(driverOperation.store);
  const roster = useStore(driverRoster);
  const logout = useAuth((state) => state.logout);
  const [confirmStop, setConfirmStop] = useState(false);
  const [explainBackground, setExplainBackground] = useState(false);
  const active = operation.phase === 'active' || operation.phase === 'starting';
  const recent = operation.lastSentAt !== null && now - operation.lastSentAt < 30_000;
  const time = (value: number | null) => value === null ? 'Aguardando sinal' : new Date(value).toLocaleTimeString('pt-BR');
  return <SafeAreaView className="flex-1 bg-canvas">
    <FlatList data={roster.data?.passengers ?? []} keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      ListHeaderComponent={<>
        <View className="mb-8 flex-row items-center justify-between gap-3">
          <Typography className="text-[30px] font-bold">vanos.</Typography>
          <Pressable accessibilityRole="button" className="min-h-12 justify-center px-3" onPress={() => { void logout(); }}><Typography tone="forest" variant="label">Sair da conta</Typography></Pressable>
        </View>
        <Typography variant="caption" tone="forest" className="mb-3 font-semibold tracking-[2px]">MOTORISTA · SUA OPERAÇÃO</Typography>
        <Typography variant="display">{active ? 'Você está no comando.' : 'Tudo pronto para sair?'}</Typography>
        <Typography tone="muted" className="mb-6 mt-4">{roster.data ? `${roster.data.driver.fullname} · ${roster.data.driver.licensePlate}` : 'Confira seus passageiros antes de compartilhar a localização.'}</Typography>
        <View className="mb-6 gap-4 rounded-3xl bg-sage p-5">
          <Typography variant="title" accessibilityLiveRegion="polite">{operation.cleanupFailed ? 'Parada do GPS a confirmar' : operation.phase === 'stopping' ? 'Encerrando captura…' : active ? 'Rastreamento ativo · sessão local' : 'Rastreamento encerrado'}</Typography>
          <Typography tone="muted">{active ? 'Esta sessão existe neste aparelho. O servidor não registra início ou fim de viagem.' : 'Toque em iniciar para permitir o GPS e compartilhar novos sinais com as contas vinculadas.'}</Typography>
          {active && <>
            <Typography variant="label" tone="forest">{connectionLabels[operation.connection]}</Typography>
            <Typography variant="caption">Captura: {time(operation.lastCapturedAt)}{operation.lastCapturedAt ? ` · há ${Math.max(0, Math.floor((now - operation.lastCapturedAt) / 1000))} s` : ''}</Typography>
            <Typography variant="caption">Última publicação confirmada: {time(operation.lastSentAt)}{operation.lastSentAt ? recent ? '' : ' · sinal desatualizado' : ''}</Typography>
            <Typography variant="caption" tone="muted">{operation.sent} publicações aceitas pelo serviço · {operation.discarded} sinais descartados. Aceite não confirma a leitura no mapa.</Typography>
            <Typography variant="caption">{operation.mode === 'background' ? 'Captura em segundo plano habilitada. Envio depende de o sistema manter o SignalR executando.' : 'Captura somente com o aplicativo aberto.'}</Typography>
          </>}
          {operation.error && <Notice title="Confira o rastreamento">{operation.error}</Notice>}
          {operation.cleanupFailed ? <Button label="Tentar encerrar captura" onPress={() => { void driverOperation.stop().catch(() => undefined); }} /> : !active && <Button label="Iniciar rastreamento" loading={operation.busy} disabled={!roster.data?.driver.isActive || roster.loading || Boolean(roster.error)} onPress={() => { setConfirmStop(false); setExplainBackground(false); void driverOperation.start(); }} />}
          {active && !confirmStop && <Button secondary label="Encerrar rastreamento" onPress={() => setConfirmStop(true)} />}
          {active && confirmStop && <View className="gap-3"><Typography variant="label">Encerrar a captura e o envio neste aparelho?</Typography><Button label="Confirmar encerramento" onPress={() => { setConfirmStop(false); setExplainBackground(false); void driverOperation.stop().catch(() => undefined); }} /><Button secondary label="Continuar rastreamento" onPress={() => setConfirmStop(false)} /></View>}
          {active && operation.mode === 'foreground' && Platform.OS !== 'web' && !explainBackground && <Button secondary label="Capturar com a tela bloqueada" disabled={operation.busy} onPress={() => setExplainBackground(true)} />}
          {active && explainBackground && operation.mode === 'foreground' && <View className="gap-3">
            <Typography>O Vanos solicitará localização em segundo plano e, no Android 13 ou superior, notificações da captura. Escolha “Permitir o tempo todo” para localização nos ajustes. A notificação indica captura ativa. O sistema pode suspender o envio; a API atual oferece apenas SignalR.</Typography>
            <Button label="Permitir captura em segundo plano" loading={operation.busy} onPress={() => { void driverOperation.enableBackground().finally(() => setExplainBackground(false)); }} />
            <Button secondary label="Agora não" onPress={() => setExplainBackground(false)} />
          </View>}
          {operation.error && Platform.OS !== 'web' && <Button secondary label="Abrir ajustes de permissões" onPress={() => { void Linking.openSettings().catch(() => undefined); }} />}
          {active && (operation.connection === 'reconnecting' || operation.connection === 'offline') && <Button secondary label="Tentar reconectar" onPress={() => { void loadDriverRoster(); driverOperation.retry(); }} />}
        </View>
        {Platform.OS === 'web' && <Notice title="Validação no navegador">Localização depende da permissão do navegador, com a página aberta. Segundo plano exige o development build no aparelho.</Notice>}
        {roster.data && !roster.data.driver.isActive && <Notice title="Cadastro inativo">Seu cadastro não está ativo. O servidor não autoriza publicar posições.</Notice>}
        <View className="mb-4 mt-8 flex-row items-center justify-between gap-3"><Typography variant="title">Passageiros vinculados</Typography><Pressable accessibilityRole="button" className="min-h-12 justify-center" onPress={() => { void loadDriverRoster(); }} disabled={roster.loading}><Typography variant="label" tone="forest">{roster.loading ? 'Atualizando…' : 'Atualizar'}</Typography></Pressable></View>
        <Typography tone="muted" variant="caption" className="mb-5">Ida e volta refletem preferências do passageiro, sem reinício diário automático. Embarque, desembarque, rota e turno aguardam suporte no servidor.</Typography>
        {roster.error && <Notice title="Não foi possível atualizar">{`${roster.error} Toque em Atualizar para tentar novamente.`}</Notice>}
      </>}
      ListEmptyComponent={roster.loading ? <View className="gap-3 py-3" accessibilityLabel="Carregando passageiros"><View className="h-20 rounded-2xl bg-sage" /><View className="h-20 rounded-2xl bg-sage" /></View> : !roster.error ? <Notice title="Nenhum passageiro vinculado">Os passageiros aparecem após o vínculo ser aceito pelo serviço. Nenhum ponto será recebido por contas sem vínculo.</Notice> : undefined}
      renderItem={({ item }) => <View className="gap-2 border-b border-line py-5"><Typography variant="label">{item.fullName}</Typography><Typography variant="caption" tone="muted">Ida: {item.isGoingToday ? 'vai' : 'não vai'} · Volta: {item.isReturningToday ? 'retorna' : 'não retorna'}</Typography></View>} />
  </SafeAreaView>;
}
