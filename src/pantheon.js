/**
 * Pantheon generator — builds agents from a creation myth and writes
 * them into the shared World object.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 */
import { nameAgents } from './naming.js'
import { query } from './query.js'
import { walkFrom } from './walker.js'
import { pick } from './utils.js'
import { assignPronouns } from './pronouns.js'
import { SHAPES } from './pantheonShapes.js'
import { addAgent } from './world.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   domains: string[],
 *   type: 'god'|'demi-god'|'spirit'|'demon'|'ancestor'|'herald',
 *   mythRole: string,
 *   alive: boolean,
 *   state: 'active'|'dead'|'sleeping'|'imprisoned'|'exiled'|'transformed'|'forgotten'
 * }} AgentSeed
 */

/**
 * @typedef {{
 *   target: string,
 *   kind: 'parent'|'rival'|'servant'|'betrayed-by'|'sibling'|'creator'|'slayer'|'ward'
 * }} AgentRelationship
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   title: string,
 *   type: 'god'|'demi-god'|'spirit'|'demon'|'ancestor'|'herald'|'hero',
 *   domains: string[],
 *   disposition: string,
 *   relationships: AgentRelationship[],
 *   mythRole: string,
 *   alive: boolean,
 *   state: 'active'|'dead'|'sleeping'|'imprisoned'|'exiled'|'transformed'|'forgotten',
 *   origin: 'pantheon'|'history'|'landscape',
 *   worshippedBy: string[],
 *   patronOf: string[],
 *   pronouns: 'he'|'she'|'they'|'it',
 * }} Agent
 */

// ── Constants ──

const MIN_AGENTS = 3
const MAX_AGENTS = 7

/** State-derived participles for title generation. */
const STATE_PARTICIPLES = /** @type {Record<string, string>} */ ({
  dead: 'Slain',
  sleeping: 'Sleeping',
  imprisoned: 'Imprisoned',
  exiled: 'Exiled',
  transformed: 'Transformed',
  forgotten: 'Forgotten',
})

/** Relation-to-verb mapping for "Who-Verb-in-Domain" titles. */
const RELATION_VERBS = /** @type {Record<string, string>} */ ({
  transforms: 'Dwells',
  consumes: 'Feeds',
  produces: 'Sows',
  collides: 'Burns',
  evokes: 'Grieves',
})

// ── Main entry ──

/**
 * Generate a pantheon from a creation myth and add agents to the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generatePantheon(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)

  // 1. Extract primary agents from recipe-specific shape
  const shapeFn = SHAPES[myth.recipe]
  const seeds = shapeFn ? shapeFn(graph, myth, rng) : []

  // 2. Derive secondary agents if needed
  const allSeeds = deriveSecondaryAgents(graph, seeds, myth, rng)

  // 3. Build agent objects and add to world
  const agents = allSeeds.map(s => {
    const agent = buildAgent(s)
    addAgent(world, agent, 'pantheon')
    return agent
  })

  // 3.5. Assign phoneme-driven names
  nameAgents(graph, myth, agents, rng)

  // 4. Assign dispositions
  assignDispositions(graph, agents, rng)

  // 5. Generate titles
  generateTitles(graph, agents, rng)

  // 6. Assign relationships
  assignRelationships(graph, agents)

  // 7. Determine final states (cleanup pass)
  determineStates(agents, myth)

  // 8. Assign pronouns
  for (const agent of agents) {
    agent.pronouns = assignPronouns(agent, rng)
  }

  // 9. Collect tensions
  world.tensions = collectTensions(graph, agents)
}

// ── Pipeline steps ──

/**
 * Build an Agent from an AgentSeed, filling placeholder fields.
 * The id and origin are assigned later by addAgent().
 * @param {AgentSeed} s
 * @returns {Agent}
 */
export function buildAgent(s) {
  const primaryDomain = s.domains[0] ?? 'unknown'
  return {
    id: '',
    name: primaryDomain.charAt(0).toUpperCase() + primaryDomain.slice(1),
    title: '',
    type: s.type,
    domains: s.domains,
    disposition: '',
    relationships: [],
    mythRole: s.mythRole,
    alive: s.alive,
    state: s.state,
    origin: /** @type {const} */ ('pantheon'),
    worshippedBy: [],
    patronOf: [],
    pronouns: /** @type {const} */ ('they'),
  }
}

/**
 * Fill to MIN_AGENTS–MAX_AGENTS by walking from existing agent domains.
 * @param {ConceptGraph} graph
 * @param {AgentSeed[]} seeds
 * @param {CreationMyth} myth
 * @param {() => number} rng
 * @returns {AgentSeed[]}
 */
