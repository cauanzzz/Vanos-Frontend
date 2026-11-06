import type { DriverCapture } from '../types/driver';
import { AppError } from './errors';

let epoch = 0;
let watcher: number | null = null;
function clearWatch() {
  if (watcher !== null) navigator.geolocation.clearWatch(watcher);
  watcher = null;
}
export const driverCapture: DriverCapture = {
  async start(mode, receive, fail) {
    const version = ++epoch;
    clearWatch();
    if (mode === 'background') throw new AppError('O navegador captura somente com a página aberta. Use o development build para testar segundo plano.');
    if (!globalThis.navigator?.geolocation) throw new AppError('Este navegador não oferece localização. Use localhost ou HTTPS em um navegador compatível.');
    // SDK 58 ExpoLocation.web ignores watchPosition's error callback. Use the browser API here so denial/timeout is visible.
    const subscription = navigator.geolocation.watchPosition(
      (value) => { if (version === epoch) receive({ latitude: value.coords.latitude, longitude: value.coords.longitude,
        accuracy: value.coords.accuracy ?? Infinity, capturedAt: value.timestamp }); },
      (error) => {
        if (version !== epoch) return;
        if (error.code === 1) fail('Não foi possível obter a localização. Permita o acesso no navegador e confira o GPS.', true);
        else fail('O navegador está sem um sinal de GPS válido. Aguardando nova captura; confira a localização do aparelho.', false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    if (version !== epoch) navigator.geolocation.clearWatch(subscription); else watcher = subscription;
  },
  async stop() { ++epoch; clearWatch(); },
};
