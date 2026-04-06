/**
 * Event archetype functions for mythic history.
 * Each archetype populates a 4-beat MythicEvent from inherited concepts,
 * agent states, and graph walks.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { Agent } from './pantheon.js'
 * @import { MythicEvent, Region } from './history.js'
 */
import { query } from './query.js'
import { walkFrom } from './walker.js'
import { pick } from './utils.js'
import { findArena } from './queryHelpers.js'

// ── Event context passed to each archetype ──

/**
 * @typedef {{
 *   graph: ConceptGraph,
 *   rng: () => number,
 *   myth: CreationMyth,
 *   inheritedConcepts: string[],
 *   agents: Agent[],
 *   spawnedAgents: Agent[],
 *   regions: Region[],
 *   eventIndex: number,
 *   eventCount: number,
 *   previousEvents: MythicEvent[]
 * }} EventContext
 */

// ── Helpers ──

/**
 * Get all active agents from the array.
 * @param {Agent[]} agents
 * @returns {Agent[]}
 */
function activeAgents(agents) {
  return agents.filter(a => a.state === 'active' && a.alive)
}

/**
 * Find the index of an agent in the combined agent list.
 * @param {Agent[]} agents
 * @param {Agent[]} spawned
 * @param {Agent} agent
 * @returns {number}
 */
function agentIndex(agents, spawned, agent) {
  const idx = agents.indexOf(agent)
  if (idx >= 0) return idx
  const sIdx = spawned.indexOf(agent)
  return sIdx >= 0 ? agents.length + sIdx : 0
}

/**
 * Pick a concept from inherited pool that has collides edges with another.
 * Falls back to just picking from the pool.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} pool
 * @returns {string}
 */
function pickTensionConcept(graph, rng, pool) {
  for (const c of pool) {
    const edges = graph.get(c) ?? []
    if (edges.some(e => e.relation === 'collides')) return c
  }
  return pick(rng, pool)
}

/**
 * Collect all unique concepts from event beats.
 * @param {{ roles: Record<string, string>, concepts: string[] }} situation
 * @param {{ roles: Record<string, string>, concepts: string[] }} action
 * @param {{ roles: Record<string, string>, concepts: string[] }} consequence
 * @param {{ roles: Record<string, string>, concepts: string[] }} legacy
 * @returns {string[]}
 */
function collectEventConcepts(situation, action, consequence, legacy) {
  const set = new Set([
    ...Object.values(situation.roles),
    ...situation.concepts,
    ...Object.values(action.roles),
    ...action.concepts,
    ...Object.values(consequence.roles),
    ...consequence.concepts,
    ...Object.values(legacy.roles),
    ...legacy.concepts,
  ])
  return [...set]
}

// ── Archetype: War ──

