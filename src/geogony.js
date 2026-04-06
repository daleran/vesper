/**
 * Geogony generator — determines how the physical world formed from
 * the creation myth. Writes terrain, landmarks, and landscape spirits
 * into the shared World object.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { Agent, AgentSeed } from './pantheon.js'
 * @import { Region } from './history.js'
 * @import { World } from './world.js'
 */
import { pick, weightedPick, conceptOverlap } from './utils.js'
import { query } from './query.js'
import { walkFrom } from './walker.js'
import { buildAgent } from './pantheon.js'
import { nameWorld, nameAgents, nameRegion } from './naming.js'
import { addAgent } from './world.js'
import { GEOGONY_SHAPES, GEOGONY_NAMES } from './geogonyArchetypes.js'
import { VIOLENT_RECIPES, ORGANIC_RECIPES, SPREADING_RECIPES, DELIBERATE_RECIPES, applyRecipeBonuses } from './archetypeSelection.js'
import { resolveShape, resolveSubstance } from './conceptResolvers.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   name: string,
 *   concepts: string[],
 *   shape: string,
 *   substance: string,
 *   causedBy: string,
 * }} TerrainType
 */

/**
 * @typedef {{
 *   name: string,
 *   concepts: string[],
 *   origin: string,
 *   agentId: string|null,
 *   regionId: string|null,
 *   sacredTo: string[],
 * }} Landmark
 */

/**
 * @typedef {{
 *   regionId: string,
 *   terrainTypes: string[],
 *   landmarks: string[],
 *   climate: string[],
 *   dominantSubstance: string,
 * }} RegionEnrichment
 */

// Geogony data is stored in World.geogony (see world.js GeogonyData typedef)

// ── Archetype selection ──

/**
 * Select a geogony archetype using weighted signals from the myth and world.
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {World} world
 * @returns {string}
 */
function selectArchetype(rng, myth, world) {
  // [body, debris, growth, sediment, sculpture, precipitation, extrusion, crystallization]
  const weights = [1, 1, 1, 1, 1, 1, 1, 1]

  // Dead god → body
  if (world.agents.some(a => !a.alive && (a.type === 'god' || a.type === 'demi-god'))) {
    weights[0] += 4
  }

  // Recipe-group signals
  applyRecipeBonuses(weights, myth.recipe, [
    { recipes: VIOLENT_RECIPES, indices: [1], bonus: 3 },       // → debris
    { recipes: ORGANIC_RECIPES, indices: [2], bonus: 3 },       // → growth
    { recipes: SPREADING_RECIPES, indices: [3, 5], bonus: 2 },  // → sediment + precipitation
    { recipes: DELIBERATE_RECIPES, indices: [4], bonus: 3 },    // → sculpture
  ])

  // Concept-based signals
  const allConcepts = new Set([
    ...myth.before.concepts, ...myth.act.concepts,
    ...myth.cost.concepts, ...myth.flaw.concepts,
    ...myth.important,
  ])
  const celestialHits = ['sun', 'moon', 'star', 'dawn', 'dusk', 'meteor'].filter(c => allConcepts.has(c))
  const deepHits = ['cave', 'pit', 'well', 'obsidian', 'marrow', 'iron', 'tomb'].filter(c => allConcepts.has(c))
  const forceHits = ['fire', 'light', 'shadow', 'wind', 'lightning'].filter(c => allConcepts.has(c))

  if (celestialHits.length > 0) weights[5] += 2
  if (deepHits.length > 0) weights[6] += 2
  if (forceHits.length > 0) weights[7] += 2

  return weightedPick(rng, GEOGONY_NAMES, weights)
}

// ── Terrain expansion ──

/**
 * Generate a terrain name from its concepts (short, descriptive).
 * @param {string[]} concepts
 * @param {string} shape
 * @returns {string}
 */
function terrainName(concepts, shape) {
  const primary = concepts[0] ?? 'unknown'
  const shapeNames = /** @type {Record<string, string>} */ ({
    slab: 'flats', hollow: 'basins', pillar: 'spires',
    shard: 'shards', spiral: 'coils', coil: 'tangles',
    circle: 'rings', point: 'peaks', branch: 'reaches',
    web: 'webs', crescent: 'crescents',
  })
  const shapeSuffix = shapeNames[shape] ?? 'lands'
  return `${primary}-${shapeSuffix}`
}

/**
 * Expand terrain seeds into full TerrainType objects.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {import('./geogonyArchetypes.js').TerrainSeed[]} seeds
 * @param {string} groundSubstance
 * @returns {TerrainType[]}
 */
