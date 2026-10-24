export const REALMS = ['ember_keep', 'sunken_archive', 'sky_monastery', 'thornwild'];
export const TRIALS = ['riddle', 'gauntlet', 'parley'];
export const TWISTS = ['broken_oath', 'false_trail', 'willing_guardian'];
export const INTENTS = ['none', 'answer', 'challenge', 'bargain'];
export const STAGES = ['arrival', 'trial', 'sentinel', 'warden', 'rescue'];
export const REALM_STORIES = Object.freeze({
  ember_keep: { title: 'The Burning Compass', hook: 'A compass burning without fuel points to a Nether-themed keep where Elin sought a broken promise.' },
  sunken_archive: { title: 'The Drowned Record', hook: 'A waterlogged page bears Elin’s mark. The sunken archive may hold the promise someone erased.' },
  sky_monastery: { title: 'The Wind’s Witness', hook: 'A bell rings above the clouds without a hand to move it. Elin followed its call to a sky monastery.' },
  thornwild: { title: 'The Living Thornwood', hook: 'Living thorns part around Elin’s ribbon. Something in the thornwood remembers why she came.' }
});
export function defaultChapter(route = 'mystery', realm = 'ember_keep') {
  return { realm, trial: route === 'combat' ? 'gauntlet' : route === 'hybrid' ? 'parley' : 'riddle', twist: 'broken_oath', ...REALM_STORIES[realm] };
}
export function factsOf(input, game) {
  return { ...(game?.worldFacts && typeof game.worldFacts === 'object' ? game.worldFacts : {}), ...(input.worldFacts && typeof input.worldFacts === 'object' ? input.worldFacts : {}) };
}
export function objectiveFor(phase, facts = {}, game = {}) {
  if (phase === 'complete') return 'Elin is home. Speak with Mara and remember the choices you actually made.';
  if (phase === 'rescued') return 'Escort Elin home and reunite her with Mara.';
  if (phase === 'village') return 'Ask Mara or Oren about Elin’s trail, choose a lead, then enter the gate when ready.';
  // The game supplies the objective after validating actual stage progress.
  const observed = facts.currentObjective ?? facts.objective ?? game.objective;
  if (typeof observed === 'string' && observed.trim() && observed.length <= 160) return observed.trim();
  return ({ arrival: 'Meet Ivo and discover the clue for this realm.', trial: 'Inspect the trial and discuss your approach with Ivo.', sentinel: 'Face the Sentinel or seek an evidence-based bargain.', warden: 'Confront the Warden; use the clues and outcomes you have earned.', rescue: 'Reach Elin’s refuge and speak to her.' })[facts.questStage ?? game.questStage] ?? 'Find Ivo, discover the realm’s clue, and follow the trial toward Elin.';
}
export function chapterForMessage(message, prior, route, previousRoute = route) {
  const text = message.toLowerCase();
  const realm = /archive|drown|sunken|waterlogged|underwater|\bwet\b/.test(text) ? 'sunken_archive' : /monastery|wind|sky|cloud|bell/.test(text) ? 'sky_monastery' : /thorn|wood|forest|ribbon/.test(text) ? 'thornwild' : /ember|burn|compass|fire/.test(text) ? 'ember_keep' : prior?.realm ?? 'ember_keep';
  const chapter = prior ? { ...prior } : defaultChapter(route, realm);
  if (prior && route !== previousRoute) chapter.trial = defaultChapter(route, realm).trial;
  if (realm !== chapter.realm) Object.assign(chapter, { realm, ...REALM_STORIES[realm] });
  if (/talk|bargain|negotiate|reason with|peace|parley/.test(text)) chapter.trial = 'parley';
  else if (/\b(?:riddle|puzzle)\b/.test(text)) chapter.trial = 'riddle';
  else if (/\bgauntlet\b/.test(text)) chapter.trial = 'gauntlet';
  if (/false trail|decoy|mislead/.test(text)) chapter.twist = 'false_trail';
  else if (/willing guardian|protecting|guardian/.test(text)) chapter.twist = 'willing_guardian';
  else if (/broken oath|broken promise/.test(text)) chapter.twist = 'broken_oath';
  return chapter;
}
export function storyDialogue(input, profile, chapter, facts) {
  const { npc, phase, message } = input;
  if (phase === 'complete') return npc === 'Elin' ? 'Home at last. Thank you for bringing me back to Mara. Which moment of our journey will you remember?' : 'Elin is safely home. Tell me which choice on your journey mattered most to you.';
  if (phase === 'rescued') return npc === 'Elin' ? 'I’m ready to follow you home. Let’s find Mara together.' : 'Elin is free. Stay with her and guide her home to Mara.';
  if (phase === 'village') {
    if (/^(?:hi|hello|hey|what now|help|i don.t know)[.!?\s]*$/i.test(message.trim())) return npc === 'Oren' ? 'Elin left four leads: a burning compass, a drowned page, a sky bell, and a thornwood ribbon. Which should we follow?' : 'My sister Elin followed a burning compass beyond our gate. Oren also found a drowned page and a thornwood ribbon. Which lead calls to you?';
    return `${chapter.hook} ${chapter.trial === 'gauntlet' ? 'Will you face its defenders, or hear Oren’s clues first?' : chapter.trial === 'parley' ? 'Could we learn why its guardians stand watch before drawing steel?' : 'Shall we follow that clue carefully, or prepare for a fight?'} Enter the gate when ready.`.slice(0, 320);
  }
  const stage = facts.questStage ?? profile.game?.questStage ?? 'arrival';
  if (npc === 'Elin') return stage === 'rescue' ? 'You reached my refuge. Speak to me here, and we can find our way home together.' : 'The path to my refuge is still guarded. Follow Ivo’s guidance and the trial before approaching the Warden.';
  if (npc === 'Sentinel' || npc === 'Warden') return /bargain|spare|talk|peace/i.test(message) ? 'Bring the evidence you discovered and tell me why I should trust you. Words alone cannot release this oath.' : 'You stand before my charge. Will you challenge me, or speak of what you have learned?';
  if (stage === 'arrival') return npc === 'Ivo' ? 'I’m Ivo, your guide here. Look for the marked clue nearby, then bring what you learn to the trial. What caught your eye?' : 'Find Ivo in the realm beyond the gate. He can help you discover its clue and approach the trial. What have you learned so far?';
  if (stage === 'trial') {
    if (chapter.trial === 'gauntlet') return 'The trial’s defenders must be overcome before the Sentinel’s barrier opens. Keep clear of their attacks and return if you need guidance.';
    if (chapter.trial === 'parley') return 'Read the nearby clue first. Then tell me what evidence could persuade this realm’s guardians; I can hear your proposed answer.';
    if (/answer|solution|tell me|give me a hint|hint/i.test(message)) {
      const clue = facts.clueText;
      if (facts.clueDiscovered === true && typeof clue === 'string') return `Recall the clue you found: ${clue}`.slice(0, 320);
      return 'Begin with the trial inscription and its nearby clue. Tell me what they suggest, and I’ll help you reason it through.';
    }
    return typeof facts.riddle === 'string' ? `The trial asks: ${facts.riddle} What do you think it means?`.slice(0,320) : 'Read the trial inscription and discover the clue nearby. Then tell me your answer here.';
  }
  return objectiveFor(phase, facts, profile.game) + ' Tell me what you have discovered, and we can consider your next move.';
}
