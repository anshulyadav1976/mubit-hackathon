import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANDIDATE_SESSIONS, HELDOUT_SESSIONS, FROZEN_PROMPT_FINGERPRINT } from '../fixtures/story-v2.mjs';
import { validatePreparedDataset, checkGoldenFields, authoredReference, preparedRequest, prepareStoryV2, sha256, PREPARED_DIR } from '../prepare-story-v2.mjs';
import { SYSTEM_PROMPT, RESPONSE_FORMAT } from '../prompt.mjs';

test('frozen story-v2 contains240 candidates/60 sessions and60 heldouts/15 sessions with honest preparation state',async()=>{
  const report=validatePreparedDataset();
  assert.equal(report.candidate.turns,240); assert.equal(report.candidateSessions,60);
  assert.equal(report.heldout.turns,60); assert.equal(report.heldoutSessions,15);
  assert.equal(report.goldenChecks,300); assert.equal(report.candidate.realmTrialTwistCombinations,36);
  assert.equal(Object.keys(report.candidate.npcs).length,6); assert.equal(Object.keys(report.heldout.npcs).length,6);
  assert.equal(report.candidate.tags['vague-context'],8); assert.ok(report.candidate.tags['false-victory']>=16);
  assert.ok(report.candidate.tags['commitment-lock']>=16); assert.ok(report.candidate.actionPreconditions['blocked-missing-clue']>0);
  assert.equal(report.submitted,0); assert.equal(report.kept,null); assert.equal(report.targetKept,50); assert.equal(report.modelQualityEvaluated,false);
  for(const turn of [...CANDIDATE_SESSIONS,...HELDOUT_SESSIONS].flatMap(session=>session.turns).filter(turn=>turn.actionPrecondition==='start-guard-wave')) {
    assert.equal(turn.input.npc,'Ivo'); assert.equal(turn.expected.intent,'none','The production prompt reserves model challenge proposals for bosses; Paper handles the literal wave request.');
  }
  const saved=await prepareStoryV2(); assert.equal(saved.manifest.promptFingerprint,FROZEN_PROMPT_FINGERPRINT);
  for(const [name,meta] of Object.entries(saved.manifest.artifacts)) assert.equal(sha256(await readFile(join(PREPARED_DIR,name))),meta.sha256);
});

test('split isolation rejects copied held-out utterances even with different case/session/template IDs',()=>{
  const heldout=structuredClone(HELDOUT_SESSIONS);
  heldout[0].turns[0].input.message=CANDIDATE_SESSIONS[0].turns[0].input.message;
  assert.throws(()=>validatePreparedDataset(CANDIDATE_SESSIONS,heldout),/Duplicate utterance|Shared utterance template/);
  const normalized=structuredClone(HELDOUT_SESSIONS);
  normalized[0].turns[0].input.message=CANDIDATE_SESSIONS[0].turns[1].input.message.replace('Ember Keep','Sky Monastery')+'?';
  assert.throws(()=>validatePreparedDataset(CANDIDATE_SESSIONS,normalized),/Shared utterance template/);
});

test('golden fields catch pre-guard mistakes, changed committed chapters and fake world mutations',()=>{
  const turn=CANDIDATE_SESSIONS.flatMap(s=>s.turns).find(t=>t.game.areaCommitted&&t.expected.intent==='bargain');
  const reference=authoredReference(turn); assert.equal(checkGoldenFields(turn,reference).passed,true);
  for(const changed of [
    {...reference,preferences:{...reference.preferences,protectVillagers:false}},
    {...reference,intent:'none'},
    {...reference,chapter:{...reference.chapter,title:'A different committed title'}},
    {...reference,phase:'complete'},
    {...reference,answer:'x'.repeat(41)}
  ]) assert.equal(checkGoldenFields(turn,changed).passed,false);
  const invalid=structuredClone(CANDIDATE_SESSIONS);
  invalid[0].turns[0].input.worldFacts.reunited=true;
  assert.throws(()=>validatePreparedDataset(invalid,HELDOUT_SESSIONS));
});

test('prepared wire payload pins production prompt/format and stable session message without credentials',()=>{
  const session=CANDIDATE_SESSIONS[0], first=preparedRequest(session.turns[0]), second=preparedRequest(session.turns[1]);
  assert.equal(first.model,'gpt-6-luna'); assert.equal(first.messages[0].content,SYSTEM_PROMPT);
  assert.deepEqual(first.response_format,RESPONSE_FORMAT); assert.equal(first.max_completion_tokens,600);
  assert.equal(first.messages[1].content,second.messages[1].content);
  assert.notEqual(first.messages[1].content,preparedRequest(HELDOUT_SESSIONS[0].turns[0]).messages[1].content);
  assert.ok(!Object.hasOwn(first,'metadata')&&!Object.hasOwn(first,'store')&&!Object.hasOwn(first,'headers'));
});

test('preparation has no live path, performs no fetch, and refuses overwriting frozen data',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'story-v2-preparation-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const fetchBefore=globalThis.fetch; let calls=0; globalThis.fetch=()=>{calls++;throw Error('Network is forbidden');};
  try {
    for(const args of [['--live'],['--run'],['--submit'],['--write','--live']]) await assert.rejects(()=>prepareStoryV2(args,directory),/Offline preparation only/);
    const initial=await prepareStoryV2(['--write'],directory); await prepareStoryV2(['--write'],directory); await prepareStoryV2([],directory);
    assert.equal(initial.manifest.submitted,0); assert.equal(calls,0);
    const path=join(directory,'candidates.json'); await writeFile(path,'tampered');
    await assert.rejects(()=>prepareStoryV2(['--write'],directory),/Frozen artifact differs/);
    assert.equal(await readFile(path,'utf8'),'tampered');
  } finally { globalThis.fetch=fetchBefore; }
});
