/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findTool, findVoid } from '../queryHelpers.js'

/**
 * Solo God — a single god based on a force or element emerges in a void-like
 * place, uses a tool to strike the void open. The world pours out from the
 * wound. Concepts colliding with the god's domain are the source of evil.
 * @type {MythRecipe}
 */
export const soloGod = {
  name: 'solo-god',
  weight: 1,
  generate(graph, rng) {
    // The god's domain: an element or force
    const domain = query(graph).where('is', 'element').or('is', 'force').first(rng)
      ?? 'fire'

    // The void: something void-like (tiered fallback)
    const voidPlace = findVoid(graph, rng, [domain])

    // Important concepts: things nearby the domain
    const important = query(graph).nearby(domain, 2)
      .exclude(domain, voidPlace)
      .random(rng, 3)

    // Bad concepts: things that collide with the domain
    const bad = query(graph).where('collides', domain).direction('any')
      .random(rng, 2)

    // The god's tool (tiered fallback)
    const item = findTool(graph, rng, [domain, voidPlace])

    // Walk from the item to find what the world becomes
    const chain = walkFrom(graph, rng, item, 3, { preferRelations: ['produces', 'transforms'] })
    const transformed = chain.path[chain.path.length - 1]

    // Cost: something that opposes the god's domain — tension makes the sacrifice meaningful
    const resistant = query(graph).where('collides', domain).direction('any')
      .exclude(domain, voidPlace, item).first(rng)
    const consumed = resistant ?? query(graph).nearby(domain, 1)
      .where('consumes').direction('rev')
      .first(rng) ?? important[0] ?? 'something unnamed'

    const wound = bad.length > 0 ? bad[0] : 'an unnamed thing'

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace },
        concepts: [voidPlace],
      },
      act: {
        roles: { actor: domain, verb: 'struck', tool: item, target: voidPlace, product: transformed },
        concepts: [domain, item, transformed],
      },
      cost: {
        roles: { sacrificed: consumed },
        concepts: [consumed],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [domain],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: transformed,
      ingredients: [item, ...important],
      extra: { godDomain: domain, tool: item },
    }
  },
}
