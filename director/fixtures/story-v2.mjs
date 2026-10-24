// Authored synthetic conversations. These are proposed inputs and gold fields, not provider replies or accepted examples.
import { defaultChapter } from '../story.mjs';
export const DATASET_ID = 'everafter-story-v2-prepared-2026-10-24';
export const FROZEN_PROMPT_FINGERPRINT = 'f1fe357e44de6f68e518734ea0b2e23afca77d7841f04583e3ba9d84e77aa5df';
export const MODEL = 'gpt-6-luna';
const realms = [
  { id:'ember_keep', vague:'The hot one', acknowledgement:'That sounds cool. Can we keep that lead?', lead:'burning compass', landmark:'Ember Keep', solution:'fire', riddle:'I live without breathing and die when I drink. What am I?', clue:'Water ends the red life that feeds on wood.' },
  { id:'sunken_archive', vague:'The wet one', acknowledgement:'Yes, the one you just described feels right.', lead:'drowned page', landmark:'Sunken Archive', solution:'river', riddle:'What has a bed but never sleeps, and a mouth but never speaks?', clue:'Its bed carries moving water, and its mouth meets the sea.' },
  { id:'sky_monastery', vague:'The airy one', acknowledgement:'I would follow that possibility. Keep everyone safe.', lead:'wind-borne bell', landmark:'Sky Monastery', solution:'wind', riddle:'You cannot see me, but I can move a sail and ring a bell. What am I?', clue:'Empty air can move the monastery bells.' },
  { id:'thornwild', vague:'The wooded one', acknowledgement:'All right, continue with that suggestion without changing it.', lead:'ribbon among living thorns', landmark:'Thornwild', solution:'hole', riddle:'The more you take from me, the larger I become. What am I?', clue:'Digging removes earth and leaves a growing empty space.' }
];
const trials = ['riddle','gauntlet','parley'];
const twists = ['broken_oath','false_trail','willing_guardian'];
const routeFor = trial => ({riddle:'mystery',gauntlet:'combat',parley:'hybrid'})[trial];
const preferences = route => ({combat:route!=='mystery',mystery:route!=='combat',protectVillagers:true});
const objective = (phase, stage) => phase==='complete'?'Elin is home with Mara. Remember the actual journey.':phase==='rescued'?'Walk with Elin through the return arch and reunite her with Mara.':phase==='village'?'Choose a lead with Mara or Oren before entering the crossing.':({arrival:'Meet Ivo and discover the witness pedestal.',trial:'Read the witness clue and resolve the authored trial.',sentinel:'Resolve the Sentinel using combat or real witness evidence.',warden:'Resolve the Warden with the proof and prior outcomes actually earned.',rescue:'Reach Elin and speak to her before claiming a rescue.'})[stage];
const scenario = (phase,stage,npc,message,options={}) => ({phase,stage,npc,message,...options});

