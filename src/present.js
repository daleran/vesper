/**
 * Present generator — determines the current state of the world when the
 * player arrives. Produces a crisis, factions, a recent event, rumors,
 * active powers, and a hidden truth chain connecting crisis to original flaw.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 * @import { Agent } from './pantheon.js'
 * @import { PresentShape } from './presentArchetypes.js'
 */
import { pick, weightedPick, conceptOverlap } from './utils.js'
import { walkFrom } from './walker.js'
import { nameRegion } from './naming.js'
import { findAgent, findPolity } from './world.js'
import { expandConceptCluster } from './conceptResolvers.js'
import { PRESENT_SHAPES, PRESENT_NAMES } from './presentArchetypes.js'
import {
  DELIBERATE_RECIPES,
  VIOLENT_RECIPES,
  ORGANIC_RECIPES,
  CYCLIC_RECIPES,
  SPREADING_RECIPES,
  applyRecipeBonuses,
} from './archetypeSelection.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   type: string,
 *   concepts: string[],
 *   severity: 'brewing'|'breaking'|'critical',
 *   affectedRegionIds: string[],
 *   flawConnection: string[],
 *   latestEventIndex: number,
 * }} Crisis
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   approach: string,
 *   polityIds: string[],
 *   religionIds: string[],
 *   leaderAgentId: string|null,
 *   concepts: string[],
 *   strength: 'dominant'|'rising'|'desperate',
 * }} Faction
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   type: string,
 *   concepts: string[],
 *   involvedEntityIds: string[],
 *   regionId: string|null,
 * }} RecentEvent
 */

/**
 * @typedef {{
 *   id: string,
 *   claim: string,
 *   isTrue: boolean,
 *   referencedEntityId: string,
 *   referencedEntityType: string,
 *   distortion: string|null,
 *   concepts: string[],
 *   regionId: string|null,
 * }} Rumor
 */

/**
 * @typedef {{
 *   agentId: string,
 *   currentAction: string,
 *   factionAlignment: string|null,
 *   regionId: string|null,
 *   concepts: string[],
 * }} ActivePower
 */

/**
 * @typedef {{
 *   recipe: string,
 *   crisis: Crisis,
 *   factions: Faction[],
 *   recentEvent: RecentEvent,
 *   rumors: Rumor[],
 *   activePowers: ActivePower[],
 *   hiddenTruth: string[],
 * }} PresentData
 */

// ── Archetype selection ──

/**
 * Select a present archetype using weighted signals.
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {World} world
 * @returns {string}
 */
function selectArchetype(rng, myth, world) {
  // [plague, schism, succession, invasion, depletion, awakening]
  const weights = [1, 1, 1, 1, 1, 1]

  // Recipe-based bonuses
  applyRecipeBonuses(weights, myth.recipe, [
    { recipes: SPREADING_RECIPES, indices: [0], bonus: 3 },
    { recipes: DELIBERATE_RECIPES, indices: [1], bonus: 3 },
    { recipes: CYCLIC_RECIPES, indices: [2, 5], bonus: 2 },
    { recipes: VIOLENT_RECIPES, indices: [3], bonus: 3 },
    { recipes: ORGANIC_RECIPES, indices: [4], bonus: 3 },
  ])

  // World-state bonuses
  const flawLife = world.biogony?.flawLife ?? []
  if (flawLife.length > 0) weights[0] += 2

  const heresies = world.hierogony?.heresies ?? []
  if (heresies.length >= 1) weights[1] += 2

  const polities = world.politogony?.polities ?? []
  if (polities.some(p => p.state === 'declining' || p.state === 'fallen')) weights[2] += 2

  const conflicts = world.politogony?.conflicts ?? []
  if (conflicts.some(c => c.intensity === 'open')) weights[3] += 2

  const ruins = world.politogony?.ruins ?? []
  if (ruins.length >= 2) weights[4] += 2

  if (world.agents.some(a => a.state === 'sleeping' || a.state === 'imprisoned' || a.state === 'forgotten')) {
    weights[5] += 3
  }

  return weightedPick(rng, PRESENT_NAMES, weights)
}

