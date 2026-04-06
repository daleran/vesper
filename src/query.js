import { pick, pickN, weightedPick } from './utils.js'
import { CATEGORIES } from './concepts.js'

/**
 * @typedef {import('./concepts.js').ConceptGraph} ConceptGraph
 * @typedef {import('./concepts.js').Edge} Edge
 * @typedef {{ relation: string, target: string|null, direction: 'fwd'|'rev'|'any' }} Condition
 * @typedef {{ concept: string, score: number }} ScoredConcept
 */

// ── RankedQuery ─────────────────────────────────────────────

/** Query results scored and sorted by closeness to reference concepts. */
export class RankedQuery {
  /** @param {ScoredConcept[]} scored — sorted descending by score */
  constructor(scored) {
    /** @type {ScoredConcept[]} */
    this._scored = scored
  }

  /** All results in rank order. @returns {string[]} */
  get() {
    return this._scored.map(s => s.concept)
  }

  /** Highest-ranked result. @returns {string|undefined} */
  first() {
    return this._scored[0]?.concept
  }

  /**
   * Random pick from the top n ranked results.
   * @param {() => number} rng
   * @param {number} n
   * @returns {string|undefined}
   */
  pickTop(rng, n) {
    const top = this._scored.slice(0, n)
    return top.length > 0 ? pick(rng, top).concept : undefined
  }

  /**
   * Weighted random — higher rank score = higher probability.
   * Every result has at least base weight 1 so nothing is impossible.
   * @param {() => number} rng
   * @returns {string|undefined}
   */
  pickWeighted(rng) {
    if (this._scored.length === 0) return undefined
    const items = this._scored.map(s => s.concept)
    const weights = this._scored.map(s => s.score + 1)
    return weightedPick(rng, items, weights)
  }

  /**
   * Uniform random from all ranked results, ignoring score.
   * @param {() => number} rng
   * @param {number} [n=1]
   * @returns {string[]}
   */
  random(rng, n = 1) {
    const concepts = this.get()
    if (concepts.length === 0) return []
    return n === 1 ? [pick(rng, concepts)] : pickN(rng, concepts, n)
  }
}

// ── ConceptQuery ────────────────────────────────────────────

export class ConceptQuery {
  /** @param {ConceptGraph} graph */
  constructor(graph) {
    /** @type {ConceptGraph} */
    this._graph = graph
    /** @type {Condition[][]} */
    this._groups = []
    /** @type {Set<string>|null} */
    this._candidates = null
    /** @type {Set<string>} */
    this._excludes = new Set()
    /** @type {string|null} */
    this._pluck = null
  }

  // ── Filters ──

  /**
   * Add an AND filter group with one condition.
   * @param {string} relation
   * @param {string} [target]
   * @returns {this}
   */
  where(relation, target) {
    this._groups.push([{ relation, target: target ?? null, direction: 'fwd' }])
    return this
  }

  /**
   * Add an OR condition to the current filter group.
   * @param {string} relation
   * @param {string} [target]
   * @returns {this}
   */
  or(relation, target) {
    const last = this._groups[this._groups.length - 1]
    if (!last) return this.where(relation, target)
    last.push({ relation, target: target ?? null, direction: 'fwd' })
    return this
  }

  /**
   * Set the direction for the most recent condition.
   * @param {'fwd'|'rev'|'any'} dir
   * @returns {this}
   */
  direction(dir) {
    const lastGroup = this._groups[this._groups.length - 1]
    if (lastGroup && lastGroup.length > 0) {
      lastGroup[lastGroup.length - 1].direction = dir
    }
    return this
  }

  /**
   * Exclude specific concepts from results.
   * @param {...string} concepts
   * @returns {this}
   */
  exclude(...concepts) {
    for (const c of concepts) this._excludes.add(c)
    return this
  }

