import { useMemo, useEffect, useRef, useDeferredValue, useReducer } from 'react';
import FusionPathViewer from './FusionPathViewer';
import { Bookmark, X } from 'lucide-react';
import { findMatchingBookmark } from '../lib/BookmarkManager';
import { sortPaths } from '../lib/FusionCalculator';

const initialState = { paths: null, isCalculating: false, currentSearchDepth: 0, error: null, cardInfo: null };

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
    case 'cardInfo':
      return { ...state, cardInfo: action.cardInfo };
    default:
      return state;
  }
}

export default function SearchResultsPanel(props) {
  const {
    searchKey, targetPersona, targetSkills, requiredPersonas,
    excludedPersonas, currentLevel, bookmarks, omittedCards,
    onToggleOmittedCard, onDeleteBookmark, onAddExcludedPersona
  } = props;

  const workerRef = useRef(null);
  const workerHealthyRef = useRef(true);
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; });
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const { paths, isCalculating, currentSearchDepth, error, cardInfo } = state;

  const createWorker = () => {
    const w = new Worker(new URL('../workers/fusionSearch.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'progress') {
        if (payload.cardInfo) {
          dispatch({ type: 'cardInfo', cardInfo: payload.cardInfo });
        }
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

    const p = propsRef.current;
    if (!p.targetPersona) {
      dispatch({ type: 'done' });
      return;
    }

    dispatch({ type: 'start' });

    if (!workerRef.current || !workerHealthyRef.current) {
      if (workerRef.current) workerRef.current.terminate();
      workerRef.current = createWorker();
      workerHealthyRef.current = true;
    }
    const w = workerRef.current;
    w.postMessage({
      type: 'search',
      payload: {
        targetPersona: p.targetPersona,
        targetSkills: p.targetSkills,
        currentLevel: p.currentLevel,
        requiredPersonas: p.requiredPersonas.length > 0 ? p.requiredPersonas : null,
        excludedPersonas: p.excludedPersonas.length > 0 ? p.excludedPersonas : null,
        customPersonaSkills: Object.keys(p.customPersonas).length > 0 ? p.customPersonas : null,
        omittedCards: [...p.omittedCards],
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

      {cardInfo && (cardInfo.card.length > 0 || cardInfo.inheritedFromCard.length > 0 || cardInfo.inheritedNoCard?.length > 0) && (
        <div className="anim-fade-slide-down" style={{
          background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)',
          borderRadius: '8px', padding: '16px', marginBottom: '16px'
        }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--p3r-cyan)' }}>
            Skill Plan
          </h3>
          {cardInfo.card.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                Teach these via card:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {cardInfo.card.map(skill => {
                  const entry = cardInfo.cardsNeeded.find(c => c.skill === skill);
                  const cardSrc = entry ? entry.card : '?';
                  const isOmitted = omittedCards.has(cardSrc);
                  return (
                    <div key={skill} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem',
                      background: isOmitted ? 'rgba(255, 193, 7, 0.1)' : 'transparent'
                    }}>
                      <span style={{ color: isOmitted ? '#ffd54f' : 'var(--p3r-white)' }}>{skill}</span>
                      <span style={{ color: 'var(--p3r-text-muted)' }}>{'\u2192'} {cardSrc}</span>
                      <button
                        onClick={() => onToggleOmittedCard(cardSrc)}
                        style={{
                          marginLeft: 'auto', padding: '2px 8px', fontSize: '0.75rem',
                          border: `1px solid ${isOmitted ? '#ffd54f' : 'var(--glass-border)'}`,
                          borderRadius: '4px', cursor: 'pointer',
                          background: isOmitted ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255,255,255,0.05)',
                          color: isOmitted ? '#ffd54f' : 'var(--p3r-text-muted)'
                        }}
                      >
                        {isOmitted ? 'have it' : "don't have"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {cardInfo.inheritedFromCard.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                Inherited (saving these cards):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {cardInfo.inheritedFromCard.map(({ skill, card }) => (
                  <div key={skill} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem',
                    color: '#4caf50'
                  }}>
                    <span>{skill}</span>
                    <span style={{ color: 'var(--p3r-text-muted)' }}>({card} card saved)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {cardInfo.inheritedNoCard?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                Inherited (no card source):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {cardInfo.inheritedNoCard.map(({ skill }) => (
                  <div key={skill} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem',
                    color: '#90caf9'
                  }}>
                    <span>{skill}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {cardInfo.naturalSkills?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                Already learned naturally (no action needed):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {cardInfo.naturalSkills.map(({ skill }) => (
                  <div key={skill} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem',
                    color: '#ce93d8'
                  }}>
                    <span>{skill}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {cardInfo.inherit.length > 0 && (
            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '8px' }}>
              {cardInfo.inherit.length} of {cardInfo.maxInheritedSlots ?? (cardInfo.inherit.length + cardInfo.card.length)} inheritance slots used
              {cardInfo.inherit.length >= (cardInfo.maxInheritedSlots ?? 99) && <span style={{ color: '#4caf50', marginLeft: '4px' }}>{'\u2713'}</span>}
            </div>
          )}
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
