import { createStore } from 'zustand/vanilla';

import { driverCapture } from '../../services/driverCapture';
import { createDriverApi } from '../../services/driverApi';
import { createDriverPublisher } from '../../services/driverPublisher';
import { errorMessage } from '../../services/errors';
import { registerSessionCleanup } from '../../services/sessionCleanup';
import { createTrackingConnection } from '../../services/trackingConnection';
import { api, authStore } from '../../store/auth';
import type { DriverRoster } from '../../types/driver';
import { createDriverOperation } from './createDriverOperation';

export const driverOperation = createDriverOperation({
  capture: driverCapture, getSession: () => authStore.getState().session,
  invalidate: (session) => authStore.getState().invalidate(session),
  publisher: (session, onStatus) => createDriverPublisher({
    connection: createTrackingConnection(process.env.EXPO_PUBLIC_API_URL, () => authStore.getState().session === session ? session : null),
    session, getSession: () => authStore.getState().session,
    invalidate: (current) => authStore.getState().invalidate(current), onStatus,
  }),
});
export const driverRoster = createStore<{ data: DriverRoster | null; loading: boolean; error: string | null }>(() => ({ data: null, loading: false, error: null }));
const driverApi = createDriverApi(api);
let revision = 0;
let pending: Promise<void> | null = null;
export function loadDriverRoster() {
  if (pending) return pending;
  const session = authStore.getState().session;
  if (session?.role !== 'Driver') return Promise.resolve();
  const version = revision;
  driverRoster.setState({ loading: true, error: null });
  pending = driverApi.roster().then((data) => {
    if (revision !== version || authStore.getState().session !== session) return;
    driverRoster.setState({ data });
    if (!data.driver.isActive) void driverOperation.stop().catch(() => undefined);
  }).catch((error: unknown) => { if (revision === version && authStore.getState().session === session) driverRoster.setState({ error: errorMessage(error) }); })
    .finally(() => { if (revision === version) { pending = null; driverRoster.setState({ loading: false }); } });
  return pending;
}
registerSessionCleanup(() => {
  ++revision; pending = null;
  driverRoster.setState({ data: null, loading: false, error: null });
  return driverOperation.stop();
});

// Called before session restoration. Tracking is deliberately never restored after a process restart.
export function stopOrphanedDriverCapture() { return driverCapture.stop(); }
