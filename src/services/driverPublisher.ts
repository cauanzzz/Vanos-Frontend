import type { Session } from '../types/auth';
import type { CapturedPosition } from '../types/driver';
import type { ConnectionStatus } from '../types/tracking';
import { createTrackingClient, type TrackingConnection } from './trackingClient';

export interface PublishingConnection extends TrackingConnection { invoke(method: string, ...args: number[]): Promise<unknown> }
export interface DriverPublisher {
  presence(enabled: boolean, reason?: ConnectionStatus): void;
  publish(position: CapturedPosition): Promise<boolean>;
  retry(): void;
  dispose(): Promise<void>;
}

export function createDriverPublisher(deps: {
  connection: PublishingConnection; session: Session; getSession(): Session | null;
  invalidate(session: Session): Promise<void>; onStatus(status: ConnectionStatus): void;
}): DriverPublisher {
  let open = true;
  let connected = false;
  const client = createTrackingClient({ ...deps, onLocation: () => undefined, onConnected: () => undefined,
    onStatus(status) { connected = status === 'connected'; if (open) deps.onStatus(status); },
  });
  return {
    presence(value, reason) { if (open) client.setEnabled(value, reason); },
    retry() { if (open) client.retryNow(); },
    async publish(position) {
      if (!open || !connected || deps.getSession() !== deps.session || deps.session.expiresAt <= Date.now()) return false;
      // No client timestamp is accepted by this backend. Only fresh fixes may reach this boundary.
      await deps.connection.invoke('UpdateLocation', position.latitude, position.longitude);
      return open && deps.getSession() === deps.session;
    },
    async dispose() {
      open = false; connected = false;
      // Interrupt an invocation/start already in flight; a server-accepted point cannot be recalled.
      const stop = deps.connection.stop().catch(() => undefined);
      await Promise.all([stop, client.dispose()]);
    },
  };
}
