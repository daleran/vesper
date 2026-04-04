# PLAN.md — Vesper: World Generator Build Plan

Prioritized step-by-step build plan. Each phase must be complete and working
before moving to the next. Do not skip ahead.

**Project goal:** A procedural island world generator. Geology emerges from
material composition. Flora grows from geology. Fauna follows flora. Culture
follows resources. Eventually: a fully alive world generated from a single seed.

**Immediate goal (Layer 1):** A browser-based geology viewer — generate an
island, inspect any cell, tweak parameters, find a seed that surprises you.

---

## Fixes

Small tweaks and bug fixes. Add when found, remove when resolved.

<!-- fixes go here -->

---

## Generation Cascade

```
Layer 1: Geology   (materials, elevation, coastlines)         ← BUILDING NOW
  └─→ Layer 2: Flora    (plants, fungi, moss — what grows on what)
        └─→ Layer 3: Fauna    (herbivores eat flora, carnivores eat herbivores)
              └─→ Layer 4: Resources (what is useful, and how)
                    └─→ Layer 5: Culture  (religion, values, knowledge)
                          └─→ Layer 6: Architecture & Wealth
                                └─→ Layer 7: Villages & People
                                      └─→ Layer 8: Stories (history, legends, quests)
```

Each layer only reads downward. Flora doesn't know about culture. The emergence
happens because each layer responds to the complexity generated below it.

---

# Layer 1 — Geology Viewer

## Phase 1 — Project Scaffold

**Goal:** Dev server running, canvas visible, camera working.

- [x] 1.1 Restructure: delete all RPG code, create `src/` with new module layout
- [x] 1.2 Port `Game.js` → `src/game.js` (strip scene system, keep loop + DPR)
- [x] 1.3 Port `Camera.js` → `src/camera.js` (add zoom, drag, screenToWorld)
- [x] 1.4 Port `Input.js` → `src/input.js` (add mouse, drag, wheel events)
- [x] 1.5 Create `src/utils.js` — mulberry32 PRNG, hashSeed, clamp, lerp, smoothstep
- [x] 1.6 Rewrite `index.html` — `#tuning-panel`, `#viewport`, `#main-canvas`, `#ui-layer`
- [x] 1.7 Rewrite `css/main.css` — panel + viewport layout, tooltip, dark theme
- [x] 1.8 Update build config — `vite.config.js`, `tsconfig.json`, `jsconfig.json`
- [x] 1.9 Rewrite docs — `PLAN.md`, `CLAUDE.md`, `DEVLOG.md`
- [ ] 1.10 Verify: `npm run validate` passes, `npm run dev` shows dark canvas with sidebar

---

## Phase 2 — Noise & Composition

**Goal:** Noise functions working; per-cell material composition generating across a grid.

- [x] 2.1 Implement OpenSimplex2 noise in `src/noise.js`, verify visual output
- [x] 2.2 Implement `fbm()` (fractal Brownian motion) — stack octaves of noise
- [x] 2.3 Implement island mask in `src/worldgen.js` — radial falloff + noise boundary
  - Params: `islandSize`, `coastNoiseScale`, `coastNoiseAmplitude`, `coastNoiseOctaves`, `fragmentation`
- [x] 2.4 Implement composition generation — per-material noise fields, normalized to sum to 1
  - Each material: independent noise field with `frequency`, `amplitude`, `bias`, `octaves`
  - Weirdness shifts composition toward high-weirdnessAffinity materials
- [x] 2.5 Wire to `GenParams` from `src/tuning.js`; `generateWorld()` returns populated cells
- [x] 2.6 Verify: logging a cell's composition shows a plausible material blend

---

## Phase 3 — Elevation & Erosion

**Goal:** Terrain height emerges from composition; erosion carves features.

- [x] 3.1 Implement `deriveElevation()` in `src/elevation.js`
  - Elevation = weighted average of (hardness × density) across composition
  - Additional noise layer blended in for variety (`elevationNoiseBlend` param)
  - Sea level threshold determines land vs water
- [x] 3.2 Implement `runErosion()` — hydraulic erosion passes based on material stability
  - Low-stability materials (sand, ash, limestone) erode fastest
  - Carves river paths, valleys, karst features
  - Params: `erosionIterations`, `erosionStrength`
