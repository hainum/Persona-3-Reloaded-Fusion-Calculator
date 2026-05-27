import demonDataRaw from './demon-data.json' with { type: 'json' };
import skillDataRaw from './skill-data.json' with { type: 'json' };
import fusionChartRaw from './fusion-chart.json' with { type: 'json' };
import specialRecipesRaw from './special-recipes.json' with { type: 'json' };
import compConfigRaw from './comp-config.json' with { type: 'json' };
import unlockRequirementsRaw from './unlock-requirements.json' with { type: 'json' };

// Process Skills
const skillData = {};
for (const [key, row] of Object.entries(skillDataRaw)) {
  const name = row.a[0];
  const elem = row.a[1];
  const target = row.a[2];
  const rank = row.b[0] || 99;

  skillData[name] = {
    name,
    elem,
    target,
    rank,
    id: key,
    cost: row.b[1] >= 1000 ? row.b[1] % 1000 : row.b[1],
    power: row.b[2],
    hits: [row.b[3], row.b[4]],
    accuracy: row.b[5],
    critRate: row.b[6],
    ailmentChance: row.b[7],
    statusEffect: row.c[0] === '-' ? null : row.c[0],
    effectDesc: row.c[1] === '-' ? null : row.c[1],
    weaponSource: row.c[2] === '-' ? null : row.c[2],
  };
}

// Process Personas
const personaData = {};
for (const [name, data] of Object.entries(demonDataRaw)) {
  personaData[name] = {
    name,
    lvl: data.lvl,
    race: data.race,
    inherits: data.inherits,
    resists: data.resists,
    skills: data.skills, // Object mapping skill name to unlock level (0.1, 0.2, etc = innate)
    stats: data.stats,
    heart: data.heart
  };
}

// Map inheritance types to a bitmask boolean array matching inheritElems
const inheritElems = compConfigRaw.inheritElems;
const inheritTypes = {};
for (const [type, bits] of Object.entries(compConfigRaw.inheritTypes)) {
  inheritTypes[type] = bits.split('').map(b => b === '1');
}

// Personas sorted by level for database listing
const personaList = Object.entries(demonDataRaw)
  .map(([name, data]) => ({ name, lvl: data.lvl, race: data.race }))
  .sort((a, b) => a.lvl - b.lvl);

// Reverse index: skill name → personas that learn it (leveling up or innate)
const skillLearnedBy = {};
for (const [pName, pData] of Object.entries(demonDataRaw)) {
  for (const [sName, unlockLvl] of Object.entries(pData.skills)) {
    if (!skillLearnedBy[sName]) skillLearnedBy[sName] = [];
    skillLearnedBy[sName].push({ personaName: pName, level: unlockLvl });
  }
}
for (const entries of Object.values(skillLearnedBy)) {
  entries.sort((a, b) => {
    const aLvl = a.level < 1 ? (personaData[a.personaName]?.lvl ?? a.level) : a.level;
    const bLvl = b.level < 1 ? (personaData[b.personaName]?.lvl ?? b.level) : b.level;
    return aLvl - bLvl;
  });
}

const canInheritCache = {};
// Determine if a Persona can inherit a specific skill.
// Accepts either a skill name (e.g. "Bufu") or a raw element string (e.g. "ice").
export function canInherit(personaName, skillNameOrElem) {
  const cacheKey = `${personaName}:${skillNameOrElem}`;
  if (canInheritCache[cacheKey] !== undefined) return canInheritCache[cacheKey];

  // If a known skill name was passed, resolve to its element
  let elem = skillNameOrElem;
  if (skillData[skillNameOrElem]) {
    elem = skillData[skillNameOrElem].elem;
  }

  // Passives, Almighty, etc might not be in inheritElems. They are always inheritable unless rank=99
  const elemIndex = inheritElems.indexOf(elem);
  if (elemIndex === -1) {
    canInheritCache[cacheKey] = true;
    return true; 
  }
  
  const persona = personaData[personaName];
  if (!persona) {
    canInheritCache[cacheKey] = false;
    return false;
  }
  
  const inheritBits = inheritTypes[persona.inherits];
  if (!inheritBits) {
    canInheritCache[cacheKey] = false;
    return false;
  }
  
  const result = inheritBits[elemIndex];
  canInheritCache[cacheKey] = result;
  return result;
}

// Determine if a specific skill is inherently uninheritable (rank 99)
export function isSkillInheritable(skillName) {
  const skill = skillData[skillName];
  if (!skill) return false;
  return skill.rank < 99;
}

export {
  skillData,
  personaData,
  personaList,
  skillLearnedBy,
  fusionChartRaw as fusionChart,
  specialRecipesRaw as specialRecipes,
  compConfigRaw as compConfig,
  unlockRequirementsRaw as unlockRequirements
};
