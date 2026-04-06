# CLAUDE.md — First Light Development Rules & Philosophy

This file defines the architecture, philosophy, and rules for building First Light.
Read it before writing any code. Follow it strictly.
Update it when new systems or patterns are introduced.

---

## Project Overview

**Vesper / First Light** — A procedural creation myth generator built in the browser.
Given a seed and a weirdness dial, it generates a creation myth rendered as three prose
fragments (priestly hymn, oral tradition, heretical whisper). The same seed always
produces the same myth. Higher weirdness produces stranger, more distant connections.

The generation cascade: **Concept Graph → Graph Walk → Myth Structure → Prose**

Future layers will build on top of the myth: geography, ecology, and culture emerging
from the story rather than the other way around.

Built with: **Vite**, **Vanilla JS**, **HTML/CSS**.
No canvas. No frameworks. No production dependencies.
Deployed to: **Cloudflare Pages**.

### Current Layer
Layer 1: Creation myth generator — concept graph driven, three voices, text output.

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

### 1. Mythology first, geography second
The world emerges from the myth. Geography is mythology's scar tissue.
A desert exists because a god's blood scorched the earth.
A mountain exists because something vast was buried there.
Never generate terrain and then paste a story on top.

### 2. Authored vocabulary, generative grammar
The concept graph is hand-authored. This is where the designer's voice lives.
The graph walker and myth assembler are generative logic that operates on it.
The author picks the atoms. The system does the chemistry.

### 3. Echo, not explanation
The generator's most important output is not prose — it is tag propagation.
Mythology bleeds into creature names, ruin inscriptions, and biome palettes.
A player should feel the myth in the landscape before they read a word of it.

### 4. Prototype first
The myth generator must produce something surprising before geography begins.
A layer is done when it produces unexpected results, not just correct ones.

---

## File Structure

```
src/
  main.js        — Entry point. Wires graph, myth, prose, pantheon, and UI.
  utils.js       — mulberry32 PRNG, hashSeed, clamp, lerp, pick, pickN, weightedPick.
  concepts.js    — Concept graph data (triples array) + buildGraph() + CONCEPTS set.
  walker.js      — walkFrom(), findCollisions(), findParadoxes(), walkAll().
  myth.js        — Thin orchestrator: picks a recipe, runs it, stamps seed.
  prose.js       — renderProse(myth, graph) — assembles prose from beat roles + sensory edges.
  pantheon.js    — generatePantheon(graph, myth, rng) → Pantheon. Agent pipeline.
  pantheonShapes.js — Per-recipe shape functions: SHAPES registry keyed by recipe name.
  naming.js      — Phoneme-driven naming: palettes, syllable gen, nameAgents().
  query.js       — Chainable concept graph query builder. query(graph).where().or().get().
  queryHelpers.js — Reusable semantic concept finders: findTool, findVoid, findArena, etc.
  ui.js          — buildUI() — DOM controls (seed, generate) and output display.
  recipes/
    index.js       — CreationMyth/BeatRoles/MythRecipe typedefs, RECIPES registry array.
    soloGod.js     — Recipe: single god from force/element creates world from void.
    pantheonWar.js — Recipe: gods fight, one slain, victor shapes the world.
    worldBirth.js  — Recipe: fauna god births the world, enemies kidnap it.
    sacrifice.js   — Recipe: creator destroys itself, body becomes the world.
    splitting.js   — Recipe: primordial unity divided, fragments become the world.
    accident.js    — Recipe: unintended collision between forces creates the world.
    cycle.js       — Recipe: recurring creation, new world from old world's ruins.
    rebellion.js   — Recipe: creations overthrew creator, world built on corpse.
    theft.js       — Recipe: creation stolen from another entity, world as crime.
    dream.js       — Recipe: reality hallucinated by sleeping entity, might wake.
    corruption.js  — Recipe: something perfect was ruined, perfection lost forever.
    symbiosis.js   — Recipe: two things merged, world is both in permanent tension.
index.html       — App shell: header#controls + main#output. No canvas.
css/main.css     — Dark theme, centered layout, serif typography for prose.
```

Adding a recipe means writing `src/recipes/myRecipe.js` exporting a `MythRecipe` object,
then pushing it onto the `RECIPES` array in `src/recipes/index.js`.

Adding a generation layer (e.g. Geography) means adding `src/geography.js` and wiring
it in `main.js`. No registration, no manifests, no boot loaders.

