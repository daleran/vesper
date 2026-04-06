/**
 * Mythic History generator — generates 5-8 historical events that
 * bridge the creation myth to regionally-distinct geography.
 * Mutates agents in world.agents directly and pushes spawned agents
 * into the same array. Events and regions are added to the world.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth, BeatRoles } from './recipes/index.js'
 * @import { Agent, AgentSeed, AgentRelationship } from './pantheon.js'
 * @import { World } from './world.js'
 */
import { pick, weightedPick } from './utils.js'
import { query } from './query.js'
import { buildAgent } from './pantheon.js'
import { nameAgents, nameRegion } from './naming.js'
import { addAgent } from './world.js'
import { ARCHETYPES, ARCHETYPE_NAMES } from './historyArchetypes.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   agentId: string,
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
 *   concepts: string[]
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
 * Generate mythic history and write events, regions, and agent
 * mutations into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateHistory(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)

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

  // Track agents spawned during history for naming at the end
  /** @type {Agent[]} */
  const spawnedDuringHistory = []

  // Event loop
  for (let i = 0; i < eventCount; i++) {
    const archetype = archetypeSequence[i]
    const archetypeFn = ARCHETYPES[archetype]

    const event = archetypeFn({
      graph,
      rng,
      myth,
      inheritedConcepts: [...conceptSet],
      world,
      eventIndex: i,
      eventCount,
    })

    // Apply agent mutations
    applyAgentChanges(world, event.agentChanges, spawnedDuringHistory)

    // Create regions from event consequence concepts
    const newRegions = createRegions(graph, rng, event, world.regions.length)
    for (const region of newRegions) {
      world.regions.push(region)
      event.regionTags.push(region.id)
    }

    // For corruption and return, also tag an existing region if available
    if ((archetype === 'corruption' || archetype === 'return') && world.regions.length > newRegions.length) {
      const existingRegions = world.regions.filter(r => !newRegions.includes(r))
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

    world.events.push(event)
  }

  // Name regions using their concept clusters
  /** @type {Set<string>} */
  const usedRegionNames = new Set()
  for (const region of world.regions) {
    region.name = nameRegion(graph, region.concepts, rng, usedRegionNames)
  }

  // Name agents spawned during history
  if (spawnedDuringHistory.length > 0) {
    nameAgents(graph, myth, spawnedDuringHistory, rng)
  }
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
 * @param {World} world
 * @param {AgentChange[]} changes
 * @param {Agent[]} spawnedDuringHistory — tracking array for naming
 */
function applyAgentChanges(world, changes, spawnedDuringHistory) {
  for (const change of changes) {
    // Handle spawned agents
    if (change.spawned) {
      const newAgent = buildAgent(change.spawned)
      addAgent(world, newAgent, 'history')
      spawnedDuringHistory.push(newAgent)
    }

    // Apply state/type changes to existing agents
    const agent = world.agents.find(a => a.id === change.agentId)
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
