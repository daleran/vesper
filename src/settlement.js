/**
 * Settlement generator — produces a village (or future settlement type)
 * in the player's arrival region. Generates agriculture, livestock, food,
 * architecture, structures, NPCs, traditions, and a bar song — all
 * derived from the concept graph and existing world data.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 * @import { Lifeform } from './biogony.js'
 * @import { ChorogonyRegion } from './chorogony.js'
 * @import { People } from './anthropogony.js'
 */
import { pick, weightedPick } from './utils.js'
import { query } from './query.js'
import { nameRegion } from './naming.js'
import { expandConceptCluster, resolveSubstance, resolveShape } from './conceptResolvers.js'
import { buildSensoryProfile } from './renderers/sensory.js'
import { SETTLEMENT_SHAPES, SETTLEMENT_NAMES } from './settlementArchetypes.js'
import { addEvent, makeEventId, emptyBeats } from './timeline.js'
import { findAgent, findRegion } from './world.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   type: string,
 *   concepts: string[],
 * }} Crop
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   concepts: string[],
 *   behavior: string,
 *   size: string,
 *   produces: string,
 * }} Livestock
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   role: string,
 *   concepts: string[],
 *   stance: string | null,
 *   disposition: string,
 *   topics: string[],
 * }} SettlementNPC
 */

/**
 * @typedef {{
 *   name: string,
 *   type: string,
 *   concepts: string[],
 *   season: string,
 * }} Tradition
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   type: string,
 *   regionId: string,
 *   peopleId: string,
 *   polityId: string | null,
 *   religionId: string | null,
 *   concepts: string[],
 *   origin: {
 *     eventIndex: number | null,
 *     archetype: string,
 *     founderAgentId: string | null,
 *     summary: string,
 *   },
 *   crops: Crop[],
 *   livestock: Livestock | null,
 *   specialtyDish: { name: string, ingredients: string[], concepts: string[], backstory: string },
 *   brewedBeverage: { name: string, baseCrop: string, concepts: string[] },
 *   architecture: { material: string, materialConcepts: string[], style: string },
 *   townCenter: { type: string, name: string, concepts: string[] },
 *   worshipSite: { type: string, name: string, concepts: string[], linkedSacredSiteId: string | null },
 *   npcs: SettlementNPC[],
 *   traditions: Tradition[],
 *   barSong: { subject: string, subjectId: string | null, concepts: string[], verses: string[], refrain: string },
 * }} Settlement
 */

// ── Concept helpers ──

/** Flora-related concepts for crop generation. */
const FLORA_CONCEPTS = new Set(['grain', 'seed', 'root', 'vine', 'leaf', 'fruit', 'flower', 'herb', 'moss', 'reed', 'bark', 'sap', 'thorn', 'pollen'])

/** Shape → crop type mapping. */
const SHAPE_TO_CROP_TYPE = /** @type {Record<string, string>} */ ({
  circle: 'tuber', slab: 'leafy', hollow: 'legume', pillar: 'vine',
  shard: 'leafy', spiral: 'vine', coil: 'vine', point: 'legume',
  branch: 'leafy', web: 'vine', crescent: 'legume',
})

/** Concept associations for town center types. */
const CENTER_CONCEPTS = /** @type {Record<string, string[]>} */ ({
  'tavern': ['feast', 'drink', 'fire', 'song', 'warmth'],
  'gathering-hall': ['community', 'song', 'memory', 'voice', 'pride'],
  'beer-hall': ['grain', 'drink', 'brew', 'feast', 'mead'],
  'field': ['earth', 'harvest', 'dance', 'wind', 'sun'],
  'market-circle': ['trade', 'craft', 'gold', 'silver', 'exchange'],
})

/** Concept associations for worship site types. */
const WORSHIP_CONCEPTS = /** @type {Record<string, string[]>} */ ({
  'ruin': ['decay', 'memory', 'stone', 'wound', 'time'],
  'shrine': ['light', 'offering', 'flame', 'prayer', 'silence'],
  'temple': ['stone', 'pillar', 'ritual', 'power', 'truth'],
  'artifact-altar': ['relic', 'bone', 'gold', 'artifact', 'sacrifice'],
  'outdoor-circle': ['wind', 'earth', 'sky', 'tree', 'moon'],
})

