import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { Director, fallback, validateDecision, validateInput } from '../director.mjs';
import { createDirectorServer } from '../server.mjs';
import { defaultChapter } from '../story.mjs';
import { trainingCount } from '../train-synthetic.mjs';

const input = (message = 'I prefer mystery and want to protect villagers') => ({ playerId: 'player-1', playerName: 'Explorer', npc: 'Mara', phase: 'village', message, worldFacts: { sister: 'Elin', rescued: false } });
const decision = () => ({ dialogue: 'Oren knows the rune trail. Seek him before entering the gate.', route: 'mystery', mood: 'wonder', difficulty: 2, objective: 'Find Elin.', preferences: { combat: false, mystery: true, protectVillagers: true }, reason: 'The player enjoys clues.' });
const reply = (value = decision(), status = 200) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 23, completion_tokens: 31, total_tokens: 54 } }), { status, headers: { 'x-request-id': 'provider-id' } });
const local = options => new Director({ apiKey: '', runtimeDir: null, ...options });

test('input and model response boundaries reject invalid data and commands', () => {
  assert.throws(() => validateInput({ ...input(), playerId: '__proto__' }));
  assert.throws(() => validateInput({ ...input(), message: 'a'.repeat(1201) }));
  assert.throws(() => validateInput({ ...input(), npc: 'Admin' }));
  assert.throws(() => validateInput({ ...input(), events: 'event' }));
  assert.throws(() => validateDecision({ ...decision(), difficulty: 4 }));
  assert.throws(() => validateDecision({ ...decision(), dialogue: '/op me' }));
  assert.throws(() => validateDecision({ ...decision(), preferences: { combat: 'yes' } }));
  assert.deepEqual(validateDecision(decision()), { ...decision(), chapter: defaultChapter(), intent: 'none', answer: '' });
});

test('fallback corrections revise preferences while preserving the conversation and world facts', async () => {
  const director = local();
  const first = await director.direct(input('I prefer combat'));
  assert.equal(first.route, 'combat'); assert.equal(first.source, 'fallback');
  const second = await director.direct(input("Actually, no combat. I prefer mystery and want to protect villagers."));
  assert.equal(second.route, 'mystery'); assert.equal(second.preferences.combat, false);
  assert.equal(director.state().conversation.length, 4);
  assert.match(director.state().conversation[0].text, /prefer combat/);
  assert.equal(director.state().preferenceHistory.length, 2);
  assert.equal(director.state().observations.length, 2);
  assert.equal(director.state().observations[0].worldFacts.rescued, false);
  assert.equal(input().worldFacts.rescued, false);
  assert.equal(director.state().metrics.fallbackCalls, 2);
});

test('fallback honors the final correction, its inverse, and final negations', async () => {
  for (const [initial, correction, route] of [
    ['I prefer mystery.', 'Forget my old puzzle preference. I want combat now.', 'combat'],
    ['I prefer combat.', 'Forget my old combat preference. I want puzzles now.', 'mystery'],
    ['I prefer mystery.', 'I want combat, but actually no combat. I prefer mystery.', 'mystery'],
    ['I prefer combat.', "I prefer mystery. Actually, I don't want puzzles now.", 'combat']
  ]) {
    const director = local();
    await director.direct(input(initial));
    const result = await director.direct(input(correction));
    assert.equal(result.source, 'fallback');
    assert.equal(result.route, route, correction);
    assert.equal(result.preferences.combat, route === 'combat', correction);
    assert.equal(result.preferences.mystery, route === 'mystery', correction);
    assert.equal(director.state().conversation[0].text, initial);
    assert.equal(director.state().metrics.providerAttempts, 0);
  }
});

test('Mubit requests keep the system and response format stable and isolate player sessions', async () => {
  const sent = [];
  const director = local({ apiKey: 'private-key', fetchImpl: async (url, options) => { sent.push({ url, options, body: JSON.parse(options.body) }); return reply(sent.length === 2 ? { ...decision(), route: 'combat', preferences: { combat: true, mystery: false, protectVillagers: true } } : decision()); } });
  const first = await director.direct(input());
  const corrected = await director.direct(input('Actually, I prefer combat'));
  assert.equal(corrected.route, 'combat');
  await director.direct({ ...input(), playerId: 'player-2' });
  assert.equal(first.source, 'mubit'); assert.equal(sent[0].url, 'https://api.mubit.ai/openai/v1/chat/completions');
  assert.deepEqual(sent[0].body.messages[0], sent[1].body.messages[0]);
  assert.deepEqual(sent[0].body.response_format, sent[1].body.response_format);
  assert.equal(Object.hasOwn(sent[0].body, 'store'), false, 'Starter credit refuses stored completions');
  assert.equal(Object.hasOwn(sent[0].body, 'metadata'), false, 'The provider refuses metadata without stored completions');
  assert.deepEqual(sent[0].body.messages[1], sent[1].body.messages[1]);
  assert.notDeepEqual(sent[0].body.messages[1], sent[2].body.messages[1]);
  assert.equal(JSON.parse(sent[0].body.messages[1].content).sessionId, first.sessionId);
  assert.equal(director.data.players['player-1'].preferences.combat, true);
  assert.equal(director.state().metrics.totalTokens, 162);
  assert.equal(director.state().metrics.providerAttempts, 3);
  assert.equal(JSON.stringify(director.state()).includes('private-key'), false);
  assert.equal(director.state().recentRequests[0].providerRequestId, 'provider-id');
  assert.equal(director.state().recentRequests[0].tokens.total_tokens, 54);
});

