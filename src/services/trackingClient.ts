import type { Session } from '../types/auth';
import type { ConnectionStatus } from '../types/tracking';

export interface TrackingConnection {
  start(): Promise<void>;
  stop(): Promise<void>;
  on(name: string, handler: (value: unknown) => void): void;
  off(name: string, handler: (value: unknown) => void): void;
  onclose(handler: (error?: Error) => void): void;
}
export function isHubAuthError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error && (error.statusCode === 401 || error.statusCode === 403);
}

export function createTrackingClient(deps: {
  connection: TrackingConnection;
  session: Session;
  getSession(): Session | null;
  invalidate(session: Session): Promise<void>;
  onStatus(status: ConnectionStatus): void;
  onLocation(value: unknown): void;
  onConnected(): void;
  now?: () => number;
  schedule?: (fn: () => void, delay: number) => () => void;
}) {
  const now = deps.now ?? Date.now;
  const schedule = deps.schedule ?? ((fn, delay) => { const timer = setTimeout(fn, delay); return () => clearTimeout(timer); });
  let enabled = false;
  let disposed = false;
  let connected = false;
  let queued = false;
  let generation = 0;
  let attempt = 0;
  let chain = Promise.resolve();
  let cancelRetry: (() => void) | undefined;
  const current = () => !disposed && enabled && deps.getSession() === deps.session;
  const receive = (value: unknown) => { if (current() && connected) deps.onLocation(value); };
  deps.connection.on('LocationUpdated', receive);

  function retry() {
    if (!current() || cancelRetry) return;
    deps.onStatus('reconnecting');
    const delay = [1000, 2000, 5000, 10_000, 30_000][Math.min(attempt++, 4)];
    cancelRetry = schedule(() => { cancelRetry = undefined; connect(); }, delay);
  }
  function connect() {
    if (!current() || queued || connected) return;
    queued = true;
    const version = generation;
    chain = chain.then(async () => {
      queued = false;
      if (!current() || version !== generation) return;
      if (deps.session.expiresAt <= now()) { enabled = false; await deps.invalidate(deps.session); return; }
      deps.onStatus(attempt ? 'reconnecting' : 'connecting');
      try {
        await deps.connection.start();
        if (!current() || version !== generation) { await deps.connection.stop(); return; }
        connected = true;
        cancelRetry?.(); cancelRetry = undefined;
        attempt = 0;
        deps.onStatus('connected');
        deps.onConnected(); // Server reassigns its private group. No client JoinGroup exists.
      } catch (error: unknown) {
        if (!current() || version !== generation) return;
        if (isHubAuthError(error)) {
          cancelRetry?.(); cancelRetry = undefined;
          enabled = false;
          await deps.invalidate(deps.session);
        } else retry();
      }
    }).catch(() => { if (current()) retry(); }).finally(() => {
      if (current() && !connected && !cancelRetry && !queued) connect();
    });
  }
  deps.connection.onclose(() => { connected = false; if (current()) retry(); });

  return {
    setEnabled(value: boolean, reason: ConnectionStatus = 'paused') {
      if (disposed) return;
      if (value === enabled) return;
      enabled = value;
      ++generation;
      cancelRetry?.(); cancelRetry = undefined;
      if (value) { connect(); }
      else {
        connected = false;
        deps.onStatus(reason);
        chain = chain.then(() => deps.connection.stop()).catch(() => undefined);
      }
    },
    retryNow() {
      if (!current() || connected) return;
      cancelRetry?.(); cancelRetry = undefined;
      connect();
    },
    async dispose() {
      if (disposed) return;
      disposed = true; enabled = false; ++generation;
      cancelRetry?.(); cancelRetry = undefined;
      deps.connection.off('LocationUpdated', receive);
      await chain;
      await deps.connection.stop().catch(() => undefined);
    },
  };
}