/** NPC dispositions. */
const DISPOSITIONS = ['warm', 'wary', 'gruff', 'curious']

/** Seasons for traditions. */
const SEASONS = ['spring', 'summer', 'autumn', 'winter']

// ── Archetype selection ──

/**
 * Select a settlement archetype based on timeline events.
 * @param {() => number} rng
 * @param {World} world
 * @param {string} regionId
 * @returns {string}
 */
function selectArchetype(rng, world, regionId) {
  const timeline = world.timeline
  if (!timeline) return pick(rng, SETTLEMENT_NAMES)

  const heroEvents = timeline.events.filter(
    e => e.age === 'heroes' && e.concepts.length > 0
  )

  // Score each archetype by matching event types
  const weights = SETTLEMENT_NAMES.map(() => 1)
  for (const evt of heroEvents) {
    const isLocal = evt.spawns.some(s => s.entityData && /** @type {any} */ (s.entityData).regionId === regionId) ||
      evt.mutations.some(m => m.entityId === regionId)

    if (!isLocal) continue

    switch (evt.archetype) {
      case 'kingdom-founded': weights[0] += 3; break // heros-rest
      case 'monument-falls':
      case 'war-between-kingdoms': weights[1] += 3; break // heros-sacrifice
      case 'sacred-site-founded': weights[2] += 3; break // heros-discovery
      case 'legend-written': weights[3] += 3; break // heros-exile
    }
  }

  return weightedPick(rng, SETTLEMENT_NAMES, weights)
}

/**
 * Find a founding hero agent for the settlement origin.
 * @param {World} world
 * @param {string} regionId
 * @param {() => number} rng
 * @returns {{ agentId: string | null, eventIndex: number | null }}
 */
function findFoundingHero(world, regionId, rng) {
  const timeline = world.timeline
  if (!timeline) return { agentId: null, eventIndex: null }

  // Look for hero-age events with participants in this region
  const candidates = timeline.events.filter(e => {
    if (e.age !== 'heroes') return false
    if (e.participants.length === 0) return false
    // Check if event touches this region
    return e.spawns.some(s => {
      const data = /** @type {any} */ (s.entityData)
      return data?.regionId === regionId ||
        data?.capitalRegionId === regionId ||
        (data?.regionIds && data.regionIds.includes(regionId))
    }) || e.mutations.some(m => m.entityId === regionId)
  })

  if (candidates.length > 0) {
    const evt = pick(rng, candidates)
    const agentId = evt.participants.find(p => p.startsWith('agent-')) ?? null
    return { agentId, eventIndex: evt.epoch }
  }

  // Fallback: any agent that's a patron of a polity controlling this region
  const region = findRegion(world, regionId)
  if (region?.controlledBy) {
    const polity = (world.politogony?.polities ?? []).find(p => p.id === region.controlledBy)
    if (polity?.patronAgentId) {
      return { agentId: polity.patronAgentId, eventIndex: null }
    }
  }

  // Last resort: pick any living god
  const god = world.agents.find(a => a.type === 'god' && a.alive)
  return { agentId: god?.id ?? null, eventIndex: null }
}

// ── Crop generation ──

/**
 * Find flora-adjacent concepts from the region's concept cluster.
 * @param {ConceptGraph} graph
 * @param {string[]} regionConcepts
 * @returns {string[]}
 */
