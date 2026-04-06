# CLAUDE.md — First Light Development Rules & Philosophy

This file defines the architecture, philosophy, and rules for building First Light.
Read it before writing any code. Follow it strictly.
Update it when new systems or patterns are introduced.

---

## Project Overview

**Vesper / First Light** — A procedural world generator for an exploration game.
Given a seed, it generates a complete world — gods, histories, cultures, regions — as
structured data across cascading layers. The same seed always produces the same world.
Higher weirdness produces stranger, more distant connections.

The generation cascade: **Concept Graph → Graph Walk → Myth Structure → Pantheon → History → Geogony → Biogony → Anthropogony → Chorogony → Hierogony → Politogony → The Present**

Future layers will build on top of the myth: cultures and politics emerging
from the story rather than the other way around. All layers produce structured data —
prose is exclusively the scene renderer's concern.

Built with: **Vite**, **Vanilla JS**, **HTML/CSS**.
No canvas. No frameworks. No production dependencies.
Deployed to: **Cloudflare Pages**.

### Current Layer
Layer 8: The Present — what is happening right now, when the player arrives.

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
  main.js        — Entry point. Wires graph, world, and UI. buildWorld() orchestrates layers.
  world.js       — World typedef, createWorld(), addAgent(), findAgent(). Shared mutable state.
  utils.js       — mulberry32 PRNG, hashSeed, clamp, lerp, pick, pickN, weightedPick, conceptOverlap, scoreEntityPlacement.
  concepts.js    — Concept graph data (triples array) + buildGraph() + CONCEPTS set.
  walker.js      — walkFrom(), findCollisions(), findParadoxes(), walkAll().
  myth.js        — Thin orchestrator: picks a recipe, runs it, stamps seed.
  pantheon.js    — generatePantheon(graph, world, rng). Pushes agents into world.
  pantheonShapes.js — Per-recipe shape functions: SHAPES registry keyed by recipe name.
  naming.js      — Phoneme-driven naming: palettes, syllable gen, nameWorld(), nameAgents(), nameRegion().
  history.js     — generateHistory(graph, world, rng). Mutates agents, pushes events/regions.
  historyArchetypes.js — ARCHETYPES registry: 8 event archetype functions.
  geogony.js     — generateGeogony(graph, world, rng). Sets world.geogony, adds landscape agents.
  geogonyArchetypes.js — GEOGONY_SHAPES registry: 8 formation archetype functions.
  biogony.js     — generateBiogony(graph, world, rng). Sets world.biogony (lifeforms, flaw life, extinctions).
  biogonyArchetypes.js — BIOGONY_SHAPES registry: 6 life-origin archetype functions.
  anthropogony.js — generateAnthropogony(graph, world, rng). Sets world.anthropogony (peoples, memory, disputes).
  anthropogonyArchetypes.js — ANTHROPOGONY_SHAPES registry: 6 people-origin archetype functions.
  chorogony.js   — generateChorogony(graph, world, rng). Sets world.chorogony (enriched regions).
  hierogony.js   — generateHierogony(graph, world, rng). Sets world.hierogony (religions, heresies, sacred sites, practices).
  hierogonyArchetypes.js — HIEROGONY_SHAPES registry: 6 belief-origin archetype functions.
  politogony.js  — generatePolitogony(graph, world, rng). Sets world.politogony (polities, conflicts, alliances, ruins, legends).
  politogonyArchetypes.js — POLITOGONY_SHAPES registry: 6 power-origin archetype functions.
  present.js     — generatePresent(graph, world, rng). Sets world.present (crisis, factions, recentEvent, rumors, activePowers, hiddenTruth).
  presentArchetypes.js — PRESENT_SHAPES registry: 6 present-crisis archetype functions.
  archetypeSelection.js — Shared recipe group sets + applyRecipeBonuses() helper for layer archetype selection.
  conceptResolvers.js — Shared concept resolution: expandConceptCluster, resolveShape, resolveSubstance, resolvePhysicalTraits.
  query.js       — Chainable concept graph query builder. query(graph).where().or().get().
  queryHelpers.js — Reusable semantic concept finders: findTool, findVoid, findArena, etc.
  ui.js          — buildControls(), displayMyth(container, world) — structured data viewer.
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
    exile.js       — Recipe: creator cast out, world shaped from memory of lost origin.
    utterance.js   — Recipe: voice names reality into being, consumed by speaking.
    weaving.js     — Recipe: craftsman assembles world from gathered materials.
    contagion.js   — Recipe: contained thing escapes and spreads uncontrollably.
    mourning.js    — Recipe: world built as memorial to something that died before creation.
    taboo.js       — Recipe: forbidden act creates the world as consequence.
