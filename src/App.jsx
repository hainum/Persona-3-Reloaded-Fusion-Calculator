import { useState, useMemo, useEffect, useRef } from 'react';
import SearchableSelect from './components/SearchableSelect';
import FusionPathViewer from './components/FusionPathViewer';
import PersonaDatabase from './components/PersonaDatabase';
import BookmarkDrawer from './components/BookmarkDrawer';
import { SaveBookmarkModal } from './components/BookmarkModal';
import CustomPersonaModal from './components/CustomPersonaModal';
import { personaData, skillData, isSkillInheritable, canInherit } from './data/DataParser';
import { loadBookmarks, saveBookmarks, createBookmark, findMatchingBookmark } from './lib/BookmarkManager';
import { getMaxInheritedSkills } from './lib/FusionCalculator';
import { Zap, Search, X, Calculator, Database, Bookmark, BookmarkPlus, AlertTriangle } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('calculator');
  const [targetPersona, setTargetPersona] = useState('');
  const [targetSkills, setTargetSkills] = useState([]);
  const [paths, setPaths] = useState(null);
  const [error, setError] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentSearchDepth, setCurrentSearchDepth] = useState(0);
  const [requiredPersonas, setRequiredPersonas] = useState([]);
  const [excludedPersonas, setExcludedPersonas] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(() => {
    const saved = localStorage.getItem('p3r_currentLevel');
    return saved ? parseInt(saved, 10) : 99;
  });
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [customPersonas, setCustomPersonas] = useState(() => {
    try {
      const saved = localStorage.getItem('p3r_custom_personas');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [customPersonaModal, setCustomPersonaModal] = useState(null); // { persona?, skills? } or null
  const [bookmarkDrawerOpen, setBookmarkDrawerOpen] = useState(false);
  const [saveBookmarkConfig, setSaveBookmarkConfig] = useState(null);
  const workerRef = useRef(null);
  const workerHealthyRef = useRef(true);
  const currentLevelRef = useRef(currentLevel);
  const searchTimeoutRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [levelText, setLevelText] = useState(String(currentLevel));

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    currentLevelRef.current = currentLevel;
    localStorage.setItem('p3r_currentLevel', currentLevel);
  }, [currentLevel]);

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'p3r_bookmarks') {
        setBookmarks(loadBookmarks());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    localStorage.setItem('p3r_custom_personas', JSON.stringify(customPersonas));
  }, [customPersonas]);

  const sortPaths = (pathsList, level) => {
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
  };

  const createWorker = () => {
    const w = new Worker(new URL('./workers/fusionSearch.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'progress') {
        setPaths(prev => prev ? [...prev, ...payload.paths] : [...payload.paths]);
        setCurrentSearchDepth(payload.depth);
      } else if (type === 'depth_start') {
        setCurrentSearchDepth(payload.depth);
      } else if (type === 'done') {
        setPaths(prev => prev ?? []);
        setIsCalculating(false);
      } else if (type === 'error') {
        setPaths(null);
        setError(payload.message);
        setIsCalculating(false);
      }
    };
    w.onerror = () => {
      workerHealthyRef.current = false;
      setPaths(null);
      setIsCalculating(false);
      setError('Worker encountered an error. Please try again.');
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

  const matchingBookmark = useMemo(() => {
    if (view !== 'calculator') return null;
    return findMatchingBookmark({ targetPersona, targetSkills, requiredPersonas }, bookmarks);
  }, [view, targetPersona, targetSkills, requiredPersonas, bookmarks]);

  const handleSaveBookmark = (config) => {
    const bookmark = createBookmark(config);
    setBookmarks(prev => [...prev, bookmark]);
  };

  const handleDeleteBookmark = (id) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const handleAddSkillToBookmark = (bookmarkId, skillName) => {
    setBookmarks(prev => prev.map(b => {
      if (b.id !== bookmarkId) return b;
      if (b.targetSkills.includes(skillName)) return b;
      if (b.targetPersona && !canInherit(b.targetPersona, skillName)) return b;
      if (b.targetPersona && b.targetSkills.length >= getMaxInheritedSkills(b.targetPersona)) return b;
      return { ...b, targetSkills: [...b.targetSkills, skillName] };
    }));
  };

  const handleLoadBookmark = (b) => {
    cancelSearch();
    setView('calculator');
    setTargetPersona(b.targetPersona);
    setTargetSkills([...b.targetSkills]);
    setRequiredPersonas(b.requiredPersonas);
    setPaths(null);
    setError(null);
  };

  const sortedPaths = useMemo(() => {
    return paths ? sortPaths(paths, currentLevel) : null;
  }, [paths, currentLevel]);

  const pageState = useMemo(() => {
    if (isCalculating) return 'searching';
    if (sortedPaths && sortedPaths.length === 0) return 'no-paths';
    if (sortedPaths && sortedPaths.length > 0) return 'results';
    return 'idle';
  }, [isCalculating, sortedPaths]);



  const personaOptions = useMemo(() => {
    return Object.keys(personaData).sort().map(name => ({
      value: name,
      label: `${name} (Lv ${personaData[name].lvl} ${personaData[name].race})`
    }));
  }, []);

  const skillOptions = useMemo(() => {
    return Object.keys(skillData)
      .filter(name => isSkillInheritable(name))
      .sort()
      .map(name => ({
        value: name,
        label: `${name} (${skillData[name].elem})`
      }));
  }, []);

  const incompatibleSkills = useMemo(() => {
    if (!targetPersona) return [];
    return targetSkills.filter(s => !canInherit(targetPersona, s));
  }, [targetPersona, targetSkills]);

  const handleAddSkill = (name) => {
    if (!name || targetSkills.includes(name)) return;
    if (targetPersona && targetSkills.length >= getMaxInheritedSkills(targetPersona)) return;
    setTargetSkills(prev => [...prev, name]);
  };

  const handleRemoveSkill = (name) => {
    setTargetSkills(prev => prev.filter(s => s !== name));
  };

  const handleAddRequiredPersona = (name) => {
    if (name && !requiredPersonas.includes(name)) {
      setRequiredPersonas([...requiredPersonas, name]);
    }
  };

  const handleRemoveRequiredPersona = (name) => {
    setRequiredPersonas(requiredPersonas.filter(p => p !== name));
  };

  const handleAddExcludedPersona = (name) => {
    if (name && !excludedPersonas.includes(name) && name !== targetPersona) {
      setExcludedPersonas([...excludedPersonas, name]);
    }
  };

  const handleRemoveExcludedPersona = (name) => {
    setExcludedPersonas(excludedPersonas.filter(p => p !== name));
  };

  const handleClearExcludedPersonas = () => {
    setExcludedPersonas([]);
  };

  const handleSaveCustomPersona = (name, skills) => {
    setCustomPersonas(prev => ({ ...prev, [name]: skills }));
  };

  const handleDeleteCustomPersona = (name) => {
    setCustomPersonas(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const cancelSearch = () => {
    const w = workerRef.current;
    if (w && workerHealthyRef.current) {
      w.postMessage({ type: 'cancel' });
    }
  };

  useEffect(() => {
    if (view !== 'calculator') {
      cancelSearch();
    }
  }, [view]);

  const handleCalculate = () => {
    if (!targetPersona) {
      cancelSearch();
      setPaths(null);
      setError(null);
      setCurrentSearchDepth(0);
      setIsCalculating(false);
      return;
    }
    cancelSearch();
    setPaths(null);
    setError(null);
    setCurrentSearchDepth(0);
    setIsCalculating(true);

    if (!workerRef.current || !workerHealthyRef.current) {
      if (workerRef.current) workerRef.current.terminate();
      workerRef.current = createWorker();
      workerHealthyRef.current = true;
    }
    const w = workerRef.current;
    const activeSkills = targetSkills;
    w.postMessage({
      type: 'search',
      payload: {
        targetPersona,
        targetSkills: activeSkills,
        currentLevel,
        requiredPersonas: requiredPersonas.length > 0 ? requiredPersonas : null,
        excludedPersonas: excludedPersonas.length > 0 ? excludedPersonas : null,
        customPersonaSkills: Object.keys(customPersonas).length > 0 ? customPersonas : null,
      }
    });
  };

  const handleCalculateRef = useRef(handleCalculate);
  useEffect(() => {
    handleCalculateRef.current = handleCalculate;
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      handleCalculateRef.current();
    }, 200);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [targetPersona, targetSkills, requiredPersonas, customPersonas, excludedPersonas]);

  return (
    <>
      <div className={`compact-toolbar ${isScrolled ? 'visible' : ''}`}>
        <div className="container" style={{ padding: '0 2rem' }}>
          <div className="flex items-center" style={{ height: '48px' }}>
            <Zap size={20} className="text-cyan" style={{ marginRight: '20px', flexShrink: 0 }} />
            <nav className="flex" style={{ flex: 1, alignSelf: 'stretch' }}>
              <button
                className={`nav-tab ${view === 'calculator' ? 'active' : ''}`}
                onClick={() => setView('calculator')}
              >
                <Calculator size={16} /> Calculator
              </button>
              <button
                className={`nav-tab ${view === 'database' ? 'active' : ''}`}
                onClick={() => setView('database')}
              >
                <Database size={16} /> Database
              </button>
              <button
                className="nav-tab"
                onClick={() => setBookmarkDrawerOpen(true)}
                style={{ marginLeft: 'auto' }}
              >
                <Bookmark size={16} /> Bookmarks ({bookmarks.length})
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="container flex-col gap-6" style={{ paddingTop: isScrolled ? 'calc(48px + 2.5rem)' : '2.5rem' }}>
        <header className="glass-panel" style={{ padding: '0', marginBottom: '1rem' }}>
          <div className="flex justify-between items-center" style={{ padding: '20px 24px 0' }}>
            <div>
              <h1 style={{ marginBottom: '0.25rem' }}><Zap size={28} className="text-cyan" style={{ verticalAlign: 'middle', marginRight: '10px' }}/>P3R Fusion Calculator</h1>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Persona 3 Reload — Fusion Tool & Database</p>
            </div>
            {view === 'calculator' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '5px 10px' }}>
                  <span style={{ marginRight: '10px', color: 'var(--p3r-text-muted)', fontSize: '0.9rem' }}>Current Level</span>
                  <button
                    className="level-btn"
                    onClick={() => { const n = Math.max(1, currentLevel - 1); setCurrentLevel(n); setLevelText(String(n)); }}
                  >-</button>
                  <input
                    type="number"
                    value={levelText}
                    onChange={(e) => {
                      setLevelText(e.target.value);
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= 99) {
                        setCurrentLevel(val);
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(levelText);
                      if (isNaN(val) || val < 1) {
                        const clamped = 1;
                        setLevelText(String(clamped));
                        setCurrentLevel(clamped);
                      } else if (val > 99) {
                        setLevelText('99');
                        setCurrentLevel(99);
                      } else {
                        setLevelText(String(currentLevel));
                      }
                    }}
                    style={{ width: '50px', textAlign: 'center', border: 'none', background: 'transparent', padding: '0', margin: '0 5px' }}
                    min="1" max="99"
                  />
                  <button
                    className="level-btn"
                    onClick={() => { const n = Math.min(99, currentLevel + 1); setCurrentLevel(n); setLevelText(String(n)); }}
                  >+</button>
                </div>
              </div>
            )}
          </div>
          <nav className="flex" style={{ borderTop: '1px solid var(--glass-border)', marginTop: '16px', padding: '0 24px' }}>
            <button
              className={`nav-tab ${view === 'calculator' ? 'active' : ''}`}
              onClick={() => setView('calculator')}
            >
              <Calculator size={16} /> Calculator
            </button>
            <button
              className={`nav-tab ${view === 'database' ? 'active' : ''}`}
              onClick={() => setView('database')}
            >
              <Database size={16} /> Database
            </button>
            <button
              className="nav-tab"
              onClick={() => setBookmarkDrawerOpen(true)}
              style={{ marginLeft: 'auto' }}
            >
              <Bookmark size={16} /> Bookmarks ({bookmarks.length})
            </button>
          </nav>
        </header>

      {view === 'calculator' ? (
        <div className="app-layout">
          <aside className="glass-panel flex-col gap-4">
            <h2>Configuration</h2>
            
            <SearchableSelect 
              label="Target Persona"
              placeholder="Select Persona..."
              options={personaOptions}
              value={targetPersona}
              onChange={setTargetPersona}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Target Skills</h3>
                {targetPersona && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--p3r-text-muted)' }}>
                    {targetSkills.length}/{getMaxInheritedSkills(targetPersona)} skills
                  </span>
                )}
              </div>
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Search and select skills to inherit on the final persona.</span>
              {targetSkills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {targetSkills.map(name => (
                    <span
                      key={name}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: incompatibleSkills.includes(name)
                          ? 'rgba(255, 193, 7, 0.15)'
                          : 'rgba(0, 229, 255, 0.15)',
                        border: incompatibleSkills.includes(name)
                          ? '1px solid rgba(255, 193, 7, 0.3)'
                          : '1px solid rgba(0, 229, 255, 0.3)',
                        borderRadius: '4px', padding: '3px 8px', fontSize: '0.85rem',
                        color: incompatibleSkills.includes(name) ? '#ffd54f' : 'var(--p3r-cyan)'
                      }}
                    >
                      {name}
                      <X
                        size={14}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                        onClick={() => handleRemoveSkill(name)}
                      />
                    </span>
                  ))}
                </div>
              )}
              <SkillSearch
                skillOptions={skillOptions}
                selectedSkills={targetSkills}
                onSelect={handleAddSkill}
                isFull={targetPersona ? targetSkills.length >= getMaxInheritedSkills(targetPersona) : false}
              />
              {incompatibleSkills.length > 0 && (
                <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(255, 193, 7, 0.15)', border: '1px solid rgba(255, 193, 7, 0.3)', borderRadius: '6px', fontSize: '0.8rem', color: '#ffd54f' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  <strong>Inheritance conflict:</strong> {targetPersona} cannot inherit {incompatibleSkills.join(', ')} via fusion &mdash; use Skill Cards instead.
                </div>
              )}
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Include Personas</h3>
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Only show paths containing these Personas.</span>
              
              {requiredPersonas.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {requiredPersonas.map(name => (
                    <span 
                      key={name} 
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(0, 229, 255, 0.15)', border: '1px solid rgba(0, 229, 255, 0.3)',
                        borderRadius: '4px', padding: '3px 8px', fontSize: '0.85rem',
                        color: 'var(--p3r-cyan)'
                      }}
                    >
                      {name}
                      <X 
                        size={14} 
                        style={{ cursor: 'pointer', opacity: 0.7 }} 
                        onClick={() => handleRemoveRequiredPersona(name)} 
                      />
                    </span>
                  ))}
                </div>
              )}

              <RequiredPersonaSearch 
                personaOptions={personaOptions} 
                excludeNames={requiredPersonas}
                onSelect={handleAddRequiredPersona} 
              />
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Exclude Personas</h3>
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Hide paths containing these Personas.</span>

              {excludedPersonas.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {excludedPersonas.map(name => (
                    <span
                      key={name}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(255, 80, 80, 0.15)', border: '1px solid rgba(255, 80, 80, 0.3)',
                        borderRadius: '4px', padding: '3px 8px', fontSize: '0.85rem',
                        color: '#ff7777'
                      }}
                    >
                      {name}
                      <X
                        size={14}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                        onClick={() => handleRemoveExcludedPersona(name)}
                      />
                    </span>
                  ))}
                </div>
              )}

              {excludedPersonas.length > 0 && (
                <button
                  className="btn-danger"
                  onClick={handleClearExcludedPersonas}
                  style={{ fontSize: '0.85rem', padding: '4px 10px', marginBottom: '8px' }}
                >
                  Clear All
                </button>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Custom Personas</h3>
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>
                Define personas with extra skills for inheritance.
              </span>

              {Object.keys(customPersonas).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {Object.entries(customPersonas).map(([name, skills]) => (
                    <span
                      key={name}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(0, 229, 255, 0.15)', border: '1px solid rgba(0, 229, 255, 0.3)',
                        borderRadius: '4px', padding: '3px 8px', fontSize: '0.85rem',
                        color: 'var(--p3r-cyan)', cursor: 'pointer'
                      }}
                      onClick={() => setCustomPersonaModal({ persona: name, skills })}
                    >
                      {name} ({skills.length})
                      <X
                        size={14}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteCustomPersona(name); }}
                      />
                    </span>
                  ))}
                </div>
              )}

            <button
              className="btn-outline"
              onClick={() => setCustomPersonaModal({ persona: null, skills: [] })}
              style={{ width: '100%', padding: '10px 16px', textTransform: 'none', letterSpacing: 'normal', fontSize: '0.9rem' }}
            >
              + Add Custom Persona
            </button>
            </div>

            <button
              className="btn-outline flex items-center justify-between"
              style={{ width: '100%', padding: '10px 16px', textTransform: 'none', letterSpacing: 'normal', fontSize: '0.9rem', gap: '6px', justifyContent: 'center', marginTop: '0.5rem' }}
              onClick={() => setSaveBookmarkConfig({ initialPersona: targetPersona, initialSkills: targetSkills, initialRequiredPersonas: requiredPersonas })}
              disabled={!targetPersona}
            >
              <BookmarkPlus size={16} /> Save as Bookmark
            </button>
          </aside>

          <main className="glass-panel" style={{ minHeight: '500px' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Fusion Paths</h2>
              {matchingBookmark && (
                <span className="bookmark-tag">
                  <Bookmark size={14} /> {matchingBookmark.name}
                  <span
                    className="del"
                    onClick={() => handleDeleteBookmark(matchingBookmark.id)}
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
                  <FusionPathViewer paths={sortedPaths} excludedPersonas={excludedPersonas} onExcludePersona={handleAddExcludedPersona} />
                </div>
              )}
            </div>
          </main>
        </div>
      ) : (
        <PersonaDatabase
          bookmarks={bookmarks}
          personaOptions={personaOptions}
          skillOptions={skillOptions}
          onSaveBookmark={handleSaveBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onAddSkillToBookmark={handleAddSkillToBookmark}
        />
      )}

      <BookmarkDrawer
        bookmarks={bookmarks}
        isOpen={bookmarkDrawerOpen}
        onClose={() => setBookmarkDrawerOpen(false)}
        onLoad={handleLoadBookmark}
        onDelete={handleDeleteBookmark}
      />

      {saveBookmarkConfig && (
        <SaveBookmarkModal
          {...saveBookmarkConfig}
          personaOptions={personaOptions}
          skillOptions={skillOptions}
          onSave={handleSaveBookmark}
          onClose={() => setSaveBookmarkConfig(null)}
        />
      )}
      {customPersonaModal && (
        <CustomPersonaModal
          personaOptions={personaOptions}
          skillOptions={skillOptions}
          initialPersona={customPersonaModal.persona}
          initialSkills={customPersonaModal.skills}
          onSave={handleSaveCustomPersona}
          onClose={() => setCustomPersonaModal(null)}
        />
      )}
    </div>
    </>        
  );
}

