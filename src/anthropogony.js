/**
 * Anthropogony generator — determines how peoples arose from the creation myth.
 * Writes peoples, common memory, and disputes into the shared World object.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 */
import { weightedPick, resolveTerrainAffinity } from './utils.js'
import { query } from './query.js'
import { nameRegion } from './naming.js'
import { ANTHROPOGONY_SHAPES, ANTHROPOGONY_NAMES } from './anthropogonyArchetypes.js'
import { DELIBERATE_RECIPES, ORGANIC_RECIPES, CYCLIC_RECIPES, applyRecipeBonuses } from './archetypeSelection.js'
import { resolvePhysicalTraits, expandConceptCluster } from './conceptResolvers.js'

/**
 * @import { PhysicalTraits } from './conceptResolvers.js'
 */

// ── Typedefs ──

/**
 * @typedef {{
 *   name: string,
 *   concepts: string[],
 *   creatorAgent: string|null,
 *   patronAgent: string|null,
 *   purpose: string,
 *   gift: string,
 *   flaw: string,
 *   terrainAffinity: string[],
 *   remembers: string[],
 *   fears: string[],
 *   physicalTraits: PhysicalTraits,
 *   origin: string,
 *   religion: string|null,
 * }} People
 */

// ── Helpers ──

/**
 * Find myth concepts within 1 hop of a people's concept cluster.
 * @param {ConceptGraph} graph
 * @param {string[]} mythConcepts
 * @param {string[]} peopleConcepts
 * @param {number} max
 * @returns {string[]}
 */
function findNearby(graph, mythConcepts, peopleConcepts, max) {
  const peopleSet = new Set(peopleConcepts)
  /** @type {string[]} */
  const found = []

  for (const mc of mythConcepts) {
    if (found.length >= max) break

    // Direct overlap
    if (peopleSet.has(mc)) {
      found.push(mc)
      continue
    }

    // 1-hop neighbor check
    const edges = graph.get(mc)
    if (!edges) continue
    for (const e of edges) {
      if (peopleSet.has(e.concept)) {
        found.push(mc)
        break
      }
    }
  }

  // If none found, take closest myth concepts by overlap score
  if (found.length === 0 && mythConcepts.length > 0) {
    found.push(mythConcepts[0])
  }

  return found.slice(0, max)
}

// ── Archetype selection ──

/**
 * Select an anthropogony archetype using weighted signals.
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {World} world
 * @param {ConceptGraph} _graph
 * @returns {string}
 */
function selectArchetype(rng, myth, world, _graph) {
  // [fashioned, awakened, fallen, exiled, split, unintended]
  const weights = [1, 1, 1, 1, 1, 1]

  // Recipe-group signals
  applyRecipeBonuses(weights, myth.recipe, [
    { recipes: DELIBERATE_RECIPES, indices: [0], bonus: 3 },  // → fashioned
    { recipes: ORGANIC_RECIPES, indices: [1], bonus: 3 },     // → awakened
    { recipes: CYCLIC_RECIPES, indices: [1], bonus: 2 },      // → awakened
  ])

  // Dead/transformed agents -> fallen
  if (world.agents.some(a => !a.alive || a.state === 'transformed')) {
    weights[2] += 4
  }

  // Sacrifice/mourning myth -> fallen
  if (myth.recipe === 'sacrifice' || myth.recipe === 'mourning') {
    weights[2] += 2
  }

  // Exiled agents or exile recipe -> exiled
  if (world.agents.some(a => a.state === 'exiled')) weights[3] += 3
  if (myth.recipe === 'exile') weights[3] += 2

  // Sundering events or splitting recipe -> split
  if (world.events.some(e => e.archetype === 'sundering')) weights[4] += 4
  if (myth.recipe === 'splitting') weights[4] += 2

  // Parasiting biogony or accident/corruption myth -> unintended
  if (world.biogony?.recipe === 'parasiting') weights[5] += 3
  if (myth.recipe === 'accident' || myth.recipe === 'corruption') weights[5] += 2

  return weightedPick(rng, ANTHROPOGONY_NAMES, weights)
}

// ── Main entry ──

