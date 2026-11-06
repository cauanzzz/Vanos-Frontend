import { createPassengersApi } from '../../services/passengersApi';
import { registerSessionCleanup } from '../../services/sessionCleanup';
import { createTrackingClient } from '../../services/trackingClient';
import { createTrackingConnection } from '../../services/trackingConnection';
import { api, authStore } from '../../store/auth';
import { createPassengersStore } from '../../store/passengers';
import { trackingStore } from '../../store/tracking';
import type { Session } from '../../types/auth';

export const passengersStore = createPassengersStore(createPassengersApi(api));

function createPassengerRuntime(session: Session) {
  let active = true;
  let foreground = true;
  let online = true;
  let client: ReturnType<typeof createTrackingClient> | null = null;
  function updateConnection() {
    if (!active || authStore.getState().session !== session) return;
    const items = passengersStore.getState().items;
    trackingStore.getState().authorize(items.flatMap((item) => item.driverId === null ? [] : [item.driverId]));
    if (items.some((item) => item.driverId !== null) && !client) {
      try {
        client = createTrackingClient({
          connection: createTrackingConnection(process.env.EXPO_PUBLIC_API_URL, () => authStore.getState().session),
          session, getSession: () => authStore.getState().session,
          invalidate: (current) => authStore.getState().invalidate(current),
          onStatus: (status) => { if (active) trackingStore.getState().setStatus(status); },
          onLocation: (value) => { if (active) trackingStore.getState().receive(value); },
          onConnected: () => { if (active) void passengersStore.getState().load(); },
        });
      } catch { trackingStore.getState().setStatus('reconnecting'); }
    }
    const enabled = foreground && online && items.some((item) => item.driverId !== null);
    const pausedStatus = !online ? 'offline' : !foreground ? 'paused' : 'idle';
    if (!enabled) trackingStore.getState().setStatus(pausedStatus);
    client?.setEnabled(enabled, pausedStatus);
  }
  const unsubscribe = passengersStore.subscribe(updateConnection);
  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true; active = false;
    unsubscribe();
    void client?.dispose();
    passengersStore.getState().reset();
    trackingStore.getState().reset();
  }
  const unregister = registerSessionCleanup(cleanup);
  void passengersStore.getState().load();
  return {
    presence(isForeground: boolean, isOnline: boolean) {
      const resumed = (!foreground && isForeground) || (!online && isOnline);
      foreground = isForeground; online = isOnline;
      if (active && resumed) void passengersStore.getState().load();
      updateConnection();
    },
    retry() { void passengersStore.getState().load(); client?.retryNow(); },
    dispose() { unregister(); cleanup(); },
  };
}

let running: { session: Session; instance: ReturnType<typeof createPassengerRuntime>; leases: number } | null = null;

export function startPassengerRuntime() {
  const session = authStore.getState().session;
  if (!session || session.role === 'Driver') return null;
  if (running && running.session !== session) { running.instance.dispose(); running = null; }
  if (!running) running = { session, instance: createPassengerRuntime(session), leases: 0 };
  const entry = running;
  ++entry.leases;
  let released = false;
  return {
    presence: entry.instance.presence,
    retry: entry.instance.retry,
    dispose() {
      if (released) return;
      released = true;
      if (--entry.leases === 0) {
        entry.instance.dispose();
        if (running === entry) running = null;
      }
    },
  };
}
