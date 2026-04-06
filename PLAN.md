# PLAN.md — First Light: Mythology-First World Generation

Prioritized step-by-step build plan. Each phase must be complete and working
before moving to the next. Do not skip ahead.

**Project goal:** A procedural creation myth generator. Given a seed and weirdness,
generate a complete creation myth as three prose fragments — priestly hymn, oral
tradition, heretical whisper. Same seed, same myth. Higher weirdness, stranger myth.

**Generation pipeline:** Concept Graph → Graph Walk → Myth Structure → Prose

Future layers will generate geography, ecology, and culture from the myth's output tags.

---

## Fixes

Small tweaks and bug fixes. Add when found, remove when resolved.

<!-- fixes go here -->

---

## Layer 1 — Creation Myth Generator

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

### Phase 5 — Prose Renderer ✓

- [x] `src/prose.js` — renderProse(myth) → prose string (four-beat template pools)
- [x] Template pools: VOID, ACT, COST, FLAW — one picked per beat via seeded RNG
- [x] Verify: `npm run validate` passes

---

### Phase 6 — UI and Wiring ✓

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
- [x] Renderer pulls sensory detail (color, texture, sound) from concept graph edges — "an infinite sleep" and "an infinite pit" described in fundamentally different language
- [x] Verify: same seed still produces same output; `npm run validate` passes

---

### Phase 8 — Widen Concept Pools ✓

- [x] Audit graph for missing categorical edges — added multi-category `is item` edges for well, tomb, vine, bone, hand, skull
- [x] Loosen recipe queries via queryHelpers.js: findTool, findVoid, findArena with tiered semantic fallbacks
- [x] Loosen tool queries: items first, then anything with shape+produces, then shape alone
- [x] Six recipes now spread generation evenly
- [x] Verify: 10 consecutive seeds show no dominant concept repetition

---

### Phase 9 — Clarify Cost vs. Flaw ✓

- [x] Cost = what was _sacrificed or spent_ — deliberate or inevitable price, past tense, done
- [x] Flaw = the _ongoing wound_ — still wrong, still active, still shaping the present
- [x] Cost is grief. Flaw is haunting. Cost is the battle. Flaw is the scar that won't heal.
- [x] Updated all recipes to enforce this distinction; documented in CLAUDE.md
- [x] Verify across seeds: cost and flaw never feel interchangeable

---

### Phase 10 — Enrich Graph Walking ✓

- [x] Every recipe must have at least one `walkFrom` moment — all six recipes now use walkFrom or walkAll
- [x] Add edge-type-aware walking: `walkFrom` accepts `preferRelations` option (5× weight boost)
- [x] Different edge preferences give each recipe's discoveries a distinct character
- [x] Verify: walk results contribute meaningfully to myth output

---

### Phase 11 — New Recipes ✓

- [x] **Sacrifice** — an entity willingly gives up something essential. The cost IS the act. Emphasizes voluntary suffering.
- [x] **Accident** — creation wasn't intended. A collision, a spill, a mistake. No creator to appeal to.
- [x] **Splitting** — a unity was divided. Twins separated, a whole broken into parts. The world is one half yearning for the other.
- [x] **Theft** — something stolen from the void or another entity. Creation as crime. The original owner wants it back.
- [x] **Dream** — reality is hallucinated or remembered by something sleeping. The flaw is that the dreamer might wake.
- [x] **Corruption** — something perfect existed and was ruined. The flaw is that perfection can't be restored.
- [x] **Cycle** — creation is recurring. This isn't the first world, or the last. Destruction is equally inevitable.
- [x] **Rebellion** — creations overthrew their creator. The world is an orphan built on the creator's corpse.
- [x] **Symbiosis** — two things merged and can't be separated. The world is both at once, forever in tension.
- [x] Quality bar: every recipe must produce a relationship, an ongoing consequence, and the possibility of paradox (world-birth is the benchmark)
- [x] Verify: 24 seeds produce varied output across all 12 recipes

---

### Phase 12 — Longer Myths ✓

