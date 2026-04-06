/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { pick, pickN } from '../utils.js'
import { walkFrom, findCollisions, findParadoxes } from '../walker.js'

const ACCIDENT_FLAWS = [
  'purposelessness', 'indifference', 'arbitrariness',
  'the absence of intent', 'the suspicion that none of it was meant',
]

/**
 * Accident — creation was unintended. Two or more forces drifted into
 * contact and the collision produced the world. No one chose it, no one
 * takes responsibility. The flaw is existential: the world has no purpose.
 * @type {MythRecipe}
 */
export const accident = {
  name: 'accident',
  weight: 1,
  generate(graph, rng) {
    // Two agents: forces or elements that will accidentally collide
    const allForces = query(graph).where('is', 'force').or('is', 'element').get()
    const agents = pickN(rng, allForces, Math.min(2, allForces.length))
    const agent1 = agents[0] ?? 'fire'
    const agent2 = agents[1] ?? 'water'

    // Walk from each agent and find where they collide
    const chain1 = walkFrom(graph, rng, agent1, 3, { preferRelations: ['collides', 'produces'] })
    const chain2 = walkFrom(graph, rng, agent2, 3, { preferRelations: ['collides', 'produces'] })
    const collisions = findCollisions(graph, chain1, chain2)

    // The product is whatever the walks converge on, or the end of the longer chain
    const product = collisions.length > 0 && !collisions[0].meetConcept.includes(':')
      ? collisions[0].meetConcept
      : chain1.path[chain1.path.length - 1]

    // Cost: something consumed near the collision point — arbitrary, unchosen
    const consumed = query(graph).nearby(product, 1)
      .exclude(agent1, agent2, product)
      .first(rng) ?? query(graph).nearby(agent1, 1)
      .exclude(agent1, agent2).first(rng)
      ?? query(graph).where('collides', agent2).direction('any')
        .exclude(agent1, agent2, product).first(rng)
      ?? agent1

    // Find paradoxes — the world's built-in contradictions
    const paradoxes = findParadoxes([chain1, chain2])
    const paradoxConcepts = paradoxes.flatMap(p => p.concepts)

    // Important: intermediates from both chains
    const intermediates = [
      ...chain1.path.slice(1),
      ...chain2.path.slice(1),
    ]
    const important = intermediates
      .filter(c => c !== product && c !== consumed)
      .slice(0, 3)

    // Bad: paradox concepts, or things that collide with the product
    const bad = paradoxConcepts.length > 0
      ? paradoxConcepts.slice(0, 2)
      : query(graph).where('collides', product).direction('any')
        .random(rng, 2)

    const wound = bad.length > 0 ? bad[0] : pick(rng, ACCIDENT_FLAWS)

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: agent1, quality: `${agent1} and ${agent2}, drifting without intent` },
        concepts: [agent1, agent2],
      },
      act: {
        roles: { verb: 'collided', agent1, agent2, product },
        concepts: [agent1, agent2, product],
      },
      cost: {
        roles: { sacrificed: consumed },
        concepts: [consumed],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [],
      important,
      bad,
      worldBefore: `${agent1} and ${agent2}`,
      worldAfter: product,
      ingredients: [agent1, agent2, product, ...important],
      extra: {
        agents: [agent1, agent2],
        collisionPoint: product,
      },
    }
  },
}
