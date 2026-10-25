import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Director } from '../director.mjs';
import { defaultChapter } from '../story.mjs';
import { buildFilmEvidence, main } from '../film-evidence.mjs';

const fixture = () => {
  const metrics = { calls: 1, providerAttempts: 1, mubitCalls: 1, fallbackCalls: 0, errors: 0, promptTokens: 10, completionTokens: 20, totalTokens: 30, unreportedUsageAttempts: 0 };
  const trace = { requestId: 'request-1', providerRequestId: 'mreq_synthetic', sessionId: 'private-session', source: 'mubit', model: 'synthetic-provider-model', latencyMs: 1234, at: '2026-10-24T19:00:00Z', tokens: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }, tokenUsageComplete: true, attempts: [{ provider: 'mubit', providerRequestId: 'mreq_synthetic', tokens: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }, errorCode: null }] };
  const game = { phase: 'complete', questStage: 'rescue', chapter: { realm: 'ember_keep', trial: 'riddle', twist: 'broken_oath', title: 'The Ember Oath', hook: 'A synthetic oath.' }, worldFacts: { reunited: true, ElinRescued: true }, updatedAt: '2026-10-24T19:01:00Z' };
  const profile = { playerId: '11111111-2222-3333-4444-555555555555', playerName: 'SyntheticPerson', sessionId: 'private-session', game, conversation: [{ role: 'user', text: 'private ambient utterance never selected' }], lastDecision: { requestId: 'request-1', chapter: game.chapter, route: 'mystery', mood: 'wonder', difficulty: 2, intent: 'none', answer: '', dialogue: 'Private synthetic reply.', backendToken: 'b'.repeat(64) } };
  return { summary: { contractVersion: 2, at: '2026-10-24T19:01:00Z', metrics: { ...metrics }, requests: [{ ...trace }], game: { ...game, facts: { ...game.worldFacts } } }, state: { version: 1, metrics, players: { privatePlayer: profile }, recentRequests: [trace], inbox: [{ message: 'private queued utterance' }], apiKey: 'never-export-this-key' } };
};

test('default film export contains scoped historical totals and facts without any conversation or credentials', () => {
  const data = fixture(); const out = buildFilmEvidence({ ...data, capturedAt: '2026-10-24T20:00:00Z' });
  assert.deepEqual(out.turns, []); assert.equal(out.sessionId, 'demo-session-01');
  assert.equal(out.metrics.mubitResponses, 1); assert.equal(out.metrics.localFallbackResponses, 0); assert.equal(out.metrics.providerErrors, 0);
  assert.equal(out.finalGameSnapshot.facts.reunited, true); assert.match(out.scope.label, /Historical completed Ember/);
  assert.equal(out.claims.savings, null); assert.equal(out.claims.adapterImprovement, null); assert.equal(out.claims.servingModel, null); assert.equal(out.training.kept, null);
  assert.doesNotMatch(JSON.stringify(out), /SyntheticPerson|11111111|private-session|private ambient utterance|private queued|never-export|bbbbbbbb/);
});

test('selected turns retain exact telemetry but never guess transcripts, raw decisions or game outcomes', () => {
  const out = buildFilmEvidence({ ...fixture(), requestIds: ['request-1'] }); const turn = out.turns[0];
  assert.equal(turn.requestId, 'request-1'); assert.equal(turn.providerRequestId, 'mreq_synthetic'); assert.equal(turn.tokens.total_tokens, 30); assert.equal(turn.latencyMs, 1234);
  assert.equal(turn.transcript, null); assert.equal(turn.reply, null); assert.equal(turn.rawDecision, null); assert.equal(turn.gameOutcome, null);
  assert.equal(turn.returnedModel, null); assert.equal(turn.attempts[0].returnedModel, null);
  assert.equal(turn.guardedDecision.route, 'mystery'); assert.equal(turn.localValidation.accepted, null);
});

test('film export preserves reported model separately without inferring adapter serving', () => {
  const data = fixture();
  data.state.recentRequests[0].returnedModel = 'reported-provider-model';
  data.state.recentRequests[0].attempts[0].returnedModel = 'reported-provider-model';
  const turn = buildFilmEvidence({ ...data, requestIds: ['request-1'] }).turns[0];
  assert.equal(turn.providerModel, 'synthetic-provider-model'); assert.equal(turn.returnedModel, 'reported-provider-model');
  assert.equal(turn.attempts[0].returnedModel, 'reported-provider-model'); assert.equal(turn.servingModel, null);
});

