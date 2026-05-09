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

## Key Files

| Path | Role |
|------|------|
| `src/main.jsx` | React root mount |
| `src/App.jsx` | Top-level state & orchestration |
| `src/data/DataParser.js` | JSON → runtime maps, `canInherit()`, `isSkillInheritable()` |
| `src/lib/FusionCalculator.js` | Recipe precomputation + backward-chaining search |
| `src/components/SearchableSelect.jsx` | Searchable dropdown |
| `src/components/FusionPathViewer.jsx` | Recursive tree renderer |
| `tests/algorithm.test.js` | All tests (single file, plain Node.js) |
