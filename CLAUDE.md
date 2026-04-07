# CLAUDE.md — First Light

**Vesper / First Light** — Procedural world generator. Seed → complete world (gods, histories, cultures, regions) as structured data across cascading layers. Same seed = same world.

Generation cascade (three ages):
- **Setup:** Concept Graph → Graph Walk → Myth → Pantheon
- **Age of Creation:** History → Geogony → Biogony → Anthropogony → Chorogony → Hierogony → Politogony
- **Age of Heroes:** (hero events, legacy mutations)
- **Current Age:** Present → Artifacts → Character
- **Renderers:** mythTexts, regions, landmarks, gloss (read-only, post-generation)

Built with: **Vite**, **Vanilla JS**, **HTML/CSS**. No canvas. No frameworks. No production dependencies. Deployed to: **Cloudflare Pages**.

---

## Commands

- **Dev server:** `npm run dev`
- **Build:** `npm run build`
- **String refs:** `npm run check-strings`
- **Lint:** `npm run lint`
- **Type check:** `npm run check`
- **All three:** `npm run validate`

**MANDATORY:** Run `npm run validate` after every change. Fix all errors and warnings before considering work done.

---

## Documentation

1. **PLAN.md** — prioritized feature list. Ideas and fixes go here first.
2. **DEVLOG.md** — one line per shipped feature: `YYYY-MMM-DD: Feature — description`
3. **CLAUDE.md** — update when architecture changes

---

## Core Philosophy

- **Mythology first** — the world emerges from the myth. Geography is mythology's scar tissue. Never generate terrain and paste a story on top.
- **Authored vocabulary, generative grammar** — the concept graph is hand-authored. The system does the chemistry.
- **Echo, not explanation** — the most important output is tag propagation. Players feel the myth before they read it.
- **Prototype first** — a layer is done when it produces unexpected results, not just correct ones.

---

## Architecture

### World Object
Single mutable `World` in `src/world.js`. All layers write into it sequentially. `createWorld(seed)` makes the shell; layers fill it. `addAgent(world, agent, origin)` is the only way agents enter the array. `findAgent(world, id)` for lookup.

### Layer Convention
- Each layer: `src/layerName.js` taking `(graph, world, rng)`, mutating world
- Wire in `main.js`'s `buildWorld()` — no registration, no manifests
- Archetype files: `src/layerNameArchetypes.js` exporting `{LAYER}_SHAPES` and `{LAYER}_NAMES = Object.keys({LAYER}_SHAPES)`
- Archetype context: `{ graph, rng, myth, world }` base, add layer-specific fields as needed
- Use `archetypeSelection.js` for weighted archetype selection and shared recipe group constants
- Use `conceptResolvers.js` for concept expansion (`expandConceptCluster`, `resolveShape`, etc.)
- Use `scoreEntityPlacement()` from `utils.js` for region placement
- Add entry to `LAYER_RENDERERS` in `src/ui/legendsDetail.js`
- RNG stream: `mulberry32(hashSeed(seed + '-layerName'))`

### Age Orchestrators
`src/ages/creation.js`, `src/ages/heroes.js`, `src/ages/current.js` are orchestrator modules — not layers themselves. They take `(graph, world, seed)`, create their own RNG streams, call generation layers, and emit timeline events. Wire new layers into the appropriate age file, not into `main.js` directly.

### Timeline
`src/timeline.js` — pure data structure for chronological event recording. No generation logic. Age modules write events into `world.timeline` using `makeEventId(age, epoch, subIndex)` and the exported mutation/spawn helpers.

### Recipe Convention
- `src/recipes/myRecipe.js` exporting a `MythRecipe` object
- Push onto `RECIPES` array in `src/recipes/index.js`
- Four beats: **before → act → cost → flaw**. Recipes output structured concept roles, never prose.
- Cost = what was sacrificed (past, irreversible). Flaw = ongoing wound (present, still active).

### Concept Graph
Flat array of triples `[subject, relation, object]` in `src/concepts.js`. Relation types: `is`, `color`, `sound`, `texture`, `shape`, `evokes`, `rhymes`, `collides`, `transforms`, `consumes`, `produces`. Narrative edges weighted 3× over descriptive edges in walks.

### Query Builder
`query(graph).where().or().get()` — chainable. `.rank(subjects)` for scored results. `.pluck(relation)` follows edges. See `src/query.js` and `src/queryHelpers.js`.

### Naming
`nameWorld()`, `nameAgents()`, `nameRegion()` in `src/naming.js`. Phoneme palettes keyed by `sound` edge targets. `nameRegion()` reused for species and artifact names.

### Renderers
Live in `src/renderers/`. Read-only — never mutate world data. Called after all generation layers. Results stored on world object. `src/renderers/sensory.js` and `src/renderers/gloss.js` are shared utilities also imported by generation layers for building descriptions.

### Pronouns
`src/pronouns.js` — assigns pronoun sets to agents during generation and provides `getPronouns`/`referAgent` helpers for renderers. Lives in `src/` (not `src/renderers/`) because it mutates agents.

---

## File Structure

```
src/
  main.js, world.js, utils.js, concepts.js
  walker.js, myth.js, query.js, queryHelpers.js
  naming.js, archetypeSelection.js, conceptResolvers.js
  pronouns.js, timeline.js
  pantheon.js, pantheonShapes.js
  history.js, historyArchetypes.js
  geogony.js, geogonyArchetypes.js
  biogony.js, biogonyArchetypes.js
  anthropogony.js, anthropogonyArchetypes.js
  chorogony.js
  hierogony.js, hierogonyArchetypes.js
  politogony.js, politogonyArchetypes.js
  present.js, presentArchetypes.js
  artifacts.js, character.js
  ages/
    creation.js, heroes.js, current.js
  ui/
    index.js, components.js, shell.js
    legendsDetail.js, legendsNav.js, legends.js
    game.js, gameScene.js
    layers/
      index.js, timeline.js, cosmogony.js, pantheon.js,
      geogony.js, biogony.js, anthropogony.js, chorogony.js,
      hierogony.js, politogony.js, present.js, artifacts.js,
      character.js, mythTexts.js, landmarkDescriptions.js,
      regionDescriptions.js
  renderers/
    sensory.js, gloss.js, landmarks.js, regions.js, mythTexts.js
  recipes/
    index.js, soloGod.js, pantheonWar.js, worldBirth.js,
    sacrifice.js, splitting.js, accident.js, cycle.js,
    rebellion.js, theft.js, dream.js, corruption.js,
    symbiosis.js, exile.js, utterance.js, weaving.js,
    contagion.js, mourning.js, taboo.js
scripts/
  check-strings.js
```

---

## Rules

- **Never use `Math.random()` in generation** — always use `mulberry32(hashSeed(seed))`
- **No canvas** — UI is HTML/CSS only
- **No hand-authored myth content** — myths emerge from graph walks
- **No dead code** — after any refactor, delete orphaned files and unused exports
- **No production dependencies**