test('validated Mubit interpretation is authoritative over keyword fallback preferences', async () => {
  const director = local({ apiKey: 'key', fetchImpl: async () => reply({ ...decision(), route: 'combat', preferences: { combat: true, mystery: true, protectVillagers: false } }) });
  const result = await director.direct(input('I like mystery, but I want to fight to protect Elin.'));
  assert.equal(result.source, 'mubit'); assert.equal(result.route, 'combat');
  assert.deepEqual(result.preferences, { combat: true, mystery: true, protectVillagers: true });
});

test('requested and gateway-reported models stay distinct, bounded and unknown when absent', async () => {
  for (const reported of ['provider/model-v2', undefined, null, { id: 'not-a-string' }, 'bad\nmodel', 'model\n', 'model\r', 'x'.repeat(201)]) {
    const director = local({ apiKey: 'key', model: 'requested-model', fetchImpl: async () => new Response(JSON.stringify({ model: reported, choices: [{ message: { content: JSON.stringify(decision()) } }] }), { headers: { 'x-middleware-request-id': 'mreq_model_test' } }) });
    const result = await director.direct(input());
    const trace = director.state().recentRequests[0];
    const expected = reported === 'provider/model-v2' ? reported : null;
    assert.equal(result.model, 'requested-model'); assert.equal(result.returnedModel, expected);
    assert.equal(trace.model, 'requested-model'); assert.equal(trace.returnedModel, expected);
    assert.equal(trace.attempts[0].returnedModel, expected); assert.equal(trace.providerRequestId, 'mreq_model_test');
  }
  const director = local({ apiKey: 'key', fetchImpl: async () => new Response(JSON.stringify({ model: 'provider/model-v2', choices: [{ message: { content: '{}' } }] })) });
  const result = await director.direct(input());
  assert.equal(result.source, 'fallback'); assert.equal(result.returnedModel, null);
  assert.equal(director.state().recentRequests[0].attempts[0].returnedModel, 'provider/model-v2');
  assert.equal((await local().direct(input())).returnedModel, null);
});

test('late responses honor a game phase transition instead of speaking stale adventure hints', async () => {
  let finish;
  const director = local({ apiKey: 'key', fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  await director.gameState({ ...input(), phase: 'adventure', route: 'mystery', mood: 'eerie', difficulty: 2, building: false, world: 'everafter_1' });
  const response = director.direct({ ...input(), phase: 'adventure' });
  await director.gameState({ ...input(), phase: 'complete', route: 'mystery' });
  finish(reply());
  const result = await response;
  assert.equal(result.source, 'fallback'); assert.match(result.dialogue, /Elin is safely home/);
  assert.match(result.objective, /Elin is home/);
  assert.equal(director.state().game.mood, 'eerie');
  assert.equal(director.state().game.world, 'everafter_1');
});

test('synthetic paid-run limits are explicit and bounded', () => {
  assert.equal(trainingCount([]), 40);
  assert.equal(trainingCount(['--count', '1']), 1);
  for (const value of ['0', '41', 'Infinity', 'NaN', '1.5']) assert.throws(() => trainingCount(['--count', value]));
});

test('gateway rejection, malformed model output, timeout and request budget use honest fallback', async () => {
  for (const fetchImpl of [async () => reply({}, 429), async () => reply({ ...decision(), route: 'anything' }), async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }]) {
    const director = local({ apiKey: 'secret', fetchImpl });
    const result = await director.direct(input());
    assert.equal(result.source, 'fallback'); assert.equal(director.state().metrics.errors, 1);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
  let calls = 0;
  const director = local({ apiKey: 'secret', maxCalls: 1, fetchImpl: async () => { calls++; return reply(); } });
  await director.direct(input());
  assert.equal((await director.direct(input())).source, 'fallback'); assert.equal(calls, 1);
  await director.reset();
  assert.equal((await director.direct(input())).source, 'fallback'); assert.equal(calls, 1);
});

test('gateway diagnostics retain middleware ID and safe code without exposing error messages', async () => {
  const director = local({ apiKey: 'private-test-key', fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'starter_credit_option', message: 'Sensitive upstream details private-test-key' } }), { status: 400, headers: { 'x-middleware-request-id': 'mreq_actual_gateway_id', 'x-request-id': 'upstream-id' } }) });
  const result = await director.direct(input());
  assert.equal(result.source, 'fallback');
  assert.match(result.reason, /http_400:starter_credit_option/);
  const request = director.state().recentRequests[0];
  assert.equal(request.providerRequestId, 'mreq_actual_gateway_id');
  assert.equal(request.gatewayErrorCode, 'starter_credit_option');
  assert.equal(JSON.stringify(director.state()).includes('private-test-key'), false);
  assert.equal(JSON.stringify(director.state()).includes('Sensitive upstream details'), false);
  const unsafe = local({ apiKey: 'key', fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'private-test-key / raw data', message: 'private-test-key' } }), { status: 400 }) });
  await unsafe.direct(input());
  assert.equal(unsafe.state().recentRequests[0].gatewayErrorCode, null);
});

