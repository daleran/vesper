/**
 * Shared recipe groupings and archetype selection helpers.
 * Used by geogony, biogony, anthropogony, and future generation layers.
 */

// ── Recipe group constants ──

/** Myths involving deliberate, purposeful creation. */
export const DELIBERATE_RECIPES = new Set(['solo-god', 'weaving', 'utterance'])

/** Myths involving organic emergence or symbiotic creation. */
export const ORGANIC_RECIPES = new Set(['world-birth', 'symbiosis', 'contagion'])

/** Myths involving cyclical or dream-like creation. */
export const CYCLIC_RECIPES = new Set(['cycle', 'dream'])

/** Myths involving violent conflict or destruction. */
export const VIOLENT_RECIPES = new Set(['pantheon-war', 'rebellion', 'corruption'])

/** Myths involving uncontrolled spreading or propagation. */
export const SPREADING_RECIPES = new Set(['contagion', 'utterance'])

// ── Selection helpers ──

/**
 * Apply recipe-group weight bonuses to a weights array.
 * Each rule maps a recipe group to weight indices and a bonus value.
 *
 * @param {number[]} weights — mutable weights array
 * @param {string} recipe — the myth recipe name
 * @param {Array<{ recipes: Set<string>, indices: number[], bonus: number }>} rules
 */
export function applyRecipeBonuses(weights, recipe, rules) {
  for (const rule of rules) {
    if (rule.recipes.has(recipe)) {
      for (const idx of rule.indices) {
        weights[idx] += rule.bonus
      }
    }
  }
}