- [x] 3.3 Compute `localWeirdness` per cell — weighted average of `weirdnessAffinity`
- [x] 3.4 Verify: elevation map looks like a plausible island when logged as a heightmap

---

## Phase 4 — Renderer

**Goal:** Island renders on canvas with water, land colored by composition, elevation shading.

- [x] 4.1 Implement `buildTerrainTexture()` in `src/renderer.js`
  - Render to offscreen canvas: one pixel per cell (scale up with drawImage)
  - Color by dominant material, modulated by weirdness palette
  - Elevation shading: brightness scaled by elevation
- [x] 4.2 Implement water rendering — flat color with depth-based shading
- [x] 4.3 Implement `renderFrame()` — blit terrain texture via camera transform
- [x] 4.4 Add color modes:
  - `composition` (default) — dominant material color
  - `elevation` — greyscale heightmap
  - `weirdness` — heatmap of local weirdness
- [x] 4.5 Verify: island is visible, distinct from water, colors vary by material

---

## Phase 5 — Camera & Controls

**Goal:** Free pan and zoom across the generated island.

- [ ] 5.1 Wire mouse drag → `camera.pan()` in `src/main.js`
- [ ] 5.2 Wire scroll wheel and Q/E keys → `camera.zoom()` — scroll/Q/E zoom; scroll/key zoom toward cursor or screen center
- [ ] 5.3 Wire WASD / arrow keys → pan
- [ ] 5.4 Wire Home / 0 → `camera.fitToWorld()` — reset to full island view
- [ ] 5.5 Wire double-click → center camera on clicked point
- [ ] 5.6 Implement camera bounds clamping — can't pan into empty void
- [ ] 5.7 Verify: full pan and zoom across the island at 60fps

---

## Phase 6 — Surface Features

**Goal:** Derived features render on top of terrain — ridges, spires, dunes, bogs.

- [ ] 6.1 Implement feature rules in `src/features.js`:
  - Hard rock + high elevation → mountain ridges
  - Sand + low elevation → dunes, beaches
  - Organic + water proximity → marshes, bogs
  - Crystal + any → spires, geometric formations
  - Volcanic + high density → basalt columns
  - Bone + any → fossil ridges, skeletal arches
- [ ] 6.2 At high weirdness, activate weird formation rules:
  - Crystal pillars ignoring surrounding elevation
  - Spiral rock formations in the coastline
  - Honeycomb/geometric patterns in stone
  - Inverted valleys (soft material ridges, hard trenches)
- [ ] 6.3 Render features in `renderer.js` as simple vector shapes (triangles, lines, arcs)
- [ ] 6.4 Verify: features appear in appropriate geological contexts

---

## Phase 7 — Hover Tooltip

**Goal:** Hovering any cell shows full composition, elevation, weirdness, surface type.

- [ ] 7.1 Implement `Tooltip.update()` in `src/tooltip.js` — full data display
  - Over land: position, elevation, dominant material (+ procedural name), full composition %, hardness, density, stability, local weirdness, surface type
  - Over water: position, depth, water type (coastal/deep/etc.), nearest shore distance, seafloor composition
- [ ] 7.2 Integrate `buildNameDict()` from `src/naming.js` — material display names from seed
- [ ] 7.3 Verify naming: same seed → same names; different seed → different names
- [ ] 7.4 Verify tooltip: hover anywhere, data is accurate and updates in real-time

---

## Phase 8 — Tuning Panel

**Goal:** All generation parameters exposed as sliders; regenerate with one click.

- [ ] 8.1 Implement `TuningPanel` DOM construction in `src/tuning.js`
  - Seed input + Randomize + Generate buttons
  - Island shape section
  - Global section (weirdness, elevation, sea level, erosion, blend sharpness)
  - Materials section (expandable per material)
  - Display section (checkboxes + color mode dropdown)
- [ ] 8.2 Bind all sliders to `params` object; show live value readout
- [ ] 8.3 Generate button triggers `generateWorld()`, rebuilds terrain texture
- [ ] 8.4 Show progress indicator during generation
- [ ] 8.5 Implement preset system — load built-in presets; save/load custom presets to localStorage
  - Built-ins: Earthlike, Alien, Archipelago, Volcanic, Marshland, Crystalline, Chaotic
