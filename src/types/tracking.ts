export interface Passenger {
  id: number;
  fullName: string;
  schoolId: number;
  driverId: number | null;
  isGoingToday: boolean;
  isReturningToday: boolean;
}

// LocationUpdated, JSON protocol default (camelCase). No heading, speed or ETA.
export interface LocationFix {
  driverId: number;
  latitude: number;
  longitude: number;
  recordedAtUtc: string;
  timestamp: number;
  receivedAt: number;
  snap: boolean;
}
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'paused';
export type LocationQuality = 'unavailable' | 'stale' | 'current';
