import assert from 'node:assert/strict';
import { test } from 'node:test';
import { create } from 'axios';

import { createPassengersApi } from '../src/services/passengersApi';
import { createPassengersStore } from '../src/store/passengers';
import type { Passenger } from '../src/types/tracking';

const passenger: Passenger = { id: 1, fullName: 'Unit Passenger', schoolId: 1, driverId: 10, isGoingToday: true, isReturningToday: true };

test('list is owner-scoped, status uses actual PATCH query params and rejects unconfirmed response', async () => {
  const client = create();
  const gateway = createPassengersApi(client);
  const paths: string[] = [];
  client.defaults.adapter = async (config) => {
    paths.push(config.url!);
    assert.equal(config.data, undefined);
    if (config.method === 'patch') {
      assert.deepEqual(config.params, { isGoingToday: false, isReturningToday: true });
      return { config, status: 200, statusText: 'OK', headers: {}, data: { ...passenger, isGoingToday: false } };
    }
    assert.equal(config.params, undefined);
    return { config, status: 200, statusText: 'OK', headers: {}, data: [passenger] };
  };
  await gateway.list();
  assert.equal((await gateway.updateStatus(1, false, true)).isGoingToday, false);
  assert.deepEqual(paths, ['/api/students', '/api/students/1/status']);
  client.defaults.adapter = async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: passenger });
  await assert.rejects(gateway.updateStatus(1, false, false));
});

test('failed absence keeps server values and retry saves only after confirmation', async () => {
  let fail = true;
  const store = createPassengersStore({ list: async () => [passenger], updateStatus: async () => {
    if (fail) throw new Error('unit unavailable');
    return { ...passenger, isGoingToday: false, isReturningToday: false };
  } });
  await store.getState().load();
  await store.getState().updateStatus(false, false);
  assert.equal(store.getState().items[0].isGoingToday, true);
  assert.equal(store.getState().notice, null); assert.ok(store.getState().error);
  fail = false; await store.getState().updateStatus(false, false);
  assert.equal(store.getState().items[0].isGoingToday, false);
  assert.equal(store.getState().notice, 'Preferências salvas.');
});

test('logout/reset discards pending list and status responses', async () => {
  let resolve!: (value: Passenger[]) => void;
  const store = createPassengersStore({ list: () => new Promise((yes) => { resolve = yes; }), updateStatus: async () => passenger });
  const load = store.getState().load(); store.getState().reset(); resolve([passenger]); await load;
  assert.deepEqual(store.getState().items, []);
  assert.equal(store.getState().selectedId, null);
  let finish!: (value: Passenger) => void;
  const saving = createPassengersStore({ list: async () => [passenger], updateStatus: () => new Promise((yes) => { finish = yes; }) });
  await saving.getState().load();
  const update = saving.getState().updateStatus(false, false);
  saving.getState().reset(); finish({ ...passenger, isGoingToday: false, isReturningToday: false }); await update;
  assert.deepEqual(saving.getState().items, []);
  assert.equal(saving.getState().notice, null);
});

test('selection rejects arbitrary IDs and refresh removes vanished selections', async () => {
  let items = [passenger, { ...passenger, id: 2 }];
  const store = createPassengersStore({ list: async () => items, updateStatus: async () => passenger });
  await store.getState().load(); store.getState().select(99);
  assert.equal(store.getState().selectedId, 1);
  store.getState().select(2); assert.equal(store.getState().selectedId, 2);
  items = [passenger]; await store.getState().load();
  assert.equal(store.getState().selectedId, 1);
});
