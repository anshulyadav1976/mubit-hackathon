import test from 'node:test';
import assert from 'node:assert/strict';
import { Director, validateDecision, validateInput } from '../director.mjs';
import { defaultChapter, REALMS, TRIALS, TWISTS } from '../story.mjs';
import { runRecovery } from '../train-recovery.mjs';
import { runSynthetic } from '../train-synthetic.mjs';
const input = (message='Hello') => ({playerId:'story-test',playerName:'Tester',npc:'Mara',phase:'village',message,worldFacts:{}});
const decision = () => ({dialogue:'The drowned page carries Elin’s mark. Shall we follow it?',route:'hybrid',mood:'wonder',difficulty:2,objective:'Follow Elin.',preferences:{combat:true,mystery:true,protectVillagers:true},reason:'The player wants clues and action.',chapter:defaultChapter('hybrid','sunken_archive'),intent:'none',answer:''});
const response = value => new Response(JSON.stringify({id:'completion-id',choices:[{message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}),{headers:{'x-middleware-request-id':'mreq_story'}});
const local = options => new Director({apiKey:'',openRouterApiKey:'',runtimeDir:null,...options});

test('story catalogue validates all authored combinations and strictly bounds supplied fields',()=>{
  for(const realm of REALMS) for(const trial of TRIALS) for(const twist of TWISTS) assert.equal(validateDecision({...decision(),chapter:{realm,trial,twist}}).chapter.realm,realm);
  for(const chapter of [null,[],{realm:'arbitrary-world'},{trial:'execute'},{twist:'anything'},{title:'x'.repeat(65)},{hook:''}]) assert.throws(()=>validateDecision({...decision(),chapter}));
  for(const [key,value] of [['intent','rescue'],['answer','x'.repeat(41)],['answer','/kill @e']]) assert.throws(()=>validateDecision({...decision(),[key]:value}));
  for(const npc of ['Mara','Oren','Elin','Ivo','Sentinel','Warden']) assert.equal(validateInput({...input(),npc}).npc,npc);
  assert.throws(()=>validateInput({...input(),worldFacts:{questStage:'victory'}}));
});

test('offline conversation offers contextual leads, understands a wet lead and mixed approach, and preserves corrections',async()=>{
  const director=local();
  const greeting=await director.direct(input()); assert.match(greeting.dialogue,/compass/); assert.match(greeting.dialogue,/Which/);
  const wet=await director.direct(input('The drowned archive sounds cool, a bit of both.'));
  assert.equal(wet.chapter.realm,'sunken_archive'); assert.equal(wet.route,'hybrid');
  const vague=await director.direct(input('Yes, that sounds good.')); assert.equal(vague.chapter.realm,'sunken_archive');
  const corrected=await director.direct(input('I like a bit of both. Actually I prefer combat now.')); assert.equal(corrected.route,'combat');
  assert.equal(director.state().conversation[0].text,'Hello');
});

test('validated model chapter and mixed preferences remain authoritative; all committed scene fields lock',async()=>{
  const director=local({apiKey:'mubit-test',fetchImpl:async()=>response(decision())});
  const first=await director.direct(input('The burning compass perhaps?')); assert.equal(first.chapter.realm,'sunken_archive');
  const committed={...defaultChapter('combat','thornwild'),twist:'willing_guardian'};
  await director.gameState({...input(),phase:'adventure',route:'combat',mood:'eerie',difficulty:3,chapter:committed,areaCommitted:true,questStage:'warden',worldFacts:{questStage:'warden',currentObjective:'Confront the actual Warden.',clueDiscovered:true}});
  const locked=await director.direct({...input('Choose the sky instead.'),phase:'adventure',npc:'Warden'});
  assert.deepEqual(locked.chapter,committed); assert.equal(locked.route,'combat'); assert.equal(locked.mood,'eerie'); assert.equal(locked.difficulty,3); assert.equal(locked.objective,'Confront the actual Warden.');
});

test('fallback hints do not leak supplied solution; proposals cannot advance stored game facts',async()=>{
  const director=local();
  await director.gameState({...input(),phase:'adventure',route:'mystery',chapter:defaultChapter(),questStage:'trial',worldFacts:{questStage:'trial',riddle:'What follows you in the sun?',solution:'shadow',clueDiscovered:false,trialResolved:false}});
  const hint=await director.direct({...input('Give me a hint.'),phase:'adventure',npc:'Ivo'});
  assert.doesNotMatch(hint.dialogue,/shadow/); assert.equal(hint.intent,'none');
  const answer=await director.direct({...input('My answer is shadow.'),phase:'adventure',npc:'Ivo'});
  assert.equal(answer.intent,'answer'); assert.equal(answer.answer,'shadow'); assert.equal(director.state().game.worldFacts.trialResolved,false);
  const bargain=await director.direct({...input('Can we bargain?'),phase:'adventure',npc:'Warden'}); assert.equal(bargain.intent,'bargain'); assert.match(bargain.dialogue,/evidence/);
});

test('same-phase late replies use latest stage facts instead of stale trial conversation',async()=>{
  let finish; const director=local({apiKey:'key',fetchImpl:()=>new Promise(resolve=>{finish=resolve;})});
  await director.gameState({...input(),phase:'adventure',route:'mystery',questStage:'trial'});
  const pending=director.direct({...input(),phase:'adventure',npc:'Ivo'});
  await director.gameState({...input(),phase:'adventure',route:'mystery',questStage:'rescue',worldFacts:{questStage:'rescue',currentObjective:'Reach Elin’s refuge.'}});
  finish(response({...decision(),intent:'answer',answer:'shadow'})); const result=await pending;
  assert.equal(result.source,'fallback'); assert.equal(result.intent,'none'); assert.equal(result.answer,''); assert.equal(result.objective,'Reach Elin’s refuge.');
});

test('OpenRouter text fallback follows only failed Mubit, shares bounds, records real source, and never exposes errors or keys',async()=>{
  const requests=[]; const director=local({apiKey:'mubit-secret',openRouterApiKey:'router-secret',fetchImpl:async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)}); return requests.length===1?new Response('{"error":{"message":"mubit-secret router-secret"}}',{status:503}):response(decision());}});
  const result=await director.direct(input()); assert.equal(result.source,'openrouter'); assert.equal(result.model,'google/gemini-2.5-flash-lite');
  assert.equal(requests.length,2); assert.equal(requests[1].url,'https://openrouter.ai/api/v1/chat/completions'); assert.deepEqual(requests[0].body.messages,requests[1].body.messages);
  assert.equal(requests[1].body.max_tokens,900); assert.equal(director.state().metrics.providerAttempts,2); assert.equal(director.state().metrics.openrouterCalls,1);
  assert.deepEqual(director.state().recentRequests[0].attempts.map(x=>x.provider),['mubit','openrouter']); assert.doesNotMatch(JSON.stringify(director.state()),/mubit-secret|router-secret/);
  let count=0; const success=local({apiKey:'key',openRouterApiKey:'router',fetchImpl:async()=>{count++;return response(decision());}}); await success.direct(input()); assert.equal(count,1);
  const offline=local({openRouterApiKey:'router',fetchImpl:()=>{throw new Error('Offline must never fetch');}}); assert.equal((await offline.direct(input())).source,'fallback');
});