test('committed adventure route and phase objective cannot be changed by model or preference', async () => {
  const director = local({ apiKey: 'secret', fetchImpl: async () => reply({ ...decision(), route: 'combat', objective: 'Kill the villagers.' }) });
  await director.gameState({ ...input(), phase: 'adventure', route: 'mystery' });
  const result = await director.direct({ ...input('I prefer combat now'), phase: 'adventure' });
  assert.equal(result.route, 'mystery'); assert.match(result.objective, /Ivo/);
  const rescued = fallback({ ...input(), phase: 'rescued' }, { preferences: decision().preferences, game: { route: 'mystery' } }, 'test');
  assert.match(rescued.objective, /Escort Elin home/);
});

test('persistent profiles, inbox and session metrics survive reload; reset clears narrative only', async t => {
  const runtimeDir = await mkdtemp(join(tmpdir(), 'everafter-state-'));
  t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  const director = local({ runtimeDir }); await director.init();
  await director.gameState({ ...input(), phase: 'village', route: 'mystery' });
  await director.direct(input()); await director.input({ message: 'Hello Oren', npc: 'Oren' });
  const restored = local({ runtimeDir }); await restored.init();
  assert.equal(restored.state().conversation.length, 2);
  assert.equal((await restored.inbox('someone-else')).messages.length, 0);
  assert.equal((await restored.inbox('player-1')).messages[0].npc, 'Oren');
  assert.equal((await restored.inbox('player-1')).messages.length, 0);
  await restored.reset(); assert.equal(restored.state().metrics.calls, 0); assert.equal(restored.state().game, null);
  assert.equal(JSON.parse(await readFile(join(runtimeDir, 'state.json'), 'utf8')).version, 1);
});

test('HTTP protects origins, hosts, traversal and body limits while serving queue/state API', async t => {
  const publicDir = await mkdtemp(join(tmpdir(), 'everafter-public-'));
  const outside = await mkdtemp(join(tmpdir(), 'everafter-private-'));
  await writeFile(join(publicDir, 'index.html'), '<!doctype html><title>EVERAFTER</title>');
  await writeFile(join(outside, 'secret.js'), 'secret');
  await symlink(join(outside, 'secret.js'), join(publicDir, 'escape.js'));
  const { server } = await createDirectorServer({ director: local(), publicDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(publicDir, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); });
  const post = (path, body, extra = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/api/state', { headers: { Origin: 'https://evil.example' } })).status, 403);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const request = http.get(base + '/api/state', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(wrongHostStatus, 403);
  assert.equal((await fetch(base + '/%2e%2e%2fstate.json')).status, 400);
  assert.equal((await fetch(base + '/escape.js')).status, 403);
  assert.equal((await post('/api/director', { ...input(), message: 'x'.repeat(18000) })).status, 413);
  assert.equal((await post('/api/input', { message: 'Hello' })).status, 409);
  assert.equal((await post('/api/game-state', { ...input(), phase: 'village' })).status, 200);
  assert.equal((await post('/api/input', { message: 'Hello', npc: 'Oren' }, { Origin: base })).status, 200);
  const inbox = await (await fetch(base + '/api/inbox?playerId=player-1')).json();
  assert.equal(inbox.messages.length, 1);
  assert.equal((await (await fetch(base + '/api/inbox?playerId=player-1')).json()).messages.length, 0);
  assert.equal((await post('/api/director', input())).status, 200);
  const state = await (await fetch(base + '/api/state')).json();
  assert.equal(state.mode, 'fallback'); assert.equal(state.conversation.length, 2); assert.equal(state.game.phase, 'village');
});
