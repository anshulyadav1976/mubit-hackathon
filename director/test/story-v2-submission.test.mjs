import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { submitStoryV2, selectSessions, selectionCoverage, TRUNCATED_RUN_ID } from '../submit-story-v2.mjs';
import { authoredReference, preparedRequest, sha256 } from '../prepare-story-v2.mjs';
import { HELDOUT_SESSIONS, DATASET_ID, FROZEN_PROMPT_FINGERPRINT } from '../fixtures/story-v2.mjs';
import { atomicJson, RecoveryBudget } from '../recovery-budget.mjs';

async function sandbox(t,used=96,rounds=[{runId:'legacy'}]) {
  const root=await mkdtemp(join(tmpdir(),'story-v2-submit-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await atomicJson(join(root,'call-ledger.json'),{version:1,limit:200,used,attempts:Array.from({length:used},(_,i)=>({number:i+1,caseId:`legacy-${i}`})),rounds});
  await writeFile(join(root,'latest.json'),'legacy latest preserved');
  return root;
}
const ledger=root=>readFile(join(root,'call-ledger.json'),'utf8').then(JSON.parse);
function fakeFetch(turns,change=x=>x,cap=600) {
  let calls=0;
  const fetchImpl=async(url,options)=>{
    assert.equal(url,'https://api.mubit.ai/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer offline-test-key');
    const turn=turns[calls++];assert.deepEqual(JSON.parse(options.body),{...preparedRequest(turn),max_completion_tokens:cap});
    assert.ok(!options.body.includes('Authored synthetic field target.'));
    const body={choices:[{finish_reason:'stop',message:{content:JSON.stringify(change(authoredReference(turn)))}}],usage:{total_tokens:10}};
    return new Response(JSON.stringify(body),{headers:{'x-middleware-request-id':`test-${calls}`}});
  };
  return {fetchImpl,get calls(){return calls;}};
}

test('deterministic complete candidate sessions cover realms/trials, all banks/NPCs/stages; heldouts never selected',()=>{
  const picked=selectSessions(),turns=picked.flatMap(s=>s.turns),coverage=selectionCoverage(picked);
  assert.deepEqual(picked,selectSessions());assert.equal(turns.length,100);assert.equal(picked.length,25);
  assert.ok(picked.every(s=>s.split==='candidate'&&s.turns.length===4));assert.equal(new Set(turns.map(t=>t.id)).size,100);
  const heldoutIds=new Set(HELDOUT_SESSIONS.flatMap(s=>s.turns.map(t=>t.id)));assert.ok(turns.every(t=>!heldoutIds.has(t.id)));
  assert.deepEqual(Object.values(coverage.realms).sort(),[24,24,24,28]);assert.deepEqual(Object.values(coverage.trials).sort(),[32,34,34]);
  assert.equal(Object.keys(coverage.npcs).length,6);assert.equal(Object.keys(coverage.stages).length,5);
  for(const tag of ['false-victory','vague-context','commitment-lock','preference-correction','riddle-evidence','parley-evidence','gauntlet-progress','warden-evidence-gates','escort-home','completed-memory']) assert.ok(coverage.tags[tag]>0,tag);
  for(const count of [0,1,99,104,NaN]) assert.throws(()=>selectSessions(count));
});

test('default dry-run is offline and mutation free; malformed options and frozen drift fail before fetch/ledger',async t=>{
  const root=join(await mkdtemp(join(tmpdir(),'story-v2-dry-')),'absent');t.after(()=>rm(join(root,'..'),{recursive:true,force:true}));
  let calls=0;const dependencies={root,fetchImpl:()=>{calls++;throw Error('network forbidden');}};
  const result=await submitStoryV2([],dependencies);assert.equal(result.mode,'dry-run');assert.equal(result.paidCalls,0);assert.equal(calls,0);
  await assert.rejects(()=>readFile(join(root,'call-ledger.json')),{code:'ENOENT'});
  for(const args of [['--count'],['--count','99'],['--count=4'],['--live','--live'],['--resume'],['--count','4','--count','8']]) await assert.rejects(()=>submitStoryV2(args,dependencies));
  await assert.rejects(()=>submitStoryV2(['--live'],{...dependencies,verify:async()=>{throw Error('Frozen prompt/model/format drift');}}),/drift/);assert.equal(calls,0);
});

test('cap/round/lock/missing-ledger denial makes zero requests',async t=>{
  for(const [used,rounds,error] of [[198,[{runId:'legacy'}],/exceeds/],[96,[{},{},{}],/maximum/]]) {
    const root=await sandbox(t,used,rounds);let calls=0;await assert.rejects(()=>submitStoryV2(['--live','--count','4'],{root,apiKey:'offline-test-key',fetchImpl:()=>{calls++;}}),error);assert.equal(calls,0);assert.equal((await ledger(root)).used,used);
  }
  const root=await sandbox(t);const lock=await RecoveryBudget.acquire(join(root,'call-ledger.json'));
  try {await assert.rejects(()=>submitStoryV2(['--live','--count','4'],{root,apiKey:'offline-test-key'}),{code:'EEXIST'});}finally {await lock.close();}
  const missing=join(root,'absent');await assert.rejects(()=>submitStoryV2(['--live','--count','4'],{root:missing,apiKey:'offline-test-key'}),{code:'ENOENT'});
});

test('reserve precedes fetch, raw gold differences stay honest, legacy latest stays intact, duplicate run refused',async t=>{
  const root=await sandbox(t),turns=selectSessions(4).flatMap(s=>s.turns),fake=fakeFetch(turns,value=>({...value,mood:value.mood==='wonder'?'eerie':'wonder'}));
  const report=await submitStoryV2(['--live','--count','4'],{root,apiKey:'offline-test-key',fetchImpl:async(...args)=>{assert.equal((await ledger(root)).used,97+fake.calls);return fake.fetchImpl(...args);}});
  assert.equal(fake.calls,4);assert.equal(report.complete,true);assert.equal(report.summary.validGoldenDifferences,4);assert.equal(report.summary.validationErrors,0);assert.equal(report.summary.rawGoldenPasses,0);
  assert.ok(report.observations.every(o=>o.guardedResult===null&&o.raw.middlewareRequestId&&o.raw.body&&o.raw.usage));
  assert.equal(await readFile(join(root,'latest.json'),'utf8'),'legacy latest preserved');assert.equal((await ledger(root)).used,100);
  await assert.rejects(()=>submitStoryV2(['--live','--count','4'],{root,apiKey:'offline-test-key',fetchImpl:fake.fetchImpl}),/Prior story-v2/);assert.equal(fake.calls,4);
});

test('first transport/HTTP/truncation/JSON/schema error stops without retries and retains one charged reservation',async t=>{
  const valid=authoredReference(selectSessions(4)[0].turns[0]);
  const responses=[
    ()=>{throw Error('socket failed');},
    ()=>new Response('{"error":{"code":"limited"}}',{status:429}),
    ()=>new Response('not-json'),
    ()=>new Response('x'.repeat(64001)),
    ()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...valid,chapter:undefined})}}]})),
    ()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:JSON.stringify(valid)}}]})),
    ()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'not-json'}}]})),
    ()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...valid,difficulty:99})}}]})),
    ()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...valid,intent:undefined})}}]}))
  ];
  for(const respond of responses) {
    const root=await sandbox(t);let calls=0;
    const result=await submitStoryV2(['--live','--count','100'],{root,apiKey:'offline-test-key',fetchImpl:()=>{calls++;return respond();}});
    assert.equal(calls,1);assert.equal(result.complete,false);assert.equal(result.observations.length,1);assert.equal(result.summary.validationErrors,1);assert.equal(result.smokeStatus,'failed');assert.ok(result.stopReason);assert.equal((await ledger(root)).used,97);assert.equal((await ledger(root)).rounds.length,2);
    const saved=JSON.parse(await readFile(result.reportPath));assert.equal(saved.stopReason,result.stopReason);
    if(result.stopReason==='oversized-envelope') {assert.equal(saved.observations[0].raw.body.length,64000);assert.equal(saved.observations[0].raw.bodyCharacters,64001);assert.equal(saved.observations[0].raw.bodyTruncated,true);}assert.equal(saved.budgetRemaining,103);
  }
});

