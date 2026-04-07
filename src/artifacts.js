/**
 * Artifact generator — generates physical objects found throughout the world.
 * Four sources: cosmogony (creation tools, cost remnants), events (war weapons,
 * sacrifice relics, discovery finds), gods (divine instruments, relics of dead
 * gods), regional (objects from each region's concept cluster).
 *
 * Runs after all other layers. Mutates landmarks, sacred sites, and ruins.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 * @import { Agent } from './pantheon.js'
 * @import { MythicEvent } from './history.js'
 * @import { Landmark } from './geogony.js'
 * @import { ChorogonyRegion } from './chorogony.js'
 */
import { pick, weightedPick, clamp, conceptOverlap } from './utils.js'
import { nameRegion } from './naming.js'
import { expandConceptCluster } from './conceptResolvers.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   source: 'cosmogony'|'event'|'god'|'regional',
 *   eventIndex: number|null,
 *   agentId: string|null,
 *   regionId: string,
 * }} ArtifactOrigin
 */

/**
 * @typedef {{
 *   regionId: string,
 *   landmarkName: string|null,
 *   status: 'enshrined'|'buried'|'carried'|'lost'|'scattered',
 * }} ArtifactLocation
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   type: 'weapon'|'vessel'|'instrument'|'fragment'|'relic'|'tool'|'ornament'|'text',
 *   material: string,
 *   concepts: string[],
 *   origin: ArtifactOrigin,
 *   significance: 'sacred'|'cursed'|'forgotten'|'disputed'|'hidden'|'broken',
 *   condition: 'intact'|'damaged'|'fragmentary'|'corrupted'|'transformed',
 *   location: ArtifactLocation,
 * }} Artifact
 */

// ── Helpers ──

/** @type {Record<string, Record<string, number>>} */
const EVENT_TYPE_WEIGHTS = {
  sacrifice: { relic: 4, fragment: 3, vessel: 1, ornament: 1 },
  war:       { weapon: 4, tool: 3, fragment: 2, relic: 1 },
  discovery: { text: 4, instrument: 3, relic: 2, vessel: 1 },
  corruption: { relic: 3, fragment: 3, ornament: 2, tool: 1 },
  hubris:    { ornament: 3, instrument: 3, relic: 2, weapon: 1 },
  exodus:    { vessel: 4, tool: 3, text: 2, relic: 1 },
  sundering: { fragment: 4, relic: 3, instrument: 2, tool: 1 },
  return:    { relic: 4, fragment: 3, text: 2, ornament: 1 },
}

const ALL_TYPES = ['weapon', 'vessel', 'instrument', 'fragment', 'relic', 'tool', 'ornament', 'text']

/**
 * Find the chorogony region with the best concept overlap.
 * @param {ConceptGraph} graph
 * @param {string[]} concepts
 * @param {ChorogonyRegion[]} regions
 * @returns {ChorogonyRegion|null}
 */
function findBestRegion(graph, concepts, regions) {
  if (regions.length === 0) return null
  let best = regions[0]
  let bestScore = conceptOverlap(graph, concepts, best.concepts)
  for (let i = 1; i < regions.length; i++) {
    const score = conceptOverlap(graph, concepts, regions[i].concepts)
    if (score > bestScore) { bestScore = score; best = regions[i] }
  }
  return best
}

/**
 * Find the name of the landmark in a region with the best concept overlap.
 * @param {ConceptGraph} graph
 * @param {string[]} concepts
 * @param {string[]} regionLandmarkNames
 * @param {Landmark[]} allLandmarks
 * @returns {string|null}
 */
function findBestLandmark(graph, concepts, regionLandmarkNames, allLandmarks) {
  const candidates = allLandmarks.filter(l => regionLandmarkNames.includes(l.name))
  if (candidates.length === 0) return null
  let best = candidates[0]
  let bestScore = conceptOverlap(graph, concepts, best.concepts)
  for (let i = 1; i < candidates.length; i++) {
    const score = conceptOverlap(graph, concepts, candidates[i].concepts)
    if (score > bestScore) { bestScore = score; best = candidates[i] }
  }
  return best.name
}

/**
 * Derive artifact type from event archetype using weighted pick.
 * @param {() => number} rng
 * @param {string} archetype
 * @returns {Artifact['type']}
 */
