import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tokenKeys = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
const factKeys = ['areaCommitted', 'clueDiscovered', 'artifactClaimed', 'artifactReturned', 'trialResolved', 'sentinelResolved', 'sentinelSpared', 'sentinelDefeated', 'wardenResolved', 'wardenSpared', 'wardenDefeated', 'villageSafe', 'ElinRescued', 'reunited'];
const number = value => Number.isFinite(value) && value >= 0 ? value : null;
const tokens = value => Object.fromEntries(tokenKeys.map(key => [key, number(value?.[key])]));
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const member = (value, choices) => choices.includes(value) ? value : null;

export function redactText(value, names = []) {
  if (typeof value !== 'string') return null;
  let text = value.slice(0, 1200);
  for (const name of names.filter(name => typeof name === 'string' && name.trim())) {
    text = text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[player]');
  }
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[identity]')
    .replace(/\b(?:Bearer\s+\S+|(?:sk|mubit)[-_][A-Za-z0-9_-]{12,}|[a-f0-9]{64})\b/gi, '[secret]')
    .replace(/\b(?:api[_-]?key|backend[_-]?token|token|password|secret)\s*[:=]\s*["']?[^\s"'&,]+/gi, '[secret]');
}

function chapter(value, sanitize) {
  if (!value) return null;
  return { realm: member(value.realm, ['ember_keep', 'sunken_archive', 'sky_monastery', 'thornwild']), trial: member(value.trial, ['riddle', 'gauntlet', 'parley']), twist: member(value.twist, ['broken_oath', 'false_trail', 'willing_guardian']), title: sanitize(value.title), hook: sanitize(value.hook) };
}

function guardedDecision(value, sanitize) {
  if (!value) return null;
  return { chapter: chapter(value.chapter, sanitize), route: member(value.route, ['mystery', 'combat', 'hybrid']), mood: member(value.mood, ['wonder', 'eerie']), difficulty: member(value.difficulty, [1, 2, 3]), intent: member(value.intent, ['none', 'answer', 'challenge', 'bargain']), answer: sanitize(value.answer) };
}

export function buildFilmEvidence({ summary, state, requestIds = [], capturedAt = new Date().toISOString() }) {
  if (summary?.contractVersion !== 2 || state?.version !== 1) throw new Error('Expected story-v2 summary and Director state v1');
  if (!Array.isArray(requestIds) || requestIds.length > 8 || new Set(requestIds).size !== requestIds.length || requestIds.some(value => !id(value))) throw new Error('Select at most 8 distinct explicit request IDs');
  const profiles = Object.values(state.players ?? {});
  const requests = state.recentRequests ?? [];
  const documented = summary.requests ?? [];
  if (!documented.length || documented.length > 40 || new Set(documented.map(item => item.requestId)).size !== documented.length || documented.some(item => !requests.some(trace => trace.requestId === item.requestId && trace.source === item.source && trace.latencyMs === item.latencyMs))) throw new Error('Summary requests do not match the supplied archive');
  for (const key of ['calls', 'mubitCalls', 'fallbackCalls', 'errors', 'providerAttempts', 'promptTokens', 'completionTokens', 'totalTokens']) {
    if (number(summary.metrics?.[key]) === null || summary.metrics[key] !== state.metrics?.[key]) throw new Error('Summary metrics do not match the supplied archive');
  }
  const sessions = new Set(documented.map(item => item.sessionId));
  const profile = profiles.find(item => sessions.has(item.sessionId));
  if (sessions.size !== 1 || !profile) throw new Error('Expected exactly one documented session');
  if (summary.metrics.calls !== documented.length || requests.length !== documented.length || profiles.length !== 1) throw new Error('Complete single-session request accounting is required');
  if (profile.game?.phase !== summary.game?.phase || profile.game?.chapter?.realm !== summary.game?.chapter?.realm) throw new Error('Summary game does not match the supplied archive');
  const sanitize = value => redactText(value, profiles.map(item => item.playerName));
  const facts = summary.game?.facts ?? {};
  for (const key of factKeys) if (facts[key] !== undefined && facts[key] !== profile.game?.worldFacts?.[key]) throw new Error('Summary facts do not match the supplied archive');
  const turns = requestIds.map((requestId, index) => {
    const trace = requests.find(item => item.requestId === requestId && item.sessionId === profile.sessionId);
    if (!trace) throw new Error('Selected request is absent from this session');
    // Historical conversations have no request IDs: never guess a turn by position or time.
    const messages = (profile.conversation ?? []).filter(item => item.requestId === requestId);
    return { clipId: `clip-${index + 1}`, requestId, at: date(trace.at), providerRequestId: id(trace.providerRequestId), transcript: sanitize(messages.find(item => item.role === 'user')?.text), reply: sanitize(messages.find(item => item.role === 'assistant')?.text), source: member(trace.source, ['mubit', 'fallback', 'openrouter']), providerModel: sanitize(trace.model), returnedModel: sanitize(trace.returnedModel), servingModel: null, latencyMs: number(trace.latencyMs), tokens: tokens(trace.tokens), tokenUsageComplete: trace.tokenUsageComplete === true,
      attempts: (trace.attempts ?? []).slice(0, 3).map(attempt => ({ provider: member(attempt.provider, ['mubit', 'openrouter']), providerRequestId: id(attempt.providerRequestId), returnedModel: sanitize(attempt.returnedModel), tokens: tokens(attempt.tokens), latencyMs: number(attempt.latencyMs), errorCode: id(attempt.errorCode), gatewayErrorCode: id(attempt.gatewayErrorCode) })), errorCode: id(trace.errorCode), gatewayErrorCode: id(trace.gatewayErrorCode),
      rawDecision: null, guardedDecision: profile.lastDecision?.requestId === requestId ? guardedDecision(profile.lastDecision, sanitize) : null,
      localValidation: { accepted: null, reason: 'No per-turn validation record or raw model output was retained.' }, gameOutcome: null };
  });
  const times = documented.map(item => date(item.at)).filter(Boolean).sort();
  return { schemaVersion: 1, capturedAt: date(capturedAt), sessionId: 'demo-session-01',
    scope: { label: summary.game?.chapter?.realm === 'ember_keep' && summary.game?.phase === 'complete' ? 'Historical completed Ember run' : 'Historical recorded session', contract: 'story-v2', recordedAt: date(summary.at), archiveUpdatedAt: date(profile.game?.updatedAt), firstRequestAt: times[0] ?? null, lastRequestAt: times.at(-1) ?? null, metrics: 'Entire documented session; not only selected film turns', transcripts: 'Only explicitly selected, exactly request-correlated turns; private ambient history omitted', rawOutput: 'Not retained; guarded decisions are not raw model outputs' },
    turns,
    finalGameSnapshot: { scope: 'End-of-session snapshot, not a per-turn action result', phase: member(summary.game?.phase, ['village', 'adventure', 'rescued', 'complete']), questStage: member(summary.game?.questStage, ['arrival', 'trial', 'sentinel', 'warden', 'rescue']), chapter: chapter(summary.game?.chapter, sanitize), facts: Object.fromEntries(factKeys.filter(key => typeof facts[key] === 'boolean').map(key => [key, facts[key]])) },
    metrics: { calls: summary.metrics.calls, providerAttempts: summary.metrics.providerAttempts, mubitResponses: summary.metrics.mubitCalls, localFallbackResponses: summary.metrics.fallbackCalls, providerErrors: summary.metrics.errors, reportedTokens: { prompt_tokens: summary.metrics.promptTokens, completion_tokens: summary.metrics.completionTokens, total_tokens: summary.metrics.totalTokens }, unreportedUsageAttempts: number(summary.metrics.unreportedUsageAttempts) },
    training: { contract: 'story-v2', preparedTrainingTurns: null, preparedSessions: null, preparedHoldouts: null, submitted: 0, kept: null, targetKept: 50, status: 'Prepared corpus counts not loaded', scope: 'This offline exporter submits nothing. Historic legacy-contract training is separate.' },
    claims: { adapterImprovement: null, servingModel: null, priceVerified: false, cost: null, savings: null, evaluation: 'Integration observation; no held-out quality or adapter comparison' } };
}

export async function main(args = process.argv.slice(2)) {
  const options = { requestIds: [] };
  for (let i = 0; i < args.length; i += 2) {
    if (!['--state', '--summary', '--out', '--request-id'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Usage: node director/film-evidence.mjs --state FILE --summary FILE --out PRIVATE_FILE [--request-id ID] (max 8)');
    if (args[i] === '--request-id') options.requestIds.push(args[i + 1]); else options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.state || !options.summary || !options.out) throw new Error('Explicit --state, --summary and --out paths are required');
  const out = resolve(options.out);
  if ([resolve(options.state), resolve(options.summary)].includes(out)) throw new Error('Output must not overwrite source evidence');
  const read = async path => { const data = await readFile(path); if (data.length > 8 * 1024 * 1024) throw new Error('Evidence input exceeds 8 MiB'); return JSON.parse(data.toString('utf8')); };
  const evidence = buildFilmEvidence({ summary: await read(options.summary), state: await read(options.state), requestIds: options.requestIds });
  await mkdir(dirname(out), { recursive: true, mode: 0o700 });
  await writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await chmod(out, 0o600);
  return evidence;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