// ── Pipeline helpers ──

/**
 * Find events that have concept overlap with the flaw ("flaw-touched events").
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {string[]} flawConcepts
 * @returns {{ idx: number, score: number }[]}
 */
function findFlawTouchedEvents(graph, world, flawConcepts) {
  /** @type {{ idx: number, score: number }[]} */
  const touched = []
  for (let i = 0; i < world.events.length; i++) {
    const event = world.events[i]
    const eventConcepts = [
      ...event.situation.concepts,
      ...event.action.concepts,
      ...event.consequence.concepts,
      ...event.legacy.concepts,
    ]
    const score = conceptOverlap(graph, flawConcepts, eventConcepts)
    if (score > 0) touched.push({ idx: i, score })
  }
  return touched.sort((a, b) => a.idx - b.idx)
}

/**
 * Build hidden truth chain: flaw → flaw-touched events → crisis.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} flawConcepts
 * @param {{ idx: number, score: number }[]} flawTouchedEvents
 * @param {import('./history.js').MythicEvent[]} events
 * @param {string} crisisBaseConcept
 * @param {number} targetDepth
 * @returns {string[]}
 */
function buildHiddenTruth(graph, rng, flawConcepts, flawTouchedEvents, events, crisisBaseConcept, targetDepth) {
  /** @type {string[]} */
  const chain = []
  const used = new Set()

  // Start with the first flaw concept
  const start = flawConcepts[0]
  if (!start) return [crisisBaseConcept]
  chain.push(start)
  used.add(start)

  // Step through flaw-touched events, picking highest-overlap concept per step
  for (const { idx } of flawTouchedEvents) {
    if (chain.length >= targetDepth - 1) break
    const event = events[idx]
    const eventConcepts = [
      ...event.consequence.concepts,
      ...event.legacy.concepts,
      ...event.action.concepts,
    ]

    const prev = chain[chain.length - 1]
    let bestConcept = ''
    let bestScore = -1
    for (const c of eventConcepts) {
      if (used.has(c)) continue
      const score = conceptOverlap(graph, [prev], [c])
      if (score > bestScore) {
        bestScore = score
        bestConcept = c
      }
    }

    // If no overlap found, pick any unused event concept
    if (!bestConcept) {
      bestConcept = eventConcepts.find(c => !used.has(c)) ?? ''
    }

    if (bestConcept) {
      chain.push(bestConcept)
      used.add(bestConcept)
    }
  }

  // End with the crisis base concept if not already included
  if (!used.has(crisisBaseConcept)) {
    chain.push(crisisBaseConcept)
  }

  // Fill gaps with walkFrom bridging concepts if chain is too short
  while (chain.length < targetDepth && chain.length >= 2) {
    const from = chain[chain.length - 2]
    const walk = walkFrom(graph, rng, from, 2)
    const bridge = walk.path.find(c => !used.has(c))
    if (!bridge) break
    chain.splice(chain.length - 1, 0, bridge)
    used.add(bridge)
  }

  return chain
}

/**
 * Build the crisis object from the archetype shape and world state.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {PresentShape} shape
 * @param {World} world
 * @param {string} recipe
 * @param {{ idx: number, score: number }[]} flawTouchedEvents
 * @param {Set<string>} usedNames
 * @returns {Crisis}
 */
function buildCrisis(graph, rng, shape, world, recipe, flawTouchedEvents, usedNames) {
  const seed = shape.crisisSeed
  const concepts = expandConceptCluster(graph, rng, seed.baseConcept, 3, 6)

  // Score regions by concept overlap with crisis
  const regions = world.chorogony?.regions ?? []
  const regionScores = regions.map(r => ({
    id: r.id,
    score: conceptOverlap(graph, concepts, r.concepts) +
      conceptOverlap(graph, concepts, r.dangers),
  }))
  regionScores.sort((a, b) => b.score - a.score)
  const affectedRegionIds = regionScores.slice(0, 3)
    .filter(r => r.score > 0)
    .map(r => r.id)

  // Latest flaw-touched event index
  const latestEventIndex = flawTouchedEvents.length > 0
    ? flawTouchedEvents[flawTouchedEvents.length - 1].idx
    : -1

  return {
    id: 'crisis-0',
    name: nameRegion(graph, concepts, rng, usedNames),
    type: recipe,
    concepts,
    severity: seed.severity,
    affectedRegionIds,
    flawConnection: seed.flawConcepts.slice(0, 3),
    latestEventIndex,
  }
}