test('only exact request-correlated selected text is sanitized; ambient and extra fields stay excluded', () => {
  const data = fixture(); const profile = Object.values(data.state.players)[0];
  profile.conversation.push({ requestId: 'request-1', role: 'user', text: `SyntheticPerson asks about Elin. Contact demo@example.test; identity ${profile.playerId}; backendToken=${'a'.repeat(64)}; Bearer synthetic-secret-value`, password: 'unexportable' });
  const out = buildFilmEvidence({ ...data, requestIds: ['request-1'] }); const serialized = JSON.stringify(out);
  assert.match(out.turns[0].transcript, /\[player\] asks about Elin/);
  assert.doesNotMatch(serialized, /SyntheticPerson|example\.test|11111111|aaaaaaaa|synthetic-secret-value|unexportable|private ambient utterance/);
});

test('export rejects unknown, duplicate, excessive selections and conflicting or incomplete evidence', () => {
  for (const requestIds of [['missing'], ['request-1', 'request-1'], Array.from({ length: 9 }, (_, i) => `request-${i}`)]) assert.throws(() => buildFilmEvidence({ ...fixture(), requestIds }));
  for (const mutate of [data => { data.summary.metrics.totalTokens++; }, data => { data.summary.game.facts.reunited = false; }, data => { data.summary.contractVersion = 1; }, data => { data.state.metrics.calls = data.summary.metrics.calls = 41; }]) {
    const data = fixture(); mutate(data); assert.throws(() => buildFilmEvidence(data));
  }
});

test('offline CLI writes only the explicit output and refuses source overwrite', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'everafter-film-'));
  try {
    const data = fixture(); const state = join(directory, 'state.json'); const summary = join(directory, 'summary.json'); const out = join(directory, 'private', 'evidence.json');
    await writeFile(state, JSON.stringify(data.state)); await writeFile(summary, JSON.stringify(data.summary));
    await main(['--state', state, '--summary', summary, '--out', out]);
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')).turns, []); assert.equal((await stat(out)).mode & 0o777, 0o600);
    await assert.rejects(() => main(['--state', state, '--summary', summary, '--out', state]), /overwrite/);
    await assert.rejects(() => main(['--state', state, '--summary', summary]), /required/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('fresh Director messages correlate exactly with telemetry and export only guarded success or fallback text',async()=>{
  for(const mode of ['valid','invalid','http-error']) {
    const raw={dialogue:mode==='valid'?'Elin is home; our journey is remembered.':'UNVALIDATED-PROVIDER-TEXT',route:mode==='invalid'?'invented-route':'combat',mood:'wonder',difficulty:2,chapter:defaultChapter('combat'),intent:'none',answer:'',objective:'A provider objective.',preferences:{combat:true,mystery:false,protectVillagers:true},reason:'Provider proposal.'};
    const director=new Director({apiKey:'dummy-private-key',runtimeDir:null,fetchImpl:async()=>mode==='http-error'?new Response('{"error":{"message":"UNVALIDATED-PROVIDER-TEXT dummy-private-key"}}',{status:503}):new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(raw)}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}),{headers:{'x-middleware-request-id':'mreq_fresh_mock'}})});
    const player={playerId:'film-test',playerName:'Fictional Player'};
    await director.gameState({...player,phase:'complete',route:'mystery',mood:'eerie',difficulty:1,chapter:defaultChapter(),areaCommitted:true,questStage:'rescue',worldFacts:{reunited:true,ElinRescued:true}});
    const result=await director.direct({...player,npc:'Mara',phase:'complete',message:'Please remember our reunion.',worldFacts:{reunited:true,ElinRescued:true}});
    const state=director.data,profile=Object.values(state.players)[0],trace=state.recentRequests[0];
    assert.deepEqual(profile.conversation.map(message=>message.requestId),[result.requestId,result.requestId]);
    assert.equal(trace.requestId,result.requestId); assert.equal(profile.lastDecision.requestId,result.requestId);
    assert.equal(result.source,mode==='valid'?'mubit':'fallback'); assert.equal(result.route,'mystery');
    const summary={contractVersion:2,metrics:structuredClone(state.metrics),requests:structuredClone(state.recentRequests),game:{...structuredClone(profile.game),facts:structuredClone(profile.game.worldFacts)}};
    const evidence=buildFilmEvidence({summary,state,requestIds:[result.requestId]});
    assert.equal(evidence.turns[0].transcript,'Please remember our reunion.');
    assert.equal(evidence.turns[0].reply,result.dialogue); assert.equal(evidence.turns[0].source,result.source);
    assert.equal(evidence.turns[0].guardedDecision.route,'mystery'); assert.equal(evidence.turns[0].rawDecision,null);
    assert.doesNotMatch(JSON.stringify(state),/UNVALIDATED-PROVIDER-TEXT|dummy-private-key/);
  }
});
