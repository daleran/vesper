/**
 * Per-recipe pantheon shape functions.
 * Each function reads its recipe's `extra` field and returns an array
 * of agent seeds — partial Agent objects with domains, type, mythRole,
 * alive, and state. The orchestrator in pantheon.js fills in the rest.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { AgentSeed } from './pantheon.js'
 */
import { query } from './query.js'
import { walkFrom } from './walker.js'

/**
 * Helper: make a seed with sensible defaults.
 * @param {Partial<AgentSeed> & { domains: string[] }} fields
 * @returns {AgentSeed}
 */
function seed(fields) {
  return {
    type: 'god',
    mythRole: 'creator',
    alive: true,
    state: 'active',
    ...fields,
  }
}

/**
 * Helper: walk from a concept and return the terminal concept as a
 * spirit agent seed with 1-hop domain neighbors.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} start
 * @param {string} mythRole
 * @param {string[]} [preferRelations]
 * @returns {AgentSeed}
 */
function spiritFromWalk(graph, rng, start, mythRole, preferRelations) {
  const chain = walkFrom(graph, rng, start, 2, preferRelations ? { preferRelations } : {})
  const terminal = chain.path[chain.path.length - 1]
  const nearby = query(graph).nearby(terminal, 1).exclude(terminal).get().slice(0, 2)
  return seed({
    domains: [terminal, ...nearby],
    type: 'spirit',
    mythRole,
  })
}