function deriveSecondaryAgents(graph, seeds, myth, rng) {
  const all = seeds.slice()
  if (all.length >= MAX_AGENTS) return all.slice(0, MAX_AGENTS)

  const usedDomains = new Set(all.flatMap(s => s.domains))

  // How many more do we need?
  const needed = Math.max(0, MIN_AGENTS - all.length)
  const maxMore = MAX_AGENTS - all.length
  const toDerive = Math.max(needed, Math.min(maxMore, 2))

  for (let i = 0; i < toDerive && all.length < MAX_AGENTS; i++) {
    // Pick a source: alternate between flaw concepts and primary agent domains
    const sources = i % 2 === 0
      ? myth.flaw.concepts.filter(c => !usedDomains.has(c))
      : myth.important.filter(c => !usedDomains.has(c))

    const source = sources.length > 0
      ? pick(rng, sources)
      : all.length > 0
        ? pick(rng, all).domains[0]
        : myth.worldAfter

    const chain = walkFrom(graph, rng, source, 2, { preferRelations: ['collides', 'transforms'] })
    const terminal = chain.path[chain.path.length - 1]

    if (usedDomains.has(terminal)) continue

    const nearby = query(graph).nearby(terminal, 1)
      .exclude(terminal, ...usedDomains).get().slice(0, 1)

    all.push({
      domains: [terminal, ...nearby],
      type: 'spirit',
      mythRole: 'derived',
      alive: true,
      state: 'active',
    })
    usedDomains.add(terminal)
    for (const n of nearby) usedDomains.add(n)
  }

  return all
}

/**
 * Assign dispositions from `evokes` edges of domain concepts.
 * @param {ConceptGraph} graph
 * @param {Agent[]} agents
 * @param {() => number} rng
 */
function assignDispositions(graph, agents, rng) {
  for (const agent of agents) {
    /** @type {string[]} */
    const evoked = []
    for (const domain of agent.domains) {
      for (const edge of graph.get(domain) ?? []) {
        if (edge.relation === 'evokes' && edge.direction === 'fwd') {
          evoked.push(edge.concept)
        }
      }
    }

    if (evoked.length > 0) {
      agent.disposition = pick(rng, evoked)
    } else {
      // Fallback: walk 1 hop and pick any abstract neighbor
      const nearby = query(graph).nearby(agent.domains[0], 1)
        .exclude(...agent.domains).get()
      agent.disposition = nearby.length > 0 ? pick(rng, nearby) : 'unknowable'
    }
  }
}

/**
 * Generate epithets from graph edges.
 * @param {ConceptGraph} graph
 * @param {Agent[]} agents
 * @param {() => number} rng
 */
function generateTitles(graph, agents, rng) {
  /** @type {Set<string>} */
  const usedTitles = new Set()

  for (const agent of agents) {
    const title = pickTitle(graph, agent, rng, usedTitles)
    agent.title = title
    usedTitles.add(title)
  }
}

/**
 * Pick a title for an agent, avoiding duplicates within the pantheon.
 * @param {ConceptGraph} graph
 * @param {Agent} agent
 * @param {() => number} rng
 * @param {Set<string>} usedTitles
 * @returns {string}
 */
function pickTitle(graph, agent, rng, usedTitles) {
  /** @type {(() => string)[]} */
  const generators = []

  // Pattern 1: "the [Disposition]"
  if (agent.disposition) {
    generators.push(() => {
      const d = agent.disposition
      return `the ${d.charAt(0).toUpperCase() + d.slice(1)}`
    })
  }

  // Pattern 2: "Who-[Verb]-in-[Domain]"
  const domain0 = agent.domains[0]
  for (const edge of graph.get(domain0) ?? []) {
    if (RELATION_VERBS[edge.relation]) {
      const verb = RELATION_VERBS[edge.relation]
      generators.push(() => `Who-${verb}-in-${edge.concept.charAt(0).toUpperCase() + edge.concept.slice(1)}`)
      break
    }
  }

  // Pattern 3: "[Adjective] of [Domain]"
  for (const edge of graph.get(domain0) ?? []) {
    if ((edge.relation === 'color' || edge.relation === 'texture') && edge.direction === 'fwd') {
      generators.push(() => `${edge.concept.charAt(0).toUpperCase() + edge.concept.slice(1)} of ${domain0.charAt(0).toUpperCase() + domain0.slice(1)}`)
      break
    }
  }

  // Pattern 4: "the [State-Participle]" for dead/transformed agents
  if (STATE_PARTICIPLES[agent.state]) {
    generators.push(() => `the ${STATE_PARTICIPLES[agent.state]}`)
  }

  // Try generators in random order until we get a unique one
  const shuffled = generators.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  for (const gen of shuffled) {
    const candidate = gen()
    if (!usedTitles.has(candidate)) return candidate
  }

  // Fallback: use a domain-based title
  const d1 = agent.domains[1] ?? agent.domains[0]
  return `of ${d1.charAt(0).toUpperCase() + d1.slice(1)}`
}

