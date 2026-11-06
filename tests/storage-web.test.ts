import assert from 'node:assert/strict';
import { test } from 'node:test';

import { credentialStorage } from '../src/services/credentialStorage.web';

test('web adapter stores only in memory and explicitly clears on logout', async () => {
  assert.equal(await credentialStorage.read(), null);
  await credentialStorage.write('unit-only-credential');
  assert.equal(await credentialStorage.read(), 'unit-only-credential');
  await credentialStorage.remove();
  assert.equal(await credentialStorage.read(), null);
});
