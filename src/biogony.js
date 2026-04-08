/**
 * Biogony generator — determines how life arose from the creation myth.
 * Writes lifeforms, flaw-linked creatures, and extinctions into the
 * shared World object.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 */
import { pick, weightedPick, resolveTerrainAffinity } from './utils.js'
import { query } from './query.js'
import { nameRegion } from './naming.js'
import { BIOGONY_SHAPES, BIOGONY_NAMES } from './biogonyArchetypes.js'
import { DELIBERATE_RECIPES, ORGANIC_RECIPES, CYCLIC_RECIPES, applyRecipeBonuses } from './archetypeSelection.js'
import { expandConceptCluster } from './conceptResolvers.js'
import { TUNING, proportion } from './tuning.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   concepts: string[],
 *   terrainAffinity: string[],
 *   behavior: string,
 *   origin: string,
 * }} Lifeform
 */

// ── Behavior resolution ──

/** Place concepts that signal burrowing. */
const BURROW_CONCEPTS = new Set(['cave', 'pit', 'well', 'tomb', 'abyss'])

/** Celestial/element concepts that signal drifting. */
const DRIFT_CONCEPTS = new Set(['wind', 'mist', 'cloud', 'fog', 'rain', 'snow'])

/** Small fauna that signal swarming. */
const SWARM_FAUNA = new Set(['worm', 'moth', 'scarab', 'beetle', 'spider'])

/** Decay products. */
const DECAY_TARGETS = new Set(['ash', 'dust', 'soil', 'rust', 'soot', 'rot'])

/**
 * Resolve a behavior label for a concept from graph edges.
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @param {boolean} isFlawLinked
 * @returns {string}
 */
function resolveBehavior(graph, concept, isFlawLinked) {
  if (isFlawLinked) return 'parasite'

  const edges = graph.get(concept)
  if (!edges) return 'drifter'

  // Classify the concept itself
  let isFlora = false
  for (const e of edges) {
    if (e.relation === 'is' && e.direction === 'fwd') {
      if (e.concept === 'flora') isFlora = true
    }
  }

  if (isFlora) return 'rooted'
  if (SWARM_FAUNA.has(concept)) return 'swarm'

  // Check edge targets
  for (const e of edges) {
    if (e.direction !== 'fwd') continue

    if (e.relation === 'consumes') {
      // consumes fauna/body → predator, consumes flora/material → grazer
      const targetEdges = graph.get(e.concept)
      if (targetEdges) {
        for (const te of targetEdges) {
          if (te.relation === 'is' && te.direction === 'fwd') {
            if (te.concept === 'fauna' || te.concept === 'body') return 'predator'
            if (te.concept === 'flora' || te.concept === 'material') return 'grazer'
          }
        }
      }
    }

    if (e.relation === 'transforms' && DECAY_TARGETS.has(e.concept)) return 'decay'
    if (e.relation === 'transforms') {
      const targetEdges = graph.get(e.concept)
      if (targetEdges) {
        for (const te of targetEdges) {
          if (te.relation === 'is' && te.direction === 'fwd' &&
              (te.concept === 'fauna' || te.concept === 'flora')) return 'mimic'
        }
      }
    }
  }

  // Check neighborhood associations
  for (const e of edges) {
    if ((e.relation === 'evokes' || e.relation === 'rhymes') && e.direction === 'fwd') {
      if (BURROW_CONCEPTS.has(e.concept)) return 'burrower'
      if (DRIFT_CONCEPTS.has(e.concept)) return 'drifter'
    }
  }

  // Check for sentinel associations
  for (const e of edges) {
    if (e.relation === 'evokes' && e.direction === 'fwd') {
      if (e.concept === 'patience' || e.concept === 'endurance' || e.concept === 'silence') {
        return 'sentinel'
      }
    }
  }

  // Check produces → rooted
  for (const e of edges) {
    if (e.relation === 'produces' && e.direction === 'fwd') return 'rooted'
  }

  return 'drifter'
}

// ── Archetype selection ──

/**
 * Select a biogony archetype using weighted signals from the myth and world.
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {World} world
 * @param {ConceptGraph} graph
 * @returns {string}
 */
function selectArchetype(rng, myth, world, graph) {
  // [seeding, spawning, shedding, echoing, parasiting, adapting]
  const weights = [1, 1, 1, 1, 1, 1]

  // Recipe-group signals
  applyRecipeBonuses(weights, myth.recipe, [
    { recipes: DELIBERATE_RECIPES, indices: [0], bonus: 3 },  // → seeding
    { recipes: ORGANIC_RECIPES, indices: [1], bonus: 3 },     // → spawning
    { recipes: CYCLIC_RECIPES, indices: [3], bonus: 3 },      // → echoing
  ])

  // Dead/transformed gods → shedding
  if (world.agents.some(a => !a.alive || a.state === 'transformed')) {
    weights[2] += 4
  }

  // Flaw concepts overlap fauna/body → parasiting
  const faunaConcepts = new Set(query(graph).where('is', 'fauna').get())
  const bodyConcepts = new Set(query(graph).where('is', 'body').get())
  const flawOverlap = myth.flaw.concepts.some(
    c => faunaConcepts.has(c) || bodyConcepts.has(c)
  )
  if (flawOverlap) weights[4] += 3

  // Cost contains body concepts → shedding
  if (myth.cost.concepts.some(c => bodyConcepts.has(c))) {
    weights[2] += 2
  }

  // Diverse terrain → adapting
  const terrainCount = world.geogony?.terrainTypes.length ?? 0
  if (terrainCount > 7) weights[5] += 2

  return weightedPick(rng, BIOGONY_NAMES, weights)
}

