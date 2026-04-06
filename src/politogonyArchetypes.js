/**
 * Politogony archetype functions.
 * Each archetype determines how power structures emerge from the world's
 * mythology, peoples, regions, and religions.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 */
import { walkFrom } from './walker.js'

// ── Context and shape types ──

/**
 * @typedef {{
 *   graph: ConceptGraph,
 *   rng: () => number,
 *   myth: CreationMyth,
 *   world: World,
 * }} PolitogonyContext
 */

/**
 * @typedef {{
 *   baseConcept: string,
 *   peopleHint: string|null,
 *   patronAgentHint: string|null,
 *   religionHint: string|null,
 *   stateHint: 'rising'|'stable'|'declining'|'fallen'|null,
 *   governanceType: string,
 * }} PolitySeed
 */

/**
 * @typedef {{
 *   politySeeds: PolitySeed[],
 *   conflictBias: 'high'|'medium'|'low',
 *   allianceBias: 'high'|'medium'|'low',
 *   ruinChance: number,
 *   legendStyle: string,
 * }} PolitogonyShape
 */

// ── Archetypes ──

/**
 * Theocracy — gods rule through priests; one polity per religion.
 * @param {PolitogonyContext} ctx
 * @returns {PolitogonyShape}
 */
function theocracy(ctx) {
  const { graph, rng, myth, world } = ctx
  const religions = world.hierogony?.religions ?? []
  const peoples = world.anthropogony?.peoples ?? []

  /** @type {PolitySeed[]} */
  const seeds = []

  for (const religion of religions) {
    const peopleName = religion.peoples[0] ?? peoples[0]?.name ?? null
    const agentId = religion.worshippedAgents[0] ?? null

    seeds.push({
      baseConcept: religion.concepts[0] ?? myth.act.concepts[0] ?? 'light',
      peopleHint: peopleName,
      patronAgentHint: agentId,
      religionHint: religion.id,
      stateHint: null,
      governanceType: 'theocracy',
    })
  }

  if (seeds.length === 0) {
    seeds.push({
      baseConcept: myth.act.concepts[0] ?? 'light',
      peopleHint: peoples[0]?.name ?? null,
      patronAgentHint: null,
      religionHint: null,
      stateHint: null,
      governanceType: 'theocracy',
    })
  }

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    politySeeds: seeds,
    conflictBias: 'medium',
    allianceBias: 'high',
    ruinChance: 0.3,
    legendStyle: 'glorifies',
  }
}

/**
 * Conquest — one people dominates by force; creates conqueror + vassals.
 * @param {PolitogonyContext} ctx
 * @returns {PolitogonyShape}
 */
function conquest(ctx) {
  const { graph, rng, myth, world } = ctx
  const peoples = world.anthropogony?.peoples ?? []
  const regions = world.chorogony?.regions ?? []

  // Find the people with the most region placements
  const placementCounts = new Map()
  for (const region of regions) {
    for (const peopleName of region.peoples) {
      placementCounts.set(peopleName, (placementCounts.get(peopleName) ?? 0) + 1)
    }
  }

  const sorted = [...placementCounts.entries()].sort((a, b) => b[1] - a[1])
  const dominantPeople = sorted[0]?.[0] ?? peoples[0]?.name ?? null
  const dominantObj = peoples.find(p => p.name === dominantPeople)

  /** @type {PolitySeed[]} */
  const seeds = []

  // Dominant polity
  seeds.push({
    baseConcept: dominantObj?.concepts[0] ?? myth.act.concepts[0] ?? 'iron',
    peopleHint: dominantPeople,
    patronAgentHint: dominantObj?.patronAgent ?? null,
    religionHint: dominantObj?.religion ?? null,
    stateHint: 'rising',
    governanceType: 'warlord',
  })

  // Vassal/resister polities from remaining peoples
  for (const people of peoples) {
    if (seeds.length >= 4) break
    if (people.name === dominantPeople) continue
    seeds.push({
      baseConcept: people.concepts[0] ?? myth.flaw.concepts[0] ?? 'stone',
      peopleHint: people.name,
      patronAgentHint: people.patronAgent,
      religionHint: people.religion,
      stateHint: 'declining',
      governanceType: 'tribal',
    })
  }

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    politySeeds: seeds,
    conflictBias: 'high',
    allianceBias: 'low',
    ruinChance: 0.7,
    legendStyle: 'claims-credit',
  }
}

