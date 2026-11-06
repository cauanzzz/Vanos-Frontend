import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { create } from 'axios';

import { isRecord, parseSession } from '../src/features/auth/session';
import { createDriverOperation } from '../src/features/driver/createDriverOperation';
import { createDriverApi } from '../src/services/driverApi';
import { createDriverPublisher } from '../src/services/driverPublisher';
import { createTrackingConnection } from '../src/services/trackingConnection';
import { createTrackingStore, locationQuality } from '../src/store/tracking';
import type { Session } from '../src/types/auth';
import type { CapturedPosition, DriverCapture } from '../src/types/driver';

// Real local API + Hub. Capture below is deliberately synthetic; never a device/background test.
async function main() {
  const origin = 'http://localhost:5108';
  const fixture: unknown = JSON.parse(await readFile('.expo/tracking-fixture.json', 'utf8'));
  assert.ok(isRecord(fixture));
  for (const key of ['driverEmail', 'parentEmail', 'otherEmail', 'password']) assert.equal(typeof fixture[key], 'string');
  const password = String(fixture.password);
  async function login(email: string): Promise<Session> {
    assert.match(email, /^tracking-[a-z]+-[a-z0-9]+@example\.test$/);
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200); return parseSession(await response.json() as unknown, Date.now());
  }
  const [driver, parent, other] = await Promise.all([login(String(fixture.driverEmail)), login(String(fixture.parentEmail)), login(String(fixture.otherEmail))]);
  let session: Session | null = driver;
  const driverApi = createDriverApi(create({ baseURL: origin, headers: { Authorization: `Bearer ${driver.token}` }, timeout: 10_000 }));
  const roster = await driverApi.roster();
  assert.equal(roster.driver.id, fixture.driverId); assert.ok(roster.passengers.some((item) => item.id === fixture.studentId));
  const forbidden = await fetch(`${origin}/api/drivers/${roster.driver.id + 10000}/students`, { headers: { Authorization: `Bearer ${driver.token}` } });
  assert.equal(forbidden.status, 403);
  assert.equal((await fetch(`${origin}/api/drivers`, { headers: { Authorization: `Bearer ${parent.token}` } })).status, 403);
  const map = createTrackingStore(); map.getState().authorize([roster.driver.id]); map.getState().setStatus('connected');
  const parentHub = createTrackingConnection(origin, () => parent);
  const otherHub = createTrackingConnection(origin, () => other);
  let received = 0, foreignReceived = 0;
  parentHub.on('LocationUpdated', (value: unknown) => { ++received; map.getState().receive(value); });
  otherHub.on('LocationUpdated', () => { ++foreignReceived; });
  let callback: ((value: CapturedPosition) => void) | null = null;
  let oldCallback: ((value: CapturedPosition) => void) | null = null;
  const capture: DriverCapture = {
    async start(_, receive) { callback = receive; oldCallback = receive; }, async stop() { callback = null; },
  };
  const operation = createDriverOperation({ capture, getSession: () => session, invalidate: async () => { session = null; },
    publisher: (current, onStatus) => createDriverPublisher({ connection: createTrackingConnection(origin, () => session === current ? current : null),
      session: current, getSession: () => session, invalidate: async () => { session = null; }, onStatus }),
  });
  const sleep = (ms: number) => new Promise<void>((yes) => setTimeout(yes, ms));
  async function until(check: () => boolean) { const end = Date.now() + 15_000; while (!check()) { if (Date.now() >= end) throw new Error('Timeout no Hub local'); await sleep(25); } }
  function emit(late = false) { const position = { latitude: -23.55, longitude: -46.63, accuracy: 5, capturedAt: Date.now() }; (late ? oldCallback : callback)?.(position); }
  const results: string[] = [];
  const pass = (text: string) => { results.push(text); console.log('PASS: ' + text); };
  try {
    await Promise.all([parentHub.start(), otherHub.start()]);
    await assert.rejects(parentHub.invoke('UpdateLocation', -23.55, -46.63));
    pass('Lista real do motorista e autorização HTTP/Hub; consumidor não publica.');
    await operation.start(); await until(() => operation.store.getState().connection === 'connected');
    emit(); await until(() => received === 1 && operation.store.getState().sent === 1);
    assert.equal(locationQuality(map.getState().fixes[roster.driver.id], 'connected', map.getState().liveSince, Date.now()), 'current');
    await sleep(200); assert.equal(foreignReceived, 0);
    pass('Operação mobile publica pelo Hub real; estado do mapa recebe somente para conta vinculada (GPS sintético).');
    operation.presence(true, false); emit(); await sleep(1600); operation.presence(true, true);
    await until(() => operation.store.getState().connection === 'connected'); await sleep(200); assert.equal(received, 1);
    emit(); await until(() => received === 2);
    pass('Offline/reconexão exige novo ponto; nenhuma fila antiga é publicada.');
    await operation.stop(); await sleep(1600); emit(true); await sleep(300); assert.equal(received, 2);
    pass('Encerramento impede novas invocações e callback tardio não publica.');
    await operation.start(); await until(() => operation.store.getState().connection === 'connected'); emit(); await until(() => received === 3);
    session = null; await operation.stop(); await sleep(1600); emit(true); await sleep(300); assert.equal(received, 3);
    session = { ...driver }; emit(true); await sleep(300); assert.equal(received, 3);
    assert.equal(foreignReceived, 0); assert.equal(operation.store.getState().lastCapturedAt, null);
    pass('Logout/troca de sessão impedem reutilização de posição ou callback e apagam dados locais.');
    await writeFile('.expo/stage4-api-results.json', JSON.stringify({ results, api: origin, gps: 'synthetic', nativeBackground: 'not tested' }, null, 2));
  } finally { session = null; await operation.stop(); await Promise.allSettled([parentHub.stop(), otherHub.stop()]); map.getState().reset(); }
}
void main().catch(() => { console.error('Falha na validação local do motorista. Confira API/proxy e execute tracking:check para preparar as fixtures. Nenhum token foi registrado.'); process.exitCode = 1; });
