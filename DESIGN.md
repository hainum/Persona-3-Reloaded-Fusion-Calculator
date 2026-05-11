# DESIGN.md — Architecture & Agentic Coding Guide

This document describes the architecture, conventions, and decision rationale for the P3R Fusion Calculator. It is intended as the primary reference for both human contributors and **AI coding agents** working on this codebase.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Responsibilities](#module-responsibilities)
3. [Data Flow](#data-flow)
4. [State Management](#state-management)
5. [Styling Conventions](#styling-conventions)
6. [Algorithm Design Decisions](#algorithm-design-decisions)
7. [Adding New Features — Checklist](#adding-new-features--checklist)
8. [Known Constraints & Gotchas](#known-constraints--gotchas)

---

## Architecture Overview

```
                    App.jsx
           (state, orchestration, layout)
              |                    |
     ┌────────┴────────┐  ┌───────┴────────┐
     │ SearchableSelect │  │ PersonaDatabase  │
     │  (UI input)      │  │ (tables, detail) │
     └────────┬────────┘  └───────┬────────┘
              │                   │
              ▼                   ▼
     ┌──────────────────────────────────────┐
     │      FusionCalculator.js              │
     │ (precomputation + backward-chaining)  │
     └────────────────┬─────────────────────┘
                      │
              ┌───────▼────────┐
              │  DataParser.js  │
              │ (JSON -> maps)  │
              └────────────────┘
```

The app follows a **strict layered architecture**:

| Layer | Files | May Import |
|---|---|---|---|
| **UI Components** | `App.jsx`, `SearchableSelect.jsx`, `FusionPathViewer.jsx`, `PersonaDatabase.jsx`, `BookmarkDrawer.jsx`, `BookmarkModal.jsx` | Data layer, Lib layer |
| **Lib (Algorithm / Utilities)** | `FusionCalculator.js`, `BookmarkManager.js` | Data layer only |
| **Data** | `DataParser.js`, `*.json` | Raw JSON files only |

**Rule:** The algorithm layer (`lib/`) must never import from the UI layer. The data layer must never import from `lib/` or `components/`.

---

## Module Responsibilities

### `src/data/DataParser.js`

- Parses all raw JSON files into normalised runtime objects.
- Exposes `personaData`, `skillData`, `fusionChart`, `specialRecipes`, `compConfig`.
- Exposes helper functions: `canInherit(personaName, skillElem)`, `isSkillInheritable(skillName)`.
- Exposes `personaList` (sorted by level) and `skillLearnedBy` (reverse index: skill -> personas).
- `skillLearnedBy` entries are sorted by display level: persona base level for innate, unlock level for learned.
- **Do not** put algorithm logic here. This module is purely data access.

### `src/lib/FusionCalculator.js`

- Contains **all** search and fusion logic.
- Precomputes the recipe map at module load time.
- Exports `findFusionPaths(targetPersona, targetSkills, maxDepth, currentLevel, requiredPersonas)` and `getAllRecipes(personaName)`, `getForwardFusions(personaName)`.
- See [`docs/SEARCH_ALGORITHM.md`](./docs/SEARCH_ALGORITHM.md) for detailed algorithm documentation.

### `src/lib/BookmarkManager.js`

- Pure utility functions for bookmark CRUD and localStorage persistence.
- Exports: `loadBookmarks()`, `saveBookmarks()`, `createBookmark(config)`, `generateBookmarkName(...)`, `findMatchingBookmark(config, bookmarks)`.
- No React dependencies — suitable for use from any layer.

### `src/App.jsx`

- Owns all top-level state (target persona, skills, paths, level, calculation status).
- Orchestrates the calculation via `setTimeout` to avoid blocking the UI thread.
- Renders the two-column layout: configuration sidebar + results main area.
- Contains `RequiredPersonaSearch` inline component for the "Include Personas" filter.

### `src/components/SearchableSelect.jsx`

- Reusable dropdown with search filtering, keyboard-accessible (arrow keys, Enter, Escape).
- Controlled component: receives `value`, `onChange`, `options`.
- Auto-selects single result on Enter press.

### `src/components/FusionPathViewer.jsx`

- Renders an array of fusion path trees.
- Uses a recursive `TreeNode` component that draws connecting lines via absolute-positioned divs.
- Distinguishes innate skills (green, "Learns") from inherited skills (yellow, "Inherits").

### `src/components/PersonaDatabase.jsx`

- Two-tab view: Persona list and Skill list, both sortable and searchable.
- Persona detail view: resistances, innate skills table, learned skills table (sorted by level), reverse/forward fusion recipes.
- Skill detail shows effect description, cost, minimum level, learned-by personas (with level), bookmark CTAs.
- Contains the `getEffect` function that decodes FMT template skill descriptions using the `FMT_DESC` map.
- Owns internal state for search terms, sort columns, selected persona, skill tab.

### `src/components/BookmarkDrawer.jsx`

- Slide-in drawer from the right showing saved bookmarks.
- Each bookmark entry: name, subtitle (persona + skill count), delete button.
- Click loads the bookmark config into the calculator and switches to Calculator view.

### `src/components/BookmarkModal.jsx`

- Two sub-components: `SaveBookmarkModal` (create/edit bookmark with persona, skills, includes) and `AddSkillToBookmarkModal` (add a skill to an existing bookmark).
- Used from both Calculator (save current config) and Database (persona/skill CTAs) views.

---

## Data Flow

```
User selects persona + skills
         │
         ▼
App.handleCalculate()
         │
         ├─▶ Creates/checks Web Worker (self-healing)
         ├─▶ Cancels any in-flight search
         ├─▶ Sends search params via postMessage
         │
         ▼
fusionSearch.worker.js
         │
         ├─▶ Loops depth 1..MAX until exhaustion
         ├─▶ After each depth: posts { type: 'progress', paths }
         └─▶ When done: posts { type: 'done' }
         │
         ▼
App.onmessage handler
         │
         ├─▶ Appends new unique paths to list
         ├─▶ sortedPaths useMemo re-sorts by currentLevel
         └─▶ FusionPathViewer re-renders
```

---

## State Management

All top-level state lives in `App.jsx` via `useState` hooks. There is no external state library.

| State | Type | Persistence |
|---|---|---|---|
| `targetPersona` | `string` | None |
| `targetSkills` | `string[8]` | None |
| `paths` | `PathNode[] \| null` | None |
| `error` | `string \| null` | None |
| `currentSearchDepth` | `number` | None |
| `isCalculating` | `boolean` | None |
| `currentLevel` | `number` | `localStorage('p3r_currentLevel')` |
| `bookmarks` | `Bookmark[]` | `localStorage('p3r_bookmarks')` |
| `bookmarkDrawerOpen` | `boolean` | None |
| `saveBookmarkConfig` | `{ ... } \| null` | None |

**PersonaDatabase internal state:** search terms, sort columns, selected persona, skill tab — all local `useState`.

**Bookmark shape:** `{ id, name, targetPersona, targetSkills[], requiredPersonas[], createdAt }`

**Convention:** Any new user-facing setting that should survive page reloads must be persisted to `localStorage` with a `p3r_` prefix key.

---

## Styling Conventions

- **Global design tokens** are defined as CSS custom properties in `src/index.css` under `:root`.
- **Glassmorphism** is the core visual language: `var(--glass-bg)`, `var(--glass-border)`, `backdrop-filter: blur()`.
- **Utility classes** (`.flex`, `.gap-4`, `.items-center`, etc.) are defined in `index.css`. Use them for layout.
- **Component-specific styles** use inline `style={{}}` props for one-off adjustments. If a style pattern repeats across 3+ places, extract it to a CSS class.
- **No CSS framework** (no Tailwind, no CSS-in-JS). Vanilla CSS only.
- **Colour palette:**
  - Primary: `--p3r-cyan: #00E5FF`
  - Background: `--p3r-dark: #020813`
  - Surface: `--p3r-blue: #0A192F` / `--p3r-light-blue: #1E3A5F`
  - Text: `--p3r-text: #E0F7FA` / `--p3r-text-muted: #809CBA`

---

## Algorithm Design Decisions

### Why backward-chaining?

Forward-chaining (enumerate all possible fusions from base Personas) is intractable — the branching factor is too high. Backward-chaining starts from the desired result and works backward, narrowing the search space significantly.

### Why depth-limited instead of BFS?

BFS would find the absolute shortest path but requires holding the entire frontier in memory. Depth-limited DFS with iterative deepening (the "See Deeper Paths" button) achieves the same optimality guarantee with much lower memory usage.

### Why pre-sort recipes by ingredient level?

This is the core heuristic. By exploring low-level ingredient recipes first, the algorithm naturally finds the most accessible paths first. Combined with the 5-path-per-state limit, this means early results are biased toward feasibility.

### Why limit to 5 paths per state?

The combinatorial explosion of skill distributions (`k^m`) x recipe count x depth makes unbounded collection infeasible. 5 paths per sub-problem keeps memory and time bounded while still providing variety in final results.

---

## Adding New Features — Checklist

When adding a new feature, follow this sequence:

1. **Data layer first** — If the feature requires new game data or new data access patterns, update `DataParser.js` and/or add new JSON files.
2. **Algorithm second** — If the feature changes search behaviour (new filters, new sorting, new constraints), update `FusionCalculator.js`. Add the parameter to `findFusionPaths()` with a sensible default so existing callers don't break.
3. **UI last** — Add state to `App.jsx`, wire it to the UI, and pass it through to the algorithm.
4. **Update docs** — Update this file, `README.md`, and `docs/SEARCH_ALGORITHM.md` if the change affects architecture or algorithm behaviour.

### New Configuration Fields

When adding a new configuration option to the sidebar:

- Add a `useState` hook in `App.jsx`.
- If it should persist, use `localStorage` with a `p3r_` prefix and initialise from storage in the state initialiser function.
- Pass the value to `findFusionPaths()` as a new parameter with a default of `null` or a sensible neutral value.
- Keep the parameter **nullable** — `null` means "not set / don't filter".

---

## Known Constraints & Gotchas

1. **Module-load cost** — The recipe map precomputation (~45k pair evaluations) runs synchronously at import time. This takes ~1-2 seconds on first load. The cost is incurred twice: once in the main thread (for `getAllRecipes` lookups in the UI) and once in the Web Worker (for search). Do not add more O(n^2) work to module scope without profiling.

2. **`searchTree` mutates the `requiredSkills` array** — It calls `.sort()` on the array for the memo key. If you ever need the original order preserved after calling `searchTree`, pass a copy.

3. **Special Personas in normal fusion** — Special-recipe Personas are excluded as *results* of normal fusions but can appear as *ingredients*. This is intentional and matches game behaviour.

4. **Skill unlock levels** — In `demon-data.json`, skill unlock levels < 1 (e.g. 0.1, 0.2) indicate innate skills. The `FusionPathViewer` displays these as "Base" and the Persona detail view shows them in a combined Skills table labelled "Innate".

5. **SkillLearnedBy sorting** — Entries are sorted by display level. For innate skills (level < 1), the persona's base level is used as the sort key; for level-up skills, the unlock level is used.

6. **FMT description templates** — Skill descriptions use an `FMT_DESC` map in `PersonaDatabase.jsx`. `FMTBase` with `power === 0` (status-cure skills) renders just the status effect description. `FMTRecarm` reads the HP percentage from `ailmentChance` (b[7]), not `power` (b[2]).

7. **Web Worker lifecycle** — The worker is created once at app mount and kept alive for the component's lifetime. Worker health is tracked via `workerHealthyRef` — if the worker errors, a flag is set and the next `handleCalculate` call recreates it. The worker is terminated on unmount.

8. **Search is depth-unlimited** — The worker iterates depth from 1 upward up to `MAX_DEPTH=20`, stopping when two consecutive depths yield zero paths. There is no user-facing depth limit — the search exhausts all possible recipe combinations.

9. **Paths include sort metadata** — Each path from the worker carries `_maxLevel` (highest persona level in tree) and `_nodeCount` (total nodes). The main thread uses these in a `sortedPaths` useMemo to keep the list sorted by achievability, fewest nodes, then lowest max level. The sort is re-applied whenever `currentLevel` changes.

10. **Progressive path delivery** — The worker posts results after each depth iteration. The main thread appends new paths and React re-renders immediately. There is no "See Deeper Paths" button — the search continues until exhaustion while the UI stays responsive.
