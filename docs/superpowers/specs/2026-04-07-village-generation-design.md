# Settlement Generation System — Design Spec

## Context

The game mode is barely functional — players navigate between regions and landmarks but there's nothing to *do* at the local level. The goal is to generate one settlement (a village) as a prototype for settlement-scale content: a place with agriculture, food, architecture, NPCs, traditions, and a mythic origin — all procedurally derived from the world's concept graph and existing generation layers.

The system is called "settlement" because all settlement types (villages, cities, ports, fortresses, camps, inns) will roughly go through the same generation pipeline. Village is the first archetype — a small agrarian settlement built on 1-2 resources. Future archetypes will share the same data model and generation steps but with different weights, structures, and scale.

For this prototype: one village in the player's arrival region.

---

## Approach: Full Settlement Layer

New generation layer following the established layer convention: `settlement.js` + `settlementArchetypes.js` in `src/`, a renderer in `src/renderers/settlement.js`, a UI layer in `src/ui/layers/settlement.js`, and updates to the game scene system.

The layer runs in the **Age of Heroes** orchestrator (`src/ages/heroes.js`) after chorogony/hierogony/politogony, before the Current Age. By this point, regions, peoples, religions, polities, and hero-age timeline events all exist.

---

## Data Model

```js
world.settlement = {
  id, name,
  type,               // 'village' (future: 'city', 'port', 'fortress', 'camp', 'inn')
  regionId,           // player's arrival region
  peopleId,           // dominant culture
  polityId,           // governing polity
  religionId,         // local religion
  concepts,           // settlement-level concept cluster

  origin: {
    eventIndex,       // timeline event that caused the settlement
    archetype,        // see Origin Archetypes section below
    founderAgentId,   // the agent (hero, god, spirit) who caused the founding — or null
    summary,          // concept-driven origin phrase
  },

  crops: [{           // 1 grain + 1-2 vegetables
    id, name,
    type,             // 'grain' | 'tuber' | 'vine' | 'leafy' | 'legume'
    concepts,         // concept cluster
    sensory,          // { color, texture, shape, sound }
    terrainAffinity,
  }],

  livestock: {
    id, name,
    concepts, sensory,
    behavior,         // 'grazer' | 'docile' | 'stubborn' | 'skittish'
    size,             // 'small' | 'medium' | 'large'
    produces,         // 'milk' | 'wool' | 'eggs' | 'hide' | 'labor'
  },

  specialtyDish: {
    name,
    ingredients,      // crop/livestock product names
    concepts,
    backstory,        // why this dish exists
  },

  brewedBeverage: {
    name,
    baseCrop,         // grain crop reference
    concepts, sensory,
  },

  architecture: {
    material,         // concept-resolved string: 'ash-glazed clay', 'bone-laced timber'
    materialConcepts,
    style,            // from terrain shape + culture
  },

  townCenter: {
    type,             // 'tavern' | 'gathering-hall' | 'beer-hall' | 'field' | 'market-circle'
    name, concepts,
  },

  worshipSite: {
    type,             // 'ruin' | 'shrine' | 'temple' | 'artifact-altar' | 'outdoor-circle'
    name, concepts,
    linkedSacredSiteId,
  },

  npcs: [{           // 4 NPCs (farmer, elder, brewer, priest)
    id, name,
    role,             // 'farmer' | 'elder' | 'brewer' | 'priest'
    concepts,
    stance,           // elder/priest: faction/crisis opinion
    disposition,      // 'warm' | 'wary' | 'gruff' | 'curious'
    topics,           // what they talk about
  }],

  traditions: [{     // 1-2
    name,
    type,             // 'festival' | 'ritual' | 'competition' | 'observance'
    concepts,
    season,
    description,
  }],

  barSong: {
    subject,          // 'god' | 'hero' | 'culture' | 'legend'
    subjectId,
    concepts,
    verses,           // structured verse data
  },
}
```

---

## Generation Pipeline (`src/settlement.js`)

Layer signature: `generateSettlement(graph, world, rng)` — mutates `world.settlement`.

### Step 1: Select region and context
- Region = `world.character.arrival.regionId`
- People = first entry in `region.peoples[]`, resolved from `world.anthropogony.peoples`
- Polity = `region.controlledBy` → find in `world.politogony.polities`
- Religion = people's `religion` → find in `world.hierogony.religions`
- Settlement type = `'village'` (hardcoded for prototype)

### Step 2: Generate mythic origin
- Scan `world.timeline` for hero-age events in this region or involving this people's patron agent
- Select one event as the founding event; extract the founding agent (hero, god, or null)
- Select origin archetype via `archetypeSelection()` (see Origin Archetypes below)
- For the prototype, only hero-founding archetypes are implemented. The archetype system is designed to accommodate the full range of founding myths in future work.
- Build concept cluster from founder's domains (if any) + region concepts

