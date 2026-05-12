import { searchTree, generateFusionTrees, getPathPersonaNames, getPathMaxLevel, getPathNodeCount } from '../lib/FusionCalculator.js';
import { canInherit } from '../data/DataParser.js';

const MAX_DEPTH = 20;
let cancelled = false;

function addPathMetadata(path) {
  path._maxLevel = getPathMaxLevel(path);
  path._nodeCount = getPathNodeCount(path);
  return path;
}

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'cancel') {
    cancelled = true;
    return;
  }

  if (type === 'search') {
    cancelled = false;
    const { targetPersona, targetSkills, requiredPersonas } = payload;

    for (const skill of targetSkills) {
      if (!canInherit(targetPersona, skill)) {
        self.postMessage({ type: 'error', payload: { message: `${targetPersona} cannot inherit ${skill}.` } });
        return;
      }
    }

    const memo = {};
    const seenPathKeys = new Set();
    let emptyStreak = 0;

    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
      if (cancelled) return;

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

      const newUniquePaths = [];
      for (const p of pathsAtDepth) {
        const key = JSON.stringify([...getPathPersonaNames(p)].sort());
        if (!seenPathKeys.has(key)) {
          seenPathKeys.add(key);
          newUniquePaths.push(addPathMetadata(p));
        }
      }

      if (newUniquePaths.length > 0) {
        self.postMessage({ type: 'progress', payload: { depth, paths: newUniquePaths } });
      }

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