---

## Key Patterns

### Concept Graph
The graph is a flat array of triples: `[subject, relation, object]`.
Stored in `src/concepts.js` as `TRIPLES`. At runtime, `buildGraph(TRIPLES)` produces
a bidirectional `Map<string, Edge[]>` for O(1) neighbor lookup.

Relation types: `is`, `color`, `sound`, `texture`, `shape`, `evokes`, `rhymes`,
`collides`, `transforms`, `consumes`, `produces`.

### Graph Walker
`walkFrom(graph, rng, startConcept, maxHops, options?)` returns a `ConceptChain`.
Narrative edges (`transforms`, `produces`, `consumes`, `collides`) are weighted 3×
over descriptive edges (`is`, `color`, etc.) so walks follow events, not taxonomy.
Optional `options.preferRelations` boosts specific edge types to 5× for recipe-specific
character (e.g. sacrifice walks prefer `transforms`/`evokes` for metamorphosis flavor).

`findCollisions()` finds where two chains land on the same concept or `collides`-linked concepts.
`findParadoxes()` finds loops, inversions, and self-collisions within chains.

### Recipe System
`generateMyth(graph, seed)` picks a recipe via seeded RNG, runs it, returns `CreationMyth`.
Every myth follows four beats: **before → act → cost → flaw**. Recipes are self-contained
functions in `src/recipes/` that use queries and walks to fill the CreationMyth interface.
Adding variety means adding recipes, not modifying the generator.

Each beat contains `roles: BeatRoles` (a `Record<string, string>` mapping semantic role
names to concept names) and `concepts: string[]`. Recipes never write prose — they output
structured concept roles. The act beat's `verb` role selects the prose template sub-pool.

**Cost vs Flaw distinction:**
- **Cost** = what was sacrificed or spent. Past tense, completed, irreversible. The price is paid.
- **Flaw** = the ongoing wound. Present tense, active, still shaping the world. The scar that won't heal.
Cost is grief. Flaw is haunting. When these are clearly distinct, the myth has temporal depth.

Twelve recipe archetypes: solo-god, pantheon-war, world-birth, sacrifice, splitting,
accident, cycle, rebellion, theft, dream, corruption, symbiosis.

### Query Helpers
`src/queryHelpers.js` provides reusable semantic concept finders with tiered fallbacks:
`findTool`, `findVoid`, `findArena`, `findCreator`, `findBirthplace`, `findDreamer`,
`findPerfection`. Each tries the
specific category first (e.g. `is item`) and widens to semantic matches (e.g. anything
with a `shape` edge) when the pool is too shallow. Recipes use these instead of rigid
category queries.

### Prose Rendering
`renderProse(myth, graph)` returns `{ prose: string, concepts: string[] }`. For each
beat, it gathers sensory data (color, sound, texture, shape, evokes) from the graph for
all concepts in the roles, selects a template from the appropriate pool, and calls it
with the roles and sensory map. After the core template, beat-specific elaborators walk
the graph from the beat's primary concept (evokes/rhymes/sensory chains) to add 1-2
sentences of associative detail. The act pool is selected by the `verb` role (struck,
slew, gave_birth, sacrificed, split, collided, stole, dreamed, corrupted, merged).
Concepts discovered during elaboration are collected and returned alongside the prose.

### Seeded PRNG
All randomness in generation flows from `mulberry32(hashSeed(seed))`.
The same seed always produces the same myth. Never use `Math.random()` in generation code.
The depth and character of graph walks are determined by the seed itself — not by a user-facing dial.

### Query Builder
`query(graph)` returns a chainable `ConceptQuery`.

Filters: `.where(relation, target?)` (AND group), `.or(relation, target?)` (OR within group),
`.direction('fwd'|'rev'|'any')`, `.exclude(...concepts)`, `.nearby(concept, maxHops)`.

Transforms: `.pluck(relation)` follows a relation from results and returns the targets.

Terminals: `.get()` → `string[]`, `.first(rng?)`, `.random(rng, n?)`.

Ranking: `.rank(subjects)` returns a `RankedQuery` scored by 1-hop neighbor overlap.
`RankedQuery` terminals: `.get()`, `.first()`, `.pickTop(rng, n)`, `.pickWeighted(rng)`, `.random(rng, n?)`.

