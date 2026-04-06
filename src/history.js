/**
 * Mythic History generator — Layer 3.
 * Generates 5-8 historical events that bridge the creation myth to
 * regionally-distinct geography. Each event inherits concepts from
 * previous events, mutates pantheon agents, and tags spatial regions
 * with concept clusters.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth, BeatRoles } from './recipes/index.js'
 * @import { Agent, AgentSeed, AgentRelationship, Pantheon } from './pantheon.js'
 */
import { pick, weightedPick } from './utils.js'
import { query } from './query.js'
import { buildAgent } from './pantheon.js'
import { nameAgents, nameRegion } from './naming.js'
import { renderEventProse } from './historyProse.js'
import { ARCHETYPES, ARCHETYPE_NAMES } from './historyArchetypes.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   agentIndex: number,
 *   newState?: Agent['state'],
 *   newType?: Agent['type'],
 *   newRelationships?: AgentRelationship[],
 *   spawned?: AgentSeed
 * }} AgentChange
 */

/**
 * @typedef {{
 *   index: number,
 *   archetype: string,
 *   situation: { roles: BeatRoles, concepts: string[] },
 *   action: { roles: BeatRoles, concepts: string[] },
 *   consequence: { roles: BeatRoles, concepts: string[] },
 *   legacy: { roles: BeatRoles, concepts: string[] },
 *   agentChanges: AgentChange[],
 *   regionTags: string[],
 *   concepts: string[],
 *   prose: string
 * }} MythicEvent
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   concepts: string[],
 *   taggedBy: number[],
 *   primaryEvent: number
 * }} Region
 */

/**
 * @typedef {{
 *   events: MythicEvent[],
 *   regions: Region[],
 *   agents: Agent[],
 *   spawnedAgents: Agent[]
 * }} MythicHistory
 */

// ── Archetype sequence weights by event position ──

/**
 * Position-based weights for archetype selection.
 * Each row: [war, hubris, exodus, discovery, sacrifice, corruption, sundering, return]
 * @type {number[][]}
 */
const POSITION_WEIGHTS = [
  [4, 3, 1, 1, 1, 3, 1, 4], // Event 0: consequence of flaw
  [1, 3, 1, 4, 4, 1, 1, 1], // Event 1: attempt to fix/exploit
  [4, 1, 4, 1, 1, 1, 4, 1], // Event 2: catastrophe
  [1, 1, 4, 2, 1, 3, 2, 4], // Event 3: recent/echoing
  [1, 1, 3, 3, 1, 3, 2, 4], // Event 4: present tensions
  [3, 1, 3, 1, 3, 1, 3, 1], // Event 5: aftermath
  [1, 3, 1, 3, 1, 3, 1, 3], // Event 6: deepening
  [1, 1, 1, 1, 1, 1, 1, 4], // Event 7: echo of the flaw
]

// ── Main entry ──

/**
 * Generate mythic history from a creation myth and pantheon.
 * @param {ConceptGraph} graph
 * @param {CreationMyth} myth
 * @param {Pantheon} pantheon
 * @param {() => number} rng
 * @returns {MythicHistory}
 */
export function generateHistory(graph, myth, pantheon, rng) {
  // Clone agents — never mutate originals
  const agents = pantheon.agents.map(a => /** @type {Agent} */ ({
    ...a,
    domains: [...a.domains],
    relationships: a.relationships.map(r => ({ ...r })),
  }))

  /** @type {Agent[]} */
  const spawnedAgents = []

  // Seed concept pool from creation myth
  const inheritedConcepts = [
    ...myth.before.concepts,
    ...myth.act.concepts,
    ...myth.cost.concepts,
    ...myth.flaw.concepts,
    ...myth.important,
    ...myth.bad,
    ...myth.ingredients,
  ]
  // Deduplicate
  const conceptSet = new Set(inheritedConcepts)

  // Determine event count: 5-8
  const eventCount = 5 + Math.floor(rng() * 4)

  // Pick archetype sequence (no repeats)
  const archetypeSequence = pickArchetypeSequence(rng, eventCount)

  /** @type {MythicEvent[]} */
  const events = []
  /** @type {Region[]} */
  const regions = []

  // Event loop
  for (let i = 0; i < eventCount; i++) {
    const archetype = archetypeSequence[i]
    const archetypeFn = ARCHETYPES[archetype]

    const event = archetypeFn({
      graph,
      rng,
      myth,
      inheritedConcepts: [...conceptSet],
      agents,
      spawnedAgents,
      regions,
      eventIndex: i,
      eventCount,
      previousEvents: events,
    })

    // Apply agent mutations
    applyAgentChanges(agents, spawnedAgents, event.agentChanges)

    // Create regions from event consequence concepts
    const newRegions = createRegions(graph, rng, event, regions.length)
    for (const region of newRegions) {
      regions.push(region)
      event.regionTags.push(region.id)
    }

    // For corruption and return, also tag an existing region if available
    if ((archetype === 'corruption' || archetype === 'return') && regions.length > newRegions.length) {
      const existingRegions = regions.filter(r => !newRegions.includes(r))
      const target = pick(rng, existingRegions)
      // Add some of the event's concepts to the existing region
      const toAdd = event.concepts.slice(0, 3).filter(c => !target.concepts.includes(c))
      target.concepts.push(...toAdd)
      target.taggedBy.push(i)
      if (!event.regionTags.includes(target.id)) {
        event.regionTags.push(target.id)
      }
    }

    // Append event concepts to inherited pool
    for (const c of event.concepts) conceptSet.add(c)

    events.push(event)
  }

  // Name regions using their concept clusters
  /** @type {Set<string>} */
  const usedRegionNames = new Set()
  for (const region of regions) {
    region.name = nameRegion(graph, region.concepts, rng, usedRegionNames)
  }

  // Name spawned agents using the naming system
  if (spawnedAgents.length > 0) {
    nameAgents(graph, myth, spawnedAgents, rng)
  }

  // Render prose for each event
  for (const event of events) {
    const { prose } = renderEventProse(event, graph, rng)
    event.prose = prose
  }

  return { events, regions, agents, spawnedAgents }
}

