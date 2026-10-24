import test from 'node:test';
import assert from 'node:assert/strict';
import { EVALUATION_CASES } from '../fixtures/evaluation.mjs';
import { evaluationOptions, scoreCase, summarize, compareReports } from '../evaluate.mjs';

test('evaluation defaults to offline and bounds explicit live requests to twenty', () => {
  assert.equal(EVALUATION_CASES.length, 20);
  assert.equal(new Set(EVALUATION_CASES.map(item => item.id)).size, 20);
  assert.equal(evaluationOptions([]).live, false);
  assert.equal(evaluationOptions([]).count, 20);
  assert.equal(evaluationOptions(['--live', '--label', 'baseline']).live, true);
  for (const count of ['0', '21', 'Infinity', 'NaN', '1.5']) assert.throws(() => evaluationOptions(['--count', count]));
  assert.throws(() => evaluationOptions(['--label', 'baseline']));
  assert.throws(() => evaluationOptions(['--live', '--label', 'offline']));
});

test('preference scoring counts false positives and misses, rather than inventing improvement', () => {
  const fixture = EVALUATION_CASES[0];
  const result = { dialogue: 'Oren knows the rune trail.', route: 'combat', mood: 'wonder', difficulty: 1, objective: 'Find Elin.', reason: 'A synthetic test.', preferences: { combat: true, mystery: false, protectVillagers: true }, latencyMs: 10, source: 'fallback' };
  const scores = scoreCase(fixture, result);
  assert.deepEqual(scores.preferenceCounts, { tp: 0, fp: 1, fn: 1, tn: 0 });
  assert.equal(scores.routeCorrect, false); assert.equal(scores.constraints, true);
  const summary = summarize([{ kind: 'preference', result, scores }, { kind: 'preference', result: { ...result, latencyMs: 20 }, scores }]);
  assert.equal(summary.preferenceMicro.f1, 0);
  assert.equal(summary.latencyMs.median, 15);
  assert.equal(summary.mubitResponses, 0);
  assert.equal(summary.fallbackResponses, 2);
});

test('comparisons reject offline, partial or mismatched runs and report signed observed deltas', () => {
  const baseline = { runId: 'before', mode: 'live-mubit', complete: true, fingerprint: 'same', results: [1], summary: { preferenceMicro: { f1: .8 }, explicitRoutePreference: { rate: .8 }, latencyMs: { median: 1000 } } };
  const current = { ...baseline, runId: 'after', summary: { preferenceMicro: { f1: .6 }, explicitRoutePreference: { rate: .5 }, latencyMs: { median: 2000 } } };
  assert.ok(compareReports(baseline, current).preferenceF1Delta < 0);
  assert.equal(compareReports(baseline, current).medianLatencyMsDelta, 1000);
  for (const change of [{ mode: 'offline-fallback-validation' }, { complete: false }, { fingerprint: 'different' }]) assert.throws(() => compareReports({ ...baseline, ...change }, current));
});