/**
 * Generate anthropogony and write peoples data into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateAnthropogony(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)
  const terrainTypes = world.geogony?.terrainTypes ?? []

  // 1. Select archetype
  const recipe = selectArchetype(rng, myth, world, graph)
  const shapeFn = ANTHROPOGONY_SHAPES[recipe]

  // 2. Run archetype shape function
  const shape = shapeFn({ graph, rng, myth, world })

  // 3. Expand people seeds into full People
  /** @type {People[]} */
  const peoples = []
  const usedNames = new Set()
  const usedBaseConcepts = new Set()

  for (const seed of shape.peopleSeeds) {
    if (usedBaseConcepts.has(seed.baseConcept)) continue
    usedBaseConcepts.add(seed.baseConcept)

    // Expand concept cluster (4-6 concepts via 2-3 hop walk)
    const conceptCluster = expandConceptCluster(graph, rng, seed.baseConcept, 3, 6)

    // Purpose — force concept ranked by proximity to cluster
    const purpose = query(graph).where('is', 'force')
      .exclude(...conceptCluster)
      .rank(conceptCluster).first()
      ?? 'endurance'

    // Gift — item concept ranked by proximity to cluster
    const gift = query(graph).where('is', 'item')
      .exclude(...conceptCluster)
      .rank(conceptCluster).first()
      ?? 'tool'

    // Flaw — myth flaw concept nearest to cluster
    const flawConcepts = myth.flaw.concepts.length > 0
      ? myth.flaw.concepts
      : myth.bad
    const flaw = findNearby(graph, flawConcepts, conceptCluster, 1)[0]
      ?? (flawConcepts.length > 0 ? flawConcepts[0] : 'wound')

    // Terrain affinity
    const terrainAffinity = resolveTerrainAffinity(graph, conceptCluster, terrainTypes)

    // Remembers — myth act/cost concepts within 1 hop
    const memoryConcepts = [...myth.act.concepts, ...myth.cost.concepts]
    const remembers = findNearby(graph, memoryConcepts, conceptCluster, 2)

    // Fears — myth flaw/bad concepts within 1 hop
    const fearConcepts = [...myth.flaw.concepts, ...myth.bad]
    const fears = findNearby(graph, fearConcepts, conceptCluster, 2)

    // Physical traits
    const physicalTraits = resolvePhysicalTraits(graph, conceptCluster)

    // Name
    const name = nameRegion(graph, conceptCluster, rng, usedNames)

    // Resolve agent names for display
    const creatorAgent = seed.creatorAgentId
    const patronAgent = seed.patronAgentId

    peoples.push({
      name,
      concepts: conceptCluster,
      creatorAgent,
      patronAgent,
      purpose,
      gift,
      flaw,
      terrainAffinity,
      remembers,
      fears,
      physicalTraits,
      origin: seed.origin,
      religion: null,
    })
  }

  // 4. Fill to 3 minimum
  if (peoples.length < 3) {
    const materials = world.geogony?.materials ?? []
    const lifeforms = world.biogony?.lifeforms ?? []
    const fillPool = [
      ...materials.filter(m => !usedBaseConcepts.has(m)),
      ...lifeforms.map(lf => lf.concepts[0]).filter(c => !usedBaseConcepts.has(c)),
    ]

    // If still empty, grab some forces
    if (fillPool.length === 0) {
      const forces = query(graph).where('is', 'force')
        .exclude(...usedBaseConcepts)
        .random(rng, 3)
      fillPool.push(...forces)
    }

    for (const concept of fillPool) {
      if (peoples.length >= 3) break
      if (usedBaseConcepts.has(concept)) continue
      usedBaseConcepts.add(concept)

      const conceptCluster = expandConceptCluster(graph, rng, concept, 3, 6)

      const purpose = query(graph).where('is', 'force')
        .exclude(...conceptCluster).rank(conceptCluster).first() ?? 'endurance'
      const gift = query(graph).where('is', 'item')
        .exclude(...conceptCluster).rank(conceptCluster).first() ?? 'tool'
      const flawConcepts = myth.flaw.concepts.length > 0 ? myth.flaw.concepts : myth.bad
      const flaw = findNearby(graph, flawConcepts, conceptCluster, 1)[0]
        ?? (flawConcepts.length > 0 ? flawConcepts[0] : 'wound')

      const terrainAffinity = resolveTerrainAffinity(graph, conceptCluster, terrainTypes)
      const remembers = findNearby(graph, [...myth.act.concepts, ...myth.cost.concepts], conceptCluster, 2)
      const fears = findNearby(graph, [...myth.flaw.concepts, ...myth.bad], conceptCluster, 2)
      const physicalTraits = resolvePhysicalTraits(graph, conceptCluster)
      const name = nameRegion(graph, conceptCluster, rng, usedNames)

      peoples.push({
        name,
        concepts: conceptCluster,
        creatorAgent: null,
        patronAgent: null,
        purpose,
        gift,
        flaw,
        terrainAffinity,
        remembers,
        fears,
        physicalTraits,
        origin: 'spontaneous',
        religion: null,
      })
    }
  }

  // Cap at 6
  const finalPeoples = peoples.slice(0, 6)

  // 5. Derive common memory
  const allPeopleConcepts = finalPeoples.flatMap(p => p.concepts)
  const conceptCounts = new Map()
  for (const c of allPeopleConcepts) {
    conceptCounts.set(c, (conceptCounts.get(c) ?? 0) + 1)
  }
  const mythImportant = new Set([...myth.act.concepts, ...myth.important])
  const commonMemory = [...conceptCounts.entries()]
    .filter(([c, count]) => count >= 2 && mythImportant.has(c))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c)

  // If none found, pick the most-shared myth concept
  if (commonMemory.length === 0 && myth.important.length > 0) {
    commonMemory.push(myth.important[0])
  }

  // 6. Derive disputes — flaw concepts that divide peoples
  /** @type {string[]} */
  const disputes = []
  const flawPool = [...myth.flaw.concepts, ...myth.bad]
  for (const fc of flawPool) {
    if (disputes.length >= 3) break
    const inFears = finalPeoples.some(p => p.fears.includes(fc))
    const inRemembers = finalPeoples.some(p => p.remembers.includes(fc))
    if (inFears && inRemembers) {
      disputes.push(fc)
    }
  }
  // If no natural disputes, pick the first flaw concept
  if (disputes.length === 0 && flawPool.length > 0) {
    disputes.push(flawPool[0])
  }

  world.anthropogony = {
    recipe,
    peoples: finalPeoples,
    commonMemory,
    disputes,
  }
}
