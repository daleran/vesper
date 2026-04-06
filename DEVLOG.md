# DEVLOG.md — First Light Development Log

Format: `YYYY-MMM-DD: Feature — one line description`

---

2026-Apr-05: Project restart — pivoted to mythology-first creation myth generator; wiped geology prototype; new architecture: concept graph → graph walk → myth structure → prose
2026-Apr-05: Phases 0-6 complete — concept graph (~280 triples, 74 concepts), graph walker with collision/paradox detection, myth assembly pipeline, three-voice prose renderer (priestly / oral / heretical), seed input UI; full build passes
2026-Apr-05: Query builder — chainable Eloquent-style query engine for concept graph; where/or/direction/exclude/nearby/pluck filters, rank() with pickTop/pickWeighted, full terminal set
2026-Apr-05: Recipe myth system — replaced monolithic myth generator with recipe-based system; four-beat structure (before → act → cost → flaw); CreationMyth interface with stable fields for downstream consumers; three recipes: solo-god, pantheon-war, world-birth
2026-Apr-05: Batch generation — "batch 10" button generates 10 myths from random seeds; each displayed as a card with seed tag and collapsible structure panel
2026-Apr-05: Weather + disaster concepts — added cloud, rain, fog, earthquake, typhoon, storm, eruption, meteor, flood, lightning; graph now 972 triples / 158 concepts
2026-Apr-05: Prose restructure — recipes now output typed concept roles instead of hardcoded prose; renderer assembles sentences from roles + sensory edges (color/sound/texture/shape/evokes) from the graph; verb-keyed template sub-pools (struck, slew, gave_birth, sacrificed, split, collided); 8-10 templates per pool
2026-Apr-05: Query helpers — reusable semantic concept finders (findTool, findVoid, findArena, findCreator, findBirthplace) with tiered fallbacks; recipes no longer limited to rigid category queries
2026-Apr-05: Three new recipes — sacrifice (creator destroys itself), splitting (unity divided), accident (unintended collision); all use walkFrom/findCollisions for graph-driven discovery
2026-Apr-05: Concept expansion — +13 new concepts (desert, lake, cliff, ruins, threshold, net, needle, bell, staff, mirror, whale, owl, beetle); multi-category edges (well/tomb/vine/bone/hand/skull as items); walkFrom added to pantheonWar and worldBirth
2026-Apr-05: Edge-type-aware walking — walkFrom accepts preferRelations option (5× weight boost); all 6 existing recipes retrofitted with distinct edge preferences
2026-Apr-05: Six new recipes — cycle, rebellion, theft, dream, corruption, symbiosis; 12 total recipes; 4 new ACT template pools (stole, dreamed, corrupted, merged); new query helpers findDreamer and findPerfection
2026-Apr-05: Longer myths — elaboration system chains 2-3 sentences per beat via graph walks (evokes/rhymes/sensory); myths now 90-140 words with 12-51 tagged concepts; renderProse returns { prose, concepts }
2026-Apr-05: Graph expansion (Phase 14) — 180→263 concepts, 1110→2070 triples; sensory coverage 37%→94%; promoted 13 phantoms; added 12 new forces (mercy, greed, betrayal, etc.), 10 materials, 5 body parts, 10 places, 4 flora, 6 fauna, 10 items, 4 celestial; cross-linking pass for narrative connectivity
2026-Apr-05: Layer 2 — Pantheon generator (Phases 15-18); generatePantheon(graph, myth, rng) produces 3-7 agents per world; SHAPES registry with 12 per-recipe shape functions; dispositions from evokes edges, titles from 4 epithet patterns, relationships from collides/consumes/transforms edges; accident/corruption worlds have no gods; UI with color-coded type badges and tension display

2026-Apr-05: Prose quality pass — sensory-driven verb variation replaces fixed "spilled outward"; 6-variant phrase pool replaces fixed "same mark, same ache"; concept deduplication at recipe level; new overthrew verb+templates for rebellion recipe; varied accident flaws; solo-god sacrifice now tied to domain opposition