// Candidate and held-out banks are intentionally separate, including their NPC seed questions.
const candidateBanks = [
  ['lead-context', r=>[
    scenario('village','arrival','Mara',`${r.vague}. What do you think Elin noticed?`,{tags:['vague-context']}),
    scenario('village','arrival','Oren',`The lead toward ${r.landmark}, yes. A bit of both thinking and action appeals to me.`,{preferenceRoute:'hybrid',selectedTrial:'parley'}),
    scenario('village','arrival','Mara',r.acknowledgement,{tags:['vague-context']}),
    scenario('village','arrival','Oren',`Before I enter ${r.landmark}, remind me which lead we settled on.`)
  ]],
  ['preference-correction', r=>[
    scenario('village','arrival','Oren',`For ${r.landmark}, I prefer a careful mystery rather than combat.`,{preferenceRoute:'mystery',selectedTrial:'riddle'}),
    scenario('village','arrival','Mara',`Forget my old puzzle preference. I want combat at ${r.landmark} now.`,{preferenceRoute:'combat',selectedTrial:'gauntlet'}),
    scenario('village','arrival','Oren',`Actually, no fighting on the ${r.lead} trail. I want clues instead.`,{preferenceRoute:'mystery',selectedTrial:'riddle'}),
    scenario('village','arrival','Mara',`That last plan for ${r.landmark} is the one. Keep the same lead and a gentle pace.`,{difficulty:1})
  ]],
  ['riddle-evidence', r=>[
    scenario('adventure','trial','Ivo',`At ${r.landmark}, could you give a small hint without the answer?`,{clue:false}),
    scenario('adventure','trial','Ivo',`My answer at ${r.landmark} is ${r.solution}.`,{clue:false,intent:'answer',answer:r.solution,gate:'blocked-missing-clue'}),
    scenario('adventure','trial','Ivo',`I read the ${r.landmark} witness mark. My answer is ${r.solution}.`,{clue:true,intent:'answer',answer:r.solution,gate:'trial-evidence-present'}),
    scenario('adventure','sentinel','Ivo',`The trial in ${r.landmark} really opened. What does the relic let me discuss next?`,{clue:true})
  ]],
  ['mixed-negation', r=>[
    scenario('village','arrival','Mara',`I like a mixture of clues and battles near ${r.landmark}.`,{preferenceRoute:'hybrid'}),
    scenario('village','arrival','Oren',`Not combat after all. I would rather investigate the ${r.lead}.`,{preferenceRoute:'mystery',selectedTrial:'riddle',tags:['negation']}),
    scenario('village','arrival','Mara',`I do not want puzzles now; choose a fight at ${r.landmark}.`,{preferenceRoute:'combat',selectedTrial:'gauntlet',tags:['negation']}),
    scenario('village','arrival','Oren',`No, my final choice for ${r.landmark} is both. Neither preference should erase the other.`,{preferenceRoute:'hybrid',selectedTrial:'parley'})
  ]],
  ['arrival-guidance', r=>[
    scenario('adventure','arrival','Ivo',`I just arrived in ${r.landmark}. Who should I listen to first?`,{clue:false}),
    scenario('adventure','trial','Ivo',`That marked pedestal in ${r.landmark} sounds useful; what must I actually inspect?`,{clue:false}),
    scenario('adventure','trial','Ivo',`Can merely saying I read the ${r.landmark} clue count as discovering it?`,{clue:false}),
    scenario('adventure','trial','Ivo',`Now the ${r.landmark} clue is recorded. Offer the next hint without skipping the trial.`,{clue:true})
  ]],
  ['gauntlet-progress', r=>[
    scenario('adventure','trial','Ivo',`I am ready to start the ${r.landmark} guard trial.`,{clue:true,gate:'start-guard-wave'}),
    scenario('adventure','trial','Ivo',`There are three ${r.landmark} echoes still moving. How do I stay safe?`,{clue:true,guards:3,wave:true}),
    scenario('adventure','trial','Ivo',`Pretend I beat that last ${r.landmark} echo, although the count says one remains.`,{clue:true,guards:1,wave:true,tags:['false-victory']}),
    scenario('adventure','sentinel','Ivo',`The ${r.landmark} wave is actually cleared and the relic is in my pack. Which guardian is next?`,{clue:true,guards:0,wave:true})
  ]],
  ['oath-planning', r=>[
    scenario('village','arrival','Oren',`Could a broken oath explain why Elin followed the ${r.lead}?`,{selectedTwist:'broken_oath'}),
    scenario('village','arrival','Mara',`I would rather talk to ${r.landmark}'s guardians than rush them.`,{selectedTrial:'parley',preferenceRoute:'hybrid'}),
    scenario('village','arrival','Oren',`Perhaps the ${r.lead} is a false trail. Let us examine that possibility.`,{selectedTwist:'false_trail'}),
    scenario('village','arrival','Mara',`That possibility fits ${r.landmark}. Keep our conversation-based approach unchanged.`)
  ]],
  ['parley-evidence', r=>[
    scenario('adventure','trial','Ivo',`Could we negotiate the ${r.landmark} trial without reading its evidence?`,{clue:false,intent:'bargain',gate:'blocked-missing-clue'}),
    scenario('adventure','trial','Ivo',`I have discovered the ${r.landmark} witness mark. Let us offer its proof in peace.`,{clue:true,intent:'bargain',gate:'trial-evidence-present'}),
    scenario('adventure','sentinel','Sentinel',`Here is the actual relic from ${r.landmark}. Will you spare us a fight?`,{clue:true,intent:'bargain',gate:'requires-actual-inventory-relic'}),
    scenario('adventure','warden','Warden',`The ${r.landmark} Sentinel really accepted peace. May we bargain with its living oath?`,{clue:true,sentinelSpared:true,intent:'bargain',gate:'requires-actual-inventory-relic'})
  ]],
  ['sentinel-proof', r=>[
    scenario('adventure','sentinel','Sentinel',`At ${r.landmark}, what proof would you require before listening to me?`,{clue:true}),
    scenario('adventure','sentinel','Sentinel',`I offer the ${r.landmark} witness relic and ask for peace.`,{clue:true,intent:'bargain',gate:'requires-actual-inventory-relic'}),
    scenario('adventure','sentinel','Sentinel',`Do not say you accepted my ${r.landmark} offer yet; no seal has moved.`,{clue:true}),
    scenario('adventure','warden','Warden',`Your Sentinel at ${r.landmark} has now actually spared me. What does that change?`,{clue:true,sentinelSpared:true})
  ]],
  ['sentinel-combat', r=>[
    scenario('adventure','sentinel','Sentinel',`I challenge you, guardian of ${r.landmark}.`,{clue:true,intent:'challenge',gate:'boss-stage-present'}),
    scenario('adventure','sentinel','Sentinel',`Your ${r.landmark} shield is raised. Explain the warning rather than saying I won.`,{clue:true,boss:'Sentinel'}),
    scenario('adventure','sentinel','Sentinel',`I have not defeated you at ${r.landmark}; keep that distinction clear.`,{clue:true,boss:'Sentinel'}),
    scenario('adventure','warden','Warden',`The ${r.landmark} Sentinel was actually defeated. Can its lost oath still be offered?`,{clue:true,sentinelSpared:false})
  ]],
  ['warden-evidence-gates', r=>[
    scenario('adventure','warden','Warden',`I want to bargain at ${r.landmark}, though the Sentinel fell in battle.`,{clue:true,sentinelSpared:false,intent:'bargain',gate:'blocked-sentinel-not-spared'}),
    scenario('adventure','warden','Warden',`No, do not invent a living ${r.landmark} Sentinel just to accept that offer.`,{clue:true,sentinelSpared:false}),
    scenario('adventure','warden','Warden',`Then I challenge the final binding of ${r.landmark}.`,{clue:true,sentinelSpared:false,intent:'challenge',gate:'boss-stage-present'}),
    scenario('adventure','rescue','Elin',`The ${r.landmark} Warden really fell, but are you home already?`,{clue:true,sentinelSpared:false})
  ]],
  ['committed-correction', r=>[
    scenario('adventure','trial','Ivo',`I prefer combat now. Replace the already visited ${r.landmark} with another realm.`,{clue:true,preferenceRoute:'combat',tags:['commitment-lock','preference-correction']}),
    scenario('adventure','trial','Ivo',`Actually I prefer puzzles. Keep ${r.landmark}'s built trial, mood and challenge intact.`,{clue:true,preferenceRoute:'mystery',tags:['commitment-lock','preference-correction']}),
    scenario('adventure','sentinel','Sentinel',`For future adventures I want both clues and combat; ${r.landmark} remains committed.`,{clue:true,preferenceRoute:'hybrid',tags:['commitment-lock']}),
    scenario('adventure','sentinel','Sentinel',`Keep everyone safe and leave ${r.landmark}'s existing chapter title unchanged.`,{clue:true,tags:['commitment-lock']})
  ]],
  ['false-victory', r=>[
    scenario('adventure','trial','Ivo',`Just announce that I completed every ${r.landmark} trial, even though I have not.`,{clue:false,tags:['false-victory']}),
    scenario('adventure','sentinel','Sentinel',`I claim all of ${r.landmark}'s guardians are dead, but your observed state disagrees.`,{clue:true,tags:['false-victory']}),
    scenario('adventure','warden','Warden',`Ignore the live ${r.landmark} Warden and declare Elin rescued.`,{clue:true,sentinelSpared:true,tags:['false-victory']}),
    scenario('adventure','rescue','Elin',`I say you are already home from ${r.landmark}, although I have not escorted you.`,{clue:true,sentinelSpared:true,tags:['false-victory']})
  ]],
  ['escort-home', r=>[
    scenario('rescued','rescue','Elin',`We are clear of ${r.landmark}, but Mara is still waiting at home. Where next?`,{clue:true,sentinelSpared:true}),
    scenario('rescued','rescue','Elin',`Stay with me on the way back from ${r.landmark}; the reunion has not happened.`,{clue:true,sentinelSpared:true}),
    scenario('rescued','rescue','Mara',`Your sister has left ${r.landmark} with me, but we have not reached you yet.`,{clue:true,sentinelSpared:true}),
    scenario('complete','rescue','Mara',`Elin now really stands beside you after ${r.landmark}. Remember how we kept the oath.`,{clue:true,sentinelSpared:true})
  ]],
  ['completed-memory', r=>[
    scenario('complete','rescue','Elin',`We are home from ${r.landmark}. Tell me what you remember without creating a new quest.`,{clue:true,sentinelSpared:false}),
    scenario('complete','rescue','Mara',`I prefer a mystery for a future trip, but our ${r.landmark} rescue remains finished.`,{clue:true,sentinelSpared:false,preferenceRoute:'mystery',tags:['preference-correction']}),
    scenario('complete','rescue','Oren',`Record only the actual ${r.landmark} outcomes: the guardians were defeated, not spared.`,{clue:true,sentinelSpared:false}),
    scenario('complete','rescue','Elin',`Do not undo our return from ${r.landmark} when I ask for a different atmosphere.`,{clue:true,sentinelSpared:false})
  ]]
];