function pickEventType(rng, archetype) {
  const typeWeights = EVENT_TYPE_WEIGHTS[archetype] ?? {}
  const weights = ALL_TYPES.map(t => typeWeights[t] ?? 1)
  return /** @type {Artifact['type']} */ (weightedPick(rng, ALL_TYPES, weights))
}

/**
 * Resolve condition for an artifact based on its placement context.
 * @param {() => number} rng
 * @param {string} regionId
 * @param {World} world
 * @param {'cosmogony'|'event'|'god'|'regional'} source
 * @param {string} [archetype]
 * @param {string} [agentState]
 * @returns {Artifact['condition']}
 */
function resolveCondition(rng, regionId, world, source, archetype, agentState) {
  const hasSacredSite = (world.hierogony?.sacredSites ?? []).some(s => s.regionId === regionId)
  const hasRuin = (world.politogony?.ruins ?? []).some(r => r.regionId === regionId)

  if (hasSacredSite) return 'intact'
  if (source === 'cosmogony') {
    return /** @type {Artifact['condition']} */ (weightedPick(rng, ['intact', 'transformed', 'corrupted'], [4, 3, 1]))
  }
  if (hasRuin) {
    return /** @type {Artifact['condition']} */ (weightedPick(rng, ['damaged', 'fragmentary', 'corrupted'], [3, 3, 1]))
  }
  if (agentState === 'dead' || agentState === 'forgotten') {
    return /** @type {Artifact['condition']} */ (weightedPick(rng, ['corrupted', 'fragmentary', 'damaged'], [3, 2, 2]))
  }
  if (archetype === 'corruption') {
    return /** @type {Artifact['condition']} */ (weightedPick(rng, ['corrupted', 'damaged'], [3, 2]))
  }
  return /** @type {Artifact['condition']} */ (weightedPick(rng, ['intact', 'damaged', 'fragmentary', 'corrupted', 'transformed'], [4, 2, 2, 1, 1]))
}

/**
 * Resolve location status for an artifact.
 * @param {() => number} rng
 * @param {string} regionId
 * @param {string|null} landmarkName
 * @param {World} world
 * @param {Artifact['condition']} condition
 * @param {boolean} isActiveGod
 * @returns {ArtifactLocation['status']}
 */
function resolveStatus(rng, regionId, landmarkName, world, condition, isActiveGod) {
  const sacredSites = world.hierogony?.sacredSites ?? []
  const ruins = world.politogony?.ruins ?? []
  const hasSacredSite = sacredSites.some(s =>
    s.regionId === regionId && (!landmarkName || s.landmarkName === landmarkName)
  )
  const hasRuin = ruins.some(r => r.regionId === regionId)

  if (hasSacredSite && landmarkName) return 'enshrined'
  if (isActiveGod) return 'carried'
  if (hasRuin) return 'buried'
  if (condition === 'fragmentary' || condition === 'corrupted') {
    return /** @type {ArtifactLocation['status']} */ (weightedPick(rng, ['scattered', 'buried', 'lost'], [3, 2, 2]))
  }
  return /** @type {ArtifactLocation['status']} */ (weightedPick(rng, ['buried', 'enshrined', 'lost', 'scattered'], [4, 2, 2, 1]))
}

// ── Builders ──

/**
 * Build a cosmogony-sourced artifact (the creation tool or cost remnant).
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {CreationMyth} myth
 * @param {ChorogonyRegion[]} regions
 * @param {Landmark[]} allLandmarks
 * @param {string[]} materials
 * @param {Set<string>} usedNames
 * @param {number} index
 * @returns {Artifact}
 */
function buildCosmogonyArtifact(graph, rng, world, myth, regions, allLandmarks, materials, usedNames, index) {
  const useAct = rng() < 0.6
  const srcBeat = useAct ? myth.act : myth.cost
  const seedConcept = srcBeat.concepts[0] ?? myth.before.concepts[0] ?? 'void'
  const concepts = expandConceptCluster(graph, rng, seedConcept, 2, 5)

  const type = /** @type {Artifact['type']} */ (useAct
    ? weightedPick(rng, ['tool', 'vessel', 'instrument', 'relic'], [3, 3, 3, 1])
    : weightedPick(rng, ['relic', 'fragment', 'vessel'], [4, 3, 1]))
  const material = pick(rng, materials)
  const condition = resolveCondition(rng, '', world, 'cosmogony')

  const region = findBestRegion(graph, concepts, regions) ?? regions[0]
  const regionId = region?.id ?? 'unknown'
  const landmarkName = region ? findBestLandmark(graph, concepts, region.landmarks, allLandmarks) : null
  const status = resolveStatus(rng, regionId, landmarkName, world, condition, false)

  const name = nameRegion(graph, concepts, rng, usedNames)

  return {
    id: `artifact-${index}`,
    name,
    type,
    material,
    concepts,
    origin: { source: 'cosmogony', eventIndex: null, agentId: null, regionId },
    significance: 'sacred',
    condition,
    location: { regionId, landmarkName, status },
  }
}

