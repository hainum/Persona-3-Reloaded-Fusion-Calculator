import { useMemo, useEffect, useRef, useDeferredValue, useReducer } from 'react';
import FusionPathViewer from './FusionPathViewer';
import { Bookmark, X } from 'lucide-react';
import { findMatchingBookmark } from '../lib/BookmarkManager';

function sortPaths(pathsList, level) {
  return [...pathsList].sort((a, b) => {
    const aPossible = a._maxLevel <= level;
    const bPossible = b._maxLevel <= level;
    if (aPossible && !bPossible) return -1;
    if (!aPossible && bPossible) return 1;
    if (a._nodeCount !== b._nodeCount) return a._nodeCount - b._nodeCount;
    if (a._maxLevel !== b._maxLevel) return a._maxLevel - b._maxLevel;
    if (a._usesCustomSkills && !b._usesCustomSkills) return -1;
    if (!a._usesCustomSkills && b._usesCustomSkills) return 1;
    return 0;
  });
}

const initialState = { paths: null, isCalculating: false, currentSearchDepth: 0, error: null };

function searchReducer(state, action) {
  switch (action.type) {
    case 'start':
      return { ...initialState, isCalculating: true };
    case 'progress':
      return {
        ...state,
        paths: state.paths ? [...state.paths, ...action.paths] : [...action.paths],
        currentSearchDepth: action.depth,
      };
    case 'done':
      return { ...state, paths: state.paths ?? [], isCalculating: false };
    case 'error':
      return { ...state, paths: null, error: action.message, isCalculating: false };
    default:
      return state;
  }
}

export default function SearchResultsPanel(props) {
  const {
    searchKey, targetPersona, targetSkills, requiredPersonas,
    excludedPersonas, currentLevel, bookmarks, onDeleteBookmark, onAddExcludedPersona
  } = props;

  const workerRef = useRef(null);
  const workerHealthyRef = useRef(true);
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; });
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const { paths, isCalculating, currentSearchDepth, error } = state;

  const createWorker = () => {
    const w = new Worker(new URL('../workers/fusionSearch.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'progress') {
        dispatch({ type: 'progress', paths: payload.paths, depth: payload.depth });
      } else if (type === 'done') {
        dispatch({ type: 'done' });
      } else if (type === 'error') {
        dispatch({ type: 'error', message: payload.message });
      }
    };
    w.onerror = () => {
      workerHealthyRef.current = false;
      dispatch({ type: 'error', message: 'Worker encountered an error. Please try again.' });
    };
    return w;
  };

  useEffect(() => {
    if (!workerRef.current || !workerHealthyRef.current) {
      if (workerRef.current) workerRef.current.terminate();
      workerRef.current = createWorker();
      workerHealthyRef.current = true;
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const cancelSearch = () => {
    const w = workerRef.current;
    if (w && workerHealthyRef.current) {
      w.postMessage({ type: 'cancel' });
    }
  };

  useEffect(() => {
    if (searchKey === 0) return;

    cancelSearch();
    dispatch({ type: 'start' });

    if (!workerRef.current || !workerHealthyRef.current) {
      if (workerRef.current) workerRef.current.terminate();
      workerRef.current = createWorker();
      workerHealthyRef.current = true;
    }
    const w = workerRef.current;
    const p = propsRef.current;
    w.postMessage({
      type: 'search',
      payload: {
        targetPersona: p.targetPersona,
        targetSkills: p.targetSkills,
        currentLevel: p.currentLevel,
        requiredPersonas: p.requiredPersonas.length > 0 ? p.requiredPersonas : null,
        excludedPersonas: p.excludedPersonas.length > 0 ? p.excludedPersonas : null,
        customPersonaSkills: Object.keys(p.customPersonas).length > 0 ? p.customPersonas : null,
      }
    });
  }, [searchKey]);

  const deferredPaths = useDeferredValue(paths);
  const sortedPaths = useMemo(() => {
    return deferredPaths ? sortPaths(deferredPaths, currentLevel) : null;
  }, [deferredPaths, currentLevel]);

  const pageState = useMemo(() => {
    if (isCalculating) return 'searching';
    if (sortedPaths && sortedPaths.length === 0) return 'no-paths';
    if (sortedPaths && sortedPaths.length > 0) return 'results';
    return 'idle';
  }, [isCalculating, sortedPaths]);

  const matchingBookmark = useMemo(() => {
    return findMatchingBookmark({ targetPersona, targetSkills, requiredPersonas }, bookmarks);
  }, [targetPersona, targetSkills, requiredPersonas, bookmarks]);

  return (
    <main className="glass-panel" style={{ minHeight: '500px' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Fusion Paths</h2>
        {matchingBookmark && (
          <span className="bookmark-tag">
            <Bookmark size={14} /> {matchingBookmark.name}
            <span
              className="del"
              onClick={() => onDeleteBookmark(matchingBookmark.id)}
              title="Delete bookmark"
            >
              <X size={14} />
            </span>
          </span>
        )}
      </div>

      {error && (
        <div className="anim-fade-slide-down" style={{ background: 'rgba(255, 50, 50, 0.2)', padding: '15px', borderRadius: '8px', border: '1px solid #ff4444', color: '#ffaaaa' }}>
          <strong>Error: </strong> {error}
        </div>
      )}

      <div key={pageState} className="anim-fade-up">
        {pageState === 'idle' && (
          <div className="text-muted" style={{ textAlign: 'center', marginTop: '4rem' }}>
            Select a Target Persona and desired skills to see fusion paths.
          </div>
        )}
        {pageState === 'searching' && (
          <div className="text-cyan" style={{ textAlign: 'center', marginTop: '4rem' }}>
            Searching the Sea of Souls...
            {currentSearchDepth > 0 && ` (Depth ${currentSearchDepth})`}
            {sortedPaths && <span> Found {sortedPaths.length} paths so far...</span>}
          </div>
        )}
        {pageState === 'no-paths' && (
          <div className="text-muted" style={{ textAlign: 'center', marginTop: '4rem' }}>
            No valid paths found. Try different skills or a different target persona.
          </div>
        )}
        {pageState === 'results' && (
          <div>
            {!isCalculating && sortedPaths && <p className="text-cyan">Found {sortedPaths.length} valid paths.</p>}
            <FusionPathViewer paths={sortedPaths} excludedPersonas={excludedPersonas} onExcludePersona={onAddExcludedPersona} />
          </div>
        )}
      </div>
    </main>
  );
}