function findCropConcepts(graph, regionConcepts) {
  const candidates = []
  for (const c of regionConcepts) {
    const edges = graph.get(c)
    if (!edges) continue
    for (const e of edges) {
      if (e.direction !== 'fwd') continue
      if (e.relation === 'produces' || e.relation === 'transforms' || e.relation === 'evokes') {
        if (FLORA_CONCEPTS.has(e.concept) || FLORA_CONCEPTS.has(c)) {
          candidates.push(e.concept)
        }
      }
    }
    // Direct flora concepts
    if (FLORA_CONCEPTS.has(c)) candidates.push(c)
  }
  // Also add any flora from the graph near region concepts
  for (const c of regionConcepts.slice(0, 3)) {
    const flora = query(graph).nearby(c, 1).where('is', 'flora').get()
    candidates.push(...flora)
  }
  return [...new Set(candidates)]
}

/**
 * Generate crops for the settlement.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} regionConcepts
 * @param {import('./naming.js').MorphemeTable | null} morphemes
 * @returns {Crop[]}
 */
function generateCrops(graph, rng, regionConcepts, morphemes) {
  const cropSeeds = findCropConcepts(graph, regionConcepts)
  const usedNames = new Set()
  /** @type {Crop[]} */
  const crops = []

  // Always generate 1 grain
  const grainBase = cropSeeds.length > 0 ? pick(rng, cropSeeds) : regionConcepts[0] ?? 'seed'
  const grainCluster = expandConceptCluster(graph, rng, grainBase)
  const grainName = nameRegion(graph, grainCluster, rng, {
    usedNames, syllableRange: [1, 2], entityType: 'creature', morphemes,
  })
  crops.push({ id: 'crop-0', name: grainName, type: 'grain', concepts: grainCluster })

  // 1-2 vegetables from different concept seeds
  const vegCount = rng() < 0.5 ? 1 : 2
  const usedBases = new Set([grainBase])

  for (let i = 0; i < vegCount; i++) {
    const remaining = cropSeeds.filter(c => !usedBases.has(c))
    const vegBase = remaining.length > 0 ? pick(rng, remaining) : regionConcepts[Math.min(i + 1, regionConcepts.length - 1)] ?? 'root'
    usedBases.add(vegBase)

    const vegCluster = expandConceptCluster(graph, rng, vegBase)
    const shape = resolveShape(graph, rng, vegBase)
    const vegType = SHAPE_TO_CROP_TYPE[shape] ?? 'tuber'
    const vegName = nameRegion(graph, vegCluster, rng, {
      usedNames, syllableRange: [1, 2], entityType: 'creature', morphemes,
    })
    crops.push({ id: `crop-${i + 1}`, name: vegName, type: vegType, concepts: vegCluster })
  }

  return crops
}

// ── Livestock generation ──

/**
 * Generate a domesticated livestock animal.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {ChorogonyRegion} region
 * @param {import('./naming.js').MorphemeTable | null} morphemes
 * @returns {Livestock}
 */
function generateLivestock(graph, rng, world, region, morphemes) {
  const lifeforms = world.biogony?.lifeforms ?? []

  // Try to find a non-predator grazer in this region
  const domesticableBehaviors = new Set(['grazer', 'drifter', 'sentinel'])
  const localGrazers = lifeforms.filter(lf =>
    domesticableBehaviors.has(lf.behavior) &&
    region.lifeforms.includes(lf.name)
  )

  /** @type {string[]} */
  let concepts
  /** @type {string} */
  let name

  if (localGrazers.length > 0) {
    const base = pick(rng, localGrazers)
    concepts = base.concepts
    name = base.name
  } else {
    // Generate from region concepts
    const baseConcept = region.concepts[0] ?? 'beast'
    concepts = expandConceptCluster(graph, rng, baseConcept)
    name = nameRegion(graph, concepts, rng, {
      syllableRange: [1, 2], entityType: 'creature', morphemes,
    })
  }

  // Resolve behavior and size from concepts
  const shape = resolveShape(graph, rng, concepts[0])
  const largeShapes = new Set(['slab', 'pillar', 'branch'])
  const smallShapes = new Set(['point', 'shard', 'web'])
  const size = largeShapes.has(shape) ? 'large' : smallShapes.has(shape) ? 'small' : 'medium'

  // Resolve produces from concept edges
  let produces = 'labor'
  for (const c of concepts) {
    const edges = graph.get(c)
    if (!edges) continue
    for (const e of edges) {
      if (e.direction !== 'fwd') continue
      if (e.relation === 'texture') {
        if (e.concept === 'soft' || e.concept === 'smooth') { produces = 'wool'; break }
      }
      if (e.relation === 'produces') {
        produces = 'milk'
        break
      }
    }
    if (produces !== 'labor') break
  }
  if (produces === 'labor' && size === 'small') produces = 'eggs'

  const behaviors = ['grazer', 'docile', 'stubborn', 'skittish']
  const behavior = pick(rng, behaviors)

  return { id: 'livestock-0', name, concepts, behavior, size, produces }
}

