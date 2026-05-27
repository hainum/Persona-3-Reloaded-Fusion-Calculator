import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

export default function CustomPersonaModal({ personaOptions, skillOptions, initialPersona, initialSkills, onSave, onClose }) {
  const [personaName, setPersonaName] = useState(initialPersona || '');
  const [skills, setSkills] = useState(initialSkills || []);
  const [skillSearch, setSkillSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const filteredSkills = useMemo(() => {
    if (!skillSearch.trim()) return [];
    return skillOptions
      .filter(opt => !skills.includes(opt.value))
      .filter(opt => opt.label.toLowerCase().includes(skillSearch.toLowerCase()))
      .slice(0, 8);
  }, [skillSearch, skillOptions, skills]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const addSkill = (name) => {
    if (name && !skills.includes(name)) {
      setSkills([...skills, name]);
    }
    setSkillSearch('');
    setHighlightedIndex(-1);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removeSkill = (name) => {
    setSkills(skills.filter(s => s !== name));
  };

  const handleSave = () => {
    if (personaName && personaName !== '') {
      onSave(personaName, skills);
      onClose();
    }
  };

  return (
    <>
      <div className="modal-overlay open" onClick={onClose} />
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <h3 style={{ margin: '0 0 1rem' }}>{initialPersona ? 'Edit Custom Persona' : 'Add Custom Persona'}</h3>

        <SearchableSelect
          label="Persona"
          placeholder="Select Persona..."
          options={personaOptions}
          value={personaName}
          onChange={setPersonaName}
        />

        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem', fontFamily: 'var(--font-heading)', color: 'var(--p3r-white)', textShadow: '0 0 10px rgba(0, 229, 255, 0.3)' }}>Skills Known</label>

        {skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {skills.map(s => (
              <span key={s} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'rgba(0, 229, 255, 0.15)', border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '4px', padding: '3px 8px', fontSize: '0.85rem',
                color: 'var(--p3r-cyan)'
              }}>
                {s}
                <X size={14} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeSkill(s)} />
              </span>
            ))}
          </div>
        )}

        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <div className="input-wrapper">
            <Search size={14} style={{ color: 'var(--p3r-text-muted)', marginRight: '8px', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search skill to add..."
              value={skillSearch}
              onChange={(e) => { setSkillSearch(e.target.value); setIsOpen(true); setHighlightedIndex(-1); }}
              onFocus={() => { if (skillSearch.trim()) setIsOpen(true); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex(i => Math.min(i + 1, filteredSkills.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex(i => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                  e.preventDefault();
                  addSkill(filteredSkills[highlightedIndex].value);
                } else if (e.key === 'Enter' && filteredSkills.length === 1) {
                  e.preventDefault();
                  addSkill(filteredSkills[0].value);
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                } else if (e.key === 'Backspace' && skillSearch === '' && skills.length > 0) {
                  removeSkill(skills[skills.length - 1]);
                }
              }}
            />
          </div>
          {isOpen && filteredSkills.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              marginTop: '4px', padding: '6px', maxHeight: '200px', overflowY: 'auto',
              background: 'rgba(10, 25, 47, 0.95)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border)', borderRadius: '8px',
              boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.6)'
            }}>
              <ul ref={listRef} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filteredSkills.map((opt, i) => (
                  <li
                    key={opt.value}
                    onClick={() => addSkill(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    style={{
                      padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem',
                      background: i === highlightedIndex ? 'rgba(0, 229, 255, 0.2)' : 'transparent'
                    }}
                  >
                    {opt.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.9rem' }}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!personaName} style={{ fontSize: '0.9rem' }}>Save</button>
        </div>
      </div>
    </>
  );
}
