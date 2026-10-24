import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Director, validateDecision } from './director.mjs';
import { SYSTEM_PROMPT, RESPONSE_FORMAT } from './prompt.mjs';
import { EVALUATION_CASES } from './fixtures/evaluation.mjs';

const option = (args, name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
export function evaluationOptions(args) {
  const count = Number(option(args, '--count', 20));
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('--count must be an integer from 1 to 20');
  const live = args.includes('--live');
  const label = option(args, '--label', live ? 'unlabelled-live' : 'offline');
  if (!['offline', 'baseline', 'post-training', 'unlabelled-live'].includes(label)) throw new Error('Invalid evaluation label');
  if (!live && label !== 'offline') throw new Error('Baseline/post-training labels require --live; offline scores cannot measure Mubit');
  if (live && label === 'offline') throw new Error('--live cannot use the offline label');
  return { live, count, label, output: option(args, '--output', null), compare: option(args, '--compare', null), consoleEvidence: option(args, '--console-evidence', null) };
}

export function scoreCase(fixture, result) {
  let constraints = true;
  try { validateDecision(result); } catch { constraints = false; }
  constraints &&= result.preferences?.protectVillagers === true;
  const routeCorrect = result.route === fixture.expectedRoute;
  const phaseCorrect = !fixture.objectiveIncludes || result.objective.includes(fixture.objectiveIncludes);
  const counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const [name, expected] of Object.entries(fixture.expectedPreferences ?? {})) {
    const actual = result.preferences?.[name] === true;
    counts[expected ? actual ? 'tp' : 'fn' : actual ? 'fp' : 'tn']++;
  }
  return { constraints, routeCorrect, phaseCorrect, preferenceCounts: counts };
}

export function summarize(rows) {
  const counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const row of rows) for (const key of Object.keys(counts)) counts[key] += row.scores.preferenceCounts[key];
  const preferenceRows = rows.filter(row => row.kind === 'preference');
  const phaseRows = rows.filter(row => row.kind === 'phase');
  const times = rows.map(row => row.result.latencyMs).sort((a, b) => a - b);
  const ratio = (correct, total) => ({ correct, total, rate: total ? correct / total : null });
  return {
    constraints: ratio(rows.filter(row => row.scores.constraints).length, rows.length),
    explicitRoutePreference: ratio(preferenceRows.filter(row => row.scores.routeCorrect).length, preferenceRows.length),
    committedRoute: ratio(phaseRows.filter(row => row.scores.routeCorrect).length, phaseRows.length),
    phaseObjective: ratio(phaseRows.filter(row => row.scores.phaseCorrect).length, phaseRows.length),
    preferenceMicro: { ...counts, precision: counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null, recall: counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : null, f1: 2 * counts.tp + counts.fp + counts.fn ? 2 * counts.tp / (2 * counts.tp + counts.fp + counts.fn) : null },
    latencyMs: { median: times.length ? (times[Math.floor((times.length - 1) / 2)] + times[Math.floor(times.length / 2)]) / 2 : null, p95: times.length ? times[Math.min(times.length - 1, Math.ceil(times.length * .95) - 1)] : null },
    mubitResponses: rows.filter(row => row.result.source === 'mubit').length,
    fallbackResponses: rows.filter(row => row.result.source === 'fallback').length
  };
}

export function compareReports(baseline, current) {
  if (baseline.mode !== 'live-mubit' || current.mode !== 'live-mubit' || !baseline.complete || !current.complete || baseline.fingerprint !== current.fingerprint || baseline.results.length !== current.results.length) throw new Error('Comparison requires complete live Mubit runs with the same model, prompt, format and cases');
  return { baselineRunId: baseline.runId, currentRunId: current.runId, preferenceF1Delta: current.summary.preferenceMicro.f1 - baseline.summary.preferenceMicro.f1, routeAccuracyDelta: current.summary.explicitRoutePreference.rate - baseline.summary.explicitRoutePreference.rate, medianLatencyMsDelta: current.summary.latencyMs.median - baseline.summary.latencyMs.median, interpretation: 'Observed deltas only. Stage names are operator labels. Confirm adapter state in the Mubit console; these synthetic runs do not establish causal training improvement.' };
}

