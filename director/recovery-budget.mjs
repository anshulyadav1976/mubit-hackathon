import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const RECOVERY_CALL_LIMIT = 200;
export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, path);
}

export class RecoveryBudget {
  static async acquire(path) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const lockPath = `${path}.lock`;
    const lock = await open(lockPath, 'wx', 0o600);
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    try {
      let data;
      try { data = JSON.parse(await readFile(path, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; data = { version: 1, scope: 'everafter-adapter-recovery-2026-10-24', limit: RECOVERY_CALL_LIMIT, used: 0, attempts: [], rounds: [] }; }
      if (data.version !== 1 || data.limit !== RECOVERY_CALL_LIMIT || !Number.isInteger(data.used) || data.used < 0 || data.used > RECOVERY_CALL_LIMIT || !Array.isArray(data.attempts) || data.attempts.length !== data.used) throw new Error('Recovery ledger is invalid; refusing paid requests');
      if (!Array.isArray(data.rounds) || data.rounds.length > 3) throw new Error('Recovery round ledger is invalid; refusing paid requests');
      const budget = new RecoveryBudget(path, lockPath, lock, data);
      await atomicJson(path, data);
      return budget;
    } catch (error) { await lock.close(); await rm(lockPath, { force: true }); throw error; }
  }
  constructor(path, lockPath, lock, data) { this.path = path; this.lockPath = lockPath; this.lock = lock; this.data = data; }
  async startRound(runId, reportPath, requestedCalls, feedbackReference) {
    if (this.data.rounds.length >= 3) throw new Error('The maximum of3 recovery rounds has been reached');
    if (requestedCalls > RECOVERY_CALL_LIMIT - this.data.used) throw new Error('Requested batch exceeds the remaining cumulative recovery budget');
    this.data.rounds.push({ runId, reportPath, requestedCalls, feedbackReference, status: 'running', startedAt: new Date().toISOString() });
    await atomicJson(this.path, this.data);
  }
  async finishRound(runId, status) { Object.assign(this.data.rounds.find(item => item.runId === runId), { status, finishedAt: new Date().toISOString() }); await atomicJson(this.path, this.data); }
  async reserve(runId, caseId) {
    if (this.data.used >= RECOVERY_CALL_LIMIT) throw new Error('The cumulative 200-call recovery budget is exhausted');
    const entry = { number: ++this.data.used, runId, caseId, at: new Date().toISOString(), status: 'reserved-before-request' };
    this.data.attempts.push(entry);
    await atomicJson(this.path, this.data);
    return entry.number;
  }
  async record(number, result) { Object.assign(this.data.attempts[number - 1], result); await atomicJson(this.path, this.data); }
  async close() { await this.lock.close(); await rm(this.lockPath, { force: true }); }
}