### Step 3: Generate crops
- Walk concept graph from region concepts, following `produces`, `transforms`, `evokes` edges toward plant-like targets
- **Grain** (always 1): expand concept cluster, resolve sensory via `buildSensoryProfile()`, name via `nameRegion()` [1-2 syllables]
- **Vegetables** (1-2): different concept seeds, type from shape resolution:
  - round → tuber, coil → vine, flat → leafy, clustered → legume

### Step 4: Generate livestock
- Check region's existing lifeforms (from biogony) for non-predator grazers with matching terrain affinity
- If found: domesticate (derive livestock traits from existing lifeform)
- If not: generate new creature using biogony pattern, constrained to grazer/docile behavior
- Size from concept shape edges (large shapes → large, fine → small)
- Produces from concept edges: soft textures → wool, liquid associations → milk, small shapes → eggs, tough textures → hide, large + grazer → labor

### Step 5: Generate food & drink
- **Specialty dish**: combine grain + one vegetable + optionally livestock product. Name from concept cluster. Backstory references origin hero or a tradition.
- **Brewed beverage**: fermented grain. Sensory from grain concepts. Name generated.

### Step 6: Resolve architecture
- Walk concept graph from village concepts → material/substance edges via `resolveSubstance()`
- Cross-reference with terrain shape for structural style:
  - spire terrain → tall structures
  - basin → low/embedded
  - flat → sprawling
- Compose material description string

### Step 7: Generate structures
- **Town center type**: weighted by culture concepts — feast/drink → tavern, community/song → gathering-hall, trade/craft → market-circle, grain/brew → beer-hall
- **Worship site type**: check for existing sacred site in region → ruin if ruined, temple if strong rites, outdoor-circle if nature-focused, artifact-altar if artifact-linked, shrine as fallback

### Step 8: Generate NPCs (4)
Fixed roles with role-based depth. Always generate all 4 for the prototype:

| Role | Focus | Stance source | Topics |
|------|-------|---------------|--------|
| Farmer | Local | None | crops, livestock, weather, land, dangers |
| Brewer | Local | None | beverage, grain, tavern life, travelers |
| Elder | World-connected | Polity state + crisis | village origin, hero, crisis, factions |
| Priest | World-connected | Religion + heresies | rites, taboos, sacred site, theology |

Each NPC: name via naming system, disposition from concept walk, 3-5 dialogue topics.

### Step 9: Generate traditions (1-2)
- Primary tradition from origin archetype + religion rites:
  - heros-rest → harvest festival
  - heros-sacrifice → remembrance day
  - heros-discovery → revelation feast
  - heros-exile → exile-day observance
- Optional second tradition from religion's rites or taboos

### Step 10: Generate bar song
- Subject selection: scan for dramatic content — powerful god, founding hero, rival culture, or the crisis
- Structure: 4 verses (2 lines each) + repeated refrain
- Each verse uses concept-driven nouns/adjectives from subject's domain
- Refrain built from subject's most striking concept

### Step 11: Emit timeline event
- Write `settlement-founded` event to `world.timeline`
- Write `world.settlement`

---

## Origin Archetypes (`src/settlementArchetypes.js`)

The origin archetype determines the settlement's founding myth and influences its mood, structures, traditions, and song. The system is designed to accommodate many founding-myth patterns. The prototype implements only the **hero-founding** group.

### Full archetype catalog (future)

| Group | Archetype | Trigger | Founding myth |
|-------|-----------|---------|---------------|
| **Hero-founding** | `heros-rest` | kingdom-founded event | A hero settled here after a great deed |
| | `heros-sacrifice` | monument-falls / war event | The village grew from the aftermath of a hero's sacrifice |
| | `heros-discovery` | sacred-site-founded event | A hero found something divine here |
| | `heros-exile` | legend-written / other | A hero was cast out; followers settled here |
| **Divine act** | `gods-gift` | — | A god shaped the land or commanded settlement |
| | `gods-wound` | — | The village sits on a scar left by a god's violence or grief |
| **Spirit guidance** | `spirit-led` | — | A spirit or sacred animal led people to this place |
| | `vision-called` | — | A prophet's vision named this place as destined |
| **Migration** | `promised-land` | — | People journeyed here seeking a foretold home |
| | `refuge` | — | Survivors of catastrophe (flood, eruption, war) settled where they washed up |
| **Sacred discovery** | `spring-found` | — | A spring, relic, or fertile ground was found here |
| | `ruin-settled` | — | People built atop the bones of something older |

### Prototype implementation

```js
SETTLEMENT_SHAPES = {
  'heros-rest':      { weight logic based on kingdom-founded events },
  'heros-sacrifice': { weight logic based on monument-falls/war events },
  'heros-discovery': { weight logic based on sacred-site-founded events },
  'heros-exile':     { weight logic based on legend-written events },
}
```

Each archetype influences: settlement mood, town center type preference, worship site type preference, tradition type, and bar song subject tendency.

---

## Renderer (`src/renderers/settlement.js`)

Read-only. Produces prose stored as `world.renderedSettlement`.

### Rendered outputs

1. **`landscape`** — 1-2 paragraphs. Opens with striking sense of the region. Describes agricultural terrain: fields of grain, vegetable patches, livestock grazing. References climate and mood. Uses sensory system + multi-layer composition like `renderers/regions.js`.

