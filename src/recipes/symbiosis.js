/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { pickN } from '../utils.js'
import { walkFrom, findCollisions } from '../walker.js'
import { findVoid } from '../queryHelpers.js'

/**
 * Symbiosis — two things merged and cannot be separated. The world is both
 * at once, forever in tension. Not a collision (that's accidental) — this
 * was a reaching, a choosing. The flaw is that the two natures can never
 * fully agree.
 * @type {MythRecipe}
 */
export const symbiosis = {
  name: 'symbiosis',
  weight: 1,
  generate(graph, rng) {
    // Two entities that will merge
    const allForces = query(graph).where('is', 'force').or('is', 'element').get()
    const pair = pickN(rng, allForces, Math.min(2, allForces.length))
    const entity1 = pair[0] ?? 'fire'
    const entity2 = pair[1] ?? 'water'

    // Walk from each along associative/mirror edges
    const chain1 = walkFrom(graph, rng, entity1, 3, { preferRelations: ['evokes', 'rhymes'] })
    const chain2 = walkFrom(graph, rng, entity2, 3, { preferRelations: ['evokes', 'rhymes'] })

    // Find where they converge — the fusion point
    const collisions = findCollisions(graph, chain1, chain2)
    const mergedWorld = collisions.length > 0 && !collisions[0].meetConcept.includes(':')
      ? collisions[0].meetConcept
      : chain1.path[chain1.path.length - 1]

    // The void before merging
    const voidPlace = findVoid(graph, rng, [entity1, entity2, mergedWorld])

    // Important: intermediates from both chains
    const intermediates = [
      ...chain1.path.slice(1),
      ...chain2.path.slice(1),
    ]
    const important = intermediates
      .filter(c => c !== mergedWorld)
      .slice(0, 3)

    // Bad: the tension — things that collide between the two entities
    const bad = query(graph).where('collides', entity1).direction('any')
      .exclude(entity2).random(rng, 1)
    const bad2 = query(graph).where('collides', entity2).direction('any')
      .exclude(entity1).random(rng, 1)
    bad.push(...bad2)

    const wound = bad.length > 0 ? bad[0] : 'tension'

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace, quality: `${entity1} and ${entity2}, separate and incomplete` },
        concepts: [voidPlace, entity1, entity2],
      },
      act: {
        roles: { actor: entity1, verb: 'merged', partner: entity2, product: mergedWorld },
        concepts: [entity1, entity2, mergedWorld],
      },
      cost: {
        roles: { sacrificed: `${entity1}'s solitude` },
        concepts: [entity1, entity2],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [entity1, entity2],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: mergedWorld,
      ingredients: [entity1, entity2, mergedWorld, ...important],
      extra: {
        entities: [entity1, entity2],
        mergedWorld,
      },
    }
  },
}