test('legacy paid training refuses the changed production contract before network or ledger writes',async()=>{
  await assert.rejects(()=>runRecovery(['--live','--count','1']),/incompatible with story v2/);
  await assert.rejects(()=>runSynthetic(['--run','--count','1']),/incompatible with story v2/);
});


test('text fallback failure is local and bounded by the same total call budget',async()=>{
  let calls=0; const director=local({apiKey:'mubit-key',openRouterApiKey:'router-key',maxCalls:2,fetchImpl:async()=>{calls++;return new Response('{"error":{"message":"router-key"}}',{status:503});}});
  const result=await director.direct(input()); assert.equal(result.source,'fallback'); assert.equal(calls,2);
  assert.equal(director.state().metrics.errors,2); assert.doesNotMatch(JSON.stringify(director.state()),/router-key|mubit-key/);
  await director.direct(input()); assert.equal(calls,2);
  let oneCall=0; const limited=local({apiKey:'key',openRouterApiKey:'router',maxCalls:1,fetchImpl:async()=>{oneCall++;return new Response('',{status:503});}});
  assert.equal((await limited.direct(input())).source,'fallback'); assert.equal(oneCall,1);
});

test('fallback acknowledgement preserves the offered realm, trial, twist and custom chapter text',async()=>{
  const director=local();
  const proposed=await director.direct(input('The sunken archive sounds good. I would rather talk with a willing guardian.'));
  assert.equal(proposed.chapter.realm,'sunken_archive'); assert.equal(proposed.chapter.trial,'parley'); assert.equal(proposed.chapter.twist,'willing_guardian');
  const acknowledged=await director.direct(input('Yes, keep everyone safe.'));
  assert.deepEqual(acknowledged.chapter,proposed.chapter);
  const corrected=await director.direct(input('Actually I prefer combat now.'));
  assert.equal(corrected.chapter.realm,'sunken_archive'); assert.equal(corrected.chapter.trial,'gauntlet'); assert.equal(corrected.chapter.twist,'willing_guardian');
});

test('fallback does not impersonate Ivo when Mara or Oren is asked for arrival guidance',async()=>{
  const director=local(); await director.gameState({...input(),phase:'adventure',route:'mystery',questStage:'arrival'});
  for(const npc of ['Mara','Oren']) {
    const result=await director.direct({...input('Where should I go?'),phase:'adventure',npc});
    assert.match(result.dialogue,/Find Ivo/); assert.doesNotMatch(result.dialogue,/I’m Ivo/);
  }
});

test('usage includes both paid attempts even when their response content fails validation',async()=>{
  for(const secondValid of [true,false]) {
    let calls=0; const director=local({apiKey:'key',openRouterApiKey:'router',fetchImpl:async()=>{
      calls++; const value=calls===2&&secondValid?decision():{...decision(),route:'invalid'};
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}));
    }});
    await director.direct(input()); const state=director.state(); const telemetry=state.recentRequests[0];
    assert.equal(state.metrics.providerAttempts,2); assert.equal(state.metrics.totalTokens,60);
    assert.equal(telemetry.tokens.total_tokens,60); assert.equal(telemetry.tokenUsageComplete,true);
    assert.deepEqual(telemetry.attempts.map(item=>item.tokens.total_tokens),[30,30]);
  }
  const missing=local({apiKey:'key',openRouterApiKey:'router',fetchImpl:async()=>new Response('',{status:503})});
  await missing.direct(input()); const telemetry=missing.state().recentRequests[0];
  assert.equal(telemetry.tokens.total_tokens,null); assert.equal(telemetry.tokenUsageComplete,false);
  assert.equal(missing.state().metrics.unreportedUsageAttempts,2);
});
