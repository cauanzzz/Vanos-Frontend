import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Typography } from '@/components/ui/Typography';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme/tokens';
import type { Role } from '@/types/roles';
import type { Passenger } from '@/types/tracking';
import { passengersStore } from './runtime';

export function PassengerDetails() {
  const items = useStore(passengersStore, (state) => state.items);
  const selectedId = useStore(passengersStore, (state) => state.selectedId);
  const phase = useStore(passengersStore, (state) => state.phase);
  const refreshing = useStore(passengersStore, (state) => state.refreshing);
  const saving = useStore(passengersStore, (state) => state.saving);
  const error = useStore(passengersStore, (state) => state.error);
  const notice = useStore(passengersStore, (state) => state.notice);
  const role = useAuth((state) => state.session?.role);
  const passenger = items.find((item) => item.id === selectedId);

  if ((phase === 'idle' || phase === 'loading') && items.length === 0) return (
    <View accessibilityLabel="Carregando passageiros" accessibilityState={{ busy: true }} className="gap-3 py-5">
      <View className="h-6 w-40 rounded bg-line" /><View className="h-5 w-60 rounded bg-line" />
      <View className="h-24 rounded-2xl bg-sage" />
    </View>
  );
  if (!passenger) return (
    <View className="gap-4 py-4">
      <Typography variant="title">{error ? 'Não foi possível carregar' : 'Seu caminho começa com um vínculo'}</Typography>
      <Typography tone="muted">{error ?? (role === 'Parent'
        ? 'Nenhum passageiro foi cadastrado nesta conta. O acompanhamento estará disponível após cadastrar o passageiro e vinculá-lo a um motorista.'
        : 'Sua conta ainda não tem um perfil de passageiro cadastrado. O acompanhamento depende desse perfil e do vínculo com um motorista.')}</Typography>
      <Button secondary label="Atualizar passageiros" loading={refreshing} onPress={() => { void passengersStore.getState().load(); }} />
    </View>
  );
  return <PassengerForm key={`${passenger.id}:${passenger.isGoingToday}:${passenger.isReturningToday}`}
    {...{ passenger, items, selectedId, refreshing, saving, error, notice, role }} />;
}

function PassengerForm({ passenger, items, selectedId, refreshing, saving, error, notice, role }: {
  passenger: Passenger; items: Passenger[]; selectedId: number | null; refreshing: boolean;
  saving: boolean; error: string | null; notice: string | null; role: Role | undefined;
}) {
  const [choices, setChoices] = useState(false);
  const [going, setGoing] = useState(passenger.isGoingToday);
  const [returning, setReturning] = useState(passenger.isReturningToday);
  const [confirmAbsence, setConfirmAbsence] = useState(false);
  return (
    <View className="gap-5 pb-8">
      <View>
        <Typography variant="caption" tone="muted">{role === 'Parent' ? 'QUEM VOCÊ ACOMPANHA' : 'PERFIL DE PASSAGEIRO'}</Typography>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: choices }} onPress={() => setChoices(!choices)} className="min-h-12 justify-center py-2">
          <Typography variant="title">{passenger.fullName || 'Passageiro sem nome'} {items.length > 1 ? '⌄' : ''}</Typography>
        </Pressable>
        {choices && items.length > 1 && <View accessibilityRole="radiogroup" className="mt-2 gap-2">
          {items.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === selectedId, disabled: saving }} disabled={saving}
            onPress={() => { passengersStore.getState().select(item.id); setChoices(false); }} className={`min-h-12 rounded-xl border p-3 ${item.id === selectedId ? 'border-forest bg-sage' : 'border-line'}`}>
            <Typography>{item.fullName || 'Passageiro sem nome'}</Typography>
          </Pressable>)}
        </View>}
        <Typography tone="muted">{passenger.driverId ? 'Transporte vinculado à sua conta.' : 'Este passageiro ainda não tem motorista vinculado.'}</Typography>
      </View>
      <View className="border-t border-line pt-5">
        <Typography variant="label">Ida e volta</Typography>
        <Typography variant="caption" tone="muted" className="mb-3 mt-1">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</Typography>
        <View className="min-h-14 flex-row items-center justify-between gap-3">
          <Typography className="flex-1">Vou na ida</Typography>
          <Switch accessibilityLabel="Vou na ida" value={going} onValueChange={setGoing} disabled={saving} trackColor={{ true: colors.forest, false: colors.line }} />
        </View>
        <View className="min-h-14 flex-row items-center justify-between gap-3">
          <Typography className="flex-1">Vou na volta</Typography>
          <Switch accessibilityLabel="Vou na volta" value={returning} onValueChange={setReturning} disabled={saving} trackColor={{ true: colors.forest, false: colors.line }} />
        </View>
        <Typography variant="caption" tone="muted" className="my-3">Estas preferências permanecem até você alterá-las. Não há retorno automático no dia seguinte.</Typography>
        <Button label="Salvar ida e volta" loading={saving} disabled={refreshing || (going === passenger.isGoingToday && returning === passenger.isReturningToday)}
          onPress={() => { void passengersStore.getState().updateStatus(going, returning); }} />
      </View>
      {error && <View accessibilityRole="alert" className="rounded-xl bg-warning p-4"><Typography>{error}</Typography></View>}
      {notice && <View accessibilityLiveRegion="polite" className="rounded-xl bg-sage p-4"><Typography>{notice}</Typography></View>}
      {confirmAbsence ? (
        <View className="gap-3 rounded-2xl border border-line p-4">
          <Typography variant="label">Confirmar ausência?</Typography>
          <Typography tone="muted">A ida e a volta de {passenger.fullName || 'este passageiro'} serão desmarcadas. Você precisará marcá-las novamente quando voltar a usar o transporte.</Typography>
          <Button label="Confirmar ausência" loading={saving} disabled={refreshing} onPress={() => {
            void passengersStore.getState().updateStatus(false, false).then(() => setConfirmAbsence(false));
          }} />
          <Button secondary label="Voltar" disabled={saving} onPress={() => setConfirmAbsence(false)} />
        </View>
      ) : <Button secondary label="Não vou hoje" disabled={saving || refreshing || (!passenger.isGoingToday && !passenger.isReturningToday)} onPress={() => setConfirmAbsence(true)} />}
      <Button secondary label="Atualizar passageiros" loading={refreshing} disabled={saving} onPress={() => { void passengersStore.getState().load(); }} />
    </View>
  );
}
