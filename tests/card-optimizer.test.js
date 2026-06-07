import { optimizeSkillSplit, getCardRarity, CARD_RARITY_ORDER } from '../src/lib/SkillCardOptimizer.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log(`  \u274C ${msg}`);
  }
}

function assertMatch(str, regex, msg) {
  if (regex.test(str)) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log(`  \u274C ${msg}`);
    console.log(`    expected match: ${regex}`);
    console.log(`    actual: "${str}"`);
  }
}

// ── Helpers for the optimizer ──
const CARD_MAP = {
  'Agidyne': 'Sword 10',
  'Bufudyne': 'Sword 10',
  'Ziodyne': 'Sword 10',
  'Garudyne': 'Sword 10',
  'Maragidyne': 'Sword J',
  'Mabufudyne': 'Sword J',
  'Maziodyne': 'Sword J',
  'Magarudyne': 'Sword J',
  'Charge': 'Sword Q',
  'Concentrate': 'Sword Q',
  'God\'s Hand': 'Sword Q',
  'Vorpal Blade': 'Sword Q',
  'Primal Force': 'Sword Q',
  'Null Elec': '-',
  'Ali Dance': '-',
  'Firm Stance': '-',
  'Debilitate': '-',
  'Heat Riser': '-',
  'Enduring Soul': 'Sword K',
  'Drain Fire': 'Sword K',
  'Drain Elec': 'Sword K',
  'Slash Amp': 'Sword Q',
  'Strike Amp': 'Sword Q',
  'Pierce Amp': 'Sword Q',
  'Single-Target Boost': 'Sword 7',
  'Multi-Target Boost': 'Sword 7',
  'Apt Pupil': 'Sword 6',
  'Slash Boost': 'Sword 5',
  'Strike Boost': 'Sword 5',
  'Pierce Boost': 'Sword 5',
  'Agilao': 'Sword 6',
  'Maragi': 'Sword 5',
  'Maragion': 'Sword 8',
  'Arms Master': '-',
  'Unshaken Will': '-',
  'Resist Elec': 'Sword 8',
  'Mediarahan': 'Sword Q',
  'Resist Ailments': 'Sword J',
};

const RANK_MAP = {
  'Slash Driver': 99,
  'Strike Driver': 99,
  'Pierce Driver': 99,
  'Pralaya': 99,
};

function getSkillCard(name) {
  return CARD_MAP[name] || '-';
}

function getSkillRank(name) {
  return RANK_MAP[name] || 0;
}

function canInheritNormal(personaName, skillName) {
  if (skillName === 'Null Elec' || skillName === 'Ali Dance' || skillName === 'Firm Stance' ||
      skillName === 'Debilitate' || skillName === 'Heat Riser' || skillName === 'Arms Master' ||
      skillName === 'Unshaken Will') return true;
  if (skillName === 'Agidyne' || skillName === 'Bufudyne' || skillName === 'Ziodyne' || skillName === 'Garudyne') return true;
  if (skillName === 'Maragidyne' || skillName === 'Mabufudyne' || skillName === 'Maziodyne' || skillName === 'Magarudyne') return true;
  if (skillName === 'Charge' || skillName === 'Concentrate') return true;
  if (skillName === 'God\'s Hand' || skillName === 'Vorpal Blade' || skillName === 'Primal Force') return true;
  if (skillName === 'Enduring Soul' || skillName === 'Drain Fire' || skillName === 'Drain Elec') return true;
  if (skillName === 'Slash Amp' || skillName === 'Strike Amp' || skillName === 'Pierce Amp') return true;
  if (skillName === 'Single-Target Boost' || skillName === 'Multi-Target Boost') return true;
  if (skillName === 'Apt Pupil' || skillName === 'Slash Boost' || skillName === 'Strike Boost' || skillName === 'Pierce Boost') return true;
  if (skillName === 'Agilao' || skillName === 'Maragi' || skillName === 'Maragion') return true;
  if (skillName === 'Resist Elec') return true;
  return false;
}

