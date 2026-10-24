import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Director, fallback, validateInput, validateDecision } from './director.mjs';
import { SYSTEM_PROMPT, RESPONSE_FORMAT } from './prompt.mjs';
import { RECOVERY_SCENARIOS } from './fixtures/recovery.mjs';
import { RecoveryBudget, atomicJson } from './recovery-budget.mjs';

export const RECOVERY_ROOT = join(import.meta.dirname, 'runtime', 'training-recovery');
const flag = (args, name) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
export function validateRecoveryDataset(scenarios = RECOVERY_SCENARIOS) {
  const turns = scenarios.flatMap(item => item.turns);
  if (scenarios.length < 24 || turns.length !== 96 || new Set(turns.map(item => item.id)).size !== turns.length || new Set(turns.map(item => item.message)).size !== turns.length) throw new Error('Recovery dataset must contain96 unique examples across at least24 independent sessions');
  for (const turn of turns) {
    validateInput({ ...turn, playerId: 'offline-validation', playerName: 'Synthetic recovery', events: [] });
    validateDecision(fallback(turn, { game: turn.game, preferences: { combat: turn.expected.route === 'combat', mystery: turn.expected.route === 'mystery', protectVillagers: true } }, 'offline fixture validation'));
  }
  const counts = field => Object.fromEntries([...new Set(turns.map(item => item[field]))].map(key => [key, turns.filter(item => item[field] === key).length]));
  const coverage = { sessions: scenarios.length, examples: turns.length, phases: counts('phase'), npcs: counts('npc'), routes: Object.fromEntries(['mystery', 'combat'].map(route => [route, turns.filter(item => item.expected.route === route).length])), corrections: turns.filter(item => item.tags.includes('preference-correction')).length, committedRouteCases: turns.filter(item => item.phase !== 'village').length };
  if (Object.keys(coverage.phases).length !== 4 || Object.keys(coverage.npcs).length !== 3 || coverage.corrections < 12 || coverage.routes.mystery < 24 || coverage.routes.combat < 24) throw new Error('Recovery coverage is incomplete');
  return coverage;
}
export function checkRecoveryDecision(turn, decision) {
  const failures = [];
  try { validateDecision(decision); } catch { failures.push('response-shape'); }
  if (decision?.route !== turn.expected.route) failures.push(turn.expected.committedRoute ? 'committed-route' : 'requested-route');
  if (decision?.preferences?.protectVillagers !== true) failures.push('villager-protection');
  return { passed: failures.length === 0, failures };
}
export async function runRecovery(args = process.argv.slice(2)) {
  for (let index=0;index<args.length;index++) {
    if (!['--live','--count','--feedback'].includes(args[index])) throw new Error(`Unknown recovery option: ${args[index]}`);
    if (args[index]!=='--live' && (!args[index+1] || args[index+1].startsWith('--'))) throw new Error(`Missing value for ${args[index]}`);
    if (args[index]!=='--live') index++;
  }
  const coverage = validateRecoveryDataset();
  const live = args.includes('--live');
  if (!live) { console.log(JSON.stringify({ mode: 'offline-coverage-only', paidCalls: 0, coverage }, null, 2)); return { coverage, paidCalls: 0 }; }
  if (!process.env.MUBIT_API_KEY) throw new Error('MUBIT_API_KEY is required; no requests made');
  const count = flag(args, '--count') == null ? 96 : Number(flag(args, '--count'));
  if (!Number.isInteger(count) || count < 1 || count > 96) throw new Error('--count must be an integer from1 to96');
  const feedbackPath = flag(args, '--feedback');
  const feedback = feedbackPath ? JSON.parse(await readFile(resolve(feedbackPath), 'utf8')) : null;
  if (feedback && (typeof feedback.reason !== 'string' || !feedback.reason.trim() || typeof feedback.evidence !== 'string' || !feedback.evidence.trim() || !Array.isArray(feedback.caseIds) || feedback.caseIds.length === 0)) throw new Error('Recovery feedback needs a concrete reason, evidence and targeted caseIds');
  const allCaseIds = new Set(RECOVERY_SCENARIOS.flatMap(item => item.turns.map(turn => turn.id)));
  if (feedback?.caseIds.some(id => !allCaseIds.has(id))) throw new Error('Unknown targeted feedback case');
  const runId = `recovery-${randomUUID()}`;
  const reportPath = join(RECOVERY_ROOT, runId, 'report.json');
  const budget = await RecoveryBudget.acquire(join(RECOVERY_ROOT, 'call-ledger.json'));
  try {
    if (budget.data.used > 0 && !feedback) throw new Error('A recovery batch already made calls; new console/grading feedback and targeted caseIds are required before another batch');
    const picked = RECOVERY_SCENARIOS.map(scenario => ({ ...scenario, turns: feedback ? scenario.turns.filter(turn => feedback.caseIds.includes(turn.id)) : scenario.turns })).filter(scenario => scenario.turns.length);
    if (feedback && picked.some(scenario => scenario.turns.some((turn,index) => turn !== RECOVERY_SCENARIOS.find(item => item.id === scenario.id).turns[index]))) throw new Error('Targeted retry must include the earlier turns of each selected session');
    const model = process.env.MUBIT_MODEL ?? 'gpt-6-luna';
    const report = { runId, dataset: 'authored-synthetic-recovery-v2', model, purpose: 'Diverse provider examples, not proof of adapter improvement', localPromptFingerprint: createHash('sha256').update(JSON.stringify({ model, system: SYSTEM_PROMPT, responseFormat: RESPONSE_FORMAT })).digest('hex'), coverage, requestedCalls: Math.min(count, picked.flatMap(item => item.turns).length), feedbackReference: feedbackPath ?? null, observations: [], complete: false, startedAt: new Date().toISOString(), ledgerPath: budget.path };
    await budget.startRound(runId, reportPath, report.requestedCalls, feedbackPath ?? null);
    const stateMetadata = { roundNumber: budget.data.rounds.length, maximumRounds: 3, instructionsPath: join(import.meta.dirname, '..', 'docs', 'evaluation.md'), taskId: 'ln_f033afe97baac3c175b28c3f', adapterId: 'ad_lane_a96a2bdc' };
    await atomicJson(reportPath, report);
    await atomicJson(join(RECOVERY_ROOT, 'latest.json'), { ...stateMetadata, runId, reportPath, status: 'running', updatedAt: report.startedAt });
    let stopped = false;
    for (const scenario of picked) {
      let rawCapture = null;
      let activeCase;
      const director = new Director({ runtimeDir: null, maxCalls: 4, fetchImpl: async (url, options) => {
        const attempt = await budget.reserve(runId, activeCase.id);
        try {
          const response = await fetch(url, options);
          const text = await response.clone().text();
          let raw;
          try { raw = JSON.parse(text); } catch { raw = null; }
          const middlewareId = response.headers.get('x-middleware-request-id');
          rawCapture = { httpStatus: response.status, middlewareRequestId: middlewareId, finishReason: raw?.choices?.[0]?.finish_reason ?? null, content: response.ok ? raw?.choices?.[0]?.message?.content ?? null : null, usage: raw?.usage ?? null };
          await budget.record(attempt, { status: response.ok ? 'gateway-response' : 'provider-error', httpStatus: response.status, middlewareRequestId: middlewareId });
          return response;
        } catch (error) { await budget.record(attempt, { status: 'transport-error', error: error.name }); throw error; }
      } });
      const playerId = `recovery-${randomUUID()}`;
      for (const turn of scenario.turns) {
        if (report.observations.length >= count) { stopped = true; break; }
        activeCase = turn; rawCapture = null;
        await director.gameState({ ...turn.game, playerId, playerName: 'Synthetic recovery', npc: turn.npc });
        const result = await director.direct({ playerId, playerName: 'Synthetic recovery', message: turn.message, npc: turn.npc, phase: turn.phase, worldFacts: turn.worldFacts, events: [] });
        let rawDecision = null;
        try { rawDecision = JSON.parse(rawCapture?.content); } catch { /* A malformed response is retained and stops the run. */ }
        const checks = checkRecoveryDecision(turn, rawDecision);
        report.observations.push({ scenarioId: scenario.id, case: turn, result, telemetry: director.data.recentRequests.at(-1), raw: rawCapture, checks });
        report.completedCalls = report.observations.length;
        report.budgetUsed = budget.data.used;
        await atomicJson(reportPath, report);
        await atomicJson(join(RECOVERY_ROOT, 'latest.json'), { ...stateMetadata, runId, reportPath, status: 'running', completedCalls: report.completedCalls, requestedCalls: report.requestedCalls, budgetUsed: budget.data.used, budgetRemaining: 200-budget.data.used, updatedAt: new Date().toISOString() });
        console.log(`${report.completedCalls}/${report.requestedCalls} ${turn.id}: ${result.source}; raw checks=${checks.passed}; ${result.latencyMs}ms`);
        if (result.source !== 'mubit' || !checks.passed) { report.stopReason = result.source !== 'mubit' ? 'provider-or-validation-error' : 'raw-decision-target-mismatch'; stopped = true; break; }
      }
      if (stopped) break;
    }
    report.complete = report.observations.length === report.requestedCalls && !report.stopReason;
    report.finishedAt = new Date().toISOString();
    const times = report.observations.map(item => item.result.latencyMs).sort((a,b)=>a-b);
    report.summary = {
      calls: report.observations.length,
      mubitResponses: report.observations.filter(item => item.result.source === 'mubit').length,
      rawTargetPasses: report.observations.filter(item => item.checks.passed).length,
      sessions: new Set(report.observations.map(item => item.result.sessionId)).size,
      medianLatencyMs: times.length ? (times[Math.floor((times.length-1)/2)] + times[Math.floor(times.length/2)])/2 : null,
      p95LatencyMs: times.length ? times[Math.ceil(times.length*.95)-1] : null,
      promptTokens: report.observations.reduce((n,item)=>n+(item.telemetry.tokens.prompt_tokens??0),0),
      completionTokens: report.observations.reduce((n,item)=>n+(item.telemetry.tokens.completion_tokens??0),0),
      totalTokens: report.observations.reduce((n,item)=>n+(item.telemetry.tokens.total_tokens??0),0),
      unknownUsageResponses: report.observations.filter(item => item.telemetry.tokens.total_tokens == null).length
    };
    await atomicJson(reportPath, report);
    await budget.finishRound(runId, report.complete ? 'batch-complete-awaiting-console' : 'stopped-needs-feedback');
    await atomicJson(join(RECOVERY_ROOT, 'latest.json'), { ...stateMetadata, runId, reportPath, status: report.complete ? 'batch-complete-awaiting-console' : 'stopped-needs-feedback', completedCalls: report.completedCalls, requestedCalls: report.requestedCalls, stopReason: report.stopReason ?? null, budgetUsed: budget.data.used, budgetRemaining: 200-budget.data.used, updatedAt: report.finishedAt });
    console.log(JSON.stringify({ reportPath, complete: report.complete, stopReason: report.stopReason ?? null, summary: report.summary, budgetUsed: budget.data.used, budgetRemaining: 200-budget.data.used },null,2));
    return report;
  } finally { await budget.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runRecovery();
