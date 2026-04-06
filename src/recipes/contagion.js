/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findVoid } from '../queryHelpers.js'

/**
 * Contagion — something tiny and contained breaks free and proliferates
 * uncontrollably. The world is a bloom, an infection, an overflow. The cost:
 * the container is shattered. The flaw: growth cannot stop.
 * @type {MythRecipe}
 */
export const contagion = {
  name: 'contagion',
  weight: 1,
  generate(graph, rng) {
    // The source — flora or force (small, potent things)
    const source = query(graph).where('is', 'flora').or('is', 'force')
      .first(rng) ?? 'seed'

    // The container — a void-like sealed place
    const container = findVoid(graph, rng, [source])

    // Walk from source via produces/transforms to find the bloom
    const chain = walkFrom(graph, rng, source, 4, { preferRelations: ['produces', 'transforms'] })
    const bloom = chain.path[chain.path.length - 1]
    const intermediates = chain.path.slice(1, -1)

    // Important: the stages of the spread
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(source, 2).exclude(source, container).random(rng, 2)

    // Flaw: what the spread consumes as it grows — unstoppable hunger
    const devoured = query(graph).where('consumes', source).direction('fwd')
      .exclude(source, container).first(rng)
      ?? query(graph).where('collides', bloom).direction('any')
        .exclude(source, container).first(rng)
      ?? 'stillness'

    const bad = [devoured]

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: container },
        concepts: [container],
      },
      act: {
        roles: { actor: source, verb: 'spread', source, product: bloom },
        concepts: [source, bloom],
      },
      cost: {
        roles: { sacrificed: container },
        concepts: [container],
      },
      flaw: {
        roles: { wound: devoured },
        concepts: bad,
      },
      creators: [source],
      important,
      bad,
      worldBefore: container,
      worldAfter: bloom,
      ingredients: [source, ...important],
      extra: { source, container, bloom },
    }
  },
}