/**
 * Build factions from active polities split by approach to the crisis.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {PresentShape} shape
 * @param {World} world
 * @param {Crisis} crisis
 * @param {Set<string>} usedNames
 * @returns {Faction[]}
 */
function buildFactions(graph, rng, shape, world, crisis, usedNames) {
  const polities = (world.politogony?.polities ?? []).filter(p => p.state !== 'fallen')
  const approaches = shape.factionApproaches
  const religions = world.hierogony?.religions ?? []

  if (polities.length === 0 || approaches.length < 2) {
    // Minimal fallback: two factions with no polities
    return approaches.slice(0, 2).map((approach, i) => ({
      id: `faction-${i}`,
      name: nameRegion(graph, crisis.concepts.slice(0, 2), rng, usedNames),
      approach,
      polityIds: [],
      religionIds: [],
      leaderAgentId: null,
      concepts: crisis.concepts.slice(0, 3),
      strength: /** @type {'desperate'} */ ('desperate'),
    }))
  }

  // Score each polity against each approach
  /** @type {Map<string, string[]>} approach → polityIds */
  const approachPolities = new Map()
  for (const a of approaches) approachPolities.set(a, [])

  for (const polity of polities) {
    let bestApproach = approaches[0]
    let bestScore = -Infinity

    for (let i = 0; i < approaches.length; i++) {
      let score = 0

      // State bias: rising → aggressive (low-index), declining → conservative (high-index)
      if (polity.state === 'rising') score += (approaches.length - 1 - i) * 0.5
      else if (polity.state === 'declining') score += i * 0.5

      // Religion taboo alignment with crisis: biases toward suppressive approaches
      if (polity.religionId) {
        const religion = religions.find(r => r.id === polity.religionId)
        if (religion) {
          const tabooOverlap = conceptOverlap(graph, religion.taboos ?? [], crisis.concepts)
          // Early approaches tend to be more proactive
          if (tabooOverlap > 0 && i <= 1) score += 2
        }
      }

      // Concept overlap between polity and crisis
      const overlap = conceptOverlap(graph, polity.concepts, crisis.concepts)
      // Polities more connected to the crisis are more proactive (lower approach index)
      if (overlap > 0 && i === 0) score += overlap
      else if (overlap === 0 && i >= 2) score += 1

      // Add some seeded randomness to break ties
      score += rng() * 0.3

      if (score > bestScore) {
        bestScore = score
        bestApproach = approaches[i]
      }
    }

    approachPolities.get(bestApproach)?.push(polity.id)
  }

  // Build factions from non-empty approaches, ensure at least 2
  /** @type {Faction[]} */
  const factions = []
  let factionCounter = 0

  for (const approach of approaches) {
    const polityIds = approachPolities.get(approach) ?? []
    if (polityIds.length === 0) continue

    // Collect religions from member polities
    const religionSet = new Set()
    for (const pid of polityIds) {
      const polity = polities.find(p => p.id === pid)
      if (polity?.religionId) religionSet.add(polity.religionId)
    }

    // Find leader: active patron agent from highest-state polity
    let leaderAgentId = null
    for (const pid of polityIds) {
      const polity = polities.find(p => p.id === pid)
      if (polity?.patronAgentId) {
        const agent = findAgent(world, polity.patronAgentId)
        if (agent?.alive && agent.state === 'active') {
          leaderAgentId = agent.id
          break
        }
      }
    }

    // Derive strength from member polity states
    const states = polityIds.map(pid => polities.find(p => p.id === pid)?.state ?? 'stable')
    /** @type {'dominant'|'rising'|'desperate'} */
    let strength = 'rising'
    if (states.includes('rising') && polityIds.length >= 2) strength = 'dominant'
    else if (states.every(s => s === 'declining')) strength = 'desperate'

    // Merge concepts from member polities
    const conceptSet = new Set(crisis.concepts.slice(0, 2))
    for (const pid of polityIds) {
      const polity = polities.find(p => p.id === pid)
      if (polity) {
        for (const c of polity.concepts.slice(0, 2)) conceptSet.add(c)
      }
    }

    factions.push({
      id: `faction-${factionCounter++}`,
      name: nameRegion(graph, [...conceptSet].slice(0, 3), rng, usedNames),
      approach,
      polityIds,
      religionIds: [...religionSet],
      leaderAgentId,
      concepts: [...conceptSet].slice(0, 5),
      strength,
    })
  }

  // If fewer than 2 factions, add leaderless movement factions
  while (factions.length < 2) {
    const unusedApproach = approaches.find(a => !factions.some(f => f.approach === a))
      ?? approaches[factions.length % approaches.length]
    factions.push({
      id: `faction-${factionCounter++}`,
      name: nameRegion(graph, crisis.concepts.slice(0, 2), rng, usedNames),
      approach: unusedApproach,
      polityIds: [],
      religionIds: [],
      leaderAgentId: null,
      concepts: crisis.concepts.slice(0, 3),
      strength: 'desperate',
    })
  }

  return factions
}

