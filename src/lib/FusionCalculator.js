import { personaData, fusionChart, specialRecipes, canInherit, getMaxInheritedSkills } from '../data/DataParser.js';

// Precompute lists for fast lookups
const arcanaPersonas = {};
const allPersonas = Object.values(personaData).map(p => p.name);
const specialRecipeResults = new Set(Object.keys(specialRecipes));

for (const p of Object.values(personaData)) {
  if (!arcanaPersonas[p.race]) {
    arcanaPersonas[p.race] = [];
  }
  arcanaPersonas[p.race].push(p);
}

// Sort each arcana by base level
for (const arcana in arcanaPersonas) {
  arcanaPersonas[arcana].sort((a, b) => a.lvl - b.lvl);
}

// Precompute persona level map for fast lookup
const personaLevelMap = {};
for (const p of Object.values(personaData)) {
  personaLevelMap[p.name] = p.lvl;
}

// Precompute innate skills for all personas
const innateSkillsMap = {};
for (const p of Object.values(personaData)) {
  innateSkillsMap[p.name] = Object.keys(p.skills);
}

function getResultRace(raceA, raceB) {
  const races = fusionChart.races;
  const idxA = races.indexOf(raceA);
  const idxB = races.indexOf(raceB);
  if (idxA === -1 || idxB === -1) return null;
  
  const minIdx = Math.min(idxA, idxB);
  const maxIdx = Math.max(idxA, idxB);
  
  if (minIdx === maxIdx) return raceA;
  
  // table is lower triangular, but let's safely access
  const resultRace = fusionChart.table[maxIdx][minIdx];
  return resultRace === "-" ? null : resultRace;
}

export function getNormalFusionResult(personaA, personaB) {
  if (personaA.name === personaB.name) return null;

  const resultRace = getResultRace(personaA.race, personaB.race);
  if (!resultRace) return null;
  
  const candidatePersonas = arcanaPersonas[resultRace];
  if (!candidatePersonas) return null;

  const isSameRace = personaA.race === personaB.race;
  const avg = (personaA.lvl + personaB.lvl) / 2;

  if (isSameRace) {
    // P3R same-race: find persona whose level is closest to avg,
    // excluding A, B, and specials. Ties go to the higher-level persona.
    let best = null;
    let bestDiff = Infinity;
    for (const p of candidatePersonas) {
      if (p.name === personaA.name || p.name === personaB.name || specialRecipeResults.has(p.name)) continue;
      const diff = Math.abs(p.lvl - avg);
      if (diff < bestDiff || (diff === bestDiff && (!best || p.lvl > best.lvl))) {
        best = p;
        bestDiff = diff;
      }
    }
    return best;
  } else {
    // P3R different-race: find lowest-level non-special persona >= ceil(avg)
    const target = Math.ceil(avg);
    let result = null;
    for (let i = 0; i < candidatePersonas.length; i++) {
      const p = candidatePersonas[i];
      if (specialRecipeResults.has(p.name)) continue;
      if (p.lvl >= target) {
        result = p;
        break;
      }
    }
    // If none >= target, take the highest-level non-special
    if (!result) {
      for (let i = candidatePersonas.length - 1; i >= 0; i--) {
        const p = candidatePersonas[i];
        if (specialRecipeResults.has(p.name)) continue;
        result = p;
        break;
      }
    }
    return result;
  }
}

// Build base recipe map (no Social Link influence)
const recipeMap = {};
for (const pName of allPersonas) {
  recipeMap[pName] = [];
}

for (const [result, ingredients] of Object.entries(specialRecipes)) {
  if (recipeMap[result]) {
    recipeMap[result].push({ ingredients, isSpecial: true });
  }
}

for (let i = 0; i < allPersonas.length; i++) {
  for (let j = i + 1; j < allPersonas.length; j++) {
    const pA = personaData[allPersonas[i]];
    const pB = personaData[allPersonas[j]];
    const result = getNormalFusionResult(pA, pB);
    if (result) {
      recipeMap[result.name].push({ ingredients: [pA.name, pB.name], isSpecial: false });
    }
  }
}

for (const pName of allPersonas) {
  recipeMap[pName].sort((a, b) => {
    const maxA = Math.max(personaLevelMap[a.ingredients[0]] || 0, personaLevelMap[a.ingredients[1]] || 0);
    const maxB = Math.max(personaLevelMap[b.ingredients[0]] || 0, personaLevelMap[b.ingredients[1]] || 0);
    return maxA - maxB;
  });
}

export function getAllRecipes(personaName) {
  return recipeMap[personaName] || [];
}

// Precompute forward fusions: persona → fusions where it appears as an ingredient
const forwardFusionMap = {};
for (const pName of allPersonas) {
  forwardFusionMap[pName] = [];
}
for (const [resultName, recipes] of Object.entries(recipeMap)) {
  for (const recipe of recipes) {
    for (const ingName of recipe.ingredients) {
      if (forwardFusionMap[ingName]) {
        forwardFusionMap[ingName].push({
          result: resultName,
          otherIngredients: recipe.ingredients.filter(n => n !== ingName),
          isSpecial: recipe.isSpecial,
        });
      }
    }
  }
}

