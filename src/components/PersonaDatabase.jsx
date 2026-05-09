import { useState, useMemo } from 'react';
import { personaData, skillData, personaList, skillLearnedBy, compConfig } from '../data/DataParser';
import { getAllRecipes, getForwardFusions } from '../lib/FusionCalculator';
import { Search, List, ShieldQuestion, ArrowUpDown, ArrowLeft, Star } from 'lucide-react';

const ELEM_LABELS = {
  phy: 'Phys', sla: 'Slash', str: 'Strike', pie: 'Pierce',
  fir: 'Fire', ice: 'Ice', ele: 'Electric', win: 'Wind',
  lig: 'Light', dar: 'Dark', alm: 'Almighty',
  rec: 'Recovery', sup: 'Support', pas: 'Passive', nai: 'Auto',
  ail: 'Ailment', spe: 'Special', uni: 'Unique',
};

const RESIST_LABELS = {
  '-': '\u2014', '_': '\u2014',
  'w': 'Weak', 'W': 'Weak',
  's': 'Resist', 'S': 'Resist',
  'n': 'Null',
  'r': 'Repel',
  'd': 'Drain',
  'z': 'Weak+',
  'u': 'Resist+', 'v': 'Resist+', 'V': 'Resist+',
  't': 'Resist', 'T': 'Resist',
};

function getEffect(skill) {
  const { elem, target, power, statusEffect, effectDesc, ailmentChance } = skill;
  if (effectDesc && effectDesc !== '-' && !/^FMT|\$/.test(effectDesc) && effectDesc.length > 3) {
    return effectDesc;
  }
  const elemLabel = ELEM_LABELS[elem] || elem.toUpperCase();
  if (elem === 'rec') {
    const what = statusEffect || 'HP';
    const amt = power ? ` ${power}` : '';
    return `Restore${amt} ${what} to ${target}`;
  }
  if (elem === 'sup' || elem === 'spe') {
    if (statusEffect) return `${statusEffect} \u2014 ${target}`;
    return `${elemLabel} \u2014 ${target}`;
  }
  if (elem === 'pas' || elem === 'nai') {
    if (statusEffect) return `Passive: ${statusEffect}`;
    return elemLabel;
  }
  if (elem === 'ail') {
    if (statusEffect) return `${ailmentChance || ''}% ${statusEffect} chance on ${target}`.trimStart();
    return `${elemLabel} on ${target}`;
  }
  if (elem === 'uni') return statusEffect || elemLabel;
  if (power > 0 || ['sla', 'str', 'pie', 'fir', 'ice', 'ele', 'win', 'lig', 'dar', 'alm'].includes(elem)) {
    const parts = [];
    if (power > 0) parts.push(String(power));
    parts.push(`${elemLabel} dmg to ${target}`);
    if (statusEffect && ailmentChance > 0) parts.push(`(${ailmentChance}% ${statusEffect})`);
    else if (statusEffect) parts.push(`(${statusEffect})`);
    return parts.join(' ');
  }
  return `${elemLabel} ${target}`;
}

function createSortableColumn(label, key, compareFn) {
  return { label, key, compareFn };
}