function expandTerrainSeeds(graph, rng, seeds, groundSubstance) {
  /** @type {TerrainType[]} */
  const terrains = []
  const usedNames = new Set()

  for (const seed of seeds) {
    const shape = resolveShape(graph, rng, seed.concepts[0])
    const substance = resolveSubstance(graph, rng, seed.concepts, groundSubstance)
    let name = terrainName(seed.concepts, shape)
    // Ensure unique names
    if (usedNames.has(name)) name = `${seed.concepts[0]}-${shape}`
    usedNames.add(name)

    terrains.push({
      name,
      concepts: seed.concepts,
      shape,
      substance,
      causedBy: seed.causedBy,
    })
  }

  return terrains
}

// ── Landmark expansion ──

/**
 * Expand landmark seeds into named Landmark objects.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {import('./geogonyArchetypes.js').LandmarkSeed[]} seeds
 * @returns {Landmark[]}
 */
function expandLandmarkSeeds(graph, rng, seeds) {
  /** @type {Landmark[]} */
  const landmarks = []
  const usedNames = new Set()

  for (const seed of seeds) {
    const name = nameRegion(graph, seed.concepts, rng, usedNames)
    landmarks.push({
      name,
      concepts: seed.concepts,
      origin: seed.origin,
      agentId: seed.agentId,
      regionId: null,
      sacredTo: [],
    })
  }

  return landmarks
}

// ── Climate derivation ──

/**
 * Derive a global climate baseline from the myth (2-3 concepts).
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @returns {string[]}
 */
function deriveGlobalClimate(graph, rng, myth) {
  const chain = walkFrom(graph, rng, myth.worldAfter, 3, { preferRelations: ['evokes', 'rhymes'] })
  const candidates = [...new Set(chain.path)]

  const elementConcepts = query(graph).where('is', 'element').get()
  const mythElements = elementConcepts.filter(c =>
    myth.flaw.concepts.includes(c) || myth.important.includes(c)
  )
  candidates.push(...mythElements)

  const unique = [...new Set(candidates)]
  const count = Math.min(unique.length, rng() < 0.5 ? 2 : 3)
  return unique.slice(0, count)
}

/**
 * Derive regional climate from a region's concept cluster.
 * Walks from the region's strongest concept via evokes to find
 * atmospheric/sensory associations, then blends with 1 global concept.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} regionConcepts
 * @param {string[]} globalClimate
 * @returns {string[]}
 */
function deriveRegionClimate(graph, rng, regionConcepts, globalClimate) {
  if (regionConcepts.length === 0) return globalClimate.slice(0, 2)

  // Walk from a regional concept to find local atmospheric feel
  const source = pick(rng, regionConcepts)
  const chain = walkFrom(graph, rng, source, 2, { preferRelations: ['evokes', 'rhymes'] })
  const localConcepts = chain.path.filter(c => !regionConcepts.includes(c))

  /** @type {string[]} */
  const climate = []

  // 1 local concept from the regional walk
  if (localConcepts.length > 0) climate.push(localConcepts[0])

  // 1 global concept for world coherence
  if (globalClimate.length > 0) climate.push(pick(rng, globalClimate))

  // 1 more local if available, for variety
  if (localConcepts.length > 1 && rng() < 0.5) climate.push(localConcepts[1])

  return [...new Set(climate)].slice(0, 3)
}

// ── Materials derivation ──

/**
 * Derive 6-12 dominant material concepts.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} ground
 * @param {string} water
 * @param {string} sky
 * @param {TerrainType[]} terrains
 * @returns {string[]}
 */
function deriveMaterials(graph, rng, ground, water, sky, terrains) {
  const materialSet = new Set([ground])
  // Check if water/sky are materials
  for (const c of [water, sky]) {
    const edges = graph.get(c)
    if (edges && edges.some(e => e.relation === 'is' && e.direction === 'fwd' && e.concept === 'material')) {
      materialSet.add(c)
    }
  }
  // Add terrain substances
  for (const t of terrains) {
    const edges = graph.get(t.substance)
    if (edges && edges.some(e => e.relation === 'is' && e.direction === 'fwd' && e.concept === 'material')) {
      materialSet.add(t.substance)
    }
  }
  // Expand via texture/color neighbors of existing materials
  if (materialSet.size < 8) {
    for (const mat of [...materialSet]) {
      if (materialSet.size >= 10) break
      const neighbors = query(graph).nearby(mat, 1).where('is', 'material').exclude(...materialSet).get()
      for (const n of neighbors.slice(0, 2)) {
        materialSet.add(n)
        if (materialSet.size >= 10) break
      }
    }
  }
  // If still thin, walk from ground to find more
  if (materialSet.size < 6) {
    const chain = walkFrom(graph, rng, ground, 3, { preferRelations: ['transforms', 'produces'] })
    for (const c of chain.path) {
      if (materialSet.size >= 8) break
      const edges = graph.get(c)
      if (edges && edges.some(e => e.relation === 'is' && e.direction === 'fwd' && e.concept === 'material')) {
        materialSet.add(c)
      }
    }
  }
  return [...materialSet].slice(0, 12)
}

