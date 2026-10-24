import http from 'node:http';
import { readFile, realpath, stat, writeFile, rename } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Director } from './director.mjs';
import { transcribe, voiceAvailable } from './voice.mjs';
import { SpeechService } from './speech.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
export function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}
export async function readJson(request, limit = 16384) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw Object.assign(new Error('Content-Type must be application/json'), { status: 415 });
  if (Number(request.headers['content-length'] ?? 0) > limit) throw Object.assign(new Error('Request body too large'), { status: 413 });
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Malformed JSON body'), { status: 400 }); }
}

export async function createDirectorServer({ director = new Director(), publicDir = join(import.meta.dirname, 'public'), speech = new SpeechService({ runtimeDir: director.runtimeDir }) } = {}) {
  await director.init();
  await speech.init();
  const clientToken = randomBytes(32).toString('hex');
  if (director.runtimeDir) {
    const file = join(director.runtimeDir, 'client-token');
    await writeFile(file + '.tmp', clientToken, { mode: 0o600 });
    await rename(file + '.tmp', file);
  }
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const port = server.address()?.port;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(request.headers.host) || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) return json(response, 403, { error: 'Loopback host required' });
      const origins = hosts.map(host => `http://${host}`);
      if (request.headers.origin && !origins.includes(request.headers.origin)) return json(response, 403, { error: 'Origin not allowed' });
      if (request.headers.origin) { response.setHeader('Access-Control-Allow-Origin', request.headers.origin); response.setHeader('Vary', 'Origin'); }
      if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return response.end(); }
      if (request.url.length > 2048 || /(?:%2e|%2f|%5c|\\)/i.test(request.url) || request.url.split('?')[0].split('/').includes('..')) return json(response, 400, { error: 'Invalid path' });
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ...director.health(), voiceAvailable: await voiceAvailable() });
      if (request.method === 'POST' && url.pathname === '/api/speech') {
        const supplied = request.headers['x-everafter-token'];
        if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(clientToken))) return json(response, 403, { error: 'Open an NPC conversation in Minecraft before requesting speech.' });
        const spoken = await speech.speak(await readJson(request, 4096));
        response.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': spoken.audio.length, 'Cache-Control': 'no-store', 'X-Everafter-Speech-Source': spoken.source, 'X-Everafter-Speech-Cached': String(spoken.cached) });
        return response.end(spoken.audio);
      }
      if (request.method === 'POST' && url.pathname === '/api/transcribe') return json(response, 200, await transcribe(request));
      if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, director.state());
      if (request.method === 'GET' && url.pathname === '/api/inbox') return json(response, 200, await director.inbox(url.searchParams.get('playerId')));
      if (request.method === 'POST') {
        const methods = { '/api/director': 'direct', '/api/game-state': 'gameState', '/api/input': 'input', '/api/reset': 'reset' };
        if (Object.hasOwn(methods, url.pathname)) {
          const body = await readJson(request);
          return json(response, 200, await director[methods[url.pathname]](body));
        }
      }
      if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Unknown API endpoint' });
      if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { error: 'Method not allowed' });
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { return json(response, 400, { error: 'Invalid path encoding' }); }
      const root = await realpath(publicDir);
      let file;
      try { file = await realpath(resolve(root, `.${path === '/' ? '/index.html' : path}`)); } catch { return json(response, 404, { error: 'File not found' }); }
      if (!file.startsWith(root + sep)) return json(response, 403, { error: 'Path not allowed' });
      if (!MIME[extname(file)] || !(await stat(file)).isFile()) return json(response, 404, { error: 'File not found' });
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': MIME[extname(file)], 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!response.headersSent) json(response, error.status ?? 500, { error: error.status ? error.message : 'Director could not complete this request' });
      else response.end();
    }
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 40;
  return { server, director, clientToken };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.DIRECTOR_PORT ?? 8765);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid DIRECTOR_PORT');
  const { server, director } = await createDirectorServer();
  server.listen(port, '127.0.0.1', () => console.log(`EVERAFTER director: http://127.0.0.1:${port} (${director.health().mode}; ${director.model})`));
}