index.html       — App shell: header#controls + main#output. No canvas.
css/main.css     — Dark theme, centered layout, serif typography.
```

Adding a recipe means writing `src/recipes/myRecipe.js` exporting a `MythRecipe` object,
then pushing it onto the `RECIPES` array in `src/recipes/index.js`.

Adding a generation layer means adding `src/newLayer.js` that takes `(graph, world, rng)`
and mutates the shared World object. Wire it in `main.js`'s `buildWorld()`. No registration,
no manifests, no boot loaders.

**Layer conventions:**
- Archetype files: `src/{layerName}Archetypes.js` exporting `{LAYER}_SHAPES` registry
  and `{LAYER}_NAMES` array.
- Archetype context: `{ graph, rng, myth, world }` base shape (matching geogony/biogony/
  anthropogony pattern), with layer-specific fields added as needed.
- Use `archetypeSelection.js` recipe group sets and `applyRecipeBonuses()` for weighted
  archetype selection instead of defining local recipe sets.
- Use `conceptResolvers.js` helpers (`expandConceptCluster`, `resolveShape`, etc.) for
  concept expansion and attribute resolution.
- Use `scoreEntityPlacement()` from `utils.js` for placing entities into regions.
- Add a new entry to `LAYER_RENDERERS` in `ui.js` for the layer's UI panel.

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

Eighteen recipe archetypes: solo-god, pantheon-war, world-birth, sacrifice, splitting,
accident, cycle, rebellion, theft, dream, corruption, symbiosis, exile, utterance,
weaving, contagion, mourning, taboo.

### Query Helpers
`src/queryHelpers.js` provides reusable semantic concept finders with tiered fallbacks:
`findTool`, `findVoid`, `findArena`, `findCreator`, `findBirthplace`, `findDreamer`,
`findPerfection`. Each tries the
specific category first (e.g. `is item`) and widens to semantic matches (e.g. anything
with a `shape` edge) when the pool is too shallow. Recipes use these instead of rigid
category queries.

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

### World Object
All generation layers write into a single mutable `World` object (`src/world.js`).
No layer is "done" — each enriches the shared state. `createWorld(seed)` produces
an empty shell; layers fill it sequentially.

**Structure:** `seed`, `myth`, `agents[]`, `tensions[]`, `events[]`, `regions[]`, `geogony`, `biogony`, `anthropogony`, `chorogony`, `hierogony`, `politogony`, `present`.

**Agent registry:** `world.agents` is the single canonical array. All agents — whether
from the pantheon, spawned during history, or born as landscape spirits — live here.
Each agent has a stable `id` (string, e.g. `"agent-0"`) assigned by `addAgent()` and
an `origin` field (`'pantheon'`|`'history'`|`'landscape'`) for layer provenance.
Relationships reference agents by `id`, not index.

**`addAgent(world, agent, origin)`** — the only way agents enter the array.
**`findAgent(world, id)`** — lookup by id.

### Pantheon System
`generatePantheon(graph, world, rng)` pushes agents into `world.agents` via `addAgent()`.
Uses a separate RNG stream (`seed + '-pantheon'`) to isolate from myth generation.

**Pipeline:** Extract primary agents → Derive secondary agents → Assign dispositions →
Generate titles → Assign relationships → Determine states.

**Agent structure:** id, name, title (epithet), type (god/demi-god/spirit/demon/ancestor/herald),
domains (2-4 concepts), disposition (from `evokes` edges), relationships (rival/parent/
sibling/slayer/creator/ward), mythRole, alive, state (active/dead/sleeping/imprisoned/
exiled/transformed/forgotten), origin.

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
- Exile → exiled god + origin spirit (transformed) + homesickness demon
- Utterance → dead speaker god + named-world spirit + unnamed demon + herald
- Weaving → crafter god + tool spirit + material ancestor (transformed) + flaw spirit
- Contagion → source spirit + container ancestor (dead) + bloom demons (no gods)
- Mourning → mourner god + dead ancestor + memorial spirit + grief demon
- Taboo → transgressor demi-god (exiled) + law spirit (dead) + consequence god + taboo herald

**Secondary derivation:** If primaries < 4, walks from flaw/important concepts to derive
spirits until 3-7 total agents.

**Titles:** Four epithet patterns from graph edges: "the [Disposition]",
"Who-[Verb]-in-[Domain]", "[Adjective] of [Domain]", "the [State-Participle]".

**Relationships:** `collides` → rival, `consumes` → slayer, `transforms`/`produces` → parent,
shared `is` category → sibling. Myth-derived: creator mythRole + derived → creator/ward.

### Naming System
`nameWorld(graph, myth, rng)` generates a 2-3 syllable world name from the myth's
concept sound profile (100% world signature, no agent blending).
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

**Region naming:** `nameRegion(graph, concepts, rng)` generates 2–3 syllable place
names driven purely by a region's concept cluster sound profile. No world-signature
blending — regions should sound distinct from each other.

### Geogony System
`generateGeogony(graph, world, rng)` sets `world.geogony` and adds landscape agents
to `world.agents`. Uses a separate RNG stream (`seed + '-geogony'`).

**Pipeline:** Name world → Select archetype → Run shape function → Expand terrain
seeds → Expand landmark seeds → Derive materials/climate → Spawn landscape agents →
Enrich history regions.

**8 formation archetypes** in `geogonyArchetypes.js`, keyed by name:
- **Body** — land is a god's corpse (mountains = bones, rivers = veins)
- **Debris** — land is wreckage from a cosmic event (shards, rubble)
- **Growth** — land grew from a seed, root, or coral (organic terrain)
- **Sediment** — land settled from a substance (ash, dust, salt, silt)
- **Sculpture** — land was deliberately shaped (too regular, too purposeful)
- **Precipitation** — land fell from above (star-dust, shattered moon)
- **Extrusion** — land pulled up from below (spires, pillars, ridges)
- **Crystallization** — land condensed from energy/sound/thought (faceted)

**Archetype selection:** Weighted by cosmogony recipe and pantheon state. Dead god
favors body (+4), violent myths favor debris (+3), organic myths favor growth (+3),
concept-based signals boost precipitation/extrusion/crystallization.

**World naming:** `nameWorld(graph, myth, rng)` in `naming.js` generates a 2-3
syllable world name using 100% world signature palette (no agent blending).

**Landscape agents:** 1-3 spirits spawned from ground/water/sky substances (~40%
chance each). Added to `world.agents` with `origin: 'landscape'`.

**Region enrichment:** Each history region gets a `RegionEnrichment` with terrain
types, landmarks, climate, and dominant substance assigned by concept overlap scoring.

### Biogony System
`generateBiogony(graph, world, rng)` sets `world.biogony` with lifeforms, flaw
creatures, and extinctions. Uses a separate RNG stream (`seed + '-biogony'`).

**Pipeline:** Select archetype → Run shape function → Expand lifeform seeds →
Fill to 8-12 → Generate flaw life → Generate extinctions → Name species.

**6 life-origin archetypes** in `biogonyArchetypes.js`, keyed by name:
- **Seeding** — a god scatters life deliberately (walks from creator domains)
- **Spawning** — life emerges uninstructed from terrain or materials
- **Shedding** — creatures formed from body parts of dead/transformed gods
- **Echoing** — life mimics the creation act (fractal repetition)
- **Parasiting** — life feeds on the world's wound (flaw-driven, all are flaw life)
- **Adapting** — life shaped by terrain constraints (1 lifeform per terrain type)

**Archetype selection:** Weighted by cosmogony recipe and world state. Dead gods
favor shedding (+4), deliberate myths favor seeding (+3), organic myths favor
spawning (+3), cyclic/dream myths favor echoing (+3).

**Lifeform structure:** name, concepts (2-4), terrainAffinity (1-2 terrain type names),
behavior (one of 10 types), origin (how it arose).

**10 behavior types:** predator, grazer, burrower, drifter, rooted, parasite,
sentinel, swarm, mimic, decay. Resolved from concept graph edges in priority order.

**Flaw life:** 1-3 creatures linked to `myth.flaw.concepts`. Always behavior
`parasite` or `decay`. Appear in both `flawLife[]` and `lifeforms[]`.

**Extinctions:** 1-3 concepts from `myth.cost` that are fauna/flora/body.
Must not overlap living lifeforms.

**Species naming:** Reuses `nameRegion()` — concept clusters resolved to phoneme
palettes produce 2-3 syllable species names.

### Mythic History System
`generateHistory(graph, world, rng)` mutates `world.agents` directly and pushes
events/regions into the world. Uses a separate RNG stream (`seed + '-history'`).

**Pipeline:** Pick archetype sequence → Event loop (5–8 events) → Name regions →
Name spawned agents.

**MythicEvent structure:** Four beats: situation → action → consequence → legacy.
Each beat has `roles: BeatRoles` and `concepts: string[]`, paralleling the creation
myth's beat structure. Events also carry `agentChanges` (mutations) and `regionTags`.

**8 event archetypes** in `historyArchetypes.js`, keyed by name:
- **War** — two forces clash; loser killed/exiled, region scarred
- **Hubris** — overreach leads to ironic catastrophe; actor imprisoned/transformed
- **Exodus** — displacement; old region gains desolation, new region gains diaspora
- **Discovery** — something buried found; power balance shifts
- **Sacrifice** — essential thing given up to hold the world together
- **Corruption** — something good perverted; agent type may change (god→demon)
- **Sundering** — unity breaks; spawns new agent, creates two regions
- **Return** — creation myth's flaw resurfaces physically; dormant agents reawaken

**Archetype selection:** Position-weighted: event 0 favors consequence-of-flaw archetypes,
later events favor catastrophe/echoing archetypes. No repeats within a history.

**Concept inheritance:** Each event inherits all concepts from the creation myth plus
all previous events. The concept pool grows event by event, creating causal chains.

**Agent mutation:** Events change agent states (killed, exiled, transformed, etc.),
change types (god→demon), add relationships, and spawn new agents. Changes are
tracked per-event in `agentChanges` (keyed by agent `id`) for display. Mutations
happen directly on `world.agents` — no cloning. Spawned agents are added via
`addAgent(world, agent, 'history')` and join the canonical roster.

**Region creation:** Each event creates 1–2 regions from consequence concepts,
expanded 1-hop via evokes/rhymes to 6–10 concept clusters. Corruption and Return
also tag existing regions. Target: 6–12 regions after 5–8 events.

### Anthropogony System
`generateAnthropogony(graph, world, rng)` sets `world.anthropogony` with peoples,
common memory, and disputes. Uses a separate RNG stream (`seed + '-anthropogony'`).

**Pipeline:** Select archetype → Run shape function → Expand people seeds →
Fill to 3 minimum → Cap at 6 → Derive common memory → Derive disputes.

**6 people-origin archetypes** in `anthropogonyArchetypes.js`, keyed by name:
- **Fashioned** — a god deliberately made peoples from materials
- **Awakened** — existing lifeforms gained sentience
- **Fallen** — diminished gods' descendants, remembering fragments of divinity
- **Exiled** — arrived from elsewhere, carrying foreign memory
- **Split** — one original people divided by the flaw or historical event
- **Unintended** — peoples arose as a side effect, not a goal

**Archetype selection:** Weighted by cosmogony recipe, agent states, biogony
recipe, and history events. Dead gods favor fallen (+4), deliberate myths favor
fashioned (+3), sundering events favor split (+4).

**People structure:** name, concepts (4-6), creatorAgent, patronAgent, purpose
(force concept), gift (item concept), flaw (from myth flaw), terrainAffinity
(1-2 terrain types), remembers (myth act/cost echoes), fears (myth flaw echoes),
physicalTraits (texture/shape/color from graph edges), origin.

**Common memory:** Myth concepts shared across 2+ peoples' concept clusters.

**Disputes:** Flaw concepts that divide peoples — in one people's fears but
another's remembers.

### Chorogony System
`generateChorogony(graph, world, rng)` sets `world.chorogony` with enriched regions.
Uses a separate RNG stream (`seed + '-chorogony'`). Runs **last** in the pipeline,
after all other layers.

**Pipeline:** Copy base regions from history → Absorb geogony enrichments (terrain,
landmarks, climate) → Place peoples by concept+terrain scoring → Place lifeforms
by concept+terrain scoring → Derive resources (materials/items from graph walks) →
Derive dangers (flaw concepts + event consequences + flaw lifeforms) → Derive mood
(evokes edges from dominant concepts).

**ChorogonyRegion structure:** id, name, concepts, taggedBy, primaryEvent,
terrainTypes, peoples, resources, dangers, mood, landmarks, lifeforms, climate.

**Placement algorithm:** Each people/lifeform scored against every region via
conceptOverlap + terrain affinity bonus (+2 per match). Assigned to top 1-2
regions. Entities can appear in multiple regions.

**World structure:** `world.chorogony = { regions: ChorogonyRegion[] }`.

### Hierogony System
`generateHierogony(graph, world, rng)` sets `world.hierogony` with religions,
heresies, sacred sites, and practices. Uses a separate RNG stream
(`seed + '-hierogony'`). Runs after chorogony.

**Pipeline:** Select archetype → Run shape function → Expand religion seeds →
Assign peoples to religions (concept overlap + patron scoring) → Consolidate →
Generate heresies (from disputes + flaw reinterpretation) → Place sacred sites
(religion concepts vs landmark concepts) → Derive practices (rites/taboos/observances
from myth beats) → Apply mutations.

**6 belief-origin archetypes** in `hierogonyArchetypes.js`, keyed by name:
- **Revelation** — a god spoke directly; literal myth interpretation
- **Tradition** — ancestral memory handed down; continuity focus
- **Mystery** — centered on the unknowable flaw; absent gods
- **Gratitude** — worship of what provides; patron gods and gifts
- **Fear** — driven by threats; appeasement of demons/flaw creatures
- **Schism** — born from rejecting another interpretation

**Religion structure:** id, name, peoples (name list), worshippedAgents (agent id list),
taboos, rites, concepts, originEvent.

**Heresy structure:** id, name, religionId, denies (concepts), claims (concepts),
origin, concepts.

**Sacred site structure:** id, name, regionId, landmarkName, religionId, concepts.

**Practice structure:** id, name, religionId, type (rite/taboo/observance), concepts.

**Mutations:** peoples get `religion` field (string id), landmarks get `sacredTo`
(string[] of religion ids), agents get `worshippedBy` (string[] of religion ids).

**World structure:** `world.hierogony = { recipe, religions, heresies, sacredSites, practices }`.

### Politogony System
`generatePolitogony(graph, world, rng)` sets `world.politogony` with polities, conflicts,
alliances, ruins, and legends. Uses a separate RNG stream (`seed + '-politogony'`).
Runs after hierogony.

**Pipeline:** Select archetype → Run shape function → Expand polity seeds →
Assign regions by concept+people+sacred-site scoring → Mark fallen polities and
generate ruins → Generate conflicts (scored by religion, border, resource overlap) →
Generate alliances (scored by religion, patron, common enemy) → Generate legends
(event reinterpretations per polity) → Apply mutations.

**6 power-origin archetypes** in `politogonyArchetypes.js`, keyed by name:
- **Theocracy** — gods rule through priests; one polity per religion
- **Conquest** — one people dominates by force; conqueror + vassals
- **Confederation** — peoples united by shared threat or resource
- **Dynasty** — divine bloodline rules; primary branch + rival branches
- **Merchant** — trade routes and resources drive political power
- **Remnant** — polities formed from ruins of something greater

**Polity structure:** id, name, peopleId, regionIds, capitalRegionId, patronAgentId,
religionId, state (rising/stable/declining/fallen), governanceType, concepts, resources.

**Conflict structure:** id, name, polityIds (pair), cause, concepts, intensity (cold/simmering/open).

**Alliance structure:** id, name, polityIds, basis, concepts.

**Ruin structure:** id, name, regionId, formerPolityId, concepts, whatRemains.

**Legend structure:** id, polityId, eventIndex, interpretation (glorifies/denies/mourns/fears/claims-credit), concepts.

**Mutations:** regions get `controlledBy` (string polity id), agents get `patronOf`
(string[] of polity ids).

**World structure:** `world.politogony = { recipe, polities, conflicts, alliances, ruins, legends }`.

### Present System
`generatePresent(graph, world, rng)` sets `world.present` with the current state
of the world when the player arrives. Uses a separate RNG stream
(`seed + '-present'`). Runs after politogony — the final generation layer.

**Pipeline:** Select archetype → Run shape function → Find flaw-touched events →
Build hidden truth chain (flaw→crisis concept path) → Build crisis (expand from
flaw's latest manifestation) → Build factions (split polities by crisis response) →
Build recent event (the status-quo-breaking trigger) → Build active powers (agents
currently influencing the world) → Build rumors (true/false claims about entities) →
Apply mutations.

**6 crisis archetypes** in `presentArchetypes.js`, keyed by name:
- **Plague** — flaw manifests as spreading corruption (land, life, or mind)
- **Schism** — religious/ideological split turned violent
- **Succession** — power vacuum from fallen ruler/patron/god
- **Invasion** — external or resurgent force threatens established order
- **Depletion** — critical resource, binding, or sacred site is failing
- **Awakening** — something sealed/sleeping/forgotten is stirring

**Crisis structure:** id, name, type (archetype name), concepts (4-6), severity
(brewing/breaking/critical), affectedRegionIds, flawConnection, latestEventIndex.

**Faction structure:** id, name, approach (e.g. quarantine/purify/exploit/flee),
polityIds, religionIds, leaderAgentId, concepts, strength (dominant/rising/desperate).

**RecentEvent structure:** id, name, type (death/discovery/breach/proclamation/omen/collapse),
concepts, involvedEntityIds, regionId.

**Rumor structure:** id, claim (structured template), isTrue, referencedEntityId,
referencedEntityType (agent/ruin/sacred-site/polity), distortion
(null/misattribute/invert/exaggerate/conflate), concepts, regionId.

**ActivePower structure:** agentId, currentAction (stoking/opposing/manipulating/observing/
slumbering/returning), factionAlignment, regionId, concepts.

**Hidden truth:** ordered string[] of 3-6 concepts connecting myth.flaw to crisis.
Each adjacent pair reachable within 2 hops on the concept graph.

**Mutations:** regions get `crisisImpact` (epicenter/affected), polities get
`crisisStance` (faction approach), agents get `presentAction` (active power action).

**World structure:** `world.present = { recipe, crisis, factions, recentEvent, rumors, activePowers, hiddenTruth }`.

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