/**
 * Build an event-sourced artifact.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {MythicEvent} event
 * @param {number} eventIndex
 * @param {ChorogonyRegion[]} regions
 * @param {Landmark[]} allLandmarks
 * @param {string[]} materials
 * @param {Set<string>} usedNames
 * @param {number} index
 * @returns {Artifact}
 */
function buildEventArtifact(graph, rng, world, event, eventIndex, regions, allLandmarks, materials, usedNames, index) {
  const seedConcepts = event.consequence.concepts.length > 0 ? event.consequence.concepts : event.action.concepts
  const seedConcept = seedConcepts[0] ?? event.concepts[0] ?? 'ruin'
  const concepts = expandConceptCluster(graph, rng, seedConcept, 2, 5)

  const type = pickEventType(rng, event.archetype)
  const material = pick(rng, materials)

  /** @type {Artifact['significance']} */
  let significance
  switch (event.archetype) {
    case 'sacrifice': significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['sacred', 'cursed'], [3, 2])); break
    case 'corruption': significance = 'cursed'; break
    case 'return': significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['forgotten', 'sacred', 'hidden'], [3, 2, 2])); break
    case 'discovery': significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['hidden', 'sacred', 'disputed'], [3, 2, 2])); break
    default: significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['sacred', 'cursed', 'forgotten', 'disputed', 'hidden', 'broken'], [2, 2, 2, 2, 1, 1]))
  }

  // Find the region most associated with this event via regionTags
  const eventRegion = findBestRegion(graph, event.regionTags.length > 0 ? event.regionTags : concepts, regions)
  const region = eventRegion ?? regions[0]
  const regionId = region?.id ?? 'unknown'

  const condition = resolveCondition(rng, regionId, world, 'event', event.archetype)
  const landmarkName = region ? findBestLandmark(graph, concepts, region.landmarks, allLandmarks) : null
  const status = resolveStatus(rng, regionId, landmarkName, world, condition, false)

  const name = nameRegion(graph, concepts, rng, usedNames)

  return {
    id: `artifact-${index}`,
    name,
    type,
    material,
    concepts,
    origin: { source: 'event', eventIndex, agentId: null, regionId },
    significance,
    condition,
    location: { regionId, landmarkName, status },
  }
}

/**
 * Build a god-sourced artifact (a divine instrument, relic, or binding).
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {Agent} agent
 * @param {ChorogonyRegion[]} regions
 * @param {Landmark[]} allLandmarks
 * @param {string[]} materials
 * @param {Set<string>} usedNames
 * @param {number} index
 * @returns {Artifact}
 */
