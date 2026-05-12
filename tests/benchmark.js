/**
 * Fusion Search Strategy Benchmark
 *
 * Compares different cap/early-break strategies across a suite of persona/skill combos.
 * Each strategy is tested independently — no production code is modified.
 *
 * Run: node tests/benchmark.js
 */

import { personaData, canInherit } from '../src/data/DataParser.js';
import { getAllRecipes, getPathMaxLevel, getPathPersonaNames, getPathNodeCount } from '../src/lib/FusionCalculator.js';

// ── Replicate private helpers from FusionCalculator.js ──────────

function getInnateSkills(personaName) {
  const p = personaData[personaName];
  if (!p) return [];
  return Object.keys(p.skills);
}

function distributeSkills(skills, numBuckets) {
  if (skills.length === 0) return [Array.from({ length: numBuckets }, () => [])];
  const restDistributions = distributeSkills(skills.slice(1), numBuckets);
  const result = [];
  const skill = skills[0];
  for (const dist of restDistributions) {
    for (let i = 0; i < numBuckets; i++) {
      const newDist = dist.map(arr => [...arr]);
      newDist[i].push(skill);
      result.push(newDist);
    }
  }
  return result;
}

// ── Parameterized search functions ─────────────────────────────

function createSearchFunctions(strategy) {
  const searchTree = (personaName, requiredSkills, maxDepth, memo) => {
    const memoKey = `${personaName}:${requiredSkills.sort().join(',')}:${maxDepth}`;
    if (memo[memoKey]) return memo[memoKey];

    if (!requiredSkills.every(s => canInherit(personaName, s))) {
      memo[memoKey] = [];
      return [];
    }

    const innate = getInnateSkills(personaName);
    const stillRequired = requiredSkills.filter(s => !innate.includes(s));

    if (stillRequired.length === 0) {
      const res = [{ persona: personaName, skillsProvided: requiredSkills, innateProvided: requiredSkills.filter(s => innate.includes(s)), ingredients: [] }];
      memo[memoKey] = res;
      return res;
    }

    if (maxDepth === 0) {
      memo[memoKey] = [];
      return [];
    }

    const recipes = getAllRecipes(personaName);
    const validPaths = [];

    for (const recipe of recipes) {
      const ingredients = recipe.ingredients;
      const assignments = distributeSkills(stillRequired, ingredients.length);

      for (const assignment of assignments) {
        let isAssignmentValid = true;
        const childPathsCombo = [];

        for (let i = 0; i < ingredients.length; i++) {
          const ing = ingredients[i];
          const assignedReqs = assignment[i];

          let childPaths;
          if (assignedReqs.length === 0) {
            childPaths = [{ persona: ing, skillsProvided: [], innateProvided: [], ingredients: [] }];
          } else {
            childPaths = searchTree(ing, assignedReqs, maxDepth - 1, memo);
          }

          if (childPaths.length === 0) {
            isAssignmentValid = false;
            break;
          }
          childPathsCombo.push(childPaths[0]);
        }

        if (isAssignmentValid) {
          validPaths.push({
            persona: personaName,
            skillsProvided: requiredSkills,
            innateProvided: requiredSkills.filter(s => innate.includes(s)),
            ingredients: childPathsCombo
          });
          if (validPaths.length >= strategy.searchTreeCap) break;
        }
      }
      if (validPaths.length >= strategy.searchTreeCap) break;
    }

    memo[memoKey] = validPaths;
    return validPaths;
  };

  const generateFusionTrees = (personaName, maxDepth, memo) => {
    if (maxDepth <= 0) return [];

    const memoKey = `gen:${personaName}:${maxDepth}`;
    if (memo[memoKey]) return memo[memoKey];

    const recipes = getAllRecipes(personaName);
    const results = [];

    for (const recipe of recipes) {
      const ingredientNodes = recipe.ingredients.map(ing => {
        const childTrees = generateFusionTrees(ing, maxDepth - 1, memo);
        if (childTrees.length > 0) return childTrees[0];
        return { persona: ing, skillsProvided: [], innateProvided: [], ingredients: [] };
      });

      results.push({
        persona: personaName,
        skillsProvided: [],
        innateProvided: [],
        ingredients: ingredientNodes
      });

      if (results.length >= strategy.genTreesCap) break;
    }

    memo[memoKey] = results;
    return results;
  };

  const findFusionPaths = (targetPersona, targetSkills, maxDepth, requiredPersonas = null) => {
    for (const skill of targetSkills) {
      if (!canInherit(targetPersona, skill)) {
        return { error: `Persona ${targetPersona} cannot inherit skill ${skill}.`, paths: [] };
      }
    }

    const memo = {};
    const seenPathKeys = new Set();
    const allPaths = [];
    let emptyStreak = 0;

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

      const dedupedAtDepth = [];
      for (const p of pathsAtDepth) {
        const key = JSON.stringify([...getPathPersonaNames(p)].sort());
        if (!seenPathKeys.has(key)) {
          seenPathKeys.add(key);
          const enriched = { ...p, _maxLevel: getPathMaxLevel(p), _nodeCount: getPathNodeCount(p) };
          dedupedAtDepth.push(enriched);
          allPaths.push(enriched);
        }
      }

      if (pathsAtDepth.length === 0) {
        emptyStreak++;
        if (emptyStreak >= strategy.emptyStreakThreshold) break;
      } else {
        emptyStreak = 0;
      }

      if (allPaths.length >= strategy.findPathsTotalCap) break;
    }

    return { paths: allPaths, error: null };
  };

  return { searchTree, generateFusionTrees, findFusionPaths };
}

