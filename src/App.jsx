import React, { useState, useMemo, useEffect, useRef } from 'react';
import SearchableSelect from './components/SearchableSelect';
import FusionPathViewer from './components/FusionPathViewer';
import { personaData, skillData, isSkillInheritable } from './data/DataParser';
import { findFusionPaths } from './lib/FusionCalculator';
import { Settings, Zap, Search, X } from 'lucide-react';

export default function App() {
  const [targetPersona, setTargetPersona] = useState('');
  const [targetSkills, setTargetSkills] = useState(['', '', '', '', '', '', '', '']);
  const [paths, setPaths] = useState(null);
  const [error, setError] = useState(null);
  const [searchDepth, setSearchDepth] = useState(2);
  const [isCalculating, setIsCalculating] = useState(false);
  const [requiredPersonas, setRequiredPersonas] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(() => {
    const saved = localStorage.getItem('p3r_currentLevel');
    return saved ? parseInt(saved, 10) : 99;
  });

  useEffect(() => {
    localStorage.setItem('p3r_currentLevel', currentLevel);
  }, [currentLevel]);

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

  const handleCalculate = (depth = 2) => {
    if (!targetPersona) return;
    setIsCalculating(true);
    setError(null);
    setSearchDepth(depth);
    
    // Simulate async calculation to avoid blocking UI immediately
    setTimeout(() => {
      const activeSkills = targetSkills.filter(s => s !== '');
      const result = findFusionPaths(targetPersona, activeSkills, depth, currentLevel, requiredPersonas.length > 0 ? requiredPersonas : null);
      
      if (result.error) {
        setError(result.error);
        setPaths(null);
      } else {
        setPaths(result.paths);
      }
      setIsCalculating(false);
    }, 100);
  };

  return (
    <div className="container flex-col gap-6">
      <header className="flex justify-between items-center glass-panel" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}><Zap size={28} className="text-cyan" style={{ verticalAlign: 'middle', marginRight: '10px' }}/>P3R Fusion Calculator</h1>
          <p className="text-muted" style={{ margin: 0 }}>Discover the shortest paths to fuse your perfect Persona.</p>
        </div>
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
          <button className="flex items-center gap-2"><Settings size={18} /> Settings</button>
        </div>
      </header>

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
            className="primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            onClick={() => handleCalculate(2)}
            disabled={!targetPersona || isCalculating}
          >
            {isCalculating ? 'Calculating...' : 'Calculate Paths'}
          </button>
        </aside>

        <main className="glass-panel" style={{ minHeight: '500px' }}>
          <h2>Fusion Paths</h2>
          
          {error && (
            <div style={{ background: 'rgba(255, 50, 50, 0.2)', padding: '15px', borderRadius: '8px', border: '1px solid #ff4444', color: '#ffaaaa' }}>
              <strong>Error: </strong> {error}
            </div>
          )}

          {!error && !paths && !isCalculating && (
            <div className="text-muted" style={{ textAlign: 'center', marginTop: '4rem' }}>
              Select a Target Persona and desired skills, then click Calculate to see fusion paths.
            </div>
          )}

          {isCalculating && (
            <div className="text-cyan" style={{ textAlign: 'center', marginTop: '4rem' }}>
              Searching the Sea of Souls... (Depth {searchDepth})
            </div>
          )}

          {paths && paths.length === 0 && !isCalculating && (
            <div className="text-muted" style={{ textAlign: 'center', marginTop: '4rem' }}>
              No paths found within depth {searchDepth}. <br/><br/>
              <button onClick={() => handleCalculate(searchDepth + 1)}>See More (Increase Depth)</button>
            </div>
          )}

          {paths && paths.length > 0 && !isCalculating && (
            <div>
              <p className="text-cyan">Found {paths.length} valid paths.</p>
              
              <FusionPathViewer paths={paths} />

              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                 <button onClick={() => handleCalculate(searchDepth + 1)}>See Deeper Paths</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function RequiredPersonaSearch({ personaOptions, excludeNames, onSelect }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

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

  const handleSelect = (val) => {
    onSelect(val);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px 12px' }}>
        <Search size={14} style={{ color: 'var(--p3r-text-muted)', marginRight: '8px', flexShrink: 0 }} />
        <input 
          type="text"
          placeholder="Search persona to add..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (search.trim()) setIsOpen(true); }}
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
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map(opt => (
              <li 
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
