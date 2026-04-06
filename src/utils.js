/**
 * @import { ConceptGraph } from './concepts.js'
 */

/**
 * Seeded PRNG — mulberry32. Returns a function that produces
 * deterministic floats in [0, 1) from a 32-bit seed.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hash a string seed to a 32-bit integer.
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h >>> 0
}

/**
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t — 0..1
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Pick a random element from an array using the seeded RNG.
 * @template T
 * @param {() => number} rng
 * @param {T[]} array
 * @returns {T}
 */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)]
}

/**
 * Pick n unique elements from array using Fisher-Yates partial shuffle.
 * If n >= array.length, returns a shuffled copy of the full array.
 * @template T
 * @param {() => number} rng
 * @param {T[]} array
 * @param {number} n
 * @returns {T[]}
 */
export function pickN(rng, array, n) {
  const copy = array.slice()
  const count = Math.min(n, copy.length)
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

/**
 * Pick a random item from an array using weights (parallel arrays).
 * Weights do not need to sum to 1.
 * @template T
 * @param {() => number} rng
 * @param {T[]} items
 * @param {number[]} weights
 * @returns {T}
 */
export function weightedPick(rng, items, weights) {
  let total = 0
  for (const w of weights) total += w
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/**
 * Score concept overlap between two sets.
 * Direct match = 2, 1-hop neighbor match = 1.
 * @param {ConceptGraph} graph
 * @param {string[]} setA
 * @param {string[]} setB
 * @returns {number}
 */
export function conceptOverlap(graph, setA, setB) {
  const bSet = new Set(setB)
  let score = 0

  for (const c of setA) {
    if (bSet.has(c)) {
      score += 2
      continue
    }
    const edges = graph.get(c)
    if (!edges) continue
    for (const e of edges) {
      if (bSet.has(e.concept)) {
        score += 1
        break
      }
    }
  }

  return score
}

/**
 * Resolve terrain affinity for a concept cluster.
 * Returns top 1-2 terrain type names by concept overlap.
 * @param {ConceptGraph} graph
 * @param {string[]} entityConcepts
 * @param {{ name: string, concepts: string[] }[]} terrainTypes
 * @returns {string[]}
 */
export function resolveTerrainAffinity(graph, entityConcepts, terrainTypes) {
  if (terrainTypes.length === 0) return []

  const scored = terrainTypes.map(t => ({
    name: t.name,
    score: conceptOverlap(graph, entityConcepts, t.concepts),
  })).sort((a, b) => b.score - a.score)

  const result = [scored[0].name]
  if (scored.length > 1 && scored[1].score > 0) {
    result.push(scored[1].name)
  }
  return result
}

/**
 * Score an entity against regions by concept overlap + terrain affinity.
 * Returns top-N regions sorted by score (highest first).
 * @template {{ concepts: string[], terrainTypes: string[] }} R
 * @param {ConceptGraph} graph
 * @param {{ concepts: string[], terrainAffinity: string[] }} entity
 * @param {R[]} regions
 * @param {number} [topN=2]
 * @returns {{ region: R, score: number }[]}
 */
export function scoreEntityPlacement(graph, entity, regions, topN = 2) {
  /** @type {{ region: R, score: number }[]} */
  const scored = regions.map(r => {
    let score = conceptOverlap(graph, entity.concepts, r.concepts)
    for (const ta of entity.terrainAffinity) {
      if (r.terrainTypes.includes(ta)) score += 2
    }
    return { region: r, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topN)
}