2. **`architecture`** — 1 paragraph. Material + style. Template-driven with concept-resolved nouns. E.g., "Low walls of ash-glazed clay rise from the dust, roofed with woven root-fiber."

3. **`townCenter`** — 1 paragraph. The gathering place: look, smell, sound. References beverage and food.

4. **`worshipSite`** — 1 paragraph. Connection to village origin or broader religion. If ruin, describe what remains and why it still draws reverence.

5. **`npcDialogue`** — Per NPC, 3-5 rendered dialogue strings. Template-filled with world data:
   - Farmer: crop observations, land concerns, weather talk
   - Brewer: beverage commentary, nostalgic references, local gossip
   - Elder: origin story fragments, crisis opinions, faction stances
   - Priest: rite explanations, taboo warnings, theological claims

6. **`food`** — Short sensory descriptions for: specialty dish, grain meal (bread), meat meal, brewed beverage.

7. **`barSong`** — Formatted verse text. 4 verses + refrain.

8. **`traditions`** — 1-2 sentences per tradition.

---

## UI Changes

### Scene Graph (`src/ui/gameScene.js`)

Add settlement as a scene node, child of the arrival region. Scene type `'settlement'` with distinct rendering logic.

### Settlement Scene (`src/ui/game.js` updates)

**Base view** (when entering settlement):
- Settlement name as heading
- Landscape description
- Architecture description
- Sensory teasers: smoke from town center, sounds from worship site

**Sub-menu actions** (displayed as navigation choices):
- **"Enter the [town-center-name]"** → Town center prose, food/drink items (clickable for descriptions, logged to journal), brewer NPC + 1-2 other NPCs, bar song text
- **"Approach the [worship-site-name]"** → Worship site prose, priest NPC, tradition info
- **"Walk the fields"** → Crop descriptions, livestock description, farmer NPC
- **"Speak with [elder-name]"** → Elder dialogue: village history, crisis talk, faction opinions
- **"Return to [region-name]"** → Back to region scene

**NPC interaction**: Click NPC name to cycle through dialogue lines. Each click reveals next unseen line. Seen lines dimmed (consistent with existing "read texts" pattern).

**Food/drink interaction**: Click items to read sensory descriptions. Logged to journal as discoveries.

### UI Layer (`src/ui/layers/settlement.js`)

Add entry to `LAYER_RENDERERS` in `legendsDetail.js` for the log/legends view of settlement data.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/settlement.js` | Generation layer |
| `src/settlementArchetypes.js` | Origin archetypes + weights |
| `src/renderers/settlement.js` | Prose renderer |
| `src/ui/layers/settlement.js` | Legends/log display |

## Files to Modify

| File | Change |
|------|--------|
| `src/ages/heroes.js` | Wire `generateSettlement()` call |
| `src/world.js` | Add `settlement: null` to world shell |
| `src/ui/gameScene.js` | Add settlement scene node to graph, handle settlement scene type |
| `src/ui/game.js` | Render settlement sub-menus, NPC interaction, food/drink interaction |
| `src/ui/legendsDetail.js` | Add settlement to `LAYER_RENDERERS` |
| `src/main.js` | Import settlement renderer, call it in render pipeline |

## Existing Utilities to Reuse

| Utility | From | Used for |
|---------|------|----------|
| `expandConceptCluster()` | `src/conceptResolvers.js` | Crop/livestock/NPC concept clusters |
| `resolveSubstance()` | `src/conceptResolvers.js` | Architecture materials |
| `resolveShape()` | `src/conceptResolvers.js` | Crop types, structural style |
| `buildSensoryProfile()` | `src/renderers/sensory.js` | Crop/livestock/food sensory data |
| `nameRegion()` | `src/naming.js` | All village entity names |
| `archetypeSelection()` | `src/archetypeSelection.js` | Village origin archetype |
| `scoreEntityPlacement()` | `src/utils.js` | If needed for region scoring |
| `makeEventId()` | `src/timeline.js` | Timeline event for village founding |
| `addAgent()` / `findAgent()` | `src/world.js` | If hero lookup needed |
| `query(graph).where()` | `src/query.js` | Concept graph queries |

---

## Verification

1. **Generate a world** — `npm run dev`, enter a seed, generate. Check console for errors.
2. **Check settlement data** — In browser console: `currentWorld.settlement` should be populated with all fields, `type` should be `'village'`.
3. **Game mode** — Click "game" tab. Navigate to settlement scene. Verify:
   - Base view shows landscape + architecture
   - Sub-menus work (town center, worship site, fields, elder)
   - NPCs display dialogue on click, cycling through lines
   - Food/drink items are clickable and log to journal
   - Bar song renders as formatted verse
   - "Return to region" navigates back
4. **Determinism** — Same seed produces same settlement (same crops, NPCs, song, etc.)
5. **Validation** — `npm run validate` passes with no errors or warnings.
6. **Multiple seeds** — Test 3-5 different seeds to verify variety in crops, livestock, architecture, origin stories.