// ── Food & drink ──

/**
 * Generate specialty dish and brewed beverage.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {Crop[]} crops
 * @param {Livestock} livestock
 * @param {string | null} founderName
 * @param {import('./naming.js').MorphemeTable | null} morphemes
 * @returns {{ dish: Settlement['specialtyDish'], beverage: Settlement['brewedBeverage'] }}
 */
function generateFood(graph, rng, crops, livestock, founderName, morphemes) {
  const grain = crops.find(c => c.type === 'grain') ?? crops[0]
  const veg = crops.find(c => c.type !== 'grain')

  // Specialty dish
  const dishIngredients = [grain.name]
  if (veg) dishIngredients.push(veg.name)
  if (livestock.produces === 'milk' || livestock.produces === 'eggs') {
    dishIngredients.push(`${livestock.name} ${livestock.produces}`)
  }

  const dishConcepts = [...grain.concepts.slice(0, 2), ...(veg?.concepts.slice(0, 1) ?? [])]
  const dishName = nameRegion(graph, dishConcepts, rng, {
    syllableRange: [1, 2], entityType: 'creature', morphemes,
  })

  const backstory = founderName
    ? `First prepared to honor ${founderName}'s arrival`
    : 'A recipe older than the village itself'

  // Brewed beverage
  const bevConcepts = grain.concepts.slice(0, 3)
  const bevName = nameRegion(graph, bevConcepts, rng, {
    syllableRange: [1, 2], entityType: 'creature', morphemes,
  })

  return {
    dish: { name: dishName, ingredients: dishIngredients, concepts: dishConcepts, backstory },
    beverage: { name: bevName, baseCrop: grain.name, concepts: bevConcepts },
  }
}

// ── Architecture ──

/**
 * Resolve architecture from concept graph.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} villageConcepts
 * @param {string[]} terrainTypes
 * @returns {Settlement['architecture']}
 */
function resolveArchitecture(graph, rng, villageConcepts, terrainTypes) {
  const material = resolveSubstance(graph, rng, villageConcepts, 'clay')
  const materialConcepts = expandConceptCluster(graph, rng, material, 1, 3)

  // Style from terrain
  const terrainStr = terrainTypes.join(' ')
  let style = 'low-sprawling'
  if (terrainStr.includes('spire') || terrainStr.includes('pillar')) style = 'tall-narrow'
  else if (terrainStr.includes('hollow') || terrainStr.includes('basin')) style = 'sunken'
  else if (terrainStr.includes('slab') || terrainStr.includes('flat')) style = 'low-sprawling'
  else if (terrainStr.includes('coil') || terrainStr.includes('spiral')) style = 'winding'

  return { material, materialConcepts, style }
}

// ── Structures ──

/**
 * Select town center type based on concept overlap.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} cultureConcepts
 * @param {string[]} archetypeBias
 * @returns {string}
 */
function selectTownCenter(graph, rng, cultureConcepts, archetypeBias) {
  const types = Object.keys(CENTER_CONCEPTS)
  const cultureSet = new Set(cultureConcepts)
  const weights = types.map(t => {
    let w = 1
    for (const c of CENTER_CONCEPTS[t]) {
      if (cultureSet.has(c)) w += 2
    }
    if (archetypeBias.includes(t)) w += 3
    return w
  })
  return weightedPick(rng, types, weights)
}