export function getForwardFusions(personaName) {
  return forwardFusionMap[personaName] || [];
}

function getInnateSkills(personaName) {
  return innateSkillsMap[personaName] || [];
}

function* distributeSkills(skills, numBuckets) {
  const n = skills.length;
  const total = Math.pow(numBuckets, n);
  for (let mask = 0; mask < total; mask++) {
    const buckets = new Array(numBuckets);
    for (let i = 0; i < numBuckets; i++) buckets[i] = [];
    let m = mask;
    for (let i = 0; i < n; i++) {
      buckets[m % numBuckets].push(skills[i]);
      m = Math.floor(m / numBuckets);
    }
    yield buckets;
  }
}

const MAX_PATHS_PER_STATE = 200;

export function searchTree(personaName, requiredSkills, maxDepth, memo, customPersonaSkills, targetPersonaName, maxResults = MAX_PATHS_PER_STATE) {
  const skillsCopy = [...requiredSkills].sort();
  const capped = maxResults < MAX_PATHS_PER_STATE;
  const memoKey = capped ? `${personaName}:${skillsCopy.join(',')}:${maxDepth}:c${maxResults}` : `${personaName}:${skillsCopy.join(',')}:${maxDepth}`;
  if (memo[memoKey]) return memo[memoKey];

  const innate = getInnateSkills(personaName);
  const extra = (customPersonaSkills && customPersonaSkills[personaName]) || [];
  const hasCustomEntry = customPersonaSkills && customPersonaSkills[personaName] !== undefined;
  const provided = hasCustomEntry && extra.length >= 8 ? [...extra] : innate.concat(extra);
  const stillRequired = skillsCopy.filter(s => !provided.includes(s));

  if (!stillRequired.every(s => canInherit(personaName, s))) {
    memo[memoKey] = [];
    return [];
  }

  if (stillRequired.length > getMaxInheritedSkills(personaName)) {
    memo[memoKey] = [];
    return [];
  }

  const innateProvidedInCall = skillsCopy.filter(s => innate.includes(s));
  const customProvidedInCall = skillsCopy.filter(s => extra.includes(s));

  if (stillRequired.length === 0) {
    const pathSet = new Set([personaName]);
    const res = [{ persona: personaName, skillsProvided: skillsCopy, innateProvided: innateProvidedInCall, customProvided: customProvidedInCall, ingredients: [], _personaSet: pathSet, _usesCustom: hasCustomEntry }];
    memo[memoKey] = res;
    return res;
  }

  // Custom personas are personas you already possess — treat as leaf nodes
  if (hasCustomEntry && personaName !== targetPersonaName) {
    memo[memoKey] = [];
    return [];
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

        if (assignedReqs.length > 0 && !assignedReqs.every(s => canInherit(ing, s))) {
          isAssignmentValid = false;
          break;
        }

        let childPath;
        if (assignedReqs.length === 0) {
          childPath = { persona: ing, skillsProvided: [], innateProvided: [], customProvided: [], ingredients: [], _personaSet: new Set([ing]) };
        } else {
          const childPaths = searchTree(ing, assignedReqs, maxDepth - 1, memo, customPersonaSkills, targetPersonaName, 1);
          if (childPaths.length === 0) {
            isAssignmentValid = false;
            break;
          }
          childPath = childPaths[0];
        }

        childPathsCombo.push(childPath);
      }

      if (isAssignmentValid) {
        const pathPersonaSet = new Set([personaName]);
        for (const cp of childPathsCombo) {
          for (const n of cp._personaSet) pathPersonaSet.add(n);
        }

        validPaths.push({
          persona: personaName,
          skillsProvided: skillsCopy,
          innateProvided: innateProvidedInCall,
          customProvided: customProvidedInCall,
          ingredients: childPathsCombo,
          _personaSet: pathPersonaSet,
          _usesCustom: hasCustomEntry
        });

        if (validPaths.length >= maxResults) break;
      }
    }
    if (validPaths.length >= maxResults) break;
  }

  memo[memoKey] = validPaths;
  return validPaths;
}

export function getPathMaxLevel(path) {
  let max = personaLevelMap[path.persona] || 0;
  for (const ingPath of path.ingredients) {
    max = Math.max(max, getPathMaxLevel(ingPath));
  }
  return max;
}

export function getPathPersonaNames(path, names) {
  if (path._personaSet) {
    if (!names) return path._personaSet;
    for (const n of path._personaSet) names.add(n);
    return names;
  }
  if (!names) names = new Set();
  names.add(path.persona);
  for (const ing of path.ingredients) {
    getPathPersonaNames(ing, names);
  }
  return names;
}

