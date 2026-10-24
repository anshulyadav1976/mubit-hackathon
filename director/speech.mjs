import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const VOICES = { Mara: { cloud: 'Kore', local: 'Samantha', style: 'A warm, grounded village blacksmith, concerned for her sister. Natural British English, conversational.' }, Oren: { cloud: 'Puck', local: 'Daniel', style: 'An older village archivist, thoughtful and quietly mysterious. Natural British English, conversational.' }, Elin: { cloud: 'Leda', local: 'Karen', style: 'A young adult adventurer, hopeful and relieved. Natural British English, conversational.' } };
const MAX_AUDIO = 24000 * 2 * 40;
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export function pcmWave(pcm, sampleRate = 24000) {
  if (!Buffer.isBuffer(pcm) || pcm.length < 2 || pcm.length > MAX_AUDIO || pcm.length % 2) throw bad('Invalid speech audio', 502);
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function speechInput(body) {
  if (!body || !Object.hasOwn(VOICES, body.npc) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 320 || /[\u0000-\u001f]/.test(body.text)) throw bad('Expected an NPC reply of 1–320 characters');
  if (body.requestId !== undefined && body.requestId !== '' && (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.requestId))) throw bad('Invalid reply identifier');
  return { npc: body.npc, text: body.text.trim() };
}

export async function localSpeech({ text, npc }) {
  if (process.platform !== 'darwin') throw bad('Speech unavailable; the reply is shown as text.', 503);
  const folder = await mkdtemp(join(tmpdir(), 'everafter-speech-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['MUBIT_API_KEY', 'OPENROUTER_API_KEY'].includes(key)));
  try {
    const input = join(folder, 'reply.txt'), aiff = join(folder, 'reply.aiff'), wav = join(folder, 'reply.wav');
    await writeFile(input, text, { mode: 0o600 });
    await run('/usr/bin/say', ['-v', VOICES[npc].local, '-r', '170', '-f', input, '-o', aiff], { env, timeout: 15000, maxBuffer: 16384 });
    await run('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', '-c', '1', aiff, wav], { env, timeout: 10000, maxBuffer: 16384 });
    const audio = await readFile(wav);
    if (audio.length < 44 || audio.length > MAX_AUDIO + 4096 || audio.toString('ascii', 0, 4) !== 'RIFF') throw bad('Local speech produced invalid audio', 502);
    return audio;
  } finally { await rm(folder, { recursive: true, force: true }); }
}

export class SpeechService {
  constructor({ apiKey = process.env.OPENROUTER_API_KEY ?? '', model = process.env.OPENROUTER_TTS_MODEL ?? 'google/gemini-3.8-flash-lite-tts', maxCalls = 100, runtimeDir = null, fetchImpl = fetch, localImpl = localSpeech } = {}) {
    this.apiKey = apiKey; this.model = model; this.maxCalls = maxCalls; this.runtimeDir = runtimeDir; this.fetch = fetchImpl; this.local = localImpl;
    this.used = 0; this.active = false; this.cloudDisabled = false; this.cache = new Map();
  }
  async init() {
    if (!this.runtimeDir) return;
    await mkdir(this.runtimeDir, { recursive: true, mode: 0o700 });
    try {
      const saved = JSON.parse(await readFile(join(this.runtimeDir, 'speech-usage.json'), 'utf8'));
      if (!Number.isInteger(saved.attempts) || saved.attempts < 0) throw Error('Invalid speech budget');
      this.used = saved.attempts;
    } catch (error) { if (error.code !== 'ENOENT') this.cloudDisabled = true; }
  }
  async reserve() {
    this.used++;
    if (!this.runtimeDir) return;
    const file = join(this.runtimeDir, 'speech-usage.json');
    await writeFile(file + '.tmp', JSON.stringify({ attempts: this.used, updatedAt: new Date().toISOString() }), { mode: 0o600 });
    await rename(file + '.tmp', file);
  }
  async speak(body) {
    const input = speechInput(body);
    const key = createHash('sha256').update(input.npc + '\0' + input.text).digest('hex');
    if (this.cache.has(key)) return { ...this.cache.get(key), cached: true };
    if (this.active) throw bad('An NPC is already preparing a voice reply. Try again shortly.', 429);
    this.active = true;
    try {
      let result;
      if (this.apiKey && !this.cloudDisabled && this.used < this.maxCalls) {
        try {
          await this.reserve();
          const response = await this.fetch('https://openrouter.ai/api/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.model, input: input.text, voice: VOICES[input.npc].cloud, instructions: VOICES[input.npc].style, response_format: 'pcm' }), signal: AbortSignal.timeout(20000) });
          if (!response.ok) { if ([401, 402, 403].includes(response.status)) this.cloudDisabled = true; throw bad('Cloud voice unavailable', 502); }
          if (!response.headers.get('content-type')?.startsWith('audio/')) throw bad('Unexpected cloud speech format', 502);
          const chunks = []; let size = 0;
          for await (const chunk of response.body) { size += chunk.length; if (size > MAX_AUDIO) throw bad('Speech reply is too long', 502); chunks.push(chunk); }
          result = { audio: pcmWave(Buffer.concat(chunks)), source: 'openrouter', model: this.model };
        } catch { /* Keep subtitles and local speech working when hosted voice is unavailable. */ }
      }
      if (!result) result = { audio: await this.local(input), source: 'macos', model: VOICES[input.npc].local };
      this.cache.set(key, result);
      if (this.cache.size > 12) this.cache.delete(this.cache.keys().next().value);
      return { ...result, cached: false };
    } finally { this.active = false; }
  }
}
