/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findPerfection } from '../queryHelpers.js'

/**
 * Corruption — something perfect existed and was ruined. The world is the
 * damaged remnant. No creator intended this — only a corruptor that found
 * the crack. The flaw is that perfection can never be restored.
 * @type {MythRecipe}
 */
export const corruption = {
  name: 'corruption',
  weight: 1,
  generate(graph, rng) {
    // The perfect thing — celestial, luminous, whole
    const perfection = findPerfection(graph, rng)

    // Walk from perfection along destructive edges to find the corruptor
    const corruptChain = walkFrom(graph, rng, perfection, 3, { preferRelations: ['consumes', 'collides'] })
    const corruptor = corruptChain.path[corruptChain.path.length - 1]

    // Walk from perfection along transformative edges to find what it became
    const becameChain = walkFrom(graph, rng, perfection, 3, { preferRelations: ['transforms', 'produces'] })
    const corruptedWorld = becameChain.path[becameChain.path.length - 1]

    // Important: intermediates from both chains
    const intermediates = [
      ...corruptChain.path.slice(1, -1),
      ...becameChain.path.slice(1, -1),
    ]
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(perfection, 2).exclude(perfection, corruptor).random(rng, 2)

    // Bad: things near the corruptor — the agents of ruin
    const bad = query(graph).nearby(corruptor, 1)
      .exclude(perfection, corruptedWorld).get().slice(0, 2)
    if (bad.length === 0) bad.push(corruptor)

    const wound = bad.length > 0 ? bad[0] : 'irreversibility'

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: perfection, quality: 'perfect and complete' },
        concepts: [perfection],
      },
      act: {
        roles: { actor: corruptor, verb: 'corrupted', target: perfection, product: corruptedWorld },
        concepts: [corruptor, perfection, corruptedWorld],
      },
      cost: {
        roles: { sacrificed: perfection },
        concepts: [perfection],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [],
      important,
      bad,
      worldBefore: perfection,
      worldAfter: corruptedWorld,
      ingredients: [perfection, corruptor, corruptedWorld, ...important],
      extra: {
        perfection,
        corruptor,
      },
    }
  },
}
