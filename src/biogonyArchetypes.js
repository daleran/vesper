/**
 * Biogony archetype functions.
 * Each archetype determines how life arose from the creation myth:
 * what creatures exist, what they emerged from, and what went extinct.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
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
 * }} BiogonyContext
 */

/**
 * @typedef {{
 *   baseConcept: string,
 *   category: 'fauna'|'flora'|'hybrid',
 *   origin: string,
 *   sourceAgentId: string|null,
 * }} LifeformSeed
 */

/**
 * @typedef {{
 *   lifeformSeeds: LifeformSeed[],
 *   flawSeeds: LifeformSeed[],
 *   extinctionConcepts: string[],
 *   originAgentId: string|null,
 * }} BiogonyShape
 */

// ── Helpers ──

/** @type {Set<string>} */
const FAUNA_LIKE = new Set(['fauna'])
/** @type {Set<string>} */
const FLORA_LIKE = new Set(['flora'])

/**
 * Classify a concept as fauna, flora, or hybrid.
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @returns {'fauna'|'flora'|'hybrid'}
 */
function classifyConcept(graph, concept) {
  const edges = graph.get(concept)
  if (!edges) return 'hybrid'
  for (const e of edges) {
    if (e.relation === 'is' && e.direction === 'fwd') {
      if (FAUNA_LIKE.has(e.concept)) return 'fauna'
      if (FLORA_LIKE.has(e.concept)) return 'flora'
    }
  }
  return 'hybrid'
}

/**
 * Find fauna or flora concepts reachable from a starting concept via walks.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} start
 * @param {string[]} preferRelations
 * @param {Set<string>} exclude
 * @param {number} count
 * @returns {string[]}
 */
function findLifeConceptsViaWalk(graph, rng, start, preferRelations, exclude, count) {
  const allLife = new Set([
    ...query(graph).where('is', 'fauna').get(),
    ...query(graph).where('is', 'flora').get(),
  ])
  /** @type {string[]} */
  const found = []
  const tried = new Set([start])

  for (let attempt = 0; attempt < count * 3 && found.length < count; attempt++) {
    const source = found.length > 0 && rng() < 0.3 ? pick(rng, found) : start
    const chain = walkFrom(graph, rng, source, 3, { preferRelations })
    for (const c of chain.path) {
      if (tried.has(c) || exclude.has(c)) continue
      tried.add(c)
      if (allLife.has(c)) {
        found.push(c)
        if (found.length >= count) break
      }
    }
  }

  // If walks didn't find enough, fall back to ranked query
  if (found.length < count) {
    const ranked = query(graph).where('is', 'fauna').or('is', 'flora')
      .exclude(...exclude, ...found)
      .rank([start]).get()
    for (const c of ranked) {
      if (found.length >= count) break
      if (!found.includes(c)) found.push(c)
    }
    // Still short — grab any remaining
    const pool = [...allLife].filter(c => !exclude.has(c) && !found.includes(c))
    for (const c of pool) {
      if (found.length >= count) break
      if (!found.includes(c)) found.push(c)
    }
  }

  return found.slice(0, count)
}

/**
 * Extract extinction concepts from the myth's cost beat.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @returns {string[]}
 */
function findExtinctions(graph, rng, myth) {
  const costConcepts = myth.cost.concepts
  const allLife = new Set([
    ...query(graph).where('is', 'fauna').get(),
    ...query(graph).where('is', 'flora').get(),
    ...query(graph).where('is', 'body').get(),
  ])

  // Direct hits
  const direct = costConcepts.filter(c => allLife.has(c))
  if (direct.length > 0) return direct.slice(0, 3)

  // Walk from cost concepts to find nearby life
  /** @type {string[]} */
  const found = []
  for (const c of costConcepts) {
    if (found.length >= 2) break
    const chain = walkFrom(graph, rng, c, 2, { preferRelations: ['transforms', 'consumes'] })
    for (const p of chain.path) {
      if (allLife.has(p) && !found.includes(p)) {
        found.push(p)
        break
      }
    }
  }

  return found.length > 0 ? found.slice(0, 3) : [pick(rng, [...allLife])]
}

/**
 * Generate flaw seeds from the myth's flaw concepts.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {Set<string>} exclude
 * @returns {LifeformSeed[]}
 */
