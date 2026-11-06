import assert from 'node:assert/strict';
import { test } from 'node:test';

import { acceptLocation, interpolatePosition, motionDuration, parseLocation, STALE_MS } from '../src/features/tracking/coordinates';
import { createTrackingStore, locationQuality } from '../src/store/tracking';

const now = Date.UTC(2026, 9, 26, 12);
const packet = (overrides: Record<string, unknown> = {}) => ({ driverId: 10, latitude: -23.55, longitude: -46.63, recordedAtUtc: new Date(now).toISOString(), ...overrides });

test('accepts actual camelCase event and rejects malformed, stale, future and invalid coordinates', () => {
  assert.ok(parseLocation(packet(), now));
  for (const value of [null, {}, packet({ driverId: -1 }), packet({ latitude: NaN }), packet({ longitude: Infinity }),
    packet({ latitude: 91 }), packet({ longitude: -181 }), packet({ recordedAtUtc: 'yesterday' }),
    packet({ recordedAtUtc: new Date(now - STALE_MS).toISOString() }), packet({ recordedAtUtc: new Date(now + 10_001).toISOString() })]) {
    assert.equal(parseLocation(value, now), null);
  }
  assert.ok(parseLocation(packet({ latitude: 0, longitude: 0 }), now));
});

test('out-of-order and duplicate timestamps never replace the accepted position', () => {
  const previous = parseLocation(packet(), now)!;
  const older = parseLocation(packet({ latitude: -23.551, recordedAtUtc: new Date(now - 1000).toISOString() }), now)!;
  assert.equal(acceptLocation(previous, older).fix, previous);
  assert.equal(acceptLocation(previous, { ...previous, latitude: 50 }).fix, previous);
});

test('quarantines a GPS jump and rebases only after a coherent second point or a stale gap', () => {
  const previous = parseLocation(packet(), now)!;
  const outlier = parseLocation(packet({ latitude: -22, recordedAtUtc: new Date(now + 1000).toISOString() }), now + 1000)!;
  const first = acceptLocation(previous, outlier);
  assert.equal(first.fix, previous);
  assert.equal(first.candidate, outlier);
  const next = { ...outlier, latitude: -22.00001, timestamp: now + 2000 };
  assert.equal(acceptLocation(previous, next, outlier).fix?.snap, true);
  assert.equal(acceptLocation(previous, { ...outlier, timestamp: now + STALE_MS }).fix?.snap, true);
  const normal = { ...previous, latitude: -23.5501, timestamp: now + 1000 };
  assert.equal(acceptLocation(previous, normal).candidate, undefined);
});

test('tracking accepts only assigned drivers, clears removed assignments and resets all private state', () => {
  const store = createTrackingStore(() => now);
  store.getState().authorize([10, 10, -1]);
  store.getState().setStatus('connected');
  store.getState().receive(packet({ driverId: 11 }));
  assert.deepEqual(store.getState().fixes, {});
  store.getState().receive(packet());
  assert.equal(store.getState().fixes[10].driverId, 10);
  store.getState().authorize([]);
  assert.deepEqual(store.getState().fixes, {});
  store.getState().setFollow(false);
  store.getState().reset();
  assert.equal(store.getState().follow, true);
  assert.deepEqual(store.getState().allowedDrivers, []);
});

test('stale, offline and reconnected-without-new-data positions cannot look current', () => {
  const fix = parseLocation(packet(), now)!;
  assert.equal(locationQuality(undefined, 'connected', now, now), 'unavailable');
  assert.equal(locationQuality(fix, 'connected', now, now), 'current');
  assert.equal(locationQuality(fix, 'connected', now, now + STALE_MS), 'stale');
  assert.equal(locationQuality(fix, 'offline', now, now), 'stale');
  assert.equal(locationQuality(fix, 'connected', now + 1, now + 1), 'stale');
});

test('animation is finite, respects reduced motion and expiry, and uses shortest longitude arc', () => {
  const fix = parseLocation(packet(), now)!;
  assert.equal(motionDuration(fix, now, false), 900);
  assert.equal(motionDuration(fix, now + STALE_MS - 100, false), 100);
  assert.equal(motionDuration(fix, now + STALE_MS, false), 0);
  assert.equal(motionDuration(fix, now, true), 0);
  assert.equal(motionDuration({ ...fix, snap: true }, now, false), 0);
  assert.equal(Math.abs(interpolatePosition({ latitude: 0, longitude: 179 }, { latitude: 2, longitude: -179 }, 0.5).longitude), 180);
});
