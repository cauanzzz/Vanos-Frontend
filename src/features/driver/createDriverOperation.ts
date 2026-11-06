import { createStore } from 'zustand/vanilla';

import { errorMessage } from '../../services/errors';
import { isHubAuthError } from '../../services/trackingClient';
import type { DriverPublisher } from '../../services/driverPublisher';
import type { Session } from '../../types/auth';
import type { CaptureMode, CapturedPosition, DriverCapture } from '../../types/driver';
import type { ConnectionStatus } from '../../types/tracking';

export const MAX_FIX_AGE_MS = 5000;
export const SEND_INTERVAL_MS = 1500; // Hub requires >= 1 second; no bursts or retries of a fix.
export function usablePosition(value: CapturedPosition, now: number, startedAt: number) {
  return Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180 &&
    Number.isFinite(value.capturedAt) && value.capturedAt >= startedAt && now - value.capturedAt >= -1000 && now - value.capturedAt <= MAX_FIX_AGE_MS &&
    Number.isFinite(value.accuracy) && value.accuracy >= 0 && value.accuracy <= 100;
}
export interface DriverOperationState {
  phase: 'idle' | 'starting' | 'active' | 'stopping' | 'error';
  mode: CaptureMode; connection: ConnectionStatus; startedAt: number | null;
  lastCapturedAt: number | null; lastSentAt: number | null;
  sent: number; discarded: number; busy: boolean; cleanupFailed: boolean; error: string | null;
}
const initial: DriverOperationState = { phase: 'idle', mode: 'foreground', connection: 'idle', startedAt: null,
  lastCapturedAt: null, lastSentAt: null, sent: 0, discarded: 0, busy: false, cleanupFailed: false, error: null };