// ── Internal helpers ──

/**
 * Pick a non-repeating archetype sequence using position weights.
 * @param {() => number} rng
 * @param {number} count
 * @returns {string[]}
 */
function pickArchetypeSequence(rng, count) {
  const available = ARCHETYPE_NAMES.slice()
  /** @type {string[]} */
  const sequence = []

  for (let i = 0; i < count; i++) {
    const positionIdx = Math.min(i, POSITION_WEIGHTS.length - 1)
    const baseWeights = POSITION_WEIGHTS[positionIdx]

    // Build weights for remaining archetypes
    const weights = available.map(name => {
      const originalIdx = ARCHETYPE_NAMES.indexOf(name)
      return baseWeights[originalIdx] ?? 1
    })

    const picked = weightedPick(rng, available, weights)
    sequence.push(picked)
    available.splice(available.indexOf(picked), 1)
  }

  return sequence
}

/**
 * Apply agent changes from an event.
 * @param {Agent[]} agents
 * @param {Agent[]} spawnedAgents
 * @param {import('./history.js').AgentChange[]} changes
 */
function applyAgentChanges(agents, spawnedAgents, changes) {
  for (const change of changes) {
    // Handle spawned agents
    if (change.spawned) {
      const newAgent = buildAgent(change.spawned)
      spawnedAgents.push(newAgent)
    }

    // Apply state/type changes to existing agents
    const allAgents = [...agents, ...spawnedAgents]
    const agent = allAgents[change.agentIndex]
    if (!agent) continue

    if (change.newState) {
      agent.state = change.newState
      if (change.newState === 'dead') agent.alive = false
    }
    if (change.newType) agent.type = change.newType
    if (change.newRelationships) {
      agent.relationships.push(...change.newRelationships)
    }
  }
}

/**
 * Create 1-2 regions from an event's consequence concepts.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {MythicEvent} event
 * @param {number} regionCount — existing region count (for ID generation)
 * @returns {Region[]}
 */
function createRegions(graph, rng, event, regionCount) {
  const consequenceConcepts = event.consequence.concepts.length > 0
    ? event.consequence.concepts
    : event.concepts.slice(0, 3)

  // Expand cluster: walk 1-hop via evokes/rhymes from consequence concepts
  const cluster = new Set(consequenceConcepts)
  for (const c of consequenceConcepts) {
    const neighbors = query(graph).nearby(c, 1).exclude(...consequenceConcepts).get()
    for (const n of neighbors.slice(0, 2)) {
      cluster.add(n)
    }
  }

  const concepts = [...cluster].slice(0, 10)

  /** @type {Region[]} */
  const regions = []

  // Always create at least one region
  regions.push({
    id: `region-${regionCount}`,
    name: '',
    concepts: concepts.slice(0, Math.ceil(concepts.length * 0.7)),
    taggedBy: [event.index],
    primaryEvent: event.index,
  })

  // Exodus and sundering create a second region
  if ((event.archetype === 'exodus' || event.archetype === 'sundering') && concepts.length >= 4) {
    // Second region gets different concepts — the "other side"
    const secondConcepts = concepts.slice(Math.floor(concepts.length * 0.4))
    regions.push({
      id: `region-${regionCount + 1}`,
      name: '',
      concepts: secondConcepts,
      taggedBy: [event.index],
      primaryEvent: event.index,
    })
  }

  return regions
}
