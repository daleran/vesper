/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findVoid } from '../queryHelpers.js'

/**
 * Sacrifice — a single entity destroys itself to create the world.
 * The cost IS the act: there is no separate tool, no weapon. The creator's
 * own body becomes the world. The flaw is that the world is made of
 * corpse-matter — everything carries the dead god's nature.
 * @type {MythRecipe}
 */
export const sacrifice = {
  name: 'sacrifice',
  weight: 1,
  generate(graph, rng) {
    // The creator: a force or element that will unmake itself
    const creator = query(graph).where('is', 'force').or('is', 'element').first(rng)
      ?? 'fire'

    // The void before creation
    const voidPlace = findVoid(graph, rng, [creator])

    // Walk from the creator to discover what its body becomes
    const chain = walkFrom(graph, rng, creator, 4, { preferRelations: ['transforms', 'evokes'] })
    const product = chain.path[chain.path.length - 1]
    const intermediates = chain.path.slice(1, -1)

    // Important: the chain of becoming (what the body passed through)
    const important = intermediates.length > 0
      ? intermediates
      : query(graph).nearby(creator, 2).exclude(creator, voidPlace).random(rng, 2)

    // Bad: things that collide with the creator — they haunt the world
    // because the world IS the creator's remains
    const bad = query(graph).where('collides', creator).direction('any')
      .random(rng, 2)

    const wound = bad.length > 0 ? bad[0] : 'absence'

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace },
        concepts: [voidPlace],
      },
      act: {
        roles: { actor: creator, verb: 'sacrificed', product },
        concepts: [creator, product, ...intermediates],
      },
      cost: {
        roles: { sacrificed: creator },
        concepts: [creator],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [creator],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: product,
      ingredients: [creator, ...important],
      extra: {
        creator,
        becamePath: chain.path,
      },
    }
  },
}
