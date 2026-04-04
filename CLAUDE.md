# CLAUDE.md — Vesper Development Rules & Philosophy

This file defines the architecture, philosophy, and rules for building Vesper.
Read it before writing any code. Follow it strictly.
Update it when new systems or patterns are introduced.

---

## Project Overview

**Vesper** — A procedural island world generator built in the browser.
Terrain, geology, flora, fauna, culture, and stories all emerge from a single seed.
Nothing is hand-authored. The generator discovers content; the designer tunes the rules.

The generation cascade: **Geology → Flora → Fauna → Resources → Culture → Architecture → Villages → Stories**

Built with: **Vite**, **Vanilla JS**, **Canvas 2D API**, **HTML/CSS for UI panels**.
Deployed to: **Cloudflare Pages**.

### Current Layer
Layer 1: Geology viewer. Material composition drives elevation and coastlines.
All other layers are planned but not yet built. See PLAN.md.

---

## Commands

- **Dev server:** `npm run dev` (Vite, hot-reload)
- **Build:** `npm run build`
- **Preview build:** `npm run preview`
- **Lint:** `npm run lint` (ESLint)
- **Type check:** `npm run check` (TypeScript checkJs, no emit)
- **Both:** `npm run validate` (lint + type check)

### Validate After Every Change

**MANDATORY:** After completing any feature, fix, or unit of work, run `npm run validate`
before considering the work done. Fix all errors and warnings your changes introduced.
Do not leave lint violations or type errors behind. The codebase stays clean after every change.

---

## Documentation Workflow

All features move through two stages:

1. **PLAN.md** — prioritized feature list with phase numbers. Ideas start here and get refined.
   Small fixes and tweaks live in the **Fixes** section at the top — no codes, just a flat bullet list.
2. **DEVLOG.md** — one line appended when a feature ships. Format: `YYYY-MMM-DD: Feature — description`

**MANDATORY: Update documentation whenever you make a relevant change. Do not skip.**

| File | Purpose | Mandatory Update Triggers |
|---|---|---|
| `DEVLOG.md` | Major feature progress log | Every session — one line per major feature completed |
| `PLAN.md` | Feature phases and fixes | New ideas added; fixes added/removed; completed items checked off |
| `CLAUDE.md` | This file | New systems, patterns, or architecture changes |

---

## Core Philosophy

### 1. Define rules, not content
The generator makes content. Never hand-author what the system should produce.
A noise field makes material deposits. A weirdness dial shifts what's possible.
If you're writing "put a crystal spire at (200, 300)", something has gone wrong.

### 2. Emergence over authorship
Coastlines emerge from where hard and soft materials meet sea level.
Flora grows where its material affinities match the geology below it.
Culture forms around resources the environment provides.
Each layer responds to the layer below it. You tune the response, not the output.

### 3. Flat source structure — no engine/data split
All JS lives in `src/`. There is no content/engine boundary because there is no
hand-authored content. Everything is generative logic or UI plumbing.

### 4. HTML and CSS own the UI
The canvas renders the world only — terrain, features, cursor.
All panels, tooltips, and controls are HTML + CSS.
Never draw UI text or menus onto the canvas.

### 5. Prototype first
Do not build systems for layers that don't exist yet.
Layer 1 geology must be surprising before Layer 2 flora begins.
A layer is done when it produces unexpected results, not just correct ones.

---

## File Structure