- [ ] 8.6 Verify: adjusting weirdness from 0 to 1 produces clearly different worlds

---

## Phase 9 — Geology Prototype Complete

**Goal:** Prototype success criteria met. Generator is surprising.

- [ ] 9.1 Generate 10+ islands at varying seeds — each one distinct
- [ ] 9.2 Crank weirdness to max — get formations that shouldn't exist
- [ ] 9.3 Hover over any point — composition is plausible and readable
- [ ] 9.4 Tweak parameters → regenerate → explore possibility space
- [ ] 9.5 Find a seed worth showing someone
- [ ] 9.6 Verify: coastlines feel like they emerge from the geology, not from a circle + noise
- [ ] 9.7 **The real test: at least occasionally, the generator produces something unexpected.**

---

# Layer 2 — Flora

> Build after Layer 1 geology viewer is complete and surprising.

Each seed generates 30–80 plant species. Species are generated before placement —
they're the "palette" the world paints with. Flora doesn't get placed: it grows
according to rules responding to geological conditions.

**Planned scope:**
- Plant species generator (body plan, material affinities, traits, color palette)
- Trait system (bioluminescent, parasitic, carnivorous, crystalline, explosive, etc.)
- Gigantism modifier — unusual conditions produce unusual scale
- Placement by suitability score per cell (elevation, moisture, material affinities)
- Flora tooltip data + map visualization layer
- Flora parameters in tuning panel

---

# Layer 3 — Fauna

> Build after Layer 2 flora is complete.

Herbivores are generated from flora (diet → what they need to find). Carnivores
are generated from herbivores (prey → what they hunt). The ecosystem is a cascade.

**Planned scope:**
- Herbivore species generator (diet, body plan, behavior, traits, territory)
- Carnivore species generator (prey list, ambush vs pursuit, pack behavior, traits)
- Population distribution seeded by resource convergence
- Predator-prey ratio enforcement
- Fauna tooltip data + map visualization layer

---

# Layer 4 — Resources

> Build after Layer 3 fauna.

Resources are a lens over existing materials, flora, and fauna. Not new content —
just a reclassification of what already exists by its usefulness to intelligent beings.

**Planned scope:**
- Resource classification by use type: construction, food, medicine, mounts, alchemical
- Scarcity-driven value calculation
- Resource map visualization overlay
- Resource tooltip data

---

# Layer 5 — Culture

> Build after Layer 4 resources.

Cultures emerge from environment and resources. Religion is generated from local
geological and biological features that look miraculous or dangerous.

**Planned scope:**
- Culture generation: values (martial/spiritual/mercantile/etc.), knowledge level,
  taboos, relations to land
- Religion generator: finds the strangest local feature and builds a religion around it
- Inter-cultural relationships (alliance/rivalry/isolation)
- Culture map visualization
- Culture tooltip data

---

# Layer 6 — Architecture & Wealth

> Build after Layer 5 culture.

Building styles are derived from available materials + cultural values + knowledge.
Wealth distribution follows resource control.

**Planned scope:**
- Building style generator (material constraints + cultural aesthetic)
- Wealth distribution from resource control
- Architecture map visualization

---

# Layer 7 — Villages & People

> Build after Layer 6 architecture.

Settlements emerge where resources converge. Population composition is by role.
Notable individuals are generated with personalities and secrets.

**Planned scope:**
- Settlement placement algorithm (resource convergence scoring)
- Population composition (farmers, soldiers, priests, merchants, outcasts)
- Notable individual generator (personality, role, secret, appearance)
- Village map visualization + tooltip

---

# Layer 8 — Stories

> Build after Layer 7 villages.

History is simulated via a simplified timeline. Legends are distorted cultural
memories of real features. Active situations are emergent quest seeds.

**Planned scope:**
- Historical event timeline generator
- Legend generator (distorts a real geological or biological feature)
- Active situation generator (conflict, shortage, discovery, threat)
- Rumors and fragments for NPC dialogue seeding
- Story tooltip data
