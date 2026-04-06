/**
 * @import { ConceptGraph } from '../concepts.js'
 * @import { MythRecipe } from './index.js'
 */
import { query } from '../query.js'
import { pick, pickN } from '../utils.js'
import { walkFrom } from '../walker.js'
import { findTool, findArena } from '../queryHelpers.js'

/**
 * Pantheon War — 3-5 gods fight over a place. One wins. The most opposite
 * god is slain. The victor's attributes define creation; the slain god's
 * attributes are the source of corruption.
 * @type {MythRecipe}
 */
export const pantheonWar = {
  name: 'pantheon-war',
  weight: 1,
  generate(graph, rng) {
    // Pick 3-5 god-domains from forces and elements
    const godCount = 3 + Math.floor(rng() * 3)
    const allDomains = query(graph).where('is', 'element').or('is', 'force').get()
    const domains = pickN(rng, allDomains, Math.min(godCount, allDomains.length))

    // Battleground (tiered fallback)
    const place = findArena(graph, rng, domains)

    // Pick the victor
    const victor = pick(rng, domains)
    const others = domains.filter(d => d !== victor)

    // Find the most opposite god — rank all others by closeness to victor,
    // the lowest-ranked is the most unlike
    const ranked = query(graph).where('is', 'element').or('is', 'force')
      .rank([victor])
    const rankedList = ranked.get().filter(c => others.includes(c))
    const slain = rankedList.length > 0
      ? rankedList[rankedList.length - 1]
      : others[others.length - 1]

    // Weapon (tiered fallback)
    const weapon = findTool(graph, rng, [victor, slain, place])

    // Walk from the weapon to discover what the world becomes after the killing blow
    const chain = walkFrom(graph, rng, weapon, 3, { preferRelations: ['consumes', 'collides'] })
    const worldAfter = chain.path[chain.path.length - 1]

    // Important: concepts related to the victor
    const important = query(graph).nearby(victor, 2)
      .exclude(victor, slain, ...others)
      .random(rng, 3)

    // Bad: concepts related to the slain god
    const bad = query(graph).nearby(slain, 2)
      .exclude(slain, victor, ...others)
      .random(rng, 2)

    const wound = bad.length > 0 ? bad[0] : slain

    return {
      seed: '', recipe: '',
      before: {
        roles: { void: place, quality: `where ${domains.join(' and ')} gathered` },
        concepts: [place],
      },
      act: {
        roles: { actor: victor, verb: 'slew', weapon, slain, place },
        concepts: [victor, slain, weapon],
      },
      cost: {
        roles: { sacrificed: slain },
        concepts: [slain],
      },
      flaw: {
        roles: { wound },
        concepts: bad,
      },
      creators: [victor, ...others.filter(d => d !== slain)],
      important,
      bad,
      worldBefore: place,
      worldAfter,
      ingredients: [weapon, ...important],
      extra: {
        victor,
        slain,
        pantheon: domains,
        battleground: place,
      },
    }
  },
}
