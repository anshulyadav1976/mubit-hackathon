import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RECOVERY_ROOT } from './train-recovery.mjs';

async function read(path) { try { return JSON.parse(await readFile(path,'utf8')); } catch(error) { if(error.code==='ENOENT') return null; throw error; } }
const [latest,ledger,lock]=await Promise.all([read(join(RECOVERY_ROOT,'latest.json')),read(join(RECOVERY_ROOT,'call-ledger.json')),read(join(RECOVERY_ROOT,'call-ledger.json.lock'))]);
let workerAlive=false;
if(lock?.pid) { try { process.kill(lock.pid,0); workerAlive=true; } catch(error) { if(error.code!=='ESRCH') throw error; } }
console.log(JSON.stringify({ paidCallsMadeByThisCheck:0, latest, budget:ledger?{used:ledger.used,remaining:ledger.limit-ledger.used,rounds:ledger.rounds?.length??null,maximumRounds:3}:null,lock:lock?{pid:lock.pid,workerAlive,startedAt:lock.startedAt}:null, nextAction:lock?'Do not start another batch while the lock exists. If the worker is gone, review partial reports before manually clearing only the stale lock.':'Inspect actual console feedback before any targeted recovery; never blindly resend the initial batch.' },null,2));
