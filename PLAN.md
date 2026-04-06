# PLAN.md — First Light: Structured World Generation

Prioritized step-by-step build plan. Each phase must be complete and working
before moving to the next. Do not skip ahead.

**Project goal:** A procedural world generator for an exploration game. Given a seed,
generate a complete world — gods, histories, cultures, regions, peoples, religions,
polities, artifacts, and a player character — as structured data across 9 cascading
layers plus artifact and character generators. Same seed, same world. Prose renderers
produce religious texts, landmark descriptions, and regional atmosphere. Two UI modes:
Legends Mode (designer tool) and Game Mode (player interface).

**Generation pipeline:**

```
Concept Graph → L0 Cosmogony → L1 Theogony → History → L2 Geogony →
L3 Biogony → L4 Anthropogony → L5 Chorogony → L6 Hierogony →
L7 Politogony → L8 The Present → Artifacts → Character
                                                  ↓
                                    Renderers (Texts, Landmarks, Regions)
                                                  ↓
                                    UI (Legends Mode / Game Mode)
```

Each layer uses `seed + '-layername'` for its RNG stream. Each layer reads the concept
graph for vocabulary and all previous layers for context. Later layers may mutate entities
from earlier layers to add coherence. All generation layers produce structured data —
prose renderers in `src/renderers/` consume the completed World separately.

---

## The Pivot

The project started as a prose-focused creation myth generator. Layers 0, 1, and a
history prototype are built and working. The project is now pivoting from prose rendering
to structured world data for a playable exploration game.

- `src/prose.js` (918 lines) and `src/historyProse.js` (367 lines) are scheduled for deletion.
- The prose-display UI (`src/ui.js`) is scheduled for rewrite as a structure viewer.
- All downstream layers produce structured data, never prose.

---

## Fixes

Small tweaks and bug fixes. Add when found, remove when resolved.

<!-- fixes go here -->

---

## Layer 0 — Cosmogony (BUILT)

### Phase 0 — Clean Slate ✓

- [x] Delete all geology source files
- [x] Rewrite index.html — header#controls + main#output, no canvas
- [x] Rewrite css/main.css — dark theme, serif typography, centered layout
- [x] Rewrite CLAUDE.md and PLAN.md for new direction
- [x] Stub src/main.js
- [x] Verify: `npm run validate` passes, `npm run dev` shows dark page

---

### Phase 1 — Utils ✓

- [x] `src/utils.js` — mulberry32, hashSeed, clamp, lerp, pick, pickN, weightedPick
- [x] Verify: `npm run validate` passes

---

### Phase 2 — Concept Graph ✓

- [x] `src/concepts.js` — ~100 bootstrap triples, buildGraph(), CONCEPTS set, RELATION_TYPES
- [x] Verify: `npm run validate` passes

---

### Phase 3 — Graph Walker ✓

- [x] `src/walker.js` — walkFrom(), findCollisions(), findParadoxes()
- [x] Weighted neighbor selection: narrative edges 3×, descriptive edges 1×
- [x] Walk depth determined by seed, not a user dial
- [x] Verify: `npm run validate` passes

---

### Phase 4 — Myth Assembly ✓

- [x] `src/myth.js` — generateMyth(graph, seed) → CreationMyth (recipe-based)
- [x] Recipe system: `src/recipes/` — self-contained recipe functions producing CreationMyth
- [x] Four-beat universal structure: before → act → cost → flaw
- [x] Three recipes: solo-god, pantheon-war, world-birth
- [x] CreationMyth interface: creators, important, bad, worldBefore/After, ingredients, extra
- [x] Verify: `npm run validate` passes

---

### Phase 5 — Prose Renderer ✓ *(deprecated — scheduled for deletion in Phase 28)*

- [x] `src/prose.js` — renderProse(myth) → prose string (four-beat template pools)
- [x] Template pools: VOID, ACT, COST, FLAW — one picked per beat via seeded RNG
- [x] Verify: `npm run validate` passes

---

### Phase 6 — UI and Wiring ✓ *(deprecated — scheduled for rewrite in Phase 29)*

- [x] `src/ui.js` — seed input, random button, generate button, output display
- [x] `src/main.js` — final wiring
- [x] `css/main.css` — final styles
- [x] Verify: `npm run validate` + `npm run build` pass

---

### Phase 7a — Query Builder ✓

