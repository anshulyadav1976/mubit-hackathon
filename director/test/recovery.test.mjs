import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RecoveryBudget, atomicJson } from '../recovery-budget.mjs';
import { validateRecoveryDataset, checkRecoveryDecision, runRecovery } from '../train-recovery.mjs';
import { RECOVERY_SCENARIOS } from '../fixtures/recovery.mjs';

test('recovery dataset covers96 distinct examples and24 independent sessions with all phases/NPCs', () => {
  const coverage = validateRecoveryDataset();
  assert.equal(coverage.examples,96); assert.equal(coverage.sessions,24);
  assert.deepEqual(coverage.phases,{village:36,adventure:24,complete:24,rescued:12});
  assert.deepEqual(Object.keys(coverage.npcs).sort(),['Elin','Mara','Oren']);
  assert.equal(coverage.corrections,12); assert.equal(coverage.committedRouteCases,60);
  assert.throws(()=>validateRecoveryDataset(RECOVERY_SCENARIOS.slice(1)));
  for (const scenario of RECOVERY_SCENARIOS) for (const turn of scenario.turns) {
    if (turn.npc==='Elin') assert.notEqual(turn.phase,'village');
    if (turn.phase==='complete') assert.equal(turn.worldFacts.ElinHome,true);
    if (turn.phase==='adventure') assert.equal(turn.worldFacts.ElinHome,false);
    if (turn.expected.route==='combat') assert.equal(turn.worldFacts.runesActivated,0);
  }
});

test('raw model decisions are checked before backend route guards can hide a failed lock', () => {
  const turn=RECOVERY_SCENARIOS[0].turns[2];
  const answer={dialogue:'The guards hold the seal. Keep our villagers safe.',route:'combat',mood:'wonder',difficulty:2,objective:'Defeat the guards.',preferences:{combat:true,mystery:false,protectVillagers:true},reason:'The combat route is committed.'};
  assert.equal(checkRecoveryDecision(turn,answer).passed,true);
  assert.ok(checkRecoveryDecision(turn,{...answer,route:'mystery'}).failures.includes('committed-route'));
  assert.ok(checkRecoveryDecision(turn,{...answer,preferences:{...answer.preferences,protectVillagers:false}}).failures.includes('villager-protection'));
});

test('ambiguous or missing paid-run options are rejected before any request or default batch', async()=>{
  for (const args of [['--live','--count=1'],['--live','--count'],['--live','--count','--feedback'],['--live','--feedback']]) await assert.rejects(()=>runRecovery(args),/Unknown recovery option|Missing value/);
});

test('paid-call ledger reserves before requests, survives restart and blocks overlapping workers', async t=>{
  const directory=await mkdtemp(join(tmpdir(),'everafter-budget-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=join(directory,'ledger.json');
  const budget=await RecoveryBudget.acquire(path);
  await assert.rejects(()=>RecoveryBudget.acquire(path),{code:'EEXIST'});
  await budget.startRound('run1','report1.json',96,null);
  const number=await budget.reserve('run1','case1');
  assert.equal(JSON.parse(await readFile(path,'utf8')).used,1);
  await budget.record(number,{status:'transport-error'});await budget.close();
  const resumed=await RecoveryBudget.acquire(path);
  assert.equal(resumed.data.used,1);assert.equal(resumed.data.attempts[0].status,'transport-error');
  await resumed.close();
});

test('recovery ledger fails closed on corruption,200-call exhaustion and fourth round',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'everafter-budget-limit-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=join(directory,'ledger.json');
  await writeFile(path,'not-json');await assert.rejects(()=>RecoveryBudget.acquire(path));
  await atomicJson(path,{version:1,limit:200,used:200,attempts:Array.from({length:200},(_,i)=>({number:i+1})),rounds:[]});
  const exhausted=await RecoveryBudget.acquire(path);await assert.rejects(()=>exhausted.reserve('run','case'),/exhausted/);await exhausted.close();
  await atomicJson(path,{version:1,limit:200,used:0,attempts:[],rounds:[{runId:'one'},{runId:'two'},{runId:'three'}]});
  const rounds=await RecoveryBudget.acquire(path);await assert.rejects(()=>rounds.startRound('four','report.json',1,'feedback.json'),/maximum/);await rounds.close();
});
