/**
 * Current Age — calls existing present, artifacts, and character generators,
 * plus all renderers, then emits WorldEvents post-hoc from their results.
 *
 * Strategy: identical to creation.js and heroes.js — call generators with
 * the same RNG seeds, then walk the results and create timeline events as
 * a parallel structured causal representation.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { World } from '../world.js'
 */
import { generateArtifacts } from '../artifacts.js'
import { generateCharacter } from '../character.js'
import { generateMythTexts } from '../renderers/mythTexts.js'
import { renderLandmarks } from '../renderers/landmarks.js'
import { renderRegions } from '../renderers/regions.js'
import { mulberry32, hashSeed } from '../utils.js'
import {
  addEvent,
  makeEventId,
  emptyBeats,
} from '../timeline.js'
import {
  selectArchetype,
  findFlawTouchedEvents,
  buildHiddenTruth,
  buildCrisis,
  buildFactions,
  buildRecentEvent,
  buildActivePowers,
  buildRumors,
  applyMutations,
} from '../present.js'
import { PRESENT_SHAPES } from '../presentArchetypes.js'

// ── ID helpers ──

/** @param {number} epoch */
const uId = (epoch) => makeEventId('current', epoch, 0)

// ── Post-hoc event emitters ──

/**
 * Emit artifact-placed events for each artifact.
 * @param {World} world
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitArtifactEvents(world, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  let epoch = epochStart

  for (const artifact of (world.artifacts ?? [])) {
    const causeIds = []
    // Caused by the hero-age event that corresponds to the artifact's source
    if (artifact.origin.agentId) causeIds.push(artifact.origin.agentId)

    addEvent(timeline, {
      id: uId(epoch),
      age: 'current',
      epoch,
      archetype: 'artifact-placed',
      beats: emptyBeats(),
      concepts: artifact.concepts,
      participants: artifact.origin.agentId ? [artifact.origin.agentId] : [],
      mutations: [],
      spawns: [{ entityType: 'artifact', entityData: artifact, assignedId: artifact.id }],
      causedBy: [],
      tags: ['artifact'],
    })
    epoch++
  }

  return epoch
}

/**
 * Emit crisis, faction, recent-event, rumors, and power-stirs events
 * from the present data.
 * @param {World} world
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitPresentEvents(world, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const present = world.present
  if (!present) return epochStart

  let epoch = epochStart

  // crisis-emerges
  addEvent(timeline, {
    id: uId(epoch++),
    age: 'current',
    epoch: epoch - 1,
    archetype: 'crisis-emerges',
    beats: emptyBeats(),
    concepts: present.crisis.concepts,
    participants: [],
    mutations: [],
    spawns: [{ entityType: 'crisis', entityData: present.crisis, assignedId: present.crisis.id }],
    causedBy: [],
    tags: ['crisis'],
  })

  // faction-forms (one event covering all factions)
  if (present.factions.length > 0) {
    addEvent(timeline, {
      id: uId(epoch++),
      age: 'current',
      epoch: epoch - 1,
      archetype: 'faction-forms',
      beats: emptyBeats(),
      concepts: present.factions.flatMap(f => f.concepts).slice(0, 6),
      participants: /** @type {string[]} */ (present.factions.map(f => f.leaderAgentId).filter(Boolean)),
      mutations: [],
      spawns: present.factions.map(f => ({ entityType: 'faction', entityData: f, assignedId: f.id })),
      causedBy: [uId(epoch - 2)],  // caused by crisis
      tags: ['political', 'faction'],
    })
  }

  // recent-disturbance
  if (present.recentEvent) {
    addEvent(timeline, {
      id: uId(epoch++),
      age: 'current',
      epoch: epoch - 1,
      archetype: 'recent-disturbance',
      beats: emptyBeats(),
      concepts: present.recentEvent.concepts,
      participants: present.recentEvent.involvedEntityIds,
      mutations: [],
      spawns: [],
      causedBy: [uId(epoch - 3)],
      tags: ['crisis', 'event'],
    })
  }

  // rumor-spreads (one event per rumor)
  for (const rumor of present.rumors) {
    addEvent(timeline, {
      id: uId(epoch++),
      age: 'current',
      epoch: epoch - 1,
      archetype: 'rumor-spreads',
      beats: emptyBeats(),
      concepts: rumor.concepts,
      participants: rumor.referencedEntityId ? [rumor.referencedEntityId] : [],
      mutations: [],
      spawns: [],
      causedBy: [],
      tags: ['rumor'],
    })
  }

  // power-stirs (one event per active power)
  for (const power of present.activePowers) {
    addEvent(timeline, {
      id: uId(epoch++),
      age: 'current',
      epoch: epoch - 1,
      archetype: 'power-stirs',
      beats: emptyBeats(),
      concepts: power.concepts,
      participants: [power.agentId],
      mutations: [{
        entityId: power.agentId,
        entityType: 'agent',
        field: 'presentAction',
        value: power.currentAction,
        previousValue: null,
      }],
      spawns: [],
      causedBy: [],
      tags: ['divine', 'power'],
    })
  }

  return epoch
}