- [x] Expand each beat from 1 sentence to 3–5 sentences by pulling sensory/associative detail from concept graph edges
- [x] The void beat weaves associations: evokes chains + rhymes + sensory detail
- [x] The act beat adds sensory detail: sound, color, what was produced
- [x] Cost and flaw beats elaborate consequences through evokes/transforms/rhymes
- [x] Myths carry 12–51 tagged concepts (up from 8–10) for richer downstream differentiation
- [x] Verify: longer output (90–140 words) feels like elaboration, not padding

---

### Phase 13 — DELETED

---

### Phase 14 — Graph Expansion

- [x] Expand concept graph from 180 → 263 concepts
- [x] Expand triples from 1110 → 2070
- [x] Add more sensory concepts (colors, textures, sounds) — sensory coverage 37% → 94%
- [x] Add more concrete nouns (tower, forge, throne, loom, anvil, chalice, etc.)
- [x] Add more abstract forces (mercy, greed, patience, betrayal, envy, shame, etc.)
- [ ] Test 20+ seeds; document interesting ones in DEVLOG
- [x] `npm run build` produces working dist

---

## Layer 2 — Agents & Pantheon

### Phase 15–18 — Pantheon Generator ✓

- [x] `src/pantheon.js` — Agent/Pantheon typedefs, generatePantheon() pipeline
- [x] `src/pantheonShapes.js` — SHAPES registry: 12 per-recipe shape functions
- [x] Pipeline: extract primary → derive secondary → dispositions → titles → relationships → states
- [x] Separate RNG stream (seed + '-pantheon') isolates from myth generation
- [x] 3–7 agents per world, type distribution varies by recipe
- [x] Accident and corruption produce no gods (spirits/demons only)
- [x] Titles from graph edges: "the [Disposition]", "Who-[Verb]-in-[Domain]", "[Adj] of [Domain]", "the [State]"
- [x] Relationships from graph edges: collides→rival, consumes→slayer, transforms→parent, shared is→sibling
- [x] UI: agent cards with color-coded type badges, compact detail lines, tension display
- [x] Wired into main.js for single and batch generation
- [x] Structure panel includes pantheon data
- [x] Verify: 40 seeds × 12 recipes all produce 4–7 agents, no crashes, correct type constraints

---

## Layer 3 — Mythic History (planned, not started)

> Build after Layer 2 agents & pantheon.
> This is the bridge between "the world has a creation myth" and
> "the world has regions that feel different from each other."

The creation myth answers how the world began. Mythic history answers why
different parts of it feel different. 3–5 events per world, each inheriting
concepts from the creation myth and previous events, each tagging a spatial
region with its own concept cluster. Concepts accumulate — Event 1's
consequences become Event 2's preconditions.

**Generation pipeline:**

```
Creation Myth (void → act → cost → flaw)
    ↓ inherits concepts
Mythic Event 1 — a consequence of the flaw
    ↓ adds new concepts and locations
Mythic Event 2 — an attempt to fix or exploit Event 1
    ↓ compounds the problem
Mythic Event 3 — a catastrophe, exodus, or transformation
    ↓ scars new regions
Mythic Event 4 — the recent past, still echoing in living memory
    ↓ defines present-tense tensions
The World the Player Enters
```

**Event structure:** Situation → Action → Consequence → Legacy

- Situation: what tension inherited from previous events made this inevitable?
- Action: which agents acted, and what did they do? (war, discovery, hubris, sacrifice, migration, invention)
- Consequence: what changed physically? A region scarred, a people scattered. Agent states updated (killed, exiled, transformed).
- Legacy: what does this event mean to cultures now? Who tells it, and how differently?

Events use Layer 2's pantheon as their cast. Agents gain new relationships,
change state, or spawn new agents through events. A god diminished in Event 1
might return as a corrupted demon in Event 3.

**Event archetypes:**

