import { readFile } from 'node:fs/promises';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

// Explicit, finite synthetic publisher for the dedicated local test account only.
const fixture = JSON.parse(await readFile('.expo/tracking-fixture.json', 'utf8'));
if (!fixture.driverEmail?.startsWith('tracking-driver-') || !fixture.driverEmail.endsWith('@example.test')) throw new Error('Fixture local inválida.');
const response = await fetch('http://localhost:5108/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fixture.driverEmail, password: fixture.password }),
});
if (!response.ok) throw new Error('Não foi possível entrar na conta local de teste.');
const auth = await response.json();
const hub = new HubConnectionBuilder().withUrl('http://localhost:5108/hubs/tracking', { accessTokenFactory: () => auth.token, withCredentials: false }).configureLogging(LogLevel.None).build();
try {
  await hub.start();
  console.log('Publicando 5 pontos SINTÉTICOS pelo Hub real; isto não é GPS de um aparelho.');
  for (let index = 0; index < 5; ++index) {
    await hub.invoke('UpdateLocation', -23.55 - index * 0.0001, -46.63 - index * 0.0001);
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
} finally { await hub.stop(); }
console.log('Envio encerrado. O sinal ficará desatualizado após 30 segundos sem novos pontos.');