test('4-call smoke checkpoint remains within one locked 100-call batch',async t=>{
  const root=await sandbox(t),turns=selectSessions().flatMap(s=>s.turns),fake=fakeFetch(turns);
  let checkpoint=0;
  const result=await submitStoryV2(['--live','--count','100'],{root,apiKey:'offline-test-key',fetchImpl:async(...args)=>{
    if(fake.calls===4) {
      checkpoint++;const latest=JSON.parse(await readFile(join(root,'story-v2-latest.json')));
      const report=JSON.parse(await readFile(latest.reportPath));assert.equal(report.smokeStatus,'completed');assert.equal(report.observations.length,4);
      assert.equal((await ledger(root)).rounds.length,2);
      await assert.rejects(()=>RecoveryBudget.acquire(join(root,'call-ledger.json')),{code:'EEXIST'});
    }
    return fake.fetchImpl(...args);
  }});
  assert.equal(checkpoint,1);assert.equal(fake.calls,100);assert.equal(result.complete,true);assert.equal((await ledger(root)).used,196);assert.equal((await ledger(root)).rounds.length,2);
});

test('CLI submission options do not leak into the offline verifier',async()=>{
  const {stdout}=await promisify(execFile)(process.execPath,[fileURLToPath(new URL('../submit-story-v2.mjs',import.meta.url)),'--count','4']);
  const result=JSON.parse(stdout);assert.equal(result.mode,'dry-run');assert.equal(result.paidCalls,0);assert.equal(result.coverage.turns,4);
});

