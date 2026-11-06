import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTrackingClient, type TrackingConnection } from '../src/services/trackingClient';
import type { Session } from '../src/types/auth';
import type { ConnectionStatus } from '../src/types/tracking';

const settle = async () => { for (let i = 0; i < 5; ++i) await new Promise<void>((resolve) => setImmediate(resolve)); };
function fixture() {
  const session: Session = { token: 'unit-only', role: 'Parent', expiresAt: 100_000 };
  let current: Session | null = session;
  let time = 0;
  let starts = 0;
  let stops = 0;
  let invalidations = 0;
  let connected = 0;
  const locations: unknown[] = [];
  const statuses: ConnectionStatus[] = [];
  const timers = new Map<() => void, number>();
  const listeners = new Set<(value: unknown) => void>();
  let close: (() => void) | undefined;
  let start: () => Promise<void> = async () => {};
  const connection: TrackingConnection = {
    start: () => { ++starts; return start(); },
    stop: async () => { ++stops; close?.(); },
    on: (name, fn) => { assert.equal(name, 'LocationUpdated'); listeners.add(fn); },
    off: (name, fn) => { assert.equal(name, 'LocationUpdated'); listeners.delete(fn); },
    onclose: (fn) => { close = fn; },
  };
  const client = createTrackingClient({ connection, session, getSession: () => current, now: () => time,
    invalidate: async () => { ++invalidations; current = null; },
    onStatus: (status) => statuses.push(status), onLocation: (value) => locations.push(value), onConnected: () => { ++connected; },
    schedule: (fn, delay) => { timers.set(fn, delay); return () => { timers.delete(fn); }; },
  });
  return { client, timers, listeners, locations, statuses, counts: () => ({ starts, stops, invalidations, connected }),
    emit: (value: unknown) => listeners.forEach((fn) => fn(value)), close: () => close?.(),
    startWith: (fn: () => Promise<void>) => { start = fn; }, setTime: (value: number) => { time = value; },
    replaceSession: () => { current = { ...session, token: 'another-unit-only-token' }; },
    tick: () => { const fn = timers.keys().next().value; if (fn) { timers.delete(fn); fn(); } },
  };
}

test('one listener/connection, idempotent start, stop and listener removal on dispose', async () => {
  const f = fixture();
  f.client.setEnabled(true); f.client.setEnabled(true); await settle();
  assert.equal(f.counts().starts, 1);
  assert.equal(f.listeners.size, 1);
  f.emit({ unit: true }); assert.equal(f.locations.length, 1);
  await f.client.dispose(); await f.client.dispose();
  assert.equal(f.listeners.size, 0);
  f.close(); f.emit({ late: true });
  assert.equal(f.timers.size, 0);
  assert.equal(f.locations.length, 1);
});

test('initial failure and closed connection use bounded backoff without concurrent retries', async () => {
  const f = fixture();
  f.startWith(async () => { throw new Error('unit offline'); });
  f.client.setEnabled(true); await settle();
  assert.deepEqual([...f.timers.values()], [1000]);
  f.close(); assert.equal(f.timers.size, 1);
  f.tick(); await settle();
  assert.deepEqual([...f.timers.values()], [2000]);
  f.startWith(async () => {}); f.tick(); await settle();
  assert.equal(f.statuses.at(-1), 'connected');
  assert.equal(f.counts().connected, 1);
  f.close(); assert.deepEqual([...f.timers.values()], [1000]);
  await f.client.dispose();
});

test('401/403 and expired sessions invalidate once without retry loops', async () => {
  for (const statusCode of [401, 403]) {
    const f = fixture(); f.startWith(async () => { throw { statusCode }; });
    f.client.setEnabled(true); await settle();
    assert.equal(f.counts().invalidations, 1); assert.equal(f.timers.size, 0);
    await f.client.dispose();
  }
  const f = fixture(); f.setTime(100_000); f.client.setEnabled(true); await settle();
  assert.equal(f.counts().starts, 0); assert.equal(f.counts().invalidations, 1);
  await f.client.dispose();
});

test('offline clears retry and reconnect reruns server connection setup without client group invocations', async () => {
  const f = fixture(); f.client.setEnabled(true); await settle();
  f.client.setEnabled(false, 'offline'); await settle();
  assert.equal(f.statuses.at(-1), 'offline');
  f.emit({ late: true }); assert.equal(f.locations.length, 0);
  f.client.setEnabled(true); await settle();
  assert.equal(f.counts().starts, 2); assert.equal(f.counts().connected, 2);
  await f.client.dispose();
});

test('pause/resume during an in-flight start serializes stop before recovery', async () => {
  const f = fixture();
  let resolve!: () => void;
  const pending = new Promise<void>((yes) => { resolve = yes; });
  f.startWith(() => pending); f.client.setEnabled(true); await settle();
  f.client.setEnabled(false); f.client.setEnabled(true);
  f.startWith(async () => {}); resolve(); await settle();
  f.tick(); await settle();
  assert.equal(f.statuses.at(-1), 'connected');
  await f.client.dispose();
});

test('changing user ignores old events and prevents retries for the old token', async () => {
  const f = fixture(); f.client.setEnabled(true); await settle();
  f.replaceSession(); f.emit({ private: true }); f.close();
  assert.equal(f.locations.length, 0); assert.equal(f.timers.size, 0);
  await f.client.dispose();
});
