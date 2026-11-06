import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Typography } from '@/components/ui/Typography';
import { colors } from '@/theme/tokens';
import { motionDuration } from './coordinates';
import type { TrackingMapProps } from './map.types';

// Library's static Marker.Animated declaration uses an outdated RN generic.
// Construct the same supported RN Animated wrapper with RN 0.88's inferred props.
const AnimatedMarker = Animated.createAnimatedComponent(Marker);

function NativeMap({ fix, quality, follow, reduceMotion, onPan, bottomInset }: TrackingMapProps & { fix: NonNullable<TrackingMapProps['fix']> }) {
  const map = useRef<MapView>(null);
  const [coordinate] = useState(() => ({ latitude: new Animated.Value(fix.latitude), longitude: new Animated.Value(fix.longitude) }));
  const previous = useRef(fix);
  useEffect(() => {
    coordinate.latitude.stopAnimation(); coordinate.longitude.stopAnimation();
    const duration = quality === 'current' && Math.abs(previous.current.longitude - fix.longitude) < 180 ? motionDuration(fix, Date.now(), reduceMotion) : 0;
    const animation = Animated.parallel([
      Animated.timing(coordinate.latitude, { toValue: fix.latitude, duration, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(coordinate.longitude, { toValue: fix.longitude, duration, easing: Easing.linear, useNativeDriver: false }),
    ]);
    animation.start();
    previous.current = fix;
    return () => animation.stop();
  }, [coordinate, fix, quality, reduceMotion]);
  useEffect(() => {
    if (follow) map.current?.animateToRegion({ latitude: fix.latitude, longitude: fix.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, reduceMotion ? 0 : 450);
  }, [fix, follow, reduceMotion]);
  return (
    <MapView ref={map} style={{ flex: 1 }} initialRegion={{ latitude: fix.latitude, longitude: fix.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
      mapPadding={{ top: 0, left: 0, right: 0, bottom: bottomInset }}
      onPanDrag={onPan} showsUserLocation={false} showsMyLocationButton={false} toolbarEnabled={false}>
      <AnimatedMarker coordinate={coordinate} title={quality === 'current' ? 'Transporte vinculado' : 'Última posição recebida'}
        pinColor={quality === 'current' ? colors.forest : colors.amber} tracksViewChanges={false} />
    </MapView>
  );
}

export function TrackingMap(props: TrackingMapProps) {
  const configured = Platform.OS !== 'android' || Constants.expoConfig?.extra?.mapsAndroidConfigured === true;
  if (!props.fix || !configured) return (
    <View className="flex-1 items-center justify-center gap-3 bg-sage px-8 pb-16">
      <View className="mb-2 h-5 w-5 rounded-full border-4 border-forest" />
      <Typography variant="title" className="text-center">{configured ? 'Aguardando seu transporte' : 'Mapa indisponível neste ambiente'}</Typography>
      <Typography tone="muted" className="max-w-sm text-center">{configured ? 'O mapa aparece assim que o motorista enviar uma posição autorizada.' : 'O acompanhamento e o horário do sinal continuam disponíveis abaixo.'}</Typography>
    </View>
  );
  return <NativeMap key={props.fix.driverId} {...props} fix={props.fix} />;
}