function findFlawSeeds(graph, rng, myth, exclude) {
  const flawConcepts = myth.flaw.concepts
  if (flawConcepts.length === 0) return []

  const targets = findLifeConceptsViaWalk(
    graph, rng,
    pick(rng, flawConcepts),
    ['consumes', 'collides', 'transforms'],
    exclude,
    2
  )

  return targets.map(c => ({
    baseConcept: c,
    category: classifyConcept(graph, c),
    origin: 'flaw-corruption',
    sourceAgentId: null,
  }))
}

// ── Archetypes ──

/**
 * Seeding — a god scatters life deliberately.
 * @param {BiogonyContext} ctx
 * @returns {BiogonyShape}
 */
function seeding(ctx) {
  const { graph, rng, myth, world } = ctx
  const creator = world.agents.find(a => a.mythRole === 'creator' && a.alive)
    ?? world.agents.find(a => a.type === 'god' && a.alive)
    ?? world.agents[0]

  const startDomain = creator.domains[0] ?? myth.worldAfter
  const exclude = new Set(/** @type {string[]} */ ([]))
  const lifeConcepts = findLifeConceptsViaWalk(
    graph, rng, startDomain,
    ['produces', 'transforms'], exclude, 6
  )

  const seeds = lifeConcepts.map(c => ({
    baseConcept: c,
    category: classifyConcept(graph, c),
    origin: 'scattered',
    sourceAgentId: creator.id,
  }))

  const usedSet = new Set(lifeConcepts)
  const flawSeeds = findFlawSeeds(graph, rng, myth, usedSet)
  const extinctionConcepts = findExtinctions(graph, rng, myth)

  return {
    lifeformSeeds: seeds,
    flawSeeds,
    extinctionConcepts,
    originAgentId: creator.id,
  }
}

/**
 * Spawning — life emerges uninstructed from terrain or materials.
 * @param {BiogonyContext} ctx
 * @returns {BiogonyShape}
 */
function spawning(ctx) {
  const { graph, rng, myth, world } = ctx
  const terrainTypes = world.geogony?.terrainTypes ?? []

  // Gather starting concepts from terrain
  const terrainConcepts = terrainTypes.flatMap(t => t.concepts).slice(0, 10)
  const starts = terrainConcepts.length > 0
    ? [...new Set(terrainConcepts)]
    : [myth.worldAfter]

  const exclude = new Set(/** @type {string[]} */ ([]))
  /** @type {LifeformSeed[]} */
  const seeds = []

  for (const start of starts.slice(0, 5)) {
    if (seeds.length >= 6) break
    const found = findLifeConceptsViaWalk(
      graph, rng, start,
      ['produces', 'transforms'], exclude, 2
    )
    for (const c of found) {
      exclude.add(c)
      seeds.push({
        baseConcept: c,
        category: classifyConcept(graph, c),
        origin: 'emerged',
        sourceAgentId: null,
      })
    }
  }

  const flawSeeds = findFlawSeeds(graph, rng, myth, exclude)
  const extinctionConcepts = findExtinctions(graph, rng, myth)

  return {
    lifeformSeeds: seeds,
    flawSeeds,
    extinctionConcepts,
    originAgentId: null,
  }
}

/**
 * Shedding — creatures formed from parts of gods.
 * @param {BiogonyContext} ctx
 * @returns {BiogonyShape}
 */
function shedding(ctx) {
  const { graph, rng, myth, world } = ctx
  const deadOrTransformed = world.agents.filter(
    a => !a.alive || a.state === 'transformed'
  )
  const sourceAgents = deadOrTransformed.length > 0
    ? deadOrTransformed.slice(0, 3)
    : world.agents.filter(a => a.type === 'god' || a.type === 'demi-god').slice(0, 3)

  const bodyParts = query(graph).where('is', 'body').get()
  const exclude = new Set(/** @type {string[]} */ ([]))
  /** @type {LifeformSeed[]} */
  const seeds = []

  for (const agent of sourceAgents) {
    if (seeds.length >= 6) break
    // Pick a body part near the agent's domain
    const ranked = query(graph).where('is', 'body').rank(agent.domains).get()
    const bodyPart = ranked.length > 0 ? ranked[0] : pick(rng, bodyParts)

    // Walk from body part to find life
    const found = findLifeConceptsViaWalk(
      graph, rng, bodyPart,
      ['transforms', 'produces'], exclude, 2
    )

    for (const c of found) {
      exclude.add(c)
      seeds.push({
        baseConcept: c,
        category: classifyConcept(graph, c),
        origin: `shed from ${agent.name}`,
        sourceAgentId: agent.id,
      })
    }
  }

  const primaryAgent = sourceAgents[0]
  const flawSeeds = findFlawSeeds(graph, rng, myth, exclude)
  const extinctionConcepts = findExtinctions(graph, rng, myth)

  return {
    lifeformSeeds: seeds,
    flawSeeds,
    extinctionConcepts,
    originAgentId: primaryAgent?.id ?? null,
  }
}