/**
 * Select worship site type based on region data and archetype bias.
 * @param {World} world
 * @param {() => number} rng
 * @param {string} regionId
 * @param {string[]} archetypeBias
 * @returns {{ type: string, linkedSacredSiteId: string | null }}
 */
function selectWorshipSite(world, rng, regionId, archetypeBias) {
  // Check for existing sacred site in region
  const sacredSite = (world.hierogony?.sacredSites ?? []).find(s => s.regionId === regionId)

  // Check for ruins in region
  const ruin = (world.politogony?.ruins ?? []).find(r => r.regionId === regionId)

  if (ruin && rng() < 0.4) return { type: 'ruin', linkedSacredSiteId: sacredSite?.id ?? null }
  if (sacredSite) return { type: 'shrine', linkedSacredSiteId: sacredSite.id }

  // Use archetype bias
  const types = Object.keys(WORSHIP_CONCEPTS)
  const weights = types.map(t => archetypeBias.includes(t) ? 4 : 1)
  return { type: weightedPick(rng, types, weights), linkedSacredSiteId: null }
}

// ── NPCs ──

/**
 * Generate NPCs for the settlement.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {string[]} villageConcepts
 * @param {Crop[]} crops
 * @param {Livestock} livestock
 * @param {Settlement['brewedBeverage']} beverage
 * @param {Settlement['origin']} origin
 * @param {string | null} religionId
 * @param {string | null} polityId
 * @param {import('./naming.js').MorphemeTable | null} morphemes
 * @returns {SettlementNPC[]}
 */
function generateNPCs(graph, rng, world, villageConcepts, crops, livestock, beverage, origin, religionId, polityId, morphemes) {
  const usedNames = new Set()
  /** @type {SettlementNPC[]} */
  const npcs = []

  // Farmer
  const farmerConcepts = expandConceptCluster(graph, rng, crops[0].concepts[0])
  npcs.push({
    id: 'npc-farmer',
    name: nameRegion(graph, farmerConcepts, rng, { usedNames, syllableRange: [2, 2], entityType: 'people', morphemes }),
    role: 'farmer',
    concepts: farmerConcepts,
    stance: null,
    disposition: pick(rng, DISPOSITIONS),
    topics: [
      `the ${crops[0].name} harvest`,
      `the ${livestock.name} herd`,
      'the weather this season',
      'the land and its dangers',
    ],
  })

  // Brewer
  const brewerConcepts = expandConceptCluster(graph, rng, beverage.concepts[0] ?? villageConcepts[0])
  npcs.push({
    id: 'npc-brewer',
    name: nameRegion(graph, brewerConcepts, rng, { usedNames, syllableRange: [2, 2], entityType: 'people', morphemes }),
    role: 'brewer',
    concepts: brewerConcepts,
    stance: null,
    disposition: pick(rng, DISPOSITIONS),
    topics: [
      `the ${beverage.name}`,
      `the ${crops[0].name} quality`,
      'travelers who pass through',
      'tavern gossip',
    ],
  })

  // Elder — world-connected
  const elderConcepts = expandConceptCluster(graph, rng, villageConcepts[0])
  const founderAgent = origin.founderAgentId ? findAgent(world, origin.founderAgentId) : null

  // Derive stance from polity state + crisis
  let elderStance = null
  if (polityId) {
    const polity = (world.politogony?.polities ?? []).find(p => p.id === polityId)
    if (polity) {
      const stateOpinions = /** @type {Record<string, string>} */ ({
        rising: 'hopeful about the realm',
        stable: 'content with the current order',
        declining: 'worried about the realm\'s future',
        fallen: 'mourning what was lost',
      })
      elderStance = stateOpinions[polity.state] ?? null
    }
  }
  if (!elderStance && world.present?.crisis) {
    elderStance = `troubled by the ${world.present.crisis.type}`
  }

  npcs.push({
    id: 'npc-elder',
    name: nameRegion(graph, elderConcepts, rng, { usedNames, syllableRange: [2, 2], entityType: 'people', morphemes }),
    role: 'elder',
    concepts: elderConcepts,
    stance: elderStance,
    disposition: pick(rng, DISPOSITIONS),
    topics: [
      founderAgent ? `the legend of ${founderAgent.name}` : 'the village founding',
      'the old days',
      world.present?.crisis ? `the ${world.present.crisis.type}` : 'the state of the world',
      'the factions and their quarrels',
    ],
  })

  // Priest — world-connected
  const religion = religionId ? (world.hierogony?.religions ?? []).find(r => r.id === religionId) : null
  const priestBase = religion?.concepts[0] ?? villageConcepts[1] ?? villageConcepts[0]
  const priestConcepts = expandConceptCluster(graph, rng, priestBase)

  let priestStance = null
  if (religion) {
    const heresies = (world.hierogony?.heresies ?? []).filter(h => h.religionId === religion.id)
    if (heresies.length > 0) {
      priestStance = `wary of the ${heresies[0].name} heresy`
    }
  }
  if (!priestStance && religion) {
    priestStance = `devoted to ${religion.name}`
  }

  const rites = (world.hierogony?.practices ?? [])
    .filter(p => p.religionId === religionId && p.type === 'rite')
  const taboos = (world.hierogony?.practices ?? [])
    .filter(p => p.religionId === religionId && p.type === 'taboo')

  npcs.push({
    id: 'npc-priest',
    name: nameRegion(graph, priestConcepts, rng, { usedNames, syllableRange: [2, 2], entityType: 'people', morphemes }),
    role: 'priest',
    concepts: priestConcepts,
    stance: priestStance,
    disposition: pick(rng, DISPOSITIONS),
    topics: [
      religion ? `the teachings of ${religion.name}` : 'the old faith',
      rites.length > 0 ? `the rite of ${rites[0].concepts[0] ?? 'devotion'}` : 'sacred duties',
      taboos.length > 0 ? `the taboo of ${taboos[0].concepts[0] ?? 'the forbidden'}` : 'what must not be done',
      'the meaning of suffering',
    ],
  })

  return npcs
}

