/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findDreamer, findVoid } from '../queryHelpers.js'

/**
 * Dream — reality is hallucinated by something sleeping. The world is not
 * built or born but imagined. The flaw is that the dreamer might wake,
 * and everything would unravel.
 * @type {MythRecipe}
 */
export const dream = {
  name: 'dream',
  weight: 1,
  generate(graph, rng) {
    // The dreamer — a sleeping entity
    const dreamer = findDreamer(graph, rng)

    // The void — the state of sleep before dreaming began
    const sleepVoid = findVoid(graph, rng, [dreamer])

    // Walk from dreamer to discover the dream-world
    const chain = walkFrom(graph, rng, dreamer, 4, { preferRelations: ['evokes', 'produces'] })
    const dreamWorld = chain.path[chain.path.length - 1]
    const intermediates = chain.path.slice(1, -1)

    // Important: the layers of the dream (intermediates)
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(dreamer, 2).exclude(dreamer, sleepVoid).random(rng, 2)

    // Bad: things that collide with the dream — threats of waking
    const bad = query(graph).where('collides', dreamWorld).direction('any')
      .random(rng, 2)

    const wound = `${dreamer} might wake`

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: sleepVoid, quality: `the unbroken sleep of ${dreamer}` },
        concepts: [sleepVoid],
      },
      act: {
        roles: { actor: dreamer, verb: 'dreamed', product: dreamWorld },
        concepts: [dreamer, dreamWorld, ...intermediates],
      },
      cost: {
        roles: { sacrificed: `${dreamer}'s wakefulness` },
        concepts: [dreamer],
      },
      flaw: {
        roles: { wound },
        concepts: [dreamer, dreamWorld],
      },
      creators: [dreamer],
      important,
      bad,
      worldBefore: sleepVoid,
      worldAfter: dreamWorld,
      ingredients: [dreamer, dreamWorld, ...important],
      extra: {
        dreamer,
        dreamWorld,
      },
    }
  },
}