/**
 * Echoing — life mimics the shape of the creation act.
 * @param {BiogonyContext} ctx
 * @returns {BiogonyShape}
 */
function echoing(ctx) {
  const { graph, rng, myth } = ctx
  const actConcepts = myth.act.concepts.length > 0
    ? myth.act.concepts
    : [myth.worldAfter]

  const exclude = new Set(/** @type {string[]} */ ([]))
  /** @type {LifeformSeed[]} */
  const seeds = []

  for (const concept of actConcepts.slice(0, 4)) {
    if (seeds.length >= 6) break
    const found = findLifeConceptsViaWalk(
      graph, rng, concept,
      ['rhymes', 'evokes'], exclude, 2
    )
    for (const c of found) {
      exclude.add(c)
      seeds.push({
        baseConcept: c,
        category: classifyConcept(graph, c),
        origin: `echo of ${concept}`,
        sourceAgentId: null,
      })
    }
  }

  const flawSeeds = findFlawSeeds(graph, rng, myth, exclude)
  const extinctionConcepts = findExtinctions(graph, rng, myth)

  return {
    lifeformSeeds: seeds,
    flawSeeds,
    extinctionConcepts,
    originAgentId: null,
  }
}

/**
 * Parasiting — life feeds on the world's wound.
 * @param {BiogonyContext} ctx
 * @returns {BiogonyShape}
 */
function parasiting(ctx) {
  const { graph, rng, myth } = ctx
  const flawConcepts = myth.flaw.concepts.length > 0
    ? myth.flaw.concepts
    : myth.bad.length > 0 ? myth.bad : [myth.worldAfter]

  const exclude = new Set(/** @type {string[]} */ ([]))
  /** @type {LifeformSeed[]} */
  const seeds = []

  // All lifeforms in parasiting are flaw-driven
  for (const concept of flawConcepts.slice(0, 3)) {
    if (seeds.length >= 6) break
    const found = findLifeConceptsViaWalk(
      graph, rng, concept,
      ['consumes', 'transforms', 'collides'], exclude, 3
    )
    for (const c of found) {
      exclude.add(c)
      seeds.push({
        baseConcept: c,
        category: classifyConcept(graph, c),
        origin: 'flaw-born',
        sourceAgentId: null,
      })
    }
  }

  const extinctionConcepts = findExtinctions(graph, rng, myth)

  return {
    lifeformSeeds: seeds,
    flawSeeds: seeds.map(s => ({ ...s })), // all are flaw life
    extinctionConcepts,
    originAgentId: null,
  }
}

/**
 * Adapting — life shaped by terrain constraints.
 * @param {BiogonyContext} ctx
 * @returns {BiogonyShape}
 */
function adapting(ctx) {
  const { graph, rng, myth, world } = ctx
  const terrainTypes = world.geogony?.terrainTypes ?? []

  const exclude = new Set(/** @type {string[]} */ ([]))
  /** @type {LifeformSeed[]} */
  const seeds = []

  for (const terrain of terrainTypes.slice(0, 6)) {
    if (seeds.length >= 6) break
    const source = terrain.concepts[0] ?? myth.worldAfter
    const found = findLifeConceptsViaWalk(
      graph, rng, source,
      ['produces', 'transforms', 'evokes'], exclude, 1
    )
    for (const c of found) {
      exclude.add(c)
      seeds.push({
        baseConcept: c,
        category: classifyConcept(graph, c),
        origin: `adapted to ${terrain.name}`,
        sourceAgentId: null,
      })
    }
  }

  const flawSeeds = findFlawSeeds(graph, rng, myth, exclude)
  const extinctionConcepts = findExtinctions(graph, rng, myth)

  return {
    lifeformSeeds: seeds,
    flawSeeds,
    extinctionConcepts,
    originAgentId: null,
  }
}

// ── Registry ──

/** @type {Record<string, (ctx: BiogonyContext) => BiogonyShape>} */
export const BIOGONY_SHAPES = {
  seeding,
  spawning,
  shedding,
  echoing,
  parasiting,
  adapting,
}

export const BIOGONY_NAMES = /** @type {string[]} */ (Object.keys(BIOGONY_SHAPES))
