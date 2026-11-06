import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canAccess, parseSession } from '../src/features/auth/session';
import { createAuthStore } from '../src/store/createAuthStore';
import type { AuthGateway, CredentialStorage } from '../src/types/auth';
import type { Role } from '../src/types/roles';

const now = 2_000_000;
function response(role: Role = 'Parent', exp = now / 1000 + 3600) {
  const payload = Buffer.from(JSON.stringify({ exp, role })).toString('base64url');
  return { token: `e30.${payload}.unit-test-not-a-signature`, role };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(overrides: { storage?: Partial<CredentialStorage>; gateway?: Partial<AuthGateway> } = {}) {
  let saved: string | null = null;
  let time = now;
  let cleanups = 0;
  let removals = 0;
  const timers = new Set<() => void>();
  const storage: CredentialStorage = {
    read: async () => saved,
    write: async (value) => { saved = value; },
    remove: async () => { ++removals; saved = null; }, ...overrides.storage,
  };
  const gateway: AuthGateway = {
    login: async () => response(), register: async () => response(), ...overrides.gateway,
  };
  const store = createAuthStore({ storage, gateway, now: () => time,
    onSessionEnd: () => { ++cleanups; },
    schedule: (fn) => { timers.add(fn); return () => { timers.delete(fn); }; },
  });
  return { store, timers, setTime: (value: number) => { time = value; },
    setSaved: (value: string | null) => { saved = value; },
    saved: () => saved, cleanups: () => cleanups, removals: () => removals };
}
const login = { email: 'unit@example.test', password: 'test-only-password' };

test('restoration stays pending, is idempotent and gates access until storage resolves', async () => {
  const read = deferred<string | null>();
  let reads = 0;
  const f = fixture({ storage: { read: () => { ++reads; return read.promise; } } });
  const first = f.store.getState().restore();
  const second = f.store.getState().restore();
  assert.equal(first, second);
  assert.equal(f.store.getState().phase, 'restoring');
  assert.equal(canAccess(f.store.getState().session, 'passenger'), false);
  read.resolve(JSON.stringify(response('Student')));
  await first;
  assert.equal(reads, 1);
  assert.equal(f.store.getState().phase, 'authenticated');
  assert.equal(f.store.getState().session?.role, 'Student');
  assert.equal(f.timers.size, 1);
});

test('login uses backend role, persists only token/role and gives only the matching route access', async () => {
  const f = fixture({ gateway: { login: async () => response('Driver') } });
  await f.store.getState().restore();
  await f.store.getState().login(login);
  const session = f.store.getState().session;
  assert.equal(session?.role, 'Driver');
  assert.equal(canAccess(session, 'driver'), true);
  assert.equal(canAccess(session, 'passenger'), false);
  assert.deepEqual(Object.keys(JSON.parse(f.saved()!)).sort(), ['role', 'token']);
  assert.equal(f.saved()!.includes(login.password), false);
});

test('corrupt, expired, unknown and mismatched stored roles are erased', async () => {
  for (const value of ['broken-json', JSON.stringify(response('Parent', now / 1000)),
    JSON.stringify({ ...response(), role: 'Admin' }),
    JSON.stringify({ ...response('Driver'), role: 'Student' })]) {
    const f = fixture();
    f.setSaved(value);
    await f.store.getState().restore();
    assert.equal(f.store.getState().phase, 'anonymous');
    assert.equal(f.store.getState().session, null);
    assert.equal(f.saved(), null);
  }
});

test('JWT without exp, malformed exp and invalid token are rejected', () => {
  for (const claims of [{ role: 'Parent' }, { exp: 'never', role: 'Parent' }, { exp: 1e100, role: 'Parent' }]) {
    assert.throws(() => parseSession({ token: `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.x`, role: 'Parent' }, now));
  }
  assert.throws(() => parseSession({ token: 'bad', role: 'Parent' }, now));
});

test('expiry clears state, credentials and timer; foreground check catches suspended timers', async () => {
  const f = fixture();
  await f.store.getState().restore();
  await f.store.getState().login(login);
  f.setTime(now + 3_600_000);
  f.store.getState().checkExpiration();
  assert.equal(f.store.getState().session, null);
  await f.store.getState().logout();
  assert.equal(f.saved(), null);
  assert.equal(f.timers.size, 0);
  assert.equal(f.cleanups(), 1);
});

test('401 invalidation is idempotent and an older session cannot clear a new login', async () => {
  const f = fixture();
  await f.store.getState().restore();
  await f.store.getState().login(login);
  const previous = f.store.getState().session!;
  await Promise.all([f.store.getState().invalidate(previous), f.store.getState().invalidate(previous)]);
  assert.equal(f.removals(), 1);
  await f.store.getState().login(login);
  await f.store.getState().invalidate(previous);
  assert.equal(f.store.getState().phase, 'authenticated');
  assert.equal(f.removals(), 1);
});

test('failed login or unavailable API leaves no authenticated state and resets busy', async () => {
  const f = fixture({ gateway: { login: async () => { throw new Error('unit network failure'); } } });
  await f.store.getState().restore();
  await assert.rejects(f.store.getState().login(login));
  assert.equal(f.store.getState().busy, false);
  assert.equal(f.store.getState().phase, 'anonymous');
  assert.equal(f.saved(), null);
});

test('repeated submissions are blocked and logout discards a late successful login', async () => {
  const request = deferred<unknown>();
  let signal: AbortSignal | undefined;
  const f = fixture({ gateway: { login: async (_input, s) => { signal = s; return request.promise; } } });
  await f.store.getState().restore();
  const pending = f.store.getState().login(login);
  await assert.rejects(f.store.getState().login(login));
  await f.store.getState().logout();
  assert.equal(signal?.aborted, true);
  request.resolve(response());
  await pending;
  assert.equal(f.store.getState().phase, 'anonymous');
  assert.equal(f.saved(), null);
});

test('logout during a slow write removes the credential after the write completes', async () => {
  const write = deferred<void>();
  const started = deferred<void>();
  let credential: string | null = null;
  const f = fixture({ storage: {
    write: async (value) => { started.resolve(); await write.promise; credential = value; },
    remove: async () => { credential = null; },
  } });
  await f.store.getState().restore();
  const pending = f.store.getState().login(login);
  await started.promise;
  const ending = f.store.getState().logout();
  write.resolve();
  await Promise.all([pending, ending]);
  assert.equal(credential, null);
  assert.equal(f.store.getState().session, null);
});

test('logout wins over a pending restoration', async () => {
  const read = deferred<string | null>();
  const f = fixture({ storage: { read: () => read.promise } });
  const restoring = f.store.getState().restore();
  await f.store.getState().logout();
  read.resolve(JSON.stringify(response()));
  await restoring;
  assert.equal(f.store.getState().phase, 'anonymous');
  assert.equal(f.store.getState().session, null);
});

test('read errors gate navigation and can be retried', async () => {
  let fail = true;
  const f = fixture({ storage: { read: async () => { if (fail) throw new Error(); return null; } } });
  await f.store.getState().restore();
  assert.equal(f.store.getState().phase, 'storageError');
  fail = false;
  await f.store.getState().restore();
  assert.equal(f.store.getState().phase, 'anonymous');
});

test('write error cannot grant access; delete failure blocks further login until retry', async () => {
  let cannotDelete = true;
  const f = fixture({ storage: {
    write: async () => { throw new Error(); },
    remove: async () => { if (cannotDelete) throw new Error(); },
  } });
  await f.store.getState().restore();
  await assert.rejects(f.store.getState().login(login));
  assert.equal(f.store.getState().session, null);
  assert.equal(f.store.getState().phase, 'storageError');
  await assert.rejects(f.store.getState().login(login));
  cannotDelete = false;
  await f.store.getState().logout();
  assert.equal(f.store.getState().phase, 'anonymous');
});
