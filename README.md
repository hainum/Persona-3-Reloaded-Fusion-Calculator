# Persona 3 Reload — Fusion Calculator

A high-performance, client-side web application that calculates optimal fusion paths for any target Persona in **Persona 3 Reload**, with full support for skill inheritance rules, special recipes, and player-level-aware path prioritisation.

Built with **React 19** and **Vite 8**.

---

## Features

| Feature | Description |
|---|---|
| **Backward-Chaining Path Search** | Recursive, depth-limited algorithm that finds valid fusion trees from the target Persona back to base ingredients. |
| **Skill Inheritance Enforcement** | Strictly applies P3R's element-based inheritance bitmask. Rank-99 (exclusive) skills are automatically excluded from inheritance. |
| **Level-Aware Prioritisation** | Set your current player level; paths whose ingredients are all within your level are surfaced first. |
| **Persona Count Filter** | Optionally constrain results to paths that use exactly *N* total Personas. |
| **Special Recipe Support** | Multi-ingredient special fusions (e.g. Messiah, Orpheus Telos) are included alongside normal 2-way fusions. |
| **Progressive Depth** | Start with a shallow search and click *See Deeper Paths* to incrementally widen the search space. |
| **Persistent Settings** | Current level is persisted to `localStorage` across sessions. |
| **Glassmorphism UI** | Dark-mode, game-themed interface with searchable dropdowns, animated tree visualisation, and responsive layout. |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18

### Install & Run

```bash
npm install
npm run dev
```

> **Windows PowerShell note:** If you encounter execution-policy errors, run `cmd /c npm run dev` instead.

Open the URL printed in the terminal (usually `http://localhost:5173`).

### Production Build

```bash
npm run build
npm run preview
```

---

## Usage

1. **Set your level** — Use the level input in the header bar to match your in-game level. Paths achievable at your level are shown first.
2. **Select a Target Persona** — Pick from the searchable dropdown in the Configuration panel.
3. **Select Target Skills** — Choose up to 8 skills you want the Persona to inherit.
4. **Calculate** — Click **Calculate Paths**. The first 5 shortest paths are returned.
5. **Go deeper** — If no paths are found (or you want more options), click **See Deeper Paths** to increase the search depth by 1.

---

## Project Structure

```
p3r-fusion-calculator/
├── index.html                  # Entry HTML
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx                # React root mount
│   ├── App.jsx                 # Top-level app component & state
│   ├── App.css                 # Legacy / scaffolding styles
│   ├── index.css               # Global design system (glassmorphism tokens, utilities)
│   ├── components/
│   │   ├── SearchableSelect.jsx  # Searchable dropdown with keyboard & click support
│   │   └── FusionPathViewer.jsx  # Recursive tree renderer for fusion paths
│   ├── data/
│   │   ├── DataParser.js         # Parses raw JSON into runtime lookups
│   │   ├── demon-data.json       # All Personas: level, arcana, inherits, skills, stats
│   │   ├── skill-data.json       # All skills: element, target, rank, cost
│   │   ├── fusion-chart.json     # Lower-triangular arcana × arcana fusion table
│   │   ├── special-recipes.json  # Multi-ingredient special fusion recipes
│   │   └── comp-config.json      # Inheritance element list & type bitmasks
│   └── lib/
│       └── FusionCalculator.js   # Core search algorithm & precomputed recipe map
└── docs/
    └── SEARCH_ALGORITHM.md       # In-depth algorithm documentation
```

---

## Data Sources

Game data is sourced from the [Megaten Fusion Tool](https://github.com/aqiu384/megaten-fusion-tool) compendium and stored as static JSON:

| File | Contents |
|---|---|
| `demon-data.json` | Persona name → level, arcana, inheritance type, skill list, stats |
| `skill-data.json` | Skill ID → name, element, target, rank (99 = uninheritable), cost |
| `fusion-chart.json` | Arcana list + lower-triangular result table |
| `special-recipes.json` | Result Persona → ingredient name list |
| `comp-config.json` | `inheritElems` order + `inheritTypes` bitmask strings |

---

## Tech Stack

- **React 19** — UI components and state management
- **Vite 8** — Dev server and production bundler
- **Lucide React** — Icon set (Settings, Zap, Search, ChevronDown, Check)
- **Vanilla CSS** — Custom glassmorphism design system with CSS custom properties

---

## Contributing

1. Fork & clone the repo.
2. Create a feature branch.
3. Follow the conventions in [`DESIGN.md`](./DESIGN.md) for architecture decisions.
4. Open a pull request.

---

## License

This project is provided for personal and educational use.  
Persona 3 Reload and all related assets are property of ATLUS / SEGA.