/**
 * Two forces clash; a region is scarred, a people displaced.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function war(ctx) {
  const { graph, rng, agents, spawnedAgents, inheritedConcepts, eventIndex } = ctx
  const active = activeAgents([...agents, ...spawnedAgents])

  // Pick two agents — prefer those with rival relationships or opposing domains
  const agent1 = active.length > 0 ? pick(rng, active) : agents[0]
  let agent2 = active.length > 1
    ? pick(rng, active.filter(a => a !== agent1))
    : agents[Math.min(1, agents.length - 1)]

  // Ensure they're different
  if (agent1 === agent2 && agents.length > 1) {
    agent2 = agents.find(a => a !== agent1) ?? agents[0]
  }

  const arena = findArena(graph, rng, inheritedConcepts.slice(0, 5))
  const chain = walkFrom(graph, rng, agent1.domains[0], 3, { preferRelations: ['collides', 'consumes'] })
  const scarConcept = chain.path[chain.path.length - 1]

  const idx1 = agentIndex(agents, spawnedAgents, agent1)
  const idx2 = agentIndex(agents, spawnedAgents, agent2)
  const loserIdx = rng() < 0.5 ? idx1 : idx2
  const loser = loserIdx === idx1 ? agent1 : agent2
  const winner = loserIdx === idx1 ? agent2 : agent1

  const situation = {
    roles: { tension: agent1.domains[0], rival: agent2.domains[0], where: arena },
    concepts: [agent1.domains[0], agent2.domains[0], arena],
  }
  const action = {
    roles: { attacker: winner.name, defender: loser.name, weapon: scarConcept, arena },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { victor: winner.name, fallen: loser.name, scar: scarConcept },
    concepts: [scarConcept, arena, ...loser.domains.slice(0, 2)],
  }
  const legacy = {
    roles: { remembered: winner.name, mourned: loser.name },
    concepts: [winner.domains[0], loser.domains[0]],
  }

  const concepts = collectEventConcepts(situation, action, consequence, legacy)

  return {
    index: eventIndex,
    archetype: 'war',
    situation, action, consequence, legacy,
    agentChanges: [{
      agentIndex: loserIdx,
      newState: rng() < 0.6 ? 'dead' : 'exiled',
    }],
    regionTags: [],
    concepts,
    prose: '',
  }
}

// ── Archetype: Hubris ──

/**
 * Someone reaches beyond their station; ironic catastrophe.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function hubris(ctx) {
  const { graph, rng, agents, spawnedAgents, inheritedConcepts, eventIndex } = ctx
  const active = activeAgents([...agents, ...spawnedAgents])
  const actor = active.length > 0 ? pick(rng, active) : agents[0]

  const chain = walkFrom(graph, rng, actor.domains[0], 4, { preferRelations: ['consumes', 'transforms'] })
  const overreach = chain.path[chain.path.length - 1]
  const irony = chain.path.length > 2 ? chain.path[Math.floor(chain.path.length / 2)] : overreach

  const where = findArena(graph, rng, inheritedConcepts.slice(0, 5))
  const idx = agentIndex(agents, spawnedAgents, actor)

  const situation = {
    roles: { actor: actor.name, domain: actor.domains[0], ambition: overreach },
    concepts: [actor.domains[0], overreach],
  }
  const action = {
    roles: { actor: actor.name, target: overreach, where },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { fallen: actor.name, irony, scar: overreach },
    concepts: [overreach, irony, where],
  }
  const legacy = {
    roles: { warning: actor.name, lesson: irony },
    concepts: [actor.domains[0], irony],
  }

  return {
    index: eventIndex,
    archetype: 'hubris',
    situation, action, consequence, legacy,
    agentChanges: [{
      agentIndex: idx,
      newState: rng() < 0.5 ? 'imprisoned' : 'transformed',
    }],
    regionTags: [],
    concepts: collectEventConcepts(situation, action, consequence, legacy),
    prose: '',
  }
}

// ── Archetype: Exodus ──

/**
 * A people flee; they transform the new region and haunt the old one.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function exodus(ctx) {
  const { graph, rng, agents, spawnedAgents, inheritedConcepts, eventIndex } = ctx
  const active = activeAgents([...agents, ...spawnedAgents])
  const migrant = active.length > 0 ? pick(rng, active) : agents[0]

  const threat = pickTensionConcept(graph, rng, inheritedConcepts)
  const origin = findArena(graph, rng, [threat])
  const chain = walkFrom(graph, rng, migrant.domains[0], 3, { preferRelations: ['transforms', 'produces'] })
  const destination = chain.path[chain.path.length - 1]

  const idx = agentIndex(agents, spawnedAgents, migrant)

  const situation = {
    roles: { threat, origin, who: migrant.name },
    concepts: [threat, origin, migrant.domains[0]],
  }
  const action = {
    roles: { migrant: migrant.name, from: origin, to: destination },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { desolation: origin, settlement: destination, wanderer: migrant.name },
    concepts: [origin, destination, ...chain.path.slice(1)],
  }
  const legacy = {
    roles: { longing: origin, home: destination },
    concepts: [origin, destination],
  }

  return {
    index: eventIndex,
    archetype: 'exodus',
    situation, action, consequence, legacy,
    agentChanges: [{
      agentIndex: idx,
      newState: 'exiled',
    }],
    regionTags: [],
    concepts: collectEventConcepts(situation, action, consequence, legacy),
    prose: '',
  }
}

// ── Archetype: Discovery ──

/**
 * Something buried is found; changes the power balance.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function discovery(ctx) {
  const { graph, rng, agents, spawnedAgents, myth, eventIndex } = ctx
  const active = activeAgents([...agents, ...spawnedAgents])
  const finder = active.length > 0 ? pick(rng, active) : agents[0]

  // Walk from the flaw to find something hidden
  const flawConcept = myth.flaw.concepts.length > 0 ? pick(rng, myth.flaw.concepts) : myth.worldAfter
  const chain = walkFrom(graph, rng, flawConcept, 3, { preferRelations: ['produces', 'transforms'] })
  const found = chain.path[chain.path.length - 1]

  const where = findArena(graph, rng, [flawConcept])

  const situation = {
    roles: { seeker: finder.name, hidden: flawConcept, where },
    concepts: [flawConcept, where],
  }
  const action = {
    roles: { finder: finder.name, discovery: found, where },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { power: found, holder: finder.name },
    concepts: [found, where, finder.domains[0]],
  }
  const legacy = {
    roles: { treasure: found, guardian: finder.name },
    concepts: [found, finder.domains[0]],
  }

  return {
    index: eventIndex,
    archetype: 'discovery',
    situation, action, consequence, legacy,
    agentChanges: [],
    regionTags: [],
    concepts: collectEventConcepts(situation, action, consequence, legacy),
    prose: '',
  }
}

// ── Archetype: Sacrifice ──

/**
 * Someone gives up something essential to hold the world together.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function sacrifice(ctx) {
  const { graph, rng, agents, spawnedAgents, inheritedConcepts, eventIndex } = ctx
  const active = activeAgents([...agents, ...spawnedAgents])
  const martyr = active.length > 0 ? pick(rng, active) : agents[0]

  const threat = pickTensionConcept(graph, rng, inheritedConcepts)
  const chain = walkFrom(graph, rng, martyr.domains[0], 3, { preferRelations: ['transforms', 'evokes'] })
  const remnant = chain.path[chain.path.length - 1]

  const idx = agentIndex(agents, spawnedAgents, martyr)

  const situation = {
    roles: { threat, defender: martyr.name, stakes: martyr.domains[0] },
    concepts: [threat, martyr.domains[0]],
  }
  const action = {
    roles: { martyr: martyr.name, sacrificed: martyr.domains[0], remnant },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { loss: martyr.name, remains: remnant, peace: threat },
    concepts: [remnant, threat, ...martyr.domains.slice(0, 2)],
  }
  const legacy = {
    roles: { venerated: martyr.name, relic: remnant },
    concepts: [martyr.domains[0], remnant],
  }

  return {
    index: eventIndex,
    archetype: 'sacrifice',
    situation, action, consequence, legacy,
    agentChanges: [{
      agentIndex: idx,
      newState: rng() < 0.5 ? 'dead' : 'transformed',
    }],
    regionTags: [],
    concepts: collectEventConcepts(situation, action, consequence, legacy),
    prose: '',
  }
}

// ── Archetype: Corruption ──

/**
 * Something good is slowly perverted.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function corruption(ctx) {
  const { graph, rng, agents, spawnedAgents, myth, eventIndex } = ctx
  const active = activeAgents([...agents, ...spawnedAgents])
  const victim = active.length > 0 ? pick(rng, active) : agents[0]

  const flawConcept = myth.flaw.concepts.length > 0 ? pick(rng, myth.flaw.concepts) : myth.worldAfter
  const chain = walkFrom(graph, rng, flawConcept, 3, { preferRelations: ['transforms', 'consumes'] })
  const taint = chain.path[chain.path.length - 1]

  const idx = agentIndex(agents, spawnedAgents, victim)

  const situation = {
    roles: { source: flawConcept, target: victim.name, purity: victim.domains[0] },
    concepts: [flawConcept, victim.domains[0]],
  }
  const action = {
    roles: { corruption: flawConcept, victim: victim.name, taint },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { corrupted: victim.name, taint, lost: victim.domains[0] },
    concepts: [taint, victim.domains[0], flawConcept],
  }
  const legacy = {
    roles: { distrust: taint, memory: victim.domains[0] },
    concepts: [taint, victim.domains[0]],
  }

  return {
    index: eventIndex,
    archetype: 'corruption',
    situation, action, consequence, legacy,
    agentChanges: [{
      agentIndex: idx,
      newState: 'transformed',
      newType: victim.type === 'god' ? 'demon' : undefined,
    }],
    regionTags: [],
    concepts: collectEventConcepts(situation, action, consequence, legacy),
    prose: '',
  }
}

// ── Archetype: Sundering ──

/**
 * A unity breaks; one culture becomes two with incompatible memories.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function sundering(ctx) {
  const { graph, rng, agents, spawnedAgents, eventIndex } = ctx
  const active = activeAgents([...agents, ...spawnedAgents])
  const original = active.length > 0 ? pick(rng, active) : agents[0]

  // Walk to find what the split produces
  const chain = walkFrom(graph, rng, original.domains[0], 3, { preferRelations: ['transforms', 'produces'] })
  const fragment = chain.path[chain.path.length - 1]

  // Secondary domain for the spawned agent
  const nearby = query(graph).nearby(fragment, 1).exclude(original.domains[0], fragment).get()
  const secondDomain = nearby.length > 0 ? pick(rng, nearby) : fragment

  const idx = agentIndex(agents, spawnedAgents, original)

  const situation = {
    roles: { unity: original.name, tension: original.domains[0] },
    concepts: [original.domains[0]],
  }
  const action = {
    roles: { broken: original.name, fragment },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { side1: original.name, side2: fragment, scar: chain.path[Math.floor(chain.path.length / 2)] },
    concepts: [fragment, secondDomain, ...chain.path.slice(1)],
  }
  const legacy = {
    roles: { schism: original.domains[0], other: fragment },
    concepts: [original.domains[0], fragment],
  }

  return {
    index: eventIndex,
    archetype: 'sundering',
    situation, action, consequence, legacy,
    agentChanges: [{
      agentIndex: idx,
      spawned: {
        domains: [fragment, secondDomain],
        type: original.type === 'god' ? 'demi-god' : 'spirit',
        mythRole: 'splinter',
        alive: true,
        state: 'active',
      },
    }],
    regionTags: [],
    concepts: collectEventConcepts(situation, action, consequence, legacy),
    prose: '',
  }
}

// ── Archetype: Return ──

/**
 * Something from the creation myth resurfaces; the flaw manifests physically.
 * @param {EventContext} ctx
 * @returns {MythicEvent}
 */