function RequiredPersonaSearch({ personaOptions, excludeNames, onSelect }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    return personaOptions
      .filter(opt => !excludeNames.includes(opt.value))
      .filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 8);
  }, [search, personaOptions, excludeNames]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = (val) => {
    onSelect(val);
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div className="input-wrapper">
        <Search size={14} style={{ color: 'var(--p3r-text-muted)', marginRight: '8px', flexShrink: 0 }} />
        <input 
          type="text"
          placeholder="Search persona to add..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); setHighlightedIndex(-1); }}
          onFocus={() => { if (search.trim()) setIsOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && highlightedIndex >= 0) {
              e.preventDefault();
              handleSelect(filtered[highlightedIndex].value);
            } else if (e.key === 'Enter' && filtered.length === 1) {
              e.preventDefault();
              handleSelect(filtered[0].value);
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
        />
      </div>
      {isOpen && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: '4px', padding: '6px', maxHeight: '200px', overflowY: 'auto',
          background: 'rgba(10, 25, 47, 0.95)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)', borderRadius: '8px',
          boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.6)'
        }}>
          <ul ref={listRef} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map((opt, i) => (
              <li 
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(i)}
                style={{
                  padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem',
                  background: i === highlightedIndex ? 'rgba(0, 229, 255, 0.2)' : 'transparent'
                }}
                onMouseLeave={(e) => { if (i !== highlightedIndex) e.currentTarget.style.background = 'transparent'; }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SkillSearch({ skillOptions, selectedSkills, onSelect, isFull }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    return skillOptions
      .filter(opt => !selectedSkills.includes(opt.value))
      .filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 8);
  }, [search, skillOptions, selectedSkills]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = (val) => {
    onSelect(val);
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {isFull ? (
        <div className="input-wrapper" style={{ opacity: 0.5 }}>
          <Search size={14} style={{ color: 'var(--p3r-text-muted)', marginRight: '8px', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Max skills reached"
            disabled
            style={{ background: 'transparent', border: 'none', padding: '0', flex: 1, color: 'var(--p3r-text-muted)', outline: 'none', cursor: 'not-allowed' }}
          />
        </div>
      ) : (
        <div className="input-wrapper">
          <Search size={14} style={{ color: 'var(--p3r-text-muted)', marginRight: '8px', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search skill to add..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setIsOpen(true); setHighlightedIndex(-1); }}
            onFocus={() => { if (search.trim()) setIsOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex(i => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                handleSelect(filtered[highlightedIndex].value);
              } else if (e.key === 'Enter' && filtered.length === 1) {
                e.preventDefault();
                handleSelect(filtered[0].value);
              } else if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
          />
        </div>
      )}
      {isOpen && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: '4px', padding: '6px', maxHeight: '200px', overflowY: 'auto',
          background: 'rgba(10, 25, 47, 0.95)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)', borderRadius: '8px',
          boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.6)'
        }}>
          <ul ref={listRef} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map((opt, i) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(i)}
                style={{
                  padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem',
                  background: i === highlightedIndex ? 'rgba(0, 229, 255, 0.2)' : 'transparent'
                }}
                onMouseLeave={(e) => { if (i !== highlightedIndex) e.currentTarget.style.background = 'transparent'; }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