async function recoverySandbox(t) {
  const root=await sandbox(t),original=selectSessions(100).flatMap(s=>s.turns);
  const source={runId:TRUNCATED_RUN_ID,dataset:DATASET_ID,model:'gpt-6-luna',promptFingerprint:FROZEN_PROMPT_FINGERPRINT,requestedCalls:100,status:'stopped-needs-feedback',complete:false,stopReason:'truncated-or-nonstop-response',observations:original.slice(0,7).map((turn,i)=>({caseId:turn.id,request:preparedRequest(turn),validation:{passed:i<6,error:i<6?null:'truncated-or-nonstop-response'},rawGoldenFields:i<6?{passed:true,failures:[]}:null,raw:i<6?{}:{httpStatus:200,finishReason:'length',content:'',usage:{completion_tokens:600,completion_tokens_details:{reasoning_tokens:600}}}}))};
  const sourceReportPath=join(root,TRUNCATED_RUN_ID,'report.json');await atomicJson(sourceReportPath,source);
  const feedback={sourceReportPath,sourceReportSha256:sha256(await readFile(sourceReportPath)),reason:'Output cap was exhausted by reasoning.',evidence:'Seventh request returned HTTP200, length, empty content and600 reasoning/completion tokens at600 cap.',caseIds:original.slice(6).map(t=>t.id),maxCompletionTokens:2048};
  const feedbackPath=join(root,'feedback.json');await atomicJson(feedbackPath,feedback);
  const data=await ledger(root);data.used=103;data.attempts.push(...source.observations.map((o,i)=>({number:97+i,runId:source.runId,caseId:o.caseId})));data.rounds.push({runId:source.runId,status:source.status});await atomicJson(join(root,'call-ledger.json'),data);
  return {root,original,source,sourceReportPath,feedback,feedbackPath};
}