/**
 * Emit a character-arrives event as the final event in the timeline.
 * @param {World} world
 * @param {number} epoch
 */
function emitCharacterEvent(world, epoch) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const character = world.character
  if (!character) return

  addEvent(timeline, {
    id: uId(epoch),
    age: 'current',
    epoch,
    archetype: 'character-arrives',
    beats: emptyBeats(),
    concepts: character.concepts,
    participants: character.creatorGod ? [character.creatorGod] : [],
    mutations: [],
    spawns: [{ entityType: 'character', entityData: character, assignedId: 'player-character' }],
    causedBy: [],
    tags: ['character', 'arrival'],
  })
}

// ── Main entry ──

/**
 * Simulate the Current Age.
 *
 * Calls each existing generator with the same seed suffixes as the old
 * buildWorld() — so all typed World slots are populated identically.
 * Then walks the results and emits WorldEvents as a structured causal
 * representation.
 *
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {string} seed
 */
export function simulateCurrentAge(graph, world, seed) {
  const myth = /** @type {import('../recipes/index.js').CreationMyth} */ (world.myth)

  // ── 1. Artifacts ──
  generateArtifacts(graph, world, mulberry32(hashSeed(seed + '-artifacts')))
  let epoch = emitArtifactEvents(world, 0)

  // ── 2. Present (call helpers in sequence, same as generatePresent) ──
  const presentRng = mulberry32(hashSeed(seed + '-present'))
  const usedNames = new Set()
  const recipe = selectArchetype(presentRng, myth, world)
  const shapeFn = PRESENT_SHAPES[recipe]
  const shape = shapeFn({ graph, rng: presentRng, myth, world })
  const flawConcepts = myth.flaw.concepts
  const flawTouchedEvents = findFlawTouchedEvents(graph, world, flawConcepts)
  const hiddenTruth = buildHiddenTruth(
    graph, presentRng, flawConcepts, flawTouchedEvents,
    world.events, shape.crisisSeed.baseConcept, shape.hiddenTruthDepth
  )
  const crisis = buildCrisis(graph, presentRng, shape, world, recipe, flawTouchedEvents, usedNames)
  const factions = buildFactions(graph, presentRng, shape, world, crisis, usedNames)
  const recentEvent = buildRecentEvent(graph, presentRng, shape, world, crisis, usedNames)
  const activePowers = buildActivePowers(graph, world, crisis, factions)
  const rumors = buildRumors(graph, presentRng, shape, world, crisis)
  applyMutations(world, crisis, factions, activePowers)

  world.present = { recipe, crisis, factions, recentEvent, rumors, activePowers, hiddenTruth }
  epoch = emitPresentEvents(world, epoch)

  // ── 3. Character ──
  generateCharacter(graph, world, mulberry32(hashSeed(seed + '-character')))
  emitCharacterEvent(world, epoch)
  epoch++

  // ── 4. Renderers (not events) ──
  world.texts = generateMythTexts(graph, world, mulberry32(hashSeed(seed + '-texts')))
  world.renderedLandmarks = renderLandmarks(graph, world, mulberry32(hashSeed(seed + '-landmarks')))
  world.renderedRegions = renderRegions(graph, world, mulberry32(hashSeed(seed + '-regions')))
}