### Sensory-Aware Prose
Prose templates receive both beat roles and a sensory map. Templates are functions
`(roles, sensoryMap) => string` that can optionally reference sensory edges (color,
sound, texture, shape, evokes) from the concept graph to describe concepts in
language shaped by their nature. A void of sleep is described differently than a
void of pit because each has different sensory edges.

### Pantheon System
`generatePantheon(graph, myth, rng)` returns `{ agents: Agent[], tensions: string[] }`.
Uses a separate RNG stream (`seed + '-pantheon'`) to isolate from myth generation.

**Pipeline:** Extract primary agents → Derive secondary agents → Assign dispositions →
Generate titles → Assign relationships → Determine states.

**Agent structure:** name, title (epithet), type (god/demi-god/spirit/demon/ancestor/herald),
domains (2-4 concepts), disposition (from `evokes` edges), relationships (rival/parent/
sibling/slayer/creator/ward), mythRole, alive, state (active/dead/sleeping/imprisoned/
exiled/transformed/forgotten).

**Shape registry:** `SHAPES` in `pantheonShapes.js` — keyed by recipe name, each function
reads its recipe's `extra` field to extract primary agents. No switch/case. Adding a new
recipe means adding one shape function.

**Per-recipe pantheon shapes:**
- Solo-god → 1 god + flaw demon + cost spirit
- Pantheon-war → victor god + slain god (dead) + surviving gods + legacy spirit
- World-birth → parent god + child demi-god (imprisoned) + kidnapper demons
- Sacrifice → dead creator god + body-path spirits (transformed)
- Splitting → dead unity + twin fragment gods + splitter spirit
- Accident → forces as spirits only (no gods)
- Cycle → eternal creator god + dead previous-world ancestor
- Rebellion → dead creator god + rebel demi-gods + ghost spirit
- Theft → thief god + pursuing owner demon + treasure guardian spirit
- Dream → sleeping dreamer god + dream-world spirit + herald
- Corruption → dead perfection spirit + corruptor demon (no gods)
- Symbiosis → twin bound gods + merged-world spirit

**Secondary derivation:** If primaries < 4, walks from flaw/important concepts to derive
spirits until 3-7 total agents.

**Titles:** Four epithet patterns from graph edges: "the [Disposition]",
"Who-[Verb]-in-[Domain]", "[Adjective] of [Domain]", "the [State-Participle]".

**Relationships:** `collides` → rival, `consumes` → slayer, `transforms`/`produces` → parent,
shared `is` category → sibling. Myth-derived: creator mythRole + derived → creator/ward.

### Naming System
`nameAgents(graph, myth, agents, rng)` assigns phoneme-driven names to pantheon agents.
Called inside `generatePantheon()` after building agents, before dispositions.

**Pipeline:** Concept domains → `sound` edge resolution → phoneme palette selection →
syllable assembly → phonotactic validation → name assignment.

**8 phoneme palettes** keyed by `sound` edge targets: roar, whisper, crack, ring, hush,
moan, hum, hollow. Each palette defines onset consonants, vowel nuclei, and codas.
Rare sound targets (silence, echo, wail, rasp, drum) alias to the nearest main palette.

**Sound resolution fallback:** direct `sound` edge → `evokes` neighbor's sound edge →
`texture` mapping (rough→crack, smooth→whisper, soft→hush) → default whisper.

**World signature:** The myth's concepts are resolved to sound qualities; the top 2–3
form a baseline palette blended into every agent's name (30% world, 70% agent domains).
All names in a world share a language feel.

**Agent type → syllable count:** god 1–2, demi-god 2, spirit 2–3, demon 2–3,
ancestor 2, herald 2. Monosyllabic gods feel ancient.

---

## Naming Conventions

- Files: `camelCase.js`
- Classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Concept keys, relation types: `snake_case` (all lowercase)
- CSS classes: `kebab-case`

---

## Rules

- **Never use Math.random() in generation** — always seed from `mulberry32(hashSeed(seed))`
- **No canvas** — this layer is pure text. UI is HTML/CSS only.
- **No hand-authored myth content** — myths emerge from graph walks. Don't write specific myths.
- **The graph is authored, not the output** — you pick the atoms, the system does chemistry.
- **Prototype first** — myth layer must be surprising before geography begins.
- **Validate after every change** — `npm run validate` before marking work done.
- **No dead code** — after any refactor, delete orphaned files and unused exports.

---

## Dead Code

After any major refactor, scan for orphaned files, unused exports, and stale
CSS before moving on. If a file is not imported anywhere, delete it.
