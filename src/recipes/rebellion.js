/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findCreator, findTool, findArena } from '../queryHelpers.js'

/**
 * Rebellion — the creator's own creations rose up and destroyed it. The world
 * is built on the creator's corpse. An orphan world with no one to answer
 * prayers. The flaw is that no one governs, no one is responsible.
 * @type {MythRecipe}
 */
export const rebellion = {
  name: 'rebellion',
  weight: 1,
  generate(graph, rng) {
    // The original creator — now dead
    const creator = findCreator(graph, rng)

    // Walk from creator to find what it produced — those are the rebels
    const rebelChain = walkFrom(graph, rng, creator, 3, { preferRelations: ['produces', 'transforms'] })
    const rebels = rebelChain.path.slice(1)
    const chiefRebel = rebels[0] ?? query(graph).where('is', 'force')
      .exclude(creator).first(rng) ?? 'hunger'

    // What does the creator's body become?
    const corpseChain = walkFrom(graph, rng, creator, 3, { preferRelations: ['transforms', 'consumes'] })
    const worldAfter = corpseChain.path[corpseChain.path.length - 1]

    // Weapon and arena
    const allUsed = [creator, ...rebels, worldAfter]
    const weapon = findTool(graph, rng, allUsed)
    const arena = findArena(graph, rng, allUsed)

    // Important: the other rebels and intermediates
    const important = rebels.slice(1, 4)

    // Bad: things that collide with the chief rebel — the guilt, the consequences
    const bad = query(graph).where('collides', chiefRebel).direction('any')
      .random(rng, 2)

    const wound = bad.length > 0 ? bad[0] : 'orphanhood'

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: arena, quality: `where ${creator} ruled over all things` },
        concepts: [arena],
      },
      act: {
        roles: { actor: chiefRebel, verb: 'overthrew', weapon, slain: creator, place: arena },
        concepts: [chiefRebel, weapon, creator],
      },
      cost: {
        roles: { sacrificed: creator },
        concepts: [creator],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: rebels.slice(0, 3),
      important,
      bad,
      worldBefore: arena,
      worldAfter,
      ingredients: [creator, chiefRebel, weapon, ...important],
      extra: {
        deadCreator: creator,
        rebels: rebels.slice(0, 3),
        weapon,
      },
    }
  },
}
