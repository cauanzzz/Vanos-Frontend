import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, registrationInput, utf8Length, validateForm } from '../src/features/auth/validation';

test('registration validates UTF-8 byte limit while preserving the password exactly', () => {
  assert.equal(utf8Length('á🙂'), 6);
  const form = { ...emptyForm, email: ' User@example.test ', password: '🙂'.repeat(19) };
  assert.ok(validateForm(form, true, 'Parent').password);
  form.password = '  exact password  ';
  assert.deepEqual(registrationInput(form, 'Student'), { email: 'user@example.test', password: '  exact password  ', role: 'Student' });
});

test('driver fields and integer capacity are required only for driver signup', () => {
  const form = { ...emptyForm, email: 'unit@example.test', password: 'password-only-for-unit' };
  assert.deepEqual(validateForm(form, true, 'Parent'), {});
  assert.deepEqual(validateForm(form, false, 'Driver'), {});
  assert.ok(validateForm(form, true, 'Driver').cpf);
  for (const capacity of ['0', '101', '1.5', '1e1', '']) assert.ok(validateForm({ ...form, studentCapacity: capacity }, true, 'Driver').studentCapacity);
  const valid = { ...form, fullname: 'Unit Driver', cpf: 'unit-cpf', phoneNumber: 'unit-phone', licensePlate: 'unit-plate', studentCapacity: '12', pixKey: 'unit-key' };
  assert.deepEqual(validateForm(valid, true, 'Driver'), {});
  const request = registrationInput(valid, 'Driver');
  assert.equal(request.role, 'Driver');
  assert.equal('studentCapacity' in request && request.studentCapacity, 12);
  assert.equal('latitude' in request, false);
});
