import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDriverPublisher, type PublishingConnection } from '../src/services/driverPublisher';
import type { Session } from '../src/types/auth';

test('Hub 401 can await session disposal without deadlocking its own start chain', async () => {
  const session: Session = { token: 'unit-only', role: 'Driver', expiresAt: Date.now() + 60_000 };
  let invalidated = false; let starts = 0;
  const connection: PublishingConnection = { async start() { ++starts; throw { statusCode: 401 }; }, async stop() {},
    on() {}, off() {}, onclose() {}, async invoke() { throw new Error('must not publish'); } };
  const publisher = createDriverPublisher({ connection, session, getSession: () => session, onStatus: () => undefined,
    invalidate: async () => { await publisher.dispose(); invalidated = true; } });
  publisher.presence(true);
  for (let i = 0; i < 30; ++i) await Promise.resolve();
  assert.equal(invalidated, true); assert.equal(starts, 1);
});
test('driver publisher checks identity at invocation and cannot publish after disposal', async () => {
  const session: Session = { token: 'unit-only', role: 'Driver', expiresAt: Date.now() + 60_000 };
  let current: Session | null = session; const invocations: unknown[][] = [];
  const connection: PublishingConnection = { async start() {}, async stop() {}, on() {}, off() {}, onclose() {}, async invoke(...args) { invocations.push(args); } };
  const publisher = createDriverPublisher({ connection, session, getSession: () => current, onStatus: () => undefined, invalidate: async () => undefined });
  publisher.presence(true); for (let i = 0; i < 15; ++i) await Promise.resolve();
  const point = { latitude: 1, longitude: 2, capturedAt: Date.now(), accuracy: 5 };
  assert.equal(await publisher.publish(point), true); assert.deepEqual(invocations, [['UpdateLocation', 1, 2]]);
  current = { ...session, token: 'another-unit-session' }; assert.equal(await publisher.publish(point), false);
  await publisher.dispose(); current = session; assert.equal(await publisher.publish(point), false); assert.equal(invocations.length, 1);
});
