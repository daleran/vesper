/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findCreator } from '../queryHelpers.js'

/**
 * Cycle — creation is recurring. This is not the first world, and it will not
 * be the last. The creator destroys the old to build the new. The flaw is that
 * destruction is equally inevitable — this world, too, will end.
 * @type {MythRecipe}
 */
export const cycle = {
  name: 'cycle',
  weight: 1,
  generate(graph, rng) {
    // The creator/destroyer — same entity, both builder and ruiner
    const creator = findCreator(graph, rng)

    // Walk to discover the previous world's remains
    const prevChain = walkFrom(graph, rng, creator, 3, { preferRelations: ['consumes', 'transforms'] })
    const previousWorld = prevChain.path[prevChain.path.length - 1]

    // Walk to discover what this cycle produces
    const currChain = walkFrom(graph, rng, creator, 3, { preferRelations: ['produces', 'transforms'] })
    const currentWorld = currChain.path[currChain.path.length - 1]

    // A tool or instrument of remaking
    const tool = query(graph).where('is', 'item').or('shape')
      .exclude(creator, previousWorld, currentWorld)
      .first(rng) ?? 'hand'

    // Important: intermediates from both chains
    const intermediates = [
      ...prevChain.path.slice(1, -1),
      ...currChain.path.slice(1, -1),
    ]
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(creator, 2).exclude(creator).random(rng, 2)

    // Bad: things that collide with the current world — harbingers of the next ending
    const bad = query(graph).where('collides', currentWorld).direction('any')
      .random(rng, 2)

    const wound = bad.length > 0 ? bad[0] : 'inevitability'

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: previousWorld, quality: 'the ash of the world before this one' },
        concepts: [previousWorld],
      },
      act: {
        roles: { actor: creator, verb: 'struck', tool, target: previousWorld, product: currentWorld },
        concepts: [creator, tool, previousWorld, currentWorld],
      },
      cost: {
        roles: { sacrificed: previousWorld },
        concepts: [previousWorld],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [creator],
      important,
      bad,
      worldBefore: previousWorld,
      worldAfter: currentWorld,
      ingredients: [creator, previousWorld, currentWorld, ...important],
      extra: {
        creator,
        previousWorld,
        currentWorld,
      },
    }
  },
}
