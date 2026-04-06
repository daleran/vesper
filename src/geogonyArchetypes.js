/**
 * Geogony archetype functions.
 * Each archetype determines how the physical world formed from the myth:
 * what the ground, water, and sky are made of, what terrain types exist,
 * and where major landmarks are.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { Agent } from './pantheon.js'
 * @import { World } from './world.js'
 */
import { query } from './query.js'
import { walkFrom } from './walker.js'
import { pick } from './utils.js'

// ── Context and shape types ──

/**
 * @typedef {{
 *   graph: ConceptGraph,
 *   rng: () => number,
 *   myth: CreationMyth,
 *   world: World,
 * }} GeogonyContext
 */

/**
 * @typedef {{
 *   concepts: string[],
 *   causedBy: string,
 * }} TerrainSeed
 */

/**
 * @typedef {{
 *   concepts: string[],
 *   origin: string,
 *   agentId: string|null,
 * }} LandmarkSeed
 */

/**
 * @typedef {{
 *   worldShape: string,
 *   groundSubstance: string,
 *   waterSubstance: string,
 *   skySubstance: string,
 *   causingAgentId: string|null,
 *   terrainSeeds: TerrainSeed[],
 *   landmarkSeeds: LandmarkSeed[],
 * }} GeogonyShape
 */

// ── Helpers ──

/**
 * Find the first dead god in the agents.
 * @param {Agent[]} agents
 * @returns {Agent | null}
 */
function findDeadGod(agents) {
  return agents.find(a => !a.alive && (a.type === 'god' || a.type === 'demi-god')) ?? null
}

/**
 * Pick a material concept from the graph, preferring those related to a source.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} source
 * @param {string[]} [exclude]
 * @returns {string}
 */
function findMaterial(graph, rng, source, exclude = []) {
  // Try neighbors of source that are materials
  const nearby = query(graph).nearby(source, 1).where('is', 'material').exclude(...exclude).get()
  if (nearby.length > 0) return pick(rng, nearby)

  // Try any material
  const materials = query(graph).where('is', 'material').exclude(...exclude).get()
  if (materials.length > 0) return pick(rng, materials)

  return 'stone'
}

/**
 * Check if a concept has liquid/flowing associations.
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @returns {boolean}
 */
function isFluid(graph, concept) {
  const edges = graph.get(concept)
  if (!edges) return false
  return edges.some(e =>
    (e.relation === 'texture' && e.direction === 'fwd' && e.concept === 'wet') ||
    (e.relation === 'rhymes' && e.concept === 'water') ||
    (e.relation === 'transforms' && e.direction === 'rev' && e.concept === 'water')
  )
}

/**
 * Pick a fluid material for water substance — prefers wet/liquid materials,
 * then falls back to any material near the source.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} source
 * @param {string[]} [exclude]
 * @returns {string}
 */
function findFluid(graph, rng, source, exclude = []) {
  // Try nearby materials with fluid character
  const nearby = query(graph).nearby(source, 2).where('is', 'material').exclude(...exclude).get()
  const fluids = nearby.filter(c => isFluid(graph, c))
  if (fluids.length > 0) return pick(rng, fluids)

  // Try any fluid material
  const allMaterials = query(graph).where('is', 'material').exclude(...exclude).get()
  const allFluids = allMaterials.filter(c => isFluid(graph, c))
  if (allFluids.length > 0) return pick(rng, allFluids)

  // Fall back to any material (weird but not broken)
  return findMaterial(graph, rng, source, exclude)
}

/**
 * Pick a body part concept from the graph.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude]
 * @returns {string}
 */
function findBodyPart(graph, rng, exclude = []) {
  const body = query(graph).where('is', 'body').exclude(...exclude).get()
  if (body.length > 0) return pick(rng, body)
  return 'bone'
}

/**
 * Build terrain seeds from a walk.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} start
 * @param {string} causedBy
 * @param {number} count
 * @param {string[]} [preferRelations]
 * @returns {TerrainSeed[]}
 */
