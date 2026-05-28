import { searchTree, generateFusionTrees, getPathPersonaNames, addPathMetadata } from '../lib/FusionCalculator.js';
import { canInherit } from '../data/DataParser.js';

const MAX_DEPTH = 20;
const MAX_UNIQUE_PATHS = 200;
const MAX_SEARCH_TIME_MS = 3000;
let cancelled = false;

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'cancel') {
    cancelled = true;
    return;
  }

  if (type === 'search') {
    cancelled = false;
    const { targetPersona, targetSkills, requiredPersonas, excludedPersonas, customPersonaSkills } = payload;

    for (const skill of targetSkills) {
      if (!canInherit(targetPersona, skill)) {
        self.postMessage({ type: 'error', payload: { message: `${targetPersona} cannot inherit ${skill}.` } });
        return;
      }
    }

    const memo = {};
    const seenPathKeys = new Set();
    let emptyStreak = 0;
    const searchStartTime = performance.now();

    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
      if (cancelled) return;
      if (performance.now() - searchStartTime > MAX_SEARCH_TIME_MS) {
        self.postMessage({ type: 'progress', payload: { depth, paths: [] } });
        break;
      }

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

      const newUniquePaths = [];
      for (const p of pathsAtDepth) {
        const names = p._personaSet || getPathPersonaNames(p);
        const key = [...names].sort().join(',');
        if (!seenPathKeys.has(key)) {
          seenPathKeys.add(key);
          newUniquePaths.push(addPathMetadata(p));
        }
      }

      self.postMessage({ type: 'progress', payload: { depth, paths: newUniquePaths } });

      if (seenPathKeys.size >= MAX_UNIQUE_PATHS) break;

      if (pathsAtDepth.length === 0) {
        emptyStreak++;
        if (emptyStreak >= 5) break;
      } else {
        emptyStreak = 0;
      }
    }

    if (!cancelled) {
      self.postMessage({ type: 'done' });
    }
  }
};
