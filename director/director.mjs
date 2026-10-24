import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SYSTEM_PROMPT, RESPONSE_FORMAT, STORY_CONTRACT_VERSION } from './prompt.mjs';
import { REALMS, TRIALS, TWISTS, INTENTS, STAGES, defaultChapter, factsOf, objectiveFor, chapterForMessage, storyDialogue } from './story.mjs';

export const NPCS = ['Mara', 'Oren', 'Elin', 'Ivo', 'Sentinel', 'Warden'];
export const PHASES = ['village', 'adventure', 'rescued', 'complete'];
export const ROUTES = ['mystery', 'combat', 'hybrid'];
const tokenKeys = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
const reportedTokens = usage => Object.fromEntries(tokenKeys.map(key => [key, Number.isFinite(usage?.[key]) && usage[key] >= 0 ? usage[key] : null]));
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
  if (Array.isArray(worldFacts) || ((!worldFacts || typeof worldFacts !== 'object') && typeof worldFacts !== 'string')) fail('Invalid worldFacts');
  if (typeof worldFacts === 'object' && worldFacts.questStage != null && !STAGES.includes(worldFacts.questStage)) fail('Invalid questStage');
  if (JSON.stringify(worldFacts).length > 6000 || !Array.isArray(events) || JSON.stringify(events).length > 3000) fail('World context too large');
  return { ...player, message, npc: body.npc, phase: body.phase, worldFacts, events };
}
export function validateChapter(value, route = 'mystery') {
  if (value === undefined) return defaultChapter(route);
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid chapter');
  const chapter = { ...defaultChapter(route, REALMS.includes(value.realm) ? value.realm : 'ember_keep'), ...value };
  if (!REALMS.includes(chapter.realm) || !TRIALS.includes(chapter.trial) || !TWISTS.includes(chapter.twist)) fail('Invalid chapter choice');
  return { realm: chapter.realm, trial: chapter.trial, twist: chapter.twist, title: string(chapter.title, 'chapter title', 64), hook: string(chapter.hook, 'chapter hook', 160) };
}
export function validateDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid model decision');
  const dialogue = string(value.dialogue, 'dialogue', 320);
  const objective = string(value.objective, 'objective', 160);
  const reason = string(value.reason, 'reason', 240);
  if (!ROUTES.includes(value.route) || !['eerie', 'wonder'].includes(value.mood) || !Number.isInteger(value.difficulty) || value.difficulty < 1 || value.difficulty > 3) fail('Invalid scene decision');
  if (!value.preferences || ['combat', 'mystery', 'protectVillagers'].some(key => typeof value.preferences[key] !== 'boolean')) fail('Invalid preferences');
  if (/\b(?:sudo|curl|wget|eval|exec)\s|\/(?:op|give|kill|execute|tp|summon)\b|```/i.test(dialogue + objective)) fail('Commands are not narrative');
  const chapter = validateChapter(value.chapter, value.route);
  const intent = value.intent === undefined ? 'none' : value.intent;
  if (!INTENTS.includes(intent)) fail('Invalid intent');
  const answer = string(value.answer === undefined ? '' : value.answer, 'answer', 40, false);
  if (/\b(?:sudo|curl|wget|eval|exec)\s|\/(?:op|give|kill|execute|tp|summon)\b|```/i.test(chapter.title + chapter.hook + answer)) fail('Commands are not narrative');
  return { chapter, intent, answer, dialogue, route: value.route, mood: value.mood, difficulty: value.difficulty, objective, preferences: { combat: value.preferences.combat, mystery: value.preferences.mystery, protectVillagers: true }, reason };
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
    if (/\b(?:both|mix|mixture|a bit of each|bit of both)\b/.test(text)) { preferences.combat = true; preferences.mystery = true; }
    if (/\b(?:protect|save|spare|keep)\b.{0,35}\b(?:villagers?|village|people|everyone)\b/.test(text)) preferences.protectVillagers = true;
  }
  return preferences;
}

