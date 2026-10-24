import test from 'node:test';
import assert from 'node:assert/strict';
import { Director, validateDecision, validateInput } from '../director.mjs';
import { defaultChapter, REALMS, TRIALS, TWISTS } from '../story.mjs';
import { runRecovery } from '../train-recovery.mjs';
import { runSynthetic } from '../train-synthetic.mjs';
const input = (message='Hello') => ({playerId:'story-test',playerName:'Tester',npc:'Mara',phase:'village',message,worldFacts:{}});
const decision = () => ({dialogue:'The drowned page carries Elin’s mark. Shall we follow it?',route:'hybrid',mood:'wonder',difficulty:2,objective:'Follow Elin.',preferences:{combat:true,mystery:true,protectVillagers:true},reason:'The player wants clues and action.',chapter:defaultChapter('hybrid','sunken_archive'),intent:'none',answer:''});
const response = value => new Response(JSON.stringify({id:'completion-id',choices:[{message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}),{headers:{'x-middleware-request-id':'mreq_story'}});
const local = options => new Director({apiKey:'',runtimeDir:null,...options});

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
  assert.deepEqual(director.state().conversation.map(message=>message.requestId),[result.requestId,result.requestId]);
  assert.equal(director.state().recentRequests[0].requestId,result.requestId);
  assert.equal(director.state().conversation[1].text,result.dialogue);
});

test('Mubit failure stays local even with legacy or environment OpenRouter credentials',async()=>{
  const previous=process.env.OPENROUTER_API_KEY; process.env.OPENROUTER_API_KEY='environment-router-secret';
  try {
    for(const failure of ['http','invalid','timeout']) {
      const requests=[]; const director=local({apiKey:'mubit-secret',openRouterApiKey:'legacy-router-secret',fetchImpl:async(url,opts)=>{
        requests.push({url,body:JSON.parse(opts.body)});
        if(failure==='timeout') throw new DOMException('secret error','TimeoutError');
        if(failure==='invalid') return response({...decision(),route:'invalid'});
        return new Response('{"error":{"code":"budget_exhausted","message":"mubit-secret environment-router-secret"}}',{status:503,headers:{'x-middleware-request-id':'mreq_failed'}});
      }});
      const result=await director.direct(input()); const state=director.state(); const trace=state.recentRequests[0];
      assert.equal(result.source,'fallback'); assert.match(result.reason,/^Local fallback:/);
      assert.equal(requests.length,1); assert.equal(requests[0].url,'https://api.mubit.ai/openai/v1/chat/completions');
      assert.equal(state.metrics.providerAttempts,1); assert.equal(state.metrics.errors,1); assert.equal(state.metrics.fallbackCalls,1);
      assert.deepEqual(trace.attempts.map(x=>x.provider),['mubit']);
      assert.equal(trace.errorCode,failure==='http'?'http_503':failure==='timeout'?'timeout':'invalid_or_unavailable_response');
      if(failure==='http') { assert.equal(trace.providerRequestId,'mreq_failed'); assert.equal(trace.gatewayErrorCode,'budget_exhausted'); }
      assert.doesNotMatch(JSON.stringify(state),/mubit-secret|router-secret|secret error/);
    }
    const offline=local({openRouterApiKey:'legacy-router-secret',fetchImpl:()=>{throw new Error('Offline must never fetch');}});
    assert.equal((await offline.direct(input())).source,'fallback'); assert.equal(offline.state().metrics.providerAttempts,0);
  } finally { if(previous===undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY=previous; }
});

test('legacy paid training refuses the changed production contract before network or ledger writes',async()=>{
  await assert.rejects(()=>runRecovery(['--live','--count','1']),/incompatible with story v2/);
  await assert.rejects(()=>runSynthetic(['--run','--count','1']),/incompatible with story v2/);
});


test('each failed Mubit turn consumes one request and the process budget remains bounded',async()=>{
  let calls=0; const director=local({apiKey:'mubit-key',maxCalls:2,fetchImpl:async()=>{calls++;return new Response('',{status:503});}});
  for(let i=0;i<3;i++) assert.equal((await director.direct(input())).source,'fallback');
  assert.equal(calls,2); assert.equal(director.state().metrics.errors,2); assert.equal(director.state().metrics.providerAttempts,2);
  assert.equal(director.state().recentRequests[2].attempts.length,0);
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

test('Mubit usage remains counted when content validation fails; missing usage stays unknown',async()=>{
  for(const valid of [true,false]) {
    const director=local({apiKey:'key',fetchImpl:async()=>response(valid?decision():{...decision(),route:'invalid'})});
    const result=await director.direct(input()); const state=director.state(); const telemetry=state.recentRequests[0];
    assert.equal(result.source,valid?'mubit':'fallback');
    assert.equal(state.metrics.providerAttempts,1); assert.equal(state.metrics.totalTokens,30);
    assert.equal(telemetry.tokens.total_tokens,30); assert.equal(telemetry.tokenUsageComplete,true);
    assert.deepEqual(telemetry.attempts.map(item=>item.tokens.total_tokens),[30]);
  }
  const missing=local({apiKey:'key',fetchImpl:async()=>new Response('',{status:503})});
  await missing.direct(input()); const telemetry=missing.state().recentRequests[0];
  assert.equal(telemetry.tokens.total_tokens,null); assert.equal(telemetry.tokenUsageComplete,false);
  assert.equal(missing.state().metrics.unreportedUsageAttempts,1);
});