- [x] `src/query.js` — chainable query builder: query(graph).where().or().direction().get()/first()/random()
- [x] Exposed to browser console via `window.query()` for testing
- [x] Verify: `npm run validate` passes

---

### Phase 7 — Separate Prose from Structure ✓

- [x] Recipes output structured data only — concepts with typed roles (actor, tool, target, product, victim, flaw-source), no description strings
- [x] Remove duplicate description/concepts fields from CreationMyth beats
- [x] Rendering pass assembles prose from structure using template pools
- [x] Renderer pulls sensory detail (color, texture, sound) from concept graph edges
- [x] Verify: same seed still produces same output; `npm run validate` passes

---

### Phase 8 — Widen Concept Pools ✓

- [x] Audit graph for missing categorical edges
- [x] Loosen recipe queries via queryHelpers.js: findTool, findVoid, findArena with tiered semantic fallbacks
- [x] Six recipes now spread generation evenly
- [x] Verify: 10 consecutive seeds show no dominant concept repetition

---

### Phase 9 — Clarify Cost vs. Flaw ✓

- [x] Cost = what was _sacrificed or spent_ — deliberate or inevitable price, past tense, done
- [x] Flaw = the _ongoing wound_ — still wrong, still active, still shaping the present
- [x] Updated all recipes to enforce this distinction
- [x] Verify across seeds: cost and flaw never feel interchangeable

---

### Phase 10 — Enrich Graph Walking ✓

- [x] Every recipe must have at least one `walkFrom` moment
- [x] Add edge-type-aware walking: `walkFrom` accepts `preferRelations` option (5× weight boost)
- [x] Different edge preferences give each recipe's discoveries a distinct character
- [x] Verify: walk results contribute meaningfully to myth output

---

### Phase 11 — New Recipes ✓

- [x] 18 recipe archetypes: solo-god, pantheon-war, world-birth, sacrifice, splitting, accident, cycle, rebellion, symbiosis, theft, dream, corruption, exile, utterance, weaving, contagion, mourning, taboo
- [x] Quality bar: every recipe produces a relationship, an ongoing consequence, and the possibility of paradox
- [x] Verify: 24 seeds produce varied output across all 18 recipes

---

### Phase 12 — Longer Myths ✓

- [x] Expand each beat from 1 sentence to 3–5 sentences by pulling sensory/associative detail from concept graph edges
- [x] Myths carry 12–51 tagged concepts for richer downstream differentiation
- [x] Verify: longer output feels like elaboration, not padding

---

### Phase 14 — Graph Expansion ✓

- [x] Expand concept graph from 180 → 263 concepts
- [x] Expand triples from 1110 → 2070
- [x] Add more sensory concepts, concrete nouns, abstract forces
- [x] `npm run build` produces working dist

---

## Layer 1 — Theogony (BUILT)

### Phase 15–18 — Pantheon Generator ✓

- [x] `src/pantheon.js` — Agent/Pantheon typedefs, generatePantheon() pipeline
- [x] `src/pantheonShapes.js` — SHAPES registry: 18 per-recipe shape functions
- [x] Pipeline: extract primary → derive secondary → dispositions → titles → relationships → states
- [x] Separate RNG stream (seed + '-pantheon') isolates from myth generation
- [x] 3–7 agents per world, type distribution varies by recipe
- [x] Titles from graph edges, relationships from graph edges
- [x] UI: agent cards with color-coded type badges, compact detail lines, tension display
- [x] Verify: 40 seeds × all recipes produce 4–7 agents, no crashes

---

### Phase 19 — Naming Engine ✓

- [x] `src/naming.js` — 8 phoneme palettes keyed by `sound` edge targets
- [x] Sound resolution with evokes/texture fallbacks
- [x] World signature blending: 30% baseline for all names
- [x] Syllable count by agent type: god 1–2, demi-god 2, spirit/demon 2–3, ancestor/herald 2
- [x] Integrated into `generatePantheon()` as step 3.5
- [x] Deterministic: same seed always produces same names
- [x] Verify: `npm run validate` passes, 20 seeds produce varied names

---

## History Prototype (BUILT — being redesigned as Layer 5)

### Phase 20–27 — History Generator ✓

