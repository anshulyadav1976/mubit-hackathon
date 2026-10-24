// Offline preparation only. This module has no submission path and never reads provider credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SYSTEM_PROMPT, RESPONSE_FORMAT, STORY_CONTRACT_VERSION } from './prompt.mjs';
import { validateInput, validateDecision, preferenceUpdate } from './director.mjs';
import { CANDIDATE_SESSIONS, HELDOUT_SESSIONS, DATASET_ID, MODEL, FROZEN_PROMPT_FINGERPRINT } from './fixtures/story-v2.mjs';
export const PREPARED_DIR=join(import.meta.dirname,'fixtures','story-v2');
const encoded=value=>JSON.stringify(value,null,2)+'\n';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const promptFingerprint=()=>sha256(JSON.stringify({model:MODEL,system:SYSTEM_PROMPT,responseFormat:RESPONSE_FORMAT}));
const flatten=sessions=>sessions.flatMap(session=>session.turns);
const histogram=(rows,field)=>Object.fromEntries([...new Set(rows.map(field))].sort().map(key=>[key,rows.filter(row=>field(row)===key).length]));
const lexicalTemplate=text=>text.toLowerCase().replace(/ember keep|sunken archive|sky monastery|thornwild/g,'REALM').replace(/\b(?:fire|river|wind|hole)\b/g,'SOLUTION').replace(/[^a-z0-9]+/g,' ').trim();

