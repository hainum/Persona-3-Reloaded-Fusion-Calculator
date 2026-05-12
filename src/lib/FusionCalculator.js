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

function getNormalFusionResult(personaA, personaB) {
  if (personaA.name === personaB.name) return null;

  const resultRace = getResultRace(personaA.race, personaB.race);
  if (!resultRace) return null;
  
  const candidatePersonas = arcanaPersonas[resultRace];
  if (!candidatePersonas) return null;

  const isSameRace = personaA.race === personaB.race;
  const targetLevel = Math.floor((personaA.lvl + personaB.lvl) / 2) + (isSameRace ? 0 : 1);

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
    // Find the one >= targetLevel, excluding specials
    let result = null;
    for (let i = 0; i < candidatePersonas.length; i++) {
      const p = candidatePersonas[i];
      if (p.lvl >= targetLevel && !specialRecipeResults.has(p.name)) {
        result = p;
        break;
      }
    }
    // If none are higher, usually it's the highest possible normal persona of that arcana
    if (!result) {
      for (let i = candidatePersonas.length - 1; i >= 0; i--) {
        const p = candidatePersonas[i];
        if (!specialRecipeResults.has(p.name)) {
          result = p;
          break;
        }
      }
    }
    return result;
  }
}

// Precompute what makes what for fast reverse lookup
const recipeMap = {};
for (const pName of allPersonas) {
  recipeMap[pName] = [];
}

// Map special recipes
for (const [result, ingredients] of Object.entries(specialRecipes)) {
  if (recipeMap[result]) {
    recipeMap[result].push({ ingredients, isSpecial: true });
  }
}

// Generate all valid 2-way normal fusions
for (let i = 0; i < allPersonas.length; i++) {
  for (let j = i + 1; j < allPersonas.length; j++) {
    const pA = personaData[allPersonas[i]];
    const pB = personaData[allPersonas[j]];
    if (specialRecipeResults.has(pA.name) && specialRecipeResults.has(pB.name)) {
        // Many special personas can be used in fusion, but we allow them
    }
    
    const result = getNormalFusionResult(pA, pB);
    if (result) {
      recipeMap[result.name].push({ ingredients: [pA.name, pB.name], isSpecial: false });
    }
  }
}

// Pre-sort all recipes by the maximum level of their ingredients ascending.
// This guarantees that we explore paths requiring lower-level personas first.
for (const pName of allPersonas) {
  recipeMap[pName].sort((a, b) => {
    const maxA = Math.max(...a.ingredients.map(i => personaData[i] ? personaData[i].lvl : 0));
    const maxB = Math.max(...b.ingredients.map(i => personaData[i] ? personaData[i].lvl : 0));
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
  const p = personaData[personaName];
  if (!p) return [];
  return Object.keys(p.skills);
}

function distributeSkills(skills, numBuckets) {
  if (skills.length === 0) return [Array.from({length: numBuckets}, () => [])];
  
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

export function searchTree(personaName, requiredSkills, maxDepth, memo) {
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
      }
    }
  }

  memo[memoKey] = validPaths;
  return validPaths;
}

export function getPathMaxLevel(path) {
  let max = personaData[path.persona] ? personaData[path.persona].lvl : 0;
  for (const ingPath of path.ingredients) {
    max = Math.max(max, getPathMaxLevel(ingPath));
  }
  return max;
}

export function getPathPersonaNames(path, names = new Set()) {
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
      // Recursively expand each ingredient one level deeper
      const childTrees = generateFusionTrees(ing, maxDepth - 1, memo);
      // Use the first child tree if available, otherwise just a leaf
      if (childTrees.length > 0) {
        return childTrees[0];
      }
      return {
        persona: ing,
        skillsProvided: [],
        innateProvided: [],
        ingredients: []
      };
    });

    results.push({
      persona: personaName,
      skillsProvided: [],
      innateProvided: [],
      ingredients: ingredientNodes
    });
  }

  memo[memoKey] = results;
  return results;
}

export function findFusionPaths(targetPersona, targetSkills, maxDepth = 2, currentLevel = 99, requiredPersonas = null) {
  for (const skill of targetSkills) {
    if (!canInherit(targetPersona, skill)) {
      return { error: `Persona ${targetPersona} cannot inherit skill ${skill}.` };
    }
  }

  const memo = {};
  const seenPathKeys = new Set();
  const allPaths = [];

  // Accumulate paths from depth 1 up to maxDepth so that "See Deeper Paths"
  // keeps existing shallow paths and adds new deeper ones below them.
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
        allPaths.push(p);
      }
    }
  }

  // Sort priority: 1) achievable at current level, 2) fewest nodes, 3) lowest max level
  allPaths.sort((a, b) => {
    const maxA = getPathMaxLevel(a);
    const maxB = getPathMaxLevel(b);
    
    const aPossible = maxA <= currentLevel;
    const bPossible = maxB <= currentLevel;

    if (aPossible && !bPossible) return -1;
    if (!aPossible && bPossible) return 1;

    const nodesA = getPathNodeCount(a);
    const nodesB = getPathNodeCount(b);
    if (nodesA !== nodesB) return nodesA - nodesB;

    return maxA - maxB;
  });

  return { paths: allPaths, error: null };
}
