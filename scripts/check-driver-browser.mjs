import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// Explicit synthetic browser GPS via CDP. HTTP, Hub and both UIs use the real local API.
const fixture = JSON.parse(await readFile('.expo/tracking-fixture.json', 'utf8'));
const executable = process.env.VANOS_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browsers = [9225, 9226].map((port) => spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  `--user-data-dir=${process.cwd()}/.expo/edge-stage4-${port}`, `--remote-debugging-port=${port}`, '--window-size=390,1000', 'about:blank'],
{ stdio: 'ignore', windowsHide: true }));
const delay = (ms) => new Promise((yes) => setTimeout(yes, ms));
const sockets = []; const exceptions = []; const results = [];
async function until(check, ms = 30_000) {
  const end = Date.now() + ms; while (Date.now() < end) { try { if (await check()) return; } catch { /* Document context can be replaced during navigation. */ } await delay(200); }
  throw new Error('Tempo esgotado na verificação web da Etapa 4');
}
async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((value) => value.type === 'page');
  const socket = new WebSocket(target.webSocketDebuggerUrl); sockets.push(socket);
  await new Promise((yes, no) => { socket.addEventListener('open', yes, { once: true }); socket.addEventListener('error', no, { once: true }); });
  let serial = 0; const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    const entry = pending.get(message.id); if (entry) { pending.delete(message.id); clearTimeout(entry.timer); message.error ? entry.no(new Error(message.error.message)) : entry.yes(message.result); }
  });
  const call = (method, params = {}) => new Promise((yes, no) => {
    const id = ++serial; const timer = setTimeout(() => { pending.delete(id); no(new Error('CDP timeout')); }, 20_000);
    pending.set(id, { yes, no, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('Erro na avaliação da tela'); return r.result.value; };
  const text = (value, timeout) => { console.log('CHECK: ' + value); return until(() => evaluate(`document.body.innerText.includes(${JSON.stringify(value)})`), timeout); };
  const click = (value) => evaluate(`(() => {const e=[...document.querySelectorAll('a,button,[role="button"]')].find(e=>e.getClientRects().length&&!e.closest('[aria-hidden="true"]')&&e.textContent.includes(${JSON.stringify(value)}));if(!e)throw Error('Controle ausente');e.scrollIntoView({block:'center'});e.click();return true})()`);
  const fill = (label, value) => evaluate(`(() => {const e=[...document.querySelectorAll('input')].find(e=>e.getClientRects().length&&e.getAttribute('aria-label')===${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await call('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'granted', origin: 'http://localhost:8081' });
  await call('Browser.grantPermissions', { permissions: ['geolocation'], origin: 'http://localhost:8081' });
  await call('Emulation.setGeolocationOverride', { latitude: -23.55, longitude: -46.63, accuracy: 5 });
  await call('Page.navigate', { url: 'http://localhost:8081/login' });
  return { call, evaluate, text, click, async login(email) { await text('Bom ter você de volta.'); await fill('E-mail', email); await fill('Senha', fixture.password); await click('Entrar na minha conta'); } };
}
const pass = (name) => { results.push(name); console.log('PASS: ' + name); };
let driver, parent;
try {
  await until(async () => { try { return (await fetch('http://127.0.0.1:9225/json/version')).ok && (await fetch('http://127.0.0.1:9226/json/version')).ok; } catch { return false; } });
  driver = await connect(9225); await driver.login(fixture.driverEmail); await driver.text('Passageiros vinculados'); await driver.text('Passageiro A');
  assert.equal(await driver.evaluate("document.body.innerText.includes('Rastreamento ativo')"), false);
  parent = await connect(9226); await parent.login(fixture.parentEmail); await parent.text('Conectado');
  pass('Lista do motorista usa API real; nenhum GPS ativo antes do início.');
  console.log('GPS TEST PERMISSION: ' + await driver.evaluate("navigator.permissions.query({name:'geolocation'}).then(p=>p.state)"));
  console.log('GPS TEST PROVIDER: ' + JSON.stringify(await driver.evaluate("new Promise(resolve=>navigator.geolocation.getCurrentPosition(()=>resolve({ok:true}),e=>resolve({ok:false,code:e.code,message:e.message}),{timeout:5000}))")));
  await driver.evaluate("(()=>{window.__vanosGpsEvents=[];const geo=navigator.geolocation;const watch=geo.watchPosition.bind(geo);geo.watchPosition=(success,failure,options)=>watch(p=>{window.__vanosGpsEvents.push({timestamp:p.timestamp,now:Date.now(),accuracy:p.coords.accuracy});success(p)},e=>{window.__vanosGpsEvents.push({errorCode:e.code});failure?.(e)},options);return true})()");
  await driver.click('Iniciar rastreamento'); await driver.text('Rastreamento ativo · sessão local'); await driver.text('Conectado ao serviço');
  await delay(1700); await driver.call('Emulation.setGeolocationOverride', { latitude: -23.5501, longitude: -46.6301, accuracy: 5 });
  await delay(500); console.log('GPS TEST WATCH: ' + JSON.stringify(await driver.evaluate('window.__vanosGpsEvents')));
  await parent.text('Sinal recente'); await until(() => parent.evaluate("!!document.querySelector('.leaflet-overlay-pane svg path')"));
  pass('Início na UI captura GPS sintético CDP e publica no Hub real; responsável recebe marcador no mapa real.');
  await driver.click('Encerrar rastreamento'); await driver.click('Confirmar encerramento'); await driver.text('Rastreamento encerrado');
  const signalTime = () => parent.evaluate("document.body.innerText.match(/Último sinal às ([^·\\n]+)/)?.[1]");
  const previousSignal = await signalTime(); assert.equal(typeof previousSignal, 'string');
  await delay(1700); await driver.call('Emulation.setGeolocationOverride', { latitude: -23.5502, longitude: -46.6302, accuracy: 5 }); await delay(1000);
  assert.equal(await signalTime(), previousSignal);
  pass('Encerrar pela UI impede nova publicação mesmo após novo GPS sintético.');
  await driver.click('Iniciar rastreamento'); await driver.text('Conectado ao serviço'); await delay(1700);
  await driver.call('Emulation.setGeolocationOverride', { latitude: -23.5503, longitude: -46.6303, accuracy: 5 });
  await until(() => driver.evaluate("/[1-9]\\d* publicações aceitas/.test(document.body.innerText)"));
  await driver.click('Sair da conta'); await driver.text('Como você chega até aqui?');
  await driver.call('Emulation.setGeolocationOverride', { latitude: -23.5504, longitude: -46.6304, accuracy: 5 });
  await parent.text('sinal desatualizado', 40_000);
  pass('Logout remove UI privada e o mapa passa a desatualizado sem novas publicações.');
  await driver.call('Page.navigate', { url: 'http://localhost:8081/login' }); await driver.login(fixture.driverEmail); await driver.text('Passageiros vinculados');
  await driver.call('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin: 'http://localhost:8081' });
  await driver.click('Iniciar rastreamento'); await driver.text('Permita o acesso no navegador'); await driver.text('Rastreamento encerrado');
  pass('Permissão de GPS negada gera erro visível e encerra captura/envio.');
  assert.equal(exceptions.length, 0);
  await writeFile('.expo/stage4-browser-results.json', JSON.stringify({ results, runtimeExceptions: exceptions.length, gps: 'synthetic CDP', background: 'not tested' }, null, 2));
  const screenshot = await driver.call('Page.captureScreenshot', { format: 'png' });
  await writeFile('.expo/stage4-driver.png', Buffer.from(screenshot.data, 'base64'));
  await Promise.allSettled([driver.call('Browser.close'), parent.call('Browser.close')]);
} catch (error) {
  console.error(error.message);
  if (driver) console.log('GPS TEST WATCH: ' + JSON.stringify(await driver.evaluate('window.__vanosGpsEvents').catch(() => null)));
  for (const [name, page] of [['driver', driver], ['parent', parent]]) if (page) await writeFile(`.expo/stage4-${name}-failure.txt`, await page.evaluate('document.body.innerText').catch(() => 'unavailable'));
  process.exitCode = 1;
} finally { for (const socket of sockets) socket.close(); for (const browser of browsers) browser.kill(); }
