/**
 * Age of Heroes — calls existing chorogony, hierogony, and politogony
 * generators, then emits WorldEvents post-hoc from their results.
 *
 * Strategy: identical to creation.js — call generators with the same RNG
 * seeds, then walk the results and create timeline events as a parallel
 * structured causal representation.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { World } from '../world.js'
 * @import { WorldEvent } from '../timeline.js'
 */
import { generateChorogony } from '../chorogony.js'
import { generateHierogony } from '../hierogony.js'
import { generatePolitogony } from '../politogony.js'
import { generateSettlement } from '../settlement.js'
import { mulberry32, hashSeed } from '../utils.js'
import { renderOneLandmark } from '../renderers/landmarks.js'
import { renderOneRegion } from '../renderers/regions.js'
import {
  addEvent,
  advanceAge,
  makeEventId,
  emptyBeats,
} from '../timeline.js'

// ── ID helpers ──

/** @param {number} epoch */
const hId = (epoch) => makeEventId('heroes', epoch, 0)

/** Find the last creation-age event ID in the timeline. */
function lastCreationEventId(/** @type {import('../timeline.js').Timeline} */ timeline) {
  const creation = timeline.events.filter(e => e.age === 'creation')
  return creation.length > 0 ? creation[creation.length - 1].id : ''
}

// ── Post-hoc event emitters ──

/**
 * Emit one region-established event per chorogony region.
 * Each region is caused by the last creation-age event.
 * @param {World} world
 * @param {string} rootCause
 * @returns {Map<string, string>} regionId → eventId
 */
function emitRegionEvents(world, rootCause) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const regionEventIds = new Map()
  let epoch = 0

  for (const region of (world.chorogony?.regions ?? [])) {
    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'region-established',
      beats: emptyBeats(),
      concepts: region.concepts,
      participants: [],
      mutations: [],
      spawns: [{ entityType: 'region', entityData: region, assignedId: region.id }],
      causedBy: rootCause ? [rootCause] : [],
      tags: ['settlement'],
    })
    regionEventIds.set(region.id, id)
    epoch++
  }

  return regionEventIds
}

/**
 * Emit divine-birth events for each religion established.
 * @param {World} world
 * @param {Map<string, string>} regionEventIds
 * @param {number} epochStart
 * @returns {{ epoch: number, religionEventIds: Map<string, string> }}
 */
function emitReligionEvents(world, regionEventIds, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const religionEventIds = new Map()
  let epoch = epochStart

  for (const religion of (world.hierogony?.religions ?? [])) {
    // Find a region that has one of this religion's peoples
    const peoples = world.anthropogony?.peoples ?? []
    const religionPeoples = peoples.filter(p => religion.peoples.includes(p.name))
    const causeRegionId = religionPeoples.length > 0
      ? (world.chorogony?.regions ?? []).find(r => r.peoples.includes(religionPeoples[0].name))?.id
      : null
    const causedBy = causeRegionId && regionEventIds.has(causeRegionId)
      ? [regionEventIds.get(causeRegionId) ?? '']
      : (regionEventIds.size > 0 ? [regionEventIds.values().next().value ?? ''] : [])

    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'religion-established',
      beats: emptyBeats(),
      concepts: religion.concepts,
      participants: religion.worshippedAgents,
      mutations: /** @type {import('../timeline.js').EntityMutation[]} */ ([
        // People gain a religion
        ...religion.peoples.map(peopleName => {
          const person = peoples.find(p => p.name === peopleName)
          return person ? {
            entityId: person.id,
            entityType: 'people',
            field: 'religion',
            value: religion.id,
            previousValue: null,
          } : null
        }).filter(Boolean),
        // Worshipped agents gain worshippedBy
        ...religion.worshippedAgents.map(agentId => ({
          entityId: agentId,
          entityType: 'agent',
          field: 'worshippedBy',
          value: religion.id,
          previousValue: null,
        })),
      ]),
      spawns: [{ entityType: 'religion', entityData: religion, assignedId: religion.id }],
      causedBy,
      tags: ['religion', 'belief'],
    })
    religionEventIds.set(religion.id, id)
    epoch++
  }

  // Emit heresy events
  for (const heresy of (world.hierogony?.heresies ?? [])) {
    const parentId = religionEventIds.get(heresy.religionId)
    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'heresy-emerges',
      beats: emptyBeats(),
      concepts: heresy.concepts,
      participants: [],
      mutations: [],
      spawns: [{ entityType: 'heresy', entityData: heresy, assignedId: heresy.id }],
      causedBy: parentId ? [parentId] : [],
      tags: ['religion', 'schism'],
    })
    epoch++
  }

  // Emit sacred-site events
  for (const site of (world.hierogony?.sacredSites ?? [])) {
    const parentId = religionEventIds.get(site.religionId)
    const regionId = regionEventIds.get(site.regionId)
    const id = hId(epoch)
    // Find the landmark this sacred site is placed on
    const siteLinkedLandmark = (world.geogony?.landmarks ?? []).find(l => l.name === site.landmarkName)

    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'sacred-site-founded',
      beats: emptyBeats(),
      concepts: site.concepts,
      participants: [],
      mutations: siteLinkedLandmark ? [{
        entityId: siteLinkedLandmark.id,
        entityType: 'landmark',
        field: 'sacredTo',
        value: site.religionId,
        previousValue: null,
      }] : [],
      spawns: [{ entityType: 'sacredSite', entityData: site, assignedId: site.id }],
      causedBy: [parentId, regionId].filter(Boolean),
      tags: ['religion', 'landmark'],
    })
    epoch++
  }

  return { epoch, religionEventIds }
}