// ── Traditions ──

/**
 * Generate 1-2 traditions.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} archetypeTraditionType
 * @param {string[]} villageConcepts
 * @param {string | null} religionId
 * @param {World} world
 * @param {import('./naming.js').MorphemeTable | null} morphemes
 * @returns {Tradition[]}
 */
function generateTraditions(graph, rng, archetypeTraditionType, villageConcepts, religionId, world, morphemes) {
  /** @type {Tradition[]} */
  const traditions = []

  // Primary tradition from archetype
  const t1Concepts = expandConceptCluster(graph, rng, villageConcepts[0])
  const t1Name = nameRegion(graph, t1Concepts, rng, { syllableRange: [2, 3], entityType: 'event', morphemes })
  traditions.push({
    name: t1Name,
    type: archetypeTraditionType,
    concepts: t1Concepts,
    season: pick(rng, SEASONS),
  })

  // Optional second tradition from religion
  if (rng() < 0.6 && religionId) {
    const religion = (world.hierogony?.religions ?? []).find(r => r.id === religionId)
    if (religion && religion.concepts.length > 0) {
      const t2Concepts = expandConceptCluster(graph, rng, religion.concepts[0])
      const t2Name = nameRegion(graph, t2Concepts, rng, { syllableRange: [2, 3], entityType: 'event', morphemes })
      traditions.push({
        name: t2Name,
        type: rng() < 0.5 ? 'ritual' : 'observance',
        concepts: t2Concepts,
        season: pick(rng, SEASONS.filter(s => s !== traditions[0].season)),
      })
    }
  }

  return traditions
}

// ── Bar song ──

/**
 * Generate a bar song.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {string} songSubjectBias
 * @param {string | null} founderAgentId
 * @returns {Settlement['barSong']}
 */
