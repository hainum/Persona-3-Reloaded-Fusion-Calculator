# Skill Inheritance Rules — Persona 3 Reload

## Inheritance Slot Limits

| Fusion Type | Ingredients | Max Inherited Skills |
|---|---|---|
| **Normal (Bi) Fusion** | 2 personas | **4 skills** |
| **Special Fusion** | 3+ personas | **5 skills** |
| **Orpheus Telos** | 6 personas (Thanatos, Chi You, Asura, Metatron, Helel, Messiah) | **8 skills** |

The number of slots scales with the level of the material Personas. Early-game fusions may only allow 1 inherited skill; the cap increases as higher-level materials are used.

## Inheritance Type Affinity

Each Persona has an **inheritance type** defined in the data files (`inheritTypes` in `comp-config.json`, keyed by `persona.inherits`). This is a bitmask over `inheritElems` that determines which skill elements the Persona can inherit via fusion.

**Universal skills** (inheritable by all Personas regardless of type):
- Passive skills (element `pas`) — provided rank < 99
- Support skills (element `sup`)
- Almighty skills (element `alm`) — except exclusive skills like Black Viper
- Auto skills (element `nai`)

## Non-Inheritable Skills

A skill is **non-inheritable** if:
1. Its `rank >= 99` in `skill-data.json` — these are exclusive/unique skills
2. The skill's element is not in the target Persona's inheritance bitmask

Skills with `rank >= 99` are flagged in the UI with a Lock icon (if learned by exactly one Persona) or a "No Inherit" badge.

## Skill Card Bypass

Skill Cards ignore both inheritance type affinity and rank restrictions. Any skill card can be taught to any Persona regardless of compatibility. This is the only way to put an incompatible skill onto a Persona.

## Validation Touch Points

The following locations in the app validate skill inheritance:

| Location | File | What It Validates |
|---|---|---|
| `getMaxInheritedSkills` | `src/lib/FusionCalculator.js` | Returns 8 (Orpheus Telos), 5 (special fusion), or 4 (normal fusion) |
| Worker search | `src/workers/fusionSearch.worker.js:37-42` | `canInherit(targetPersona, skill)` for all target skills before searching |
| `findFusionPaths` | `src/lib/FusionCalculator.js:344-349` | `canInherit` element check + slot count check (targetSkills.length > maxSlots) |
| `searchTree` | `src/lib/FusionCalculator.js:189,196-199` | `canInherit` element check + `stillRequired.length > getMaxInheritedSkills` for every fusion step |
| Calculator skill selects | `src/App.jsx` | Filters out rank >= 99 (non-inheritable) skills; shows element-compatibility warning + slot-overflow warning |
| Save Bookmark modal | `src/components/BookmarkModal.jsx` | Visual warning for element-incompatible skills + slot-overflow warning |
| Add Skill to Bookmark modal | `src/components/BookmarkModal.jsx` | Blocks adding if incompatible with target persona's element or if slot count would exceed max |
| `handleAddSkillToBookmark` | `src/App.jsx:145-153` | Guards state: blocks incompatible skills and slot overflows |
| Bookmark Drawer | `src/components/BookmarkDrawer.jsx` | Shows incompatible skill count + slot overflow per bookmark |
| Skill Database list | `src/components/PersonaDatabase.jsx` | Shows Lock/No-Inherit indicator for rank >= 99 skills |

## Implementation

### `getMaxInheritedSkills(personaName)` in `src/lib/FusionCalculator.js`

```js
if (personaName === 'Orpheus Telos') return 8;
if (specialRecipeResults.has(personaName)) return 5;
return 4;
```

This is the single source of truth for the slot cap. It is used by:
- `searchTree` — rejects any recipe step where the number of skills to inherit exceeds the cap
- `findFusionPaths` — returns an error immediately if the target persona has too many target skills
- All UI components that display or edit skill selections

## References

- **Game8** — "Skills Can Now Be Inherited Manually" / "Can You Inherit Skills?" (https://game8.co/games/Persona-3-Reload/archives/440333)
- **Samurai Gamers** — "Use high-level Persona materials to increase the skill inheritance limit" (https://samurai-gamers.com/persona-3-reload/p3re-skill-inheritance-guide/)
- **Steam Community Guide** — "Bi-Fusions are locked to only 4 inheritance slots" (https://steamcommunity.com/sharedfiles/filedetails/?id=3210082034)