function buildGodArtifact(graph, rng, world, agent, regions, allLandmarks, materials, usedNames, index) {
  const seedConcept = agent.domains[0] ?? agent.name
  const concepts = expandConceptCluster(graph, rng, seedConcept, 2, 5)

  /** @type {Artifact['type']} */
  let type
  if (agent.state === 'dead' || agent.state === 'forgotten') {
    type = /** @type {Artifact['type']} */ (weightedPick(rng, ['fragment', 'relic', 'ornament'], [3, 3, 1]))
  } else if (agent.state === 'imprisoned') {
    type = /** @type {Artifact['type']} */ (weightedPick(rng, ['instrument', 'relic', 'fragment'], [3, 2, 2]))
  } else {
    type = /** @type {Artifact['type']} */ (weightedPick(rng, ['weapon', 'ornament', 'instrument', 'tool'], [3, 3, 2, 1]))
  }

  const material = pick(rng, materials)

  /** @type {Artifact['significance']} */
  let significance
  if (agent.type === 'demon') {
    significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['cursed', 'hidden', 'broken'], [3, 2, 2]))
  } else if (agent.state === 'forgotten') {
    significance = 'forgotten'
  } else if (agent.state === 'dead') {
    significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['sacred', 'cursed', 'broken'], [3, 2, 2]))
  } else {
    significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['sacred', 'disputed', 'hidden'], [3, 2, 2]))
  }

  const isActiveGod = agent.state === 'active' && (agent.type === 'god' || agent.type === 'demi-god')
  const region = findBestRegion(graph, concepts, regions) ?? regions[0]
  const regionId = region?.id ?? 'unknown'

  const condition = resolveCondition(rng, regionId, world, 'god', undefined, agent.state)
  const landmarkName = region ? findBestLandmark(graph, concepts, region.landmarks, allLandmarks) : null
  const status = resolveStatus(rng, regionId, landmarkName, world, condition, isActiveGod)

  const name = nameRegion(graph, concepts, rng, usedNames)

  return {
    id: `artifact-${index}`,
    name,
    type,
    material,
    concepts,
    origin: { source: 'god', eventIndex: null, agentId: agent.id, regionId },
    significance,
    condition,
    location: { regionId, landmarkName, status },
  }
}

/**
 * Build a regional artifact (an object from the region's concept cluster).
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {ChorogonyRegion} region
 * @param {Landmark[]} allLandmarks
 * @param {string[]} materials
 * @param {Set<string>} usedNames
 * @param {number} index
 * @returns {Artifact}
 */
function buildRegionalArtifact(graph, rng, world, region, allLandmarks, materials, usedNames, index) {
  const seedConcept = region.concepts[0] ?? 'stone'
  const concepts = expandConceptCluster(graph, rng, seedConcept, 2, 5)

  const hasSacredSite = (world.hierogony?.sacredSites ?? []).some(s => s.regionId === region.id)
  const hasRuin = (world.politogony?.ruins ?? []).some(r => r.regionId === region.id)

  /** @type {Artifact['significance']} */
  let significance
  if (hasSacredSite) {
    significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['sacred', 'hidden', 'disputed'], [4, 2, 1]))
  } else if (hasRuin) {
    significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['hidden', 'broken', 'forgotten'], [3, 3, 2]))
  } else {
    significance = /** @type {Artifact['significance']} */ (weightedPick(rng, ['sacred', 'cursed', 'forgotten', 'disputed', 'hidden', 'broken'], [2, 2, 2, 1, 2, 1]))
  }

  const type = /** @type {Artifact['type']} */ (weightedPick(rng, ALL_TYPES, [1, 1, 1, 1, 1, 1, 1, 1]))
  const material = pick(rng, materials)
  const condition = resolveCondition(rng, region.id, world, 'regional')
  const landmarkName = findBestLandmark(graph, concepts, region.landmarks, allLandmarks)
  const status = resolveStatus(rng, region.id, landmarkName, world, condition, false)

  const name = nameRegion(graph, concepts, rng, usedNames)

  return {
    id: `artifact-${index}`,
    name,
    type,
    material,
    concepts,
    origin: { source: 'regional', eventIndex: null, agentId: null, regionId: region.id },
    significance,
    condition,
    location: { regionId: region.id, landmarkName, status },
  }
}

// ── Mutations ──

/**
 * Apply artifact-layer mutations to earlier entities.
 * Landmarks get artifacts[], sacred sites get artifactIds[], ruins get artifactIds[].
 * @param {World} world
 * @param {Artifact[]} artifacts
 * @param {Landmark[]} allLandmarks
 */
function applyMutations(world, artifacts, allLandmarks) {
  // Landmarks: collect artifact ids for each landmark
  for (const landmark of allLandmarks) {
    const ids = artifacts
      .filter(a => a.location.landmarkName === landmark.name)
      .map(a => a.id)
    if (ids.length > 0) {
      /** @type {*} */ (landmark).artifacts = ids
    }
  }

  // Sacred sites: collect artifact ids for enshrined artifacts at matching landmark
  for (const site of (world.hierogony?.sacredSites ?? [])) {
    const ids = artifacts
      .filter(a => a.location.status === 'enshrined' &&
        a.location.regionId === site.regionId &&
        (!site.landmarkName || a.location.landmarkName === site.landmarkName))
      .map(a => a.id)
    if (ids.length > 0) {
      /** @type {*} */ (site).artifactIds = ids
    }
  }

  // Ruins: collect artifact ids for buried/degraded artifacts in ruin regions
  for (const ruin of (world.politogony?.ruins ?? [])) {
    const ids = artifacts
      .filter(a => a.location.regionId === ruin.regionId &&
        (a.location.status === 'buried' || a.location.status === 'scattered' ||
         a.condition === 'damaged' || a.condition === 'fragmentary'))
      .map(a => a.id)
    if (ids.length > 0) {
      /** @type {*} */ (ruin).artifactIds = ids
    }
  }
}

