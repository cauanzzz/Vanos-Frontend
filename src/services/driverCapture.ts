import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { bindLocationTask, DRIVER_LOCATION_TASK } from '../tasks/locationBridge';
import type { DriverCapture } from '../types/driver';
import { AppError } from './errors';

let generation = 0;
let watcher: Location.LocationSubscription | null = null;
let unbind: (() => void) | null = null;
let queue = Promise.resolve();
function serial(action: () => Promise<void>) {
  const result = queue.then(action);
  queue = result.catch(() => undefined);
  return result;
}
async function stopNative() {
  watcher?.remove(); watcher = null;
  unbind?.(); unbind = null;
  if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
}

export const driverCapture: DriverCapture = {
  start(mode, receive, fail) {
    const epoch = ++generation;
    return serial(async () => {
      await stopNative();
      if (epoch !== generation) return;
      if (!await Location.hasServicesEnabledAsync()) throw new AppError('O GPS está desligado. Ative a localização do aparelho e tente novamente.');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (epoch !== generation) return;
      if (!permission.granted) throw new AppError(permission.canAskAgain
        ? 'Permita a localização para iniciar. Nenhuma posição está sendo compartilhada.'
        : 'A localização foi bloqueada. Abra os ajustes e permita o acesso antes de iniciar.');
      const safeReceive: typeof receive = (value) => { if (epoch === generation) receive(value); };
      const safeFail: typeof fail = (message) => { if (epoch === generation) fail(message); };
      if (mode === 'foreground') {
        watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
          (value) => safeReceive({ latitude: value.coords.latitude, longitude: value.coords.longitude,
            accuracy: value.coords.accuracy ?? Infinity, capturedAt: value.timestamp }),
          () => safeFail('Não foi possível obter o GPS. Confira a localização e as permissões do aparelho.'));
      } else {
        if (!await TaskManager.isAvailableAsync()) throw new AppError('A captura em segundo plano exige um development build instalado.');
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          const notifications = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
          if (epoch !== generation) return;
          if (notifications !== PermissionsAndroid.RESULTS.GRANTED) throw new AppError('Permita notificações nos ajustes para ver a captura ativa. O rastreamento continua somente com o aplicativo aberto.');
        }
        const background = await Location.requestBackgroundPermissionsAsync();
        if (epoch !== generation) return;
        if (!background.granted) throw new AppError('O acesso em segundo plano não foi autorizado. O rastreamento continua somente com o aplicativo aberto.');
        if (AppState.currentState !== 'active') throw new AppError('Volte ao Vanos para ativar a captura em segundo plano.');
        unbind = bindLocationTask({ receive: safeReceive, fail: safeFail });
        await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
          accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5,
          deferredUpdatesInterval: 0, deferredUpdatesDistance: 0,
          activityType: Location.ActivityType.AutomotiveNavigation, pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: { notificationTitle: 'Vanos · captura de localização ativa',
            notificationBody: 'Envio depende da conexão. Abra o Vanos para conferir ou encerrar.', notificationColor: '#235C46', killServiceOnDestroy: true },
        });
      }
      if (epoch !== generation) await stopNative();
    });
  },
  stop() {
    ++generation;
    // Invalidate callbacks immediately, before waiting for an OS permission dialog/start.
    unbind?.(); unbind = null; watcher?.remove(); watcher = null;
    return serial(stopNative);
  },
};
