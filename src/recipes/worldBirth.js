/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findBirthplace } from '../queryHelpers.js'

/**
 * World-Birth — a fauna-type god gives birth to the world, which is described
 * as a force. Entities opposite that force kidnap the child-world. The parent
 * god is always searching for its lost child, which IS the world.
 * @type {MythRecipe}
 */
export const worldBirth = {
  name: 'world-birth',
  weight: 1,
  generate(graph, rng) {
    // The parent: a fauna god
    const parent = query(graph).where('is', 'fauna').first(rng) ?? 'serpent'

    // The world's nature: a force
    const worldForce = query(graph).where('is', 'force').first(rng) ?? 'dream'

    // Kidnappers: things that collide with or oppose the force
    const kidnappers = query(graph).where('collides', worldForce).direction('any')
      .random(rng, 2)

    // If no direct collisions, find something far from the force
    const enemies = kidnappers.length > 0
      ? kidnappers
      : query(graph).where('is', 'element').exclude(worldForce).random(rng, 2)

    // Walk from the first enemy to discover what captivity looks like
    const captivityChain = walkFrom(graph, rng, enemies[0] ?? 'void', 3, { preferRelations: ['produces', 'evokes'] })
    const captivityConcepts = captivityChain.path.slice(1)

    // Important: concepts near the force
    const important = query(graph).nearby(worldForce, 2)
      .exclude(worldForce, parent, ...enemies, ...captivityConcepts)
      .random(rng, 3)

    // Bad: the kidnappers + what captivity produces
    const bad = [...enemies, ...captivityConcepts.slice(0, 1)]

    // Where the birth happened (tiered fallback)
    const birthplace = findBirthplace(graph, rng, [parent, worldForce, ...enemies])

    const wound = `${parent} is still searching`

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: birthplace, quality: `the body of ${parent}, vast and gravid` },
        concepts: [birthplace],
      },
      act: {
        roles: { parent, verb: 'gave_birth', child: worldForce },
        concepts: [parent, worldForce],
      },
      cost: {
        roles: { sacrificed: `${parent}'s bond with ${worldForce}` },
        concepts: enemies,
      },
      flaw: {
        roles: { wound },
        concepts: [parent, worldForce],
      },
      creators: [parent],
      important,
      bad,
      worldBefore: birthplace,
      worldAfter: worldForce,
      ingredients: [worldForce, ...important],
      extra: {
        parent,
        childWorld: worldForce,
        kidnappers: enemies,
        birthplace,
      },
    }
  },
}
