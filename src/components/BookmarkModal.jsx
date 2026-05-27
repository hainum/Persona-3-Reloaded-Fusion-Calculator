import { useState, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { generateBookmarkName } from '../lib/BookmarkManager';
import { canInherit, getMaxInheritedSkills } from '../data/DataParser';

export function SaveBookmarkModal({ initialPersona, initialSkills, initialRequiredPersonas, personaOptions, skillOptions, onSave, onClose }) {
  const [targetPersona, setTargetPersona] = useState(initialPersona || '');
  const [targetSkills, setTargetSkills] = useState(() => {
    const skills = [...(initialSkills || [])];
    while (skills.length < 8) skills.push('');
    return skills;
  });
  const [requiredPersonas, setRequiredPersonas] = useState(initialRequiredPersonas || []);
  const [name, setName] = useState('');

  const incompatibleSkills = useMemo(() => {
    if (!targetPersona) return [];
    return targetSkills.filter(s => s && !canInherit(targetPersona, s));
  }, [targetPersona, targetSkills]);

  const slotOverflow = useMemo(() => {
    if (!targetPersona) return 0;
    const active = targetSkills.filter(Boolean);
    return Math.max(0, active.length - getMaxInheritedSkills(targetPersona));
  }, [targetPersona, targetSkills]);

  const autoName = useMemo(() => {
    return generateBookmarkName(targetPersona, targetSkills, requiredPersonas);
  }, [targetPersona, targetSkills, requiredPersonas]);

  const handleSkillChange = (index, value) => {
    const updated = [...targetSkills];
    updated[index] = value;
    setTargetSkills(updated);
  };

  const handleAddRequiredPersona = (val) => {
    if (val && !requiredPersonas.includes(val)) {
      setRequiredPersonas([...requiredPersonas, val]);
    }
  };

  const handleRemoveRequiredPersona = (name) => {
    setRequiredPersonas(requiredPersonas.filter(p => p !== name));
  };

  const handleSave = () => {
    onSave({
      name: name || autoName,
      targetPersona,
      targetSkills: targetSkills.filter(Boolean),
      requiredPersonas,
    });
    onClose();
  };

  return (
    <>
      <div className="modal-overlay open" onClick={onClose} />
      <div className="modal-content flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Save Bookmark</h3>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--p3r-text-muted)', marginBottom: '4px', display: 'block' }}>Name</label>
          <input
            type="text"
            value={name || autoName}
            onChange={e => setName(e.target.value)}
            placeholder={autoName}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--p3r-text-muted)', marginBottom: '4px', display: 'block' }}>Target Persona</label>
          <SearchableSelect
            placeholder="Select Persona..."
            options={personaOptions}
            value={targetPersona}
            onChange={setTargetPersona}
            noMargin
          />
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--p3r-text-muted)', marginBottom: '4px', display: 'block' }}>Target Skills</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {targetSkills.map((skill, i) => (
              <SearchableSelect
                key={i}
                placeholder={`Skill ${i + 1}`}
                options={[{ value: '', label: 'None' }, ...skillOptions]}
                value={skill}
                onChange={(val) => handleSkillChange(i, val)}
                noMargin
              />
            ))}
          </div>
          {incompatibleSkills.length > 0 && (
            <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(255, 193, 7, 0.15)', border: '1px solid rgba(255, 193, 7, 0.3)', borderRadius: '6px', fontSize: '0.8rem', color: '#ffd54f' }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              <strong>Inheritance conflict:</strong> {targetPersona} cannot inherit {incompatibleSkills.join(', ')}. These will need Skill Cards to be usable on this Persona.
            </div>
          )}
          {slotOverflow > 0 && (
            <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(255, 100, 100, 0.15)', border: '1px solid rgba(255, 100, 100, 0.3)', borderRadius: '6px', fontSize: '0.8rem', color: '#ff9999' }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              <strong>Too many skills:</strong> {targetPersona} can only inherit {getMaxInheritedSkills(targetPersona)} skills via fusion ({slotOverflow} excess). Use Skill Cards for the rest.
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--p3r-text-muted)', marginBottom: '4px', display: 'block' }}>Include Personas</label>
          {requiredPersonas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
              {requiredPersonas.map(p => (
                <span
                  key={p}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'rgba(0, 229, 255, 0.15)', border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: '4px', padding: '2px 8px', fontSize: '0.85rem',
                    color: 'var(--p3r-cyan)'
                  }}
                >
                  {p}
                  <X
                    size={14}
                    style={{ cursor: 'pointer', opacity: 0.7 }}
                    onClick={() => handleRemoveRequiredPersona(p)}
                  />
                </span>
              ))}
            </div>
          )}
          <SearchableSelect
            placeholder="Add persona to include..."
            options={personaOptions.filter(o => o.value && !requiredPersonas.includes(o.value))}
            value=""
            onChange={handleAddRequiredPersona}
            noMargin
          />
        </div>

        <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!targetPersona}>Save Bookmark</button>
        </div>
      </div>
    </>
  );
}

export function AddSkillToBookmarkModal({ skillName, bookmarks, onAdd, onClose }) {
  return (
    <>
      <div className="modal-overlay open" onClick={onClose} />
      <div className="modal-content flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Add to Bookmark</h3>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>
          Select a bookmark to add <strong>{skillName}</strong>:
        </p>
        {bookmarks.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>No bookmarks yet.</p>
        ) : (
          <div className="flex-col gap-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {[...bookmarks].reverse().map(b => {
              const alreadyHas = b.targetSkills.includes(skillName);
              const cannotInherit = b.targetPersona && !canInherit(b.targetPersona, skillName);
              const maxSlots = b.targetPersona ? getMaxInheritedSkills(b.targetPersona) : Infinity;
              const wouldOverflow = !alreadyHas && b.targetSkills.length >= maxSlots;
              const isDisabled = alreadyHas || cannotInherit || wouldOverflow;
              return (
                <div
                  key={b.id}
                  className="bookmark-item"
                  onClick={() => { if (!isDisabled) { onAdd(b.id, skillName); onClose(); } }}
                  style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'default' : 'pointer' }}
                >
                  <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{b.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {b.targetPersona} {'\u00b7'} {b.targetSkills.length} skills
                    </div>
                  </div>
                  {alreadyHas && <span style={{ fontSize: '0.75rem', color: 'var(--p3r-text-muted)' }}>Added</span>}
                  {cannotInherit && <span style={{ fontSize: '0.75rem', color: '#ff9999' }}>Incompatible</span>}
                  {wouldOverflow && <span style={{ fontSize: '0.75rem', color: '#ff9999' }}>Full ({maxSlots} max)</span>}
                </div>
              );
            })}
          </div>
        )}
        <button onClick={onClose} style={{ alignSelf: 'flex-end' }}>Cancel</button>
      </div>
    </>
  );
}
