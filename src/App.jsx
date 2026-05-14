import { useState, useMemo, useEffect, useRef } from 'react';
import SearchableSelect from './components/SearchableSelect';
import FusionPathViewer from './components/FusionPathViewer';
import PersonaDatabase from './components/PersonaDatabase';
import BookmarkDrawer from './components/BookmarkDrawer';
import { SaveBookmarkModal } from './components/BookmarkModal';
import CustomPersonaModal from './components/CustomPersonaModal';
import { personaData, skillData, isSkillInheritable } from './data/DataParser';
import { loadBookmarks, saveBookmarks, createBookmark, findMatchingBookmark } from './lib/BookmarkManager';
import { Zap, Search, X, Calculator, Database, Bookmark, BookmarkPlus } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('calculator');
  const [targetPersona, setTargetPersona] = useState('');
  const [targetSkills, setTargetSkills] = useState(['', '', '', '', '', '', '', '']);
  const [paths, setPaths] = useState(null);
  const [error, setError] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentSearchDepth, setCurrentSearchDepth] = useState(0);
  const [requiredPersonas, setRequiredPersonas] = useState([]);
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
    localStorage.setItem('p3r_custom_personas', JSON.stringify(customPersonas));
  }, [customPersonas]);

  const sortPaths = (pathsList, level) => {
    return [...pathsList].sort((a, b) => {
      const aPossible = a._maxLevel <= level;
      const bPossible = b._maxLevel <= level;
      if (aPossible && !bPossible) return -1;
      if (!aPossible && bPossible) return 1;
      if (a._nodeCount !== b._nodeCount) return a._nodeCount - b._nodeCount;
      return a._maxLevel - b._maxLevel;
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
    setBookmarks(prev => prev.map(b =>
      b.id === bookmarkId && !b.targetSkills.includes(skillName)
        ? { ...b, targetSkills: [...b.targetSkills, skillName] }
        : b
    ));
  };

  const handleLoadBookmark = (b) => {
    cancelSearch();
    setView('calculator');
    setTargetPersona(b.targetPersona);
    const skills = [...b.targetSkills];
    while (skills.length < 8) skills.push('');
    setTargetSkills(skills);
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

  const handleSkillChange = (index, value) => {
    const newSkills = [...targetSkills];
    newSkills[index] = value;
    setTargetSkills(newSkills);
  };

  const handleAddRequiredPersona = (name) => {
    if (name && !requiredPersonas.includes(name)) {
      setRequiredPersonas([...requiredPersonas, name]);
    }
  };

  const handleRemoveRequiredPersona = (name) => {
    setRequiredPersonas(requiredPersonas.filter(p => p !== name));
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
    const activeSkills = targetSkills.filter(s => s !== '');
    w.postMessage({
      type: 'search',
      payload: {
        targetPersona,
        targetSkills: activeSkills,
        currentLevel,
        requiredPersonas: requiredPersonas.length > 0 ? requiredPersonas : null,
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
  }, [targetPersona, targetSkills, requiredPersonas]);

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

      <div className="container flex-col gap-6" style={{ paddingTop: isScrolled ? 'calc(48px + 2rem)' : '2rem' }}>
        <header className="glass-panel" style={{ marginBottom: '2rem', padding: '0' }}>
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
                    style={{ padding: '2px 8px', minWidth: 'auto', border: 'none', background: 'transparent' }}
                    onClick={() => setCurrentLevel(Math.max(1, currentLevel - 1))}
                  >-</button>
                  <input 
                    type="number" 
                    value={currentLevel} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) setCurrentLevel(Math.min(99, Math.max(1, val)));
                    }}
                    style={{ width: '50px', textAlign: 'center', border: 'none', background: 'transparent', padding: '0', margin: '0 5px' }}
                    min="1" max="99"
                  />
                  <button 
                    style={{ padding: '2px 8px', minWidth: 'auto', border: 'none', background: 'transparent' }}
                    onClick={() => setCurrentLevel(Math.min(99, currentLevel + 1))}
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
        <div className="grid" style={{ gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
          <aside className="glass-panel flex-col gap-4">
            <h2>Configuration</h2>
            
            <SearchableSelect 
              label="Target Persona"
              placeholder="Select Persona..."
              options={personaOptions}
              value={targetPersona}
              onChange={setTargetPersona}
            />

            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Target Skills</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {targetSkills.map((skill, i) => (
                  <SearchableSelect 
                    key={i}
                    placeholder={`Skill ${i + 1}`}
                    options={[{value: '', label: 'None'}, ...skillOptions]}
                    value={skill}
                    onChange={(val) => handleSkillChange(i, val)}
                    noMargin={true}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
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

            <button
              className="flex items-center gap-2"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setSaveBookmarkConfig({ initialPersona: targetPersona, initialSkills: targetSkills.filter(Boolean), initialRequiredPersonas: requiredPersonas })}
              disabled={!targetPersona}
            >
              <BookmarkPlus size={16} /> Save as Bookmark
            </button>

            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
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
                className="icon-btn"
                onClick={() => setCustomPersonaModal({ persona: null, skills: [] })}
                style={{ width: '100%', fontSize: '0.85rem', padding: '6px 12px', border: '1px dashed var(--glass-border)' }}
              >
                + Add Custom Persona
              </button>
            </div>
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
                  <FusionPathViewer paths={sortedPaths} />
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
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px 12px' }}>
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
          style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', boxShadow: 'none' }}
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