/**
 * Build the recent event that tipped the status quo.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {PresentShape} shape
 * @param {World} world
 * @param {Crisis} crisis
 * @param {Set<string>} usedNames
 * @returns {RecentEvent}
 */
function buildRecentEvent(graph, rng, shape, world, crisis, usedNames) {
  const type = shape.recentEventType
  /** @type {string[]} */
  const involvedEntityIds = []
  /** @type {string|null} */
  let regionId = crisis.affectedRegionIds[0] ?? null

  /** @type {string[]} */
  let sourceConcepts = crisis.concepts.slice(0, 3)

  switch (type) {
    case 'death': {
      // Find a recently-dead agent or fallen polity's patron
      const dead = world.agents.find(a => a.state === 'dead' && (a.type === 'god' || a.type === 'demi-god'))
        ?? world.agents.find(a => a.state === 'dead')
      if (dead) {
        involvedEntityIds.push(dead.id)
        sourceConcepts = dead.domains.slice(0, 3)
      }
      break
    }
    case 'discovery': {
      // A ruin or sacred site whose concepts overlap crisis
      const ruins = world.politogony?.ruins ?? []
      const sacredSites = world.hierogony?.sacredSites ?? []
      const ruin = ruins.find(r =>
        conceptOverlap(graph, r.concepts, crisis.concepts) > 0
      )
      if (ruin) {
        involvedEntityIds.push(ruin.id)
        regionId = ruin.regionId
        sourceConcepts = ruin.concepts.slice(0, 3)
      } else if (sacredSites.length > 0) {
        const site = sacredSites[0]
        involvedEntityIds.push(site.id)
        regionId = site.regionId
        sourceConcepts = site.concepts.slice(0, 3)
      }
      break
    }
    case 'breach': {
      // A flaw-creature crossing into a new region
      const flawLife = world.biogony?.flawLife ?? []
      if (flawLife.length > 0) {
        const creature = flawLife[0]
        sourceConcepts = creature.concepts.slice(0, 3)
      }
      // Find a region not in the crisis's affected set
      const regions = world.chorogony?.regions ?? []
      const unaffected = regions.find(r => !crisis.affectedRegionIds.includes(r.id))
      if (unaffected) regionId = unaffected.id
      break
    }
    case 'proclamation': {
      // A faction leader or polity making a claim
      const polities = (world.politogony?.polities ?? []).filter(p => p.state !== 'fallen')
      if (polities.length > 0) {
        const polity = polities[0]
        involvedEntityIds.push(polity.id)
        if (polity.patronAgentId) involvedEntityIds.push(polity.patronAgentId)
        regionId = polity.capitalRegionId
        sourceConcepts = polity.concepts.slice(0, 3)
      }
      break
    }
    case 'omen': {
      // A concept walk from crisis hitting a myth.before concept
      const myth = /** @type {CreationMyth} */ (world.myth)
      const beforeConcepts = myth.before.concepts
      if (beforeConcepts.length > 0) {
        sourceConcepts = [...crisis.concepts.slice(0, 2), beforeConcepts[0]]
      }
      break
    }
    case 'collapse': {
      // A declining polity or failing sacred site
      const declining = (world.politogony?.polities ?? []).find(p => p.state === 'declining')
      if (declining) {
        involvedEntityIds.push(declining.id)
        regionId = declining.capitalRegionId
        sourceConcepts = declining.concepts.slice(0, 3)
      }
      break
    }
  }

  const concepts = expandConceptCluster(graph, rng, sourceConcepts[0] ?? crisis.concepts[0], 2, 4)

  return {
    id: 'recent-event-0',
    name: nameRegion(graph, concepts, rng, usedNames),
    type,
    concepts,
    involvedEntityIds,
    regionId,
  }
}