// ── Landscape agents ──

/**
 * Spawn landscape spirit agents from substances and add them to world.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {World} world
 * @param {string} ground
 * @param {string} water
 * @param {string} sky
 */
function spawnLandscapeAgents(graph, rng, myth, world, ground, water, sky) {
  /** @type {Agent[]} */
  const spawned = []

  for (const substance of [ground, water, sky]) {
    if (rng() > 0.4) continue // ~40% chance each
    if (spawned.length >= 3) break

    const nearby = query(graph).nearby(substance, 1).exclude(substance).get().slice(0, 2)
    /** @type {AgentSeed} */
    const seed = {
      domains: [substance, ...nearby],
      type: 'spirit',
      mythRole: 'landscape-guardian',
      alive: true,
      state: 'active',
    }
    const agent = buildAgent(seed)
    addAgent(world, agent, 'landscape')
    spawned.push(agent)
  }

  if (spawned.length > 0) {
    nameAgents(graph, myth, spawned, rng)
  }
}

// ── Region enrichment ──

/**
 * Enrich history regions with terrain types, landmarks, and climate.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {Region[]} regions
 * @param {TerrainType[]} terrains
 * @param {Landmark[]} landmarks
 * @param {string[]} globalClimate
 * @param {string} groundSubstance
 * @returns {RegionEnrichment[]}
 */
