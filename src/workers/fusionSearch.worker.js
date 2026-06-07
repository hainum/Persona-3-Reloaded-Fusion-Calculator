import { searchTree, generateFusionTrees, getPathPersonaNames, addPathMetadata, comparePaths, getAllRecipes } from '../lib/FusionCalculator.js';
import { canInherit, getMaxInheritedSkills, skillData, personaData } from '../data/DataParser.js';
import { optimizeSkillSplit } from '../lib/SkillCardOptimizer.js';

const MAX_DEPTH = 20;
const MAX_UNIQUE_PATHS = 200;
const MAX_SEARCH_TIME_MS = 3000;
let cancelled = false;

function runSearch(targetPersona, inheritSkills, cardInfo, payload, memo, seenPathKeys) {
  let emptyStreak = 0;
  const searchStartTime = performance.now();
  let cardInfoSent = false;

  function sendProgress(depth, paths) {
    self.postMessage({
      type: 'progress',
      payload: {
        depth,
        paths,
        ...(cardInfo && !cardInfoSent ? { cardInfo: (cardInfoSent = true, cardInfo) } : {}),
      }
    });
  }

  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    if (cancelled) return null;
    if (performance.now() - searchStartTime > MAX_SEARCH_TIME_MS) {
      sendProgress(depth, []);
      if (cardInfo && !cardInfoSent) cardInfoSent = true;
      break;
    }

    let pathsAtDepth;
    if (inheritSkills.length === 0) {
      pathsAtDepth = generateFusionTrees(targetPersona, depth, memo);
    } else {
      pathsAtDepth = searchTree(targetPersona, inheritSkills, depth, memo, payload.customPersonaSkills, targetPersona);
    }

    if (payload.requiredPersonas && payload.requiredPersonas.length > 0) {
      pathsAtDepth = pathsAtDepth.filter(p => {
        const namesInPath = p._personaSet || getPathPersonaNames(p);
        return payload.requiredPersonas.every(name => namesInPath.has(name));
      });
    }

    if (payload.excludedPersonas && payload.excludedPersonas.length > 0) {
      pathsAtDepth = pathsAtDepth.filter(p => {
        const namesInPath = p._personaSet || getPathPersonaNames(p);
        return !payload.excludedPersonas.some(name => namesInPath.has(name));
      });
    }

    const newUniquePaths = [];
    for (const p of pathsAtDepth) {
      const names = p._personaSet || getPathPersonaNames(p);
      const key = [...names].sort().join(',');
      if (!seenPathKeys.has(key)) {
        seenPathKeys.add(key);
        newUniquePaths.push(addPathMetadata(p));
      }
    }

    newUniquePaths.sort((a, b) => comparePaths(a, b, payload.currentLevel));
    sendProgress(depth, newUniquePaths);

    if (seenPathKeys.size >= MAX_UNIQUE_PATHS) break;

    if (pathsAtDepth.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 5) break;
    } else {
      emptyStreak = 0;
    }
  }

  return { seenPathKeys };
}

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'cancel') {
    cancelled = true;
    return;
  }

  if (type === 'search') {
    cancelled = false;
    const { targetPersona, omittedCards } = payload;
    const allTargetSkills = payload.targetSkills || [];

    // Check for fusion recipes early
    const allRecipes = getAllRecipes(targetPersona);
    if (!allRecipes || allRecipes.length === 0) {
      self.postMessage({ type: 'error', payload: { message: `${targetPersona} has no fusion recipes. It can only be obtained via Shuffle Time or as a starting Persona.` } });
      return;
    }

    let inheritSkills = allTargetSkills;
    let cardInfo = null;

    if (allTargetSkills.length > 0) {
      const naturalSkills = Object.keys(personaData[targetPersona]?.skills || {});
      const splitResult = optimizeSkillSplit({
        personaName: targetPersona,
        targetSkills: allTargetSkills,
        naturalSkills,
        omittedCards: new Set(omittedCards || []),
        maxInheritedSlots: getMaxInheritedSkills(targetPersona),
        canInherit: (pn, sn) => canInherit(pn, sn),
        getSkillCard: (sn) => skillData[sn]?.weaponSource || '-',
        getSkillRank: (sn) => skillData[sn]?.rank || 99,
      });

      if (splitResult.error) {
        self.postMessage({ type: 'error', payload: { message: splitResult.error } });
        return;
      }

      inheritSkills = splitResult.inherit;
      cardInfo = {
        inherit: splitResult.inherit,
        card: splitResult.card,
        cardsNeeded: splitResult.cardsNeeded,
        inheritedFromCard: splitResult.inheritedFromCard,
        inheritedNoCard: splitResult.inheritedNoCard,
        naturalSkills: splitResult.naturalSkills,
        maxInheritedSlots: splitResult.maxInheritedSlots,
      };

      if (inheritSkills.length === 0) {
        // All skills are card-only — no fusion search needed
        self.postMessage({ type: 'progress', payload: { depth: 0, paths: [], cardInfo } });
        self.postMessage({ type: 'done' });
        return;
      }
    }

    const memo = {};
    const seenPathKeys = new Set();
    const result = runSearch(targetPersona, inheritSkills, cardInfo, payload, memo, seenPathKeys);

    if (!cancelled) {
      if (result && result.seenPathKeys.size === 0) {
        self.postMessage({ type: 'error', payload: { message: `No valid fusion paths found for ${targetPersona} with the selected skills. Try different skills or a different target persona.` } });
        return;
      }
      self.postMessage({ type: 'done' });
    }
  }
};
