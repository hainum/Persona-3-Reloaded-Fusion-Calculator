import { useState, useMemo, useEffect, useRef } from 'react';
import { personaData, skillData, personaList, skillLearnedBy, compConfig, unlockRequirements } from '../data/DataParser';
import { getAllRecipes, getForwardFusions } from '../lib/FusionCalculator';
import { Search, X, List, ShieldQuestion, ArrowUpDown, ArrowLeft, Star, BookmarkPlus, Plus, Lock } from 'lucide-react';
import { SaveBookmarkModal, AddSkillToBookmarkModal } from './BookmarkModal';

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

const RESIST_CLASS = {
  'Weak': 'weak', 'Weak+': 'weak',
  'Resist': 'resist', 'Resist+': 'resist',
  'Null': 'null',
  'Repel': 'repel',
  'Drain': 'drain',
};

const FMT_DESC = {
  FMTAilmentBoost: (s) => `${s.statusEffect} chance up`,
  FMTAutoSkill: (s) => `Auto ${s.statusEffect} at battle start`,
  FMTBase: (s) => {
    if (s.elem === 'rec') {
      const what = (s.statusEffect || 'HP').replace(/ restore/i, '');
      if (s.power > 0) return `Restore ${s.power} ${what} to ${s.target}`;
      return `${what} to ${s.target}`;
    }
    if ((s.elem === 'sup' || s.elem === 'spe') && s.power === 0 && s.statusEffect) {
      return `${s.statusEffect} \u2014 ${s.target}`;
    }
    return `${s.power} ${ELEM_LABELS[s.elem] || s.elem.toUpperCase()} dmg to ${s.target}`;
  },
  FMTCureAilment: (s) => `Cure ${s.statusEffect} of all allies`,
  FMTDodgeElem: (s) => `${s.statusEffect} dodge rate up`,
  FMTDrainElem: (s) => `Drain ${s.statusEffect}`,
  FMTElemBoost: (s) => {
    const mult = ((s.ailmentChance || 1125) - 1000) / 100;
    const display = mult % 1 === 0 ? String(mult) : mult.toFixed(2);
    return `${s.statusEffect} dmg dealt x${display}`;
  },
  FMTElemBreak: (s) => `${s.statusEffect} resistance down for 3 turns`,
  FMTElemCharge: (s) => `Next ${s.statusEffect} dmg x2.5`,
  FMTElemKarn: (s) => `Reflect ${s.statusEffect} dmg once`,
  FMTEndure: () => 'Survive fatal blow with 1 HP',
  FMTEnduringSoul: () => 'Survive fatal blow, fully restore HP',
  FMTExact: (s) => {
    const label = ELEM_LABELS[s.elem] || s.elem.toUpperCase();
    let desc = `${s.power} ${label} dmg to ${s.target}`;
    if (s.statusEffect && s.ailmentChance > 0) desc += ` (${s.ailmentChance}% ${s.statusEffect})`;
    else if (s.statusEffect) desc += ` (${s.statusEffect})`;
    return desc;
  },
  FMTFirmStance: (s) => `Halves ${s.statusEffect} but cannot dodge`,
  FMTFoulBreathN: () => 'Increase foe ailment susceptibility for 3 turns',
  FMTFracDamage: (s) => `Reduce ${s.target} HP by 1/2`,
  FMTGrowthN: (s) => `Earn ${s.ailmentChance}% exp when not in battle`,
  FMTHealBoost: () => 'Healing effects +50%',
  FMTInstakillWhen: (s) => `Instakill foes with ${s.statusEffect}`,
  FMTInvigorateN: (s) => `Restore ${s.ailmentChance} SP each turn`,
  FMTLifeAidN: (s) => `Restore ${s.ailmentChance}% HP/SP after battle`,
  FMTNullAilment: (s) => `Null ${s.statusEffect}`,
  FMTNullElem: (s) => `Null ${s.statusEffect}`,
  FMTPersonaCounterN: (s) => `${s.ailmentChance}% chance to counter phys dmg`,
  FMTPersonaKaja: (s) => {
    const pct = Math.abs(s.ailmentChance - 1100);
    const verb = s.ailmentChance > 1100 ? 'Raise' : 'Lower';
    return `${verb} ${s.statusEffect} of ${s.target} by ${pct}% for 3 turns`;
  },
  FMTPersonaLifeDrainN: (s) => `Drain ${s.statusEffect} from foe`,
  FMTPlus: (s) => {
    const label = s.statusEffect.replace(/^[a-z]/, (c) => c.toUpperCase());
    return `${label} +${s.ailmentChance}%`;
  },
  FMTRecarm: (s) => `Revive ally with ${s.ailmentChance}% HP`,
  FMTRegenerateN: (s) => `Restore ${s.ailmentChance}% HP each turn`,
  FMTRepelElem: (s) => `Repel ${s.statusEffect}`,
  FMTResistAilment: (s) => `Resist ${s.statusEffect}`,
  FMTResistElem: (s) => `Resist ${s.statusEffect}`,
  FMTTimes: (s) => {
    const ac = s.ailmentChance || 1100;
    if (ac === 1025) return `${s.statusEffect} to 25% of normal`;
    if (ac <= 1050) return `Halves ${s.statusEffect}`;
    if (ac < 1100) return ac <= 1085 ? `Greatly reduces ${s.statusEffect}` : `Reduces ${s.statusEffect}`;
    if (ac > 1100) {
      if (ac >= 1200) return `Increases ${s.statusEffect}`;
      if (ac >= 1130) return `Greatly ${s.statusEffect} up`;
      return `${s.statusEffect} up`;
    }
    return s.statusEffect;
  },
};