function generateBarSong(graph, rng, world, songSubjectBias, founderAgentId) {
  // Pick subject
  let subject = songSubjectBias
  let subjectId = founderAgentId
  let subjectName = ''
  /** @type {string[]} */
  let subjectConcepts = []

  if (songSubjectBias === 'hero' && founderAgentId) {
    const agent = findAgent(world, founderAgentId)
    if (agent) {
      subjectName = agent.name
      subjectConcepts = agent.domains.slice(0, 4)
    }
  }

  if (!subjectName) {
    // Fall back to a prominent god
    const god = world.agents.find(a => a.type === 'god' && a.alive)
    if (god) {
      subject = 'god'
      subjectId = god.id
      subjectName = god.name
      subjectConcepts = god.domains.slice(0, 4)
    } else {
      subject = 'legend'
      subjectId = null
      subjectName = 'the old world'
      subjectConcepts = world.myth?.act.concepts.slice(0, 3) ?? ['fire']
    }
  }

  // Generate concept-driven word pairs for verses
  const words = subjectConcepts.flatMap(c => {
    const cluster = expandConceptCluster(graph, rng, c, 1, 3)
    return cluster
  })
  const uniqueWords = [...new Set(words)].slice(0, 12)

  // Build 4 verses of 2 lines each
  const verses = []
  /** @type {Array<(w1: string, w2: string) => string>} */
  const templates = [
    (w1, w2) => `When ${subjectName} walked through ${w1},\nthe ${w2} trembled and was still.`,
    (w1, w2) => `They say the ${w1} remembers\nwhat ${subjectName} did to ${w2}.`,
    (w1, w2) => `Oh, ${w1} and ${w2} were the price,\nbut ${subjectName} paid it twice.`,
    (w1, w2) => `Now the ${w1} grows where ${w2} fell,\nand only the old ones can tell.`,
  ]

  for (let i = 0; i < 4; i++) {
    const w1 = uniqueWords[i * 2] ?? uniqueWords[0]
    const w2 = uniqueWords[i * 2 + 1] ?? uniqueWords[1] ?? uniqueWords[0]
    verses.push(templates[i](w1, w2))
  }

  // Refrain from most striking concept
  const strikingConcept = subjectConcepts[0] ?? 'fire'
  const profile = buildSensoryProfile(graph, [strikingConcept])
  const refrainWord = profile.color ?? profile.sound ?? strikingConcept
  const refrain = `And the ${refrainWord} light of ${subjectName} burns on.`

  return { subject, subjectId, concepts: subjectConcepts, verses, refrain }
}

// ── Main entry ──