export function getPathNodeCount(path) {
  let count = 1;
  for (const ing of path.ingredients) {
    count += getPathNodeCount(ing);
  }
  return count;
}

// Generate all fusion trees for a persona without skill constraints.
// Recursively expands ingredients up to maxDepth so that the required-personas
// filter can find personas at any level within the tree.
export function generateFusionTrees(personaName, maxDepth, memo) {
  if (maxDepth <= 0) return [];

  const memoKey = `gen:${personaName}:${maxDepth}`;
  if (memo[memoKey]) return memo[memoKey];

  const recipes = getAllRecipes(personaName);
  const results = [];

  for (const recipe of recipes) {
    const ingredientNodes = recipe.ingredients.map(ing => {
      const childTrees = generateFusionTrees(ing, maxDepth - 1, memo);
      if (childTrees.length > 0) {
        return childTrees[0];
      }
      return {
        persona: ing,
        skillsProvided: [],
        innateProvided: [],
        customProvided: [],
        ingredients: [],
        _personaSet: new Set([ing])
      };
    });

    const pathPersonaSet = new Set([personaName]);
    for (const ing of ingredientNodes) {
      for (const n of ing._personaSet) pathPersonaSet.add(n);
    }

    results.push({
      persona: personaName,
      skillsProvided: [],
      innateProvided: [],
      customProvided: [],
      ingredients: ingredientNodes,
      _personaSet: pathPersonaSet
    });
  }

  memo[memoKey] = results;
  return results;
}

function pathUsesCustomSkills(path) {
  if (path.customProvided && path.customProvided.length > 0) return true;
  for (const ing of path.ingredients) {
    if (pathUsesCustomSkills(ing)) return true;
  }
  return false;
}

export function comparePaths(a, b, currentLevel) {
  const aPossible = a._maxLevel <= currentLevel;
  const bPossible = b._maxLevel <= currentLevel;
  if (aPossible && !bPossible) return -1;
  if (!aPossible && bPossible) return 1;
  if (a._nodeCount !== b._nodeCount) return a._nodeCount - b._nodeCount;
  if (a._maxLevel !== b._maxLevel) return a._maxLevel - b._maxLevel;
  if (a._usesCustomSkills && !b._usesCustomSkills) return -1;
  if (!a._usesCustomSkills && b._usesCustomSkills) return 1;
  return 0;
}

export function sortPaths(pathsList, level) {
  return [...pathsList].sort((a, b) => comparePaths(a, b, level));
}

export function addPathMetadata(path) {
  path._maxLevel = getPathMaxLevel(path);
  path._nodeCount = getPathNodeCount(path);
  path._usesCustomSkills = pathUsesCustomSkills(path);
  return path;
}

function getPathKey(path) {
  const names = path._personaSet || getPathPersonaNames(path);
  return [...names].sort().join(',');
}

export function findFusionPaths(targetPersona, targetSkills, maxDepth = 2, currentLevel = 99, requiredPersonas = null, customPersonaSkills = null, excludedPersonas = null) {
  for (const skill of targetSkills) {
    if (!canInherit(targetPersona, skill)) {
      return { error: `Persona ${targetPersona} cannot inherit skill ${skill}.` };
    }
  }

  const maxSlots = getMaxInheritedSkills(targetPersona);
  if (targetSkills.length > maxSlots) {
    return { error: `Persona ${targetPersona} can only inherit ${maxSlots} skills via fusion (requested ${targetSkills.length}). Excess skills require Skill Cards.` };
  }

  const memo = {};
  const seenPathKeys = new Set();
  const allPaths = [];

  for (let depth = 1; depth <= maxDepth; depth++) {
    let pathsAtDepth;
    if (targetSkills.length === 0) {
      pathsAtDepth = generateFusionTrees(targetPersona, depth, memo);
    } else {
      pathsAtDepth = searchTree(targetPersona, targetSkills, depth, memo, customPersonaSkills, targetPersona);
    }

    if (requiredPersonas && requiredPersonas.length > 0) {
      pathsAtDepth = pathsAtDepth.filter(p => {
        const namesInPath = p._personaSet || getPathPersonaNames(p);
        return requiredPersonas.every(name => namesInPath.has(name));
      });
    }

    if (excludedPersonas && excludedPersonas.length > 0) {
      pathsAtDepth = pathsAtDepth.filter(p => {
        const namesInPath = p._personaSet || getPathPersonaNames(p);
        return !excludedPersonas.some(name => namesInPath.has(name));
      });
    }

    for (const p of pathsAtDepth) {
      const key = getPathKey(p);
      if (!seenPathKeys.has(key)) {
        seenPathKeys.add(key);
        allPaths.push(addPathMetadata(p));
      }
    }
  }

  allPaths.sort((a, b) => comparePaths(a, b, currentLevel));

  return { paths: allPaths, error: null };
}
