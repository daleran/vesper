# PLAN.md — First Light: Structured World Generation

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

## Completed Work

See [DEVLOG.md](DEVLOG.md) for the full history of shipped features (Phases 0–44).

---

## Fixes

<!-- fixes go here -->

---

## Next Steps

- [ ] **Prose/data toggle** — every Legends Mode node with rendered prose toggles between game-view prose and debug structured data

### Creation + History Overhaul

Move from layer-based generation to **chronological event-based simulation** across three ages. Generation becomes the story. Entities are created on-the-fly as narratives demand. Alliances and rivalries emerge from causal chains rather than random assignment.

---

#### Phase 1 — Event Infrastructure (additive, nothing breaks)

Introduce the event system alongside existing layers. No generation logic changes.

- Define `WorldEvent` type in new `src/timeline.js`: `id`, `age` (`creation`/`heroes`/`current`), `epoch` (ordinal), `archetype`, `beats` (situation/action/consequence/legacy), `concepts[]`, `participants[]`, `mutations: EntityMutation[]`, `spawns: EntitySpawn[]`, `causedBy: string[]`
- Define `EntityMutation` — `{ entityId, field, value, previousValue }`. Generalizes `AgentChange` to any entity type.
- Define `EntitySpawn` — `{ entityType, entityData, assignedId }`. Replaces scattered `addAgent()` calls with explicit spawn records.
- Create `Timeline` structure — `{ events[], currentAge, currentEpoch }` with `addEvent()`, `getEventsForAge()`, `getEventsCausedBy()` helpers.
- Add `timeline` field to `World` typedef in `src/world.js`. Initialize to `null`.
- Write `eventFromMythicEvent()` adapter — converts existing `MythicEvent` → `WorldEvent`.
- Write `buildTimeline(world)` — constructs a read-only Timeline post-hoc from existing data. Called at end of `buildWorld()`.

**After:** `world.timeline` is a read-only view of existing data. All generation unchanged.

---

#### Phase 2 — Age of Creation: Myth + Pantheon + History as Events

Existing myth, pantheon, and history generation emit `WorldEvent`s. Same output shapes, but structured as a story.

- Create `src/ages/creation.js` with `simulateCreation(graph, world, rng)`. Calls `generateMyth()` (recipes preserved), then decomposes `CreationMyth` into events: `primordial-state`, `creation-act`, `creation-cost`, `flaw-emergence`. Each event's `spawns` records which gods/spirits are born.
- Wrap pantheon generation as events: `divine-birth`, `divine-conflict`, `divine-exile`. Each `AgentSeed` → a `divine-birth` event. Relationships → `divine-conflict` / `divine-alliance` events.
- Wrap history generation: `generateHistory` writes `WorldEvent`s to timeline; backfill populates `world.events` for backward compat.
- Update `buildWorld()` — replace `generateMyth()` + `generatePantheon()` + `generateHistory()` with `simulateCreation()`. Output shapes of `world.myth`, `world.agents`, `world.events`, `world.regions` are identical.
- **Determinism snapshot tests** — capture 5-10 seeds under old system, assert identical output after refactor. Regression gate for all subsequent phases.
- RNG: each event-generation step gets a sub-stream (`seed + '-creation-evt-' + epoch`). Myth/recipe selection keeps original streams.

**After:** Timeline has 10-20 creation events. All downstream layers unchanged. `world.myth` stays first-class — too useful as a lookup structure to scatter across events.

---

#### Phase 3 — Age of Creation: Physical World as Events

Terrain, life, and peoples become creation events causally linked to divine events. "Geography as mythology's scar tissue" becomes literal.

- New creation archetypes: `landmass-formed`, `life-emerges`, `people-created`, `great-migration`, `divine-gift`, `divine-curse`
- Decompose `generateGeogony`: archetype selection → `world-shaped` event; each landmark → `landmark-created` event with `causedBy` pointing to its divine cause; landscape spirits → `spirit-born` events.
- Decompose `generateBiogony`: each lifeform group → `life-emerges` event; flaw creatures → events caused by the flaw event.
- Decompose `generateAnthropogony`: each people → `people-created` event; `creatorAgent`, `gift`, `flaw` set by event mutations.
- Implement `materializeWorldState(world)` — reads timeline, populates `world.geogony`, `world.biogony`, `world.anthropogony` as materialized views identical to old output.
- Introduce `EventContext` pattern: `{ graph, rng, world, timeline, causedBy, epoch }`. Replaces current archetype context from `historyArchetypes.js`.

**After:** Creation age has 30-50 events. Every terrain, landmark, lifeform, and people has a creation event with causal links. Downstream layers read materialized views unchanged.

---

#### Phase 4 — Age of Heroes: Simulation Loop

Dissolve chorogony, hierogony, and politogony into chronological simulation. Kingdoms form, religions emerge, wars happen, heroes are born — all as causal events. Largest phase — may be split into 4a (chorogony), 4b (hierogony), 4c (politogony).

