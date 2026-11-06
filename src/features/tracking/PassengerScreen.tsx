import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Typography } from '@/components/ui/Typography';
import { useAuth } from '@/store/auth';
import { locationQuality, trackingStore } from '@/store/tracking';
import { colors } from '@/theme/tokens';
import { PassengerDetails } from './PassengerDetails';
import { passengersStore } from './runtime';
import { TrackingMap } from './TrackingMap';
import { usePassengerRuntime } from './usePassengerRuntime';

const statusLabels = { idle: 'Aguardando vínculo', connecting: 'Conectando…', connected: 'Conectado', reconnecting: 'Reconectando…', offline: 'Sem conexão com a rede', paused: 'Acompanhamento pausado' };

export function PassengerScreen() {
  const { now, reduceMotion, retry } = usePassengerRuntime();
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheet = useRef<BottomSheet>(null);
  const [expanded, setExpanded] = useState(fontScale > 1.3);
  const snapPoints = useMemo(() => ['44%', '86%'], []);
  const logout = useAuth((state) => state.logout);
  const items = useStore(passengersStore, (state) => state.items);
  const selectedId = useStore(passengersStore, (state) => state.selectedId);
  const selected = items.find((item) => item.id === selectedId);
  const fix = useStore(trackingStore, (state) => selected?.driverId ? state.fixes[selected.driverId] : undefined);
  const status = useStore(trackingStore, (state) => state.status);
  const liveSince = useStore(trackingStore, (state) => state.liveSince);
  const follow = useStore(trackingStore, (state) => state.follow);
  const quality = locationQuality(fix, status, liveSince, now);
  const qualityLabel = quality === 'current' ? 'Sinal recente · posição recebida' : quality === 'stale' ? 'Última posição · sinal desatualizado' : 'Localização ainda indisponível';
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between gap-3 border-b border-line px-5 py-3">
        <View className="flex-1">
          <Typography variant="caption" tone="forest" className="font-semibold tracking-[2px]">VANOS · ACOMPANHAR</Typography>
          <Typography variant="title">Seu transporte</Typography>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sair da minha conta" className="min-h-12 justify-center px-3" onPress={() => { void logout(); }}>
          <Typography variant="label" tone="forest">Sair</Typography>
        </Pressable>
      </View>
      <View className="flex-1">
        <TrackingMap key={selected?.driverId ?? 'none'} fix={fix} quality={quality} follow={follow} reduceMotion={reduceMotion}
          bottomInset={Math.max(0, (height - insets.top - 84) * (expanded ? 0.86 : 0.44))}
          onPan={() => trackingStore.getState().setFollow(false)} />
        <BottomSheet ref={sheet} index={fontScale > 1.3 ? 1 : 0} snapPoints={snapPoints} enableDynamicSizing={false}
          animateOnMount={!reduceMotion} bottomInset={0} onChange={(index) => setExpanded(index === 1)}
          backgroundStyle={{ backgroundColor: colors.canvas, borderRadius: 28 }} handleIndicatorStyle={{ backgroundColor: colors.muted }}>
          <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <View className="mb-5 gap-2 border-b border-line pb-5">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Typography variant="label" tone="forest" accessibilityLiveRegion="polite">{statusLabels[status]}</Typography>
                <Pressable accessibilityRole="button" className="min-h-12 justify-center py-2" onPress={() => sheet.current?.snapToIndex(expanded ? 0 : 1)}>
                  <Typography variant="caption" tone="forest">{expanded ? 'Ver mais mapa ↓' : 'Ver detalhes ↑'}</Typography>
                </Pressable>
              </View>
              <Typography variant="label">{qualityLabel}</Typography>
              <Typography variant="caption" tone="muted">{fix
                ? `Último sinal às ${new Date(fix.timestamp).toLocaleTimeString('pt-BR')} · há ${Math.max(0, Math.floor((now - fix.timestamp) / 1000))} s`
                : selected?.driverId ? 'Aguardando uma nova posição enviada pelo motorista.' : 'O acompanhamento depende do vínculo com um motorista.'}</Typography>
              <View className="flex-row flex-wrap gap-x-5">
                {fix && <Pressable accessibilityRole="button" accessibilityState={{ selected: follow }} className="min-h-12 justify-center" onPress={() => trackingStore.getState().setFollow(true)}>
                  <Typography variant="label" tone="forest">{follow ? 'Acompanhando a van' : 'Acompanhar a van'}</Typography>
                </Pressable>}
                {(status === 'reconnecting' || status === 'offline') && <Pressable accessibilityRole="button" className="min-h-12 justify-center" onPress={retry}><Typography variant="label" tone="forest">Tentar conectar</Typography></Pressable>}
              </View>
            </View>
            <PassengerDetails />
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    </SafeAreaView>
  );
}