test('explicit feedback continues exactly failed seventh and93 unattempted cases, with output-cap-only difference',async t=>{
  const state=await recoverySandbox(t),{root,original,feedbackPath,sourceReportPath}=state,sourceBefore=await readFile(sourceReportPath,'utf8');
  const dry=await submitStoryV2(['--feedback',feedbackPath],{root});assert.equal(dry.paidCalls,0);assert.equal(dry.coverage.turns,94);assert.equal(dry.caseIds[0],original[6].id);assert.equal(dry.maxCompletionTokens,2048);assert.equal((await ledger(root)).used,103);
  const fake=fakeFetch(original.slice(6),x=>x,2048);
  const result=await submitStoryV2(['--live','--feedback',feedbackPath,'--count','94'],{root,apiKey:'offline-test-key',fetchImpl:fake.fetchImpl});
  assert.equal(fake.calls,94);assert.equal(result.complete,true);assert.equal(result.feedbackReference,feedbackPath);assert.equal(result.feedbackSha256,sha256(await readFile(feedbackPath)));assert.equal(result.plannedMaxCompletionTokens,2048);
  assert.ok(result.observations.every(o=>o.actualMaxCompletionTokens===2048));assert.equal((await ledger(root)).used,197);assert.equal((await ledger(root)).rounds.length,3);
  assert.equal(await readFile(sourceReportPath,'utf8'),sourceBefore);assert.equal(await readFile(join(root,'latest.json'),'utf8'),'legacy latest preserved');
  await assert.rejects(()=>submitStoryV2(['--live','--feedback',feedbackPath],{root,apiKey:'offline-test-key',fetchImpl:fake.fetchImpl}),/final third round/);assert.equal(fake.calls,94);
});

test('feedback refuses valid replay, unknown/heldout/duplicate IDs, arbitrary source, missing evidence, cap and fingerprint drift before requests',async t=>{
  const changes=[
    ({feedback,original})=>{feedback.caseIds[0]=original[0].id;},
    ({feedback})=>{feedback.caseIds[0]='candidate-unknown';},
    ({feedback})=>{feedback.caseIds[0]=HELDOUT_SESSIONS[0].turns[0].id;},
    ({feedback})=>{feedback.caseIds[1]=feedback.caseIds[0];},
    ({feedback})=>{feedback.sourceReportPath+='.wrong';},
    ({feedback})=>{feedback.reason='';},
    ({feedback})=>{feedback.evidence='';},
    ({feedback})=>{feedback.maxCompletionTokens=4096;},
    ({source})=>{source.promptFingerprint='drift';},
    ({source})=>{source.observations[6].request.max_completion_tokens=700;},
    ({source})=>{source.observations[6].raw.usage.completion_tokens_details.reasoning_tokens=599;},
    ({source})=>{source.observations[0].validation.passed=false;}
  ];
  for(const change of changes) {
    const state=await recoverySandbox(t);change(state);await atomicJson(state.sourceReportPath,state.source);state.feedback.sourceReportSha256=sha256(await readFile(state.sourceReportPath));await atomicJson(state.feedbackPath,state.feedback);let calls=0;
    await assert.rejects(()=>submitStoryV2(['--live','--feedback',state.feedbackPath],{root:state.root,apiKey:'offline-test-key',fetchImpl:()=>{calls++;}}));assert.equal(calls,0);assert.equal((await ledger(state.root)).used,103);
  }
});

test('targeted recovery rejects insufficient cap and stops at first new failure without retry',async t=>{
  const denied=await recoverySandbox(t),data=await ledger(denied.root);while(data.used<107) data.attempts.push({number:++data.used,caseId:'legacy-extra'});await atomicJson(join(denied.root,'call-ledger.json'),data);let calls=0;
  await assert.rejects(()=>submitStoryV2(['--live','--feedback',denied.feedbackPath],{root:denied.root,apiKey:'offline-test-key',fetchImpl:()=>{calls++;}}),/exceeds/);assert.equal(calls,0);
  const state=await recoverySandbox(t);const result=await submitStoryV2(['--live','--feedback',state.feedbackPath],{root:state.root,apiKey:'offline-test-key',fetchImpl:()=>{calls++;throw Error('network failed');}});
  assert.equal(calls,1);assert.equal(result.complete,false);assert.equal((await ledger(state.root)).used,104);assert.equal((await ledger(state.root)).rounds.length,3);
});