- [x] `src/history.js` — generateHistory(graph, myth, pantheon, rng) → MythicHistory
- [x] `src/historyArchetypes.js` — 8 event archetype functions
- [x] `src/historyProse.js` — renderEventProse() *(deprecated — deleted in Phase 28)*
- [x] 5–8 events per world, concept inheritance between events
- [x] 8 archetypes: war, hubris, exodus, discovery, sacrifice, corruption, sundering, return
- [x] Position-weighted archetype selection, no repeats
- [x] Agent mutation: state changes, type changes, relationship additions, spawning
- [x] Region creation: 1–2 regions per event, 6–12 total, expanded via graph walks
- [x] Region naming via phoneme system
- [x] Verify: 40 seeds × all recipes produce valid histories, no crashes

> This layer will be refactored into Layer 5 Chorogony in Phase 33.

---

## Phase 28 — Pivot: Drop Prose, Keep Structure

- [x] Delete `src/prose.js`
- [x] Delete `src/historyProse.js`
- [x] Remove `renderProse` import and call from `src/main.js`
- [x] Remove `renderEventProse` import and call from `src/history.js`
- [x] Remove `prose` field from `MythicEvent` typedef in `src/history.js`
- [x] Update `CLAUDE.md` — remove prose/sensory-aware prose sections, update project overview and file structure
- [x] Verify: `npm run validate` passes, `npm run dev` still shows data

---

## Phase 29 — Structure Viewer UI

- [x] Rewrite `src/ui.js` as a world data viewer (not prose display)
- [x] Layer accordion: collapsible section per completed layer showing structured output
- [x] Layer 0 panel: recipe name, 4 beats with roles + concepts, creators/important/bad, worldBefore/After
- [x] Layer 1 panel: agent cards (name, title, type, domains, disposition, relationships, state)
- [x] History panel: event timeline with archetype badges, agent changes, region cards
- [x] Raw JSON toggle for any layer's output
- [x] Seed permalink (seed in URL hash)
- [x] Verify: `npm run validate` + `npm run build` pass

---

## Layer 2 — Geogony

**Question:** How was the physical world formed? What is the land itself?

**Inherits from:** Layer 0 (worldBefore/After, ingredients, flaw, concepts) + Layer 1 (agent domains, states, deaths)

### Phase 30 — Geogony Generator ✓

- [x] `src/geogony.js` — generateGeogony(graph, myth, pantheon, history, rng) → Geogony
- [x] `src/geogonyArchetypes.js` — GEOGONY_SHAPES registry: 8 formation archetypes
- [x] Separate RNG stream: `seed + '-geogony'`
- [x] 8 recipe archetypes: body, debris, growth, sediment, sculpture, precipitation, extrusion, crystallization
- [x] Recipe selection weighted by cosmogony recipe and pantheon state
- [x] World naming: `nameWorld(graph, myth, rng)` in naming.js — 2-3 syllable world names
- [x] Landscape agents: 1-3 spirits spawned from ground/water/sky substances
- [x] Region enrichments: terrain types + landmarks assigned to history regions by concept overlap
- [x] Terrain types with shape + substance resolution from graph edges
- [x] Named landmarks via `nameRegion()` pattern
- [x] Materials + climate derived from substances and graph walks
- [x] UI: Layer 2 panel with world name, substances, terrain/landmark cards, landscape agents
- [x] Wire into `src/main.js` after history generation
- [x] Verify: `npm run validate` + `npm run build` pass

---

## Layer 3 — Biogony

**Question:** How was life created? What are the fundamental categories of living things?

**Inherits from:** Layer 0 (ingredients, flaw) + Layer 1 (agent domains) + Layer 2 (terrainTypes, materials, climate)

### Phase 31 — Biogony Generator ✓

- [x] `src/biogony.js` — generateBiogony(graph, world, rng) → Biogony
- [x] `src/biogonyArchetypes.js` — BIOGONY_SHAPES registry: 6 life-origin archetype functions
- [x] Separate RNG stream: `seed + '-biogony'`
- [x] 6 recipe archetypes: seeding, spawning, shedding, echoing, parasiting, adapting
- [x] Output: Biogony { recipe, lifeOriginAgent, lifeforms[], flawLife[], extinctions[] }
- [x] Lifeform = { name, concepts, terrainAffinity, behavior, origin }
- [x] 10 behavior types: predator, grazer, burrower, drifter, rooted, parasite, sentinel, swarm, mimic, decay
- [x] Use naming system for species names via nameRegion()
- [x] The flaw drives at least one parasitic/corrupted life form
- [x] Extinctions from myth cost concepts, non-overlapping with living lifeforms
- [x] Wire into `src/main.js`
- [x] UI: Layer 3 panel in displayMyth() and displayMythBatch()
- [x] Verify: `npm run validate` passes