export function createDriverOperation(deps: {
  capture: DriverCapture; getSession(): Session | null; invalidate(session: Session): Promise<void>;
  publisher(session: Session, onStatus: (status: ConnectionStatus) => void): DriverPublisher;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  const store = createStore<DriverOperationState>(() => ({ ...initial }));
  let run: { session: Session; publisher: DriverPublisher; startedAt: number; version: number } | null = null;
  let version = 0;
  let foreground = true;
  let online = true;
  let stopPending: Promise<void> | null = null;
  let transition: Promise<void> = Promise.resolve();
  let inFlight = false;
  let lastAttempt = -Infinity;
  let lastCapture = -Infinity;
  let captureVersion = 0;
  const current = (entry: NonNullable<typeof run>) => run === entry && version === entry.version && deps.getSession() === entry.session;
  function updatePresence() {
    if (!run) return;
    const enabled = online && (foreground || store.getState().mode === 'background');
    run.publisher.presence(enabled, !online ? 'offline' : 'paused');
  }
  async function receive(entry: NonNullable<typeof run>, value: CapturedPosition) {
    if (!current(entry)) return;
    if (entry.session.expiresAt <= now()) { await deps.invalidate(entry.session); await stop(); return; }
    const state = store.getState();
    const usable = usablePosition(value, now(), entry.startedAt) && value.capturedAt > lastCapture;
    if (usable) { lastCapture = value.capturedAt; store.setState({ lastCapturedAt: value.capturedAt }); }
    if (!usable || !online || (!foreground && state.mode !== 'background') || state.connection !== 'connected' || inFlight || now() - lastAttempt < SEND_INTERVAL_MS) {
      store.setState((s) => ({ discarded: s.discarded + 1 })); return;
    }
    // Single ephemeral slot, consumed immediately. Never persist or replay a GPS sample.
    inFlight = true; lastAttempt = now();
    try {
      const acknowledged = await entry.publisher.publish(value);
      if (current(entry) && acknowledged) store.setState((s) => ({ sent: s.sent + 1, lastSentAt: now(), error: null }));
    } catch (error: unknown) {
      if (!current(entry)) return;
      if (isHubAuthError(error)) { await deps.invalidate(entry.session); await stop(); }
      else {
        store.setState({ error: 'O servidor não confirmou a posição. Ela foi descartada; aguardando um novo sinal de GPS.' });
        // HubException may mean inactive driver/invalid account. Revalidate via HTTP on retry; do not loop this point.
      }
    } finally { if (current(entry)) inFlight = false; }
  }
  async function beginCapture(entry: NonNullable<typeof run>, mode: CaptureMode) {
    const epoch = ++captureVersion;
    await deps.capture.start(mode, (value) => { if (epoch === captureVersion) void receive(entry, value); }, (message, fatal = true) => {
      if (!current(entry) || epoch !== captureVersion) return;
      store.setState({ error: message });
      if (fatal) void stop(true).catch(() => undefined);
    });
    if (!current(entry) || epoch !== captureVersion) await deps.capture.stop();
  }
  function stop(failed = false): Promise<void> {
    if (stopPending) return stopPending;
    const entry = run;
    run = null; ++version; ++captureVersion; inFlight = false;
    store.setState({ phase: 'stopping', busy: true, connection: 'idle', lastCapturedAt: null, lastSentAt: null });
    // Stop is immediate at both boundaries, even if permission/start is still resolving.
    stopPending = (async () => {
      const results = await Promise.allSettled([deps.capture.stop(), entry?.publisher.dispose() ?? Promise.resolve(), transition]);
      const failure = results.slice(0, 2).some((result) => result.status === 'rejected');
      store.setState({ ...initial, cleanupFailed: failure, phase: failure || failed ? 'error' : 'idle', error: failure
        ? 'Não foi possível confirmar a parada do GPS. Tente encerrar novamente antes de continuar.'
        : failed ? store.getState().error : null });
      if (failure) throw new Error('Driver capture cleanup failed');
    })().finally(() => { stopPending = null; });
    return stopPending;
  }
  return {
    store,
    async start() {
      if (run || stopPending || store.getState().cleanupFailed || !['idle', 'error'].includes(store.getState().phase)) return;
      const session = deps.getSession();
      if (!session || session.role !== 'Driver' || session.expiresAt <= now()) return;
      if (!foreground) { store.setState({ error: 'Volte ao aplicativo para iniciar o rastreamento.' }); return; }
      const startedAt = now();
      store.setState({ ...initial, phase: 'starting', busy: true, startedAt });
      lastAttempt = -Infinity; lastCapture = -Infinity;
      const epoch = ++version;
      try {
        const publisher = deps.publisher(session, (connection) => { if (run?.version === epoch) store.setState({ connection }); });
        const entry = { session, publisher, startedAt, version: epoch }; run = entry;
        transition = beginCapture(entry, 'foreground');
        await transition;
        if (!current(entry)) return;
        store.setState({ phase: 'active', busy: false }); updatePresence();
      } catch (error: unknown) {
        if (version !== epoch) return;
        store.setState({ error: errorMessage(error) });
        await stop(true).catch(() => undefined);
      }
    },
    async enableBackground() {
      const entry = run;
      if (!entry || !current(entry) || store.getState().busy || store.getState().mode === 'background' || !foreground) return;
      store.setState({ busy: true, error: null }); ++captureVersion;
      // The capture adapter serializes stop/start and requests background permission only here.
      transition = (async () => {
        try {
          await deps.capture.stop();
          if (!current(entry)) return;
          await beginCapture(entry, 'background');
          if (current(entry)) store.setState({ mode: 'background' });
        } catch (error: unknown) {
          if (!current(entry)) return;
          store.setState({ error: errorMessage(error), mode: 'foreground' });
          try { await beginCapture(entry, 'foreground'); }
          catch { store.setState({ error: 'Não foi possível retomar o GPS. Encerre e tente iniciar novamente.' }); throw error; }
        } finally { if (current(entry)) { store.setState({ busy: false }); updatePresence(); } }
      })();
      try { await transition; } catch { await stop(true).catch(() => undefined); }
    },
    stop,
    presence(active: boolean, connected: boolean) { foreground = active; online = connected; updatePresence(); },
    retry() { run?.publisher.retry(); },
  };
}
