import { personaData, fusionChart, specialRecipes, canInherit } from '../data/DataParser.js';

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
  const targetLevel = isSameRace ? Math.floor(avg) : Math.ceil(avg);

  if (isSameRace) {
    // Find the one strictly below targetLevel, excluding A, B, and specials
    let result = null;
    for (let i = candidatePersonas.length - 1; i >= 0; i--) {
      const p = candidatePersonas[i];
      if (p.lvl <= targetLevel && p.name !== personaA.name && p.name !== personaB.name && !specialRecipeResults.has(p.name)) {
        result = p;
        break;
      }
    }
    return result;
  } else {
    // Find the one closest to avg, excluding specials (tiebreak: higher level)
    let result = null;
    let bestDist = Infinity;
    for (let i = 0; i < candidatePersonas.length; i++) {
      const p = candidatePersonas[i];
      if (specialRecipeResults.has(p.name)) continue;
      const dist = Math.abs(p.lvl - avg);
      if (dist < bestDist || (dist === bestDist && (!result || p.lvl > result.lvl))) {
        result = p;
        bestDist = dist;
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

function distributeSkills(skills, numBuckets) {
  if (skills.length === 0) return [Array.from({length: numBuckets}, () => [])];
  const restDistributions = distributeSkills(skills.slice(1), numBuckets);
  const result = [];
  const skill = skills[0];
  for (let d = 0; d < restDistributions.length; d++) {
    const dist = restDistributions[d];
    for (let i = 0; i < numBuckets; i++) {
      const newDist = new Array(numBuckets);
      for (let j = 0; j < numBuckets; j++) {
        if (j === i) {
          const copy = dist[j];
          const len = copy.length;
          const arr = new Array(len + 1);
          for (let k = 0; k < len; k++) arr[k] = copy[k];
          arr[len] = skill;
          newDist[j] = arr;
        } else {
          newDist[j] = dist[j];
        }
      }
      result.push(newDist);
    }
  }
  return result;
}

export function searchTree(personaName, requiredSkills, maxDepth, memo, customPersonaSkills, targetPersonaName) {
  const skillsCopy = [...requiredSkills].sort();
  const memoKey = `${personaName}:${skillsCopy.join(',')}:${maxDepth}`;
  if (memo[memoKey]) return memo[memoKey];

  const innate = getInnateSkills(personaName);
  const extra = (customPersonaSkills && customPersonaSkills[personaName]) || [];
  const hasCustomEntry = customPersonaSkills && customPersonaSkills[personaName] !== undefined;
  const provided = innate.concat(extra);
  const stillRequired = skillsCopy.filter(s => !provided.includes(s));

  if (!stillRequired.every(s => canInherit(personaName, s))) {
    memo[memoKey] = [];
    return [];
  }

  const innateProvidedInCall = skillsCopy.filter(s => innate.includes(s));
  const customProvidedInCall = skillsCopy.filter(s => extra.includes(s));

  if (stillRequired.length === 0) {
    const res = [{ persona: personaName, skillsProvided: skillsCopy, innateProvided: innateProvidedInCall, customProvided: customProvidedInCall, ingredients: [] }];
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
        
        let childPaths;
        if (assignedReqs.length === 0) {
           childPaths = [{ persona: ing, skillsProvided: [], innateProvided: [], customProvided: [], ingredients: [] }];
        } else {
           childPaths = searchTree(ing, assignedReqs, maxDepth - 1, memo, customPersonaSkills, targetPersonaName);
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
          skillsProvided: skillsCopy,
          innateProvided: innateProvidedInCall,
          customProvided: customProvidedInCall,
          ingredients: childPathsCombo
        });
      }
    }
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
        ingredients: []
      };
    });

    results.push({
      persona: personaName,
      skillsProvided: [],
      innateProvided: [],
      customProvided: [],
      ingredients: ingredientNodes
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

function addPathMetadata(path) {
  path._maxLevel = getPathMaxLevel(path);
  path._nodeCount = getPathNodeCount(path);
  path._usesCustomSkills = pathUsesCustomSkills(path);
  return path;
}

function getPathKey(path) {
  const names = getPathPersonaNames(path);
  return [...names].sort().join(',');
}

export function findFusionPaths(targetPersona, targetSkills, maxDepth = 2, currentLevel = 99, requiredPersonas = null, customPersonaSkills = null, excludedPersonas = null) {
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
      pathsAtDepth = searchTree(targetPersona, targetSkills, depth, memo, customPersonaSkills, targetPersona);
    }

    if (requiredPersonas && requiredPersonas.length > 0) {
      pathsAtDepth = pathsAtDepth.filter(p => {
        const namesInPath = getPathPersonaNames(p);
        return requiredPersonas.every(name => namesInPath.has(name));
      });
    }

    if (excludedPersonas && excludedPersonas.length > 0) {
      pathsAtDepth = pathsAtDepth.filter(p => {
        const namesInPath = getPathPersonaNames(p);
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

  allPaths.sort((a, b) => {
    const aPossible = a._maxLevel <= currentLevel;
    const bPossible = b._maxLevel <= currentLevel;

    if (aPossible && !bPossible) return -1;
    if (!aPossible && bPossible) return 1;

    if (a._nodeCount !== b._nodeCount) return a._nodeCount - b._nodeCount;

    if (a._maxLevel !== b._maxLevel) return a._maxLevel - b._maxLevel;

    if (a._usesCustomSkills && !b._usesCustomSkills) return -1;
    if (!a._usesCustomSkills && b._usesCustomSkills) return 1;

    return 0;
  });

  return { paths: allPaths, error: null };
}