function appendMultiHitStats(skill, desc) {
  const { elem, hits, accuracy, critRate } = skill;
  if (hits && hits.length === 2 && hits[0] > 0 && !(hits[0] === 1 && hits[1] === 1)) {
    const hitStr = hits[0] === hits[1] ? `${hits[0]}` : `${hits[0]}-${hits[1]}`;
    return `${desc}, ${hitStr} hits, ${accuracy}% acc, ${critRate}% crit`;
  }
  if (['sla', 'str', 'pie'].includes(elem) && critRate > 0) {
    return `${desc}, ${critRate}% crit`;
  }
  return desc;
}

function getEffect(skill) {
  const { elem, target, power, statusEffect, effectDesc, ailmentChance } = skill;

  if (effectDesc && FMT_DESC[effectDesc]) {
    return appendMultiHitStats(skill, FMT_DESC[effectDesc](skill));
  }

  if (effectDesc && effectDesc.includes('$')) {
    let desc = effectDesc;
    if (power) desc = desc.replace('$1', power);
    else if (ailmentChance) desc = desc.replace('$1', ailmentChance);
    if (statusEffect) desc = desc.replace('$2', statusEffect);
    desc = desc.replace(/\$[12]/g, '?');
    return appendMultiHitStats(skill, desc);
  }

  if (effectDesc && effectDesc !== '-' && effectDesc.length > 3) {
    return appendMultiHitStats(skill, effectDesc);
  }
  const elemLabel = ELEM_LABELS[elem] || elem.toUpperCase();
  if (elem === 'rec') {
    const what = statusEffect || 'HP';
    const amt = power ? ` ${power}` : '';
    return appendMultiHitStats(skill, `Restore${amt} ${what} to ${target}`);
  }
  if (elem === 'sup' || elem === 'spe') {
    if (statusEffect) return appendMultiHitStats(skill, `${statusEffect} \u2014 ${target}`);
    return appendMultiHitStats(skill, `${elemLabel} \u2014 ${target}`);
  }
  if (elem === 'pas' || elem === 'nai') {
    if (statusEffect) return appendMultiHitStats(skill, `Passive: ${statusEffect}`);
    return appendMultiHitStats(skill, elemLabel);
  }
  if (elem === 'ail') {
    if (statusEffect) return appendMultiHitStats(skill, `${ailmentChance || ''}% ${statusEffect} chance on ${target}`.trimStart());
    return appendMultiHitStats(skill, `${elemLabel} on ${target}`);
  }
  if (elem === 'uni') return appendMultiHitStats(skill, statusEffect || elemLabel);
  if (power > 0 || ['sla', 'str', 'pie', 'fir', 'ice', 'ele', 'win', 'lig', 'dar', 'alm'].includes(elem)) {
    const parts = [];
    if (power > 0) parts.push(String(power));
    parts.push(`${elemLabel} dmg to ${target}`);
    if (statusEffect && ailmentChance > 0) parts.push(`(${ailmentChance}% ${statusEffect})`);
    else if (statusEffect) parts.push(`(${statusEffect})`);
    return appendMultiHitStats(skill, parts.join(' '));
  }
  return appendMultiHitStats(skill, `${elemLabel} ${target}`);
}

