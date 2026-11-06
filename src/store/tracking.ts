import { createStore } from 'zustand/vanilla';

import { acceptLocation, parseLocation, STALE_MS } from '../features/tracking/coordinates';
import type { ConnectionStatus, LocationFix, LocationQuality } from '../types/tracking';

export function createTrackingStore(now = Date.now) {
  return createStore<{
    allowedDrivers: number[];
    fixes: Record<number, LocationFix>;
    candidates: Record<number, LocationFix>;
    status: ConnectionStatus;
    liveSince: number;
    follow: boolean;
    authorize(ids: number[]): void;
    receive(value: unknown): void;
    setStatus(status: ConnectionStatus): void;
    setFollow(value: boolean): void;
    reset(): void;
  }>()((set, get) => ({
    allowedDrivers: [], fixes: {}, candidates: {}, status: 'idle', liveSince: Infinity, follow: true,
    authorize(ids) {
      const allowed = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))];
      set({ allowedDrivers: allowed,
        fixes: Object.fromEntries(Object.entries(get().fixes).filter(([id]) => allowed.includes(Number(id)))),
        candidates: Object.fromEntries(Object.entries(get().candidates).filter(([id]) => allowed.includes(Number(id)))),
      });
    },
    receive(value) {
      if (get().status !== 'connected') return;
      const next = parseLocation(value, now());
      if (!next || !get().allowedDrivers.includes(next.driverId)) return;
      const previous = get().fixes[next.driverId];
      const accepted = acceptLocation(previous, next, get().candidates[next.driverId]);
      const candidates = { ...get().candidates };
      if (accepted.candidate) candidates[next.driverId] = accepted.candidate;
      else delete candidates[next.driverId];
      set({ candidates, fixes: accepted.fix ? { ...get().fixes, [next.driverId]: accepted.fix } : get().fixes });
    },
    setStatus(status) { set({ status, ...(status === 'connected' ? { liveSince: now() } : {}) }); },
    setFollow(follow) { set({ follow }); },
    reset() { set({ allowedDrivers: [], fixes: {}, candidates: {}, status: 'idle', liveSince: Infinity, follow: true }); },
  }));
}
export const trackingStore = createTrackingStore();

export function locationQuality(fix: LocationFix | undefined, status: ConnectionStatus, liveSince: number, now: number): LocationQuality {
  if (!fix) return 'unavailable';
  return status === 'connected' && fix.receivedAt >= liveSince && now - fix.timestamp < STALE_MS ? 'current' : 'stale';
}
