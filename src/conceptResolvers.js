/**
 * Shared concept resolution helpers used across generation layers.
 * Extracts common patterns: cluster expansion, shape/substance resolution,
 * and physical trait derivation from concept graph edges.
 *
 * @import { ConceptGraph } from './concepts.js'
 */
import { pick } from './utils.js'
import { query } from './query.js'
import { walkFrom } from './walker.js'
import { TUNING } from './tuning.js'

// ── Concept cluster expansion ──

/**
 * Expand a base concept into a cluster via a short walk, deduped and capped.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} baseConcept
 * @param {number} [maxHops=2]
 * @param {number} [maxSize=4]
 * @returns {string[]}
 */
export function expandConceptCluster(graph, rng, baseConcept, maxHops = TUNING.defaultCluster.hops, maxSize = TUNING.defaultCluster.size) {
  const chain = walkFrom(graph, rng, baseConcept, maxHops, {
    preferRelations: ['evokes', 'rhymes'],
  })
  return [...new Set(chain.path)].slice(0, maxSize)
}

// ── Shape resolution ──

/**
 * Resolve a shape for a concept from graph shape edges.
 * Tries direct edges, then 1-hop neighbors, then random fallback.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} concept
 * @returns {string}
 */
export function resolveShape(graph, rng, concept) {
  const edges = graph.get(concept)
  if (edges) {
    for (const e of edges) {
      if (e.relation === 'shape' && e.direction === 'fwd') return e.concept
    }
    // Try neighbors
    for (const e of edges) {
      if (e.relation !== 'is' && e.direction === 'fwd') {
        const neighborEdges = graph.get(e.concept)
        if (!neighborEdges) continue
        for (const ne of neighborEdges) {
          if (ne.relation === 'shape' && ne.direction === 'fwd') return ne.concept
        }
      }
    }
  }
  return pick(rng, ['slab', 'hollow', 'pillar', 'shard', 'spiral', 'coil'])
}

// ── Substance resolution ──

/**
 * Resolve a substance (material) for a set of concepts.
 * Checks if any concept IS a material, then tries 1-hop neighbors.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} concepts
 * @param {string} fallback
 * @returns {string}
 */
export function resolveSubstance(graph, rng, concepts, fallback) {
  for (const c of concepts) {
    const edges = graph.get(c)
    if (!edges) continue
    for (const e of edges) {
      if (e.relation === 'is' && e.direction === 'fwd' && e.concept === 'material') return c
    }
  }
  // Try finding a material neighbor
  for (const c of concepts) {
    const mats = query(graph).nearby(c, 1).where('is', 'material').get()
    if (mats.length > 0) return pick(rng, mats)
  }
  return fallback
}

// ── Physical trait resolution ──

/**
 * @typedef {{
 *   texture: string|null,
 *   shape: string|null,
 *   color: string|null,
 * }} PhysicalTraits
 */

/**
 * Resolve physical traits (texture, shape, color) from concept graph edges.
 * Returns the first hit for each trait type across the concept list.
 * @param {ConceptGraph} graph
 * @param {string[]} concepts
 * @returns {PhysicalTraits}
 */
export function resolvePhysicalTraits(graph, concepts) {
  /** @type {PhysicalTraits} */
  const traits = { texture: null, shape: null, color: null }

  for (const c of concepts) {
    const edges = graph.get(c)
    if (!edges) continue
    for (const e of edges) {
      if (e.direction !== 'fwd') continue
      if (e.relation === 'texture' && !traits.texture) traits.texture = e.concept
      if (e.relation === 'shape' && !traits.shape) traits.shape = e.concept
      if (e.relation === 'color' && !traits.color) traits.color = e.concept
    }
    if (traits.texture && traits.shape && traits.color) break
  }

  return traits
}