  /**
   * Restrict candidates to concepts within maxHops of a starting concept.
   * @param {string} concept
   * @param {number} [maxHops=1]
   * @returns {this}
   */
  nearby(concept, maxHops = 1) {
    const visited = new Set([concept])
    let frontier = [concept]
    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      /** @type {string[]} */
      const next = []
      for (const c of frontier) {
        for (const edge of this._graph.get(c) ?? []) {
          if (!visited.has(edge.concept) && !CATEGORIES.has(edge.concept)) {
            visited.add(edge.concept)
            next.push(edge.concept)
          }
        }
      }
      frontier = next
    }
    visited.delete(concept)
    this._candidates = visited
    return this
  }

  /**
   * Transform results: follow a relation from each result and return targets.
   * @param {string} relation
   * @returns {this}
   */
  pluck(relation) {
    this._pluck = relation
    return this
  }

  // ── Internals ──

  /**
   * Check if an edge list contains a match for a condition.
   * @param {Edge[]} edges
   * @param {Condition} cond
   * @returns {boolean}
   */
  _match(edges, cond) {
    return edges.some(e =>
      e.relation === cond.relation &&
      (cond.target === null || e.concept === cond.target) &&
      (cond.direction === 'any' || e.direction === cond.direction),
    )
  }

  /**
   * Run filters and return matching concepts (before pluck).
   * @returns {string[]}
   */
  _resolve() {
    /** @type {string[]} */
    const results = []
    const source = this._candidates
      ? [...this._candidates].map(c => /** @type {[string, Edge[]]} */ ([c, this._graph.get(c) ?? []]))
      : this._graph
    for (const [concept, edges] of source) {
      if (this._excludes.has(concept)) continue
      let pass = true
      for (const group of this._groups) {
        if (!group.some(cond => this._match(edges, cond))) {
          pass = false
          break
        }
      }
      if (pass) results.push(concept)
    }
    return results
  }

  /**
   * Apply pluck transform to resolved concepts.
   * @param {string[]} concepts
   * @returns {string[]}
   */
  _applyPluck(concepts) {
    if (!this._pluck) return concepts
    const relation = this._pluck
    const seen = new Set()
    /** @type {string[]} */
    const plucked = []
    for (const c of concepts) {
      for (const edge of this._graph.get(c) ?? []) {
        if (edge.relation === relation && edge.direction === 'fwd' && !seen.has(edge.concept)) {
          seen.add(edge.concept)
          plucked.push(edge.concept)
        }
      }
    }
    return plucked
  }

  // ── Terminals ──

  /**
   * Execute the query, returning all matching concept names.
   * @returns {string[]}
   */
  get() {
    return this._applyPluck(this._resolve())
  }

  /**
   * Execute and return one result. Random if rng provided, otherwise first.
   * @param {(() => number)} [rng]
   * @returns {string|undefined}
   */
  first(rng) {
    const results = this.get()
    if (results.length === 0) return undefined
    return rng ? pick(rng, results) : results[0]
  }

  /**
   * Execute and return n random results using seeded RNG.
   * @param {() => number} rng
   * @param {number} [n=1]
   * @returns {string[]}
   */
  random(rng, n = 1) {
    const results = this.get()
    if (results.length === 0) return []
    return n === 1 ? [pick(rng, results)] : pickN(rng, results, n)
  }

  /**
   * Score results by closeness to reference concepts (1-hop neighbor overlap).
   * Returns a RankedQuery sorted by score descending.
   * @param {string[]} subjects
   * @returns {RankedQuery}
   */
  rank(subjects) {
    const subjectSet = new Set(subjects)
    const resolved = this._resolve()
    /** @type {ScoredConcept[]} */
    const scored = []
    for (const concept of resolved) {
      let score = 0
      for (const edge of this._graph.get(concept) ?? []) {
        if (subjectSet.has(edge.concept)) score++
      }
      scored.push({ concept, score })
    }
    scored.sort((a, b) => b.score - a.score)
    if (this._pluck) {
      return this._rankPlucked(scored)
    }
    return new RankedQuery(scored)
  }

  /**
   * Apply pluck to ranked results, carrying forward max score per plucked concept.
   * @param {ScoredConcept[]} scored
   * @returns {RankedQuery}
   */
  _rankPlucked(scored) {
    const relation = /** @type {string} */ (this._pluck)
    /** @type {Map<string, number>} */
    const best = new Map()
    for (const { concept, score } of scored) {
      for (const edge of this._graph.get(concept) ?? []) {
        if (edge.relation === relation && edge.direction === 'fwd') {
          const prev = best.get(edge.concept) ?? 0
          if (score > prev) best.set(edge.concept, score)
        }
      }
    }
    /** @type {ScoredConcept[]} */
    const plucked = []
    for (const [concept, score] of best) {
      plucked.push({ concept, score })
    }
    plucked.sort((a, b) => b.score - a.score)
    return new RankedQuery(plucked)
  }
}

/**
 * Create a new concept query starting from all concepts in the graph.
 * @param {ConceptGraph} graph
 * @returns {ConceptQuery}
 */
export function query(graph) {
  return new ConceptQuery(graph)
}