/**
 * Generate a settlement and write it into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateSettlement(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)

  // ── Step 1: Select region and context ──
  const regionId = world.character?.arrival?.regionId ?? world.chorogony?.regions[0]?.id ?? ''
  const region = findRegion(world, regionId)
  if (!region) return

  const peoples = world.anthropogony?.peoples ?? []
  const peopleName = region.peoples[0]
  const people = peoples.find(p => p.name === peopleName) ?? peoples[0]
  const peopleId = people?.id ?? ''
  const polityId = region.controlledBy
  const religionId = people?.religion ?? null

  // ── Step 2: Generate mythic origin ──
  const archetype = selectArchetype(rng, world, regionId)
  const shapeFn = SETTLEMENT_SHAPES[archetype]
  const shape = shapeFn({ graph, rng, myth, world })

  const { agentId: founderAgentId, eventIndex } = findFoundingHero(world, regionId, rng)
  const founderAgent = founderAgentId ? findAgent(world, founderAgentId) : null

  const originSummaries = /** @type {Record<string, string>} */ ({
    'heros-rest': `Founded where ${founderAgent?.name ?? 'a hero'} chose to rest after a great deed`,
    'heros-sacrifice': `Grew from the aftermath of ${founderAgent?.name ?? 'a hero'}'s sacrifice`,
    'heros-discovery': `Built where ${founderAgent?.name ?? 'a hero'} discovered something divine`,
    'heros-exile': `Settled by followers of ${founderAgent?.name ?? 'a hero'}, exiled from their homeland`,
  })

  // Build village concept cluster
  const baseConcepts = [
    ...(founderAgent?.domains ?? []).slice(0, 2),
    ...region.concepts.slice(0, 3),
    ...(people?.concepts ?? []).slice(0, 2),
  ]
  const villageConcepts = [...new Set(baseConcepts)].slice(0, 6)

  // ── Step 3: Generate crops ──
  const crops = generateCrops(graph, rng, region.concepts, world.morphemes)

  // ── Step 4: Generate livestock ──
  const livestock = generateLivestock(graph, rng, world, region, world.morphemes)

  // ── Step 5: Generate food & drink ──
  const { dish, beverage } = generateFood(graph, rng, crops, livestock, founderAgent?.name ?? null, world.morphemes)

  // ── Step 6: Resolve architecture ──
  const architecture = resolveArchitecture(graph, rng, villageConcepts, region.terrainTypes)

  // ── Step 7: Generate structures ──
  const cultureConcepts = [...villageConcepts, ...(people?.concepts ?? [])]
  const townCenterType = selectTownCenter(graph, rng, cultureConcepts, shape.townCenterBias)
  const townCenterConcepts = expandConceptCluster(graph, rng, villageConcepts[0])
  const townCenterName = nameRegion(graph, townCenterConcepts, rng, {
    syllableRange: [2, 3], entityType: 'place', morphemes: world.morphemes,
  })

  const { type: worshipType, linkedSacredSiteId } = selectWorshipSite(world, rng, regionId, shape.worshipSiteBias)
  const worshipConcepts = expandConceptCluster(graph, rng, villageConcepts[1] ?? villageConcepts[0])
  const worshipName = nameRegion(graph, worshipConcepts, rng, {
    syllableRange: [2, 3], entityType: 'sacred', morphemes: world.morphemes,
  })

  // ── Step 8: Generate NPCs ──
  const npcs = generateNPCs(graph, rng, world, villageConcepts, crops, livestock, beverage, {
    eventIndex, archetype, founderAgentId, summary: originSummaries[archetype],
  }, religionId, polityId, world.morphemes)

  // ── Step 9: Generate traditions ──
  const traditions = generateTraditions(graph, rng, shape.traditionType, villageConcepts, religionId, world, world.morphemes)

  // ── Step 10: Generate bar song ──
  const barSong = generateBarSong(graph, rng, world, shape.songSubjectBias, founderAgentId)

  // ── Step 11: Generate name and assemble ──
  const settlementName = nameRegion(graph, villageConcepts, rng, {
    syllableRange: [2, 3], entityType: 'place', morphemes: world.morphemes,
  })

  /** @type {Settlement} */
  const settlement = {
    id: 'settlement-0',
    name: settlementName,
    type: 'village',
    regionId,
    peopleId,
    polityId,
    religionId,
    concepts: villageConcepts,
    origin: {
      eventIndex,
      archetype,
      founderAgentId,
      summary: originSummaries[archetype],
    },
    crops,
    livestock,
    specialtyDish: dish,
    brewedBeverage: beverage,
    architecture,
    townCenter: { type: townCenterType, name: townCenterName, concepts: townCenterConcepts },
    worshipSite: { type: worshipType, name: worshipName, concepts: worshipConcepts, linkedSacredSiteId },
    npcs,
    traditions,
    barSong,
  }

  world.settlement = settlement

  // ── Emit timeline event ──
  const timeline = world.timeline
  if (timeline) {
    const epoch = timeline.currentEpoch
    addEvent(timeline, {
      id: makeEventId('heroes', epoch, 0),
      age: 'heroes',
      epoch,
      archetype: 'settlement-founded',
      beats: emptyBeats(),
      concepts: villageConcepts,
      participants: founderAgentId ? [founderAgentId] : [],
      mutations: [],
      spawns: [{ entityType: 'settlement', entityData: settlement, assignedId: settlement.id }],
      causedBy: [],
      tags: ['settlement', 'village'],
    })
  }
}
