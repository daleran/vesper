/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom, findCollisions } from '../walker.js'

/**
 * Splitting — a primordial unity is divided. Two fragments emerge and
 * become the world. The tragedy is they can never reunite. The flaw is
 * that everything in the world is incomplete, yearning for its other half.
 * @type {MythRecipe}
 */
export const splitting = {
  name: 'splitting',
  weight: 1,
  generate(graph, rng) {
    // The unity: a force or element (something whole that will be broken)
    const unity = query(graph).where('is', 'force').or('is', 'element').first(rng)
      ?? 'light'

    // The splitter: something that collides with the unity
    const splitter = query(graph).where('collides', unity).direction('any')
      .first(rng) ?? query(graph).where('is', 'force').exclude(unity).first(rng) ?? 'time'

    // Walk from unity to find the two fragments (diverging paths)
    const chain1 = walkFrom(graph, rng, unity, 3, { preferRelations: ['rhymes', 'collides'] })
    const fragment1 = chain1.path[chain1.path.length - 1]

    const chain2 = walkFrom(graph, rng, splitter, 3, { preferRelations: ['rhymes', 'collides'] })
    const fragment2 = chain2.path[chain2.path.length - 1]

    // Find collisions between fragments — ongoing tensions in the world
    const collisions = findCollisions(graph, chain1, chain2)
    const tensionConcepts = collisions.map(c => c.meetConcept).filter(c => !c.includes(':'))

    // Important: intermediates from both chains
    const intermediates = [
      ...chain1.path.slice(1, -1),
      ...chain2.path.slice(1, -1),
    ]
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(unity, 2).exclude(unity, splitter).random(rng, 2)

    // Bad: the tension between fragments, or things colliding with unity
    const bad = tensionConcepts.length > 0
      ? tensionConcepts
      : query(graph).where('collides', unity).direction('any')
        .exclude(splitter).random(rng, 2)

    const wound = bad.length > 0 ? bad[0] : 'incompleteness'

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: unity, quality: 'whole and undivided' },
        concepts: [unity],
      },
      act: {
        roles: { verb: 'split', unity, splitter, fragment1, fragment2 },
        concepts: [unity, fragment1, fragment2],
      },
      cost: {
        roles: { sacrificed: unity },
        concepts: [unity],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [fragment1, fragment2],
      important,
      bad,
      worldBefore: unity,
      worldAfter: `${fragment1} and ${fragment2}`,
      ingredients: [unity, fragment1, fragment2, ...important],
      extra: {
        unity,
        splitter,
        fragments: [fragment1, fragment2],
      },
    }
  },
}