// ── Main entry ──

/**
 * Generate artifacts and write them into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateArtifacts(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)
  const regions = world.chorogony?.regions ?? []
  const events = world.events
  const materials = (world.geogony?.materials?.length ?? 0) > 0
    ? /** @type {string[]} */ (world.geogony?.materials)
    : ['stone', 'bone', 'clay']
  const allLandmarks = world.geogony?.landmarks ?? []

  const usedNames = /** @type {Set<string>} */ (new Set())
  let artifactCounter = 0
  /** @type {Artifact[]} */
  const artifacts = []
  const coveredRegions = /** @type {Set<string>} */ (new Set())

  // ── Budget ──
  const sacrificeEvents = events.filter(e => e.archetype === 'sacrifice')
  const minGuaranteed = 1 + sacrificeEvents.length + regions.length
  const scaled = 6 + Math.floor(events.length * 0.5) + Math.floor(regions.length * 0.5)
  const totalCount = Math.max(minGuaranteed, clamp(scaled, 8, 20))

  // ── Guaranteed: cosmogony ──
  const cosmo = buildCosmogonyArtifact(graph, rng, world, myth, regions, allLandmarks, materials, usedNames, artifactCounter++)
  artifacts.push(cosmo)
  coveredRegions.add(cosmo.location.regionId)

  // ── Guaranteed: sacrifice-event artifacts ──
  for (let i = 0; i < events.length; i++) {
    if (events[i].archetype !== 'sacrifice') continue
    const a = buildEventArtifact(graph, rng, world, events[i], i, regions, allLandmarks, materials, usedNames, artifactCounter++)
    artifacts.push(a)
    coveredRegions.add(a.location.regionId)
  }

  // ── Guaranteed: one artifact per region ──
  for (const region of regions) {
    if (coveredRegions.has(region.id)) continue
    const a = buildRegionalArtifact(graph, rng, world, region, allLandmarks, materials, usedNames, artifactCounter++)
    artifacts.push(a)
    coveredRegions.add(region.id)
  }

  // ── Fill remaining budget ──
  const remaining = totalCount - artifacts.length
  const agentPool = world.agents.filter(a =>
    a.type === 'god' || a.type === 'demi-god' || a.type === 'spirit' || a.type === 'demon'
  )
  const nonSacrificeEvents = events
    .map((e, i) => ({ event: e, index: i }))
    .filter(({ event }) => event.archetype !== 'sacrifice')

  const sourceNames = ['god', 'event', 'regional']
  const sourceWeights = [4, 3, 3]

  for (let i = 0; i < remaining; i++) {
    const source = weightedPick(rng, sourceNames, sourceWeights)
    if (source === 'god' && agentPool.length > 0) {
      const agent = pick(rng, agentPool)
      artifacts.push(buildGodArtifact(graph, rng, world, agent, regions, allLandmarks, materials, usedNames, artifactCounter++))
    } else if (source === 'event' && nonSacrificeEvents.length > 0) {
      const { event, index } = pick(rng, nonSacrificeEvents)
      artifacts.push(buildEventArtifact(graph, rng, world, event, index, regions, allLandmarks, materials, usedNames, artifactCounter++))
    } else if (regions.length > 0) {
      const region = pick(rng, regions)
      artifacts.push(buildRegionalArtifact(graph, rng, world, region, allLandmarks, materials, usedNames, artifactCounter++))
    } else if (agentPool.length > 0) {
      const agent = pick(rng, agentPool)
      artifacts.push(buildGodArtifact(graph, rng, world, agent, regions, allLandmarks, materials, usedNames, artifactCounter++))
    }
  }

  // ── Mutations ──
  applyMutations(world, artifacts, allLandmarks)

  // ── Write to world ──
  world.artifacts = artifacts
}