// ── Strategies ──────────────────────────────────────────────────

const STRATEGIES = [
  {
    key: 'A',
    name: 'A (original: prevCount=0)',
    searchTreeCap: 5,
    genTreesCap: 5,
    findPathsTotalCap: 5,
    emptyStreakThreshold: 2,
  },
  {
    key: 'B',
    name: 'B (emptyStreak\u22655)',
    searchTreeCap: 5,
    genTreesCap: 5,
    findPathsTotalCap: 5,
    emptyStreakThreshold: 5,
  },
  {
    key: 'C',
    name: 'C (no caps)',
    searchTreeCap: Infinity,
    genTreesCap: Infinity,
    findPathsTotalCap: Infinity,
    emptyStreakThreshold: 5,
  },
  {
    key: 'D',
    name: 'D (worker 200)',
    searchTreeCap: Infinity,
    genTreesCap: Infinity,
    findPathsTotalCap: 200,
    emptyStreakThreshold: 5,
  },
  {
    key: 'E',
    name: 'E (caps=50)',
    searchTreeCap: 50,
    genTreesCap: 50,
    findPathsTotalCap: 50,
    emptyStreakThreshold: 5,
  },
];

// ── Test Cases ──────────────────────────────────────────────────

const CASES = [
  {
    name: 'Jikokuten + Counter',
    persona: 'Jikokuten',
    skills: ['Counter'],
    maxDepth: 5,
    desc: 'Single skill, normal 2-ingredient recipes',
  },
  {
    name: 'Arsene + Dark Boost',
    persona: 'Arsene',
    skills: ['Dark Boost'],
    maxDepth: 5,
    desc: '1 skill, special 3-ingredient recipe',
  },
  {
    name: 'Arsene + Dark Boost + Invigorate 2',
    persona: 'Arsene',
    skills: ['Dark Boost', 'Invigorate 2'],
    maxDepth: 5,
    desc: '2 skills, special 3-ingredient recipe (bug case)',
  },
  {
    name: 'Jikokuten + Counter + Rakukaja',
    persona: 'Jikokuten',
    skills: ['Counter', 'Rakukaja'],
    maxDepth: 5,
    desc: '2 skills, normal recipes',
  },
  {
    name: 'Jikokuten + Counter + Rakukaja + Tarunda',
    persona: 'Jikokuten',
    skills: ['Counter', 'Rakukaja', 'Tarunda'],
    maxDepth: 5,
    desc: '3 skills, normal recipes',
  },
  {
    name: 'Jack-o\'-Lantern + Agi + Maragi + Fire Boost',
    persona: 'Jack-o\'-Lantern',
    skills: ['Agi', 'Maragi', 'Fire Boost'],
    maxDepth: 5,
    desc: '3 skills on low-level common persona',
  },
  {
    name: 'Orpheus (no skills)',
    persona: 'Orpheus',
    skills: [],
    maxDepth: 5,
    desc: 'No skill constraints, special recipe',
  },
  {
    name: 'Abaddon + Maziodyne',
    persona: 'Abaddon',
    skills: ['Maziodyne'],
    maxDepth: 5,
    desc: 'Single skill, harsh inheritance test',
  },
];

// ── Benchmark Runner ────────────────────────────────────────────

function formatTime(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 1) return `${ms.toFixed(0)}ms`;
  return `${(ms * 1000).toFixed(0)}\u00b5s`;
}

console.log('\n\u2550\u2550\u2550 Fusion Search Strategy Benchmark \u2550\u2550\u2550\n');
console.log(`Running ${CASES.length} cases \u00d7 ${STRATEGIES.length} strategies\n`);

const results = {};

