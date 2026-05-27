import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export default function SearchableSelect({ label, options, value, onChange, placeholder, noMargin }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="searchable-select-wrapper" ref={wrapperRef} style={{ position: 'relative', width: '100%', marginBottom: noMargin ? '0' : '1rem' }}>
      {label && <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem', fontFamily: 'var(--font-heading)', color: 'var(--p3r-white)', textShadow: '0 0 10px rgba(0, 229, 255, 0.3)' }}>{label}</label>}
      <div 
        className="select-trigger"
        onClick={() => { setIsOpen(!isOpen); setHighlightedIndex(-1); }}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)',
          padding: '10px 14px', borderRadius: '6px', cursor: 'pointer'
        }}
      >
        <span style={{ color: selectedOption ? 'var(--p3r-white)' : 'var(--p3r-text-muted)' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} style={{ color: 'var(--p3r-cyan)' }} />
      </div>

      {isOpen && (
        <div 
          className="select-dropdown"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            marginTop: '4px', padding: '10px', maxHeight: '300px', overflowY: 'auto',
            background: 'rgba(10, 25, 47, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.6)'
          }}
        >
          <div className="input-wrapper" style={{ marginBottom: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '5px', borderRadius: 0, border: 'none', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'var(--glass-border)', padding: '4px 0 5px' }}>
            <Search size={16} style={{ color: 'var(--p3r-text-muted)', marginRight: '8px' }} />
              <input 
                autoFocus
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setHighlightedIndex(-1); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                    e.preventDefault();
                    handleSelect(filteredOptions[highlightedIndex].value);
                  } else if (e.key === 'Enter' && filteredOptions.length === 1) {
                    e.preventDefault();
                    handleSelect(filteredOptions[0].value);
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
              />
          </div>
          <ul ref={listRef} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredOptions.length > 0 ? filteredOptions.map((opt, i) => (
              <li 
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(i)}
                style={{
                  padding: '8px 10px', cursor: 'pointer', borderRadius: '4px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: i === highlightedIndex
                    ? 'rgba(0, 229, 255, 0.2)'
                    : opt.value === value
                      ? 'rgba(0, 229, 255, 0.1)'
                      : 'transparent'
                }}
                onMouseLeave={(e) => e.currentTarget.style.background = opt.value === value && i !== highlightedIndex ? 'rgba(0, 229, 255, 0.1)' : 'transparent'}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check size={16} style={{ color: 'var(--p3r-cyan)' }} />}
              </li>
            )) : (
              <li style={{ padding: '8px 10px', color: 'var(--p3r-text-muted)', textAlign: 'center' }}>No results found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
