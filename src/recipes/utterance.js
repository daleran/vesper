/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findVoid } from '../queryHelpers.js'

/**
 * Utterance — a voice speaks in the void. Each name it utters becomes real.
 * The cost: the voice itself is consumed by speaking. The flaw: one thing
 * was misnamed or left unnamed — a hole in reality that cannot be filled.
 * @type {MythRecipe}
 */
export const utterance = {
  name: 'utterance',
  weight: 1,
  generate(graph, rng) {
    // The speaker — preferring sound-adjacent forces
    const soundForces = query(graph).where('sound').where('is', 'force')
      .or('is', 'element').get()
    const speaker = soundForces.length > 0
      ? soundForces[Math.floor(rng() * soundForces.length)]
      : query(graph).where('is', 'force').or('is', 'element').first(rng) ?? 'wind'

    // The void — silence before the first word
    const voidPlace = findVoid(graph, rng, [speaker])

    // Walk from speaker via sound/evokes to find the word
    const wordChain = walkFrom(graph, rng, speaker, 3, { preferRelations: ['evokes', 'produces'] })
    const word = wordChain.path[wordChain.path.length - 1]

    // Walk from word to find what the naming produces
    const productChain = walkFrom(graph, rng, word, 3, { preferRelations: ['transforms', 'produces'] })
    const product = productChain.path[productChain.path.length - 1]
    const intermediates = productChain.path.slice(1, -1)

    // Important: the chain of naming
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(speaker, 2).exclude(speaker, word, voidPlace).random(rng, 2)

    // The unnamed — something that collides with the word, the gap in reality
    const unnamed = query(graph).where('collides', word).direction('any')
      .exclude(speaker, word, product).first(rng)
      ?? query(graph).where('collides', speaker).direction('any')
        .exclude(speaker, word).first(rng)
      ?? 'silence'

    const bad = [unnamed]

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace },
        concepts: [voidPlace],
      },
      act: {
        roles: { actor: speaker, verb: 'named', word, product },
        concepts: [speaker, word, product],
      },
      cost: {
        roles: { sacrificed: speaker },
        concepts: [speaker],
      },
      flaw: {
        roles: { wound: unnamed },
        concepts: bad,
      },
      creators: [speaker],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: product,
      ingredients: [speaker, word, ...important],
      extra: { speaker, word, unnamed },
    }
  },
}
