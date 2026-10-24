import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pcmWave, speechInput, SpeechService } from '../speech.mjs';
import { createDirectorServer } from '../server.mjs';
import { Director } from '../director.mjs';

const input = { text: 'Oren knows the trail to Elin.', npc: 'Mara', requestId: 'test-1' };
const audio = () => pcmWave(Buffer.alloc(4800));

test('speech accepts only known characters, bounded text and safe identifiers', () => {
  assert.equal(speechInput(input).npc, 'Mara');
  assert.equal(speechInput({ ...input, requestId: '' }).npc, 'Mara');
  for (const invalid of [{ ...input, npc: '__proto__' }, { ...input, text: '' }, { ...input, text: 'a'.repeat(321) }, { ...input, text: 'x\ncommand' }, { ...input, requestId: '../secret' }]) assert.throws(() => speechInput(invalid));
  const wav = audio();
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.readUInt32LE(24), 24000); assert.equal(wav.readUInt32LE(40), 4800);
  assert.throws(() => pcmWave(Buffer.alloc(3)));
});

test('hosted speech uses distinct voices, wraps PCM and caches repeated replies', async () => {
  const sent = [];
  const service = new SpeechService({ apiKey: 'private-key', fetchImpl: async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return new Response(Buffer.alloc(2400), { headers: { 'content-type': 'audio/pcm' } }); }, localImpl: async () => { throw Error('unexpected local'); } });
  const first = await service.speak(input);
  assert.equal(first.source, 'openrouter'); assert.equal(first.audio.length, 2444); assert.equal(first.cached, false);
  assert.equal((await service.speak(input)).cached, true);
  await service.speak({ ...input, npc: 'Oren' });
  assert.equal(sent.length, 2); assert.equal(sent[0].url, 'https://openrouter.ai/api/v1/audio/speech');
  assert.equal(sent[0].body.voice, 'Kore'); assert.equal(sent[1].body.voice, 'Puck');
  assert.equal(sent[0].body.response_format, 'pcm'); assert.equal(JSON.stringify(first).includes('private-key'), false);
});

test('failed paid speech falls back locally and auth/credit errors stop later cloud attempts', async () => {
  let calls = 0;
  const service = new SpeechService({ apiKey: 'key', fetchImpl: async () => { calls++; return new Response('{}', { status: 402 }); }, localImpl: async () => audio() });
  assert.equal((await service.speak(input)).source, 'macos');
  assert.equal((await service.speak({ ...input, text: 'Another reply.' })).source, 'macos');
  assert.equal(calls, 1);
});

test('speech budget persists across restarts and a corrupt budget fails closed for paid calls', async t => {
  const runtimeDir = await mkdtemp(join(tmpdir(), 'everafter-speech-test-'));
  t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  let calls = 0;
  const options = { runtimeDir, maxCalls: 1, apiKey: 'key', fetchImpl: async () => { calls++; return new Response(Buffer.alloc(2400), { headers: { 'content-type': 'audio/pcm' } }); }, localImpl: async () => audio() };
  const first = new SpeechService(options); await first.init(); await first.speak(input);
  assert.equal(JSON.parse(await readFile(join(runtimeDir, 'speech-usage.json'))).attempts, 1);
  const second = new SpeechService(options); await second.init(); assert.equal((await second.speak(input)).source, 'macos'); assert.equal(calls, 1);
  await writeFile(join(runtimeDir, 'speech-usage.json'), 'broken');
  const third = new SpeechService(options); await third.init(); await third.speak(input); assert.equal(calls, 1);
});

test('paid voice HTTP route requires the game capability and rejects cross-site requests', async t => {
  const speech = new SpeechService({ apiKey: '', localImpl: async () => audio() });
  const { server, clientToken } = await createDirectorServer({ director: new Director({ apiKey: '', runtimeDir: null }), speech });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = headers => fetch(base + '/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input) });
  assert.equal((await post({})).status, 403);
  assert.equal((await post({ 'X-Everafter-Token': 'a'.repeat(64) })).status, 403);
  assert.equal((await post({ 'X-Everafter-Token': clientToken, Origin: 'https://evil.example' })).status, 403);
  const ok = await post({ 'X-Everafter-Token': clientToken });
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'audio/wav'); assert.equal(ok.headers.get('x-everafter-speech-source'), 'macos');
  assert.equal((await ok.arrayBuffer()).byteLength, audio().length);
});