/**
 * Emit kingdom-founded, war, alliance, ruin, and legend events from politogony.
 * @param {World} world
 * @param {Map<string, string>} regionEventIds
 * @param {Map<string, string>} religionEventIds
 * @param {number} epochStart
 * @returns {number} next free epoch
 */
function emitPolityEvents(world, regionEventIds, religionEventIds, epochStart) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  let epoch = epochStart
  const polityEventIds = new Map()

  // Kingdom-founded per polity
  for (const polity of (world.politogony?.polities ?? [])) {
    const causeIds = []
    // Caused by capital region event
    if (polity.capitalRegionId && regionEventIds.has(polity.capitalRegionId)) {
      causeIds.push(regionEventIds.get(polity.capitalRegionId) ?? '')
    }
    // Also caused by patron religion if any
    if (polity.religionId && religionEventIds.has(polity.religionId)) {
      causeIds.push(religionEventIds.get(polity.religionId) ?? '')
    }

    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: polity.state === 'fallen' ? 'kingdom-fallen' : 'kingdom-founded',
      beats: emptyBeats(),
      concepts: polity.concepts,
      participants: polity.patronAgentId ? [polity.patronAgentId] : [],
      mutations: [
        // Regions gain controlledBy
        ...polity.regionIds.map(rid => ({
          entityId: rid,
          entityType: 'region',
          field: 'controlledBy',
          value: polity.id,
          previousValue: null,
        })),
        // Patron agent gains patronOf
        ...(polity.patronAgentId ? [{
          entityId: polity.patronAgentId,
          entityType: 'agent',
          field: 'patronOf',
          value: polity.id,
          previousValue: null,
        }] : []),
      ],
      spawns: [{ entityType: 'polity', entityData: polity, assignedId: polity.id }],
      causedBy: causeIds.filter(Boolean),
      tags: ['political', 'kingdom'],
    })
    polityEventIds.set(polity.id, id)
    epoch++
  }

  // Ruins (fallen kingdoms' remnants)
  for (const ruin of (world.politogony?.ruins ?? [])) {
    const parentId = polityEventIds.get(ruin.formerPolityId)
    const regionId = regionEventIds.get(ruin.regionId)
    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'monument-falls',
      beats: emptyBeats(),
      concepts: ruin.concepts,
      participants: [],
      mutations: [],
      spawns: [{ entityType: 'ruin', entityData: ruin, assignedId: ruin.id }],
      causedBy: [parentId, regionId].filter(Boolean),
      tags: ['political', 'ruin'],
    })
    epoch++
  }

  // Conflicts (wars between kingdoms)
  const conflictEventIds = new Map()
  for (const conflict of (world.politogony?.conflicts ?? [])) {
    const [p1Id, p2Id] = conflict.polityIds
    const cause1 = polityEventIds.get(p1Id)
    const cause2 = polityEventIds.get(p2Id)
    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'war-between-kingdoms',
      beats: emptyBeats(),
      concepts: conflict.concepts,
      participants: [p1Id, p2Id],
      mutations: [],
      spawns: [{ entityType: 'conflict', entityData: conflict, assignedId: conflict.id }],
      causedBy: [cause1, cause2].filter(Boolean),
      tags: ['political', 'conflict'],
    })
    conflictEventIds.set(conflict.id, id)
    epoch++
  }

  // Alliances
  for (const alliance of (world.politogony?.alliances ?? [])) {
    const causeIds = alliance.polityIds.map(pid => polityEventIds.get(pid)).filter(Boolean)
    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'alliance-formed',
      beats: emptyBeats(),
      concepts: alliance.concepts,
      participants: alliance.polityIds,
      mutations: [],
      spawns: [{ entityType: 'alliance', entityData: alliance, assignedId: alliance.id }],
      causedBy: causeIds,
      tags: ['political', 'alliance'],
    })
    epoch++
  }

  // Legends (polity reinterpretations of mythic events)
  for (const legend of (world.politogony?.legends ?? [])) {
    const parentId = polityEventIds.get(legend.polityId)
    const id = hId(epoch)
    addEvent(timeline, {
      id,
      age: 'heroes',
      epoch,
      archetype: 'legend-written',
      beats: emptyBeats(),
      concepts: legend.concepts,
      participants: legend.polityId ? [legend.polityId] : [],
      mutations: [],
      spawns: [{ entityType: 'legend', entityData: legend, assignedId: legend.id }],
      causedBy: parentId ? [parentId] : [],
      tags: ['political', 'legend'],
    })
    epoch++
  }

  return epoch
}