export function preparedRequest(turn) {
  const input=structuredClone(turn.input);
  return {model:MODEL,messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify({sessionId:turn.sessionId,playerId:input.playerId})},{role:'user',content:JSON.stringify({...input,player:{id:input.playerId,name:input.playerName},game:turn.game,memory:{...turn.memory,provisionalFallbackPreferences:preferenceUpdate(input.message,turn.memory.preferences)}})}],response_format:RESPONSE_FORMAT,max_completion_tokens:600};
}
export function checkGoldenFields(turn,raw) {
  const failures=[];
  try { validateDecision(raw); } catch { failures.push('schema'); }
  for(const key of ['route','mood','difficulty','intent','answer']) if(raw?.[key]!==turn.expected[key]) failures.push(key);
  for(const key of ['combat','mystery','protectVillagers']) if(raw?.preferences?.[key]!==turn.expected.preferences[key]) failures.push(`preferences.${key}`);
  for(const key of ['realm','trial','twist',...(turn.game.areaCommitted?['title','hook']:[])]) if(raw?.chapter?.[key]!==turn.expected.chapter[key]) failures.push(`chapter.${key}`);
  for(const key of ['phase','worldFacts','inventory','rescued','reunited','kills']) if(raw && Object.hasOwn(raw,key)) failures.push(`forbidden-world-mutation.${key}`);
  return {passed:failures.length===0,failures};
}
export function authoredReference(turn) {
  // A schema/gold self-check target, not a teacher-model completion or proof of factual dialogue quality.
  return {...turn.expected,dialogue:`${turn.input.npc}: ${turn.expected.objective}`,reason:'Authored synthetic field target. The game alone verifies and applies actual actions.'};
}
function validateSnapshot(turn) {
  const facts=turn.input.worldFacts;
  assert.equal(turn.game.phase,turn.input.phase);
  assert.equal(turn.game.areaCommitted,turn.input.phase!=='village');
  assert.deepEqual(turn.game.chapter,turn.expected.chapter);
  assert.deepEqual(turn.game.worldFacts,facts);
  assert.equal(facts.questStage,turn.game.questStage);
  assert.equal(facts.reunited,turn.input.phase==='complete');
  assert.equal(facts.ElinRescued,['rescued','complete'].includes(turn.input.phase));
  if(facts.trialResolved) assert.ok(facts.clueDiscovered && facts.artifactClaimed);
  if(facts.sentinelResolved) assert.ok(facts.trialResolved);
  if(facts.wardenResolved) assert.ok(facts.sentinelResolved);
  assert.ok(!(facts.sentinelSpared&&facts.sentinelDefeated));
  assert.ok(!(facts.wardenSpared&&facts.wardenDefeated));
  if(turn.expected.intent==='answer') assert.ok(turn.input.message.toLowerCase().includes(turn.expected.answer));
  if(turn.actionPrecondition==='blocked-missing-clue') assert.equal(facts.clueDiscovered,false);
  if(turn.actionPrecondition==='blocked-sentinel-not-spared') assert.equal(facts.sentinelSpared,false);
  if(turn.actionPrecondition==='trial-evidence-present') assert.equal(facts.clueDiscovered,true);
  if(turn.input.phase!=='adventure') assert.equal(turn.expected.intent,'none');
}
export function validatePreparedDataset(candidates=CANDIDATE_SESSIONS,heldouts=HELDOUT_SESSIONS) {
  assert.equal(STORY_CONTRACT_VERSION,2,'Wrong production story contract');
  assert.equal(promptFingerprint(),FROZEN_PROMPT_FINGERPRINT,'Production prompt/model/format drift: make a new dataset version; do not repurpose this frozen set');
  assert.equal(candidates.length,60); assert.equal(heldouts.length,15);
  const all=[...candidates,...heldouts], rows=flatten(all), training=flatten(candidates), evaluation=flatten(heldouts);
  assert.equal(training.length,240); assert.equal(evaluation.length,60);
  assert.equal(new Set(all.map(session=>session.id)).size,75);
  assert.equal(new Set(rows.map(turn=>turn.id)).size,300);
  assert.equal(new Set(rows.map(turn=>turn.input.message)).size,300,'Duplicate utterance');
  const candidateTemplates=new Set(training.map(turn=>turn.templateId));
  const candidateLexical=new Set(training.map(turn=>lexicalTemplate(turn.input.message)));
  for(const turn of evaluation) {
    assert.ok(!candidateTemplates.has(turn.templateId),'Shared template ID across splits');
    assert.ok(!candidateLexical.has(lexicalTemplate(turn.input.message)),'Shared utterance template across splits');
  }
  let goldenChecks=0;
  for(const session of all) {
    assert.equal(session.turns.length,4);
    let committedChapter=null, previous={};
    for(const turn of session.turns) {
      assert.equal(turn.sessionId,session.id); assert.equal(turn.input.playerId,session.id);
      validateInput(turn.input); validateSnapshot(turn); validateDecision(authoredReference(turn));
      assert.equal(checkGoldenFields(turn,authoredReference(turn)).passed,true);
      if(turn.game.areaCommitted) {
        if(committedChapter) assert.deepEqual(turn.game.chapter,committedChapter,'Committed chapter changed');
        committedChapter=turn.game.chapter;
      }
      for(const fact of ['trialResolved','sentinelResolved','wardenResolved','clueDiscovered','ElinRescued','reunited']) if(previous[fact]) assert.equal(turn.input.worldFacts[fact],true,`Observed fact lost: ${fact}`);
      previous=turn.input.worldFacts;
      const request=preparedRequest(turn);
      assert.equal(request.messages[0].content,SYSTEM_PROMPT);
      assert.equal(request.messages[1].content,JSON.stringify({sessionId:session.id,playerId:session.id}));
      assert.ok(!Object.hasOwn(request,'metadata')&&!Object.hasOwn(request,'store'));
      assert.ok(JSON.stringify(request).length<24000,'Prepared context too large');
      goldenChecks++;
    }
  }
  const coverage=splitRows=>({turns:splitRows.length,realms:histogram(splitRows,t=>t.expected.chapter.realm),trials:histogram(splitRows,t=>t.expected.chapter.trial),twists:histogram(splitRows,t=>t.expected.chapter.twist),routes:histogram(splitRows,t=>t.expected.route),npcs:histogram(splitRows,t=>t.input.npc),phases:histogram(splitRows,t=>t.input.phase),stages:histogram(splitRows,t=>t.input.worldFacts.questStage),intents:histogram(splitRows,t=>t.expected.intent),actionPreconditions:histogram(splitRows,t=>t.actionPrecondition),tags:histogram(splitRows.flatMap(t=>t.tags.map(tag=>({tag}))),t=>t.tag),realmTrialTwistCombinations:new Set(splitRows.map(t=>[t.expected.chapter.realm,t.expected.chapter.trial,t.expected.chapter.twist].join('/'))).size});
  const report={status:'locallyvalidated',submitted:0,kept:null,targetKept:50,networkInferenceCalls:0,modelQualityEvaluated:false,goldenChecks,candidateSessions:candidates.length,heldoutSessions:heldouts.length,candidate:coverage(training),heldout:coverage(evaluation),splitIsolation:{independentSessionIds:true,disjointTemplateBanks:true,noExactUtteranceOverlap:true,noNormalizedUtteranceTemplateOverlap:true,sharedPublicCanonAndProductionSchema:true},limitations:['Gold fields and hypothetical states are authored; no model was scored.','Distinct phrasing and template banks reduce leakage; they do not prove statistical independence.','Prose factuality/NPC quality need human review of future responses.','These files are not a Mubit import format; future gateway submission needs separate authorization.','Mubit kept counts, training split, foundation, passing evaluation and serving remain unknown.']};
  assert.equal(report.candidate.realmTrialTwistCombinations,36);
  assert.equal(Object.keys(report.candidate.npcs).length,6); assert.equal(Object.keys(report.heldout.npcs).length,6);
  return report;
}
export async function prepareStoryV2(args=process.argv.slice(2),outputDir=PREPARED_DIR) {
  if(args.some(arg=>arg!=='--write')||args.length>1) throw new Error('Offline preparation only. Allowed: no arguments or --write. Live submission is not implemented or authorized.');
  const report=validatePreparedDataset();
  const artifacts={'candidates.json':{dataset:DATASET_ID,split:'candidate',sessions:CANDIDATE_SESSIONS},'heldout.json':{dataset:DATASET_ID,split:'heldout',sessions:HELDOUT_SESSIONS},'prompt.json':{storyContractVersion:2,model:MODEL,system:SYSTEM_PROMPT,responseFormat:RESPONSE_FORMAT,promptFingerprint:promptFingerprint()},'validation.json':report};
  const sourceFiles=Object.fromEntries(await Promise.all(['fixtures/story-v2.mjs','prepare-story-v2.mjs'].map(async file=>[file,sha256(await readFile(join(import.meta.dirname,file)))])));
  const manifest={sourceFiles,dataset:DATASET_ID,storyContractVersion:2,status:'prepared/locallyvalidated',submissionAuthorization:'not granted; save now, send only after a future explicit request',submitted:0,kept:null,targetKept:50,candidateTurns:240,candidateSessions:60,heldoutTurns:60,heldoutSessions:15,model:MODEL,promptFingerprint:promptFingerprint(),provenance:{kind:'authored-synthetic',authoringMethod:'Separate candidate and held-out dialogue banks combined with authored realm catalogue and hypothetical state snapshots.',realPlayerData:false,providerGenerated:false,observedGameplay:false,authoredDate:'2026-10-24'},artifacts:Object.fromEntries(Object.entries(artifacts).map(([name,value])=>[name,{sha256:sha256(encoded(value)),bytes:Buffer.byteLength(encoded(value))}])),legacyRecovery:{untouched:true,attempts:96,limit:200,roundsUsed:1},futureSubmissionRequirements:['Separate explicit authorization and a new bounded budget without resetting the legacy ledger.','One exclusive training lock and persistent reservation before each attempt.','Exact frozen prompt/model/format; no OpenRouter, blind retry or real-game profile writes.','Keep held-out sessions out of recorded training traffic; report raw model checks separately from backend guards.']};
  artifacts['manifest.json']=manifest;
  for(const [name,value] of Object.entries(artifacts)) {
    const path=join(outputDir,name), body=encoded(value);
    if(!args.includes('--write')) { assert.equal(await readFile(path,'utf8'),body,`Frozen artifact verification failed: ${name}`); continue; }
    await mkdir(dirname(path),{recursive:true});
    try { await writeFile(path,body,{flag:'wx'}); } catch(error) { if(error.code!=='EEXIST') throw error; assert.equal(await readFile(path,'utf8'),body,`Frozen artifact differs: ${name}. Prepare a new dataset version instead.`); }
  }
  return {manifest,manifestSha256:sha256(encoded(manifest)),coverage:report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const result=await prepareStoryV2(); console.log(JSON.stringify({status:result.manifest.status,submitted:0,kept:null,targetKept:50,candidates:result.manifest.candidateTurns,candidateSessions:60,heldouts:60,heldoutSessions:15,promptFingerprint:promptFingerprint(),manifestSha256:result.manifestSha256,filesWritten:process.argv.includes('--write'),coverage:result.coverage},null,2));
}