/**
 * Confederation — peoples united by shared threat or resource.
 * @param {PolitogonyContext} ctx
 * @returns {PolitogonyShape}
 */
function confederation(ctx) {
  const { graph, rng, myth, world } = ctx
  const peoples = world.anthropogony?.peoples ?? []
  const disputes = world.anthropogony?.disputes ?? []

  // One polity per people, united by shared flaw/danger
  const sharedThreat = disputes[0] ?? myth.flaw.concepts[0] ?? 'shadow'

  /** @type {PolitySeed[]} */
  const seeds = []

  for (const people of peoples) {
    if (seeds.length >= 5) break
    seeds.push({
      baseConcept: people.concepts[0] ?? sharedThreat,
      peopleHint: people.name,
      patronAgentHint: people.patronAgent,
      religionHint: people.religion,
      stateHint: 'stable',
      governanceType: 'council',
    })
  }

  if (seeds.length === 0) {
    seeds.push({
      baseConcept: sharedThreat,
      peopleHint: null,
      patronAgentHint: null,
      religionHint: null,
      stateHint: 'stable',
      governanceType: 'council',
    })
  }

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    politySeeds: seeds,
    conflictBias: 'low',
    allianceBias: 'high',
    ruinChance: 0.4,
    legendStyle: 'fears',
  }
}

/**
 * Dynasty — a god's bloodline rules; primary branch + rivals.
 * @param {PolitogonyContext} ctx
 * @returns {PolitogonyShape}
 */
function dynasty(ctx) {
  const { graph, rng, myth, world } = ctx
  const peoples = world.anthropogony?.peoples ?? []

  // Find a patron god (prefer creator, then active god)
  const patron = world.agents.find(
    a => a.mythRole === 'creator' && (a.type === 'god' || a.type === 'demi-god')
  ) ?? world.agents.find(a => a.type === 'god' && a.alive)

  // Primary dynasty: largest people with that patron
  const patronedPeople = patron
    ? peoples.find(p => p.patronAgent === patron.id) ?? peoples[0]
    : peoples[0]

  /** @type {PolitySeed[]} */
  const seeds = []

  // Primary branch
  seeds.push({
    baseConcept: patron?.domains[0] ?? myth.act.concepts[0] ?? 'crown',
    peopleHint: patronedPeople?.name ?? null,
    patronAgentHint: patron?.id ?? null,
    religionHint: patronedPeople?.religion ?? null,
    stateHint: 'stable',
    governanceType: 'dynasty',
  })

  // Rival branch (same people, different concept root)
  if (patronedPeople) {
    const rivalConcept = patronedPeople.concepts[1] ?? myth.cost.concepts[0] ?? 'blood'
    seeds.push({
      baseConcept: rivalConcept,
      peopleHint: patronedPeople.name,
      patronAgentHint: null,
      religionHint: patronedPeople.religion,
      stateHint: 'rising',
      governanceType: 'dynasty',
    })
  }

  // Independent peoples
  for (const people of peoples) {
    if (seeds.length >= 5) break
    if (people.name === patronedPeople?.name) continue
    seeds.push({
      baseConcept: people.concepts[0] ?? myth.flaw.concepts[0] ?? 'stone',
      peopleHint: people.name,
      patronAgentHint: people.patronAgent,
      religionHint: people.religion,
      stateHint: null,
      governanceType: 'tribal',
    })
  }

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    politySeeds: seeds,
    conflictBias: 'medium',
    allianceBias: 'medium',
    ruinChance: 0.5,
    legendStyle: 'claims-credit',
  }
}

/**
 * Merchant — trade routes and resources drive political power.
 * @param {PolitogonyContext} ctx
 * @returns {PolitogonyShape}
 */