/**
 * Build active powers from agents currently influencing the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {Crisis} crisis
 * @param {Faction[]} factions
 * @returns {ActivePower[]}
 */
function buildActivePowers(graph, world, crisis, factions) {
  /** @type {ActivePower[]} */
  const powers = []

  // Build faction patron map for alignment lookup
  /** @type {Map<string, string>} agentId → factionId */
  const patronFactionMap = new Map()
  for (const faction of factions) {
    if (faction.leaderAgentId) {
      patronFactionMap.set(faction.leaderAgentId, faction.id)
    }
    // Also check patron agents of member polities
    for (const pid of faction.polityIds) {
      const polity = findPolity(world, pid)
      if (polity?.patronAgentId) {
        patronFactionMap.set(polity.patronAgentId, faction.id)
      }
    }
  }

  for (const agent of world.agents) {
    // Include active/alive agents and notable dormant ones
    const isActive = agent.alive && agent.state === 'active'
    const isDormant = agent.state === 'sleeping' || agent.state === 'imprisoned'
    const isExiled = agent.state === 'exiled'

    if (!isActive && !isDormant && !isExiled) continue

    // Only include spirits/demons if they have crisis overlap
    const domainOverlap = conceptOverlap(graph, agent.domains, crisis.concepts)
    if (!isActive && domainOverlap === 0) continue
    if (isActive && domainOverlap === 0 && agent.type !== 'god' && agent.type !== 'demi-god') continue

    /** @type {string} */
    let currentAction
    if (isDormant) {
      currentAction = 'slumbering'
    } else if (isExiled && domainOverlap > 0) {
      currentAction = 'returning'
    } else if (patronFactionMap.has(agent.id) && factions.length >= 2) {
      currentAction = 'manipulating'
    } else if (domainOverlap > 0 && agent.disposition) {
      // Check if disposition suggests stoking or opposing
      const stokingDispositions = ['wrathful', 'cunning', 'hungry', 'jealous']
      const opposingDispositions = ['merciful', 'patient', 'vigilant', 'grieving']
      if (stokingDispositions.includes(agent.disposition)) currentAction = 'stoking'
      else if (opposingDispositions.includes(agent.disposition)) currentAction = 'opposing'
      else currentAction = 'observing'
    } else {
      currentAction = 'observing'
    }

    // Find region where they are active
    let regionId = null
    if (agent.patronOf && agent.patronOf.length > 0) {
      const polity = findPolity(world, agent.patronOf[0])
      regionId = polity?.capitalRegionId ?? null
    }

    powers.push({
      agentId: agent.id,
      currentAction,
      factionAlignment: patronFactionMap.get(agent.id) ?? null,
      regionId,
      concepts: agent.domains.slice(0, 3),
    })
  }

  return powers
}

