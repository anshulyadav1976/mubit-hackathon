import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Director } from './director.mjs';
import { SYNTHETIC_SCENARIOS } from './fixtures/synthetic.mjs';
import { SYSTEM_PROMPT, RESPONSE_FORMAT } from './prompt.mjs';

export function trainingCount(args) {
  const index = args.indexOf('--count');
  const count = index < 0 ? 40 : Number(args[index + 1]);
  if (!Number.isInteger(count) || count < 1 || count > 40) throw new Error('--count must be an integer from 1 to 40');
  return count;
}

export async function runSynthetic(args = process.argv.slice(2)) {
  if (!args.includes('--run')) { console.log('No requests made. Explicit paid run: node train-synthetic.mjs --run --count 40'); return; }
  const count = trainingCount(args);
  if (!process.env.MUBIT_API_KEY) throw new Error('MUBIT_API_KEY is required; no requests made');
  const runId = `synthetic-${randomUUID()}`;
  const runtimeDir = join(import.meta.dirname, 'runtime', 'synthetic-training', runId);
  const director = new Director({ runtimeDir: null, maxCalls: count });
  const observations = [];
  for (let index = 0; index < count; index++) {
    const scenarioIndex = Math.floor(index / 5);
    const message = SYNTHETIC_SCENARIOS[scenarioIndex][index % 5];
    const result = await director.direct({ playerId: `${runId}-${scenarioIndex}`, playerName: `Synthetic ${scenarioIndex + 1}`, npc: index % 5 === 4 ? 'Oren' : 'Mara', phase: 'village', message, worldFacts: { missingSister: 'Elin', sisterRescued: false, villageSafe: true }, events: [] });
    observations.push({ dataset: 'authored-synthetic', example: index + 1, scenario: scenarioIndex + 1, input: message, result, telemetry: director.data.recentRequests.at(-1) });
    console.log(`${index + 1}/${count}: ${result.source}, ${result.latencyMs} ms, ${result.requestId}`);
    if (result.source !== 'mubit') { console.warn('Stopping after fallback. Inspect the report before making more paid calls.'); break; }
  }
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  const localPromptFingerprint = createHash('sha256').update(JSON.stringify({ model: director.model, system: SYSTEM_PROMPT, responseFormat: RESPONSE_FORMAT })).digest('hex');
  const report = { runId, dataset: 'authored-synthetic', purpose: 'Explicit shared-task requests to Mubit. This does not prove a trained adapter exists or improved.', model: director.model, localPromptFingerprint, responseFormat: RESPONSE_FORMAT, requestedCalls: count, completedCalls: observations.length, metrics: director.state().metrics, observations, createdAt: new Date().toISOString() };
  const reportPath = join(runtimeDir, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Synthetic run report: ${reportPath}`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runSynthetic();