// ── Tests ──

console.log('\n\u2550\u2550\u2550 Card Rarity Tests \u2550\u2550\u2550');

assert(getCardRarity('-') === 0, 'getCardRarity: no-card returns 0');
assert(getCardRarity('Sword K') === 1, 'getCardRarity: Sword K returns 1');
assert(getCardRarity('Sword Q') === 2, 'getCardRarity: Sword Q returns 2');
assert(getCardRarity('Sword J') === 3, 'getCardRarity: Sword J returns 3');
assert(getCardRarity('Sword 10') === 4, 'getCardRarity: Sword 10 returns 4');
assert(getCardRarity('Sword 9') === 5, 'getCardRarity: Sword 9 returns 5');
assert(getCardRarity('Sword 8') === 6, 'getCardRarity: Sword 8 returns 6');
assert(getCardRarity('Sword 7') === 7, 'getCardRarity: Sword 7 returns 7');
assert(getCardRarity('Sword 6') === 8, 'getCardRarity: Sword 6 returns 8');
assert(getCardRarity('Sword 5') === 9, 'getCardRarity: Sword 5 returns 9');
assert(getCardRarity('Sword 4') === 10, 'getCardRarity: Sword 4 returns 10');
assert(getCardRarity('Sword 3') === 11, 'getCardRarity: Sword 3 returns 11');
assert(getCardRarity('Sword 2') === 12, 'getCardRarity: Sword 2 returns 12');
assert(getCardRarity('Sword 1') === 13, 'getCardRarity: Sword 1 returns 13');
assert(getCardRarity('Unknown') === 99, 'getCardRarity: unknown returns 99');

assert(CARD_RARITY_ORDER.length === 14, 'CARD_RARITY_ORDER has 14 entries');

console.log('\n\u2550\u2550\u2550 Basic Split Tests \u2550\u2550\u2550');

// Normal persona (4 slots): 8 skills with common cards
{
  const r = optimizeSkillSplit({
    personaName: 'NormalPersona',
    targetSkills: ['Agidyne', 'Bufudyne', 'Ziodyne', 'Garudyne', 'Maragi', 'Agilao', 'Maragion', 'Maragidyne'],
    maxInheritedSlots: 4,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, '4-slot, 8 skills: no error');
  assert(r.inherit.length === 4, '4-slot: assigns 4 to inherit');
  assert(r.card.length === 4, '4-slot: assigns 4 to card');
  assert(r.cardsNeeded.length === 4, '4-slot: cardsNeeded has 4 entries');
}

// Special recipe (5 slots)
{
  const r = optimizeSkillSplit({
    personaName: 'SpecialRecipePersona',
    targetSkills: ['Agidyne', 'Bufudyne', 'Ziodyne', 'Garudyne', 'Maragi', 'Agilao', 'Maragion', 'Maragidyne'],
    maxInheritedSlots: 5,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, '5-slot: no error');
  assert(r.inherit.length === 5, '5-slot: assigns 5 to inherit');
  assert(r.card.length === 3, '5-slot: assigns 3 to card');
}

// Orpheus Telos (8 slots)
{
  const r = optimizeSkillSplit({
    personaName: 'Orpheus Telos',
    targetSkills: ['Agidyne', 'Bufudyne', 'Ziodyne', 'Garudyne', 'Maragi', 'Agilao', 'Maragion', 'Maragidyne'],
    maxInheritedSlots: 8,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, '8-slot: no error');
  assert(r.inherit.length === 8, '8-slot: all 8 inherited');
  assert(r.card.length === 0, '8-slot: none carded');
}

console.log('\n\u2550\u2550\u2550 No-Card Priority Tests \u2550\u2550\u2550');

// Skills with no card must be prioritized into inherit slots
{
  const r = optimizeSkillSplit({
    personaName: 'NormaPersona',
    targetSkills: ['Agidyne', 'Null Elec', 'Ali Dance', 'Maragi'],
    maxInheritedSlots: 2,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'no-card priority: no error');
  assert(r.inherit.includes('Null Elec'), 'no-card priority: Null Elec (no card) in inherit');
  assert(r.inherit.includes('Ali Dance'), 'no-card priority: Ali Dance (no card) in inherit');
}

console.log('\n\u2550\u2550\u2550 Card Rarity Priority Tests \u2550\u2550\u2550');

// Rarer cards should be inherited first
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Charge', 'Agidyne', 'Maragi', 'Single-Target Boost'],
    maxInheritedSlots: 2,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'rarity: no error');
  // Charge (Sword Q, rarity 2) and Agidyne (Sword 10, rarity 4) should be inherited
  assert(r.inherit.includes('Charge'), 'rarity: Charge (Sword Q) inherited');
  assert(r.inherit.includes('Single-Target Boost') || r.inherit.includes('Agidyne'),
    'rarity: next rarest card [Sword 7 or Sword 10] inherited');
  assert(r.card.includes('Maragi'), 'rarity: Maragi (Sword 5) carded');
}

console.log('\n\u2550\u2550\u2550 inheritedFromCard Tests \u2550\u2550\u2550');

// Skills inherited despite having cards should appear in inheritedFromCard
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Null Elec', 'Charge', 'Maragi', 'Agilao'],
    maxInheritedSlots: 2,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'inheritedFromCard: no error');
  assert(r.inheritedFromCard.length === 1, 'inheritedFromCard: 1 entry (Charge, not Null Elec)');
  assert(r.inheritedFromCard[0].skill === 'Charge', 'inheritedFromCard: Charge is saved card');
  assert(r.inheritedFromCard[0].card === 'Sword Q', 'inheritedFromCard: card = Sword Q');
}

