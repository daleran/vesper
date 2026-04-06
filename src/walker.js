/**
 * @import { ConceptGraph, Edge } from './concepts.js'
 */
import { NARRATIVE_RELATIONS } from './concepts.js'
import { weightedPick } from './utils.js'

/**
 * @typedef {{ path: string[], relations: string[], start: string }} ConceptChain
 * @typedef {{
 *   chain1: ConceptChain,
 *   chain2: ConceptChain,
 *   meetConcept: string,
 *   distance: number
 * }} Collision
 * @typedef {{
 *   chain: ConceptChain,
 *   type: 'cycle'|'inversion',
 *   concepts: string[]
 * }} Paradox
 */

const EDGE_WEIGHT_NARRATIVE = 3
const EDGE_WEIGHT_DESCRIPTIVE = 1
const EDGE_WEIGHT_PREFERRED = 5

/**
 * @typedef {{ preferRelations?: string[] }} WalkOptions
 */

/**
 * Walk randomly from a starting concept, following edges in the graph.
 * Narrative edges (transforms, consumes, produces, collides, evokes) are
 * weighted 3× to keep walks story-driven rather than taxonomic.
 *
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} startConcept
 * @param {number} maxHops
 * @param {WalkOptions} [options]
 * @returns {ConceptChain}
 */
export function walkFrom(graph, rng, startConcept, maxHops, options = {}) {
  const path = [startConcept]
  const relations = []
  let current = startConcept
  const visited = new Set([startConcept])
  const preferSet = options.preferRelations
    ? new Set(options.preferRelations)
    : null

  for (let i = 0; i < maxHops; i++) {
    const neighbors = graph.get(current)
    if (!neighbors || neighbors.length === 0) break

    // Skip `is` edges — they point to category tags, not walkable concepts
    const unvisited = neighbors.filter(e => e.relation !== 'is' && !visited.has(e.concept))
    if (unvisited.length === 0) break

    const weights = unvisited.map(e => {
      if (preferSet && preferSet.has(e.relation)) return EDGE_WEIGHT_PREFERRED
      return NARRATIVE_RELATIONS.has(/** @type {any} */ (e.relation))
        ? EDGE_WEIGHT_NARRATIVE
        : EDGE_WEIGHT_DESCRIPTIVE
    })

    const edge = weightedPick(rng, unvisited, weights)
    path.push(edge.concept)
    relations.push(edge.relation)
    visited.add(edge.concept)
    current = edge.concept
  }

  return { path, relations, start: startConcept }
}

/**
 * Find collisions between two concept chains.
 * A collision occurs when:
 *   - both chains visit the same concept (shared concept)
 *   - the terminal concepts of both chains are connected by a 'collides' edge
 *
 * @param {ConceptGraph} graph
 * @param {ConceptChain} chain1
 * @param {ConceptChain} chain2
 * @returns {Collision[]}
 */
export function findCollisions(graph, chain1, chain2) {
  /** @type {Collision[]} */
  const collisions = []

  const set1 = new Map(chain1.path.map((c, i) => [c, i]))

  // Shared concept collision
  for (let i = 0; i < chain2.path.length; i++) {
    const concept = chain2.path[i]
    if (set1.has(concept)) {
      const dist1 = set1.get(concept) ?? 0
      collisions.push({
        chain1,
        chain2,
        meetConcept: concept,
        distance: dist1 + i,
      })
    }
  }

  // Terminal 'collides' collision
  const end1 = chain1.path[chain1.path.length - 1]
  const end2 = chain2.path[chain2.path.length - 1]
  const neighbors1 = graph.get(end1) ?? []
  const hasDirectCollide = neighbors1.some(
    e => e.relation === 'collides' && e.concept === end2
  )
  if (hasDirectCollide && end1 !== end2) {
    collisions.push({
      chain1,
      chain2,
      meetConcept: `${end1}:${end2}`,
      distance: chain1.path.length + chain2.path.length,
    })
  }

  return collisions
}

/**
 * Find paradoxes within and across chains.
 * - Cycle paradox: a chain visits the same concept twice (loop)
 * - Inversion paradox: A transforms B appears, then later B transforms A
 *
 * @param {ConceptChain[]} chains
 * @returns {Paradox[]}
 */
export function findParadoxes(chains) {
  /** @type {Paradox[]} */
  const paradoxes = []

  for (const chain of chains) {
    // Cycle detection
    const seen = new Set()
    for (const concept of chain.path) {
      if (seen.has(concept)) {
        paradoxes.push({ chain, type: 'cycle', concepts: [concept] })
        break
      }
      seen.add(concept)
    }

    // Inversion detection: A→transforms→B and later B→transforms→A
    /** @type {Map<string, string>} */
    const transformations = new Map()
    for (let i = 0; i < chain.relations.length; i++) {
      if (chain.relations[i] === 'transforms') {
        const from = chain.path[i]
        const to = chain.path[i + 1]
        if (transformations.get(to) === from) {
          paradoxes.push({ chain, type: 'inversion', concepts: [from, to] })
        }
        transformations.set(from, to)
      }
    }
  }

  return paradoxes
}

/**
 * Main walk entry point: walk from multiple starting concepts and
 * find all collisions and paradoxes between the resulting chains.
 *
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} starts — 2-3 starting concept names
 * @param {number} hops — how many hops per chain
 * @param {WalkOptions} [options]
 * @returns {{ chains: ConceptChain[], collisions: Collision[], paradoxes: Paradox[] }}
 */
export function walkAll(graph, rng, starts, hops, options = {}) {
  const chains = starts.map(s => walkFrom(graph, rng, s, hops, options))

  /** @type {Collision[]} */
  const collisions = []
  for (let i = 0; i < chains.length; i++) {
    for (let j = i + 1; j < chains.length; j++) {
      collisions.push(...findCollisions(graph, chains[i], chains[j]))
    }
  }

  const paradoxes = findParadoxes(chains)

  return { chains, collisions, paradoxes }
}