function createSortableColumn(label, key, compareFn) {
  return { label, key, compareFn };
}

function PersonaDetail({ personaName, onBack, onBookmarkConfig }) {
  const pData = personaData[personaName];
  const [recipeSearch, setRecipeSearch] = useState('');

  const skills = useMemo(() => {
    if (!pData) return [];
    return Object.entries(pData.skills)
      .map(([sName, lvl]) => ({ ...skillData[sName], learnLevel: lvl }))
      .filter(s => s.name)
      .sort((a, b) => {
        const aInnate = a.learnLevel < 1 ? 0 : 1;
        const bInnate = b.learnLevel < 1 ? 0 : 1;
        if (aInnate !== bInnate) return aInnate - bInnate;
        return a.learnLevel - b.learnLevel;
      });
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

  const recipes = getAllRecipes(personaName);
  const forwardFusions = getForwardFusions(personaName);

  const filteredRecipes = useMemo(() => {
    if (!recipeSearch.trim()) return recipes;
    const q = recipeSearch.toLowerCase();
    return recipes.filter(r =>
      r.ingredients.some(ing => ing.toLowerCase().includes(q))
    );
  }, [recipes, recipeSearch]);

  if (!pData) return null;

  return (
      <div className="flex-col gap-4">
      <button className="btn-outline flex items-center gap-2" onClick={onBack} style={{ alignSelf: 'flex-start', textTransform: 'none', letterSpacing: 'normal', fontSize: '0.9rem', padding: '6px 14px', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Persona List
      </button>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex justify-between items-center">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                {personaName}
                {unlockRequirements[personaName] && (
                  <>
                    {' '}
                    <span title={unlockRequirements[personaName].description}>
                      <Lock size={16} style={{ color: 'var(--p3r-cyan)', verticalAlign: 'middle' }} />
                    </span>
                    <span className="elem-badge" style={{ marginLeft: '8px', fontSize: '0.65rem', padding: '2px 8px', background: 'rgba(255, 193, 7, 0.15)', color: '#ffd54f', borderColor: 'rgba(255, 193, 7, 0.3)', verticalAlign: 'middle' }}>
                      {unlockRequirements[personaName].type === 'dlc' ? 'DLC' : unlockRequirements[personaName].type === 'link_episode' ? 'Link Episode' : unlockRequirements[personaName].type === 'social_link_max' ? 'Social Link' : 'Unlockable'}
                    </span>
                  </>
                )}
              </h2>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.95rem' }}>
                Lv {pData.lvl} {'\u00b7'} {pData.race}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-outline flex items-center gap-1"
                onClick={() => onBookmarkConfig({ initialPersona: personaName })}
                title="Save as bookmark"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              >
                <BookmarkPlus size={14} /> Bookmark
              </button>
              
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Resistances</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
            {resistRows.flat().map((r, i) => (
              <span key={i} className={`resist-tag ${RESIST_CLASS[r.label] || ''}`}>{r.elem} <strong>{r.label}</strong></span>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Skills</h3>
          {skills.length > 0 ? (
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
                {skills.map(s => (
                  <tr key={s.name}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.learnLevel < 1 ? <span className="innate-chip">Innate</span> : s.learnLevel > 99 ? <span className="theurgy-chip">Theurgy</span> : s.learnLevel}</td>
                    <td><span className="elem-badge">{ELEM_LABELS[s.elem] || s.elem.toUpperCase()}</span></td>
                    <td style={{ color: 'var(--p3r-text-muted)', maxWidth: '260px' }}>{getEffect(s)}</td>
                    <td>{s.cost > 0 ? `${s.cost} ${s.costType || 'SP'}` : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>No skills.</p>
          )}
        </div>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Reverse Fusion</h3>
          <div className="input-wrapper" style={{ marginBottom: '10px' }}>
            <Search size={16} style={{ color: 'var(--p3r-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Filter by ingredient name..."
              value={recipeSearch}
              onChange={e => setRecipeSearch(e.target.value)}
              style={{ marginLeft: '8px' }}
            />
            {recipeSearch && (
              <button
                onClick={() => setRecipeSearch('')}
                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--p3r-text-muted)', flexShrink: 0, lineHeight: 0 }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <span style={{ color: 'var(--p3r-text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>{filteredRecipes.length} recipes</span>
          </div>
          {filteredRecipes.length > 0 ? (
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th colSpan={2}>Ingredients</th>
                  <th>Type</th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((r, i) => (
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
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="icon-btn"
                        onClick={() => onBookmarkConfig({ initialPersona: personaName, initialRequiredPersonas: r.ingredients })}
                        title="Save as bookmark"
                      >
                        <BookmarkPlus size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>{recipes.length === 0 ? 'No fusion recipes found for this persona.' : 'No recipes match your filter.'}</p>
          )}
        </div>

        <div style={{ padding: '20px 24px' }}>
          <h3 className="flex items-center gap-2" style={{ margin: '0 0 10px', fontSize: '1rem' }}><Star size={14} className="text-cyan" /> Forward Fusion</h3>
          {forwardFusions.length > 0 ? (
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Formula</th>
                  <th>Result</th>
                  <th>Type</th>
                  <th style={{ width: '50px' }}></th>
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
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="icon-btn"
                          onClick={() => onBookmarkConfig({ initialPersona: f.result, initialRequiredPersonas: [personaName, ...f.otherIngredients] })}
                          title="Save as bookmark"
                        >
                          <BookmarkPlus size={14} />
                        </button>
                      </td>
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

export default function PersonaDatabase({ bookmarks = [], personaOptions = [], skillOptions = [], onSaveBookmark, onAddSkillToBookmark }) {
  const [tab, setTab] = useState('personas');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [personaSearch, setPersonaSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [personaSort, setPersonaSort] = useState({ key: 'lvl', asc: true });
  const [skillSort, setSkillSort] = useState({ key: 'name', asc: true });
  const [saveBmConfig, setSaveBmConfig] = useState(null);
  const [addSkillName, setAddSkillName] = useState(null);
  const [skillPersonaDetail, setSkillPersonaDetail] = useState(null);
  const personaSearchRef = useRef(null);
  const skillSearchRef = useRef(null);
  const personaListScrollRef = useRef(0);

  useEffect(() => {
    if (selectedPersona) {
      personaListScrollRef.current = window.scrollY;
      window.scrollTo(0, 0);
    }
  }, [selectedPersona]);

  useEffect(() => {
    if (!selectedPersona) {
      window.scrollTo(0, personaListScrollRef.current);
    }
  }, [selectedPersona]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if ((mod && e.key === 'f') || e.key === '/' || (mod && e.key === 'k')) {
        e.preventDefault();
        const ref = tab === 'personas' ? personaSearchRef : skillSearchRef;
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tab]);

  const dbPersonaOptions = useMemo(() => {
    if (personaOptions.length > 0) return personaOptions;
    return Object.keys(personaData).sort().map(name => ({
      value: name,
      label: `${name} (Lv ${personaData[name].lvl} ${personaData[name].race})`
    }));
  }, [personaOptions]);

  const dbSkillOptions = useMemo(() => {
    if (skillOptions.length > 0) return skillOptions;
    return Object.keys(skillData).sort().map(name => ({
      value: name,
      label: `${name} (${skillData[name].elem})`
    }));
  }, [skillOptions]);

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
    let list = Object.values(skillData).filter(s => skillLearnedBy[s.name]);
    if (skillSearch.trim()) {
      const q = skillSearch.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (ELEM_LABELS[s.elem] || s.elem).toLowerCase().includes(q) ||
        (s.statusEffect && s.statusEffect.toLowerCase().includes(q))
      );
    }
    if (skillSort.key === 'minLvl') {
      const getMinLvl = (s) => {
        const learners = skillLearnedBy[s.name];
        if (!learners || learners.length === 0) return 99;
        return Math.min(...learners.map(l => l.level < 1 ? (personaData[l.personaName]?.lvl ?? l.level) : l.level));
      };
      list = [...list].sort((a, b) => skillSort.asc ? getMinLvl(a) - getMinLvl(b) : getMinLvl(b) - getMinLvl(a));
    } else {
      const col = skillColumns.find(c => c.key === skillSort.key);
      if (col) list = [...list].sort((a, b) => col.compareFn(a, b, skillSort.asc));
    }
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
      <>
        <div className="flex-col gap-4">
          <div className="tab-bar flex gap-2" style={{ marginBottom: '1rem' }}>
            <button className={`tab-btn ${tab === 'personas' ? 'active' : ''}`} onClick={() => { setTab('personas'); setSelectedPersona(null); }}><List size={16} /> Persona List</button>
            <button className={`tab-btn ${tab === 'skills' ? 'active' : ''}`} onClick={() => setTab('skills')}><ShieldQuestion size={16} /> Skill List</button>
          </div>
          <PersonaDetail personaName={selectedPersona} onBack={() => setSelectedPersona(null)} onBookmarkConfig={(config) => setSaveBmConfig(config)} />
        </div>
      {skillPersonaDetail && (
        <>
          <div className="modal-overlay open" onClick={() => setSkillPersonaDetail(null)} />
          <div className="modal-content" style={{ maxWidth: '900px', width: '95vw', maxHeight: '90vh' }}>
            <PersonaDetail personaName={skillPersonaDetail} onBack={() => setSkillPersonaDetail(null)} onBookmarkConfig={(config) => setSaveBmConfig(config)} />
          </div>
        </>
      )}
      {saveBmConfig && (
          <SaveBookmarkModal
            {...saveBmConfig}
            personaOptions={dbPersonaOptions}
            skillOptions={dbSkillOptions}
            onSave={onSaveBookmark}
            onClose={() => setSaveBmConfig(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex-col gap-4">
        <div className="tab-bar flex gap-2" style={{ marginBottom: '1rem' }}>
          <button className={`tab-btn ${tab === 'personas' ? 'active' : ''}`} onClick={() => setTab('personas')}><List size={16} /> Persona List</button>
          <button className={`tab-btn ${tab === 'skills' ? 'active' : ''}`} onClick={() => setTab('skills')}><ShieldQuestion size={16} /> Skill List</button>
        </div>

        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          {tab === 'personas' ? (
            <>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                <div className="input-wrapper">
                  <Search size={16} style={{ color: 'var(--p3r-text-muted)', flexShrink: 0 }} />
                  <input
                    ref={personaSearchRef}
                    type="text"
                    placeholder="Search by name or arcana..."
                    value={personaSearch}
                    onChange={e => setPersonaSearch(e.target.value)}
                    style={{ marginLeft: '8px' }}
                  />
                  {personaSearch && (
                    <button
                      onClick={() => { setPersonaSearch(''); personaSearchRef.current?.focus(); }}
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--p3r-text-muted)', flexShrink: 0, lineHeight: 0 }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
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
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPersonas.map(p => (
                      <tr key={p.name} onClick={() => setSelectedPersona(p.name)} style={{ cursor: 'pointer' }}>
                        <td>
                          <strong>{p.name}</strong>
                          {unlockRequirements[p.name] && (
                            <span title={unlockRequirements[p.name].description}>
                              <Lock size={12} style={{ marginLeft: '6px', color: 'var(--p3r-cyan)', verticalAlign: 'middle' }} />
                            </span>
                          )}
                        </td>
                        <td>{p.lvl}</td>
                        <td>{p.race}</td>
                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                          <button
                            className="icon-btn"
                          onClick={() => setSaveBmConfig({ initialPersona: p.name })}
                          title="Save as bookmark"
                          >
                            <BookmarkPlus size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredPersonas.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--p3r-text-muted)', padding: '2rem' }}>No personas match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                <div className="input-wrapper">
                  <Search size={16} style={{ color: 'var(--p3r-text-muted)', flexShrink: 0 }} />
                  <input
                    ref={skillSearchRef}
                    type="text"
                    placeholder="Search by name, element, or effect..."
                    value={skillSearch}
                    onChange={e => setSkillSearch(e.target.value)}
                    style={{ marginLeft: '8px' }}
                  />
                  {skillSearch && (
                    <button
                      onClick={() => { setSkillSearch(''); skillSearchRef.current?.focus(); }}
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--p3r-text-muted)', flexShrink: 0, lineHeight: 0 }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
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
                      <th onClick={() => { setSkillSort(prev => ({ key: 'minLvl', asc: prev.key === 'minLvl' ? !prev.asc : true })); }} style={{ cursor: 'pointer' }}>
                        <span className="flex items-center gap-1">
                          Min Lv
                          <ArrowUpDown size={12} style={{ opacity: skillSort.key === 'minLvl' ? 1 : 0.3 }} />
                        </span>
                      </th>
                      <th>Learned By</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSkills.map(s => {
                      const learners = skillLearnedBy[s.name];
                      return (
                        <tr key={s.name}>
                          <td>
                            <strong>{s.name}</strong>
                            {s.rank >= 99 && (
                              <>
                                {learners?.length === 1 ? (
                                  <Lock size={12} style={{ marginLeft: '6px', color: 'var(--p3r-text-muted)', verticalAlign: 'middle' }} title="Unique skill (non-inheritable)" />
                                ) : (
                                  <span className="elem-badge" style={{ marginLeft: '6px', fontSize: '0.65rem', padding: '1px 5px', background: 'rgba(255, 100, 100, 0.15)', color: '#ff9999', borderColor: 'rgba(255, 100, 100, 0.3)', verticalAlign: 'middle' }}>No Inherit</span>
                                )}
                              </>
                            )}
                          </td>
                          <td><span className="elem-badge">{ELEM_LABELS[s.elem] || s.elem.toUpperCase()}</span></td>
                          <td style={{ maxWidth: '300px', fontSize: '0.9rem', color: 'var(--p3r-text-muted)' }}>{getEffect(s)}</td>
                          <td>{s.cost > 0 ? `${s.cost} ${s.costType || 'SP'}` : '\u2014'}</td>
                          <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                            {learners ? (() => {
                              const normalLevels = learners.map(l => l.level < 1 ? (personaData[l.personaName]?.lvl ?? l.level) : l.level).filter(l => l <= 99);
                              return normalLevels.length > 0 ? Math.min(...normalLevels) : <span className="theurgy-chip">Special</span>;
                            })() : '\u2014'}
                          </td>
                          <td style={{ maxWidth: '280px', fontSize: '0.85rem' }}>
                            {learners && learners.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                  {learners.map(l => {
                                  const isSpecial = l.level > 99;
                                  const displayLvl = isSpecial ? <span className="theurgy-chip">Theurgy</span> : (l.level < 1 ? personaData[l.personaName]?.lvl ?? l.level : l.level);
                                  return (
                                      <span key={l.personaName} className="learner-tag" onClick={() => setSkillPersonaDetail(l.personaName)} style={{ cursor: 'pointer' }}>{typeof displayLvl === 'object' ? <>{displayLvl}</> : <>({displayLvl})</>} {l.personaName}</span>
                                    );
                                })}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--p3r-text-muted)' }}>{'\u2014'}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="icon-btn"
                              onClick={() => setAddSkillName(s.name)}
                              title="Add to bookmark"
                            >
                              <Plus size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSkills.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--p3r-text-muted)', padding: '2rem' }}>No skills match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      {saveBmConfig && (
        <SaveBookmarkModal
          {...saveBmConfig}
          personaOptions={dbPersonaOptions}
          skillOptions={dbSkillOptions}
          onSave={onSaveBookmark}
          onClose={() => setSaveBmConfig(null)}
        />
      )}
      {addSkillName && (
        <AddSkillToBookmarkModal
          skillName={addSkillName}
          bookmarks={bookmarks}
          onAdd={onAddSkillToBookmark}
          onClose={() => setAddSkillName(null)}
        />
      )}
    </>
  );
}