function terrainSeedsFromWalk(graph, rng, start, causedBy, count, preferRelations) {
  /** @type {TerrainSeed[]} */
  const seeds = []
  const used = new Set([start])

  for (let i = 0; i < count; i++) {
    const source = seeds.length > 0 ? pick(rng, seeds).concepts[0] : start
    const chain = walkFrom(graph, rng, source, 2, preferRelations ? { preferRelations } : {})
    const terminal = chain.path[chain.path.length - 1]
    if (used.has(terminal)) continue
    used.add(terminal)

    const nearby = query(graph).nearby(terminal, 1).exclude(...used).get().slice(0, 2)
    for (const n of nearby) used.add(n)
    seeds.push({ concepts: [terminal, ...nearby], causedBy })
  }

  return seeds
}

/**
 * Build a landmark seed from an agent.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {Agent} agent
 * @param {string} origin
 * @returns {LandmarkSeed}
 */
function landmarkFromAgent(graph, rng, agent, origin) {
  const chain = walkFrom(graph, rng, agent.domains[0], 2, { preferRelations: ['transforms', 'produces'] })
  const concepts = [...new Set([...chain.path, ...agent.domains.slice(0, 2)])].slice(0, 4)
  return { concepts, origin, agentId: agent.id }
}

// ── Archetypes ──

