import assert from 'node:assert/strict';
import { test } from 'node:test';

import { driverCapture } from '../src/services/driverCapture.web';

test('web capture surfaces denied permission, removes watch and ignores callbacks from a prior capture', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const callbacks: { receive: PositionCallback; fail?: PositionErrorCallback | null }[] = [];
  const cleared: number[] = []; let received = 0; let failed = 0; const severity: (boolean | undefined)[] = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(receive: PositionCallback, fail?: PositionErrorCallback | null) { callbacks.push({ receive, fail }); return callbacks.length; },
    clearWatch(id: number) { cleared.push(id); },
  } } });
  const point: GeolocationPosition = { timestamp: Date.now(), coords: { latitude: 1, longitude: 2, accuracy: 5,
    altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, toJSON: () => ({}) };
  try {
    await driverCapture.start('foreground', () => { ++received; }, (_, fatal) => { ++failed; severity.push(fatal); });
    callbacks[0].receive(point); assert.equal(received, 1);
    callbacks[0].fail?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); assert.equal(failed, 1);
    callbacks[0].fail?.({ code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    assert.deepEqual(severity, [true, false]);
    await driverCapture.stop(); callbacks[0].receive(point); assert.equal(received, 1);
    await driverCapture.start('foreground', () => { received += 10; }, () => undefined);
    callbacks[0].receive(point); callbacks[1].receive(point); assert.equal(received, 11);
    await driverCapture.stop(); assert.deepEqual(cleared, [1, 2]);
    await assert.rejects(driverCapture.start('background', () => undefined, () => undefined));
  } finally { await driverCapture.stop(); if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); }
});
