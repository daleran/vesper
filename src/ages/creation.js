/**
 * Age of Creation — wraps existing myth, pantheon, and physical-world
 * generation functions, then emits WorldEvents post-hoc from their results.
 *
 * Strategy: call every existing generator with the same RNG seeds as
 * before, so world data is identical. Then walk the results and create
 * timeline events as a parallel structured representation.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { World } from '../world.js'
 * @import { WorldEvent } from '../timeline.js'
 */
import { generateMyth } from '../myth.js'
import { generatePantheon } from '../pantheon.js'
import { generateHistory } from '../history.js'
import { generateGeogony } from '../geogony.js'
import { generateBiogony } from '../biogony.js'
import { generateAnthropogony } from '../anthropogony.js'
import { buildMorphemeTable } from '../naming.js'
import { mulberry32, hashSeed } from '../utils.js'
import {
  addEvent,
  advanceAge,
  makeEventId,
  emptyBeats,
  emptyBeat,
  eventFromMythicEvent,
} from '../timeline.js'

// ── Internal helpers ──

/**
 * Emit the four creation-myth beats as WorldEvents.
 * @param {World} world
 */
function emitMythEvents(world) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const myth = /** @type {import('../recipes/index.js').CreationMyth} */ (world.myth)

  // primordial-state  (epoch 0)
  addEvent(timeline, {
    id: makeEventId('creation', 0, 0),
    age: 'creation',
    epoch: 0,
    archetype: 'primordial-state',
    beats: { situation: myth.before, action: emptyBeat(), consequence: emptyBeat(), legacy: emptyBeat() },
    concepts: myth.before.concepts,
    participants: [],
    mutations: [],
    spawns: [],
    causedBy: [],
    tags: ['mythic', 'primordial'],
  })

  // creation-act  (epoch 1)
  addEvent(timeline, {
    id: makeEventId('creation', 1, 0),
    age: 'creation',
    epoch: 1,
    archetype: 'creation-act',
    beats: { situation: emptyBeat(), action: myth.act, consequence: emptyBeat(), legacy: emptyBeat() },
    concepts: myth.act.concepts,
    participants: myth.creators,
    mutations: [],
    spawns: [],
    causedBy: [makeEventId('creation', 0, 0)],
    tags: ['mythic', 'divine'],
  })

  // creation-cost  (epoch 2)
  addEvent(timeline, {
    id: makeEventId('creation', 2, 0),
    age: 'creation',
    epoch: 2,
    archetype: 'creation-cost',
    beats: { situation: emptyBeat(), action: emptyBeat(), consequence: myth.cost, legacy: emptyBeat() },
    concepts: myth.cost.concepts,
    participants: [],
    mutations: [],
    spawns: [],
    causedBy: [makeEventId('creation', 1, 0)],
    tags: ['mythic'],
  })

  // flaw-emergence  (epoch 3)
  addEvent(timeline, {
    id: makeEventId('creation', 3, 0),
    age: 'creation',
    epoch: 3,
    archetype: 'flaw-emergence',
    beats: { situation: emptyBeat(), action: emptyBeat(), consequence: emptyBeat(), legacy: myth.flaw },
    concepts: myth.flaw.concepts,
    participants: [],
    mutations: [],
    spawns: [],
    causedBy: [makeEventId('creation', 2, 0)],
    tags: ['mythic', 'flaw'],
  })
}

/**
 * Emit divine-birth events for each agent created by the pantheon generator.
 * @param {World} world
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitPantheonEvents(world, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  let epoch = epochStart
  const creationActId = makeEventId('creation', 1, 0)

  const pantheonAgents = world.agents.filter(a => a.origin === 'pantheon')

  for (const agent of pantheonAgents) {
    /** @type {WorldEvent} */
    const evt = {
      id: makeEventId('creation', epoch, 0),
      age: 'creation',
      epoch,
      archetype: 'divine-birth',
      beats: emptyBeats(),
      concepts: agent.domains,
      participants: [agent.id],
      mutations: [],
      spawns: [{ entityType: 'agent', entityData: agent, assignedId: agent.id }],
      causedBy: [creationActId],
      tags: ['divine', 'pantheon'],
    }
    addEvent(timeline, evt)
    epoch++
  }

  // Emit relationship events (divine-bond) — one per unique pair with a relationship
  const seenPairs = new Set()
  for (const agent of pantheonAgents) {
    for (const rel of agent.relationships) {
      const key = [agent.id, rel.target].sort().join(':')
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      addEvent(timeline, {
        id: makeEventId('creation', epoch, 0),
        age: 'creation',
        epoch,
        archetype: 'divine-bond',
        beats: emptyBeats(),
        concepts: [],
        participants: [agent.id, rel.target],
        mutations: [],
        spawns: [],
        causedBy: [makeEventId('creation', 1, 0)],
        tags: ['divine', 'relationship'],
      })
      epoch++
    }
  }

  return epoch
}

