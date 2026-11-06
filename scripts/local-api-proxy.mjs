import http from 'node:http';

// Browser development only. Fixed loopback target; no credentials or payload logging.
const allowedOrigins = new Set(['http://localhost:8081', 'http://127.0.0.1:8081']);
const allowedMethods = new Set(['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']);
function allowedPath(url) {
  const path = (url ?? '').split('?')[0];
  return !url?.includes('\\') && (path.startsWith('/api/') || path === '/hubs/tracking' || path === '/hubs/tracking/negotiate');
}
const server = http.createServer((request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    response.writeHead(403).end();
    return;
  }
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-SignalR-User-Agent');
  response.setHeader('Cache-Control', 'no-store');
  if (!allowedMethods.has(request.method) || !allowedPath(request.url)) {
    response.writeHead(404).end();
    return;
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  const headers = { ...request.headers, host: '127.0.0.1:5107' };
  delete headers.origin;
  const upstream = http.request({ hostname: '127.0.0.1', port: 5107, path: request.url, method: request.method, headers }, (result) => {
    const forwardedHeaders = { ...result.headers };
    delete forwardedHeaders['access-control-allow-origin'];
    delete forwardedHeaders['access-control-allow-credentials'];
    delete forwardedHeaders['cache-control'];
    response.writeHead(result.statusCode ?? 502, forwardedHeaders);
    result.pipe(response);
  });
  upstream.setTimeout(request.url.startsWith('/hubs/') ? 120_000 : 15_000, () => upstream.destroy());
  upstream.on('error', () => {
    if (response.headersSent) { response.destroy(); return; }
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: 'API local indisponível.' }));
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
});
server.on('upgrade', (request, socket, head) => {
  if ((request.headers.origin && !allowedOrigins.has(request.headers.origin)) ||
    (request.url ?? '').split('?')[0] !== '/hubs/tracking' || !allowedPath(request.url)) {
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return;
  }
  const headers = { ...request.headers, host: '127.0.0.1:5107' };
  delete headers.origin;
  const upstream = http.request({ hostname: '127.0.0.1', port: 5107, path: request.url, method: 'GET', headers });
  upstream.on('upgrade', (result, peer, peerHead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(result.headers).map(([key, value]) => `${key}: ${value}\r\n`).join('')}\r\n`);
    if (peerHead.length) socket.write(peerHead);
    if (head.length) peer.write(head);
    socket.pipe(peer); peer.pipe(socket);
    socket.on('error', () => peer.destroy()); peer.on('error', () => socket.destroy());
    socket.on('close', () => peer.destroy()); peer.on('close', () => socket.destroy());
  });
  upstream.on('response', (result) => { socket.end(`HTTP/1.1 ${result.statusCode ?? 502} Rejected\r\nConnection: close\r\n\r\n`); result.resume(); });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  upstream.end();
});
server.on('error', (error) => { console.error(`Proxy local: ${error.code ?? 'falha ao iniciar'}`); process.exitCode = 1; });
server.listen(5108, '127.0.0.1', () => {
  console.log('Proxy de desenvolvimento: http://localhost:5108 → http://127.0.0.1:5107');
  console.log('Origens permitidas: http://localhost:8081 e http://127.0.0.1:8081. Ctrl+C encerra.');
});