function merchant(ctx) {
  const { graph, rng, myth, world } = ctx
  const regions = world.chorogony?.regions ?? []
  const peoples = world.anthropogony?.peoples ?? []

  // Find resource-rich regions and seed polities from their dominant peoples
  const resourceRegions = [...regions]
    .sort((a, b) => b.resources.length - a.resources.length)

  /** @type {PolitySeed[]} */
  const seeds = []
  const usedPeoples = new Set()

  for (const region of resourceRegions) {
    if (seeds.length >= 4) break
    const peopleName = region.peoples[0]
    if (!peopleName || usedPeoples.has(peopleName)) continue
    usedPeoples.add(peopleName)

    const people = peoples.find(p => p.name === peopleName)

    seeds.push({
      baseConcept: region.resources[0] ?? region.concepts[0] ?? 'gold',
      peopleHint: peopleName,
      patronAgentHint: people?.patronAgent ?? null,
      religionHint: people?.religion ?? null,
      stateHint: null,
      governanceType: 'merchant-league',
    })
  }

  // Fill remaining from unplaced peoples
  for (const people of peoples) {
    if (seeds.length >= 5) break
    if (usedPeoples.has(people.name)) continue
    seeds.push({
      baseConcept: people.concepts[0] ?? myth.act.concepts[0] ?? 'salt',
      peopleHint: people.name,
      patronAgentHint: people.patronAgent,
      religionHint: people.religion,
      stateHint: null,
      governanceType: 'merchant-league',
    })
  }

  if (seeds.length === 0) {
    seeds.push({
      baseConcept: myth.act.concepts[0] ?? 'gold',
      peopleHint: peoples[0]?.name ?? null,
      patronAgentHint: null,
      religionHint: null,
      stateHint: null,
      governanceType: 'merchant-league',
    })
  }

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    politySeeds: seeds,
    conflictBias: 'medium',
    allianceBias: 'high',
    ruinChance: 0.5,
    legendStyle: 'denies',
  }
}

/**
 * Remnant — polities formed from ruins of something greater.
 * @param {PolitogonyContext} ctx
 * @returns {PolitogonyShape}
 */
function remnant(ctx) {
  const { graph, rng, myth, world } = ctx
  const peoples = world.anthropogony?.peoples ?? []

  // The fallen empire: use a dead/sleeping/imprisoned agent
  const fallenAgent = world.agents.find(
    a => (a.state === 'dead' || a.state === 'sleeping' || a.state === 'imprisoned') &&
         (a.type === 'god' || a.type === 'demi-god')
  ) ?? world.agents.find(a => a.state === 'dead')

  /** @type {PolitySeed[]} */
  const seeds = []

  // The fallen polity
  seeds.push({
    baseConcept: fallenAgent?.domains[0] ?? myth.cost.concepts[0] ?? 'ash',
    peopleHint: peoples[0]?.name ?? null,
    patronAgentHint: fallenAgent?.id ?? null,
    religionHint: null,
    stateHint: 'fallen',
    governanceType: 'dynasty',
  })

  // Successor polities from remaining peoples
  for (const people of peoples) {
    if (seeds.length >= 5) break
    seeds.push({
      baseConcept: people.concepts[0] ?? myth.flaw.concepts[0] ?? 'dust',
      peopleHint: people.name,
      patronAgentHint: people.patronAgent,
      religionHint: people.religion,
      stateHint: seeds.length === 1 ? 'rising' : null,
      governanceType: 'tribal',
    })
  }

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    politySeeds: seeds,
    conflictBias: 'high',
    allianceBias: 'low',
    ruinChance: 1.0,
    legendStyle: 'mourns',
  }
}

// ── Registry ──

/** @type {string[]} */
export const POLITOGONY_NAMES = [
  'theocracy', 'conquest', 'confederation', 'dynasty', 'merchant', 'remnant',
]

/** @type {Record<string, (ctx: PolitogonyContext) => PolitogonyShape>} */
export const POLITOGONY_SHAPES = {
  theocracy,
  conquest,
  confederation,
  dynasty,
  merchant,
  remnant,
}
