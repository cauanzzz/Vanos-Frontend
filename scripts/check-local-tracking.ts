import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { create } from 'axios';

import { isRecord, parseSession } from '../src/features/auth/session';
import { createPassengersApi } from '../src/services/passengersApi';
import { createTrackingClient } from '../src/services/trackingClient';
import { createTrackingConnection } from '../src/services/trackingConnection';
import { createPassengersStore } from '../src/store/passengers';
import { createTrackingStore, locationQuality } from '../src/store/tracking';
import type { Session } from '../src/types/auth';

// Explicit local fixtures. No native GPS, production credentials or remote DB.
async function main() {
const origin = 'http://localhost:5108';
const password = 'VanosLocal!2026';
const suffix = Date.now().toString(36);
const email = (name: string) => `tracking-${name}-${suffix}@example.test`;
const parentEmail = email('parent');
const driverEmail = email('driver');
const otherEmail = email('other');
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function wait(check: () => boolean) {
  const until = Date.now() + 15_000;
  while (!check()) { if (Date.now() > until) throw new Error('Tempo esgotado aguardando SignalR local.'); await delay(25); }
}
async function request(path: string, body?: unknown, token?: string, method = body ? 'POST' : 'GET') {
  return fetch(origin + path, { method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(15_000) });
}
async function record(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  assert.ok(isRecord(value));
  return value;
}
async function account(address: string, role: 'Parent' | 'Driver'): Promise<Session> {
  const response = await request('/api/auth/register', { email: address, password, role, ...(role === 'Driver' ? {
    fullname: 'Validação local · Motorista', cpf: '00000000000', phoneNumber: '00000000000', licensePlate: 'LOCAL00', studentCapacity: 12, pixKey: 'validacao-local@example.test',
  } : {}) });
  assert.equal(response.status, 200);
  return parseSession(await response.json() as unknown, Date.now());
}

// Fixed database/server and fixed SQL. Does not read the backend's connection string.
const schoolOutput = execFileSync('sqlcmd', ['-S', '.\\SQLEXPRESS', '-E', '-C', '-d', 'VanosMobile_LocalValidation', '-l', '5', '-b', '-h', '-1', '-W', '-Q',
  "SET NOCOUNT ON; IF NOT EXISTS (SELECT 1 FROM Schools WHERE Name=N'Validação local Vanos') INSERT INTO Schools (Name,ZipCode,Street,Number,Neighborhood,City,State,Latitude,Longitude) VALUES (N'Validação local Vanos','00000000',N'Teste','0',N'Teste',N'Teste','SP',NULL,NULL); SELECT TOP 1 Id FROM Schools WHERE Name=N'Validação local Vanos' ORDER BY Id;",
], { encoding: 'utf8', windowsHide: true });
const schoolId = Number(schoolOutput.trim());
assert.ok(Number.isSafeInteger(schoolId) && schoolId > 0);
const parent = await account(parentEmail, 'Parent');
const other = await account(otherEmail, 'Parent');
const driver = await account(driverEmail, 'Driver');
const driverResponse = await request('/api/drivers', undefined, driver.token);
const drivers: unknown = await driverResponse.json();
assert.ok(Array.isArray(drivers) && isRecord(drivers[0]));
const driverId = Number(drivers[0].id);
assert.ok(Number.isSafeInteger(driverId));
async function passenger(session: Session, name: string) {
  const response = await request('/api/students', { fullName: name, guardianName: 'Validação local', guardianPhoneNumber: '00000000000',
    zipCode: '00000000', street: 'Teste', number: '0', complement: '', neighborhood: 'Teste', city: 'Teste', state: 'SP', schoolId,
  }, session.token);
  assert.equal(response.status, 201);
  const result = await record(response);
  assert.ok(typeof result.id === 'number');
  return result.id;
}
const studentId = await passenger(parent, 'Validação local · Passageiro A');
await passenger(parent, 'Validação local · Passageiro B (sem vínculo)');
const foreignStudentId = await passenger(other, 'Validação local · Outra conta');
const hire = await request('/api/hirerequests', { studentId, driverId }, parent.token);
assert.equal(hire.status, 200);
const hireId = (await record(hire)).id;
assert.equal((await request(`/api/hirerequests/${hireId}/accept`, undefined, driver.token, 'PATCH')).status, 200);
console.log('PASS: perfis/passageiros criados e vínculo aceito pelos endpoints reais no banco local.');

const http = create({ baseURL: origin, headers: { Authorization: `Bearer ${parent.token}` }, timeout: 15_000 });
const passengers = createPassengersStore(createPassengersApi(http));
await passengers.getState().load(); passengers.getState().select(studentId);
assert.equal(passengers.getState().items.length, 2);
await passengers.getState().updateStatus(false, false);
assert.equal(passengers.getState().notice, 'Preferências salvas.');
const persisted: unknown = await (await request('/api/students', undefined, parent.token)).json();
assert.ok(Array.isArray(persisted));
const updated = persisted.find((item: unknown) => isRecord(item) && item.id === studentId) as Record<string, unknown> | undefined;
assert.equal(updated?.isGoingToday, false); assert.equal(updated?.isReturningToday, false);
assert.equal((await request(`/api/students/${foreignStudentId}/status?isGoingToday=false&isReturningToday=false`, undefined, parent.token, 'PATCH')).status, 404);
await passengers.getState().updateStatus(true, true);
console.log('PASS: ausência persiste após resposta real e alteração de passageiro alheio é recusada.');

const positions = createTrackingStore();
positions.getState().authorize([driverId]);
const ownerHub = createTrackingConnection(origin, () => parent);
const otherHub = createTrackingConnection(origin, () => other);
const driverHub = createTrackingConnection(origin, () => driver);
let otherCount = 0;
let connections = 0;
let payload: unknown;
otherHub.on('LocationUpdated', () => { ++otherCount; });
const client = createTrackingClient({ connection: ownerHub, session: parent, getSession: () => parent,
  invalidate: async () => { throw new Error('Sessão de teste recusada inesperadamente.'); },
  onStatus: (status) => positions.getState().setStatus(status), onLocation: (value) => { payload = value; positions.getState().receive(value); },
  onConnected: () => { ++connections; },
});
try {
  await Promise.all([otherHub.start(), driverHub.start()]);
  client.setEnabled(true);
  await wait(() => positions.getState().status === 'connected');
  await assert.rejects(ownerHub.invoke('UpdateLocation', -23.55, -46.63));
  await assert.rejects(otherHub.invoke('UpdateLocation', -23.55, -46.63));
  await driverHub.invoke('UpdateLocation', -23.55, -46.63);
  await wait(() => Boolean(positions.getState().fixes[driverId]));
  assert.ok(isRecord(payload));
  assert.deepEqual(Object.keys(payload).sort(), ['driverId', 'latitude', 'longitude', 'recordedAtUtc']);
  assert.equal(locationQuality(positions.getState().fixes[driverId], 'connected', positions.getState().liveSince, Date.now()), 'current');
  await delay(200);
  assert.equal(otherCount, 0);
  console.log('PASS: evento camelCase recebido só pela conta vinculada; consumidores não publicam.');
  await ownerHub.stop();
  await wait(() => connections >= 2);
  assert.equal(locationQuality(positions.getState().fixes[driverId], 'connected', positions.getState().liveSince, Date.now()), 'stale');
  await assert.rejects(ownerHub.invoke('UpdateLocation', -23.55, -46.63));
  await driverHub.invoke('UpdateLocation', -23.5501, -46.6301);
  await wait(() => positions.getState().fixes[driverId].receivedAt >= positions.getState().liveSince);
  console.log('PASS: reconexão real recupera grupo pelo servidor e exige uma nova posição.');
  await mkdir('.expo', { recursive: true });
  await writeFile('.expo/tracking-fixture.json', JSON.stringify({ parentEmail, driverEmail, otherEmail, password, driverId, studentId,
    note: 'Somente validação local. Pontos publicados por scripts são sintéticos, não GPS de aparelho.' }, null, 2));
  console.log('Fixture local salva em .expo/tracking-fixture.json (sem JWT). Nenhum dado de produção usado.');
} finally {
  await client.dispose();
  await Promise.allSettled([otherHub.stop(), driverHub.stop()]);
  passengers.getState().reset(); positions.getState().reset();
}
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha na validação local.');
  process.exitCode = 1;
});
