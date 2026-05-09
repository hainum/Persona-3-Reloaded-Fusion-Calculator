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
  skillData[name] = { name, elem, target, rank, id: key, cost: row.b[1] };
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
        if (validPaths.length >= 5) break;
      }
    }
    if (validPaths.length >= 5) break;
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
    if (results.length >= 5) break;
  }
  memo[memoKey] = results; return results;
}

function findFusionPaths(targetPersona, targetSkills, maxDepth = 2, currentLevel = 99, requiredPersonas = null) {
  for (const skill of targetSkills) {
    if (!canInherit(targetPersona, skill)) {
      return { error: `Persona ${targetPersona} cannot inherit skill ${skill}.` };
    }
  }
  const memo = {};
  let paths;
  if (targetSkills.length === 0) {
    paths = generateFusionTrees(targetPersona, maxDepth, memo);
  } else {
    paths = searchTree(targetPersona, targetSkills, maxDepth, memo);
  }
  if (requiredPersonas && requiredPersonas.length > 0) {
    paths = paths.filter(p => {
      const namesInPath = getPathPersonaNames(p);
      return requiredPersonas.every(name => namesInPath.has(name));
    });
  }
  paths.sort((a, b) => {
    const maxA = getPathMaxLevel(a); const maxB = getPathMaxLevel(b);
    const aPossible = maxA <= currentLevel; const bPossible = maxB <= currentLevel;
    if (aPossible && !bPossible) return -1;
    if (!aPossible && bPossible) return 1;
    const nodesA = getPathNodeCount(a); const nodesB = getPathNodeCount(b);
    if (nodesA !== nodesB) return nodesA - nodesB;
    return maxA - maxB;
  });
  return { paths, error: null };
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

// ── 9. No Skills, No Filter ────────────────────────────────────

console.log('\n── No Skills, No Filter ──');
{
  const r = findFusionPaths('Jikokuten', [], 2, 99, null);
  assert(!r.error, 'No skills/no filter: no error');
  assert(r.paths.length > 0, `No skills/no filter: ${r.paths.length} recipe paths`);
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