/** @type {string[]} */
const DISTORTION_TYPES = ['misattribute', 'invert', 'exaggerate', 'conflate']

/**
 * @typedef {{
 *   id: string,
 *   type: string,
 *   name: string,
 *   concepts: string[],
 *   regionId: string|null,
 * }} RumorEntity
 */

/**
 * Build rumor entity pool from world state.
 * @param {World} world
 * @returns {RumorEntity[]}
 */
function buildEntityPool(world) {
  /** @type {RumorEntity[]} */
  const pool = []

  // Active agents
  for (const agent of world.agents) {
    if (agent.type === 'god' || agent.type === 'demi-god' || agent.type === 'demon') {
      const patronPolity = (world.politogony?.polities ?? []).find(p => p.patronAgentId === agent.id)
      pool.push({
        id: agent.id,
        type: 'agent',
        name: agent.name,
        concepts: agent.domains,
        regionId: patronPolity?.capitalRegionId ?? null,
      })
    }
  }

  // Ruins
  for (const ruin of (world.politogony?.ruins ?? [])) {
    pool.push({
      id: ruin.id,
      type: 'ruin',
      name: ruin.name,
      concepts: ruin.concepts,
      regionId: ruin.regionId,
    })
  }

  // Sacred sites
  for (const site of (world.hierogony?.sacredSites ?? [])) {
    pool.push({
      id: site.id,
      type: 'sacred-site',
      name: site.name,
      concepts: site.concepts,
      regionId: site.regionId,
    })
  }

  // Active polities
  for (const polity of (world.politogony?.polities ?? [])) {
    if (polity.state === 'fallen') continue
    pool.push({
      id: polity.id,
      type: 'polity',
      name: polity.name,
      concepts: polity.concepts,
      regionId: polity.capitalRegionId,
    })
  }

  return pool
}

/** @type {Record<string, string[]>} */
const CLAIM_VERBS = {
  agent: ['dwells in', 'guards', 'has abandoned', 'seeks', 'threatens'],
  ruin: ['contains', 'was built by', 'holds the key to', 'is cursed by', 'conceals'],
  'sacred-site': ['grants visions of', 'has been desecrated by', 'protects', 'channels', 'silences'],
  polity: ['controls', 'seeks alliance with', 'plans to destroy', 'hoards', 'has lost'],
}

/**
 * Negate a verb phrase for "invert" rumor distortion.
 * @param {string} verb
 * @returns {string}
 */
function negateVerb(verb) {
  if (verb.startsWith('has ')) return verb.replace('has ', 'has not ')
  if (verb.startsWith('was ')) return verb.replace('was ', 'was not ')
  if (verb.startsWith('is ')) return verb.replace('is ', 'is not ')
  return 'does not ' + verb.replace(/s$/, '')
}

/**
 * Build rumors — mix of true and false claims about world entities.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {PresentShape} shape
 * @param {World} world
 * @param {Crisis} crisis
 * @returns {Rumor[]}
 */