// ── Main entry ──

/**
 * Generate biogony and write life data into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateBiogony(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)
  const terrainTypes = world.geogony?.terrainTypes ?? []

  // 1. Select archetype
  const recipe = selectArchetype(rng, myth, world, graph)
  const shapeFn = BIOGONY_SHAPES[recipe]

  // 2. Run archetype shape function
  const shape = shapeFn({ graph, rng, myth, world })

  // 3. Expand lifeform seeds into full Lifeforms
  /** @type {Lifeform[]} */
  const lifeforms = []
  const usedNames = new Set()
  const usedBaseConcepts = new Set()

  // Track which base concepts are flaw-linked
  const flawBaseConcepts = new Set(shape.flawSeeds.map(s => s.baseConcept))

  // Merge main seeds + flaw seeds (dedup)
  const allSeeds = [...shape.lifeformSeeds]
  for (const fs of shape.flawSeeds) {
    if (!allSeeds.some(s => s.baseConcept === fs.baseConcept)) {
      allSeeds.push(fs)
    }
  }

  for (const seed of allSeeds) {
    if (usedBaseConcepts.has(seed.baseConcept)) continue
    usedBaseConcepts.add(seed.baseConcept)

    // Expand concept cluster (2-4 concepts via 1-hop walk)
    const conceptCluster = expandConceptCluster(graph, rng, seed.baseConcept)

    // Resolve terrain affinity
    const terrainAffinity = resolveTerrainAffinity(graph, conceptCluster, terrainTypes)

    // Resolve behavior
    const isFlawLinked = flawBaseConcepts.has(seed.baseConcept)
    const behavior = resolveBehavior(graph, seed.baseConcept, isFlawLinked)

    // Generate name
    const name = nameRegion(graph, conceptCluster, rng, { usedNames, syllableRange: [1, 2], entityType: 'creature', morphemes: world.morphemes })

    lifeforms.push({
      id: '',
      name,
      concepts: conceptCluster,
      terrainAffinity,
      behavior,
      origin: seed.origin,
    })
  }

  // 4. Fill to min if we have fewer
  if (lifeforms.length < TUNING.lifeforms.min) {
    const allLife = [
      ...query(graph).where('is', 'fauna').get(),
      ...query(graph).where('is', 'flora').get(),
    ]
    const available = allLife.filter(c => !usedBaseConcepts.has(c))

    for (const concept of available) {
      if (lifeforms.length >= TUNING.lifeforms.min + 2) break
      usedBaseConcepts.add(concept)

      const conceptCluster = expandConceptCluster(graph, rng, concept)
      const terrainAffinity = resolveTerrainAffinity(graph, conceptCluster, terrainTypes)
      const behavior = resolveBehavior(graph, concept, false)
      const name = nameRegion(graph, conceptCluster, rng, { usedNames, syllableRange: [1, 2], entityType: 'creature', morphemes: world.morphemes })

      lifeforms.push({
        id: '',
        name,
        concepts: conceptCluster,
        terrainAffinity,
        behavior,
        origin: 'spontaneous',
      })
    }
  }

  // Cap at max
  const finalLifeforms = lifeforms.slice(0, TUNING.lifeforms.max)

  // 5. Identify flaw life (subset of lifeforms whose base concept was flaw-linked)
  const flawLife = finalLifeforms.filter(
    lf => flawBaseConcepts.has(lf.concepts[0])
  )

  // Ensure at least 1 flaw life
  if (flawLife.length === 0 && finalLifeforms.length > 0) {
    // Mark the last lifeform as flaw-corrupted
    const corrupted = finalLifeforms[finalLifeforms.length - 1]
    corrupted.behavior = 'parasite'
    corrupted.origin = 'flaw-corruption'
    flawLife.push(corrupted)
  }

  // 6. Extinctions (must not overlap living lifeforms)
  const livingConcepts = new Set(finalLifeforms.map(lf => lf.concepts[0]))
  const maxExtinctions = proportion(finalLifeforms.length, TUNING.extinctionRatio)
  const extinctions = shape.extinctionConcepts
    .filter(c => !livingConcepts.has(c))
    .slice(0, maxExtinctions)

  // Ensure at least 1 extinction
  if (extinctions.length === 0) {
    const allLife = [
      ...query(graph).where('is', 'fauna').get(),
      ...query(graph).where('is', 'flora').get(),
    ]
    const unused = allLife.filter(c => !livingConcepts.has(c))
    if (unused.length > 0) extinctions.push(pick(rng, unused))
  }

  // Assign stable IDs to all lifeforms
  for (let i = 0; i < finalLifeforms.length; i++) {
    finalLifeforms[i].id = `lifeform-${i}`
  }

  world.biogony = {
    recipe,
    lifeOriginAgent: shape.originAgentId,
    lifeforms: finalLifeforms,
    flawLife,
    extinctions,
  }
}
