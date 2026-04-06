/**
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 */
import { mulberry32, hashSeed, weightedPick } from './utils.js'
import { RECIPES } from './recipes/index.js'

/**
 * Generate a complete creation myth from a seed.
 * Picks a recipe via seeded RNG, runs it, and stamps the seed.
 * @param {ConceptGraph} graph
 * @param {string} seed
 * @param {string} [forceRecipe] If provided, use this recipe name instead of random selection
 * @returns {CreationMyth}
 */
export function generateMyth(graph, seed, forceRecipe) {
  const rng = mulberry32(hashSeed(seed))
  const recipe = forceRecipe
    ? RECIPES.find(r => r.name === forceRecipe) ?? weightedPick(rng, RECIPES, RECIPES.map(r => r.weight))
    : weightedPick(rng, RECIPES, RECIPES.map(r => r.weight))
  const myth = recipe.generate(graph, rng)
  myth.seed = seed
  myth.recipe = recipe.name

  // Deduplicate concept lists at recipe level
  const dedup = (/** @type {string[]} */ arr) => [...new Set(arr)]
  myth.before.concepts = dedup(myth.before.concepts)
  myth.act.concepts = dedup(myth.act.concepts)
  myth.cost.concepts = dedup(myth.cost.concepts)
  myth.flaw.concepts = dedup(myth.flaw.concepts)
  myth.important = dedup(myth.important)
  myth.bad = dedup(myth.bad)
  myth.ingredients = dedup(myth.ingredients)

  return myth
}