function PersonaDetail({ personaName, onBack }) {
  const pData = personaData[personaName];

  const learnedSkills = useMemo(() => {
    if (!pData) return [];
    return Object.entries(pData.skills)
      .filter(([, lvl]) => lvl >= 1)
      .sort((a, b) => a[1] - b[1])
      .map(([sName, lvl]) => ({ ...skillData[sName], learnLevel: lvl }))
      .filter(s => s.name);
  }, [pData]);

  const innateSkills = useMemo(() => {
    if (!pData) return [];
    return Object.entries(pData.skills)
      .filter(([, lvl]) => lvl < 1)
      .map(([sName]) => sName)
      .filter(n => skillData[n]);
  }, [pData]);

  const resistRows = useMemo(() => {
    if (!pData) return [];
    const elems = compConfig.resistElems;
    const codes = pData.resists;
    if (!elems || !codes) return [];
    const rows = [];
    for (let i = 0; i < elems.length; i += 5) {
      const chunk = [];
      for (let idx = i; idx < Math.min(i + 5, elems.length); idx++) {
        const elem = elems[idx];
        const code = codes[idx];
        chunk.push({ elem: ELEM_LABELS[elem] || elem.toUpperCase(), label: RESIST_LABELS[code] || code });
      }
      rows.push(chunk);
    }
    return rows;
  }, [pData]);

  if (!pData) return null;

  const recipes = getAllRecipes(personaName);
  const forwardFusions = getForwardFusions(personaName);

  return (
    <div className="flex-col gap-4">
      <button className="flex items-center gap-2" onClick={onBack} style={{ alignSelf: 'flex-start', textTransform: 'none', letterSpacing: 'normal', fontSize: '0.9rem', padding: '6px 14px' }}>
        <ArrowLeft size={16} /> Back to Persona List
      </button>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex justify-between items-center">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{personaName}</h2>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.95rem' }}>
                Lv {pData.lvl} {'\u00b7'} {pData.race}
              </p>
            </div>
            <div className="flex gap-2">
              {innateSkills.length > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--p3r-text-muted)' }}>Innate Skills</span>
                  <div className="flex gap-1" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '4px' }}>
                    {innateSkills.map(s => (
                      <span key={s} className="elem-badge" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#81c784', borderColor: 'rgba(76, 175, 80, 0.3)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Resistances</h3>
          <div className="flex-col gap-2">
            {resistRows.map((row, ri) => (
              <div key={ri} className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                {row.map(r => (
                  <span key={r.elem} className="resist-tag">{r.elem} <strong>{r.label}</strong></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Learned Skills</h3>
          {learnedSkills.length > 0 ? (
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Lv</th>
                  <th>Element</th>
                  <th>Effect</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {learnedSkills.map(s => (
                  <tr key={s.name}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.learnLevel}</td>
                    <td><span className="elem-badge">{ELEM_LABELS[s.elem] || s.elem.toUpperCase()}</span></td>
                    <td style={{ color: 'var(--p3r-text-muted)', maxWidth: '260px' }}>{getEffect(s)}</td>
                    <td>{s.cost > 0 ? `${s.cost} SP` : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>No skills learned through leveling up.</p>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Reverse Fusion</h3>
          {recipes.length > 0 ? (
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th colSpan={2}>Ingredients</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((r, i) => (
                  <tr key={i}>
                    <td colSpan={2}>
                      <div className="flex gap-1" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                        {r.ingredients.map((ing, j) => {
                          const ingData = personaData[ing];
                          return (
                            <span key={ing}>
                              {j > 0 && <span style={{ margin: '0 4px', color: 'var(--p3r-text-muted)' }}>{'\u00d7'}</span>}
                              <span className="learner-tag">{ing} {ingData ? `(Lv ${ingData.lvl})` : ''}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>{r.isSpecial ? <span className="elem-badge" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#ffd54f', borderColor: 'rgba(255, 193, 7, 0.3)' }}>Special</span> : <span className="elem-badge">Normal</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>No fusion recipes found for this persona.</p>
          )}
        </div>

        <div style={{ padding: '16px 24px' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Forward Fusion</h3>
          {forwardFusions.length > 0 ? (
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Formula</th>
                  <th>Result</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {forwardFusions.map((f, i) => {
                  const resultData = personaData[f.result];
                  return (
                    <tr key={i}>
                      <td>
                        <span className="learner-tag" style={{ color: 'var(--p3r-cyan)', borderColor: 'rgba(0, 229, 255, 0.3)' }}>{personaName}</span>
                        {f.otherIngredients.map((ing) => {
                          const ingData = personaData[ing];
                          return (
                            <span key={ing}>
                              <span style={{ margin: '0 4px', color: 'var(--p3r-text-muted)' }}>{'\u00d7'}</span>
                              <span className="learner-tag">{ing} {ingData ? `(Lv ${ingData.lvl})` : ''}</span>
                            </span>
                          );
                        })}
                      </td>
                      <td><span className="learner-tag" style={{ color: 'var(--p3r-white)' }}>{f.result} {resultData ? `(Lv ${resultData.lvl})` : ''}</span></td>
                      <td>{f.isSpecial ? <span className="elem-badge" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#ffd54f', borderColor: 'rgba(255, 193, 7, 0.3)' }}>Special</span> : <span className="elem-badge">Normal</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>This persona does not appear as an ingredient in any fusion.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PersonaDatabase() {
  const [tab, setTab] = useState('personas');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [personaSearch, setPersonaSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [personaSort, setPersonaSort] = useState({ key: 'lvl', asc: true });
  const [skillSort, setSkillSort] = useState({ key: 'name', asc: true });

  const personaColumns = useMemo(() => [
    createSortableColumn('Name', 'name', (a, b, asc) => asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)),
    createSortableColumn('Lv', 'lvl', (a, b, asc) => asc ? a.lvl - b.lvl : b.lvl - a.lvl),
    createSortableColumn('Arcana', 'race', (a, b, asc) => asc ? a.race.localeCompare(b.race) : b.race.localeCompare(a.race)),
  ], []);

  const skillColumns = useMemo(() => [
    createSortableColumn('Name', 'name', (a, b, asc) => asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)),
    createSortableColumn('Element', 'elem', (a, b, asc) => asc ? (ELEM_LABELS[a.elem] || a.elem).localeCompare(ELEM_LABELS[b.elem] || b.elem) : (ELEM_LABELS[b.elem] || b.elem).localeCompare(ELEM_LABELS[a.elem] || a.elem)),
  ], []);

  const filteredPersonas = useMemo(() => {
    let list = personaList;
    if (personaSearch.trim()) {
      const q = personaSearch.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.race.toLowerCase().includes(q)
      );
    }
    const col = personaColumns.find(c => c.key === personaSort.key);
    if (col) list = [...list].sort((a, b) => col.compareFn(a, b, personaSort.asc));
    return list;
  }, [personaSearch, personaSort, personaColumns]);

  const filteredSkills = useMemo(() => {
    let list = Object.values(skillData);
    if (skillSearch.trim()) {
      const q = skillSearch.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (ELEM_LABELS[s.elem] || s.elem).toLowerCase().includes(q) ||
        (s.statusEffect && s.statusEffect.toLowerCase().includes(q))
      );
    }
    const col = skillColumns.find(c => c.key === skillSort.key);
    if (col) list = [...list].sort((a, b) => col.compareFn(a, b, skillSort.asc));
    return list;
  }, [skillSearch, skillSort, skillColumns]);

  const handleSort = (setter) => (column) => {
    setter(prev => ({
      key: column.key,
      asc: prev.key === column.key ? !prev.asc : true,
    }));
  };

  if (selectedPersona && tab === 'personas') {
    return (
      <div className="flex-col gap-4">
        <div className="tab-bar flex gap-2" style={{ marginBottom: '1rem' }}>
          <button className={`tab-btn ${tab === 'personas' ? 'active' : ''}`} onClick={() => { setTab('personas'); setSelectedPersona(null); }}><List size={16} /> Persona List</button>
          <button className={`tab-btn ${tab === 'skills' ? 'active' : ''}`} onClick={() => setTab('skills')}><ShieldQuestion size={16} /> Skill List</button>
        </div>
        <PersonaDetail personaName={selectedPersona} onBack={() => setSelectedPersona(null)} />
      </div>
    );
  }

  return (
    <div className="flex-col gap-4">
      <div className="tab-bar flex gap-2" style={{ marginBottom: '1rem' }}>
        <button className={`tab-btn ${tab === 'personas' ? 'active' : ''}`} onClick={() => setTab('personas')}><List size={16} /> Persona List</button>
        <button className={`tab-btn ${tab === 'skills' ? 'active' : ''}`} onClick={() => setTab('skills')}><ShieldQuestion size={16} /> Skill List</button>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {tab === 'personas' ? (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px 12px' }}>
                <Search size={16} style={{ color: 'var(--p3r-text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search by name or arcana..."
                  value={personaSearch}
                  onChange={e => setPersonaSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', boxShadow: 'none' }}
                />
                <span style={{ color: 'var(--p3r-text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>{filteredPersonas.length} personas</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {personaColumns.map(col => (
                      <th key={col.key} onClick={() => handleSort(setPersonaSort)(col)} style={{ cursor: 'pointer' }}>
                        <span className="flex items-center gap-1">
                          {col.label}
                          <ArrowUpDown size={12} style={{ opacity: personaSort.key === col.key ? 1 : 0.3 }} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonas.map(p => (
                    <tr key={p.name} onClick={() => setSelectedPersona(p.name)} style={{ cursor: 'pointer' }}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.lvl}</td>
                      <td>{p.race}</td>
                    </tr>
                  ))}
                  {filteredPersonas.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--p3r-text-muted)', padding: '2rem' }}>No personas match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px 12px' }}>
                <Search size={16} style={{ color: 'var(--p3r-text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search by name, element, or effect..."
                  value={skillSearch}
                  onChange={e => setSkillSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', boxShadow: 'none' }}
                />
                <span style={{ color: 'var(--p3r-text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>{filteredSkills.length} skills</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {skillColumns.map(col => (
                      <th key={col.key} onClick={() => handleSort(setSkillSort)(col)} style={{ cursor: 'pointer' }}>
                        <span className="flex items-center gap-1">
                          {col.label}
                          <ArrowUpDown size={12} style={{ opacity: skillSort.key === col.key ? 1 : 0.3 }} />
                        </span>
                      </th>
                    ))}
                    <th>Effect</th>
                    <th>Cost</th>
                    <th>Learned By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkills.map(s => {
                    const learners = skillLearnedBy[s.name];
                    return (
                      <tr key={s.name}>
                        <td><strong>{s.name}</strong></td>
                        <td><span className="elem-badge">{ELEM_LABELS[s.elem] || s.elem.toUpperCase()}</span></td>
                        <td style={{ maxWidth: '300px', fontSize: '0.9rem', color: 'var(--p3r-text-muted)' }}>{getEffect(s)}</td>
                        <td>{s.cost > 0 ? `${s.cost} SP` : '\u2014'}</td>
                        <td style={{ maxWidth: '280px', fontSize: '0.85rem' }}>
                          {learners && learners.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                              {learners.slice(0, 3).map(l => (
                                <span key={l.personaName} className="learner-tag">{l.personaName} (Lv{l.level})</span>
                              ))}
                              {learners.length > 3 && (
                                <span className="learner-tag" style={{ opacity: 0.6 }}>+{learners.length - 3} more</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--p3r-text-muted)' }}>{'\u2014'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSkills.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--p3r-text-muted)', padding: '2rem' }}>No skills match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