/**
 * Emit WorldEvents for each MythicEvent from generateHistory.
 * @param {World} world
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitHistoryEvents(world, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const flawEventId = makeEventId('creation', 3, 0)
  let epoch = epochStart

  for (let i = 0; i < world.events.length; i++) {
    const mythicEvent = world.events[i]
    const causedById = i === 0 ? flawEventId : makeEventId('creation', epoch - 1, 0)
    const worldEvent = eventFromMythicEvent(mythicEvent, epoch, causedById)
    worldEvent.id = makeEventId('creation', epoch, 0)

    // Fix up spawns — find the agents that were actually created during history
    // by matching spawned seeds to agents with origin='history'
    const historyAgents = world.agents.filter(a => a.origin === 'history')
    for (const spawn of worldEvent.spawns) {
      if (spawn.entityType === 'agent') {
        // Match by domain overlap with the seed's domains
        const seed = /** @type {import('../pantheon.js').AgentSeed} */ (spawn.entityData)
        const match = historyAgents.find(a =>
          a.domains.length > 0 && seed.domains && seed.domains[0] === a.domains[0]
        )
        if (match) spawn.assignedId = match.id
      }
    }

    addEvent(timeline, worldEvent)
    epoch++
  }

  return epoch
}

/**
 * Emit WorldEvents for geogony results (world-shaped, landmark-created, spirit-born).
 * @param {World} world
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitGeogonyEvents(world, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const geogony = world.geogony
  if (!geogony) return epochStart

  let epoch = epochStart
  const worldShapedId = makeEventId('creation', epoch, 0)

  // world-shaped — the primary terrain formation event
  const terrainSpawns = geogony.terrainTypes.map(t => ({
    entityType: 'terrain',
    entityData: t,
    assignedId: t.id,
  }))

  addEvent(timeline, {
    id: worldShapedId,
    age: 'creation',
    epoch,
    archetype: 'world-shaped',
    beats: emptyBeats(),
    concepts: [geogony.groundSubstance, geogony.waterSubstance, geogony.skySubstance].filter(Boolean),
    participants: geogony.causingAgentId ? [geogony.causingAgentId] : [],
    mutations: [],
    spawns: terrainSpawns,
    causedBy: [makeEventId('creation', 1, 0)],  // caused by creation-act
    tags: ['natural', 'formation'],
  })
  epoch++

  // landmark-created — one event per landmark
  for (const landmark of geogony.landmarks) {
    addEvent(timeline, {
      id: makeEventId('creation', epoch, 0),
      age: 'creation',
      epoch,
      archetype: 'landmark-created',
      beats: emptyBeats(),
      concepts: landmark.concepts,
      participants: landmark.agentId ? [landmark.agentId] : [],
      mutations: [],
      spawns: [{ entityType: 'landmark', entityData: landmark, assignedId: landmark.id }],
      causedBy: [worldShapedId],
      tags: ['natural', 'landmark'],
    })
    epoch++
  }

  // spirit-born — landscape agents
  const landscapeAgents = world.agents.filter(a => a.origin === 'landscape')
  for (const agent of landscapeAgents) {
    addEvent(timeline, {
      id: makeEventId('creation', epoch, 0),
      age: 'creation',
      epoch,
      archetype: 'spirit-born',
      beats: emptyBeats(),
      concepts: agent.domains,
      participants: [agent.id],
      mutations: [],
      spawns: [{ entityType: 'agent', entityData: agent, assignedId: agent.id }],
      causedBy: [worldShapedId],
      tags: ['natural', 'divine'],
    })
    epoch++
  }

  return epoch
}

/**
 * Emit WorldEvents for biogony results (life-emerges, flaw-life).
 * @param {World} world
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitBiogonyEvents(world, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const biogony = world.biogony
  if (!biogony) return epochStart

  let epoch = epochStart
  const creationActId = makeEventId('creation', 1, 0)
  const flawId = makeEventId('creation', 3, 0)
  const flawLifeNames = new Set(biogony.flawLife.map(l => l.name))

  for (const lifeform of biogony.lifeforms) {
    const isFlaw = flawLifeNames.has(lifeform.name)
    addEvent(timeline, {
      id: makeEventId('creation', epoch, 0),
      age: 'creation',
      epoch,
      archetype: isFlaw ? 'flaw-life-emerges' : 'life-emerges',
      beats: emptyBeats(),
      concepts: lifeform.concepts,
      participants: biogony.lifeOriginAgent ? [biogony.lifeOriginAgent] : [],
      mutations: [],
      spawns: [{ entityType: 'lifeform', entityData: lifeform, assignedId: lifeform.id }],
      causedBy: [isFlaw ? flawId : creationActId],
      tags: ['natural', 'life'],
    })
    epoch++
  }

  return epoch
}

/**
 * Emit WorldEvents for anthropogony results (people-created).
 * @param {World} world
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitAnthropogonyEvents(world, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const anthropogony = world.anthropogony
  if (!anthropogony) return epochStart

  let epoch = epochStart
  const creationActId = makeEventId('creation', 1, 0)

  for (const people of anthropogony.peoples) {
    const participants = []
    if (people.creatorAgent) participants.push(people.creatorAgent)
    if (people.patronAgent && people.patronAgent !== people.creatorAgent) {
      participants.push(people.patronAgent)
    }

    addEvent(timeline, {
      id: makeEventId('creation', epoch, 0),
      age: 'creation',
      epoch,
      archetype: 'people-created',
      beats: emptyBeats(),
      concepts: people.concepts,
      participants,
      mutations: [],
      spawns: [{ entityType: 'people', entityData: people, assignedId: people.id }],
      causedBy: [creationActId],
      tags: ['people', 'creation'],
    })
    epoch++
  }

  return epoch
}

// ── Main entry ──

/**
 * Simulate the Age of Creation.
 *
 * Calls each existing generator with the same seed suffixes as the old
 * buildWorld() — so all typed World slots are populated identically.
 * Then walks the results and emits WorldEvents onto world.timeline.
 *
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {string} seed
 * @param {string} [forceRecipe]
 */
