# Design Audit — P3R Fusion Calculator

This document details the issues and recommended improvements for the styling, consistency, spacing, responsiveness, and assets of the Persona 3 Reload Fusion Calculator.

---

## 1. Typography & Font Styling
* **Issue:** The CSS specifies `font-family: 'Inter', ...` but the app does not import the font from Google Fonts in `index.html`. It falls back to default system sans-serif fonts, which can look dry and unpolished.
* **Improvement:** Import Google Fonts `Inter` (for readable, clean text and tables) and `Outfit` (a geometric sans-serif that fits the modern, premium Persona aesthetic) in `index.html` and apply them.

## 2. SEO & Document Metadata
* **Issue:** `index.html` has a generic title `<title>p3r-fusion-calculator</title>` and completely lacks SEO meta description tags.
* **Improvement:** Update the document title to something more descriptive (e.g., `Persona 3 Reload Fusion Calculator`) and add meta tags for description, viewport, and theme color.

## 3. Styling & Spacing Inconsistencies

### A. Sidebar Layout & Form Fields
* **Issue:** The fields in the Calculator configuration sidebar use inconsistent title tags. The "Target Persona" field uses a `<label>` with `fontWeight: 'bold'`, while "Target Skills", "Include Personas", "Exclude Personas", and "Custom Personas" use `<h3>` with `fontSize: '1.1rem'`.
* **Improvement:** Standardize all field headers to use consistent layout containers and typography sizes.
* **Issue:** Layout spacing uses mixed inline styles (`marginTop: '1rem'`) and utility classes. The spacing between the header and main layout is uneven because of `gap-6` (`1.5rem`) on the container combined with `marginBottom: '2rem'` on the header.
* **Improvement:** Introduce CSS variables for a spacing system (`--spacing-sm`, `--spacing-md`, `--spacing-lg`) in `index.css` and use them consistently.

### B. Inconsistent Button Styling
* **Issue:** Large full-width buttons in the sidebar (like `+ Add Custom Persona` and `Save as Bookmark`) and other action buttons (like `Back to Persona List`) use the class `.icon-btn` inline, combined with custom borders and paddings. The class `.icon-btn` is defined in `index.css` for small, borderless square buttons (like trash/remove buttons) and has a circular hover styling that looks awkward on long rectangles.
* **Improvement:** Create standard class-based button definitions:
  * `.btn-primary` (solid cyan, hovers white)
  * `.btn-outline` (outline cyan, hovers cyan)
  * `.btn-danger` (outline red, hovers red)
  * `.btn-secondary` (subtle border glass, hovers cyan tint)
  This will clean up the inline styles and unify the button system.

### C. Stepper Button Hover States
* **Issue:** The Level Stepper `-` and `+` buttons in the header have no hover/active states, nor is there a cursor pointer indicating they are interactive.
* **Improvement:** Add hover states with smooth transitions, cursor pointer, and small background rings on hover.

### D. Focus Indicators on Borderless Inputs
* **Issue:** Text inputs nested inside containers (like search boxes in `SearchableSelect`, `RequiredPersonaSearch`, and `CustomPersonaModal`) have `border: none` inline to look clean. However, the global `:focus` rule in `index.css` applies a box-shadow and cyan border color on `:focus`. This results in a floating glow boundary inside the borderless input when selected.
* **Improvement:** Disable the direct focus box-shadow on borderless nested inputs. Instead, use a `.input-wrapper` container and apply focus styling to the wrapper via `:focus-within`.

## 4. Tables & Detail Views

### A. Color-Coded Resistances
* **Issue:** Resistances (Weak, Resist, Null, Repel, Drain) are rendered as simple text labels inside a dark tag. In Persona games, resistances are highly visual and color-coded to allow players to instantly assess weaknesses and immunities. Currently, they look identical.
* **Improvement:** Color-code the resistance badges based on their status:
  * **Weak / Weak+:** Soft red background, red border and text.
  * **Resist / Resist+:** Soft blue/azure background, blue border and text.
  * **Null:** Silver/gray background, white text.
  * **Repel:** Soft purple background, purple border and text.
  * **Drain:** Soft green/teal background, green border and text.

### B. Table Row Hovers & Spacing
* **Issue:** Table row hover state (`rgba(0, 229, 255, 0.03)`) is barely visible.
* **Improvement:** Slightly increase the background opacity on hover and add a smooth transition for a more responsive feel.
* **Issue:** The layout inside `PersonaDetail` consists of stacked sections divided by plain borders, making it feel like one long list.
* **Improvement:** Group section details with slightly more spacing and cleaner title borders.

## 5. Responsiveness & Layout
* **Issue:** The main layout grid is hardcoded inline: `gridTemplateColumns: '350px 1fr'`. On tablets and mobile screens, this fixed sidebar width prevents proper wrapping, leading to clipping and horizontal overflow.
* **Improvement:** Define a responsive layout class (`.app-layout`) in `index.css` that displays as a single column on viewports under `1024px` and grid columns on larger viewports.

## 6. Animations
* **Issue:** Animations are defined as `@keyframes` in `index.css` but their class triggers (`.anim-fade-slide-down`, `.anim-fade-up`) are marked `/* animation disabled */` and empty. The app feels static on state transitions.
* **Improvement:** Enable these animations with smooth cubic-bezier transitions (`0.16, 1, 0.3, 1`) to provide premium micro-interactions.

## 7. Code Cleanup
* **Issue:** `src/App.css` is an unused file left over from the Vite template. It contains classes like `.hero`, `.vite`, `.framework`, `.ticks` which are completely absent in the app.
* **Improvement:** Delete `src/App.css` to keep the codebase clean.
* **Issue:** `BookmarkModal.jsx` line 163 uses `\u00b7` directly in JSX text: `{b.targetPersona} \u00b7 {b.targetSkills.length} skills`. In React JSX, unicode escape sequences are not evaluated in raw text and will render literally as `\u00b7`.
* **Improvement:** Wrap the sequence in curly braces `{' \u00b7 '}` or use the actual bullet character ` · ` to fix the display bug.