// ── Main entry ──

/**
 * Simulate the Age of Heroes.
 *
 * Calls chorogony, hierogony, and politogony generators with the same
 * RNG seeds as the old buildWorld() — so all typed World slots are
 * populated identically. Then walks the results and emits WorldEvents
 * as a causal narrative representation.
 *
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {string} seed
 */
export function simulateHeroAge(graph, world, seed) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const rootCause = lastCreationEventId(timeline)

  // ── 1. Chorogony ──
  generateChorogony(graph, world, mulberry32(hashSeed(seed + '-chorogony')))
  const regionEventIds = emitRegionEvents(world, rootCause)

  // Initial region prose (no polities, ruins, or sacred sites yet)
  logRegionProse(graph, world, seed)

  // ── 2. Hierogony ──
  generateHierogony(graph, world, mulberry32(hashSeed(seed + '-hierogony')))
  let epoch = regionEventIds.size

  // religions-origin summary
  epoch = emitLayerSummary(timeline, epoch, 'religions-origin', world.hierogony, ['religion', 'meta'])

  const { epoch: epochAfterReligions, religionEventIds } =
    emitReligionEvents(world, regionEventIds, epoch)

  // Re-render landmarks after sacred sites placed
  logLandmarkProse(graph, world, seed)

  // ── 3. Politogony ──
  generatePolitogony(graph, world, mulberry32(hashSeed(seed + '-politogony')))

  // polities-origin summary
  const epochAfterSummary = emitLayerSummary(timeline, epochAfterReligions, 'polities-origin', world.politogony, ['political', 'meta'])

  emitPolityEvents(world, regionEventIds, religionEventIds, epochAfterSummary)

  // Re-render regions after polities claim them
  logRegionProse(graph, world, seed)

  // ── 4. Settlement ──
  generateSettlement(graph, world, mulberry32(hashSeed(seed + '-settlement')))

  // ── 5. Advance age ──
  advanceAge(timeline, 'current')
}

/**
 * Emit a layer summary event (recipe + full layer data).
 * @param {import('../timeline.js').Timeline} timeline
 * @param {number} epoch
 * @param {string} archetype
 * @param {object|null} layerData
 * @param {string[]} tags
 * @returns {number} next free epoch
 */
function emitLayerSummary(timeline, epoch, archetype, layerData, tags) {
  if (!layerData) return epoch
  const entityType = archetype.replace(/-/g, '_')

  addEvent(timeline, {
    id: hId(epoch),
    age: 'heroes',
    epoch,
    archetype,
    beats: emptyBeats(),
    concepts: /** @type {any} */ (layerData).recipe ? [/** @type {any} */ (layerData).recipe] : [],
    participants: [],
    mutations: [],
    spawns: [{ entityType, entityData: layerData, assignedId: `${entityType}-0` }],
    causedBy: [],
    tags,
  })
  return epoch + 1
}

// ── Prose logging ──

/**
 * Find the latest event that spawned or mutated an entity.
 * @param {import('../timeline.js').Timeline} timeline
 * @param {string} entityId
 * @returns {string | null}
 */
function findLatestEventForEntity(timeline, entityId) {
  for (let i = timeline.events.length - 1; i >= 0; i--) {
    const evt = timeline.events[i]
    if (evt.spawns.some(s => s.assignedId === entityId)) return evt.id
    if (evt.mutations.some(m => m.entityId === entityId)) return evt.id
  }
  return null
}

/**
 * Render and log prose for all landmarks at the current world state.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {string} seed
 */
function logLandmarkProse(graph, world, seed) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const rng = mulberry32(hashSeed(seed + '-landmark-prose-' + timeline.events.length))
  for (const landmark of (world.geogony?.landmarks ?? [])) {
    const prose = renderOneLandmark(graph, rng, world, landmark)
    const eventId = findLatestEventForEntity(timeline, landmark.id)
    if (eventId) {
      world.proseLog.push({ eventId, entityId: landmark.id, type: 'landmark', prose })
    }
  }
}

/**
 * Render and log prose for all regions at the current world state.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {string} seed
 */
function logRegionProse(graph, world, seed) {
  const timeline = /** @type {import('../timeline.js').Timeline} */ (world.timeline)
  const rng = mulberry32(hashSeed(seed + '-region-prose-' + timeline.events.length))
  for (const region of (world.chorogony?.regions ?? [])) {
    const prose = renderOneRegion(graph, rng, world, region)
    const eventId = findLatestEventForEntity(timeline, region.id)
    if (eventId) {
      world.proseLog.push({ eventId, entityId: region.id, type: 'region', prose })
    }
  }
}