function enrichRegions(graph, rng, regions, terrains, landmarks, globalClimate, groundSubstance) {
  /** @type {RegionEnrichment[]} */
  const enrichments = []

  // Track terrain assignment counts to ensure distribution
  const terrainAssignCounts = new Map(terrains.map(t => [t.name, 0]))

  for (const region of regions) {
    // Score terrains against this region
    const scoredTerrains = terrains.map(t => ({
      terrain: t,
      score: conceptOverlap(graph, t.concepts, region.concepts),
    })).sort((a, b) => b.score - a.score)

    // Assign 1-3 terrain types, penalizing overused terrains
    const assignedTerrains = []
    for (const { terrain, score } of scoredTerrains) {
      if (assignedTerrains.length >= 3) break
      // Skip terrains already assigned to many regions (diminishing returns)
      const count = terrainAssignCounts.get(terrain.name) ?? 0
      if (count >= 3 && score < 2 && assignedTerrains.length > 0) continue
      assignedTerrains.push(terrain.name)
      terrainAssignCounts.set(terrain.name, count + 1)
    }
    // Ensure at least 1
    if (assignedTerrains.length === 0 && terrains.length > 0) {
      // Pick the least-used terrain
      const leastUsed = [...terrainAssignCounts.entries()].sort((a, b) => a[1] - b[1])[0]
      if (leastUsed) assignedTerrains.push(leastUsed[0])
    }

    // Find dominant substance for this region
    const substanceCounts = /** @type {Record<string, number>} */ ({})
    for (const tName of assignedTerrains) {
      const terrain = terrains.find(t => t.name === tName)
      if (terrain) {
        substanceCounts[terrain.substance] = (substanceCounts[terrain.substance] ?? 0) + 1
      }
    }
    const dominantSubstance = Object.entries(substanceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? groundSubstance

    // Derive per-region climate from the region's concept tags
    const regionClimate = deriveRegionClimate(graph, rng, region.concepts, globalClimate)

    enrichments.push({
      regionId: region.id,
      terrainTypes: assignedTerrains,
      landmarks: [],
      climate: regionClimate,
      dominantSubstance,
    })
  }

  // Assign landmarks to best-matching regions
  const regionLandmarkCounts = new Map(regions.map(r => [r.id, 0]))
  for (const landmark of landmarks) {
    let bestRegion = ''
    let bestScore = -1

    for (const region of regions) {
      let score = conceptOverlap(graph, landmark.concepts, region.concepts)
      if (landmark.agentId !== null) score += 1
      if (score > bestScore) {
        bestScore = score
        bestRegion = region.id
      }
    }

    if (bestRegion) {
      landmark.regionId = bestRegion
      const enrichment = enrichments.find(e => e.regionId === bestRegion)
      if (enrichment) enrichment.landmarks.push(landmark.name)
      regionLandmarkCounts.set(bestRegion, (regionLandmarkCounts.get(bestRegion) ?? 0) + 1)
    }
  }

  // Ensure every region has at least one landmark — generate from region concepts
  for (const region of regions) {
    if ((regionLandmarkCounts.get(region.id) ?? 0) > 0) continue
    const enrichment = enrichments.find(e => e.regionId === region.id)
    if (!enrichment) continue

    // Walk from the region's primary concept to find a landmark
    const source = region.concepts[0] ?? groundSubstance
    const chain = walkFrom(graph, rng, source, 2, { preferRelations: ['transforms', 'evokes'] })
    const concepts = [...new Set([...chain.path, ...region.concepts.slice(0, 2)])].slice(0, 4)
    const usedNames = new Set(landmarks.map(l => l.name.toLowerCase()))
    const name = nameRegion(graph, concepts, rng, usedNames)
    landmarks.push({
      name,
      concepts,
      origin: 'regional',
      agentId: null,
      regionId: region.id,
      sacredTo: [],
    })
    enrichment.landmarks.push(name)
  }

  // Ensure every terrain type is assigned to at least one region
  for (const [name, count] of terrainAssignCounts) {
    if (count === 0 && enrichments.length > 0) {
      // Put unused terrain in the region with fewest terrains
      const sparse = enrichments.reduce((a, b) => a.terrainTypes.length <= b.terrainTypes.length ? a : b)
      sparse.terrainTypes.push(name)
    }
  }

  return enrichments
}

// ── Main entry ──

/**
 * Generate geogony and write physical world data into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateGeogony(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)

  // 1. Name the world
  const worldName = nameWorld(graph, myth, rng)

  // 2. Select archetype
  const recipe = selectArchetype(rng, myth, world)
  const shapeFn = GEOGONY_SHAPES[recipe]

  // 3. Run archetype shape function
  const shape = shapeFn({ graph, rng, myth, world })

  // 4. Expand terrain seeds (target 6-10)
  let terrainTypes = expandTerrainSeeds(graph, rng, shape.terrainSeeds, shape.groundSubstance)
  // If we have fewer than 6 terrains, generate more from region concepts
  if (terrainTypes.length < 6 && world.regions.length > 0) {
    const existingConcepts = new Set(terrainTypes.flatMap(t => t.concepts))
    for (const region of world.regions) {
      if (terrainTypes.length >= 8) break
      const fresh = region.concepts.filter(c => !existingConcepts.has(c))
      if (fresh.length === 0) continue
      const concept = fresh[0]
      const shape2 = resolveShape(graph, rng, concept)
      const substance = resolveSubstance(graph, rng, [concept], shape.groundSubstance)
      const name = terrainName([concept], shape2)
      terrainTypes.push({
        name,
        concepts: fresh.slice(0, 3),
        shape: shape2,
        substance,
        causedBy: 'regional',
      })
      for (const c of fresh.slice(0, 3)) existingConcepts.add(c)
    }
  }
  terrainTypes = terrainTypes.slice(0, 10)

  // 5. Expand landmark seeds (target 4-8)
  let landmarks = expandLandmarkSeeds(graph, rng, shape.landmarkSeeds)
  // Fill to at least 4 from myth concepts
  if (landmarks.length < 4) {
    const usedNames = new Set(landmarks.map(l => l.name.toLowerCase()))
    const mythConcepts = [...myth.important, ...myth.bad].filter(c =>
      !landmarks.some(l => l.concepts.includes(c))
    )
    for (const concept of mythConcepts) {
      if (landmarks.length >= 6) break
      const nearby = query(graph).nearby(concept, 1).exclude(concept).get().slice(0, 2)
      const name = nameRegion(graph, [concept, ...nearby], rng, usedNames)
      landmarks.push({
        name,
        concepts: [concept, ...nearby],
        origin: 'myth-echo',
        agentId: null,
        regionId: null,
        sacredTo: [],
      })
    }
  }
  landmarks = landmarks.slice(0, 8)

  // 6. Derive materials
  const materials = deriveMaterials(graph, rng, shape.groundSubstance, shape.waterSubstance, shape.skySubstance, terrainTypes)

  // 7. Derive global climate baseline
  const globalClimate = deriveGlobalClimate(graph, rng, myth)

  // 8. Spawn landscape agents into world
  spawnLandscapeAgents(graph, rng, myth, world, shape.groundSubstance, shape.waterSubstance, shape.skySubstance)

  // 9. Enrich history regions (per-region climate derived inside)
  const regionEnrichments = enrichRegions(graph, rng, world.regions, terrainTypes, landmarks, globalClimate, shape.groundSubstance)

  world.geogony = {
    worldName,
    recipe,
    worldShape: shape.worldShape,
    groundSubstance: shape.groundSubstance,
    waterSubstance: shape.waterSubstance,
    skySubstance: shape.skySubstance,
    terrainTypes,
    landmarks,
    materials,
    climate: globalClimate,
    causingAgentId: shape.causingAgentId,
    regionEnrichments,
  }
}
