/**
 * Reusable semantic concept finders with tiered fallbacks.
 * Recipes call these instead of rigid category queries like
 * `where('is', 'item')`. Each helper tries the specific category
 * first and widens to semantic matches when the pool is too shallow.
 *
 * @import { ConceptGraph } from './concepts.js'
 */
import { query } from './query.js'
import { pick } from './utils.js'

/**
 * Find something tool-like: items first, then anything with shape + produces,
 * then anything with a shape edge.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude=[]]
 * @returns {string}
 */
export function findTool(graph, rng, exclude = []) {
  const items = query(graph).where('is', 'item').exclude(...exclude).get()
  if (items.length >= 3) return pick(rng, items)

  const shaped = query(graph).where('shape').exclude(...exclude).get()
  if (shaped.length > 0) return pick(rng, shaped)

  return 'hand'
}

/**
 * Find something void-like: things that rhyme with void, then places,
 * then things that evoke silence or emptiness.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude=[]]
 * @returns {string}
 */
export function findVoid(graph, rng, exclude = []) {
  const voidLike = query(graph).where('rhymes', 'void').direction('fwd')
    .exclude(...exclude).get()
  if (voidLike.length > 0) return pick(rng, voidLike)

  const places = query(graph).where('is', 'place').exclude(...exclude).get()
  if (places.length > 0) return pick(rng, places)

  return 'void'
}

/**
 * Find an arena or gathering place: places first, then celestial bodies,
 * then anything that evokes conflict or gathering.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude=[]]
 * @returns {string}
 */
export function findArena(graph, rng, exclude = []) {
  const places = query(graph).where('is', 'place').exclude(...exclude).get()
  if (places.length >= 3) return pick(rng, places)

  const celestial = query(graph).where('is', 'celestial').exclude(...exclude).get()
  if (celestial.length > 0) return pick(rng, celestial)

  return 'mountain'
}

/**
 * Find a creator-type concept: forces and elements first, then fauna,
 * then celestial bodies.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude=[]]
 * @returns {string}
 */
export function findCreator(graph, rng, exclude = []) {
  const gods = query(graph).where('is', 'element').or('is', 'force')
    .exclude(...exclude).get()
  if (gods.length >= 3) return pick(rng, gods)

  const fauna = query(graph).where('is', 'fauna').exclude(...exclude).get()
  if (fauna.length > 0) return pick(rng, fauna)

  return 'fire'
}

/**
 * Find a birthplace: places first, then body parts (a god's body as location),
 * then materials (a substance as substrate).
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude=[]]
 * @returns {string}
 */
export function findBirthplace(graph, rng, exclude = []) {
  const places = query(graph).where('is', 'place').exclude(...exclude).get()
  if (places.length >= 3) return pick(rng, places)

  const body = query(graph).where('is', 'body').exclude(...exclude).get()
  if (body.length > 0) return pick(rng, body)

  return 'cave'
}

/**
 * Find a dreamer: fauna first (sleeping creatures), then forces that evoke
 * dream or sleep, then fallback 'sleep'.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude=[]]
 * @returns {string}
 */
export function findDreamer(graph, rng, exclude = []) {
  const fauna = query(graph).where('is', 'fauna').exclude(...exclude).get()
  if (fauna.length >= 3) return pick(rng, fauna)

  const dreamlike = query(graph).where('evokes', 'dream').or('evokes', 'sleep')
    .direction('fwd').exclude(...exclude).get()
  if (dreamlike.length > 0) return pick(rng, dreamlike)

  return 'sleep'
}

/**
 * Find something associated with perfection: celestial bodies, things that
 * produce light, materials with gold color, then fallback 'light'.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} [exclude=[]]
 * @returns {string}
 */
export function findPerfection(graph, rng, exclude = []) {
  const celestial = query(graph).where('is', 'celestial').exclude(...exclude).get()
  if (celestial.length >= 2) return pick(rng, celestial)

  const luminous = query(graph).where('produces', 'light').direction('fwd')
    .or('color', 'gold').exclude(...exclude).get()
  if (luminous.length > 0) return pick(rng, luminous)

  return 'light'
}