/**
 * Body — land is a god's corpse.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function body(ctx) {
  const { graph, rng, world } = ctx
  const dead = findDeadGod(world.agents) ?? world.agents[0]

  const groundSubstance = findBodyPart(graph, rng)
  const waterSubstance = findFluid(graph, rng, dead.domains[0], [groundSubstance])
  const skyEdges = (graph.get(dead.domains[0]) ?? []).filter(e => e.relation === 'evokes' && e.direction === 'fwd')
  const skySubstance = skyEdges.length > 0 ? skyEdges[0].concept : 'breath'

  // Terrain from body-part walks
  const terrainSeeds = terrainSeedsFromWalk(graph, rng, groundSubstance, 'god-corpse', 5, ['transforms', 'produces'])

  // Landmarks at anatomical features
  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  const bodyParts = query(graph).where('is', 'body').exclude(groundSubstance).get()
  for (const part of bodyParts.slice(0, 3)) {
    const nearby = query(graph).nearby(part, 1).exclude(part, groundSubstance).get().slice(0, 2)
    landmarkSeeds.push({ concepts: [part, ...nearby], origin: `${dead.name}'s ${part}`, agentId: dead.id })
  }

  return {
    worldShape: pick(rng, ['flat', 'hollow', 'fractured']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: dead.id,
    terrainSeeds,
    landmarkSeeds,
  }
}

/**
 * Debris — land is wreckage from a cosmic event.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function debris(ctx) {
  const { graph, rng, myth } = ctx
  const collisionConcept = myth.act.concepts.length > 0 ? pick(rng, myth.act.concepts) : myth.worldAfter

  const groundSubstance = findMaterial(graph, rng, collisionConcept)
  const chain = walkFrom(graph, rng, collisionConcept, 2, { preferRelations: ['consumes', 'collides'] })
  const waterSubstance = findFluid(graph, rng, chain.path[chain.path.length - 1], [groundSubstance])
  const skySubstance = pick(rng, ['smoke', 'mist', 'dust', 'fog'].filter(c => graph.has(c)))

  const terrainSeeds = terrainSeedsFromWalk(graph, rng, collisionConcept, 'impact', 5, ['collides', 'consumes'])

  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  // Impact craters from myth concepts
  for (const concept of myth.act.concepts.slice(0, 3)) {
    const nearby = query(graph).nearby(concept, 1).exclude(concept).get().slice(0, 2)
    landmarkSeeds.push({ concepts: [concept, ...nearby], origin: 'impact-scar', agentId: null })
  }

  return {
    worldShape: pick(rng, ['fractured', 'disc', 'flat']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: null,
    terrainSeeds,
    landmarkSeeds,
  }
}

/**
 * Growth — land grew from a seed, root, or coral.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function growth(ctx) {
  const { graph, rng, myth, world } = ctx

  const floraConcepts = query(graph).where('is', 'flora').get()
  const startConcept = floraConcepts.length > 0 ? pick(rng, floraConcepts) : myth.worldAfter
  const groundSubstance = startConcept
  const waterSubstance = findFluid(graph, rng, startConcept, [groundSubstance])
  const skySubstance = floraConcepts.length > 1
    ? pick(rng, floraConcepts.filter(c => c !== startConcept))
    : 'vine'

  const terrainSeeds = terrainSeedsFromWalk(graph, rng, startConcept, 'growth', 5, ['produces', 'transforms'])

  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  // Creator's garden
  const creator = world.agents.find(a => a.mythRole === 'creator')
  if (creator) {
    landmarkSeeds.push(landmarkFromAgent(graph, rng, creator, 'origin-growth'))
  }
  // Ancient flora landmarks
  for (const flora of floraConcepts.slice(0, 2)) {
    const nearby = query(graph).nearby(flora, 1).exclude(flora, startConcept).get().slice(0, 2)
    landmarkSeeds.push({ concepts: [flora, ...nearby], origin: 'ancient-growth', agentId: null })
  }

  return {
    worldShape: pick(rng, ['sphere', 'dome', 'layered']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: creator ? creator.id : null,
    terrainSeeds,
    landmarkSeeds,
  }
}

/**
 * Sediment — land settled from a substance.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function sediment(ctx) {
  const { graph, rng, myth } = ctx
  const settledMaterials = ['ash', 'dust', 'salt', 'silt', 'snow', 'soot', 'clay', 'soil']
    .filter(c => graph.has(c))
  const groundSubstance = settledMaterials.length > 0
    ? pick(rng, settledMaterials)
    : findMaterial(graph, rng, myth.worldAfter)
  const waterSubstance = findFluid(graph, rng, myth.worldAfter, [groundSubstance])
  const skyResidue = myth.act.concepts.length > 0 ? pick(rng, myth.act.concepts) : 'mist'
  const skySubstance = graph.has(skyResidue) ? skyResidue : 'mist'

  const terrainSeeds = terrainSeedsFromWalk(graph, rng, groundSubstance, 'sediment', 5, ['transforms', 'produces'])

  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  // Strata landmarks
  const layers = query(graph).nearby(groundSubstance, 2).exclude(groundSubstance).get().slice(0, 3)
  for (const layer of layers) {
    const nearby = query(graph).nearby(layer, 1).exclude(layer, groundSubstance).get().slice(0, 2)
    landmarkSeeds.push({ concepts: [layer, ...nearby], origin: 'strata-exposure', agentId: null })
  }

  return {
    worldShape: pick(rng, ['flat', 'layered', 'disc']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: null,
    terrainSeeds,
    landmarkSeeds,
  }
}

/**
 * Sculpture — land was deliberately shaped.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function sculpture(ctx) {
  const { graph, rng, myth, world } = ctx
  const craftedMaterials = ['clay', 'glass', 'iron', 'stone', 'obsidian', 'copper', 'gold']
    .filter(c => graph.has(c))
  const groundSubstance = craftedMaterials.length > 0
    ? pick(rng, craftedMaterials)
    : findMaterial(graph, rng, myth.worldAfter)
  const waterSubstance = findFluid(graph, rng, groundSubstance, [groundSubstance])
  const skySubstance = myth.important.length > 0 ? pick(rng, myth.important) : 'light'

  const terrainSeeds = terrainSeedsFromWalk(graph, rng, groundSubstance, 'shaped', 5, ['produces', 'transforms'])

  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  const creator = world.agents.find(a => a.mythRole === 'creator')
  if (creator) {
    landmarkSeeds.push(landmarkFromAgent(graph, rng, creator, 'sculpted'))
    // Tools left behind
    const tool = myth.extra['tool']
    if (typeof tool === 'string' && graph.has(tool)) {
      const nearby = query(graph).nearby(tool, 1).exclude(tool).get().slice(0, 2)
      landmarkSeeds.push({ concepts: [tool, ...nearby], origin: 'abandoned-tool', agentId: creator.id })
    }
  }

  return {
    worldShape: pick(rng, ['sphere', 'dome', 'ring']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: creator ? creator.id : null,
    terrainSeeds,
    landmarkSeeds,
  }
}

/**
 * Precipitation — land fell from above.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function precipitation(ctx) {
  const { graph, rng } = ctx
  const celestialConcepts = query(graph).where('is', 'celestial').get()
  const source = celestialConcepts.length > 0 ? pick(rng, celestialConcepts) : 'star'
  const groundSubstance = findMaterial(graph, rng, source)
  const waterSubstance = findFluid(graph, rng, source, [groundSubstance])
  // Sky is what remains after things fell
  const skyRemains = celestialConcepts.filter(c => c !== source)
  const skySubstance = skyRemains.length > 0 ? pick(rng, skyRemains) : 'void'

  const terrainSeeds = terrainSeedsFromWalk(graph, rng, source, 'fallen', 5, ['produces', 'collides'])

  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  // Impact sites from celestial sources
  const shardChain = walkFrom(graph, rng, source, 3, { preferRelations: ['collides', 'transforms'] })
  for (let i = 1; i < shardChain.path.length; i++) {
    const c = shardChain.path[i]
    const nearby = query(graph).nearby(c, 1).exclude(c, source).get().slice(0, 2)
    landmarkSeeds.push({ concepts: [c, ...nearby], origin: 'fallen-shard', agentId: null })
  }

  return {
    worldShape: pick(rng, ['fractured', 'flat', 'disc']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: null,
    terrainSeeds,
    landmarkSeeds,
  }
}

/**
 * Extrusion — land pulled up from below.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function extrusion(ctx) {
  const { graph, rng, myth } = ctx
  const deepMaterials = ['obsidian', 'iron', 'marrow', 'bone', 'tar', 'copper']
    .filter(c => graph.has(c))
  const groundSubstance = deepMaterials.length > 0
    ? pick(rng, deepMaterials)
    : findMaterial(graph, rng, myth.worldAfter)
  const waterSubstance = findFluid(graph, rng, groundSubstance, [groundSubstance])
  const skySubstance = 'void'

  const terrainSeeds = terrainSeedsFromWalk(graph, rng, groundSubstance, 'extruded', 5, ['produces', 'transforms'])

  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  // Great spires from deep walks
  const spireChain = walkFrom(graph, rng, groundSubstance, 3, { preferRelations: ['transforms', 'produces'] })
  for (let i = 1; i < spireChain.path.length; i++) {
    const c = spireChain.path[i]
    const nearby = query(graph).nearby(c, 1).exclude(c, groundSubstance).get().slice(0, 2)
    landmarkSeeds.push({ concepts: [c, ...nearby], origin: 'erupted-spire', agentId: null })
  }

  return {
    worldShape: pick(rng, ['hollow', 'layered', 'dome']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: null,
    terrainSeeds,
    landmarkSeeds,
  }
}

/**
 * Crystallization — land condensed from energy/sound/thought.
 * @param {GeogonyContext} ctx
 * @returns {GeogonyShape}
 */