export function fallback(input, profile, cause) {
  const facts = factsOf(input, profile.game);
  const locked = facts.areaCommitted === true || profile.game?.areaCommitted === true || input.phase !== 'village';
  const route = locked ? (profile.game?.route ?? profile.lastDecision?.route ?? 'mystery') : profile.preferences.combat && profile.preferences.mystery ? 'hybrid' : profile.preferences.combat ? 'combat' : 'mystery';
  const chapter = locked ? validateChapter(profile.game?.chapter ?? facts.chapter ?? profile.lastDecision?.chapter, route) : chapterForMessage(input.message, profile.lastDecision?.chapter, route, profile.lastDecision?.route);
  let intent = 'none', answer = '';
  if (input.phase === 'adventure') {
    if (/\b(?:bargain|spare|peace|mercy|negotiate)\b/i.test(input.message)) intent = 'bargain';
    else if (/\b(?:challenge|fight|attack|face you)\b/i.test(input.message) && ['Sentinel','Warden'].includes(input.npc)) intent = 'challenge';
    else if (facts.questStage === 'trial' && ['Ivo','Oren'].includes(input.npc) && !/\?|\b(?:hint|help|riddle|what|how)\b/i.test(input.message)) {
      const proposed = input.message.replace(/^(?:my answer is|the answer is|i think (?:it is|it's)|it is|it's)\s+/i, '').replace(/[.!]+$/, '').trim();
      if (proposed && proposed.length <= 40) { intent = 'answer'; answer = proposed; }
    }
  }
  return { dialogue: storyDialogue(input, profile, chapter, facts), route, chapter, intent, answer,
    mood: /\b(?:eerie|spooky|dark|haunt\w*)\b/i.test(input.message) ? 'eerie' : 'wonder',
    difficulty: /\b(?:hard|harder|challenge)\b/i.test(input.message) ? 3 : /\b(?:easy|easier|gentle)\b/i.test(input.message) ? 1 : 2,
    objective: objectiveFor(input.phase, facts, profile.game), preferences: { ...profile.preferences },
    reason: `Local fallback: ${cause}. Authored chapter and proposed actions remain subject to game validation.` };
}

export class Director {
  constructor({ apiKey = process.env.MUBIT_API_KEY ?? '', model = process.env.MUBIT_MODEL ?? 'gpt-6-luna', openRouterApiKey = process.env.OPENROUTER_API_KEY ?? '', openRouterModel = process.env.OPENROUTER_TEXT_MODEL ?? 'google/gemini-2.5-flash-lite', baseUrl = process.env.MUBIT_BASE_URL ?? 'https://api.mubit.ai/openai/v1', timeoutMs = Number(process.env.MUBIT_TIMEOUT_MS ?? 15000), maxCalls = Number(process.env.MUBIT_MAX_CALLS ?? 120), runtimeDir = join(import.meta.dirname, 'runtime'), fetchImpl = fetch } = {}) {
    this.apiKey = apiKey; this.model = model; this.openRouterApiKey = openRouterApiKey; this.openRouterModel = openRouterModel; this.baseUrl = baseUrl.replace(/\/$/, ''); this.timeoutMs = Math.max(100, Math.min(timeoutMs || 15000, 30000)); this.maxCalls = Math.max(0, Math.min(maxCalls || 0, 1000)); this.runtimeDir = runtimeDir; this.fetch = fetchImpl; this.data = fresh(); this.busy = new Set(); this.pendingSave = Promise.resolve(); this.providerCalls = 0;
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
  health() { return { ok: true, contractVersion: STORY_CONTRACT_VERSION, mode: this.apiKey ? 'mubit' : 'fallback', model: this.model, configured: Boolean(this.apiKey) }; }
  state() {
    const profile = this.data.players[this.data.activePlayerId];
    return { ...this.health(), mode: profile?.lastDecision?.source ?? this.health().mode, playerId: profile?.playerId ?? null, playerName: profile?.playerName ?? null, sessionId: profile?.sessionId ?? null, game: profile?.game ?? null, conversation: profile?.conversation ?? [], preferences: profile?.preferences ?? defaults(), preferenceHistory: profile?.preferenceHistory ?? [], observations: profile?.observations ?? [], metrics: this.data.metrics, recentRequests: this.data.recentRequests, lastDecision: profile?.lastDecision ?? null, pendingInputs: this.data.inbox.length };
  }
  async gameState(body) {
    const player = playerFields(body);
    if (!PHASES.includes(body.phase) || (body.route != null && !ROUTES.includes(body.route)) || (body.npc != null && !NPCS.includes(body.npc))) fail('Invalid game state');
    const profile = this.profile(player.playerId, player.playerName);
    if (body.areaCommitted != null && typeof body.areaCommitted !== 'boolean') fail('Invalid areaCommitted');
    if (body.questStage != null && !STAGES.includes(body.questStage)) fail('Invalid questStage');
    const chapter = body.chapter === undefined ? profile.game?.chapter ?? null : validateChapter(body.chapter, body.route);
    const worldFacts = body.worldFacts ?? {};
    if (!worldFacts || typeof worldFacts !== 'object' || Array.isArray(worldFacts) || JSON.stringify(worldFacts).length > 6000) fail('Invalid worldFacts');
    if (body.objective != null) string(body.objective, 'objective', 160, false);
    if (body.mood != null && !['eerie', 'wonder'].includes(body.mood)) fail('Invalid mood');
    if (body.difficulty != null && (!Number.isInteger(body.difficulty) || body.difficulty < 1 || body.difficulty > 3)) fail('Invalid difficulty');
    if (body.building != null && typeof body.building !== 'boolean') fail('Invalid building flag');
    if (body.world != null) string(body.world, 'world', 128, false);
    if (body.questProgress != null && (typeof body.questProgress !== 'number' || !Number.isFinite(body.questProgress)) && typeof body.questProgress !== 'string' && typeof body.questProgress !== 'object') fail('Invalid questProgress');
    if (JSON.stringify(body.questProgress ?? null).length > 2000) fail('Quest progress too large');
    profile.game = { ...player, chapter, areaCommitted: body.areaCommitted ?? body.phase !== 'village', questStage: body.questStage ?? profile.game?.questStage ?? 'arrival', worldFacts, phase: body.phase, route: body.route ?? profile.game?.route ?? null, mood: body.mood ?? profile.game?.mood ?? null, difficulty: body.difficulty ?? profile.game?.difficulty ?? null, building: body.building ?? false, world: body.world ?? profile.game?.world ?? '', objective: body.objective ?? '', questProgress: body.questProgress ?? null, npc: body.npc ?? 'Mara', updatedAt: new Date().toISOString() };
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
      let source = 'fallback'; let resultModel = this.model; let decision; const attempts = []; let providerRequestId = null; let errorCode = null; let gatewayErrorCode = null; let usage = {};
      let cause = !this.apiKey ? 'Mubit key not configured' : this.providerCalls >= this.maxCalls ? 'session request budget reached' : null;
      const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({ sessionId: profile.sessionId, playerId: input.playerId }) }, { role: 'user', content: JSON.stringify({ ...input, player: { id: input.playerId, name: input.playerName }, game: profile.game, memory: { preferences: prior, provisionalFallbackPreferences: profile.preferences, preferenceHistory: profile.preferenceHistory.slice(-8), observations: profile.observations.slice(-3), conversation: profile.conversation.slice(-12) } }) }];
      if (!cause) {
        this.providerCalls++;
        this.data.metrics.providerAttempts = (this.data.metrics.providerAttempts ?? 0) + 1;
        try {
          // Mubit derives sessions from this stable first user message; starter credit rejects stored metadata.
          const response = await this.fetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.model, messages, response_format: RESPONSE_FORMAT, max_completion_tokens: 600 }), signal: AbortSignal.timeout(this.timeoutMs) });
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
          attempts.push({ provider: 'mubit', providerRequestId, tokens: reportedTokens(usage), errorCode: null });
        } catch (error) {
          errorCode = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : error.code?.startsWith('http_') ? error.code : 'invalid_or_unavailable_response';
          cause = gatewayErrorCode ? `${errorCode}:${gatewayErrorCode}` : errorCode; this.data.metrics.errors++;
          attempts.push({ provider: 'mubit', providerRequestId, tokens: reportedTokens(usage), errorCode, gatewayErrorCode });
        }
      }
      // One bounded text fallback follows a failed Mubit attempt; it is never used by an offline/no-key run.
      if (source === 'fallback' && attempts.length && this.openRouterApiKey && this.providerCalls < this.maxCalls) {
        this.providerCalls++; this.data.metrics.providerAttempts++;
        const fallbackStart = performance.now();
        let fallbackRequestId = null; let fallbackUsage = {};
        try {
          const response = await this.fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${this.openRouterApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.openRouterModel, messages, response_format: RESPONSE_FORMAT, max_tokens: 900 }), signal: AbortSignal.timeout(this.timeoutMs) });
          fallbackRequestId = response.headers.get('x-request-id')?.slice(0,128) ?? null;
          if (!response.ok) throw Object.assign(new Error('Text fallback rejected request'), { code: `http_${response.status}` });
          const text = await response.text();
          if (text.length > 64000) throw new Error('Oversized text fallback response');
          const raw = JSON.parse(text);
          if (!fallbackRequestId && typeof raw.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(raw.id)) fallbackRequestId = raw.id;
          fallbackUsage = raw.usage ?? {};
          decision = validateDecision(JSON.parse(raw.choices?.[0]?.message?.content));
          source = 'openrouter'; resultModel = this.openRouterModel; providerRequestId = fallbackRequestId;
          attempts.push({ provider: 'openrouter', providerRequestId: fallbackRequestId, tokens: reportedTokens(fallbackUsage), latencyMs: Math.round(performance.now()-fallbackStart), errorCode: null });
        } catch (error) {
          const code = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : error.code?.startsWith('http_') ? error.code : 'invalid_or_unavailable_response';
          attempts.push({ provider: 'openrouter', providerRequestId: fallbackRequestId, tokens: reportedTokens(fallbackUsage), latencyMs: Math.round(performance.now()-fallbackStart), errorCode: code });
          cause = `Mubit ${cause}; text fallback ${code}`; this.data.metrics.errors++;
        }
      }
      if (source === 'fallback') decision = fallback(input, profile, cause);
      const phase = profile.game && profile.game !== gameAtStart ? profile.game.phase : input.phase;
      const facts = factsOf(input, profile.game);
      const stageChanged = profile.game && profile.game !== gameAtStart && profile.game.questStage !== gameAtStart?.questStage;
      if (phase !== input.phase || stageChanged) {
        source = 'fallback'; decision = fallback({ ...input, phase: profile.game.phase, worldFacts: profile.game.worldFacts }, profile, 'game stage changed while the director was replying');
      }
      if (facts.areaCommitted === true || profile.game?.areaCommitted === true || phase !== 'village') {
        decision.route = profile.game?.route ?? facts.committedRoute ?? profile.lastDecision?.route ?? decision.route;
        decision.chapter = validateChapter(profile.game?.chapter ?? facts.chapter ?? profile.lastDecision?.chapter ?? decision.chapter, decision.route);
        decision.mood = profile.game?.mood ?? profile.lastDecision?.mood ?? decision.mood;
        decision.difficulty = profile.game?.difficulty ?? profile.lastDecision?.difficulty ?? decision.difficulty;
      }
      decision.objective = objectiveFor(phase, stageChanged ? profile.game.worldFacts : facts, profile.game);
      if (phase !== 'adventure') { decision.intent = 'none'; decision.answer = ''; }
      const finalPreferences = decision.preferences;
      if (JSON.stringify(prior) !== JSON.stringify(finalPreferences)) profile.preferenceHistory = [...profile.preferenceHistory, { at: new Date().toISOString(), previous: prior, current: { ...finalPreferences }, evidence: input.message }].slice(-20);
      profile.preferences = finalPreferences;
      const latencyMs = Math.round(performance.now() - start);
      const result = { ...decision, source, latencyMs, requestId, model: resultModel, sessionId: profile.sessionId };
      profile.conversation = [...profile.conversation, { role: 'user', npc: input.npc, text: input.message, at: new Date().toISOString() }, { role: 'assistant', npc: input.npc, text: result.dialogue, at: new Date().toISOString(), source }].slice(-40);
      profile.lastDecision = result;
      const metrics = this.data.metrics; metrics.calls++; const countKey = source === 'mubit' ? 'mubitCalls' : source === 'openrouter' ? 'openrouterCalls' : 'fallbackCalls'; metrics[countKey] = (metrics[countKey] ?? 0) + 1; metrics.lastLatencyMs = latencyMs;
      const tokens = Object.fromEntries(tokenKeys.map(key => {
        const reported = attempts.map(attempt => attempt.tokens[key]).filter(value => value !== null);
        return [key, reported.length ? reported.reduce((sum, value) => sum + value, 0) : null];
      }));
      for (const [key, providerKey] of [['promptTokens', 'prompt_tokens'], ['completionTokens', 'completion_tokens'], ['totalTokens', 'total_tokens']]) if (tokens[providerKey] !== null) metrics[key] += tokens[providerKey];
      const tokenUsageComplete = attempts.length > 0 && attempts.every(attempt => tokenKeys.every(key => attempt.tokens[key] !== null));
      metrics.unreportedUsageAttempts = (metrics.unreportedUsageAttempts ?? 0) + attempts.filter(attempt => tokenKeys.some(key => attempt.tokens[key] === null)).length;
      this.data.recentRequests = [...this.data.recentRequests, { requestId, providerRequestId, attempts, model: resultModel, sessionId: profile.sessionId, source, latencyMs, tokens, tokenUsageComplete, errorCode, gatewayErrorCode, at: new Date().toISOString() }].slice(-40);
      await this.save(); return result;
    } finally { this.busy.delete(input.playerId); }
  }
}
