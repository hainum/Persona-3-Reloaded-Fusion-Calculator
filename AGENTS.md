# AGENTS.md — P3R Fusion Calculator

## Commands

| Action | Command | Notes |
|--------|---------|-------|
| Dev server | `npm run dev` | On Windows PowerShell, run `cmd /c npm run dev` if exec-policy blocked |
| Build | `npm run build` | Vite 8 production build |
| Preview | `npm run preview` | Preview production build locally |
| Lint | `npm run lint` | ESLint flat config (`eslint.config.js`) |
| Test | `npm test` | Runs `node tests/algorithm.test.js` — plain Node.js, no test runner |

## Architecture

- **Strict layering** (enforced by convention): `data/` → `lib/` → `components/`. Never import upward.
- **No state library** — all state in `App.jsx` via `useState`. New persisted settings use `localStorage` with `p3r_` prefix.
- **No CSS framework** — vanilla CSS custom properties in `src/index.css`.
- **Top-level nav**: `App.jsx` has Calculator / Database views switched via `useState`. No router library.
- **Canonical references**: `DESIGN.md` (architecture), `docs/SEARCH_ALGORITHM.md` (algorithm).

## Gotchas

- **Module-load cost**: Recipe map precomputation (~45k pair evaluations) runs synchronously at import time (~1–2s). Don't add O(n²) work to module scope without profiling.
- **`searchTree` mutates `requiredSkills`** — calls `.sort()` on the array for the memo key. Pass a copy if original order is needed after the call.
- **`setTimeout(..., 100)`** in `handleCalculate` is a deliberate workaround to let React render "Calculating..." before the synchronous search blocks the main thread. Remove if search becomes async (Web Workers).
- **No Web Worker** — search runs on main thread. Depth 4+ with many skills may freeze UI for seconds.
- **Special recipe personas** are excluded as *results* of normal fusions but can appear as *ingredients*.
- **Skill unlock levels < 1** (e.g. 0.1, 0.2) in `demon-data.json` indicate innate skills. Displayed as "Base", not raw decimal.
- **`findFusionPaths` signature**: `(targetPersona, targetSkills, maxDepth=2, currentLevel=99, requiredPersonas=null)`.
- **Test is standalone** — `algorithm.test.js` replicates `DataParser.js` + `FusionCalculator.js` logic inline instead of importing them. Keep in sync if internals change.
- **New features order**: data layer first → algorithm second → UI last → update DESIGN.md.
- **New config params** to `findFusionPaths`: add as nullable with `null` default ("not set / don't filter").
- **5 paths per sub-problem** limit — hardcoded to prevent combinatorial explosion.
- **Bookmarks persist via `localStorage`** with key `p3r_bookmarks`. `BookmarkManager.js` provides utility functions — no React state management in the lib layer.
- **`SaveBookmarkModal` accepts spread config** (`saveBmConfig` object with `initialPersona`, `initialSkills`, `initialRequiredPersonas`) — always spread `{...saveBmConfig}` rather than passing individual props.
- **Bookmark matching** is by value equality (same persona, skills, required personas). The calculator shows an indicator tag when a match is found.
- **Nav button opens drawer**: The Bookmarks button in the top nav is pushed to the right via `marginLeft: 'auto'`. When adding more nav items, ensure it stays right-aligned.

## Gotchas (continued)

- **Unicode in JSX text**: `\uXXXX` escape sequences are not processed in JSX text content. Wrap in `{'\uXXXX'}` or use the actual character.
- **`getForwardFusions`** in `FusionCalculator.js` — precomputed at module load alongside `recipeMap`. Returns fusions where a given persona is an ingredient.

## Key Files

| Path | Role |
|------|------|
| `src/main.jsx` | React root mount |
| `src/App.jsx` | Top-level state & orchestration, Calculator/Database nav, bookmark drawer/modal state |
| `src/data/DataParser.js` | JSON → runtime maps, `canInherit()`, `isSkillInheritable()`, `personaList`, `skillLearnedBy` |
| `src/lib/FusionCalculator.js` | Recipe precomputation + backward-chaining search + `getForwardFusions()` |
| `src/lib/BookmarkManager.js` | Bookmark CRUD, localStorage persistence, name generation, matching |
| `src/components/SearchableSelect.jsx` | Searchable dropdown |
| `src/components/FusionPathViewer.jsx` | Recursive tree renderer |
| `src/components/PersonaDatabase.jsx` | Persona list + skill list tables, persona detail view, bookmark CTAs on rows |
| `src/components/BookmarkDrawer.jsx` | Slide-in drawer listing bookmarks with load/delete |
| `src/components/BookmarkModal.jsx` | SaveBookmarkModal + AddSkillToBookmarkModal |
| `tests/algorithm.test.js` | All tests (single file, plain Node.js) |
