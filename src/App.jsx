import { useState, useMemo, useEffect, useRef } from 'react';
import SearchableSelect from './components/SearchableSelect';
import SearchResultsPanel from './components/SearchResultsPanel';
import PersonaDatabase from './components/PersonaDatabase';
import BookmarkDrawer from './components/BookmarkDrawer';
import { SaveBookmarkModal } from './components/BookmarkModal';
import CustomPersonaModal from './components/CustomPersonaModal';
import SkillSearch from './components/SkillSearch';
import { personaData, skillData, isSkillInheritable, canInherit } from './data/DataParser';
import { loadBookmarks, saveBookmarks, createBookmark } from './lib/BookmarkManager';
import { Zap, Search, X, Calculator, Database, Bookmark, BookmarkPlus, AlertTriangle } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('calculator');
  const [targetPersona, setTargetPersona] = useState('');
  const [targetSkills, setTargetSkills] = useState([]);
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
  const [customPersonaModal, setCustomPersonaModal] = useState(null);
  const [bookmarkDrawerOpen, setBookmarkDrawerOpen] = useState(false);
  const [saveBookmarkConfig, setSaveBookmarkConfig] = useState(null);
  const [searchKey, setSearchKey] = useState(0);
  const [omittedCards, setOmittedCards] = useState(() => {
    try {
      const saved = localStorage.getItem('p3r_omitted_cards');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [isScrolled, setIsScrolled] = useState(false);
  const [levelText, setLevelText] = useState(String(currentLevel));
  const searchTimeoutRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    localStorage.setItem('p3r_currentLevel', currentLevel);
  }, [currentLevel]);

  useEffect(() => {
    localStorage.setItem('p3r_omitted_cards', JSON.stringify([...omittedCards]));
  }, [omittedCards]);

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
      const naturalSet = new Set(getNaturalSkills(b.targetPersona));
      const nonNaturalCount = b.targetSkills.filter(s => !naturalSet.has(s)).length;
      if (nonNaturalCount >= 8) return b;
      return { ...b, targetSkills: [...b.targetSkills, skillName] };
    }));
  };

  const getNaturalSkills = (personaName) => {
    const skills = personaData[personaName]?.skills;
    return skills ? Object.keys(skills) : [];
  };

  const handleLoadBookmark = (b) => {
    setView('calculator');
    setTargetPersona(b.targetPersona);
    const naturalSet = new Set(getNaturalSkills(b.targetPersona));
    const nonNatural = b.targetSkills.filter(s => !naturalSet.has(s));
    setTargetSkills([...nonNatural, ...getNaturalSkills(b.targetPersona)]);
    setRequiredPersonas(b.requiredPersonas);
  };



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
    if (targetSkills.length >= 8) return;
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
    setCustomPersonas(prev => ({ ...prev, [name]: skills.slice(0, 8) }));
  };

  const handleDeleteCustomPersona = (name) => {
    setCustomPersonas(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchKey(k => k + 1);
    }, 200);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [targetPersona, targetSkills, requiredPersonas, customPersonas, excludedPersonas, omittedCards]);

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
              noMargin
            />

            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Target Skills</h3>
                  {targetPersona && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--p3r-text-muted)' }}>
                    {targetSkills.length}/8 skills
                  </span>
                )}
              </div>
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Search and select skills to inherit on the final persona.</span>
              <SkillSearch
                skillOptions={skillOptions}
                selectedSkills={targetSkills}
                onSelect={handleAddSkill}
                isFull={targetSkills.length >= 8}
              />
              {targetSkills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
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
              {incompatibleSkills.length > 0 && (
                <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(255, 193, 7, 0.15)', border: '1px solid rgba(255, 193, 7, 0.3)', borderRadius: '6px', fontSize: '0.8rem', color: '#ffd54f' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  <strong>Inheritance conflict:</strong> {targetPersona} cannot inherit {incompatibleSkills.join(', ')} via fusion &mdash; use Skill Cards instead.
                </div>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Include Personas</h3>
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

            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Exclude Personas</h3>
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
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Custom Personas</h3>
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

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Omitted Cards ({omittedCards.size})</h3>
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>
                Skills whose cards you marked as "don't have".
              </span>
              {omittedCards.size > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                  {[...omittedCards].sort().map(skill => (
                    <div key={skill} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem',
                    }}>
                      <span style={{ color: '#ffd54f' }}>{skill}</span>
                      <button
                        onClick={() => {
                          setOmittedCards(prev => {
                            const next = new Set(prev);
                            next.delete(skill);
                            return next;
                          });
                        }}
                        style={{
                          marginLeft: 'auto', padding: '2px 8px', fontSize: '0.75rem',
                          border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer',
                          background: 'rgba(255,255,255,0.05)', color: 'var(--p3r-text-muted)'
                        }}
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {omittedCards.size > 0 && (
                <button
                  className="btn-danger"
                  onClick={() => setOmittedCards(new Set())}
                  style={{ fontSize: '0.85rem', padding: '4px 10px', marginBottom: '8px' }}
                >
                  Clear All
                </button>
              )}
              {omittedCards.size === 0 && (
                <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                  None omitted. Toggle cards in the Skill Plan to mark them as unavailable.
                </p>
              )}
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

            <SearchResultsPanel
            searchKey={searchKey}
            targetPersona={targetPersona}
            targetSkills={targetSkills}
            requiredPersonas={requiredPersonas}
            excludedPersonas={excludedPersonas}
            currentLevel={currentLevel}
            customPersonas={customPersonas}
            bookmarks={bookmarks}
            omittedCards={omittedCards}
            onToggleOmittedCard={(card) => {
              setOmittedCards(prev => {
                const next = new Set(prev);
                if (next.has(card)) next.delete(card);
                else next.add(card);
                return next;
              });
            }}
            onDeleteBookmark={handleDeleteBookmark}
            onAddExcludedPersona={handleAddExcludedPersona}
          />
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
          style={{ fontSize: '0.85rem' }}
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