export async function runEvaluation(args = process.argv.slice(2)) {
  const options = evaluationOptions(args);
  if (options.live && !process.env.MUBIT_API_KEY) throw new Error('MUBIT_API_KEY is required for --live; no requests made');
  const runId = randomUUID();
  const director = new Director({ apiKey: options.live ? process.env.MUBIT_API_KEY : '', runtimeDir: null, maxCalls: options.live ? options.count : 0 });
  const cases = EVALUATION_CASES.slice(0, options.count);
  const fingerprint = createHash('sha256').update(JSON.stringify({ model: director.model, system: SYSTEM_PROMPT, responseFormat: RESPONSE_FORMAT, cases })).digest('hex');
  const localPromptFingerprint = createHash('sha256').update(JSON.stringify({ model: director.model, system: SYSTEM_PROMPT, responseFormat: RESPONSE_FORMAT })).digest('hex');
  const baseline = options.compare ? JSON.parse(await readFile(resolve(options.compare), 'utf8')) : null;
  if (baseline && (!options.live || baseline.mode !== 'live-mubit' || !baseline.complete || baseline.fingerprint !== fingerprint)) throw new Error('Incompatible or incomplete baseline; no evaluation requests made');
  const results = [];
  for (const fixture of cases) {
    const playerId = `eval-${randomUUID()}`;
    const profile = director.profile(playerId, 'Synthetic evaluator');
    if (fixture.previousPreferences) {
      profile.preferences = { ...fixture.previousPreferences };
      profile.conversation = [{ role: 'user', npc: fixture.npc, text: fixture.previousPreferences.combat ? 'Earlier I preferred combat.' : 'Earlier I preferred puzzles.', at: '2026-01-01T00:00:00.000Z', synthetic: true }];
    }
    await director.gameState({ playerId, playerName: 'Synthetic evaluator', phase: fixture.phase, route: fixture.committedRoute ?? 'mystery', npc: fixture.npc });
    const result = await director.direct({ playerId, playerName: 'Synthetic evaluator', message: fixture.message, npc: fixture.npc, phase: fixture.phase, worldFacts: { dataset: 'authored-synthetic-evaluation', missingSister: 'Elin', ElinRescued: ['rescued', 'complete'].includes(fixture.phase), villagersSafe: true, committedRoute: fixture.committedRoute ?? null }, events: [] });
    results.push({ id: fixture.id, kind: fixture.kind, fixture, result, scores: scoreCase(fixture, result), telemetry: director.data.recentRequests.at(-1) });
    console.log(`${results.length}/${cases.length} ${fixture.id}: ${result.source}, ${result.latencyMs} ms`);
    if (options.live && result.source !== 'mubit') { console.warn('Stopping live evaluation after fallback; this run is incomplete and cannot be used for baseline/post-training comparison.'); break; }
  }
  const report = { runId, dataset: 'authored-synthetic-evaluation-v1', mode: options.live ? 'live-mubit' : 'offline-fallback-validation', label: options.label, model: director.model, fingerprint, localPromptFingerprint, responseFormat: RESPONSE_FORMAT, requestedCases: cases.length, complete: results.length === cases.length && (!options.live || results.every(row => row.result.source === 'mubit')), adapterState: 'Not automatically verified. Inspect Mubit console before interpreting stage labels.', manualConsoleEvidence: options.consoleEvidence ? { suppliedByOperator: options.consoleEvidence, independentlyVerified: false } : null, limitations: 'Scores describe the guarded director response. They do not measure raw model constraint compliance, real players, generated-world quality, dialogue factuality or proven adapter improvement. Synthetic prior conversation is seeded where specified.', metrics: director.state().metrics, summary: summarize(results), results, createdAt: new Date().toISOString() };
  if (baseline) report.comparison = report.complete ? compareReports(baseline, report) : { unavailable: 'Current live run was incomplete; report retained without comparison.' };
  const outputPath = options.output ? resolve(options.output) : join(import.meta.dirname, 'runtime', 'evaluations', `${options.label}-${runId}.json`);
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ report: outputPath, mode: report.mode, complete: report.complete, summary: report.summary }, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runEvaluation();