- War — two forces clash; a region is scarred, a people displaced
- Hubris — someone reaches beyond their station; always ends in ironic catastrophe
- Exodus — a people flee; they transform the new region and haunt the old one
- Discovery — something buried is found; changes the power balance
- Sacrifice — someone gives up something essential to hold the world together
- Corruption — something good is slowly perverted
- Sundering — a unity breaks; one culture becomes two with incompatible memories
- Return — something from the creation myth resurfaces; the flaw manifests physically

Each event tags 1–2 regions with concept clusters. After 3–5 events, the world has
a creation myth defining its baseline character and regionally distinct clusters
defining local variation.

---

## Layer 4 — Phoneme-Driven Naming

### Phase 19 — Agent Naming Engine ✓

- [x] `src/naming.js` — 8 phoneme palettes keyed by `sound` edge targets (roar, whisper, crack, ring, hush, moan, hum, hollow)
- [x] Sound resolution: concept → `sound` edge → palette key, with evokes/texture fallbacks
- [x] World signature blending: myth concepts → top 2–3 palettes → 30% baseline for all names
- [x] Syllable count by agent type: god 1–2, demi-god 2, spirit/demon 2–3, ancestor/herald 2
- [x] Phonotactic validation: consonant cluster limits, vowel run limits, banned words
- [x] ~37 new `sound` edges in `src/concepts.js` for common agent-domain concepts
- [x] Integrated into `generatePantheon()` as step 3.5 (after buildAgent, before dispositions)
- [x] Deterministic: same seed always produces same names
- [x] Verify: `npm run validate` passes, 20 seeds produce varied non-placeholder names

### Future — Region-Based Naming (after Layer 3)

- [ ] Region concept clusters drive regional phoneme palettes
- [ ] Place names (2–3 syllables) drawn from region palette
- [ ] Culture/people names with distinct suffix conventions
- [ ] Creature/flora folk names using local culture's palette
- [ ] Endonym vs. exonym use different palettes

---

## Layer 5 — Geography (planned, not started)

> Build after Layer 4 naming.

The myth's output tags and mythic history's regional concept clusters propagate into
geographic generation. Mountains exist because something fell there. Deserts exist
because a god burned them. Rivers flow where old blood ran. Geography is mythology's
scar tissue.

A region tagged `[fire, grief, obsidian, war, exile]` generates completely different
terrain than one tagged `[water, dream, crystal, discovery, sacrifice]`. Both share
the creation myth's vocabulary but feel like different places because different
history happened there.

Planned scope:

- Regional concept clusters → biome generation (not noise-first, narrative-first)
- Myth event → geographic landmark placement
- Named features using Layer 3 phoneme system
- The concept graph as universal vocabulary: query it for fire-adjacent colors, grief-adjacent weather, obsidian-adjacent terrain
- Canvas rendering of generated landscape (this is where the canvas returns)

---

## Layer 6 — Ecology (planned, not started)

> Build after Layer 5 geography.

Flora and fauna names, appearances, and behaviors echo the creation myth.
In a world born from a sleeping serpent, many things have scales.
In a world born from shattered glass, many things are sharp or transparent.
Creatures and flora named using the local culture's phoneme palette.

---

## Layer 7 — Culture (planned, not started)

> Build after Layer 6 ecology.

Cultures interpret the creation myth and mythic history differently — orthodox, folk,
heretical readings map to faction identities. The paradoxes in the myth become the
schisms in the culture. The contradictions between multi-voice renderings become
real cultural fault lines.

---

## Layer 8 — Stories (planned, not started)

> Build after Layer 7 culture.

Characters, histories, and legends emerge from the layered mythology and culture.
Quests are about recovering, suppressing, or reinterpreting the creation myth.

---

## Architecture Notes

**The weirdness dial as hop distance.** Close collisions produce familiar myths.
Distant collisions produce alien ones. Already implied by the architecture but not
yet parameterized. A single knob that transforms the entire world's flavor.

**The concept graph as universal vocabulary.** Every downstream system — geography,
ecology, naming, culture — queries the same graph. A region tagged `[fire, grief, obsidian]`
asks the graph for fire-adjacent colors, grief-adjacent weather, obsidian-adjacent terrain.
The graph isn't just for myths. It's the world's dictionary.