```
src/
  main.js       — Entry point. Wires Game, Camera, Input, worldgen, renderer, tooltip, tuning.
  game.js       — RAF loop, canvas DPR setup, resize handling.
  camera.js     — Pan, zoom (scale), worldToScreen, screenToWorld, bounds clamping.
  input.js      — Keyboard (held + one-shot) and mouse (position, drag, wheel).
  noise.js      — OpenSimplex2 noise, fbm() fractal brownian motion.
  utils.js      — mulberry32 PRNG, hashSeed, clamp, lerp, smoothstep.
  materials.js  — Material definitions (hardness, density, stability, weirdnessAffinity, baseColor).
  worldgen.js   — Island generation pipeline. Returns WorldData.
  elevation.js  — Elevation derivation and erosion simulation.
  features.js   — Surface feature generation (ridges, spires, bogs, etc.).
  renderer.js   — Offscreen terrain texture + per-frame compositing.
  tooltip.js    — Hover inspection DOM element.
  tuning.js     — GenParams defaults, TuningPanel DOM, preset system.
  naming.js     — Procedural material/feature/island name generation per seed.
index.html      — App shell: #tuning-panel, #viewport, #main-canvas, #ui-layer
css/main.css    — Layout, tooltip, panel, dark theme.
```

Adding a generation layer (e.g. Flora) means adding `src/flora.js` and wiring it in `worldgen.js`
and `main.js`. No registration, no manifests, no boot loaders.

---

## Key Patterns

### Generation Parameters (GenParams)
All generation is driven by a single `GenParams` object (defined in `tuning.js`).
`generateWorld(params)` takes it and returns `WorldData`.
The tuning panel reads from and writes to a live params object.
Default values live in `DEFAULT_PARAMS`. Presets are just `GenParams` objects.

### Offscreen Terrain Texture
`buildTerrainTexture(world, display)` renders terrain once to an offscreen canvas.
`renderFrame()` blits it each frame using the camera transform.
Only rebuild when generation params change — not per frame.

### Seeded PRNG
All randomness in generation flows from `mulberry32(hashSeed(params.seed))`.
The same seed always produces the same world. Never use `Math.random()` in generation code.
Use `Math.random()` only for ephemeral visual effects (e.g. animated noise).

### Noise Fields
Each material gets its own noise field seeded independently from the master PRNG.
Use `createNoise2D(seed)` and `fbm(noiseFn, x, y, octaves)` from `src/noise.js`.
Multiple overlapping fields produce compositional blends at their intersections.

### Composition Normalization
After computing all material noise values at a cell, normalize so they sum to 1.
`compositionProperty(composition, 'hardness')` in `materials.js` does weighted averaging.

### Weirdness
Global weirdness (`params.globalWeirdness`) and per-material weirdness override both affect:
- Which materials are more likely to appear (high weirdnessAffinity materials amplified)
- How extreme noise values get (sharper peaks, deeper contrasts)
- Which surface feature rules activate

### Camera Controls
- **Pan:** WASD, arrow keys, or mouse drag
- **Zoom:** Scroll wheel, or Q (zoom out) / E (zoom in)
- **Reset:** Home or 0 key → `camera.fitToWorld()`
- `camera.zoom(delta, pivotX, pivotY)` — always zooms toward cursor position
- `camera.clampToBounds(worldW, worldH)` — called every frame to prevent drift

---

## Coordinate System

- World origin: top-left of the generation grid
- Positive X: right
- Positive Y: down
- Grid cell (cx, cy) maps to world pixels (cx × CELL_SIZE, cy × CELL_SIZE)
- `CELL_SIZE = 10` (10 world pixels per grid cell — each cell ≈ 10m)

---

## Naming Conventions

- Files: `camelCase.js`
- Classes: `PascalCase`
- Constants and param objects: `SCREAMING_SNAKE_CASE`
- Material keys and internal ids: `snake_case`
- CSS classes: `kebab-case`

---

## Rules

- **Never use Math.random() in generation** — always seed from `mulberry32(hashSeed(seed))`
- **No canvas UI** — canvas = world only. Panels and tooltips are HTML/CSS.
- **No hand-authored content** — all content emerges from generative rules
- **Prototype first** — don't build Layer N+1 until Layer N is surprising
- **Validate after every change** — `npm run validate` before marking work done
- **No dead code** — after any refactor, delete orphaned files and unused exports

---

## Dead Code

After any major refactor, scan for orphaned files, unused exports, and stale
CSS before moving on. If a file is not imported anywhere, delete it.
