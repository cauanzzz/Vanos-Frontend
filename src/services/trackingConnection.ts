import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

import type { Session } from '../types/auth';
import { normalizeApiOrigin } from './http';

export function createTrackingConnection(origin: string | undefined, getSession: () => Session | null) {
  return new HubConnectionBuilder()
    .withUrl(`${normalizeApiOrigin(origin)}/hubs/tracking`, {
      accessTokenFactory: () => getSession()?.token ?? '',
      withCredentials: false,
      timeout: 15_000,
    })
    .configureLogging(LogLevel.None)
    .build();
}