---

## Layer 4 — Anthropogony

**Question:** How were the peoples of this world made? What races exist?

**Inherits from:** All previous layers. Especially Layer 1 (agents), Layer 3 (lifeforms)

### Phase 32 — Anthropogony Generator ✓

- [x] `src/anthropogony.js` — generateAnthropogony(graph, world, rng) → sets world.anthropogony
- [x] `src/anthropogonyArchetypes.js` — ANTHROPOGONY_SHAPES registry: 6 people-origin archetype functions
- [x] Separate RNG stream: `seed + '-anthropogony'`
- [x] 6 recipe archetypes:
  - **Fashioned** — a god deliberately made a people from materials
  - **Awakened** — existing life gained awareness (from a lifeform)
  - **Fallen** — a diminished god's descendants, remembering fragments of divinity
  - **Exiled** — arrived from elsewhere, carrying foreign memory
  - **Split** — one original people divided by the flaw or a historical event
  - **Unintended** — people arose as a side effect, not a goal
- [x] Output type:
  ```
  Anthropogony {
    recipe: string,
    peoples: People[],            // 3-6 distinct peoples
    commonMemory: string[],       // concepts all peoples share (from myth)
    disputes: string[],           // what peoples disagree about (from flaw/paradoxes)
  }
  ```
  Where `People = { name, concepts, creatorAgent, patronAgent, purpose, gift, flaw, terrainAffinity, remembers, fears, physicalTraits }`
- [x] Every people must trace to a myth concept or agent
- [x] `remembers` and `fears` drawn from myth concepts — peoples carry echoes
- [x] Physical traits from concept graph (texture, shape, color edges from origin concepts)
- [x] Distinct phoneme palettes per people for naming conventions
- [x] Wire into `src/main.js`
- [x] UI: Layer 4 panel in displayMyth() and displayMythBatch()
- [x] Verify: `npm run validate` passes

---

## Layer 5 — Chorogony

**Question:** What regions exist, and what mythic events shaped them?

**Inherits from:** All previous layers. Especially Layer 1 (agents), Layer 2 (terrain), Layer 4 (peoples)

### Phase 33 — Refactor History into Chorogony

> Refactor `src/history.js` and `src/historyArchetypes.js`, not rewrite from scratch.

- [x] Keep `src/history.js` unchanged; add `src/chorogony.js` as a synthesis pass after all layers
- [x] Keep the 8 event archetypes (war, hubris, exodus, discovery, sacrifice, corruption, sundering, return)
- [x] Keep position-weighted archetype selection, no repeats
- [x] Keep agent mutation (state changes, type changes, spawning)
- [x] Keep concept inheritance between events
- [x] Enrich Region type:
  ```
  ChorogonyRegion {
    id: string,
    name: string,
    concepts: string[],
    taggedBy: number[],          // event indices
    primaryEvent: number,
    terrainTypes: string[],      // from Layer 2
    peoples: string[],           // from Layer 4
    resources: string[],         // from concept graph
    dangers: string[],           // from flaw + event consequences
    mood: string[],              // evokes edges from dominant concepts
    landmarks: string[],         // from Layer 2 landmarks placed here
  }
  ```
- [x] Chorogony absorbs geogony enrichments + places peoples/lifeforms + derives resources/dangers/mood
- [x] Target: 6–12 distinct regions after 5–8 events
- [x] Separate RNG stream: `seed + '-chorogony'`
- [x] Wire into `src/main.js`
- [x] Update structure viewer UI with enriched region data
- [x] Verify: `npm run validate` passes, regions feel distinct (limited concept overlap)

---

## Layer 6 — Hierogony

**Question:** What do the peoples believe? How do those beliefs shape their world?

**Inherits from:** Layer 0 (myth, flaw, paradoxes), Layer 1 (agents), Layer 4 (peoples), Layer 5 (regions, landmarks)

### Phase 34 — Hierogony Generator

- [x] `src/hierogony.js` — generateHierogony(graph, world, rng) → sets world.hierogony
- [x] `src/hierogonyArchetypes.js` — archetype functions for religion generation
- [x] Separate RNG stream: `seed + '-hierogony'`
- [x] Output type:
  ```
  Hierogony {
    religions: Religion[],       // 2-5 faiths
    heresies: Heresy[],         // 1-3 forbidden interpretations
    sacredSites: SacredSite[],  // tied to regions + landmarks
    practices: Practice[],      // rites, taboos, observances
  }
  ```
  Where:
  - `Religion = { id, name, peoples[], worshippedAgents[], taboos[], rites[], concepts[], originEvent }`
  - `Heresy = { id, name, religionId, denies[], claims[], origin, concepts[] }`
  - `SacredSite = { id, name, regionId, landmarkName, religionId, concepts[] }`
  - `Practice = { id, name, religionId, type, concepts[] }`
