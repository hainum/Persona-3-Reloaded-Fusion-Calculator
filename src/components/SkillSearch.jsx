import { useState, useMemo, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function SkillSearch({ skillOptions, selectedSkills, onSelect, isFull }) {
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
            style={{ background: 'transparent', border: 'none', padding: '0', flex: 1, color: 'var(--p3r-text-muted)', outline: 'none', cursor: 'not-allowed', fontSize: '0.85rem' }}
          />
        </div>
      ) : (
        <div className="input-wrapper">
          <Search size={14} style={{ color: 'var(--p3r-text-muted)', marginRight: '8px', flexShrink: 0 }} />
          <input
            type="text"
            style={{ fontSize: '0.85rem' }}
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