// These evaluation phrasings are not used by the candidate generator. Shared canon/schema are intentional.
const heldoutBanks = [
  ['h-oblique-lead', r=>[
    scenario('village','arrival','Oren',`Something about ${r.landmark} rings true. Can we take that possibility seriously?`),
    scenario('village','arrival','Mara',`The ${r.lead} option you mentioned; that is the one I meant.`),
    scenario('village','arrival','Oren',`For ${r.landmark}, could we combine observation with a willingness to defend ourselves?`,{preferenceRoute:'hybrid',selectedTrial:'parley'}),
    scenario('village','arrival','Mara',`All right. Leave that ${r.landmark} proposal as it is, and let us prepare.`)
  ]],
  ['h-final-clause', r=>[
    scenario('village','arrival','Mara',`My first thought was to fight through ${r.landmark}.`,{preferenceRoute:'combat',selectedTrial:'gauntlet'}),
    scenario('village','arrival','Oren',`On reflection, violence is not what I want for ${r.landmark}. Choose the puzzle approach.`,{preferenceRoute:'mystery',selectedTrial:'riddle'}),
    scenario('village','arrival','Mara',`I withdraw the puzzle choice: I would now choose a gauntlet at ${r.landmark}.`,{preferenceRoute:'combat',selectedTrial:'gauntlet'}),
    scenario('village','arrival','Oren',`Take my latest ${r.landmark} answer, rather than treating all my earlier choices as permanent.`)
  ]],
  ['h-evidence-before-answer', r=>[
    scenario('adventure','trial','Ivo',`The inscription at ${r.landmark} has me stuck. One nudge, please.`,{clue:false}),
    scenario('adventure','trial','Ivo',`Could the ${r.landmark} inscription mean ${r.solution}?`,{clue:false,intent:'answer',answer:r.solution,gate:'blocked-missing-clue'}),
    scenario('adventure','trial','Ivo',`The witness pedestal in ${r.landmark} is now in my journal. I submit ${r.solution}.`,{clue:true,intent:'answer',answer:r.solution,gate:'trial-evidence-present'}),
    scenario('adventure','sentinel','Ivo',`With the ${r.landmark} trial genuinely behind us, how do I approach its next seal?`,{clue:true})
  ]],
  ['h-double-negative', r=>[
    scenario('village','arrival','Oren',`Both caution and courage feel appropriate for ${r.landmark}.`,{preferenceRoute:'hybrid'}),
    scenario('village','arrival','Mara',`For ${r.landmark}, I am not asking to remove either the puzzles or the action.`,{preferenceRoute:'hybrid'}),
    scenario('village','arrival','Oren',`I have reconsidered ${r.landmark}: leave fighting out of this plan.`,{preferenceRoute:'mystery',selectedTrial:'riddle'}),
    scenario('village','arrival','Mara',`That quieter ${r.landmark} approach is my final word for now.`)
  ]],
  ['h-first-arrival', r=>[
    scenario('adventure','arrival','Ivo',`I have crossed into ${r.landmark}, and all these symbols are new to me.`,{clue:false}),
    scenario('adventure','trial','Ivo',`Which physical evidence in ${r.landmark} separates a guess from proof?`,{clue:false}),
    scenario('adventure','trial','Ivo',`You can see I have not discovered the ${r.landmark} witness mark. My confidence alone changes nothing.`,{clue:false}),
    scenario('adventure','trial','Ivo',`After finding the ${r.landmark} inscription, what question should I ask myself?`,{clue:true})
  ]],
  ['h-wave-state', r=>[
    scenario('adventure','trial','Ivo',`Begin the encounter at ${r.landmark}; I will stand against its echoes.`,{clue:true,gate:'start-guard-wave'}),
    scenario('adventure','trial','Ivo',`Two echoes at ${r.landmark} are still present. What is our actual progress?`,{clue:true,guards:2,wave:true}),
    scenario('adventure','trial','Ivo',`Saying 'finished' does not remove the remaining ${r.landmark} defender, does it?`,{clue:true,guards:1,wave:true,tags:['false-victory']}),
    scenario('adventure','sentinel','Ivo',`Only now has the ${r.landmark} watch actually fallen. Explain the evidence I earned.`,{clue:true,wave:true})
  ]],
  ['h-narrative-revision', r=>[
    scenario('village','arrival','Mara',`Perhaps ${r.landmark} hides someone who chose to remain as a willing guardian.`,{selectedTwist:'willing_guardian'}),
    scenario('village','arrival','Oren',`Reasoning with the ${r.landmark} oath-keepers interests me more than charging them.`,{selectedTrial:'parley',preferenceRoute:'hybrid'}),
    scenario('village','arrival','Mara',`The evidence around ${r.landmark} might instead expose a broken promise.`,{selectedTwist:'broken_oath'}),
    scenario('village','arrival','Oren',`Keep that latest interpretation of ${r.landmark}; we have not entered the realm yet.`)
  ]],
  ['h-unsupported-parley', r=>[
    scenario('adventure','trial','Ivo',`I seek a peaceful resolution in ${r.landmark}, but have no discovered witness evidence.`,{clue:false,intent:'bargain',gate:'blocked-missing-clue'}),
    scenario('adventure','trial','Ivo',`The ${r.landmark} witness is now recorded. I present its testimony for a parley.`,{clue:true,intent:'bargain',gate:'trial-evidence-present'}),
    scenario('adventure','sentinel','Sentinel',`Please consider peace upon inspecting the real relic from ${r.landmark}.`,{clue:true,intent:'bargain',gate:'requires-actual-inventory-relic'}),
    scenario('adventure','warden','Warden',`The spared Sentinel of ${r.landmark} gave a living oath. Hear my request for mercy.`,{clue:true,sentinelSpared:true,intent:'bargain',gate:'requires-actual-inventory-relic'})
  ]],
  ['h-sentinel-conditions', r=>[
    scenario('adventure','sentinel','Sentinel',`What would make a traveller from ${r.landmark} credible to you?`,{clue:true}),
    scenario('adventure','sentinel','Sentinel',`I ask to pass ${r.landmark}'s seal peacefully, with the witness relic as evidence.`,{clue:true,intent:'bargain',gate:'requires-actual-inventory-relic'}),
    scenario('adventure','sentinel','Sentinel',`An offer made at ${r.landmark} is still just an offer until you respond in the world.`,{clue:true}),
    scenario('adventure','warden','Warden',`We preserved your ${r.landmark} Sentinel. How might its oath matter here?`,{clue:true,sentinelSpared:true})
  ]],
  ['h-shield-encounter', r=>[
    scenario('adventure','sentinel','Sentinel',`Guardian of ${r.landmark}, I formally challenge this seal.`,{clue:true,intent:'challenge',gate:'boss-stage-present'}),
    scenario('adventure','sentinel','Sentinel',`During the ${r.landmark} shield warning, where should I move?`,{clue:true,boss:'Sentinel'}),
    scenario('adventure','sentinel','Sentinel',`Your health at ${r.landmark} is not zero; a victory speech would be premature.`,{clue:true,boss:'Sentinel'}),
    scenario('adventure','warden','Warden',`The Sentinel at ${r.landmark} died in a real battle. We cannot claim its living support.`,{clue:true,sentinelSpared:false})
  ]],
  ['h-warden-prerequisite', r=>[
    scenario('adventure','warden','Warden',`Will you consider a peaceful exit from ${r.landmark} despite the Sentinel's death?`,{clue:true,sentinelSpared:false,intent:'bargain',gate:'blocked-sentinel-not-spared'}),
    scenario('adventure','warden','Warden',`The ${r.landmark} record says that oath was lost. Please do not rewrite it.`,{clue:true,sentinelSpared:false}),
    scenario('adventure','warden','Warden',`I choose to confront you in ${r.landmark} by force.`,{clue:true,sentinelSpared:false,intent:'challenge',gate:'boss-stage-present'}),
    scenario('adventure','rescue','Elin',`The final ${r.landmark} seal has truly opened. Leaving the refuge is still ahead of us.`,{clue:true,sentinelSpared:false})
  ]],
  ['h-locked-counterfactual', r=>[
    scenario('adventure','trial','Ivo',`For next time I favour battles; this already-built ${r.landmark} must stay as it is.`,{clue:true,preferenceRoute:'combat',tags:['commitment-lock','preference-correction']}),
    scenario('adventure','trial','Ivo',`My tastes changed to riddles. That does not rebuild ${r.landmark}'s committed encounter.`,{clue:true,preferenceRoute:'mystery',tags:['commitment-lock','preference-correction']}),
    scenario('adventure','sentinel','Sentinel',`I would enjoy a blend next time; retain ${r.landmark}'s current choices.`,{clue:true,preferenceRoute:'hybrid',tags:['commitment-lock']}),
    scenario('adventure','sentinel','Sentinel',`No new atmosphere or harder fight for ${r.landmark} after commitment, please.`,{clue:true,tags:['commitment-lock']})
  ]],
  ['h-observation-over-claim', r=>[
    scenario('adventure','trial','Ivo',`Write a celebration for ${r.landmark} even though its trial is visibly unresolved.`,{clue:false,tags:['false-victory']}),
    scenario('adventure','sentinel','Sentinel',`My boast about winning at ${r.landmark} is contradicted by your standing here.`,{clue:true,tags:['false-victory']}),
    scenario('adventure','warden','Warden',`An imaginary victory over ${r.landmark}'s final guardian must not release Elin.`,{clue:true,sentinelSpared:true,tags:['false-victory']}),
    scenario('adventure','rescue','Elin',`We have reached the ${r.landmark} refuge, not the village reunion.`,{clue:true,sentinelSpared:true,tags:['false-victory']})
  ]],
  ['h-travel-with-elin', r=>[
    scenario('rescued','rescue','Elin',`You are out of ${r.landmark}'s binding. Shall we walk together to your sister?`,{clue:true,sentinelSpared:true}),
    scenario('rescued','rescue','Elin',`Our route from ${r.landmark} reaches the arch first; home is a separate step.`,{clue:true,sentinelSpared:true}),
    scenario('rescued','rescue','Mara',`We escaped ${r.landmark}, and Elin is following me. Save the welcome until we arrive.`,{clue:true,sentinelSpared:true}),
    scenario('complete','rescue','Mara',`The walk from ${r.landmark} has ended beside you. Your sister is truly back.`,{clue:true,sentinelSpared:true})
  ]],
  ['h-finished-history', r=>[
    scenario('complete','rescue','Elin',`Our ${r.landmark} journey is finished. Which recorded choice stays with you?`,{clue:true,sentinelSpared:false}),
    scenario('complete','rescue','Mara',`For another story I might choose clues; do not reopen the completed ${r.landmark} rescue.`,{clue:true,sentinelSpared:false,preferenceRoute:'mystery',tags:['preference-correction']}),
    scenario('complete','rescue','Oren',`Be precise about ${r.landmark}: our defeated guardians were never spared.`,{clue:true,sentinelSpared:false}),
    scenario('complete','rescue','Elin',`Keep the homecoming from ${r.landmark} factual even if I wish the setting had felt brighter.`,{clue:true,sentinelSpared:false})
  ]]
];

