import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError, create } from 'axios';

import { createDriverOperation, usablePosition } from '../src/features/driver/createDriverOperation';
import { createDriverApi } from '../src/services/driverApi';
import type { DriverPublisher } from '../src/services/driverPublisher';
import { bindLocationTask, deliverTaskLocations } from '../src/tasks/locationBridge';
import type { Session } from '../src/types/auth';
import type { CapturedPosition, DriverCapture } from '../src/types/driver';
import type { ConnectionStatus } from '../src/types/tracking';

const flush = async () => { for (let i = 0; i < 15; ++i) await Promise.resolve(); };
function deferred() { let resolve!: () => void; const promise = new Promise<void>((yes) => { resolve = yes; }); return { resolve, promise }; }
function fixture() {
  let time = 100_000;
  let session: Session | null = { token: 'unit-only', role: 'Driver', expiresAt: time + 3_600_000 };
  let receive: ((value: CapturedPosition) => void) | null = null;
  let oldReceive: ((value: CapturedPosition) => void) | null = null;
  let failCapture: ((message: string, fatal?: boolean) => void) | null = null;
  let captureGate: Promise<void> | null = null;
  let denied = false;
  let failedStop = false;
  let publishGate: Promise<void> | null = null;
  let publishError: unknown;
  let starts = 0, stops = 0, disposed = 0, invalidations = 0;
  const callbacks: ((value: CapturedPosition) => void)[] = [];
  const calls: CapturedPosition[] = [];
  let onStatus: (value: ConnectionStatus) => void = () => undefined;
  const capture: DriverCapture = {
    async start(mode, callback, fail) { ++starts; callbacks.push(callback); receive = callback; oldReceive = callback; failCapture = fail; if (captureGate) await captureGate; if (denied && mode === 'background') throw new Error('denied'); },
    async stop() { ++stops; receive = null; if (failedStop) throw new Error('OS stop failed'); },
  };
  const publisher: DriverPublisher = {
    presence(enabled, reason) { onStatus(enabled ? 'connected' : reason ?? 'paused'); },
    async publish(value) { calls.push(value); if (publishGate) await publishGate; if (publishError) throw publishError; return true; },
    retry() { onStatus('connected'); }, async dispose() { ++disposed; },
  };
  const op = createDriverOperation({ capture, now: () => time, getSession: () => session,
    invalidate: async () => { ++invalidations; session = null; }, publisher: (_, callback) => { onStatus = callback; return publisher; } });
  const position = (offset = 0): CapturedPosition => ({ latitude: -23.55, longitude: -46.63, accuracy: 8, capturedAt: time + offset });
  return { op, calls, callbacks, position, status: (s: ConnectionStatus) => onStatus(s),
    emit: (value = position()) => receive?.(value), late: () => oldReceive?.(position()), fail: () => failCapture?.('GPS desligado'), transient: () => failCapture?.('Sinal temporariamente indisponível', false),
    advance: (ms = 5000) => { time += ms; }, switchUser: () => { session = { token: 'other-test-session', role: 'Driver', expiresAt: time + 3_600_000 }; },
    expire: () => { time = session!.expiresAt; }, setRole: () => { session = { ...session!, role: 'Parent' }; },
    setCaptureGate: (gate: Promise<void>) => { captureGate = gate; }, setPublishGate: (gate: Promise<void>) => { publishGate = gate; },
    denyBackground: () => { denied = true; }, failStop: (value: boolean) => { failedStop = value; }, publishError: (value: unknown) => { publishError = value; },
    counts: () => ({ starts, stops, disposed, invalidations }),
  };
}

