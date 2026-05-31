import { useState } from 'react';
import { X } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import SkillSearch from './SkillSearch';

export default function CustomPersonaModal({ personaOptions, skillOptions, initialPersona, initialSkills, onSave, onClose }) {
  const [personaName, setPersonaName] = useState(initialPersona || '');
  const [skills, setSkills] = useState(initialSkills || []);

  const handleAddSkill = (name) => {
    if (name && !skills.includes(name)) {
      setSkills([...skills, name]);
    }
  };

  const removeSkill = (name) => {
    setSkills(skills.filter(s => s !== name));
  };

  const handleSave = () => {
    if (personaName && personaName !== '') {
      onSave(personaName, skills.slice(0, 8));
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

        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem', fontFamily: 'var(--font-heading)', color: 'var(--p3r-white)', textShadow: '0 0 10px rgba(0, 229, 255, 0.3)' }}>
          Skills Known ({skills.length}/8)
        </label>

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

        <SkillSearch
          skillOptions={skillOptions}
          selectedSkills={skills}
          onSelect={handleAddSkill}
          isFull={skills.length >= 8}
        />

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.9rem' }}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!personaName} style={{ fontSize: '0.9rem' }}>Save</button>
        </div>
      </div>
    </>
  );
}
