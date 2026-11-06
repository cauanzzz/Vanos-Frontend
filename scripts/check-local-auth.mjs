import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// Writes test accounts only to the explicitly started local validation API.
const origin = 'http://localhost:5108';
const browserOrigin = 'http://localhost:8081';
const suffix = Date.now().toString(36);
const password = randomBytes(18).toString('base64url');
async function send(path, { body, token, method = body ? 'POST' : 'GET', originHeader = browserOrigin } = {}) {
  return fetch(origin + path, { method,
    headers: { Origin: originHeader, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000), redirect: 'manual' });
}
const preflight = await fetch(origin + '/api/auth/login', { method: 'OPTIONS', headers: {
  Origin: browserOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type',
} });
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), browserOrigin);
console.log('PASS: preflight CORS para o navegador local');
assert.equal((await send('/api/students')).status, 401);
assert.equal((await send('/api/students', { originHeader: 'https://untrusted.example.test' })).status, 403);
console.log('PASS: endpoint protegido sem token = 401; origem externa recusada = 403');

for (const role of ['Parent', 'Student', 'Driver']) {
  const email = `local-${role.toLowerCase()}-${suffix}@example.test`;
  const input = { email, password, role, ...(role === 'Driver' ? {
    fullname: 'Motorista de Validacao Local', cpf: '00000000000', phoneNumber: '00000000000',
    licensePlate: 'LOCAL00', studentCapacity: 12, pixKey: 'validacao-local@example.test',
  } : {}) };
  const registered = await send('/api/auth/register', { body: input });
  assert.equal(registered.status, 200, `cadastro ${role}`);
  const auth = await registered.json();
  assert.equal(auth.role, role);
  assert.equal(typeof auth.token, 'string');
  const loggedIn = await send('/api/auth/login', { body: { email, password } });
  assert.equal(loggedIn.status, 200, `login ${role}`);
  const loginAuth = await loggedIn.json();
  assert.equal(loginAuth.role, role);
  assert.equal((await send('/api/auth/login', { body: { email, password: password + '-wrong' } })).status, 401);
  assert.equal((await send('/api/auth/register', { body: input })).status, 400);
  const own = await send(role === 'Driver' ? '/api/drivers' : '/api/students', { token: loginAuth.token });
  assert.equal(own.status, 200);
  if (role !== 'Driver') assert.equal((await send('/api/drivers', { token: loginAuth.token })).status, 403);
  console.log(`PASS: ${role} cadastro/login = 200; senha incorreta = 401; duplicado = 400; acesso protegido = 200`);
}
console.log('Validacao HTTP real concluida. Senhas e tokens nao foram registrados. Foram criadas 3 contas de teste no banco local dedicado.');
