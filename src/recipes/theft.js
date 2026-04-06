/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findCreator, findVoid } from '../queryHelpers.js'

/**
 * Theft — something was stolen from another entity. Creation is a crime.
 * The original owner wants it back. The flaw is that the world is stolen
 * goods, and the rightful owner is still searching.
 * @type {MythRecipe}
 */
export const theft = {
  name: 'theft',
  weight: 1,
  generate(graph, rng) {
    // The thief — a force or element that acts
    const thief = findCreator(graph, rng)

    // The owner — something that opposes the thief
    const owner = query(graph).where('collides', thief).direction('any')
      .first(rng) ?? findVoid(graph, rng, [thief])

    // Walk from thief to discover the treasure
    const chain = walkFrom(graph, rng, thief, 4, { preferRelations: ['produces', 'consumes'] })
    const treasure = chain.path[chain.path.length - 1]
    const intermediates = chain.path.slice(1, -1)

    // The hiding place — where the thief brought the treasure
    const hidingPlace = query(graph).where('is', 'place')
      .exclude(thief, owner, treasure).first(rng) ?? 'cave'

    // Important: what the thief passed through on the way
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(thief, 2).exclude(thief, owner, treasure).random(rng, 2)

    // Bad: the owner and things near it — the pursuing force
    const bad = query(graph).nearby(owner, 1)
      .exclude(thief, treasure).get().slice(0, 2)
    if (bad.length === 0) bad.push(owner)

    const wound = `${owner} is still searching`

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: owner, quality: `${owner}, holding ${treasure} in the dark` },
        concepts: [owner, treasure],
      },
      act: {
        roles: { actor: thief, verb: 'stole', treasure, owner, place: hidingPlace },
        concepts: [thief, treasure, owner, hidingPlace],
      },
      cost: {
        roles: { sacrificed: `${owner}'s trust` },
        concepts: [owner],
      },
      flaw: {
        roles: { wound },
        concepts: [owner],
      },
      creators: [thief],
      important,
      bad,
      worldBefore: owner,
      worldAfter: treasure,
      ingredients: [thief, treasure, ...important],
      extra: {
        thief,
        owner,
        treasure,
        hidingPlace,
      },
    }
  },
}