- [x] The flaw and paradoxes become the schisms — different peoples interpret the same events differently, producing distinct religions
- [x] **Mutates earlier entities:** peoples get `religion` field, landmarks get `sacredTo`, agents get `worshippedBy`
- [x] Naming: `nameRegion()` pattern for religion and heresy names
- [x] Wire into `buildWorld()` after `generateChorogony()`
- [x] UI: Layer 6 panel with religion cards, heresy cards, sacred site list
- [x] Verify: `npm run validate` passes

---

## Layer 7 — Politogony

**Question:** What power structures exist? What kingdoms rose and fell?

**Inherits from:** Layer 4 (peoples), Layer 5 (regions, events), Layer 6 (religions, sacred sites)

### Phase 35 — Politogony Generator

- [ ] `src/politogony.js` — generatePolitogony(graph, world, rng) → sets world.politogony
- [ ] `src/politogonyArchetypes.js` — archetype functions for polity generation
- [ ] Separate RNG stream: `seed + '-politogony'`
- [ ] Output type:
  ```
  Politogony {
    polities: Polity[],          // 3-8 kingdoms/tribes/city-states
    conflicts: Conflict[],       // active tensions between polities
    alliances: Alliance[],
    ruins: Ruin[],              // fallen polities leaving traces
    legends: Legend[],           // culture-specific event interpretations
  }
  ```
  Where:
  - `Polity = { id, name, peopleId, regionIds[], patronAgentId, religionId, state, concepts[], resources[] }`
  - `Ruin = { id, name, regionId, formerPolityId, concepts[], whatRemains[] }`
  - `Legend = { id, polityId, eventIndex, interpretation, concepts[] }` — same event, different telling
- [ ] Power follows resources (regions), belief (religions), and history (events)
- [ ] Ruins are exploration sites — fallen civilizations with concept-tagged remains
- [ ] Legends are structured data — which concepts a polity emphasizes or denies about a historical event
- [ ] **Mutates earlier entities:** regions get `controlledBy`, agents get `patronOf`
- [ ] Wire into `buildWorld()` after hierogony
- [ ] UI: Layer 7 panel with polity cards, conflict list, ruin cards, legend cards
- [ ] Verify: `npm run validate` passes

---

## Layer 8 — The Present

**Question:** What is happening right now, when the player arrives?

**Inherits from:** All layers.

### Phase 36 — Present Generator

- [ ] `src/present.js` — generatePresent(graph, world, rng) → sets world.present
- [ ] Separate RNG stream: `seed + '-present'`
- [ ] Output type:
  ```
  Present {
    crisis: Crisis,              // the flaw's latest manifestation
    factions: Faction[],         // 2-4 groups with incompatible approaches
    recentEvent: RecentEvent,    // what just changed the status quo
    rumors: Rumor[],             // 5-10 hooks (some true, some false)
    activePowers: ActivePower[], // agents currently influencing the world
    hiddenTruth: string[],      // concept chain connecting crisis to original flaw
  }
  ```
- [ ] The crisis traces directly to `myth.flaw` concepts through the chain of events
- [ ] Factions derive from polities/religions splitting on how to respond to the crisis
- [ ] Rumors reference real entities (artifacts, ruins, agents, sacred sites) but may misattribute or invert
- [ ] `activePowers` identifies which agents are alive/active and what they're doing
- [ ] `hiddenTruth` is a concept chain the player can reconstruct through exploration
- [ ] The player arrives at an inflection point — things are about to break
- [ ] Wire into `buildWorld()` after politogony
- [ ] UI: Layer 8 panel with crisis card, faction cards, rumor list, active powers
- [ ] Verify: `npm run validate` passes

---

## Artifacts

**Question:** What mythically significant objects exist? Where are they and what do they mean?

**Inherits from:** All layers. Runs after The Present — artifacts need full world state for condition and placement.

### Phase 37 — Artifact Generator

