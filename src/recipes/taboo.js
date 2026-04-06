/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findVoid } from '../queryHelpers.js'

/**
 * Taboo — a law or boundary existed before creation. Someone broke it. The
 * world is the consequence of that transgression. The cost: the law itself
 * is shattered. The flaw: a prohibition echoes through reality — something
 * is forbidden and no one remembers why.
 * @type {MythRecipe}
 */
export const taboo = {
  name: 'taboo',
  weight: 1,
  generate(graph, rng) {
    // The transgressor — a force or fauna that acts
    const transgressor = query(graph).where('is', 'force').or('is', 'fauna')
      .first(rng) ?? 'hunger'

    // The law — something celestial or abstract and inviolable
    const law = query(graph).where('is', 'celestial').or('is', 'force')
      .exclude(transgressor).first(rng) ?? 'silence'

    // The void — the ordered pre-world where the law held
    const voidPlace = findVoid(graph, rng, [transgressor, law])

    // Walk from the law-breaking moment to find the consequence
    const chain = walkFrom(graph, rng, law, 4, { preferRelations: ['collides', 'produces'] })
    const consequence = chain.path[chain.path.length - 1]
    const intermediates = chain.path.slice(1, -1)

    // Important: the cascade of the breaking
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(transgressor, 2).exclude(transgressor, law, voidPlace).random(rng, 2)

    // Flaw: the residual taboo — walk from law via evokes
    const tabooChain = walkFrom(graph, rng, law, 2, { preferRelations: ['evokes', 'rhymes'] })
    const wound = tabooChain.path[tabooChain.path.length - 1]

    const bad = [wound]
    if (wound === law) {
      const alt = query(graph).where('collides', transgressor).direction('any')
        .exclude(transgressor, law).first(rng)
      if (alt) { bad[0] = alt }
    }

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace },
        concepts: [voidPlace],
      },
      act: {
        roles: { actor: transgressor, verb: 'transgressed', law, product: consequence },
        concepts: [transgressor, law, consequence],
      },
      cost: {
        roles: { sacrificed: law },
        concepts: [law],
      },
      flaw: {
        roles: { wound: bad[0] },
        concepts: bad,
      },
      creators: [transgressor],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: consequence,
      ingredients: [transgressor, law, ...important],
      extra: { transgressor, law, consequence },
    }
  },
}