for (const c of CASES) {
  results[c.name] = {};
  console.log(`\n\u250f\u2501\u2501 ${c.name} \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
  console.log(`\u2503 ${c.desc}`);
  console.log(`\u2517 persona=${c.persona} skills=[${c.skills.join(', ')}] maxDepth=${c.maxDepth}\n`);

  const colW = 24;
  const header = `${'Strategy'.padEnd(colW)} | Paths | D1 D2 D3 D4 D5 | Deepest | Time`;
  console.log(header);
  console.log('\u2500'.repeat(header.length));

  for (const s of STRATEGIES) {
    const { findFusionPaths } = createSearchFunctions(s);

    const start = performance.now();
    const result = findFusionPaths(c.persona, c.skills, c.maxDepth);
    const elapsed = performance.now() - start;

    const depthsSeen = {};
    for (const p of result.paths) {
      const d = p._nodeCount;
      depthsSeen[d] = (depthsSeen[d] || 0) + 1;
    }
    const deepest = result.paths.length > 0
      ? Math.max(...result.paths.map(p => p._nodeCount))
      : 0;
    const perDepth = [1, 2, 3, 4, 5].map(d => depthsSeen[d] || 0);

    const pathStr = String(result.paths.length).padStart(5);
    const depthStr = perDepth.map(n => String(n).padStart(2)).join(' ');
    const deepestStr = String(deepest).padStart(7);
    const timeStr = formatTime(elapsed).padStart(8);

    console.log(`${s.name.padEnd(colW)} | ${pathStr} | ${depthStr} | ${deepestStr} | ${timeStr}`);

    results[c.name][s.key] = {
      strategy: s.key,
      paths: result.paths.length,
      error: result.error,
      perDepth,
      deepest,
      timeMs: elapsed,
      pathsTotalCap: s.findPathsTotalCap,
      searchTreeCap: s.searchTreeCap,
      emptyStreak: s.emptyStreakThreshold,
    };
  }
}

// ── Summary Table ───────────────────────────────────────────────

console.log('\n\n\u2550\u2550\u2550 Summary: Total Unique Paths \u2550\u2550\u2550\n');

const stratKeys = STRATEGIES.map(s => s.key);
const caseNames = CASES.map(c => c.name);
const colW2 = 40;
const cellW = 8;

let header2 = ''.padEnd(colW2);
for (const k of stratKeys) header2 += `| ${k.padEnd(cellW)}`;
console.log(header2);
console.log('\u2500'.repeat(header2.length));

for (const cn of caseNames) {
  let row = cn.padEnd(colW2);
  for (const k of stratKeys) {
    const r = results[cn][k];
    const val = r.error ? 'ERR' : String(r.paths);
    row += `| ${val.padEnd(cellW)}`;
  }
  console.log(row);
}

console.log('\n\n\u2550\u2550\u2550 Summary: Deepest Depth \u2550\u2550\u2550\n');

let header3 = ''.padEnd(colW2);
for (const k of stratKeys) header3 += `| ${k.padEnd(cellW)}`;
console.log(header3);
console.log('\u2500'.repeat(header3.length));

for (const cn of caseNames) {
  let row = cn.padEnd(colW2);
  for (const k of stratKeys) {
    const r = results[cn][k];
    const val = r.error ? 'ERR' : String(r.deepest);
    row += `| ${val.padEnd(cellW)}`;
  }
  console.log(row);
}

console.log('\n\n\u2550\u2550\u2550 Summary: Time (ms) \u2550\u2550\u2550\n');

let header4 = ''.padEnd(colW2);
for (const k of stratKeys) header4 += `| ${k.padEnd(cellW)}`;
console.log(header4);
console.log('\u2500'.repeat(header4.length));

for (const cn of caseNames) {
  let row = cn.padEnd(colW2);
  for (const k of stratKeys) {
    const r = results[cn][k];
    const val = r.error ? 'ERR' : r.timeMs.toFixed(1);
    row += `| ${val.padEnd(cellW)}`;
  }
  console.log(row);
}

// ── Analysis ────────────────────────────────────────────────────

console.log('\n\n\u2550\u2550\u2550 Analysis \u2550\u2550\u2550\n');

for (const c of CASES) {
  const r = results[c.name];
  const bestPathCount = Math.max(...STRATEGIES.filter(s => !r[s.key].error).map(s => r[s.key].paths));
  const bestStrats = STRATEGIES.filter(s => !r[s.key].error && r[s.key].paths === bestPathCount).map(s => s.key);

  const haveError = STRATEGIES.filter(s => r[s.key].error).map(s => s.key);
  const missingPaths = STRATEGIES.filter(s => !r[s.key].error && r[s.key].paths < bestPathCount).map(s => `${s.key}(${r[s.key].paths})`);

  const parts = [];
  if (haveError.length > 0) parts.push(`error: ${haveError.join(',')}`);
  if (missingPaths.length > 0) parts.push(`missed: ${missingPaths.join(',')}`);
  if (bestStrats.length === STRATEGIES.length && parts.length === 0) parts.push('all equal');
  else parts.push(`best: ${bestStrats.join(',')} (${bestPathCount} paths)`);

  console.log(`  ${c.name}: ${parts.join(' \u2014 ')}`);
}

console.log('\n');
