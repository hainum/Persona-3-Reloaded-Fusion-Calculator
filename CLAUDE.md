# CLAUDE.md — P3R Fusion Calculator Workflow

## Feature Implementation Order

1. **Data layer** (`src/data/`) — add/update data structures first
2. **Algorithm** (`src/lib/`) — implement logic with the new data
3. **UI** (`src/components/`, `src/App.jsx`) — build the interface last
4. **Documentation** — update `AGENTS.md`, `DESIGN.md`, `README.md` as needed

## Testing Requirements

- **Every feature must include automated tests.** No exceptions.
- **Terminal-first testing flow:**
  1. `npm run lint` — fix all lint errors
  2. `npm test` — run algorithm tests (plain Node.js, no test runner)
  3. `npm run build` — verify production build succeeds
- **Browser verification is the LAST step.** After terminal checks pass, run `npm run dev` and test interactively.
- When modifying algorithms or data parsing, write or update test cases in `tests/algorithm.test.js` before touching UI code.

## UI Guidelines

- **Always read `DESIGN.md` before creating or modifying UI components.**
- Follow the glassmorphism design system: CSS custom properties in `index.css`.
- No CSS framework (vanilla CSS only).
- No router library — use `useState` for view switching in `App.jsx`.
- New persisted settings: `localStorage` with `p3r_` prefix.
- Unicode in JSX text content must use `{'\uXXXX'}` syntax, not raw `\uXXXX`.

## Documentation

- Update `AGENTS.md` after every feature — keep commands, gotchas, and key files current.
- Update `DESIGN.md` if architecture, layering, or conventions change.
- Update `README.md` for user-facing changes.
- Update `docs/SEARCH_ALGORITHM.md` if the search algorithm changes.

## Verification Checklist (pre-commit)

```
npm run lint      # zero errors
npm test          # all tests pass
npm run build     # production build succeeds
npm run dev       # browser smoke test
```