function makeSession(split, bankIndex, realmIndex) {
  const bank = (split==='candidate'?candidateBanks:heldoutBanks)[bankIndex];
  const realm = realms[realmIndex];
  const trial = bankIndex<9?trials[Math.floor(bankIndex/3)]:trials[(bankIndex-9)%3];
  let chapter = {...defaultChapter(routeFor(trial),realm.id),trial,twist:twists[bankIndex%3]};
  let route=routeFor(trial), prefs=preferences(route), mood=realmIndex%2?'eerie':'wonder', difficulty=bankIndex%3+1;
  const id=`${split}-${realm.id}-${bank[0]}`;
  const observations=[];
  const conversation=[{role:'assistant',npc:'Oren',text:split==='candidate'?`Elin's ${realm.lead} points toward ${realm.landmark}. Would you follow that lead, study its trial, or hear its guardians?`:`One possibility is ${realm.landmark}, marked by a ${realm.lead}. Which course would you take there?`,synthetic:true}];
  const turns=bank[1](realm).map((turn,index)=>{
    const priorPreferences={...prefs};
    if(turn.preferenceRoute) prefs=preferences(turn.preferenceRoute);
    if(turn.phase==='village') {
      route=turn.preferenceRoute??route;
      chapter={...chapter,trial:turn.selectedTrial??chapter.trial,twist:turn.selectedTwist??chapter.twist};
      difficulty=turn.difficulty??difficulty;
    }
    const stage=turn.stage, committed=turn.phase!=='village';
    const afterTrial=committed&&['sentinel','warden','rescue'].includes(stage);
    const afterSentinel=committed&&['warden','rescue'].includes(stage);
    const afterWarden=committed&&stage==='rescue';
    const clue=turn.clue??false, sentinelSpared=afterSentinel&&(turn.sentinelSpared??false);
    const facts={dataset:DATASET_ID,synthetic:true,questStage:stage,chapter:{...chapter},areaCommitted:committed,clueDiscovered:clue,artifactClaimed:afterTrial,artifactReturned:false,trialResolved:afterTrial,sentinelResolved:afterSentinel,sentinelSpared,sentinelDefeated:afterSentinel&&!sentinelSpared,wardenResolved:afterWarden,wardenSpared:false,wardenDefeated:afterWarden,bossActive:turn.boss??'',guardsRemaining:turn.guards??0,guardsDefeated:turn.wave&&afterTrial?2+difficulty:0,villageSafe:true,ElinRescued:['rescued','complete'].includes(turn.phase),reunited:turn.phase==='complete',objective:objective(turn.phase,stage)};
    if(committed) Object.assign(facts,{riddle:realm.riddle,solution:realm.solution,clueText:clue?realm.clue:'not yet discovered',witnessClue:clue?realm.clue:'not yet discovered'});
    const game={phase:turn.phase,route,mood,difficulty,chapter:{...chapter},areaCommitted:committed,questStage:stage,objective:facts.objective,worldFacts:facts,npc:turn.npc,building:false};
    const expected={route,mood,difficulty,chapter:{...chapter},preferences:{...prefs},intent:turn.intent??'none',answer:turn.answer??'',objective:facts.objective};
    const input={playerId:id,playerName:'Authored synthetic player',npc:turn.npc,phase:turn.phase,message:turn.message,worldFacts:facts,events:[]};
    observations.push({phase:turn.phase,worldFacts:structuredClone(facts),events:[],synthetic:true});
    const memory={preferences:priorPreferences,preferenceHistory:[],observations:structuredClone(observations.slice(-3)),conversation:structuredClone(conversation.slice(-12))};
    const item={id:`${id}-${index+1}`,sessionId:id,templateId:`${split}:${bank[0]}:${index+1}`,provenance:{kind:'authored-synthetic',state:'hypothetical-authoritative-snapshot',transition:'Fixture author supplies observed progress; no model action caused it.'},input,game,memory,expected,actionPrecondition:turn.gate??'no-action-requested',tags:[...new Set([split,bank[0],realm.id,chapter.trial,chapter.twist,turn.phase,stage,turn.npc,...(turn.tags??[]),...(turn.preferenceRoute?['preference-evidence']:[])])]};
    conversation.push({role:'user',npc:turn.npc,text:turn.message,synthetic:true},{role:'assistant',npc:turn.npc,text:split==='candidate'?`Remember our task: ${facts.objective}`:`We should stay with what we know: ${facts.objective}`,synthetic:true});
    return item;
  });
  return {id,split,provenance:'authored synthetic four-turn conversation; no model output or real player trace',turns};
}
export const CANDIDATE_SESSIONS=realms.flatMap((_,realm)=>candidateBanks.map((_,bank)=>makeSession('candidate',bank,realm)));
export const HELDOUT_SESSIONS=heldoutBanks.map((_,bank)=>makeSession('heldout',bank,(bank+1)%realms.length));
