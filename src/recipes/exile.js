/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findCreator, findVoid } from '../queryHelpers.js'

/**
 * Exile — a creator is cast out from a lost origin. Wandering through the
 * void, they shape the world from fragments of memory. The cost: the origin
 * is forever unreachable. The flaw: everything built is a copy, haunted by
 * homesickness for a place that may never have existed.
 * @type {MythRecipe}
 */
export const exile = {
  name: 'exile',
  weight: 1,
  generate(graph, rng) {
    // The wanderer — a force or element cast out
    const wanderer = findCreator(graph, rng)

    // The origin — a celestial or place the wanderer was exiled from
    const origin = query(graph).where('is', 'celestial').or('is', 'place')
      .exclude(wanderer).first(rng) ?? 'light'

    // The void — the exile's wilderness
    const voidPlace = findVoid(graph, rng, [wanderer, origin])

    // Walk from origin to find what memory produces — the world
    const chain = walkFrom(graph, rng, origin, 3, { preferRelations: ['evokes', 'rhymes'] })
    const product = chain.path[chain.path.length - 1]
    const intermediates = chain.path.slice(1, -1)

    // Important: things the wanderer passed through
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(wanderer, 2).exclude(wanderer, origin, voidPlace).random(rng, 2)

    // Bad: things that collide with the product — the echo-nature
    const bad = query(graph).where('collides', product).direction('any')
      .random(rng, 2)
    if (bad.length === 0) {
      const fallback = query(graph).where('collides', wanderer).direction('any')
        .exclude(wanderer, origin).first(rng)
      if (fallback) bad.push(fallback)
    }

    const wound = bad.length > 0 ? bad[0] : 'an unnamed longing'

    // Cost: the origin itself, now unreachable
    const consumed = origin

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace },
        concepts: [voidPlace],
      },
      act: {
        roles: { actor: wanderer, verb: 'wandered', origin, product },
        concepts: [wanderer, origin, product],
      },
      cost: {
        roles: { sacrificed: consumed },
        concepts: [consumed],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [wanderer],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: product,
      ingredients: [wanderer, origin, ...important],
      extra: { wanderer, origin, product },
    }
  },
}