function crystallization(ctx) {
  const { graph, rng } = ctx
  const crystalMaterials = ['glass', 'ice', 'salt', 'amber', 'pearl', 'obsidian']
    .filter(c => graph.has(c))
  const groundSubstance = crystalMaterials.length > 0
    ? pick(rng, crystalMaterials)
    : findMaterial(graph, rng, 'light')

  // Water is resonance — find something force-like
  const forces = query(graph).where('is', 'force').get()
  const waterSubstance = forces.length > 0 ? pick(rng, forces) : findMaterial(graph, rng, groundSubstance, [groundSubstance])

  // Sky is the original energy
  const elements = query(graph).where('is', 'element').get()
  const skySubstance = elements.length > 0 ? pick(rng, elements) : 'light'

  const terrainSeeds = terrainSeedsFromWalk(graph, rng, groundSubstance, 'crystallized', 5, ['transforms', 'evokes'])

  /** @type {LandmarkSeed[]} */
  const landmarkSeeds = []
  // Crystalline formations from walks
  const crystalChain = walkFrom(graph, rng, groundSubstance, 3, { preferRelations: ['transforms', 'produces'] })
  for (let i = 1; i < crystalChain.path.length; i++) {
    const c = crystalChain.path[i]
    const nearby = query(graph).nearby(c, 1).exclude(c, groundSubstance).get().slice(0, 2)
    landmarkSeeds.push({ concepts: [c, ...nearby], origin: 'crystal-formation', agentId: null })
  }

  return {
    worldShape: pick(rng, ['sphere', 'ring', 'dome']),
    groundSubstance,
    waterSubstance,
    skySubstance,
    causingAgentId: null,
    terrainSeeds,
    landmarkSeeds,
  }
}

// ── Registry ──

/** @type {Record<string, (ctx: GeogonyContext) => GeogonyShape>} */
export const GEOGONY_SHAPES = {
  body,
  debris,
  growth,
  sediment,
  sculpture,
  precipitation,
  extrusion,
  crystallization,
}

export const GEOGONY_NAMES = /** @type {string[]} */ (Object.keys(GEOGONY_SHAPES))
