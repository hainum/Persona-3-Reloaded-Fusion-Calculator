import demonDataRaw from './demon-data.json';
import skillDataRaw from './skill-data.json';
import fusionChartRaw from './fusion-chart.json';
import specialRecipesRaw from './special-recipes.json';
import compConfigRaw from './comp-config.json';

// Process Skills
const skillData = {};
for (const [key, row] of Object.entries(skillDataRaw)) {
  const name = row.a[0];
  const elem = row.a[1];
  const target = row.a[2];
  const rank = row.b[0] || 99; // Rank 0 (or undefined) usually means exclusive/uninheritable

  skillData[name] = {
    name,
    elem,
    target,
    rank,
    id: key,
    // Add other fields if needed, like cost
    cost: row.b[1]
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

// Determine if a Persona can inherit a specific skill.
// Accepts either a skill name (e.g. "Bufu") or a raw element string (e.g. "ice").
export function canInherit(personaName, skillNameOrElem) {
  // If a known skill name was passed, resolve to its element
  let elem = skillNameOrElem;
  if (skillData[skillNameOrElem]) {
    elem = skillData[skillNameOrElem].elem;
  }

  // Passives, Almighty, etc might not be in inheritElems. They are always inheritable unless rank=99
  const elemIndex = inheritElems.indexOf(elem);
  if (elemIndex === -1) {
    return true; 
  }
  
  const persona = personaData[personaName];
  if (!persona) return false;
  
  const inheritBits = inheritTypes[persona.inherits];
  if (!inheritBits) return false;
  
  return inheritBits[elemIndex];
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
  fusionChartRaw as fusionChart,
  specialRecipesRaw as specialRecipes,
  compConfigRaw as compConfig
};