/** @type {Record<string, (graph: ConceptGraph, myth: CreationMyth, rng: () => number) => AgentSeed[]>} */
export const SHAPES = {
  'solo-god'(graph, myth, rng) {
    const domain = /** @type {string} */ (myth.extra['godDomain'])
    const nearby = query(graph).nearby(domain, 1).exclude(domain).get().slice(0, 2)

    /** @type {AgentSeed[]} */
    const seeds = [
      seed({ domains: [domain, ...nearby], mythRole: 'creator' }),
    ]

    // Demons/spirits from flaw concepts
    if (myth.flaw.concepts.length > 0) {
      seeds.push(spiritFromWalk(graph, rng, myth.flaw.concepts[0], 'flaw-bearer', ['collides', 'consumes']))
    }

    // Spirit from cost
    if (myth.cost.concepts.length > 0 && myth.cost.concepts[0] !== domain) {
      const costConcept = myth.cost.concepts[0]
      const costNearby = query(graph).nearby(costConcept, 1).exclude(costConcept).get().slice(0, 1)
      seeds.push(seed({
        domains: [costConcept, ...costNearby],
        type: 'spirit',
        mythRole: 'sacrifice',
        alive: false,
        state: 'transformed',
      }))
    }

    return seeds
  },

  'pantheon-war'(graph, myth, rng) {
    const victor = /** @type {string} */ (myth.extra['victor'])
    const slain = /** @type {string} */ (myth.extra['slain'])
    const pantheon = /** @type {string[]} */ (myth.extra['pantheon'])
    const others = pantheon.filter(d => d !== victor && d !== slain)

    /** @type {AgentSeed[]} */
    const seeds = []

    // Victor god
    const victorNearby = query(graph).nearby(victor, 1).exclude(victor, slain, ...others).get().slice(0, 2)
    seeds.push(seed({ domains: [victor, ...victorNearby], mythRole: 'creator' }))

    // Slain god
    const slainNearby = query(graph).nearby(slain, 1).exclude(slain, victor, ...others).get().slice(0, 2)
    seeds.push(seed({
      domains: [slain, ...slainNearby],
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Surviving gods
    for (const d of others.slice(0, 2)) {
      const dNearby = query(graph).nearby(d, 1).exclude(d, victor, slain).get().slice(0, 1)
      seeds.push(seed({ domains: [d, ...dNearby], mythRole: 'witness' }))
    }

    // Legacy spirit from the slain god
    seeds.push(spiritFromWalk(graph, rng, slain, 'echo', ['transforms', 'evokes']))

    return seeds
  },

  'world-birth'(graph, myth, _rng) {
    const parent = /** @type {string} */ (myth.extra['parent'])
    const childWorld = /** @type {string} */ (myth.extra['childWorld'])
    const kidnappers = /** @type {string[]} */ (myth.extra['kidnappers'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Parent god — searching
    const parentNearby = query(graph).nearby(parent, 1).exclude(parent, childWorld).get().slice(0, 2)
    seeds.push(seed({ domains: [parent, ...parentNearby], mythRole: 'creator' }))

    // Child-world as demi-god (imprisoned)
    const childNearby = query(graph).nearby(childWorld, 1).exclude(childWorld, parent).get().slice(0, 1)
    seeds.push(seed({
      domains: [childWorld, ...childNearby],
      type: 'demi-god',
      mythRole: 'sacrifice',
      state: 'imprisoned',
    }))

    // Kidnappers as demons
    for (const k of kidnappers.slice(0, 2)) {
      const kNearby = query(graph).nearby(k, 1).exclude(k, parent, childWorld).get().slice(0, 1)
      seeds.push(seed({
        domains: [k, ...kNearby],
        type: 'demon',
        mythRole: 'flaw-bearer',
      }))
    }

    return seeds
  },

  'sacrifice'(graph, myth, _rng) {
    const creator = /** @type {string} */ (myth.extra['creator'])
    const becamePath = /** @type {string[]} */ (myth.extra['becamePath'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Dead creator god
    const creatorNearby = query(graph).nearby(creator, 1).exclude(creator).get().slice(0, 2)
    seeds.push(seed({
      domains: [creator, ...creatorNearby],
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Spirits from the body-path (what the creator became)
    const intermediates = becamePath.slice(1)
    for (const step of intermediates.slice(0, 3)) {
      const stepNearby = query(graph).nearby(step, 1).exclude(step, creator).get().slice(0, 1)
      seeds.push(seed({
        domains: [step, ...stepNearby],
        type: 'spirit',
        mythRole: 'echo',
        state: 'transformed',
      }))
    }

    return seeds
  },

  'splitting'(graph, myth, rng) {
    const unity = /** @type {string} */ (myth.extra['unity'])
    const fragments = /** @type {string[]} */ (myth.extra['fragments'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // The original unity — dead/transformed
    const unityNearby = query(graph).nearby(unity, 1).exclude(unity, ...fragments).get().slice(0, 1)
    seeds.push(seed({
      domains: [unity, ...unityNearby],
      mythRole: 'sacrifice',
      alive: false,
      state: 'transformed',
    }))

    // Twin gods from fragments
    for (const f of fragments.slice(0, 2)) {
      const fNearby = query(graph).nearby(f, 1).exclude(f, unity, ...fragments.filter(x => x !== f)).get().slice(0, 2)
      seeds.push(seed({ domains: [f, ...fNearby], mythRole: 'creator' }))
    }

    // Spirit from the splitter or walk
    const splitter = /** @type {string} */ (myth.extra['splitter'])
    seeds.push(spiritFromWalk(graph, rng, splitter, 'witness', ['collides', 'transforms']))

    return seeds
  },

  'accident'(graph, myth, _rng) {
    const agents = /** @type {string[]} */ (myth.extra['agents'])
    const collisionPoint = /** @type {string} */ (myth.extra['collisionPoint'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Forces as spirits (no gods in an accident)
    for (const a of agents.slice(0, 2)) {
      const aNearby = query(graph).nearby(a, 1).exclude(a, ...agents.filter(x => x !== a)).get().slice(0, 2)
      seeds.push(seed({
        domains: [a, ...aNearby],
        type: 'spirit',
        mythRole: 'witness',
      }))
    }

    // Collision point spirit
    const cpNearby = query(graph).nearby(collisionPoint, 1).exclude(collisionPoint, ...agents).get().slice(0, 1)
    seeds.push(seed({
      domains: [collisionPoint, ...cpNearby],
      type: 'spirit',
      mythRole: 'echo',
      state: 'transformed',
    }))

    return seeds
  },

  'cycle'(graph, myth, rng) {
    const creator = /** @type {string} */ (myth.extra['creator'])
    const previousWorld = /** @type {string} */ (myth.extra['previousWorld'])
    const currentWorld = /** @type {string} */ (myth.extra['currentWorld'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Creator god — eternal
    const creatorNearby = query(graph).nearby(creator, 1).exclude(creator, previousWorld, currentWorld).get().slice(0, 2)
    seeds.push(seed({ domains: [creator, ...creatorNearby], mythRole: 'creator' }))

    // Previous world as dead ancestor
    const prevNearby = query(graph).nearby(previousWorld, 1).exclude(previousWorld, creator).get().slice(0, 1)
    seeds.push(seed({
      domains: [previousWorld, ...prevNearby],
      type: 'ancestor',
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Spirit from current world
    seeds.push(spiritFromWalk(graph, rng, currentWorld, 'echo', ['produces', 'transforms']))

    return seeds
  },

  'rebellion'(graph, myth, rng) {
    const deadCreator = /** @type {string} */ (myth.extra['deadCreator'])
    const rebels = /** @type {string[]} */ (myth.extra['rebels'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Dead creator god
    const creatorNearby = query(graph).nearby(deadCreator, 1).exclude(deadCreator, ...rebels).get().slice(0, 2)
    seeds.push(seed({
      domains: [deadCreator, ...creatorNearby],
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Rebels as demi-gods
    for (const r of rebels.slice(0, 3)) {
      const rNearby = query(graph).nearby(r, 1).exclude(r, deadCreator, ...rebels.filter(x => x !== r)).get().slice(0, 1)
      seeds.push(seed({
        domains: [r, ...rNearby],
        type: 'demi-god',
        mythRole: 'creator',
      }))
    }

    // Ghost spirit from the dead creator
    seeds.push(spiritFromWalk(graph, rng, deadCreator, 'echo', ['evokes', 'transforms']))

    return seeds
  },

  'theft'(graph, myth, rng) {
    const thief = /** @type {string} */ (myth.extra['thief'])
    const owner = /** @type {string} */ (myth.extra['owner'])
    const treasure = /** @type {string} */ (myth.extra['treasure'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Thief god
    const thiefNearby = query(graph).nearby(thief, 1).exclude(thief, owner, treasure).get().slice(0, 2)
    seeds.push(seed({ domains: [thief, ...thiefNearby], mythRole: 'creator' }))

    // Owner — pursuing god/demon
    const ownerNearby = query(graph).nearby(owner, 1).exclude(owner, thief, treasure).get().slice(0, 2)
    seeds.push(seed({
      domains: [owner, ...ownerNearby],
      type: 'demon',
      mythRole: 'flaw-bearer',
    }))

    // Treasure guardian spirit
    seeds.push(spiritFromWalk(graph, rng, treasure, 'witness', ['evokes', 'produces']))

    return seeds
  },

  'dream'(graph, myth, rng) {
    const dreamer = /** @type {string} */ (myth.extra['dreamer'])
    const dreamWorld = /** @type {string} */ (myth.extra['dreamWorld'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Dreamer god — sleeping
    const dreamerNearby = query(graph).nearby(dreamer, 1).exclude(dreamer, dreamWorld).get().slice(0, 2)
    seeds.push(seed({
      domains: [dreamer, ...dreamerNearby],
      mythRole: 'creator',
      state: 'sleeping',
    }))

    // Dream-world spirit
    const dwNearby = query(graph).nearby(dreamWorld, 1).exclude(dreamWorld, dreamer).get().slice(0, 1)
    seeds.push(seed({
      domains: [dreamWorld, ...dwNearby],
      type: 'spirit',
      mythRole: 'echo',
    }))

    // Herald spirit from dreamer's domain
    seeds.push(spiritFromWalk(graph, rng, dreamer, 'witness', ['evokes', 'rhymes']))

    return seeds
  },

  'corruption'(graph, myth, rng) {
    const perfection = /** @type {string} */ (myth.extra['perfection'])
    const corruptor = /** @type {string} */ (myth.extra['corruptor'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Perfection — dead/transformed god-like entity
    const perfNearby = query(graph).nearby(perfection, 1).exclude(perfection, corruptor).get().slice(0, 2)
    seeds.push(seed({
      domains: [perfection, ...perfNearby],
      type: 'spirit',
      mythRole: 'sacrifice',
      alive: false,
      state: 'transformed',
    }))

    // Corruptor demon
    const corrNearby = query(graph).nearby(corruptor, 1).exclude(corruptor, perfection).get().slice(0, 2)
    seeds.push(seed({
      domains: [corruptor, ...corrNearby],
      type: 'demon',
      mythRole: 'flaw-bearer',
    }))

    // Spirit from the corrupted remains
    seeds.push(spiritFromWalk(graph, rng, perfection, 'echo', ['transforms', 'produces']))

    return seeds
  },

  'symbiosis'(graph, myth, _rng) {
    const entities = /** @type {string[]} */ (myth.extra['entities'])
    const mergedWorld = /** @type {string} */ (myth.extra['mergedWorld'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Twin gods — bound together
    for (const e of entities.slice(0, 2)) {
      const eNearby = query(graph).nearby(e, 1).exclude(e, ...entities.filter(x => x !== e), mergedWorld).get().slice(0, 2)
      seeds.push(seed({ domains: [e, ...eNearby], mythRole: 'creator' }))
    }

    // Merged-world spirit
    const mwNearby = query(graph).nearby(mergedWorld, 1).exclude(mergedWorld, ...entities).get().slice(0, 1)
    seeds.push(seed({
      domains: [mergedWorld, ...mwNearby],
      type: 'spirit',
      mythRole: 'echo',
    }))

    return seeds
  },

  'exile'(graph, myth, rng) {
    const wanderer = /** @type {string} */ (myth.extra['wanderer'])
    const origin = /** @type {string} */ (myth.extra['origin'])
    const product = /** @type {string} */ (myth.extra['product'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Exiled god — active, wandering
    const wandererNearby = query(graph).nearby(wanderer, 1).exclude(wanderer, origin, product).get().slice(0, 2)
    seeds.push(seed({ domains: [wanderer, ...wandererNearby], mythRole: 'creator', state: 'exiled' }))

    // Origin spirit — transformed, unreachable
    const originNearby = query(graph).nearby(origin, 1).exclude(origin, wanderer).get().slice(0, 1)
    seeds.push(seed({
      domains: [origin, ...originNearby],
      type: 'spirit',
      mythRole: 'echo',
      state: 'transformed',
    }))

    // Homesickness demon from flaw
    seeds.push(spiritFromWalk(graph, rng, myth.flaw.concepts[0] ?? product, 'flaw-bearer', ['evokes', 'collides']))

    return seeds
  },

  'utterance'(graph, myth, rng) {
    const speaker = /** @type {string} */ (myth.extra['speaker'])
    const word = /** @type {string} */ (myth.extra['word'])
    const unnamed = /** @type {string} */ (myth.extra['unnamed'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Dead speaker god — voice consumed
    const speakerNearby = query(graph).nearby(speaker, 1).exclude(speaker, word, unnamed).get().slice(0, 2)
    seeds.push(seed({
      domains: [speaker, ...speakerNearby],
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Named-world spirit
    const wordNearby = query(graph).nearby(word, 1).exclude(word, speaker, unnamed).get().slice(0, 1)
    seeds.push(seed({
      domains: [word, ...wordNearby],
      type: 'spirit',
      mythRole: 'echo',
    }))

    // Unnamed demon — the gap in reality
    const unnamedNearby = query(graph).nearby(unnamed, 1).exclude(unnamed, speaker, word).get().slice(0, 2)
    seeds.push(seed({
      domains: [unnamed, ...unnamedNearby],
      type: 'demon',
      mythRole: 'flaw-bearer',
    }))

    // Herald from the speaker's domain
    seeds.push(spiritFromWalk(graph, rng, speaker, 'witness', ['evokes', 'produces']))

    return seeds
  },

  'weaving'(graph, myth, rng) {
    const crafter = /** @type {string} */ (myth.extra['crafter'])
    const tool = /** @type {string} */ (myth.extra['tool'])
    const material = /** @type {string} */ (myth.extra['material'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Crafter god — still active
    const crafterNearby = query(graph).nearby(crafter, 1).exclude(crafter, tool, material).get().slice(0, 2)
    seeds.push(seed({ domains: [crafter, ...crafterNearby], mythRole: 'creator' }))

    // Tool spirit
    const toolNearby = query(graph).nearby(tool, 1).exclude(tool, crafter, material).get().slice(0, 1)
    seeds.push(seed({
      domains: [tool, ...toolNearby],
      type: 'spirit',
      mythRole: 'witness',
    }))

    // Material ancestor — transformed
    const matNearby = query(graph).nearby(material, 1).exclude(material, crafter, tool).get().slice(0, 1)
    seeds.push(seed({
      domains: [material, ...matNearby],
      type: 'ancestor',
      mythRole: 'sacrifice',
      state: 'transformed',
    }))

    // Flaw spirit from the material's resistance
    seeds.push(spiritFromWalk(graph, rng, myth.flaw.concepts[0] ?? material, 'flaw-bearer', ['collides', 'evokes']))

    return seeds
  },

  'contagion'(graph, myth, rng) {
    const source = /** @type {string} */ (myth.extra['source'])
    const container = /** @type {string} */ (myth.extra['container'])
    const bloom = /** @type {string} */ (myth.extra['bloom'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Source spirit — no gods in a contagion (like accident)
    const sourceNearby = query(graph).nearby(source, 1).exclude(source, container, bloom).get().slice(0, 2)
    seeds.push(seed({
      domains: [source, ...sourceNearby],
      type: 'spirit',
      mythRole: 'creator',
    }))

    // Container ancestor — dead, shattered
    const contNearby = query(graph).nearby(container, 1).exclude(container, source, bloom).get().slice(0, 1)
    seeds.push(seed({
      domains: [container, ...contNearby],
      type: 'ancestor',
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Bloom demons — the spread
    seeds.push(spiritFromWalk(graph, rng, bloom, 'flaw-bearer', ['produces', 'consumes']))

    return seeds
  },

  'mourning'(graph, myth, rng) {
    const mourner = /** @type {string} */ (myth.extra['mourner'])
    const dead = /** @type {string} */ (myth.extra['dead'])
    const memorial = /** @type {string} */ (myth.extra['memorial'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Mourner god — active, grieving
    const mournerNearby = query(graph).nearby(mourner, 1).exclude(mourner, dead, memorial).get().slice(0, 2)
    seeds.push(seed({ domains: [mourner, ...mournerNearby], mythRole: 'creator' }))

    // Dead ancestor — gone before creation
    const deadNearby = query(graph).nearby(dead, 1).exclude(dead, mourner, memorial).get().slice(0, 1)
    seeds.push(seed({
      domains: [dead, ...deadNearby],
      type: 'ancestor',
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Memorial spirit
    const memNearby = query(graph).nearby(memorial, 1).exclude(memorial, mourner, dead).get().slice(0, 1)
    seeds.push(seed({
      domains: [memorial, ...memNearby],
      type: 'spirit',
      mythRole: 'echo',
    }))

    // Grief demon from the flaw
    seeds.push(spiritFromWalk(graph, rng, myth.flaw.concepts[0] ?? dead, 'flaw-bearer', ['evokes', 'rhymes']))

    return seeds
  },

  'taboo'(graph, myth, rng) {
    const transgressor = /** @type {string} */ (myth.extra['transgressor'])
    const law = /** @type {string} */ (myth.extra['law'])
    const consequence = /** @type {string} */ (myth.extra['consequence'])

    /** @type {AgentSeed[]} */
    const seeds = []

    // Transgressor demi-god — exiled
    const transNearby = query(graph).nearby(transgressor, 1).exclude(transgressor, law, consequence).get().slice(0, 2)
    seeds.push(seed({
      domains: [transgressor, ...transNearby],
      type: 'demi-god',
      mythRole: 'creator',
      state: 'exiled',
    }))

    // Law spirit — dead, the shattered order
    const lawNearby = query(graph).nearby(law, 1).exclude(law, transgressor, consequence).get().slice(0, 1)
    seeds.push(seed({
      domains: [law, ...lawNearby],
      type: 'spirit',
      mythRole: 'sacrifice',
      alive: false,
      state: 'dead',
    }))

    // Consequence god — the world that resulted
    const consNearby = query(graph).nearby(consequence, 1).exclude(consequence, transgressor, law).get().slice(0, 2)
    seeds.push(seed({
      domains: [consequence, ...consNearby],
      mythRole: 'echo',
    }))

    // Taboo herald — the residual prohibition
    seeds.push(spiritFromWalk(graph, rng, myth.flaw.concepts[0] ?? law, 'flaw-bearer', ['evokes', 'rhymes']))

    return seeds
  },
}
