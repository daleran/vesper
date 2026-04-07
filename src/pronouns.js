/**
 * Pronoun assignment and tracking for agents in prose.
 * Assigns pronoun sets at generation time and tracks first-mention
 * within a text for name-vs-pronoun substitution.
 *
 * @import { Agent } from './pantheon.js'
 * @import { GlossState } from './renderers/gloss.js'
 */

// ── Typedefs ──

/**
 * @typedef {{
 *   subject: string,
 *   object: string,
 *   possessive: string,
 *   reflexive: string,
 * }} PronounSet
 */

// ── Constants ──

/** @type {Record<string, PronounSet>} */
export const PRONOUN_SETS = {
  he:   { subject: 'he',   object: 'him',  possessive: 'his',   reflexive: 'himself'  },
  she:  { subject: 'she',  object: 'her',  possessive: 'her',   reflexive: 'herself'  },
  they: { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themself' },
  it:   { subject: 'it',   object: 'it',   possessive: 'its',   reflexive: 'itself'   },
}

/** Weighted picks for god/demi-god pronouns: he, she, they. */
const GOD_PRONOUN_WEIGHTS = [
  { value: 'he',   weight: 0.35 },
  { value: 'she',  weight: 0.35 },
  { value: 'they', weight: 0.30 },
]

// ── Public API ──

/**
 * Assign a pronoun key to an agent based on type and RNG.
 * @param {Agent} agent
 * @param {() => number} rng
 * @returns {'he' | 'she' | 'they' | 'it'}
 */
export function assignPronouns(agent, rng) {
  switch (agent.type) {
    case 'god':
    case 'demi-god':
      return weightedPronoun(rng)
    case 'spirit':
      return rng() < 0.5 ? 'they' : 'it'
    case 'demon':
      return 'it'
    case 'ancestor':
    case 'herald':
      return 'they'
    default:
      return 'they'
  }
}

/**
 * Get the pronoun set for an agent.
 * @param {Agent} agent
 * @returns {PronounSet}
 */
export function getPronouns(agent) {
  const key = /** @type {keyof typeof PRONOUN_SETS} */ (agent.pronouns ?? 'they')
  return PRONOUN_SETS[key] ?? PRONOUN_SETS.they
}

/**
 * Reference an agent by name on first mention, by pronoun on subsequent.
 * Tracks mentions via `state.namedAgents`.
 * @param {Agent} agent
 * @param {'subject' | 'object' | 'possessive'} role
 * @param {GlossState} state
 * @returns {string}
 */
export function referAgent(agent, role, state) {
  if (!state.namedAgents.has(agent.id)) {
    state.namedAgents.add(agent.id)
    return agent.name
  }
  return getPronouns(agent)[role]
}

// ── Internal ──

/**
 * Weighted pronoun pick for gods/demi-gods.
 * @param {() => number} rng
 * @returns {'he' | 'she' | 'they'}
 */
function weightedPronoun(rng) {
  const roll = rng()
  let cumulative = 0
  for (const { value, weight } of GOD_PRONOUN_WEIGHTS) {
    cumulative += weight
    if (roll < cumulative) return /** @type {'he' | 'she' | 'they'} */ (value)
  }
  return 'they'
}
