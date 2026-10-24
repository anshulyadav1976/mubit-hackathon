import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CANDIDATE_SESSIONS, DATASET_ID, FROZEN_PROMPT_FINGERPRINT, MODEL } from './fixtures/story-v2.mjs';
import { prepareStoryV2, preparedRequest, promptFingerprint, checkGoldenFields, sha256 } from './prepare-story-v2.mjs';
import { validateDecision } from './director.mjs';
import { RecoveryBudget, atomicJson } from './recovery-budget.mjs';

const ROOT=join(import.meta.dirname,'runtime','training-recovery');
export const TRUNCATED_RUN_ID='story-v2-435090e6-250d-4b37-9876-b155a4d3523d';
const ENDPOINT='https://api.mubit.ai/openai/v1/chat/completions';
const histogram=(turns,field)=>Object.fromEntries([...new Set(turns.map(field))].sort().map(key=>[key,turns.filter(t=>field(t)===key).length]));
export function selectSessions(count=100) {
  assert.ok(Number.isInteger(count)&&count>=4&&count<=100&&count%4===0,'--count must be a multiple of4 from4 to100');
  const chosen=[], remaining=[...CANDIDATE_SESSIONS], realms={}, trials={}, seen=new Set();
  while(chosen.length<count/4) {
    const score=session=>{
      const tags=new Set(session.turns.flatMap(t=>t.tags));
      return [...tags].filter(tag=>!seen.has(tag)).length*10-(realms[session.turns[0].expected.chapter.realm]??0)*1000-session.turns.reduce((n,t)=>n+(trials[t.expected.chapter.trial]??0),0);
    };
    remaining.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
    const session=remaining.shift(); chosen.push(session);
    const realm=session.turns[0].expected.chapter.realm;realms[realm]=(realms[realm]??0)+1;
    for(const turn of session.turns) { trials[turn.expected.chapter.trial]=(trials[turn.expected.chapter.trial]??0)+1;for(const tag of turn.tags) seen.add(tag); }
  }
  return chosen;
}
export function selectionCoverage(sessions) {
  const turns=sessions.flatMap(s=>s.turns);
  return {sessions:sessions.length,turns:turns.length,realms:histogram(turns,t=>t.expected.chapter.realm),trials:histogram(turns,t=>t.expected.chapter.trial),npcs:histogram(turns,t=>t.input.npc),stages:histogram(turns,t=>t.input.worldFacts.questStage),tags:histogram(turns.flatMap(t=>t.tags.map(tag=>({tag}))),t=>t.tag)};
}
function options(args) {
  const seen=new Set();let live=false,count=null,feedbackPath=null;
  for(let i=0;i<args.length;i++) {
    const arg=args[i];if(seen.has(arg)) throw Error('Duplicate option');seen.add(arg);
    if(arg==='--live') live=true;
    else if(arg==='--count') { if(!/^\d+$/.test(args[i+1]??'')) throw Error('Missing/invalid --count');count=Number(args[++i]); }
    else if(arg==='--feedback') {if(!args[i+1]||args[i+1].startsWith('--')) throw Error('Missing --feedback path');feedbackPath=resolve(args[++i]);}
    else throw Error(`Unknown option: ${arg}`);
  }
  return {live,count,feedbackPath};
}
async function recoveryPlan(feedbackPath,root,count) {
  const feedbackText=await readFile(feedbackPath,'utf8'),feedback=JSON.parse(feedbackText);
  assert.ok(typeof feedback.reason==='string'&&feedback.reason.trim()&&typeof feedback.evidence==='string'&&feedback.evidence.trim(),'Feedback needs a concrete reason and evidence');
  assert.equal(feedback.maxCompletionTokens,2048,'Only the reviewed2048 token cap is authorized');
  assert.equal(resolve(feedback.sourceReportPath),resolve(root,TRUNCATED_RUN_ID,'report.json'),'Wrong source report path');
  const sourceText=await readFile(feedback.sourceReportPath,'utf8'),source=JSON.parse(sourceText);
  assert.equal(sha256(sourceText),feedback.sourceReportSha256,'Source report hash mismatch');
  assert.equal(source.runId,TRUNCATED_RUN_ID,'Wrong source run');assert.equal(source.dataset,DATASET_ID);
  assert.equal(source.model,MODEL);assert.equal(source.promptFingerprint,FROZEN_PROMPT_FINGERPRINT,'Wrong source fingerprint');
  assert.equal(source.requestedCalls,100);assert.equal(source.status,'stopped-needs-feedback');assert.equal(source.complete,false);
  assert.equal(source.stopReason,'truncated-or-nonstop-response');assert.equal(source.observations.length,7);
  const original=selectSessions(100).flatMap(s=>s.turns);
  for(let i=0;i<7;i++) {
    const observed=source.observations[i];assert.equal(observed.caseId,original[i].id,'Source case order mismatch');
    assert.deepEqual(observed.request,preparedRequest(original[i]),'Source request drift');
    assert.equal(observed.validation.passed,i<6,'Source validation evidence mismatch');
    if(i<6) assert.equal(observed.rawGoldenFields.passed,true,'Source successful raw checks mismatch');
  }
  const failure=source.observations[6];assert.equal(failure.caseId,'candidate-sky_monastery-mixed-negation-3');
  assert.equal(failure.validation.error,'truncated-or-nonstop-response');assert.equal(failure.raw.httpStatus,200);assert.equal(failure.raw.finishReason,'length');assert.equal(failure.raw.content,'');
  assert.equal(failure.request.max_completion_tokens,600);assert.equal(failure.raw.usage.completion_tokens,600);assert.equal(failure.raw.usage.completion_tokens_details.reasoning_tokens,600);
  const turns=original.slice(6);assert.equal(turns.length,94);
  assert.deepEqual(feedback.caseIds,turns.map(t=>t.id),'Feedback must contain exactly the failed case and93 unattempted cases, in original order; no valid replay or heldouts');
  if(count!==null) assert.equal(count,94,'Feedback continuation requires exactly94 requests');
  return {turns,count:94,maxCompletionTokens:2048,feedbackReference:feedbackPath,feedbackSha256:sha256(feedbackText),sourceReportPath:feedback.sourceReportPath,source};
}
function checkContinuationLedger(data,source) {
  assert.equal(data.rounds.length,2,'Targeted continuation must be the final third round');
  const round=data.rounds.at(-1);assert.equal(round.runId,source.runId,'Source is not the latest ledger round');assert.equal(round.status,'stopped-needs-feedback');
  const attempts=data.attempts.filter(a=>a.caseId?.startsWith('candidate-')||a.runId?.startsWith('story-v2-'));
  assert.equal(attempts.length,7,'Other story-v2 attempts exist; no duplicate continuation');
  for(let i=0;i<7;i++) {assert.equal(attempts[i].runId,source.runId);assert.equal(attempts[i].caseId,source.observations[i].caseId);}
  assert.ok(94<=200-data.used,'Requested batch exceeds the remaining cumulative recovery budget');
}
export async function submitStoryV2(args=process.argv.slice(2),{root=ROOT,fetchImpl=fetch,apiKey=process.env.MUBIT_API_KEY,verify=prepareStoryV2}={}) {
  const parsed=options(args),{live,feedbackPath}=parsed;
  await verify([]);assert.equal(promptFingerprint(),FROZEN_PROMPT_FINGERPRINT,'Frozen prompt drift');
  const plan=feedbackPath?await recoveryPlan(feedbackPath,root,parsed.count):{count:parsed.count??100,maxCompletionTokens:600};
  const {count,maxCompletionTokens}=plan;
  const turns=plan.turns??selectSessions(count).flatMap(s=>s.turns);
  const sessions=[...new Set(turns.map(t=>t.sessionId))].map(id=>({turns:turns.filter(t=>t.sessionId===id)})),coverage=selectionCoverage(sessions);
  if(!live) {if(plan.source) checkContinuationLedger(JSON.parse(await readFile(join(root,'call-ledger.json'),'utf8')),plan.source);return {mode:'dry-run',paidCalls:0,model:MODEL,promptFingerprint:promptFingerprint(),coverage,caseIds:turns.map(t=>t.id),maxCompletionTokens,feedbackReference:plan.feedbackReference??null,feedbackSha256:plan.feedbackSha256??null};}
  if(!apiKey) throw Error('MUBIT_API_KEY is required; no requests made');
  // A missing historical ledger must not silently create a fresh allowance.
  await readFile(join(root,'call-ledger.json'));
  const budget=await RecoveryBudget.acquire(join(root,'call-ledger.json'));
  try {
    if(plan.source) checkContinuationLedger(budget.data,plan.source);
    else if(budget.data.attempts.some(a=>a.caseId?.startsWith('candidate-'))||budget.data.rounds.some(r=>r.runId?.startsWith('story-v2-'))) throw Error('Prior story-v2 batch/attempt exists; targeted new authorization and feedback require a separately reviewed plan. No automatic resume.');
    const runId=`story-v2-${randomUUID()}`,reportPath=join(root,runId,'report.json');
    const report={runId,authorization:'Human request on 25 October 2026 Europe/London to submit new story-v2 candidate examples; not legacy retraining.',purpose:'Bounded candidate inference submissions; kept examples, training and serving require separate provider evidence.',dataset:DATASET_ID,model:MODEL,promptFingerprint:promptFingerprint(),coverage,requestedCalls:count,plannedMaxCompletionTokens:maxCompletionTokens,feedbackReference:plan.feedbackReference??null,feedbackSha256:plan.feedbackSha256??null,sourceReportPath:plan.sourceReportPath??null,smokeCalls:Math.min(4,count),smokeStatus:'pending',observations:[],status:'running',complete:false,kept:null,training:null,testing:null,passed:null,serving:null,startedAt:new Date().toISOString()};
    await budget.startRound(runId,reportPath,count,plan.feedbackReference??null);
    const save=async()=>{report.budgetUsed=budget.data.used;report.budgetRemaining=200-budget.data.used;await atomicJson(reportPath,report);await atomicJson(join(root,'story-v2-latest.json'),{runId,reportPath,status:report.status,completedCalls:report.observations.length,requestedCalls:count,budgetUsed:report.budgetUsed,budgetRemaining:report.budgetRemaining,roundNumber:budget.data.rounds.length,stopReason:report.stopReason??null,updatedAt:new Date().toISOString()});};
    await save();
    for(const turn of turns) {
      const request={...preparedRequest(turn),max_completion_tokens:maxCompletionTokens};assert.equal(request.model,MODEL);assert.equal(promptFingerprint(),FROZEN_PROMPT_FINGERPRINT);
      const number=await budget.reserve(runId,turn.id),observation={caseId:turn.id,sessionId:turn.sessionId,request,actualMaxCompletionTokens:request.max_completion_tokens,raw:null,rawGoldenFields:null,guardedResult:null,validation:{passed:false,error:null}};
      const start=performance.now();
      try {
        const response=await fetchImpl(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
        observation.raw={httpStatus:response.status,middlewareRequestId:response.headers.get('x-middleware-request-id')??response.headers.get('x-request-id'),body:await response.text(),content:null,usage:null,finishReason:null};
        if(observation.raw.body.length>64000) {observation.raw.bodyCharacters=observation.raw.body.length;observation.raw.body=observation.raw.body.slice(0,64000);observation.raw.bodyTruncated=true;throw Error('oversized-envelope');}
        let envelope;try { envelope=JSON.parse(observation.raw.body); }catch {if(response.ok) throw Error('invalid-envelope-json');}
        Object.assign(observation.raw,{content:envelope?.choices?.[0]?.message?.content??null,usage:envelope?.usage??null,finishReason:envelope?.choices?.[0]?.finish_reason??null});
        if(!response.ok) throw Error(`http_${response.status}`);
        if(observation.raw.finishReason!=='stop') throw Error('truncated-or-nonstop-response');
        let decision;try {decision=JSON.parse(observation.raw.content);}catch {throw Error('invalid-content-json');}
        observation.rawGoldenFields=checkGoldenFields(turn,decision);
        try {validateDecision(decision);}catch {throw Error('schema-error');}
        // Production validation defaults these fields; the frozen wire contract requires them explicitly.
        if(!decision.chapter||!Object.hasOwn(decision,'intent')||!Object.hasOwn(decision,'answer')) throw Error('schema-error');
        observation.validation.passed=true;
      } catch(error) {
        observation.validation.error=error.name==='TimeoutError'||error.name==='AbortError'?'timeout':/^(http_\d+|invalid-envelope-json|invalid-content-json|truncated-or-nonstop-response|schema-error|oversized-envelope)$/.test(error.message)?error.message:'network-or-read-error';
        report.stopReason=observation.validation.error;
      }
      observation.latencyMs=Math.round(performance.now()-start);report.observations.push(observation);
      await budget.record(number,{status:observation.validation.passed?'gateway-response':'stopped-error',httpStatus:observation.raw?.httpStatus??null,middlewareRequestId:observation.raw?.middlewareRequestId??null,usage:observation.raw?.usage??null,error:observation.validation.error});
      if(report.stopReason&&report.observations.length<=4) report.smokeStatus='failed';
      else if(report.observations.length===4) report.smokeStatus='completed';
      await save();
      if(report.stopReason) break;

    }
    report.complete=report.observations.length===count&&!report.stopReason;report.status=report.complete?'batch-complete-status-unverified':'stopped-needs-feedback';report.finishedAt=new Date().toISOString();
    report.summary={attempts:report.observations.length,validOutputs:report.observations.filter(o=>o.validation.passed).length,rawGoldenPasses:report.observations.filter(o=>o.rawGoldenFields?.passed).length,validGoldenDifferences:report.observations.filter(o=>o.validation.passed&&!o.rawGoldenFields?.passed).length,validationErrors:report.observations.filter(o=>!o.validation.passed).length,totalTokens:report.observations.reduce((n,o)=>n+(o.raw?.usage?.total_tokens??0),0),unknownUsageResponses:report.observations.filter(o=>o.raw?.usage?.total_tokens==null).length};
    await save();await budget.finishRound(runId,report.status);return {reportPath,...report};
  }finally {await budget.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const result=await submitStoryV2();console.log(JSON.stringify(result.mode?result:{reportPath:result.reportPath,status:result.status,stopReason:result.stopReason??null,summary:result.summary,budgetUsed:result.budgetUsed,budgetRemaining:result.budgetRemaining},null,2));
}