- Create `src/ages/heroes.js` with `simulateHeroAge(graph, world, rng)`. Runs 15-30 events: examine state → pick archetype → apply mutations/spawns → advance epoch.
- Hero Age archetypes (reusing existing layer logic): `kingdom-founded`, `religion-established`, `prophet-appears`, `war-between-kingdoms`, `alliance-formed`, `hero-born`, `hero-quest`, `artifact-forged`, `artifact-found`, `monument-built`, `monument-falls`, `great-disaster`, `text-written`, `text-lost`
- Needs-based archetype selection: no kingdoms → weight `kingdom-founded`; kingdoms but no religions → weight `religion-established`; 2+ kingdoms → `war-between-kingdoms` possible; etc. Minimum quotas prevent degenerate worlds.
- Causal chain tracking: every event has `causedBy` references. Wars caused by founding events + provocation. Alliances caused by wars.
- Dissolve chorogony: region synthesis happens incrementally as events fire. Materialize `world.chorogony`.
- Dissolve hierogony: `religion-established` / `prophet-appears` / schism events replace bulk generation. Materialize `world.hierogony`.
- Dissolve politogony: polities, conflicts, alliances, ruins all from Hero Age events. Materialize `world.politogony`.
- Add `hero` to Agent types in `src/pantheon.js`.
- Per-event RNG: `seed + '-heroes-evt-' + epoch`.

**After:** Timeline has 50-80 events. Three layers replaced by simulation. Alliances and rivalries have causal histories.

---

#### Phase 5 — Current Age: Present + Character as Events

Present layer becomes Current Age simulation. Factions, crisis, rumors, and player character emerge from recent events causally linked to the deep past.

- Create `src/ages/current.js` with `simulateCurrentAge(graph, world, rng)`. 5-10 events.
- Current Age archetypes: `crisis-emerges`, `faction-forms`, `recent-prophecy`, `rumor-spreads`, `power-stirs`, `character-arrives`
- Hidden truth chain made explicit: each link is a `WorldEvent` with `causedBy` pointing to the previous link, walkable backward from crisis to flaw.
- Character generation → `character-arrives` event (final event in timeline).
- Remove `present.js` + `character.js` layer calls from `buildWorld()`. Materialize `world.present`, `world.character`.

**After:** Full timeline spans all three ages with 60-100 events. Every entity has a creation story.

---

#### Phase 6 — Timeline UI + Cleanup

Remove backward-compat scaffolding. Timeline becomes primary. UI gets a timeline view.

- Timeline view in Legends Mode: events grouped by age, expandable to show beats/participants/mutations/spawns, with links to affected entities.
- Causal chain visualization: "caused by" / "led to" links on every event; creation event + participation history on every entity.
- Refactor `LAYER_RENDERERS` in `src/ui/legendsDetail.js` from layer-centric to age/event-centric display.
- Remove or cache materialization functions. Remove legacy `world.events` array. `MythicEvent` superseded by `WorldEvent`.
- Game Mode timeline filtering: player sees history as their character knows it — filtered by region, people, religion. Distant events are rumors or legends.
- Performance profiling: target sub-200ms. Batch graph walks per age if needed.
- Update CLAUDE.md and PLAN.md to reflect new architecture.

---

#### Cross-Cutting: Determinism Strategy

- **Per-age RNG streams:** `seed + '-creation'`, `seed + '-heroes'`, `seed + '-current'`
- **Per-event sub-seeds:** `seed + '-heroes-evt-' + epoch` — epoch determined by age RNG, not event content. Adding new event types doesn't shift existing streams.
- **Needs-based selection is deterministic** given world state (deterministic for a seed) + age RNG stream.
- **Entity IDs are epoch-ordered:** `evt-5-spawn-0` instead of `agent-0`. Stable even if generation logic changes.

#### Key Files

| File | Role |
|------|------|
| `src/main.js` | `buildWorld()` transitions from layer calls to age simulation calls |
| `src/world.js` | `World` gains `timeline` field; entity helpers eventually query timeline |
| `src/history.js` | `MythicEvent` / `AgentChange` are ancestors of `WorldEvent` / `EntityMutation` |
| `src/historyArchetypes.js` | Archetype pattern is the template for all event archetypes |
| `src/pantheon.js` + `pantheonShapes.js` | Reused in Phase 2 divine-birth events |
| `src/geogony.js`, `biogony.js`, `anthropogony.js` | Decomposed into creation events in Phase 3 |
| `src/chorogony.js`, `hierogony.js`, `politogony.js` | Dissolved into Hero Age events in Phase 4 |
| `src/present.js`, `src/character.js` | Dissolved into Current Age events in Phase 5 |
| `src/ui/legendsDetail.js` | `LAYER_RENDERERS` evolves to timeline-centric display in Phase 6 |

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
