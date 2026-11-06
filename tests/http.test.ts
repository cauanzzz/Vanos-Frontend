import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { createAuthApi } from '../src/services/authApi';
import { errorMessage } from '../src/services/errors';
import { createHttpClients, normalizeApiOrigin } from '../src/services/http';
import type { Session } from '../src/types/auth';

const initial: Session = { token: 'unit-only-token', role: 'Parent', expiresAt: 10_000 };
const ok = (config: InternalAxiosRequestConfig) => ({ config, status: 200, statusText: 'OK', headers: {}, data: {} });
const refused = (config: InternalAxiosRequestConfig) => new AxiosError('unit 401', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config), status: 401 });

test('origin accepts only an origin and rejects embedded credentials/paths', () => {
  assert.equal(normalizeApiOrigin('https://api.example.test/'), 'https://api.example.test');
  for (const value of [undefined, '', 'file:///x', 'https://user:password@example.test', 'https://example.test/api', 'https://example.test?token=x']) assert.throws(() => normalizeApiOrigin(value));
});

test('public login/register send exact real contracts without bearer headers or automatic retry', async () => {
  const requests: { path?: string; data: unknown; authorization: unknown }[] = [];
  let invalidations = 0;
  const clients = createHttpClients({ origin: () => 'https://api.example.test', getSession: () => initial,
    onUnauthorized: async () => { ++invalidations; } });
  clients.publicApi.defaults.adapter = async (config) => {
    requests.push({ path: config.url, data: JSON.parse(config.data as string), authorization: config.headers.get('Authorization') });
    throw refused(config);
  };
  const gateway = createAuthApi(clients.publicApi);
  const input = { email: 'unit@example.test', password: 'unit-only-password' };
  await assert.rejects(gateway.login(input, new AbortController().signal), (e: unknown) => errorMessage(e) === 'E-mail ou senha inválidos.');
  await assert.rejects(gateway.register({ ...input, role: 'Student' }, new AbortController().signal));
  assert.deepEqual(requests.map((r) => r.path), ['/api/auth/login', '/api/auth/register']);
  assert.deepEqual(requests[0].data, input);
  assert.deepEqual(requests[1].data, { ...input, role: 'Student' });
  assert.equal(requests.every((r) => r.authorization === undefined), true);
  assert.equal(invalidations, 0);
});

test('authenticated requests read the current token every time and force configured origin', async () => {
  let current = initial;
  const headers: unknown[] = [];
  const clients = createHttpClients({ origin: () => 'https://api.example.test', getSession: () => current, onUnauthorized: async () => {}, now: () => 0 });
  clients.api.defaults.adapter = async (config) => {
    headers.push(config.headers.get('Authorization'));
    assert.equal(config.baseURL, 'https://api.example.test');
    return ok(config);
  };
  await clients.api.get('/api/students', { baseURL: 'https://other.example.test' });
  current = { ...initial, token: 'new-unit-token' };
  await clients.api.get('/api/students');
  assert.deepEqual(headers, ['Bearer unit-only-token', 'Bearer new-unit-token']);
  await assert.rejects(clients.api.get('https://other.example.test'));
});

test('401 invokes invalidation once per request and does not replay or call refresh', async () => {
  let calls = 0;
  let invalidations = 0;
  const clients = createHttpClients({ origin: () => 'https://api.example.test', getSession: () => initial,
    onUnauthorized: async (session) => { assert.equal(session, initial); ++invalidations; }, now: () => 0 });
  clients.api.defaults.adapter = async (config) => { ++calls; throw refused(config); };
  await assert.rejects(clients.api.get('/api/students'));
  assert.equal(calls, 1);
  assert.equal(invalidations, 1);
});

test('expired credentials never reach the network', async () => {
  let calls = 0;
  let invalidations = 0;
  const clients = createHttpClients({ origin: () => 'https://api.example.test', getSession: () => initial,
    onUnauthorized: async () => { ++invalidations; }, now: () => 10_000 });
  clients.api.defaults.adapter = async (config) => { ++calls; return ok(config); };
  await assert.rejects(clients.api.get('/api/students'));
  assert.equal(calls, 0);
  assert.equal(invalidations, 1);
});

test('session expiring while a request is in flight also discards the response', async () => {
  let time = 0;
  let invalidations = 0;
  const clients = createHttpClients({ origin: () => 'https://api.example.test', getSession: () => initial,
    onUnauthorized: async () => { ++invalidations; }, now: () => time });
  clients.api.defaults.adapter = async (config) => { time = 10_000; return ok(config); };
  await assert.rejects(clients.api.get('/api/students'), /sessão expirou/);
  assert.equal(invalidations, 1);
});

test('response from an ended session is discarded and active requests are cancelled', async () => {
  let current: Session | null = initial;
  const clients = createHttpClients({ origin: () => 'https://api.example.test', getSession: () => current, onUnauthorized: async () => {}, now: () => 0 });
  clients.api.defaults.adapter = async (config) => { current = null; return ok(config); };
  await assert.rejects(clients.api.get('/api/students'), /sessão foi encerrada/);
  current = initial;
  clients.api.defaults.adapter = async (config) => { clients.cancelPending(); assert.equal(config.signal?.aborted, true); return ok(config); };
  await assert.rejects(clients.api.get('/api/students'));
});

test('network errors and unknown backend bodies never expose credentials or arbitrary HTML', () => {
  assert.match(errorMessage(new AxiosError('sensitive detail', 'ERR_NETWORK')), /internet/);
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const error = new AxiosError('private', 'ERR_BAD_RESPONSE', config, undefined, { ...ok(config), status: 500, data: '<html>private server stack</html>' });
  assert.equal(errorMessage(error).includes('private'), false);
});
