// Authored synthetic evaluation cases, separate from synthetic training utterances.
const prefer = (id, message, route, previous) => ({ id, kind: 'preference', message, phase: 'village', npc: 'Mara', expectedRoute: route, expectedPreferences: { combat: route === 'combat', mystery: route === 'mystery' }, ...(previous ? { previousPreferences: previous } : {}) });
const combat = { combat: true, mystery: false, protectVillagers: true };
const mystery = { combat: false, mystery: true, protectVillagers: true };
export const EVALUATION_CASES = [
  prefer('prefer-riddles', 'I would like riddles and a careful investigation, please.', 'mystery'),
  prefer('prefer-action', 'I want action and combat against the undead guards.', 'combat'),
  prefer('avoid-violence', 'Please avoid fighting; I want a mystery to solve.', 'mystery'),
  prefer('prefer-battle', 'I prefer battles over puzzles this time.', 'combat'),
  prefer('prefer-clues', 'I prefer following clues rather than fighting.', 'mystery'),
  prefer('combat-instead', 'I want combat instead of puzzles.', 'combat'),
  prefer('correct-combat', 'I changed my mind. No combat; I want puzzles now.', 'mystery', combat),
  prefer('correct-mystery', 'Actually, skip mystery. I prefer fighting the guards.', 'combat', mystery),
  prefer('correct-gentle', 'That earlier wish for fighting was a mistake. I prefer mystery.', 'mystery', combat),
  prefer('correct-action', 'Forget my old puzzle preference. I want combat now.', 'combat', mystery),
  prefer('no-combat-repeat', "I still don't want combat. I prefer clues and investigation.", 'mystery', mystery),
  prefer('combat-repeat', 'Keep my preference for combat rather than mystery.', 'combat', combat),
  { id: 'committed-mystery', kind: 'phase', message: 'Could I have combat now instead?', phase: 'adventure', npc: 'Oren', committedRoute: 'mystery', expectedRoute: 'mystery', objectiveIncludes: 'three rune' },
  { id: 'committed-combat', kind: 'phase', message: 'I would prefer puzzles now.', phase: 'adventure', npc: 'Mara', committedRoute: 'combat', expectedRoute: 'combat', objectiveIncludes: 'undead guards' },
  { id: 'mystery-elin', kind: 'phase', message: 'How can I get you out?', phase: 'adventure', npc: 'Elin', committedRoute: 'mystery', expectedRoute: 'mystery', objectiveIncludes: 'three rune' },
  { id: 'combat-elin', kind: 'phase', message: 'Can I free you before defeating the guards?', phase: 'adventure', npc: 'Elin', committedRoute: 'combat', expectedRoute: 'combat', objectiveIncludes: 'undead guards' },
  { id: 'rescued-elin', kind: 'phase', message: 'You are free. Where should we go?', phase: 'rescued', npc: 'Elin', committedRoute: 'mystery', expectedRoute: 'mystery', objectiveIncludes: 'Escort Elin home' },
  { id: 'rescued-mara', kind: 'phase', message: 'I found Elin. What remains?', phase: 'rescued', npc: 'Mara', committedRoute: 'combat', expectedRoute: 'combat', objectiveIncludes: 'Escort Elin home' },
  { id: 'complete-mara', kind: 'phase', message: 'We brought your sister home. Do you remember?', phase: 'complete', npc: 'Mara', committedRoute: 'mystery', expectedRoute: 'mystery', objectiveIncludes: 'Elin is home' },
  { id: 'complete-oren', kind: 'phase', message: 'What should the village remember about our rescue?', phase: 'complete', npc: 'Oren', committedRoute: 'combat', expectedRoute: 'combat', objectiveIncludes: 'Elin is home' }
];
