import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SYSTEM_PROMPT, RESPONSE_FORMAT } from './prompt.mjs';

export const NPCS = ['Mara', 'Oren', 'Elin'];
export const PHASES = ['village', 'adventure', 'rescued', 'complete'];
export const ROUTES = ['mystery', 'combat'];
const defaults = () => ({ combat: false, mystery: true, protectVillagers: true });
const fresh = () => ({ version: 1, activePlayerId: null, players: {}, inbox: [], metrics: { calls: 0, providerAttempts: 0, mubitCalls: 0, fallbackCalls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, lastLatencyMs: 0, errors: 0 }, recentRequests: [] });
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function string(value, name, max, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(`Invalid ${name}`);
  return value.trim();
}
export function playerFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected JSON object');
  const playerId = string(body.playerId, 'playerId', 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(playerId) || ['__proto__', 'constructor', 'prototype'].includes(playerId)) fail('Invalid playerId');
  return { playerId, playerName: string(body.playerName ?? 'Player', 'playerName', 64) };
}
export function validateInput(body) {
  const player = playerFields(body);
  if (!NPCS.includes(body.npc) || !PHASES.includes(body.phase)) fail('Invalid NPC or phase');
  const message = string(body.message, 'message', 1200);
  const worldFacts = body.worldFacts ?? {};
  const events = body.events ?? [];
  if ((!worldFacts || typeof worldFacts !== 'object') && typeof worldFacts !== 'string') fail('Invalid worldFacts');
  if (JSON.stringify(worldFacts).length > 6000 || !Array.isArray(events) || JSON.stringify(events).length > 3000) fail('World context too large');
  return { ...player, message, npc: body.npc, phase: body.phase, worldFacts, events };
}
export function validateDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid model decision');
  const dialogue = string(value.dialogue, 'dialogue', 320);
  const objective = string(value.objective, 'objective', 160);
  const reason = string(value.reason, 'reason', 240);
  if (!ROUTES.includes(value.route) || !['eerie', 'wonder'].includes(value.mood) || !Number.isInteger(value.difficulty) || value.difficulty < 1 || value.difficulty > 3) fail('Invalid scene decision');
  if (!value.preferences || ['combat', 'mystery', 'protectVillagers'].some(key => typeof value.preferences[key] !== 'boolean')) fail('Invalid preferences');
  if (/\b(?:sudo|curl|wget|eval|exec)\s|\/(?:op|give|kill|execute|tp|summon)\b|```/i.test(dialogue + objective)) fail('Commands are not narrative');
  return { dialogue, route: value.route, mood: value.mood, difficulty: value.difficulty, objective, preferences: { combat: value.preferences.combat, mystery: value.preferences.mystery, protectVillagers: true }, reason };
}

export function preferenceUpdate(message, previous) {
  // shortcut: fallback understands simple preference phrases; use Mubit for open-ended interpretation.
  const preferences = { ...previous };
  // Apply clauses in order so a later correction replaces an earlier preference.
  for (const text of message.toLowerCase().replace(/[’]/g, "'").split(/[.!?;,]+|\bbut\b/)) {
    const noCombat = /(?:no|not|avoid|skip|hate|dislike|don't (?:want|like)|do not (?:want|like)|less|not into)\s+(?:any |more |the |to )?(?:combat|fight|fighting|battles?|violence)|(?:combat|fighting)\s+(?:isn't|is not)\s+(?:for me|what i want)/.test(text);
    const noMystery = /(?:no|not|avoid|skip|hate|dislike|don't (?:want|like)|do not (?:want|like)|less|not into)\s+(?:any |more |the )?(?:mystery|mysteries|puzzles?|riddles?)/.test(text);
    const preferred = text.split(/\b(?:instead of|rather than|over)\b/)[0];
    const combat = /\b(?:combat|fight|fighting|battles?|action)\b/.test(preferred);
    const mystery = /\b(?:mystery|mysteries|puzzles?|riddles?|clues?|investigat\w*)\b/.test(preferred);
    if (noCombat) { preferences.combat = false; preferences.mystery = true; }
    else if (combat && /\b(?:want|prefer|love|like|choose|instead|rather|more|let's|lets)\b/.test(text)) { preferences.combat = true; preferences.mystery = false; }
    if (noMystery) { preferences.mystery = false; preferences.combat = true; }
    else if (mystery && /\b(?:want|prefer|love|like|choose|instead|rather|more|let's|lets)\b/.test(text)) { preferences.mystery = true; preferences.combat = false; }
    if (/\b(?:protect|save|spare|keep)\b.{0,35}\b(?:villagers?|village|people|everyone)\b/.test(text)) preferences.protectVillagers = true;
  }
  return preferences;
}

const objectiveFor = (phase, route) => phase === 'complete' ? 'Elin is home. Speak with Mara and Oren in the village.' : phase === 'rescued' ? 'Escort Elin home through the return portal.' : phase === 'adventure' ? (route === 'combat' ? 'Defeat the undead guards, then speak to Elin to free her.' : 'Activate the three rune markers, then speak to Elin to free her.') : 'Speak with Mara and Oren, then enter the village gate when ready.';

export function fallback(input, profile, cause) {
  const route = input.phase === 'village' ? (profile.preferences.combat ? 'combat' : 'mystery') : (profile.game?.route ?? profile.lastDecision?.route ?? 'mystery');
  let dialogue;
  if (input.phase === 'complete') dialogue = input.npc === 'Elin' ? 'Home at last. Thank you for following the trail and bringing me back.' : 'Elin is safely home. The village will remember what you did for us.';
  else if (input.phase === 'rescued') dialogue = input.npc === 'Elin' ? 'Thank you. Let us take the return portal home to Mara.' : 'Elin is free. Bring her home through the return portal.';
  else if (input.phase === 'adventure') dialogue = input.npc === 'Elin' ? (route === 'mystery' ? 'The seal holds me here. Activate all three rune markers, then speak to me again.' : 'The undead guards hold the seal. Defeat them, then speak to me again.') : (route === 'mystery' ? 'Look for three lit rune markers along the ruins. Each one weakens the seal around Elin.' : 'The undead guards hold the way to Elin. Keep the fight away from the village.');
  else if (input.npc === 'Oren') dialogue = route === 'mystery' ? 'The rune trail leads toward the ruins. I can help you follow the clues; enter the gate when you are ready.' : 'The guards watch the ruins beyond the gate. Prepare yourself, and keep our people safe.';
  else if (input.npc === 'Elin') dialogue = 'I am still beyond the village, held near the ruins. Follow Oren’s clues to find me.';
  else dialogue = route === 'mystery' ? 'My sister Elin vanished near the ruins. A careful search may find her; ask Oren about the runes, then enter the gate.' : 'My sister Elin is missing near the ruins. If you face the guards, please keep our villagers safe. Enter the gate when ready.';
  return { dialogue, route, mood: /\b(?:eerie|spooky|dark|haunt\w*)\b/i.test(input.message) ? 'eerie' : 'wonder', difficulty: /\b(?:hard|harder|challenge)\b/i.test(input.message) ? 3 : /\b(?:easy|easier|gentle)\b/i.test(input.message) ? 1 : 2, objective: objectiveFor(input.phase, route), preferences: { ...profile.preferences }, reason: `Local fallback: ${cause}. Preferences guide the next scene; game state controls story progress.` };
}

export class Director {
  constructor({ apiKey = process.env.MUBIT_API_KEY ?? '', model = process.env.MUBIT_MODEL ?? 'gpt-6-luna', baseUrl = process.env.MUBIT_BASE_URL ?? 'https://api.mubit.ai/openai/v1', timeoutMs = Number(process.env.MUBIT_TIMEOUT_MS ?? 15000), maxCalls = Number(process.env.MUBIT_MAX_CALLS ?? 120), runtimeDir = join(import.meta.dirname, 'runtime'), fetchImpl = fetch } = {}) {
    this.apiKey = apiKey; this.model = model; this.baseUrl = baseUrl.replace(/\/$/, ''); this.timeoutMs = Math.max(100, Math.min(timeoutMs || 15000, 30000)); this.maxCalls = Math.max(0, Math.min(maxCalls || 0, 1000)); this.runtimeDir = runtimeDir; this.fetch = fetchImpl; this.data = fresh(); this.busy = new Set(); this.pendingSave = Promise.resolve(); this.providerCalls = 0;
    const url = new URL(this.baseUrl);
    if (url.origin !== 'https://api.mubit.ai' || url.pathname.replace(/\/$/, '') !== '/openai/v1' || url.search || url.hash || url.username || url.password) throw new Error('MUBIT_BASE_URL must be https://api.mubit.ai/openai/v1');
  }
  async init() {
    if (!this.runtimeDir) return;
    await mkdir(this.runtimeDir, { recursive: true, mode: 0o700 });
    try {
      const saved = JSON.parse(await readFile(join(this.runtimeDir, 'state.json'), 'utf8'));
      if (saved.version === 1 && saved.players && saved.metrics && Array.isArray(saved.inbox) && Object.keys(saved.players).length <= 20) this.data = saved;
    } catch (error) { if (error.code !== 'ENOENT') console.warn('Director state unavailable; starting a new local session.'); }
  }
  async save() {
    if (!this.runtimeDir) return;
    const snapshot = JSON.stringify(this.data);
    this.pendingSave = this.pendingSave.catch(() => {}).then(async () => {
      const temp = join(this.runtimeDir, 'state.json.tmp');
      await writeFile(temp, snapshot, { mode: 0o600 });
      await rename(temp, join(this.runtimeDir, 'state.json'));
    });
    await this.pendingSave;
  }
  profile(playerId, playerName) {
    if (!Object.hasOwn(this.data.players, playerId)) {
      if (Object.keys(this.data.players).length >= 20) fail('Player limit reached; start a new story', 429);
      this.data.players[playerId] = { playerId, playerName, sessionId: randomUUID(), preferences: defaults(), conversation: [], preferenceHistory: [], observations: [], game: null, lastDecision: null };
    }
    this.data.activePlayerId = playerId;
    this.data.players[playerId].playerName = playerName;
    return this.data.players[playerId];
  }
  health() { return { ok: true, mode: this.apiKey ? 'mubit' : 'fallback', model: this.model, configured: Boolean(this.apiKey) }; }
  state() {
    const profile = this.data.players[this.data.activePlayerId];
    return { ...this.health(), mode: profile?.lastDecision?.source ?? this.health().mode, playerId: profile?.playerId ?? null, playerName: profile?.playerName ?? null, sessionId: profile?.sessionId ?? null, game: profile?.game ?? null, conversation: profile?.conversation ?? [], preferences: profile?.preferences ?? defaults(), preferenceHistory: profile?.preferenceHistory ?? [], observations: profile?.observations ?? [], metrics: this.data.metrics, recentRequests: this.data.recentRequests, lastDecision: profile?.lastDecision ?? null, pendingInputs: this.data.inbox.length };
  }
  async gameState(body) {
    const player = playerFields(body);
    if (!PHASES.includes(body.phase) || (body.route != null && !ROUTES.includes(body.route)) || (body.npc != null && !NPCS.includes(body.npc))) fail('Invalid game state');
    const profile = this.profile(player.playerId, player.playerName);
    if (body.objective != null) string(body.objective, 'objective', 160, false);
    if (body.mood != null && !['eerie', 'wonder'].includes(body.mood)) fail('Invalid mood');
    if (body.difficulty != null && (!Number.isInteger(body.difficulty) || body.difficulty < 1 || body.difficulty > 3)) fail('Invalid difficulty');
    if (body.building != null && typeof body.building !== 'boolean') fail('Invalid building flag');
    if (body.world != null) string(body.world, 'world', 128, false);
    if (body.questProgress != null && (typeof body.questProgress !== 'number' || !Number.isFinite(body.questProgress)) && typeof body.questProgress !== 'string' && typeof body.questProgress !== 'object') fail('Invalid questProgress');
    if (JSON.stringify(body.questProgress ?? null).length > 2000) fail('Quest progress too large');
    profile.game = { ...player, phase: body.phase, route: body.route ?? profile.game?.route ?? null, mood: body.mood ?? profile.game?.mood ?? null, difficulty: body.difficulty ?? profile.game?.difficulty ?? null, building: body.building ?? false, world: body.world ?? profile.game?.world ?? '', objective: body.objective ?? '', questProgress: body.questProgress ?? null, npc: body.npc ?? 'Mara', updatedAt: new Date().toISOString() };
    await this.save();
    return { ok: true, game: profile.game, sessionId: profile.sessionId };
  }
  async input(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected JSON object');
    const message = string(body.message, 'message', 1200);
    if (body.npc != null && !NPCS.includes(body.npc)) fail('Invalid NPC');
    if (!this.data.activePlayerId) fail('Join the Minecraft world before sending dialogue', 409);
    if (this.data.inbox.length >= 10) fail('Dialogue queue is full', 429);
    const item = { id: randomUUID(), message, ...(body.npc ? { npc: body.npc } : {}), playerId: this.data.activePlayerId };
    this.data.inbox.push(item); await this.save();
    return { ok: true, queued: true, id: item.id };
  }
  async inbox(playerId) {
    playerFields({ playerId });
    const index = this.data.inbox.findIndex(item => item.playerId === playerId);
    const messages = index < 0 ? [] : this.data.inbox.splice(index, 1).map(({ playerId: ignored, ...item }) => item);
    if (messages.length) await this.save();
    return { messages };
  }
  async reset() {
    if (this.busy.size) fail('Wait for the current dialogue before resetting', 409);
    this.data = fresh(); await this.save(); return { ok: true, requiresGameReset: true, message: 'Narrative memory cleared. Use /everafter reset to coordinate the Minecraft world.' };
  }
  async direct(body) {
    const input = validateInput(body);
    if (this.busy.has(input.playerId)) fail('A dialogue request is already running', 429);
    if (this.busy.size >= 3) fail('Director is busy', 429);
    const profile = this.profile(input.playerId, input.playerName);
    this.busy.add(input.playerId);
    try {
      const start = performance.now(); const requestId = randomUUID(); const gameAtStart = profile.game;
      const prior = { ...profile.preferences };
      profile.preferences = preferenceUpdate(input.message, profile.preferences);
      profile.observations = [...(profile.observations ?? []), { phase: input.phase, worldFacts: input.worldFacts, events: input.events, at: new Date().toISOString() }].slice(-20);
      let source = 'fallback'; let decision; let providerRequestId = null; let errorCode = null; let gatewayErrorCode = null; let usage = {};
      let cause = !this.apiKey ? 'Mubit key not configured' : this.providerCalls >= this.maxCalls ? 'session request budget reached' : null;
      if (!cause) {
        this.providerCalls++;
        this.data.metrics.providerAttempts = (this.data.metrics.providerAttempts ?? 0) + 1;
        try {
          // Mubit derives sessions from this stable first user message; starter credit rejects stored metadata.
          const response = await this.fetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({ sessionId: profile.sessionId, playerId: input.playerId }) }, { role: 'user', content: JSON.stringify({ ...input, player: { id: input.playerId, name: input.playerName }, game: profile.game, memory: { preferences: prior, provisionalFallbackPreferences: profile.preferences, preferenceHistory: profile.preferenceHistory.slice(-8), observations: profile.observations.slice(-3), conversation: profile.conversation.slice(-12) } }) }], response_format: RESPONSE_FORMAT, max_completion_tokens: 600 }), signal: AbortSignal.timeout(this.timeoutMs) });
          providerRequestId = (response.headers.get('x-middleware-request-id') ?? response.headers.get('x-request-id'))?.slice(0, 128) ?? null;
          if (!response.ok) {
            try {
              const body = await response.text();
              const code = body.length <= 16000 ? JSON.parse(body).error?.code : null;
              if (typeof code === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(code)) gatewayErrorCode = code;
            } catch { /* Error messages may contain sensitive data; only a bounded code is retained. */ }
            throw Object.assign(new Error('Gateway rejected request'), { code: `http_${response.status}` });
          }
          const rawText = await response.text();
          if (rawText.length > 64000) throw Object.assign(new Error('Oversized gateway response'), { code: 'oversized_response' });
          const raw = JSON.parse(rawText);
          usage = raw.usage ?? {};
          decision = validateDecision(JSON.parse(raw.choices?.[0]?.message?.content));
          source = 'mubit';
        } catch (error) {
          errorCode = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : error.code?.startsWith('http_') ? error.code : 'invalid_or_unavailable_response';
          cause = gatewayErrorCode ? `${errorCode}:${gatewayErrorCode}` : errorCode; this.data.metrics.errors++;
        }
      }
      if (source === 'fallback') decision = fallback(input, profile, cause);
      const phase = profile.game && profile.game !== gameAtStart ? profile.game.phase : input.phase;
      if (phase !== input.phase) {
        source = 'fallback'; decision = fallback({ ...input, phase: profile.game.phase }, profile, 'game phase changed while the director was replying');
      }
      if (input.phase !== 'village') decision.route = profile.game?.route ?? profile.lastDecision?.route ?? decision.route;
      decision.objective = objectiveFor(phase, decision.route);
      const finalPreferences = decision.preferences;
      if (JSON.stringify(prior) !== JSON.stringify(finalPreferences)) profile.preferenceHistory = [...profile.preferenceHistory, { at: new Date().toISOString(), previous: prior, current: { ...finalPreferences }, evidence: input.message }].slice(-20);
      profile.preferences = finalPreferences;
      const latencyMs = Math.round(performance.now() - start);
      const result = { ...decision, source, latencyMs, requestId, model: this.model, sessionId: profile.sessionId };
      profile.conversation = [...profile.conversation, { role: 'user', npc: input.npc, text: input.message, at: new Date().toISOString() }, { role: 'assistant', npc: input.npc, text: result.dialogue, at: new Date().toISOString(), source }].slice(-40);
      profile.lastDecision = result;
      const metrics = this.data.metrics; metrics.calls++; metrics[source === 'mubit' ? 'mubitCalls' : 'fallbackCalls']++; metrics.lastLatencyMs = latencyMs;
      for (const [key, providerKey] of [['promptTokens', 'prompt_tokens'], ['completionTokens', 'completion_tokens'], ['totalTokens', 'total_tokens']]) if (Number.isFinite(usage[providerKey]) && usage[providerKey] >= 0) metrics[key] += usage[providerKey];
      const tokens = Object.fromEntries(['prompt_tokens', 'completion_tokens', 'total_tokens'].map(key => [key, Number.isFinite(usage[key]) && usage[key] >= 0 ? usage[key] : null]));
      this.data.recentRequests = [...this.data.recentRequests, { requestId, providerRequestId, sessionId: profile.sessionId, source, latencyMs, tokens, errorCode, gatewayErrorCode, at: new Date().toISOString() }].slice(-40);
      await this.save(); return result;
    } finally { this.busy.delete(input.playerId); }
  }
}
