import './map.web.css';

import type * as Leaflet from 'leaflet';
import { createElement, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Typography } from '@/components/ui/Typography';
import { interpolatePosition, motionDuration } from './coordinates';
import type { TrackingMapProps } from './map.types';

export function TrackingMap({ fix, quality, follow, reduceMotion, onPan }: TrackingMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.CircleMarker | null>(null);
  const frame = useRef<number | null>(null);
  const pan = useRef(onPan);
  useEffect(() => { pan.current = onPan; }, [onPan]);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    void import('leaflet').then((L) => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current, { zoomControl: false, attributionControl: true });
      map.current = instance;
      instance.attributionControl.setPosition('topright');
      L.control.zoom({ position: 'topright' }).addTo(instance);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on('tileerror', () => { if (!disposed) setTileError(true); }).on('tileload', () => { if (!disposed) setTileError(false); }).addTo(instance);
      instance.on('dragstart', () => pan.current());
      marker.current = L.circleMarker([0, 0], { radius: 10, color: '#FFFFFF', weight: 3, fillColor: '#235C46', fillOpacity: 1 });
      resize = new ResizeObserver(() => instance.invalidateSize());
      resize.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setTileError(true); });
    return () => {
      disposed = true; resize?.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      map.current?.remove(); map.current = null; marker.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !marker.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const pin = marker.current;
    if (!fix) { pin.remove(); return; }
    const initial = !map.current.hasLayer(pin);
    if (initial) { pin.setLatLng([fix.latitude, fix.longitude]).addTo(map.current); map.current.setView([fix.latitude, fix.longitude], 16); }
    pin.setStyle({ fillColor: quality === 'current' ? '#235C46' : '#795414' });
    const from = pin.getLatLng();
    const duration = quality === 'current' && !initial ? motionDuration(fix, Date.now(), reduceMotion) : 0;
    const start = performance.now();
    const animate = (time: number) => {
      const progress = duration ? Math.min(1, (time - start) / duration) : 1;
      const position = interpolatePosition({ latitude: from.lat, longitude: from.lng }, fix, progress);
      pin.setLatLng([position.latitude, position.longitude]);
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    if (follow) map.current.panTo([fix.latitude, fix.longitude], { animate: !reduceMotion, duration: 0.45 });
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [fix, follow, quality, ready, reduceMotion]);
  return (
    <View style={{ flex: 1, minHeight: 240, overflow: 'hidden', zIndex: 0 }}>
      {createElement('div', { ref: container, role: 'region', 'aria-label': 'Mapa do transporte vinculado', style: { height: '100%', width: '100%', position: 'absolute', inset: 0, zIndex: 0 } })}
      {!fix && <View className="absolute inset-0 items-center justify-center gap-3 bg-sage px-8">
        <Typography variant="title" className="text-center">Aguardando seu transporte</Typography>
        <Typography tone="muted" className="max-w-sm text-center">O mapa aparece assim que o motorista enviar uma posição autorizada.</Typography>
      </View>}
      {tileError && <View className="absolute left-3 right-3 top-3 rounded-xl bg-warning p-3"><Typography variant="caption">A base do mapa não carregou. Verifique sua conexão.</Typography></View>}
    </View>
  );
}