function buildRumors(graph, rng, shape, world, crisis) {
  const pool = buildEntityPool(world)
  if (pool.length === 0) return []

  const count = Math.min(shape.rumorCount, Math.max(pool.length * 2, 5))
  /** @type {Rumor[]} */
  const rumors = []

  // Weight entities by crisis relevance
  const weights = pool.map(e =>
    1 + conceptOverlap(graph, e.concepts, crisis.concepts)
  )

  for (let i = 0; i < count; i++) {
    const entity = weightedPick(rng, pool, weights)
    const isTrue = rng() < shape.rumorTruthRatio

    const verbs = CLAIM_VERBS[entity.type] ?? CLAIM_VERBS.agent
    const verb = pick(rng, verbs)

    // Pick a target concept for the claim
    const targetConcept = entity.concepts.length > 0
      ? pick(rng, entity.concepts)
      : crisis.concepts[0] ?? 'something'

    /** @type {string|null} */
    let distortion = null
    let claim = `${entity.name} ${verb} ${targetConcept}`

    if (!isTrue) {
      distortion = pick(rng, DISTORTION_TYPES)
      switch (distortion) {
        case 'misattribute': {
          // Swap entity name with a different one of the same type
          const others = pool.filter(e => e.type === entity.type && e.id !== entity.id)
          if (others.length > 0) {
            const other = pick(rng, others)
            claim = `${other.name} ${verb} ${targetConcept}`
          }
          break
        }
        case 'invert':
          claim = `${entity.name} ${negateVerb(verb)} ${targetConcept}`
          break
        case 'exaggerate':
          claim = `${entity.name} ${verb} all ${targetConcept}`
          break
        case 'conflate': {
          // Merge two entities
          const other = pool.find(e => e.id !== entity.id)
          if (other) {
            claim = `${entity.name} and ${other.name} ${verb} ${targetConcept}`
          }
          break
        }
      }
    }

    // Find a region where this rumor circulates
    let regionId = entity.regionId
    if (!regionId) {
      const regions = world.chorogony?.regions ?? []
      if (regions.length > 0) regionId = pick(rng, regions).id
    }

    rumors.push({
      id: `rumor-${i}`,
      claim,
      isTrue,
      referencedEntityId: entity.id,
      referencedEntityType: entity.type,
      distortion,
      concepts: entity.concepts.slice(0, 3),
      regionId,
    })
  }

  return rumors
}

// ── Mutations ──

/**
 * Apply present-layer mutations to earlier entities.
 * @param {World} world
 * @param {Crisis} crisis
 * @param {Faction[]} factions
 * @param {ActivePower[]} activePowers
 */
function applyMutations(world, crisis, factions, activePowers) {
  // Regions get crisisImpact
  const regions = world.chorogony?.regions ?? []
  for (const region of regions) {
    if (crisis.affectedRegionIds[0] === region.id) {
      /** @type {*} */ (region).crisisImpact = 'epicenter'
    } else if (crisis.affectedRegionIds.includes(region.id)) {
      /** @type {*} */ (region).crisisImpact = 'affected'
    }
  }

  // Polities get crisisStance
  for (const faction of factions) {
    for (const pid of faction.polityIds) {
      const polity = findPolity(world, pid)
      if (polity) {
        /** @type {*} */ (polity).crisisStance = faction.approach
      }
    }
  }

  // Agents get presentAction
  for (const power of activePowers) {
    const agent = findAgent(world, power.agentId)
    if (agent) {
      /** @type {*} */ (agent).presentAction = power.currentAction
    }
  }
}

// ── Main entry ──

/**
 * Generate the present state and write it into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generatePresent(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)
  const usedNames = new Set()

  // 1. Select archetype
  const recipe = selectArchetype(rng, myth, world)
  const shapeFn = PRESENT_SHAPES[recipe]

  // 2. Run shape function
  const shape = shapeFn({ graph, rng, myth, world })

  // 3. Find flaw-touched events
  const flawConcepts = myth.flaw.concepts
  const flawTouchedEvents = findFlawTouchedEvents(graph, world, flawConcepts)

  // 4. Build hidden truth chain
  const hiddenTruth = buildHiddenTruth(
    graph, rng, flawConcepts, flawTouchedEvents,
    world.events, shape.crisisSeed.baseConcept, shape.hiddenTruthDepth
  )

  // 5. Build crisis
  const crisis = buildCrisis(graph, rng, shape, world, recipe, flawTouchedEvents, usedNames)

  // 6. Build factions
  const factions = buildFactions(graph, rng, shape, world, crisis, usedNames)

  // 7. Build recent event
  const recentEvent = buildRecentEvent(graph, rng, shape, world, crisis, usedNames)

  // 8. Build active powers
  const activePowers = buildActivePowers(graph, world, crisis, factions)

  // 9. Build rumors
  const rumors = buildRumors(graph, rng, shape, world, crisis)

  // 10. Apply mutations
  applyMutations(world, crisis, factions, activePowers)

  // 11. Set world.present
  world.present = {
    recipe,
    crisis,
    factions,
    recentEvent,
    rumors,
    activePowers,
    hiddenTruth,
  }
}