console.log('\n\u2550\u2550\u2550 Omitted Cards Tests \u2550\u2550\u2550');

// Omitted card forces its skill into inherit set
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Maragi', 'Agilao', 'Charge', 'Null Elec'],
    maxInheritedSlots: 2,
    omittedCards: new Set(['Maragi']),
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'omitted card: no error');
  assert(r.inherit.includes('Maragi'), 'omitted card: Maragi (Sword 5 omitted) forced to inherit');
}

// Multiple omitted cards
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Maragi', 'Agilao', 'Slash Boost', 'Single-Target Boost'],
    maxInheritedSlots: 3,
    omittedCards: new Set(['Maragi', 'Agilao', 'Slash Boost']),
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'multiple omitted: no error');
  assert(r.inherit.length === 3, 'multiple omitted: 3 inherited');
  assert(r.inherit.includes('Maragi'), 'multiple omitted: Maragi omitted → inherited');
  assert(r.inherit.includes('Slash Boost'), 'multiple omitted: Slash Boost omitted → inherited');
}

// Omitted card causes overflow → error
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Maragi', 'Agilao', 'Null Elec', 'Ali Dance'],
    maxInheritedSlots: 2,
    omittedCards: new Set(['Maragi', 'Agilao']),
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error !== null, 'omitted overflow: error returned');
  assertMatch(r.error, /Not enough inheritance slots/, 'omitted overflow: correct error message');
}

console.log('\n\u2550\u2550\u2550 Error Cases Tests \u2550\u2550\u2550');

// Non-inheritable + no card → error
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Pralaya'],
    maxInheritedSlots: 4,
    canInherit: () => false,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error !== null, 'non-inherit + no card: error');
  assertMatch(r.error, /Cannot inherit or teach via card/, 'non-inherit + no card: correct message');
}