/**
 * Assign relationships by checking graph edges between agent domains.
 * @param {ConceptGraph} graph
 * @param {Agent[]} agents
 */
function assignRelationships(graph, agents) {
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const rel = findRelationship(graph, agents[i], agents[j])
      if (rel) {
        agents[i].relationships.push({ target: agents[j].id, kind: rel.kindIJ })
        agents[j].relationships.push({ target: agents[i].id, kind: rel.kindJI })
      }
    }
  }

  // Myth-derived: creator → derived = creator/ward
  for (let i = 0; i < agents.length; i++) {
    if (agents[i].mythRole !== 'creator') continue
    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue
      if (agents[j].mythRole === 'derived' || agents[j].mythRole === 'echo') {
        const alreadyLinked = agents[i].relationships.some(r => r.target === agents[j].id)
        if (!alreadyLinked) {
          agents[i].relationships.push({ target: agents[j].id, kind: 'creator' })
          agents[j].relationships.push({ target: agents[i].id, kind: 'ward' })
        }
      }
    }
  }
}

/**
 * Check graph edges between two agents' domains to find a relationship.
 * @param {ConceptGraph} graph
 * @param {Agent} a
 * @param {Agent} b
 * @returns {{ kindIJ: AgentRelationship['kind'], kindJI: AgentRelationship['kind'] } | null}
 */
function findRelationship(graph, a, b) {
  const domainsA = new Set(a.domains)
  const domainsB = new Set(b.domains)

  for (const domA of domainsA) {
    for (const edge of graph.get(domA) ?? []) {
      if (!domainsB.has(edge.concept)) continue

      if (edge.relation === 'collides') return { kindIJ: 'rival', kindJI: 'rival' }
      if (edge.relation === 'consumes' && edge.direction === 'fwd') return { kindIJ: 'slayer', kindJI: 'rival' }
      if (edge.relation === 'transforms' && edge.direction === 'fwd') return { kindIJ: 'parent', kindJI: 'ward' }
      if (edge.relation === 'produces' && edge.direction === 'fwd') return { kindIJ: 'parent', kindJI: 'ward' }
    }
  }

  // Check for shared `is` category → sibling
  const categoriesA = new Set()
  for (const domA of domainsA) {
    for (const edge of graph.get(domA) ?? []) {
      if (edge.relation === 'is' && edge.direction === 'fwd') categoriesA.add(edge.concept)
    }
  }
  for (const domB of domainsB) {
    for (const edge of graph.get(domB) ?? []) {
      if (edge.relation === 'is' && edge.direction === 'fwd' && categoriesA.has(edge.concept)) {
        return { kindIJ: 'sibling', kindJI: 'sibling' }
      }
    }
  }

  return null
}

/**
 * Final state cleanup pass.
 * @param {Agent[]} agents
 * @param {CreationMyth} myth
 */
function determineStates(agents, myth) {
  const costConcepts = new Set(myth.cost.concepts)
  const flawConcepts = new Set(myth.flaw.concepts)

  for (const agent of agents) {
    // If primary domain is in cost and agent isn't already dead → transformed
    if (costConcepts.has(agent.domains[0]) && agent.state === 'active') {
      agent.state = 'transformed'
    }

    // If primary domain is in flaw → annotate as flaw-bearer
    if (flawConcepts.has(agent.domains[0]) && agent.mythRole !== 'flaw-bearer') {
      agent.mythRole = agent.mythRole + '/flaw-bearer'
    }

    // Accident and corruption: no gods
    if (myth.recipe === 'accident' || myth.recipe === 'corruption') {
      if (agent.type === 'god') {
        agent.type = 'spirit'
      }
    }
  }
}

/**
 * Find concept-level tensions between agents (shared collides edges).
 * @param {ConceptGraph} graph
 * @param {Agent[]} agents
 * @returns {string[]}
 */
function collectTensions(graph, agents) {
  /** @type {Set<string>} */
  const tensions = new Set()

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      for (const domA of agents[i].domains) {
        for (const edge of graph.get(domA) ?? []) {
          if (edge.relation === 'collides' && agents[j].domains.includes(edge.concept)) {
            tensions.add(`${domA}:${edge.concept}`)
          }
        }
      }
    }
  }

  return [...tensions]
}
