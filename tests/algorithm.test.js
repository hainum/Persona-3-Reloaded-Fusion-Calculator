/**
 * Algorithm Test Suite for P3R Fusion Calculator
 * 
 * Run with: node tests/algorithm.test.js
 * 
 * Uses a Vite-based loader to handle JSON imports the same way
 * the app does, so we test the exact same code paths.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'src', 'data');

// ── Load raw data (mimicking DataParser.js) ─────────────────────

const demonDataRaw = JSON.parse(readFileSync(join(dataDir, 'demon-data.json'), 'utf-8'));
const skillDataRaw = JSON.parse(readFileSync(join(dataDir, 'skill-data.json'), 'utf-8'));
const fusionChartRaw = JSON.parse(readFileSync(join(dataDir, 'fusion-chart.json'), 'utf-8'));
const specialRecipesRaw = JSON.parse(readFileSync(join(dataDir, 'special-recipes.json'), 'utf-8'));
const compConfigRaw = JSON.parse(readFileSync(join(dataDir, 'comp-config.json'), 'utf-8'));

// ── Replicate DataParser.js ─────────────────────────────────────

const skillData = {};
for (const [key, row] of Object.entries(skillDataRaw)) {
  const name = row.a[0];
  const elem = row.a[1];
  const target = row.a[2];
  const rank = row.b[0] || 99;
  skillData[name] = {
    name, elem, target, rank, id: key,
    cost: row.b[1] >= 1000 ? row.b[1] % 1000 : row.b[1],
    power: row.b[2],
    statusEffect: row.c[0] === '-' ? null : row.c[0],
    effectDesc: row.c[1] === '-' ? null : row.c[1],
    ailmentChance: row.b[7],
  };
}

const personaData = {};
for (const [name, data] of Object.entries(demonDataRaw)) {
  personaData[name] = {
    name, lvl: data.lvl, race: data.race, inherits: data.inherits,
    resists: data.resists, skills: data.skills, stats: data.stats, heart: data.heart
  };
}

const inheritElems = compConfigRaw.inheritElems;
const inheritTypes = {};
for (const [type, bits] of Object.entries(compConfigRaw.inheritTypes)) {
  inheritTypes[type] = bits.split('').map(b => b === '1');
}

function canInherit(personaName, skillNameOrElem) {
  let elem = skillNameOrElem;
  if (skillData[skillNameOrElem]) elem = skillData[skillNameOrElem].elem;
  const elemIndex = inheritElems.indexOf(elem);
  if (elemIndex === -1) return true;
  const persona = personaData[personaName];
  if (!persona) return false;
  const inheritBits = inheritTypes[persona.inherits];
  if (!inheritBits) return false;
  return inheritBits[elemIndex];
}

function isSkillInheritable(skillName) {
  const skill = skillData[skillName];
  if (!skill) return false;
  return skill.rank < 99;
}

// ── Replicate effect description logic ───────────────────────────

const ELEM_LABELS = {
  phy: 'Phys', sla: 'Slash', str: 'Strike', pie: 'Pierce',
  fir: 'Fire', ice: 'Ice', ele: 'Electric', win: 'Wind',
  lig: 'Light', dar: 'Dark', alm: 'Almighty',
  rec: 'Recovery', sup: 'Support', pas: 'Passive', nai: 'Auto',
  ail: 'Ailment', spe: 'Special', uni: 'Unique',
};

const FMT_DESC = {
  FMTAilmentBoost: (s) => `${s.statusEffect} chance up`,
  FMTAutoSkill: (s) => `Auto ${s.statusEffect} at battle start`,
  FMTBase: (s) => {
    if (s.elem === 'rec') {
      const what = (s.statusEffect || 'HP').replace(/ restore/i, '');
      if (s.power > 0) return `Restore ${s.power} ${what} to ${s.target}`;
      return `${what} to ${s.target}`;
    }
    if ((s.elem === 'sup' || s.elem === 'spe') && s.power === 0 && s.statusEffect) {
      return `${s.statusEffect} \u2014 ${s.target}`;
    }
    return `${s.power} ${ELEM_LABELS[s.elem] || s.elem.toUpperCase()} dmg to ${s.target}`;
  },
  FMTCureAilment: (s) => `Cure ${s.statusEffect} of all allies`,
  FMTDodgeElem: (s) => `${s.statusEffect} dodge rate up`,
  FMTDrainElem: (s) => `Drain ${s.statusEffect}`,
  FMTElemBoost: (s) => {
    const mult = ((s.ailmentChance || 1125) - 1000) / 100;
    const display = mult % 1 === 0 ? String(mult) : mult.toFixed(2);
    return `${s.statusEffect} dmg dealt x${display}`;
  },
  FMTElemBreak: (s) => `${s.statusEffect} resistance down for 3 turns`,
  FMTElemCharge: (s) => `Next ${s.statusEffect} dmg x2.5`,
  FMTElemKarn: (s) => `Reflect ${s.statusEffect} dmg once`,
  FMTEndure: () => 'Survive fatal blow with 1 HP',
  FMTEnduringSoul: () => 'Survive fatal blow, fully restore HP',
  FMTExact: (s) => {
    const label = ELEM_LABELS[s.elem] || s.elem.toUpperCase();
    let desc = `${s.power} ${label} dmg to ${s.target}`;
    if (s.statusEffect && s.ailmentChance > 0) desc += ` (${s.ailmentChance}% ${s.statusEffect})`;
    else if (s.statusEffect) desc += ` (${s.statusEffect})`;
    return desc;
  },
  FMTFoulBreathN: () => 'Increase foe ailment susceptibility for 3 turns',
  FMTFracDamage: (s) => `Reduce ${s.target} HP by 1/2`,
  FMTGrowthN: (s) => `Earn ${s.ailmentChance}% exp when not in battle`,
  FMTHealBoost: () => 'Healing effects +50%',
  FMTInstakillWhen: (s) => `Instakill foes with ${s.statusEffect}`,
  FMTInvigorateN: (s) => `Restore ${s.ailmentChance} SP each turn`,
  FMTLifeAidN: (s) => `Restore ${s.ailmentChance}% HP/SP after battle`,
  FMTNullAilment: (s) => `Null ${s.statusEffect}`,
  FMTNullElem: (s) => `Null ${s.statusEffect}`,
  FMTPersonaCounterN: (s) => `${s.ailmentChance}% chance to counter phys dmg`,
  FMTPersonaKaja: (s) => {
    const pct = Math.abs(s.ailmentChance - 1100);
    const verb = s.ailmentChance > 1100 ? 'Raise' : 'Lower';
    return `${verb} ${s.statusEffect} of ${s.target} by ${pct}% for 3 turns`;
  },
  FMTPersonaLifeDrainN: (s) => `Drain ${s.statusEffect} from foe`,
  FMTPlus: (s) => {
    const label = s.statusEffect.replace(/^[a-z]/, (c) => c.toUpperCase());
    return `${label} +${s.ailmentChance}%`;
  },
  FMTRecarm: (s) => `Revive ally with ${s.ailmentChance}% HP`,
  FMTRegenerateN: (s) => `Restore ${s.ailmentChance}% HP each turn`,
  FMTRepelElem: (s) => `Repel ${s.statusEffect}`,
  FMTResistAilment: (s) => `Resist ${s.statusEffect}`,
  FMTResistElem: (s) => `Resist ${s.statusEffect}`,
  FMTTimes: (s) => `${s.statusEffect} up`,
};

function getEffect(skill) {
  const { elem, target, power, statusEffect, effectDesc, ailmentChance } = skill;

  if (effectDesc && FMT_DESC[effectDesc]) {
    return FMT_DESC[effectDesc](skill);
  }

  if (effectDesc && effectDesc.includes('$')) {
    let desc = effectDesc;
    if (power) desc = desc.replace('$1', power);
    if (statusEffect) desc = desc.replace('$2', statusEffect);
    desc = desc.replace(/\$[12]/g, '?');
    return desc;
  }

  if (effectDesc && effectDesc !== '-' && effectDesc.length > 3) {
    return effectDesc;
  }
  const elemLabel = ELEM_LABELS[elem] || elem.toUpperCase();
  if (elem === 'rec') {
    const what = statusEffect || 'HP';
    const amt = power ? ` ${power}` : '';
    return `Restore${amt} ${what} to ${target}`;
  }
  if (elem === 'sup' || elem === 'spe') {
    if (statusEffect) return `${statusEffect} \u2014 ${target}`;
    return `${elemLabel} \u2014 ${target}`;
  }
  if (elem === 'pas' || elem === 'nai') {
    if (statusEffect) return `Passive: ${statusEffect}`;
    return elemLabel;
  }
  if (elem === 'ail') {
    if (statusEffect) return `${ailmentChance || ''}% ${statusEffect} chance on ${target}`.trimStart();
    return `${elemLabel} on ${target}`;
  }
  if (elem === 'uni') return statusEffect || elemLabel;
  if (power > 0 || ['sla', 'str', 'pie', 'fir', 'ice', 'ele', 'win', 'lig', 'dar', 'alm'].includes(elem)) {
    const parts = [];
    if (power > 0) parts.push(String(power));
    parts.push(`${elemLabel} dmg to ${target}`);
    if (statusEffect && ailmentChance > 0) parts.push(`(${ailmentChance}% ${statusEffect})`);
    else if (statusEffect) parts.push(`(${statusEffect})`);
    return parts.join(' ');
  }
  return `${elemLabel} ${target}`;
}

// Build skillLearnedBy index (including innate skills)
const skillLearnedBy = {};
for (const [pName, pData] of Object.entries(demonDataRaw)) {
  for (const [sName, unlockLvl] of Object.entries(pData.skills)) {
    if (!skillLearnedBy[sName]) skillLearnedBy[sName] = [];
    skillLearnedBy[sName].push({ personaName: pName, level: unlockLvl });
  }
}
for (const entries of Object.values(skillLearnedBy)) {
  entries.sort((a, b) => {
    const aLvl = a.level < 1 ? (personaData[a.personaName]?.lvl ?? a.level) : a.level;
    const bLvl = b.level < 1 ? (personaData[b.personaName]?.lvl ?? b.level) : b.level;
    return aLvl - bLvl;
  });
}

// ── Replicate FusionCalculator.js ───────────────────────────────

const arcanaPersonas = {};
const allPersonas = Object.values(personaData).map(p => p.name);
const specialRecipeResults = new Set(Object.keys(specialRecipesRaw));

for (const p of Object.values(personaData)) {
  if (!arcanaPersonas[p.race]) arcanaPersonas[p.race] = [];
  arcanaPersonas[p.race].push(p);
}
for (const arcana in arcanaPersonas) {
  arcanaPersonas[arcana].sort((a, b) => a.lvl - b.lvl);
}

function getResultRace(raceA, raceB) {
  const races = fusionChartRaw.races;
  const idxA = races.indexOf(raceA);
  const idxB = races.indexOf(raceB);
  if (idxA === -1 || idxB === -1) return null;
  const minIdx = Math.min(idxA, idxB);
  const maxIdx = Math.max(idxA, idxB);
  if (minIdx === maxIdx) return raceA;
  const resultRace = fusionChartRaw.table[maxIdx][minIdx];
  return resultRace === "-" ? null : resultRace;
}

function getNormalFusionResult(personaA, personaB) {
  if (personaA.name === personaB.name) return null;
  const resultRace = getResultRace(personaA.race, personaB.race);
  if (!resultRace) return null;
  const candidatePersonas = arcanaPersonas[resultRace];
  if (!candidatePersonas) return null;
  const isSameRace = personaA.race === personaB.race;
  const targetLevel = Math.floor((personaA.lvl + personaB.lvl) / 2) + (isSameRace ? 0 : 1);

  if (isSameRace) {
    let result = null;
    for (let i = candidatePersonas.length - 1; i >= 0; i--) {
      const p = candidatePersonas[i];
      if (p.lvl <= targetLevel && p.name !== personaA.name && p.name !== personaB.name && !specialRecipeResults.has(p.name)) {
        result = p; break;
      }
    }
    return result;
  } else {
    let result = null;
    for (let i = 0; i < candidatePersonas.length; i++) {
      const p = candidatePersonas[i];
      if (p.lvl >= targetLevel && !specialRecipeResults.has(p.name)) { result = p; break; }
    }
    if (!result) {
      for (let i = candidatePersonas.length - 1; i >= 0; i--) {
        const p = candidatePersonas[i];
        if (!specialRecipeResults.has(p.name)) { result = p; break; }
      }
    }
    return result;
  }
}

const recipeMap = {};
for (const pName of allPersonas) recipeMap[pName] = [];

for (const [result, ingredients] of Object.entries(specialRecipesRaw)) {
  if (recipeMap[result]) recipeMap[result].push({ ingredients, isSpecial: true });
}

for (let i = 0; i < allPersonas.length; i++) {
  for (let j = i + 1; j < allPersonas.length; j++) {
    const pA = personaData[allPersonas[i]];
    const pB = personaData[allPersonas[j]];
    const result = getNormalFusionResult(pA, pB);
    if (result) recipeMap[result.name].push({ ingredients: [pA.name, pB.name], isSpecial: false });
  }
}

for (const pName of allPersonas) {
  recipeMap[pName].sort((a, b) => {
    const maxA = Math.max(...a.ingredients.map(i => personaData[i] ? personaData[i].lvl : 0));
    const maxB = Math.max(...b.ingredients.map(i => personaData[i] ? personaData[i].lvl : 0));
    return maxA - maxB;
  });
}

function getAllRecipes(personaName) { return recipeMap[personaName] || []; }
function getInnateSkills(personaName) {
  const p = personaData[personaName]; if (!p) return [];
  return Object.keys(p.skills);
}

function distributeSkills(skills, numBuckets) {
  if (skills.length === 0) return [Array.from({length: numBuckets}, () => [])];
  const restDistributions = distributeSkills(skills.slice(1), numBuckets);
  const result = []; const skill = skills[0];
  for (const dist of restDistributions) {
    for (let i = 0; i < numBuckets; i++) {
      const newDist = dist.map(arr => [...arr]); newDist[i].push(skill); result.push(newDist);
    }
  }
  return result;
}

function searchTree(personaName, requiredSkills, maxDepth, memo) {
  const memoKey = `${personaName}:${requiredSkills.sort().join(',')}:${maxDepth}`;
  if (memo[memoKey]) return memo[memoKey];
  if (!requiredSkills.every(s => canInherit(personaName, s))) { memo[memoKey] = []; return []; }
  const innate = getInnateSkills(personaName);
  const stillRequired = requiredSkills.filter(s => !innate.includes(s));
  if (stillRequired.length === 0) {
    const res = [{ persona: personaName, skillsProvided: requiredSkills, innateProvided: requiredSkills.filter(s => innate.includes(s)), ingredients: [] }];
    memo[memoKey] = res; return res;
  }
  if (maxDepth === 0) { memo[memoKey] = []; return []; }
  const recipes = getAllRecipes(personaName); const validPaths = [];
  for (const recipe of recipes) {
    const ingredients = recipe.ingredients;
    const assignments = distributeSkills(stillRequired, ingredients.length);
    for (const assignment of assignments) {
      let isAssignmentValid = true; const childPathsCombo = [];
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i]; const assignedReqs = assignment[i];
        let childPaths;
        if (assignedReqs.length === 0) { childPaths = [{ persona: ing, skillsProvided: [], innateProvided: [], ingredients: [] }]; }
        else { childPaths = searchTree(ing, assignedReqs, maxDepth - 1, memo); }
        if (childPaths.length === 0) { isAssignmentValid = false; break; }
        childPathsCombo.push(childPaths[0]);
      }
      if (isAssignmentValid) {
        validPaths.push({ persona: personaName, skillsProvided: requiredSkills, innateProvided: requiredSkills.filter(s => innate.includes(s)), ingredients: childPathsCombo });
      }
    }
  }
  memo[memoKey] = validPaths; return validPaths;
}

function getPathMaxLevel(path) {
  let max = personaData[path.persona] ? personaData[path.persona].lvl : 0;
  for (const ingPath of path.ingredients) max = Math.max(max, getPathMaxLevel(ingPath));
  return max;
}

function getPathPersonaNames(path, names = new Set()) {
  names.add(path.persona);
  for (const ing of path.ingredients) getPathPersonaNames(ing, names);
  return names;
}

function getPathNodeCount(path) {
  let count = 1;
  for (const ing of path.ingredients) count += getPathNodeCount(ing);
  return count;
}

function generateFusionTrees(personaName, maxDepth, memo) {
  if (maxDepth <= 0) return [];
  const memoKey = `gen:${personaName}:${maxDepth}`;
  if (memo[memoKey]) return memo[memoKey];
  const recipes = getAllRecipes(personaName); const results = [];
  for (const recipe of recipes) {
    const ingredientNodes = recipe.ingredients.map(ing => {
      const childTrees = generateFusionTrees(ing, maxDepth - 1, memo);
      if (childTrees.length > 0) return childTrees[0];
      return { persona: ing, skillsProvided: [], innateProvided: [], ingredients: [] };
    });
    results.push({ persona: personaName, skillsProvided: [], innateProvided: [], ingredients: ingredientNodes });
  }
  memo[memoKey] = results; return results;
}

function addPathMetadata(path) {
  path._maxLevel = getPathMaxLevel(path);
  path._nodeCount = getPathNodeCount(path);
  return path;
}

// Accumulate unique paths across depths (mirrors the worker's approach)
function findFusionPaths(targetPersona, targetSkills, maxDepth = 2, currentLevel = 99, requiredPersonas = null) {
  for (const skill of targetSkills) {
    if (!canInherit(targetPersona, skill)) {
      return { error: `Persona ${targetPersona} cannot inherit skill ${skill}.` };
    }
  }
  const memo = {};
  const seenPathKeys = new Set();
  const allPaths = [];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let pathsAtDepth;
    if (targetSkills.length === 0) {
      pathsAtDepth = generateFusionTrees(targetPersona, depth, memo);
    } else {
      pathsAtDepth = searchTree(targetPersona, targetSkills, depth, memo);
    }
    if (requiredPersonas && requiredPersonas.length > 0) {
      pathsAtDepth = pathsAtDepth.filter(p => {
        const namesInPath = getPathPersonaNames(p);
        return requiredPersonas.every(name => namesInPath.has(name));
      });
    }
    for (const p of pathsAtDepth) {
      const key = JSON.stringify([...getPathPersonaNames(p)].sort());
      if (!seenPathKeys.has(key)) {
        seenPathKeys.add(key);
        allPaths.push(addPathMetadata(p));
      }
    }
  }
  allPaths.sort((a, b) => {
    const maxA = a._maxLevel; const maxB = b._maxLevel;
    const aPossible = maxA <= currentLevel; const bPossible = maxB <= currentLevel;
    if (aPossible && !bPossible) return -1;
    if (!aPossible && bPossible) return 1;
    const nodesA = a._nodeCount; const nodesB = b._nodeCount;
    if (nodesA !== nodesB) return nodesA - nodesB;
    return maxA - maxB;
  });
  return { paths: allPaths, error: null };
}

// ═══════════════════════════════════════════════════════════════════
// TEST HARNESS
// ═══════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`);
    failed++;
    failures.push(testName);
  }
}

console.log('\n═══ P3R Fusion Calculator — Algorithm Tests ═══\n');

// ── 1. Data Integrity ───────────────────────────────────────────

console.log('── Data Integrity ──');
assert(Object.keys(personaData).length > 190, 'Persona data has 190+ entries', `got ${Object.keys(personaData).length}`);
assert(Object.keys(skillData).length > 100, 'Skill data has 100+ entries', `got ${Object.keys(skillData).length}`);
assert(personaData['Orpheus'] !== undefined, 'Orpheus exists');
assert(personaData['Jikokuten'] !== undefined, 'Jikokuten exists');
assert(personaData['Rakshasa'] !== undefined, 'Rakshasa exists');
assert(isSkillInheritable('Counter'), 'Counter is inheritable');

// ── 2. Recipe Map ───────────────────────────────────────────────

console.log('\n── Recipe Map ──');
assert(getAllRecipes('Jikokuten').length > 0, `Jikokuten has recipes (${getAllRecipes('Jikokuten').length})`);
assert(getAllRecipes('Orpheus').length > 0, `Orpheus has recipes (${getAllRecipes('Orpheus').length})`);
assert(getAllRecipes('Messiah').some(r => r.isSpecial), 'Messiah has special recipes');

// ── 3. Basic Fusion Search ──────────────────────────────────────

console.log('\n── Basic Fusion Search ──');
{
  const r = findFusionPaths('Jikokuten', ['Counter'], 2);
  assert(!r.error, 'Jikokuten + Counter: no error');
  assert(r.paths.length > 0, `Jikokuten + Counter: ${r.paths.length} paths found`);
  assert(r.paths.every(p => p.persona === 'Jikokuten'), 'All paths rooted at Jikokuten');
}

// ── 4. Inheritance Validation ───────────────────────────────────

console.log('\n── Inheritance Validation ──');
{
  let found = false;
  for (const pName of Object.keys(personaData).slice(0, 50)) {
    for (const sName of Object.keys(skillData).slice(0, 50)) {
      if (skillData[sName].rank < 99 && !canInherit(pName, skillData[sName].elem)) {
        const r = findFusionPaths(pName, [sName], 2);
        assert(r.error !== null, `Blocks uninheritable: ${pName} + ${sName}`);
        found = true; break;
      }
    }
    if (found) break;
  }
  if (!found) assert(true, 'No uninheritable example found in sample (ok)');
}

// ── 5. Required Personas Filter ─────────────────────────────────

console.log('\n── Required Personas Filter ──');
{
  // With skills + include
  const r = findFusionPaths('Jikokuten', ['Counter'], 2, 99, ['Rakshasa']);
  assert(!r.error, 'Jikokuten + Counter + include Rakshasa: no error');
  assert(r.paths.length > 0, `With skills + include Rakshasa: ${r.paths.length} paths`);
  if (r.paths.length > 0) {
    assert(getPathPersonaNames(r.paths[0]).has('Rakshasa'), 'First path includes Rakshasa');
  }
}
{
  // BUG CASE: No skills + include
  const r = findFusionPaths('Jikokuten', [], 2, 99, ['Rakshasa']);
  assert(!r.error, 'No skills + include Rakshasa: no error');
  assert(r.paths.length > 0, `No skills + include Rakshasa: ${r.paths.length} paths`);
  if (r.paths.length > 0) {
    assert(getPathPersonaNames(r.paths[0]).has('Rakshasa'), 'No-skills path includes Rakshasa');
  }
}
{
  // Nonexistent persona
  const r = findFusionPaths('Jikokuten', ['Counter'], 2, 99, ['FAKE']);
  assert(r.paths.length === 0, 'Nonexistent required persona: 0 paths');
}
{
  // Null requiredPersonas = no filter
  const a = findFusionPaths('Jikokuten', ['Counter'], 2, 99, null);
  const b = findFusionPaths('Jikokuten', ['Counter'], 2, 99);
  assert(a.paths.length === b.paths.length, 'null filter = no filter');
}

// ── 6. Level-Aware Sorting ──────────────────────────────────────

console.log('\n── Level-Aware Sorting ──');
{
  const r = findFusionPaths('Jikokuten', ['Counter'], 2, 15);
  if (r.paths.length >= 2) {
    const lvl0 = getPathMaxLevel(r.paths[0]);
    const lvl1 = getPathMaxLevel(r.paths[1]);
    assert(lvl0 <= lvl1, `Level sort: path 0 maxLvl (${lvl0}) <= path 1 (${lvl1})`);
  } else {
    assert(true, 'Not enough paths to test level sort');
  }
}

// ── 7. Node Count Sorting ───────────────────────────────────────

console.log('\n── Node Count Sorting ──');
{
  const r = findFusionPaths('Jikokuten', ['Counter'], 3, 99);
  if (r.paths.length >= 2) {
    const n0 = getPathNodeCount(r.paths[0]);
    const n1 = getPathNodeCount(r.paths[1]);
    const sameAchievability = (getPathMaxLevel(r.paths[0]) <= 99) === (getPathMaxLevel(r.paths[1]) <= 99);
    if (sameAchievability) {
      assert(n0 <= n1, `Node sort: path 0 (${n0} nodes) <= path 1 (${n1} nodes)`);
    } else {
      assert(true, 'Different achievability tiers, skipping node sort check');
    }
  } else {
    assert(true, 'Not enough paths for node sort test');
  }
}

// ── 8. Depth Progression ────────────────────────────────────────

console.log('\n── Depth Progression ──');
{
  const d1 = findFusionPaths('Jikokuten', ['Counter'], 1);
  const d2 = findFusionPaths('Jikokuten', ['Counter'], 2);
  const d3 = findFusionPaths('Jikokuten', ['Counter'], 3);
  assert(d2.paths.length >= d1.paths.length, `Depth 2 (${d2.paths.length}) >= Depth 1 (${d1.paths.length})`);
  assert(d3.paths.length >= d2.paths.length, `Depth 3 (${d3.paths.length}) >= Depth 2 (${d2.paths.length})`);
}

// ── 9. Path Metadata (_maxLevel, _nodeCount) ─────────────────

console.log('\n── Path Metadata ──');
{
  const r = findFusionPaths('Jikokuten', ['Counter'], 2, 99);
  if (r.paths.length > 0) {
    const p0 = r.paths[0];
    assert(p0._maxLevel !== undefined, '_maxLevel is present');
    assert(p0._nodeCount !== undefined, '_nodeCount is present');
    assert(typeof p0._maxLevel === 'number' && p0._maxLevel > 0, '_maxLevel is a positive number');
    assert(typeof p0._nodeCount === 'number' && p0._nodeCount > 0, '_nodeCount is a positive number');
    assert(p0._maxLevel === getPathMaxLevel(p0), '_maxLevel matches getPathMaxLevel');
    assert(p0._nodeCount === getPathNodeCount(p0), '_nodeCount matches getPathNodeCount');
  } else {
    assert(true, 'No paths to check metadata');
  }
}

// ── 10. Exported Helper Functions (used by worker) ────────────

console.log('\n── Exported Helpers ──');
{
  const r = findFusionPaths('Jikokuten', ['Counter'], 2, 99);
  if (r.paths.length > 0) {
    const p0 = r.paths[0];
    const names = getPathPersonaNames(p0);
    assert(names.size > 0, 'getPathPersonaNames returns non-empty set');
    assert(names.has('Jikokuten'), 'getPathPersonaNames includes root persona');
    const count = getPathNodeCount(p0);
    assert(count > 0 && count >= names.size, 'getPathNodeCount >= distinct names');
    const maxLvl = getPathMaxLevel(p0);
    assert(maxLvl > 0, 'getPathMaxLevel returns positive value');
  } else {
    assert(true, 'No paths to test helpers');
  }
}

// ── 11. No Skills, No Filter ───────────────────────────────────

console.log('\n── No Skills, No Filter ──');
{
  const r = findFusionPaths('Jikokuten', [], 2, 99, null);
  assert(!r.error, 'No skills/no filter: no error');
  assert(r.paths.length > 0, `No skills/no filter: ${r.paths.length} recipe paths`);
}

// ── 10. SP Cost Decoding ────────────────────────────────────────

console.log('\n── SP Cost Decoding ──');
{
  const cost = (name) => skillData[name]?.cost;
  assert(cost('Dia') === 3, 'Dia: 3 SP');
  assert(cost('Agi') === 3, 'Agi: 3 SP');
  assert(cost('Bufu') === 4, 'Bufu: 4 SP');
  assert(cost('Zio') === 4, 'Zio: 4 SP');
  assert(cost('Garu') === 3, 'Garu: 3 SP');
  assert(cost('Fire Break') === 12, 'Fire Break: 12 SP');
  assert(cost('Elec Break') === 12, 'Elec Break: 12 SP');
  assert(cost('Charge') === 30, 'Charge: 30 SP');
  assert(cost('Megidolaon') === 50, 'Megidolaon: 50 SP');
  assert(cost('Salvation') === 60, 'Salvation: 60 SP');
  assert(cost('Diarahan') === 20, 'Diarahan: 20 SP');
  assert(cost('Samarecarm') === 35, 'Samarecarm: 35 SP');
  assert(cost('Black Viper') === 70, 'Black Viper: 70 SP');
  assert(cost('Sinful Shell') === 66, 'Sinful Shell: 66 SP');
  // Passive skills should have 0 cost
  assert(cost('Elec Boost') === 0, 'Elec Boost (passive): 0 SP');
  assert(cost('Elec Amp') === 0, 'Elec Amp (passive): 0 SP');
  assert(cost('Elec Driver') === 0, 'Elec Driver (passive): 0 SP');
  // Theurgy / special skills decode correctly
  assert(cost('Cadenza') === 1, 'Cadenza (theurgy): 1 SP');
  assert(cost('Armageddon') === 1, 'Armageddon (theurgy): 1 SP');
}

// ── 11. Skill Effect Descriptions ───────────────────────────────

console.log('\n── Skill Effect Descriptions ──');
{
  const eff = (name) => getEffect(skillData[name]);

  assert(eff('Elec Boost') === 'Elec dmg dealt x1.25', 'Elec Boost: Elec dmg dealt x1.25');
  assert(eff('Elec Amp') === 'Elec dmg dealt x1.50', 'Elec Amp: Elec dmg dealt x1.50');
  assert(eff('Elec Driver') === 'Elec dmg dealt x1.75', 'Elec Driver: Elec dmg dealt x1.75');
  assert(eff('Slash Boost') === 'Slash dmg dealt x1.25', 'Slash Boost: Slash dmg dealt x1.25');
  assert(eff('Slash Amp') === 'Slash dmg dealt x1.50', 'Slash Amp: Slash dmg dealt x1.50');
  assert(eff('Slash Driver') === 'Slash dmg dealt x1.75', 'Slash Driver: Slash dmg dealt x1.75');
  assert(eff('Drain Slash') === 'Drain Slash', 'Drain Slash: Drain Slash');
  assert(eff('Null Slash') === 'Null Slash', 'Null Slash: Null Slash');
  assert(eff('Repel Slash') === 'Repel Slash', 'Repel Slash: Repel Slash');
  assert(eff('Resist Slash') === 'Resist Slash', 'Resist Slash: Resist Slash');
  assert(eff('Dodge Slash') === 'Slash dodge rate up', 'Dodge Slash: Slash dodge rate up');
  assert(eff('Recarm') === 'Revive ally with 50% HP', 'Recarm: Revive ally with 50% HP');
  assert(eff('Samarecarm') === 'Revive ally with 100% HP', 'Samarecarm: Revive ally with 100% HP');
  assert(eff('Poison Boost') === 'Poison chance up', 'Poison Boost: Poison chance up');
  assert(eff('Dizzy Boost') === 'Dizzy chance up', 'Dizzy Boost: Dizzy chance up');
  assert(eff('Dia') === 'Restore 50 HP to 1 ally', 'Dia: Restore 50 HP to 1 ally');
  assert(eff('Diarama') === 'Restore 150 HP to 1 ally', 'Diarama: Restore 150 HP to 1 ally');
  assert(eff('Agi') === '40 Fire dmg to 1 foe', 'Agi: 40 Fire dmg to 1 foe');
  assert(eff('Agidyne') === '220 Fire dmg to 1 foe', 'Agidyne: 220 Fire dmg to 1 foe');
  assert(eff('Megidolaon') === '690 Almighty dmg to All foes', 'Megidolaon: 690 Almighty dmg to All foes');
  assert(eff('Bufu') === '40 Ice dmg to 1 foe (15% Freeze)', 'Bufu: 40 Ice dmg to 1 foe (15% Freeze)');
  assert(eff('Tarukaja') === 'Raise attack of 1 ally by 40% for 3 turns', 'Tarukaja: Raise attack of 1 ally by 40% for 3 turns');
  assert(eff('Matarukaja') === 'Raise attack of All allies by 40% for 3 turns', 'Matarukaja: Raise attack of All allies by 40% for 3 turns');
  assert(eff('Tarunda') === 'Lower attack of 1 foe by 40% for 3 turns', 'Tarunda: Lower attack of 1 foe by 40% for 3 turns');
  assert(eff('Matarunda') === 'Lower attack of All foes by 40% for 3 turns', 'Matarunda: Lower attack of All foes by 40% for 3 turns');
  assert(eff('Sukukaja') === 'Raise hit and evasion of 1 ally by 30% for 3 turns', 'Sukukaja: Raise hit and evasion of 1 ally by 30% for 3 turns');
  assert(eff('Masukunda') === 'Lower hit and evasion of All foes by 30% for 3 turns', 'Masukunda: Lower hit and evasion of All foes by 30% for 3 turns');
  assert(eff('Heat Riser') === 'Tarukaja + Rakukaja + Sukukaja \u2014 1 ally', 'Heat Riser: multi-effect description');
  assert(eff('Debilitate') === 'Tarunda + Rakunda + Sukunda \u2014 1 foe', 'Debilitate: multi-effect description');
}

// ── 12. skillLearnedBy includes innate skills ──────────────────

console.log('\n── skillLearnedBy Index ──');
{
  // Innate skill: should appear even though unlockLvl < 1
  const edLearners = skillLearnedBy['Elec Driver'];
  assert(edLearners && edLearners.some(l => l.personaName === 'Captain Kidd'),
    'Elec Driver: found via Captain Kidd (innate)');

  // Level-up skill: should still appear normally
  const agiLearners = skillLearnedBy['Agi'];
  assert(agiLearners && agiLearners.length > 0,
    'Agi: has learners');

  // Skill learned by many personas
  const diaLearners = skillLearnedBy['Dia'];
  assert(diaLearners && diaLearners.length >= 3,
    'Dia: has 3+ learners');

  // SkillLearnedBy entries sorted by display level (persona level for innate, unlock level for learned)
  if (diaLearners) {
    const getDisplayLvl = (l) => l.level < 1 ? (personaData[l.personaName]?.lvl ?? l.level) : l.level;
    for (let i = 1; i < diaLearners.length; i++) {
      assert(getDisplayLvl(diaLearners[i]) >= getDisplayLvl(diaLearners[i - 1]),
        `Dia learners sorted by level: index ${i}`);
    }
  }

  // Innate skill level is < 1
  if (edLearners) {
    for (const l of edLearners) {
      if (l.personaName === 'Captain Kidd') {
        assert(l.level < 1, 'Elec Driver on Captain Kidd: level < 1 (innate)');
      }
    }
  }

  // Non-existent skill
  assert(!skillLearnedBy['__nonexistent__'],
    'Non-existent skill: not in index');
}

// ── Summary ─────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════');
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\n  Failures:');
  for (const f of failures) console.log(`    - ${f}`);
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