function returnArchetype(ctx) {
  const { graph, rng, agents, spawnedAgents, myth, eventIndex } = ctx

  const flawConcept = myth.flaw.concepts.length > 0 ? pick(rng, myth.flaw.concepts) : myth.worldAfter
  const chain = walkFrom(graph, rng, flawConcept, 3, { preferRelations: ['produces', 'transforms'] })
  const manifestation = chain.path[chain.path.length - 1]

  // Try to find a sleeping/forgotten agent to reawaken
  const dormant = [...agents, ...spawnedAgents].filter(
    a => a.state === 'sleeping' || a.state === 'forgotten' || a.state === 'imprisoned'
  )
  const reawakened = dormant.length > 0 ? pick(rng, dormant) : null

  const where = findArena(graph, rng, [flawConcept])

  /** @type {import('./history.js').AgentChange[]} */
  const changes = []

  if (reawakened) {
    changes.push({
      agentIndex: agentIndex(agents, spawnedAgents, reawakened),
      newState: 'active',
    })
  }

  // Spawn a demon of the returned flaw
  const nearby = query(graph).nearby(manifestation, 1).exclude(flawConcept, manifestation).get()
  const demonDomain = nearby.length > 0 ? pick(rng, nearby) : manifestation
  changes.push({
    agentIndex: 0,
    spawned: {
      domains: [manifestation, demonDomain],
      type: 'demon',
      mythRole: 'returned-flaw',
      alive: true,
      state: 'active',
    },
  })

  const situation = {
    roles: { flaw: flawConcept, where, omen: manifestation },
    concepts: [flawConcept, where],
  }
  const action = {
    roles: { returned: flawConcept, manifestation, where },
    concepts: [...chain.path],
  }
  const consequence = {
    roles: { scar: manifestation, dread: flawConcept },
    concepts: [manifestation, where, flawConcept],
  }
  const legacy = {
    roles: { prophecy: flawConcept, sign: manifestation },
    concepts: [flawConcept, manifestation],
  }

  return {
    index: eventIndex,
    archetype: 'return',
    situation, action, consequence, legacy,
    agentChanges: changes,
    regionTags: [],
    concepts: collectEventConcepts(situation, action, consequence, legacy),
    prose: '',
  }
}

// ── Registry ──

/** @type {Record<string, (ctx: EventContext) => MythicEvent>} */
export const ARCHETYPES = {
  war,
  hubris,
  exodus,
  discovery,
  sacrifice,
  corruption,
  sundering,
  return: returnArchetype,
}

/** All archetype names. */
export const ARCHETYPE_NAMES = /** @type {string[]} */ (Object.keys(ARCHETYPES))
