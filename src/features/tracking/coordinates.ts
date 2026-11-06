import { isRecord } from '../auth/session';
import type { LocationFix } from '../../types/tracking';

export const STALE_MS = 30_000;
const FUTURE_TOLERANCE_MS = 10_000;

export function parseLocation(value: unknown, now: number): LocationFix | null {
  if (!isRecord(value)) return null;
  const { driverId, latitude, longitude, recordedAtUtc } = value;
  if (typeof driverId !== 'number' || !Number.isSafeInteger(driverId) || driverId <= 0 ||
    typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
    typeof recordedAtUtc !== 'string' || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(recordedAtUtc)) return null;
  const timestamp = Date.parse(recordedAtUtc);
  if (!Number.isFinite(timestamp) || timestamp > now + FUTURE_TOLERANCE_MS || now - timestamp >= STALE_MS) return null;
  return { driverId, latitude, longitude, recordedAtUtc, timestamp, receivedAt: now, snap: false };
}

export function distanceMeters(a: Pick<LocationFix, 'latitude' | 'longitude'>, b: Pick<LocationFix, 'latitude' | 'longitude'>): number {
  const rad = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * rad;
  const lng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function acceptLocation(previous: LocationFix | undefined, next: LocationFix, candidate?: LocationFix): { fix?: LocationFix; candidate?: LocationFix } {
  if (previous && next.timestamp <= previous.timestamp) return { fix: previous, candidate };
  if (!previous || next.timestamp - previous.timestamp >= STALE_MS) return { fix: { ...next, snap: true } };
  // Plausibility filter, not a displayed speed estimate. Allows 150m GPS noise.
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  if (distanceMeters(previous, next) <= 150 + seconds * 45) return { fix: next };
  if (candidate && next.timestamp > candidate.timestamp && distanceMeters(candidate, next) < 100) {
    return { fix: { ...next, snap: true } };
  }
  return { fix: previous, candidate: next };
}

export function motionDuration(fix: LocationFix, now: number, reduceMotion: boolean): number {
  return fix.snap || reduceMotion ? 0 : Math.max(0, Math.min(900, fix.timestamp + STALE_MS - now));
}

export function interpolatePosition(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }, progress: number) {
  const t = Math.min(1, Math.max(0, progress));
  const arc = ((b.longitude - a.longitude + 540) % 360) - 180;
  return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: ((a.longitude + arc * t + 540) % 360) - 180 };
}