test('driver starts once, sends captured GPS only after connected and clears on stop', async () => {
  const f = fixture(); await Promise.all([f.op.start(), f.op.start()]);
  assert.equal(f.counts().starts, 1); assert.equal(f.op.store.getState().phase, 'active');
  f.emit(); await flush(); assert.equal(f.calls.length, 1); assert.equal(f.op.store.getState().sent, 1);
  await f.op.stop(); f.advance(); f.late(); await flush();
  assert.equal(f.calls.length, 1); assert.equal(f.op.store.getState().lastSentAt, null); assert.equal(f.counts().disposed, 1);
});
test('driver drops old, future, inaccurate, out of bounds, duplicate and rapid fixes', async () => {
  const f = fixture(); await f.op.start();
  for (const value of [f.position(-6000), f.position(2000), { ...f.position(), accuracy: 101 }, { ...f.position(), latitude: NaN }, { ...f.position(), longitude: 181 }]) f.emit(value);
  assert.equal(f.calls.length, 0);
  f.emit(); await flush(); f.emit(); f.advance(500); f.emit(); await flush(); assert.equal(f.calls.length, 1);
  f.advance(5000); f.emit(); await flush(); assert.equal(f.calls.length, 2);
  assert.equal(usablePosition({ ...f.position(), capturedAt: 1 }, Date.now(), 0), false);
  await f.op.stop();
});
test('offline, reconnect and foreground pause never replay samples', async () => {
  const f = fixture(); await f.op.start(); f.op.presence(true, false); f.emit(); await flush();
  f.op.presence(true, true); await flush(); assert.equal(f.calls.length, 0);
  f.advance(); f.emit(); await flush(); assert.equal(f.calls.length, 1);
  f.op.presence(false, true); f.advance(); f.emit(); await flush(); assert.equal(f.calls.length, 1);
  f.op.presence(true, true); await flush(); assert.equal(f.calls.length, 1);
  f.advance(); f.emit(); await flush(); assert.equal(f.calls.length, 2); await f.op.stop();
});
test('background permission is explicit, then fresh task fixes may publish while hidden', async () => {
  const f = fixture(); await f.op.start(); assert.equal(f.counts().starts, 1);
  await f.op.enableBackground(); assert.equal(f.op.store.getState().mode, 'background');
  f.op.presence(false, true); f.emit(); await flush(); assert.equal(f.calls.length, 1); await f.op.stop();
});
test('denied background permission resumes foreground capture without assuming background', async () => {
  const f = fixture(); await f.op.start(); f.denyBackground(); await f.op.enableBackground();
  assert.equal(f.op.store.getState().mode, 'foreground'); assert.equal(f.counts().starts, 3); assert.ok(f.op.store.getState().error);
  f.emit(); await flush(); assert.equal(f.calls.length, 1); await f.op.stop();
});
test('stop during permission/start waits for cleanup, never activates late', async () => {
  const f = fixture(); const gate = deferred(); f.setCaptureGate(gate.promise);
  const start = f.op.start(); const stop = f.op.stop(); assert.equal(f.op.store.getState().phase, 'stopping');
  gate.resolve(); await Promise.all([start, stop]); f.late(); await flush();
  assert.equal(f.op.store.getState().phase, 'idle'); assert.equal(f.calls.length, 0);
});
test('no queue accumulates behind an in-flight invocation; late ack after logout cannot revive state', async () => {
  const f = fixture(); const gate = deferred(); f.setPublishGate(gate.promise); await f.op.start();
  f.emit(); f.advance(); f.emit(); assert.equal(f.calls.length, 1);
  f.switchUser(); await f.op.stop(); gate.resolve(); await flush(); f.late();
  assert.equal(f.op.store.getState().sent, 0); assert.equal(f.calls.length, 1);
});
test('previous account callbacks cannot publish under a new session', async () => {
  const f = fixture(); await f.op.start(); f.switchUser(); f.emit(); await flush(); assert.equal(f.calls.length, 0); await f.op.stop();
  await f.op.start(); f.advance(); f.callbacks[0](f.position()); await flush(); assert.equal(f.calls.length, 0);
  f.emit(); await flush(); assert.equal(f.calls.length, 1); await f.op.stop();
});
test('expired or 401 publishing sessions stop and invalidate without resend loops', async () => {
  for (const expired of [true, false]) {
    const f = fixture(); await f.op.start(); if (expired) f.expire(); else f.publishError({ statusCode: 401 });
    f.emit(); await flush(); assert.equal(f.counts().invalidations, 1); assert.equal(f.op.store.getState().phase, 'idle');
    f.advance(); f.late(); await flush(); assert.equal(f.calls.length, expired ? 0 : 1);
  }
});
test('GPS failure stops tracking; failed native stop can be retried', async () => {
  const f = fixture(); await f.op.start(); f.fail(); await flush(); assert.equal(f.op.store.getState().phase, 'error'); assert.match(f.op.store.getState().error!, /GPS/);
  f.failStop(true); await assert.rejects(f.op.stop()); assert.equal(f.op.store.getState().phase, 'error');
  const starts = f.counts().starts; await f.op.start(); assert.equal(f.counts().starts, starts);
  f.failStop(false); await f.op.stop(); assert.equal(f.op.store.getState().phase, 'idle');
});
test('consumer cannot start driver operation', async () => { const f = fixture(); f.setRole(); await f.op.start(); assert.equal(f.counts().starts, 0); });
test('temporary GPS unavailability warns without destroying capture, a new acknowledged fix clears the warning', async () => {
  const f = fixture(); await f.op.start(); f.transient(); assert.equal(f.op.store.getState().phase, 'active'); assert.ok(f.op.store.getState().error);
  f.advance(); f.emit(); await flush(); assert.equal(f.calls.length, 1); assert.equal(f.op.store.getState().error, null); await f.op.stop();
});
test('global task bridge has one listener, consumes only newest fix and forgets disposed session', () => {
  const points: number[] = []; const p = (capturedAt: number) => ({ latitude: 0, longitude: 0, accuracy: 5, capturedAt });
  assert.equal(deliverTaskLocations([p(1)], false), false);
  const old = bindLocationTask({ receive: () => { throw new Error('old session'); }, fail: () => undefined });
  const unbind = bindLocationTask({ receive: (value) => points.push(value.capturedAt), fail: () => points.push(-1) });
  old(); deliverTaskLocations([p(2), p(1), p(3)], false); assert.deepEqual(points, [3]); unbind();
  assert.equal(deliverTaskLocations([p(4)], false), false);
});

test('driver API derives id from authenticated response, rejects foreign links and handles empty 404', async () => {
  const http = create(); const gateway = createDriverApi(http); const paths: string[] = [];
  const driver = { id: 5, fullname: 'Unit Driver', licensePlate: 'TEST000', isActive: true };
  const passenger = { id: 1, fullName: 'Test', schoolId: 1, driverId: 5, isGoingToday: false, isReturningToday: true };
  let empty = false; let foreign = false;
  http.defaults.adapter = async (config) => {
    paths.push(config.url!);
    if (config.url?.endsWith('/students') && empty) throw new AxiosError('empty', 'ERR_BAD_REQUEST', config, undefined, { config, status: 404, statusText: 'Not Found', data: '', headers: {} });
    return { config, status: 200, statusText: 'OK', headers: {}, data: config.url === '/api/drivers' ? [driver] : [{ ...passenger, driverId: foreign ? 6 : 5 }] };
  };
  assert.equal((await gateway.roster()).passengers[0].isGoingToday, false);
  assert.deepEqual(paths, ['/api/drivers', '/api/drivers/5/students']);
  foreign = true; await assert.rejects(gateway.roster()); empty = true; assert.deepEqual((await gateway.roster()).passengers, []);
});