// Non-inheritable with card → goes to card set (no error)
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Agidyne', 'Charge', 'Maragi', 'Agilao'],
    maxInheritedSlots: 4,
    canInherit: (pn, sn) => sn !== 'Agidyne',
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'non-inherit + has card: no error');
  assert(r.card.includes('Agidyne'), 'non-inherit + has card: goes to card set');
  assert(r.inherit.length === 3, 'non-inherit + has card: 3 inherited, Agidyne demoted');
}

// All no-card skills exceed slots → error
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: ['Null Elec', 'Ali Dance', 'Debilitate'],
    maxInheritedSlots: 2,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error !== null, 'too many no-card skills: error');
  assertMatch(r.error, /Not enough inheritance slots/, 'too many no-card skills: correct message');
}

// Empty skills
{
  const r = optimizeSkillSplit({
    personaName: 'Persona',
    targetSkills: [],
    maxInheritedSlots: 4,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'empty skills: no error');
  assert(r.inherit.length === 0, 'empty skills: inherit empty');
  assert(r.card.length === 0, 'empty skills: card empty');
}

console.log('\n\u2550\u2550\u2550 Real-Build Integration Tests \u2550\u2550\u2550');

// Masakado (5 slots, almighty inherit) — Reaper build
{
  const r = optimizeSkillSplit({
    personaName: 'Masakado',
    targetSkills: ['God\'s Hand', 'Charge', 'Single-Target Boost', 'Apt Pupil', 'Null Elec', 'Enduring Soul'],
    maxInheritedSlots: 5,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'Masakado: no error');
  assert(r.inherit.length === 5, 'Masakado: 5 inherited');
  assert(r.card.length === 1, 'Masakado: 1 carded');
  // Null Elec (no card) must be inherited
  assert(r.inherit.includes('Null Elec'), 'Masakado: Null Elec inherited');
  // Enduring Soul (Sword K) — rarest card, should be inherited
  assert(r.inherit.includes('Enduring Soul'), 'Masakado: Enduring Soul inherited');
  // God's Hand (Sword Q) vs Charge (Sword Q) — both same rarity, one inherited, one maybe carded
  // Single-Target Boost (Sword 7) and Apt Pupil (Sword 6) have commoner cards
  assert(r.cardsNeeded.some(c => c.skill === 'Apt Pupil' || c.skill === 'Single-Target Boost'),
    'Masakado: Apt Pupil or Single-Target Boost is carded');
}

// Trumpeter (4 slots, almighty inherit) — Buff build
{
  const r = optimizeSkillSplit({
    personaName: 'Trumpeter',
    targetSkills: ['Charge', 'Concentrate', 'Heat Riser', 'Ali Dance', 'Debilitate', 'Mediarahan', 'Resist Ailments'],
    maxInheritedSlots: 4,
    canInherit: canInheritNormal,
    getSkillCard,
    getSkillRank,
  });
  assert(r.error === null, 'Trumpeter: no error');
  assert(r.inherit.length === 4, 'Trumpeter: 4 inherited');
  assert(r.card.length === 3, 'Trumpeter: 3 carded');
  // Heat Riser (-), Ali Dance (-), Debilitate (-) — no card, must inherit
  assert(r.inherit.includes('Heat Riser'), 'Trumpeter: Heat Riser inherited');
  assert(r.inherit.includes('Ali Dance'), 'Trumpeter: Ali Dance inherited');
  assert(r.inherit.includes('Debilitate'), 'Trumpeter: Debilitate inherited');
  // Charge (Sword Q) gets the 4th slot (rarest among remaining)
  assert(r.inherit.includes('Charge'), 'Trumpeter: Charge (Sword Q) inherited');
  // The other 3 with cards go to card set: Concentrate, Mediarahan (both Sword Q), Resist Ailments (Sword J)
  assert(r.card.includes('Concentrate'), 'Trumpeter: Concentrate carded');
  assert(r.card.includes('Resist Ailments'), 'Trumpeter: Resist Ailments carded');
}

// Summary
console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\n  Failures:');
  for (const f of failures) console.log(`    - ${f}`);
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
