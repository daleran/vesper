/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { walkFrom } from '../walker.js'
import { findTool, findVoid } from '../queryHelpers.js'

/**
 * Weaving — a craftsman gathers materials from the void and assembles the
 * world deliberately. The cost: the raw materials are destroyed — their
 * original nature erased. The flaw: the materials remember what they were
 * and strain against their new form.
 * @type {MythRecipe}
 */
export const weaving = {
  name: 'weaving',
  weight: 1,
  generate(graph, rng) {
    // The crafter — fauna or item-adjacent concept (a maker, not a force)
    const crafterPool = query(graph).where('is', 'fauna').or('is', 'force')
      .get()
    const crafter = crafterPool.length > 0
      ? crafterPool[Math.floor(rng() * crafterPool.length)]
      : 'hand'

    // The void — raw, unworked
    const voidPlace = findVoid(graph, rng, [crafter])

    // The tool — something shaped, used to work with
    const tool = findTool(graph, rng, [crafter, voidPlace])

    // The material — body or material category
    const material = query(graph).where('is', 'material').or('is', 'body')
      .exclude(crafter, tool, voidPlace).first(rng) ?? 'clay'

    // Walk from material via transforms/produces to find what the weaving makes
    const chain = walkFrom(graph, rng, material, 3, { preferRelations: ['transforms', 'produces'] })
    const product = chain.path[chain.path.length - 1]
    const intermediates = chain.path.slice(1, -1)

    // Important: what the crafter worked through
    const important = intermediates.length > 0
      ? intermediates.slice(0, 3)
      : query(graph).nearby(crafter, 2).exclude(crafter, tool, material, voidPlace).random(rng, 2)

    // Flaw: the material's memory — walk from material via collides/evokes
    const flawChain = walkFrom(graph, rng, material, 2, { preferRelations: ['collides', 'evokes'] })
    const wound = flawChain.path[flawChain.path.length - 1]

    const bad = [wound]
    if (wound === material) {
      const alt = query(graph).where('collides', material).direction('any')
        .exclude(crafter, tool).first(rng)
      if (alt) { bad[0] = alt }
    }

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: voidPlace },
        concepts: [voidPlace],
      },
      act: {
        roles: { actor: crafter, verb: 'wove', tool, material, product },
        concepts: [crafter, tool, material, product],
      },
      cost: {
        roles: { sacrificed: material },
        concepts: [material],
      },
      flaw: {
        roles: { wound: bad[0] },
        concepts: bad,
      },
      creators: [crafter],
      important,
      bad,
      worldBefore: voidPlace,
      worldAfter: product,
      ingredients: [crafter, tool, material, ...important],
      extra: { crafter, tool, material, product },
    }
  },
}