- [ ] `src/artifacts.js` — generateArtifacts(graph, world, rng) → sets world.artifacts
- [ ] Separate RNG stream: `seed + '-artifacts'`
- [ ] Output type:
  ```
  Artifact {
    id, name,
    type:          weapon | vessel | instrument | fragment | relic | tool | ornament | text,
    material:      string,          // from world.geogony.materials
    concepts:      string[],        // 3-6 tags defining its nature
    origin: {
      source:      cosmogony | event | god | regional,
      eventIndex:  number | null,
      agentId:     string | null,
      regionId:    string,
    },
    significance:  sacred | cursed | forgotten | disputed | hidden | broken,
    condition:     intact | damaged | fragmentary | corrupted | transformed,
    location: {
      regionId:    string,
      landmarkId:  string | null,
      status:      enshrined | buried | carried | lost | scattered,
    },
  }
  ```
- [ ] 8–20 artifacts per world, count scaled by event count and region count
- [ ] At least 1 from cosmogony (the creation tool or the cost remnant)
- [ ] At least 1 per sacrifice event (sacrifice always produces a relic)
- [ ] At least 1 per region (every region has something to find)
- [ ] Four artifact sources:
  - **Cosmogony** — objects from the creation act itself (the well, the bone, the bowl)
  - **Event** — objects produced by mythic history (war weapon, sacrifice relic, discovery find)
  - **God** — objects tied to specific agents (a god's symbol, imprisoned god's chains, dead god's bone)
  - **Regional** — objects from a region's concept cluster (obsidian blade from [obsidian, shard, wound])
- [ ] Names via phoneme system from artifact concept tags
- [ ] Materials from `world.geogony.materials`
- [ ] **Mutates earlier entities:** landmarks get `artifacts[]`, sacred sites may link to artifacts, ruins contain artifacts (condition may degrade)
- [ ] Wire into `buildWorld()` after present
- [ ] UI: Artifacts panel with artifact cards showing origin, location, significance, condition
- [ ] Verify: `npm run validate` passes

---

## World Stabilization

### Phase 38 — Cross-Reference Helpers

- [ ] Generalize entity lookup in `src/world.js`: `findArtifact()`, `findReligion()`, `findPolity()`, `findRuin()`
- [ ] Ensure all entity types across all layers have stable `id` fields
- [ ] Document the complete World shape in `world.js` typedefs
- [ ] Verify: 40+ seeds produce valid complete worlds with no crashes
- [ ] Verify: `npm run validate` passes

---

## Prose Renderers

Renderers consume the completed World and produce text. They live in `src/renderers/`,
never modify World data, and are called by the UI — not by the generation pipeline.

### Phase 39 — Myth-to-Text Renderer

- [ ] `src/renderers/mythTexts.js` — generateMythTexts(graph, world, rng) → MythText[]
- [ ] Separate RNG stream: `seed + '-texts'`
- [ ] 10–30 texts per world, distributed across 8 text types:
  1. **Creation hymn** — reverent, liturgical retelling of cosmogony. Formal repetition, invocation.
  2. **Folk account** — simplified, emotional. "What grandmother told me." Concrete imagery.
  3. **Heretical teaching** — forbidden interpretation. Names different actors, assigns different blame.
  4. **Scholarly fragment** — detached, analytical. Compares accounts, notes contradictions.
  5. **Prayer/invocation** — short, repeatable, ritualistic. Addressed to a specific god.
  6. **Prophecy** — cryptic, imagistic, pulling from flaw and return event.
  7. **Lament** — mourning for a dead or exiled god. The cultural wound of absence.
  8. **Teaching/parable** — moral story derived from mythic event. Hubris → cautionary, sacrifice → duty.
- [ ] Voice variation: same mythic event through different perspectives produces different texts
- [ ] Concept graph provides sensory vocabulary: fire-god texts use fire's color/sound/texture
- [ ] Every god referenced by at least one text
- [ ] Every major mythic event has at least two contradictory accounts
- [ ] Texts reference artifacts by name
- [ ] Output: `MythText { id, type, title, body, perspective, referencedAgentIds[], referencedArtifactIds[], concepts[] }`
- [ ] Verify: `npm run validate` passes

### Phase 40 — Landmark Renderer

- [ ] `src/renderers/landmarks.js` — renderLandmarks(graph, world, rng) → Map<string, string>
- [ ] 1–3 paragraph description per landmark, conveying:
  - **What you see** — physical appearance from concept tags + sensory edges (color, texture, shape, sound)
  - **What you feel** — mood from associated event consequence/legacy
  - **What's here** — artifacts, sacred site markers, creature activity
  - **What happened** — implied, not stated. Show evidence, not story. A shattered altar implies the myth.
  - **What connects** — references to other landmarks, regions, paths
- [ ] Sensory priority: lead with the most striking sense from concept tags
- [ ] Verify: `npm run validate` passes

### Phase 41 — Region Renderer

- [ ] `src/renderers/regions.js` — renderRegions(graph, world, rng) → Map<string, string>
- [ ] 1–2 paragraph atmospheric description per region, conveying:
  - **Terrain** — what the ground looks like, what grows, what the horizon shows
  - **Weather/atmosphere** — air, light, sounds. From climate tags + concept graph sensory edges.
  - **Mood** — emotional register from `evokes` edges on dominant concepts
  - **Wrongness** — flaw-shaped regions feel off without explaining why
  - **Cultural traces** — peoples, polity, religion presence. Architecture, markings, habitation or absence.
- [ ] Verify: `npm run validate` passes

---

## Character Generator

The player character is the mythology's final output — a living instrument sent into a
completed world. The character and the player share the same confusion: neither knows
the mythology, both discover it together.

### Phase 42 — Character Story Generator

- [ ] `src/character.js` — generateCharacter(graph, world, rng) → sets world.character
- [ ] Separate RNG stream: `seed + '-character'`
- [ ] Output type:
  ```
  PlayerCharacter {
    creatorGod:    string,          // agent id of the god who made/sent the player
    purpose: {
      type:        prevent | find | witness | heal | destroy | deliver | remember,
      target:      string,          // artifact, flaw, god, or region
      hidden:      true,            // never stated, only discovered
    },
    concepts:      string[],        // 2-4 from creator god's domains
    arrival: {
      regionId:    string,
      landmarkId:  string | null,
      description: string,          // first prose the player reads — disorienting, sensory, immediate
    },
    appearance: {
      normalcy:    indistinguishable | subtly-wrong | visibly-other,
      details:     string[],        // physical traits from concept tags via sensory edges
    },
    instincts:     string[],        // drawn to related concepts, uneasy around colliders
    reactions: {
      priests:     string,          // creator god's priests welcome/test; rival priests hostile
      commoners:   string,          // based on appearance normalcy
      agents:      string,          // same-god agents serve; rival agents oppose
      artifacts:   string,          // creator god's artifacts glow/warm; rival artifacts resist
    },
  }
  ```
- [ ] Step 1: Choose creator god — prefer active gods with unresolved tensions, gods who lost something in history, gods whose domains relate to the crisis
- [ ] Step 2: Purpose from creator god's situation — corrupted→heal, lost war→find artifact, rival gaining→prevent, dying→witness, betrayed→destroy
- [ ] Step 3: Concept tags (2-4) from creator god's domains
- [ ] Step 4: Arrival location for thematic resonance — far from purpose target if "find", near threat if "prevent", neutral crossroads if "witness"
- [ ] Step 5: Appearance from creator god concept tags filtered through sensory edges
- [ ] Step 6: World reactions from concept overlap between character and other entities
- [ ] **Mutates earlier entities:** arrival region/landmark get `playerArrival: true`
- [ ] Wire into `buildWorld()` as the absolute last generation step
- [ ] UI: Character panel with creator god (clickable), purpose (debug only), arrival, appearance, instincts, reactions
- [ ] Verify: `npm run validate` passes

---

## UI Modes

Two interfaces for two audiences. Both read the same World data. Neither modifies it.

### Phase 43 — Legends Mode (Designer Tool)

> Decompose `src/ui.js` into `src/ui/` modules. Keep old `ui.js` working through
> Phases 34–42 by adding panels for each new layer; decompose only here.

- [ ] `src/ui/shell.js` — app shell, mode switching (legends/game), controls
- [ ] `src/ui/legends.js` — Legends Mode entry point
- [ ] `src/ui/legendsNav.js` — left-pane navigation tree
- [ ] `src/ui/legendsDetail.js` — right-pane data display (migrated render functions from ui.js)
- [ ] `src/ui/legendsProse.js` — prose rendering within legends mode
- [ ] `src/ui/components.js` — shared components (badges, concept tags, meta rows, JSON toggle)
- [ ] Two-pane layout:
  - **Left pane:** Navigation tree + game-view prose for selected node
  - **Right pane:** Debug data — raw JSON, concept tags, edge relationships, renderer decisions
- [ ] Navigation tree structure:
  ```
  World: [name] — Seed: [seed]
  ├─ Cosmogony (beats, creators, concepts)
  ├─ Pantheon (per-agent cards with relationships)
  ├─ History (per-event cards with agent changes)
  ├─ Geogony (substances, terrains, landmarks)
  ├─ Biogony (lifeforms, flaw life, extinctions)
  ├─ Anthropogony (peoples, memory, disputes)
  ├─ Chorogony (per-region cards)
  ├─ Hierogony (religions, heresies, sacred sites)
  ├─ Politogony (polities, ruins, legends)
  ├─ The Present (crisis, factions, rumors)
  ├─ Artifacts (per-artifact cards)
  ├─ Texts (per-text with type badges)
  └─ Character (origin, purpose, arrival)
  ```
- [ ] **Bidirectional linking:** Every entity reference is clickable — click a god's name to jump to their entry, click a region to see its data, click an artifact to see origin/location/texts
- [ ] **Concept search:** Filter the entire world by concept tag across all entity types
- [ ] **Prose/data toggle:** Every node with rendered prose toggles between game-view and debug
- [ ] **Regenerate:** Same seed (determinism check) or new seed (variety check)
- [ ] Delete old `src/ui.js` after migration
- [ ] Update `css/main.css` for two-pane layout
- [ ] Verify: `npm run validate` + `npm run build` pass

### Phase 44 — Game Mode (Player Interface)

- [ ] `src/ui/game.js` — Game Mode entry point
- [ ] `src/ui/gameScene.js` — scene rendering and navigation
- [ ] Single-pane, text-focused, immersive. No concept tags, no debug data, no "generated".
- [ ] Core elements:
  - **Scene text** — 1–3 paragraphs from region/landmark renderers
  - **Choices** — 2–5 options: navigate to adjacent region/landmark, examine, talk, pick up, read inscription
  - **Found texts** — myth texts discovered at sacred sites or with artifacts, visually distinct from scene prose
  - **Inventory** — artifacts the player has found, each examinable for physical description
  - **Journal** — accumulated fragments: texts read, landmarks visited, gods named by NPCs. Loosely organized — the player pieces things together
- [ ] Navigation model: scenes connected as a network (not a map). Region transitions change vocabulary, mood, sensory emphasis. The player *feels* the boundary.
- [ ] Encounter model: active agents appear in their associated regions. Dialogue from concept tags and mythic roles — landscape guardian speaks of the land, returned-flaw demon speaks in riddles, exiled god's spirit speaks with grief.
- [ ] Verify: `npm run validate` + `npm run build` pass

---

## Architecture Notes

**The concept graph as universal vocabulary.** Every layer queries the same graph. A region
tagged `[fire, grief, obsidian]` asks the graph for fire-adjacent colors, grief-adjacent
weather, obsidian-adjacent terrain. The graph is the world's dictionary.

**Entity mutability.** Later layers MAY mutate entities from earlier layers to add coherence.
History mutates pantheon agents. Geogony enriches history regions. Hierogony adds religion
to peoples. Politogony adds controlledBy to regions. Artifacts attach to landmarks.
Entities are always mutable — the cascade builds coherence, not isolation.

**RNG isolation.** Each layer uses `mulberry32(hashSeed(seed + '-layername'))`. Adding or
changing a layer never affects other layers' output for the same seed.

**No prose in the generation pipeline.** All generation layers produce structured data.
Prose renderers in `src/renderers/` consume the completed World and produce text.
Renderers never modify World data.

**Naming extends per layer.** Layer 1 names agents. Layer 2 names landmarks and world.
Layer 3 names species. Layer 4 names peoples. Artifacts, religions, polities, and ruins
all use the phoneme system from `naming.js` with context-appropriate palettes.

**The weirdness dial as hop distance.** Close collisions produce familiar myths. Distant
collisions produce alien ones. A single knob that transforms the entire world's flavor.

**Generation pipeline:**

```
Concept Graph → L0 Cosmogony → L1 Theogony → History → L2 Geogony →
L3 Biogony → L4 Anthropogony → L5 Chorogony → L6 Hierogony →
L7 Politogony → L8 The Present → Artifacts → Character
                                                  ↓
                                    Renderers (Texts, Landmarks, Regions)
                                                  ↓
                                    UI (Legends Mode / Game Mode)
```