export function simulateCreation(graph, world, seed, forceRecipe) {
  // ── 1. Myth ──
  world.myth = generateMyth(graph, seed, forceRecipe)
  emitMythEvents(world)

  // ── 2. Pantheon ──
  generatePantheon(graph, world, mulberry32(hashSeed(seed + '-pantheon')))
  const epochAfterPantheon = emitPantheonEvents(world, 4)

  // ── 3. Morpheme table (no event) ──
  world.morphemes = buildMorphemeTable(graph, world.myth, mulberry32(hashSeed(seed + '-language')))

  // ── 4. History ──
  generateHistory(graph, world, mulberry32(hashSeed(seed + '-history')))
  const epochAfterHistory = emitHistoryEvents(world, epochAfterPantheon)

  // ── 5. Geogony ──
  generateGeogony(graph, world, mulberry32(hashSeed(seed + '-geogony')))
  const epochAfterGeogony = emitGeogonyEvents(world, epochAfterHistory)

  // ── 6. Biogony ──
  generateBiogony(graph, world, mulberry32(hashSeed(seed + '-biogony')))
  const epochAfterBiogony = emitBiogonyEvents(world, epochAfterGeogony)

  // ── 7. Anthropogony ──
  generateAnthropogony(graph, world, mulberry32(hashSeed(seed + '-anthropogony')))
  emitAnthropogonyEvents(world, epochAfterBiogony)

  // ── 8. Advance age ──
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  advanceAge(timeline, 'heroes')
}
