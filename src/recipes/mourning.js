/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findCreator, findVoid } from '../queryHelpers.js'

/**
 * Mourning — something died before creation. A mourner builds the world as
 * memorial to the unknown dead. The cost: true memory of the dead is
 * distorted by the act of memorializing. The flaw: the world grieves for
 * something it never knew.
 * @type {MythRecipe}
 */
export const mourning = {
  name: 'mourning',
  weight: 1,
  generate(graph, rng) {
    // The mourner — a force or element that grieves
    const mourner = findCreator(graph, rng)

    // The void — the absence left by the pre-creation death
    const voidPlace = findVoid(graph, rng, [mourner])

    // The dead — walk from mourner via consumes/collides to find something already gone
    const deadChain = walkFrom(graph, rng, mourner, 3, { preferRelations: ['consumes', 'collides'] })
    const dead = deadChain.path[deadChain.path.length - 1]

    // Walk from the dead via evokes/produces to find what memory becomes — the memorial
    const memorialChain = walkFrom(graph, rng, dead, 3, { preferRelations: ['evokes', 'produces'] })
    const memorial = memorialChain.path[memorialChain.path.length - 1]
    const intermediates = memorialChain.path.slice(1, -1)

    // Important: the chain of grief
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(mourner, 2).exclude(mourner, dead, voidPlace).random(rng, 2)

    // Flaw: grief without object — walk from memorial via evokes
    const griefChain = walkFrom(graph, rng, memorial, 2, { preferRelations: ['evokes', 'rhymes'] })
    const wound = griefChain.path[griefChain.path.length - 1]

    const bad = [wound]
    if (wound === memorial) {
      const alt = query(graph).where('collides', dead).direction('any')
        .exclude(mourner, dead).first(rng)
      if (alt) { bad[0] = alt }
    }

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace },
        concepts: [voidPlace],
      },
      act: {
        roles: { actor: mourner, verb: 'mourned', dead, product: memorial },
        concepts: [mourner, dead, memorial],
      },
      cost: {
        roles: { sacrificed: dead },
        concepts: [dead],
      },
      flaw: {
        roles: { wound: bad[0] },
        concepts: bad,
      },
      creators: [mourner],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: memorial,
      ingredients: [mourner, dead, ...important],
      extra: { mourner, dead, memorial },
    }
  },
}
