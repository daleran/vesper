/**
 * Politogony generator — determines what power structures exist, what
 * kingdoms rose and fell. Writes polities, conflicts, alliances, ruins,
 * and legends into the shared World object.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 * @import { Agent } from './pantheon.js'
 * @import { ChorogonyRegion } from './chorogony.js'
 */
import { weightedPick, conceptOverlap } from './utils.js'
import { walkFrom } from './walker.js'
import { nameRegion } from './naming.js'
import { findAgent } from './world.js'
import { query } from './query.js'
import { POLITOGONY_SHAPES, POLITOGONY_NAMES } from './politogonyArchetypes.js'
import {
  DELIBERATE_RECIPES,
  VIOLENT_RECIPES,
  ORGANIC_RECIPES,
  CYCLIC_RECIPES,
  applyRecipeBonuses,
} from './archetypeSelection.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   peopleId: string,
 *   regionIds: string[],
 *   capitalRegionId: string|null,
 *   patronAgentId: string|null,
 *   religionId: string|null,
 *   state: 'rising'|'stable'|'declining'|'fallen',
 *   governanceType: string,
 *   concepts: string[],
 *   resources: string[],
 * }} Polity
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   polityIds: [string, string],
 *   cause: string,
 *   concepts: string[],
 *   intensity: 'cold'|'simmering'|'open',
 * }} Conflict
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   polityIds: string[],
 *   basis: string,
 *   concepts: string[],
 * }} Alliance
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   regionId: string,
 *   formerPolityId: string,
 *   concepts: string[],
 *   whatRemains: string[],
 * }} Ruin
 */

/**
 * @typedef {{
 *   id: string,
 *   polityId: string,
 *   eventIndex: number,
 *   interpretation: string,
 *   concepts: string[],
 * }} Legend
 */

/**
 * @typedef {{
 *   recipe: string,
 *   polities: Polity[],
 *   conflicts: Conflict[],
 *   alliances: Alliance[],
 *   ruins: Ruin[],
 *   legends: Legend[],
 * }} PolitogonyData
 */

// ── Helpers ──

/** Conflict bias thresholds: minimum score to keep a conflict. */
const CONFLICT_THRESHOLDS = /** @type {Record<string, number>} */ ({
  high: 3,
  medium: 5,
  low: 7,
})

/** Alliance bias thresholds: minimum score to keep an alliance. */
const ALLIANCE_THRESHOLDS = /** @type {Record<string, number>} */ ({
  high: 3,
  medium: 5,
  low: 7,
})

/** @type {string[]} */
const INTERPRETATION_POOL = ['glorifies', 'denies', 'mourns', 'fears', 'claims-credit']

// ── Archetype selection ──

/**
 * Select a politogony archetype using weighted signals.
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {World} world
 * @returns {string}
 */
export function selectArchetype(rng, myth, world) {
  // [theocracy, conquest, confederation, dynasty, merchant, remnant]
  const weights = [1, 1, 1, 1, 1, 1]

  // Recipe-based bonuses
  applyRecipeBonuses(weights, myth.recipe, [
    { recipes: DELIBERATE_RECIPES, indices: [0, 3], bonus: 3 },
    { recipes: VIOLENT_RECIPES, indices: [1], bonus: 3 },
    { recipes: VIOLENT_RECIPES, indices: [5], bonus: 2 },
    { recipes: ORGANIC_RECIPES, indices: [2], bonus: 3 },
    { recipes: CYCLIC_RECIPES, indices: [5], bonus: 3 },
  ])

  // World-state bonuses
  const religions = world.hierogony?.religions ?? []
  if (religions.length >= 3) weights[0] += 2

  const hasDeadCreator = world.agents.some(
    a => a.state === 'dead' && a.mythRole === 'creator'
  )
  if (hasDeadCreator) {
    weights[3] += 2
    weights[5] += 2
  }

  if (world.agents.some(a => a.type === 'demon' && a.alive)) {
    weights[1] += 2
  }

  const disputes = world.anthropogony?.disputes ?? []
  if (disputes.length >= 2) weights[2] += 2

  // Count distinct resources across regions
  const allResources = new Set(
    (world.chorogony?.regions ?? []).flatMap(r => r.resources)
  )
  if (allResources.size >= 4) weights[4] += 3

  // History event archetypes
  for (const event of world.events) {
    if (event.archetype === 'sundering' || event.archetype === 'corruption') {
      weights[5] += 3
      break
    }
  }

  return weightedPick(rng, POLITOGONY_NAMES, weights)
}

// ── Main entry ──

/**
 * Generate politogony and write power structure data into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generatePolitogony(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)
  const peoples = world.anthropogony?.peoples ?? []
  const regions = world.chorogony?.regions ?? []
  const sacredSites = world.hierogony?.sacredSites ?? []

  // 1. Select archetype
  const recipe = selectArchetype(rng, myth, world)
  const shapeFn = POLITOGONY_SHAPES[recipe]

  // 2. Run archetype shape function
  const shape = shapeFn({ graph, rng, myth, world })

  // 3. Expand polity seeds into full Polity objects
  /** @type {Polity[]} */
  const polities = []
  const usedNames = new Set()
  let polityCounter = 0

  for (const seed of shape.politySeeds) {
    const chain = walkFrom(graph, rng, seed.baseConcept, 3, {
      preferRelations: ['evokes', 'rhymes'],
    })
    const conceptCluster = [...new Set(chain.path)].slice(0, 6)

    // Resolve people
    let peopleId = seed.peopleHint
    if (!peopleId && peoples.length > 0) {
      let bestScore = -1
      for (const p of peoples) {
        const score = conceptOverlap(graph, p.concepts, conceptCluster)
        if (score > bestScore) {
          bestScore = score
          peopleId = p.name
        }
      }
    }

    // Resolve religion
    let religionId = seed.religionHint
    if (!religionId && peopleId) {
      const people = peoples.find(p => p.name === peopleId)
      religionId = people?.religion ?? null
    }

    // Resolve patron agent
    const patronAgentId = seed.patronAgentHint ?? (
      peopleId ? peoples.find(p => p.name === peopleId)?.patronAgent ?? null : null
    )

    const name = nameRegion(graph, conceptCluster, rng, { usedNames, entityType: 'polity', morphemes: world.morphemes })

    // Resolve state
    /** @type {'rising'|'stable'|'declining'|'fallen'} */
    let state
    if (seed.stateHint) {
      state = seed.stateHint
    } else {
      const roll = rng()
      state = roll < 0.3 ? 'rising' : roll < 0.7 ? 'stable' : 'declining'
    }

    polities.push({
      id: `polity-${polityCounter++}`,
      name,
      peopleId: peopleId ?? 'unknown',
      regionIds: [],
      capitalRegionId: null,
      patronAgentId,
      religionId,
      state,
      governanceType: seed.governanceType,
      concepts: conceptCluster,
      resources: [],
    })
  }

  // 4. Assign regions to non-fallen polities
  const activePolities = polities.filter(p => p.state !== 'fallen')

  // Build sacred site map for scoring
  const sacredSiteReligionByRegion = new Map()
  for (const site of sacredSites) {
    if (!sacredSiteReligionByRegion.has(site.regionId)) {
      sacredSiteReligionByRegion.set(site.regionId, new Set())
    }
    sacredSiteReligionByRegion.get(site.regionId).add(site.religionId)
  }

  if (activePolities.length > 0 && regions.length > 0) {
    // Score each region for each polity
    /** @type {Map<string, { polity: Polity, score: number }[]>} */
    const regionScores = new Map()

    for (const region of regions) {
      const scores = activePolities.map(polity => {
        let score = conceptOverlap(graph, polity.concepts, region.concepts)

        // People match bonus
        if (region.peoples.includes(polity.peopleId)) score += 3

        // Sacred site religion match bonus
        const siteReligions = sacredSiteReligionByRegion.get(region.id)
        if (siteReligions && polity.religionId && siteReligions.has(polity.religionId)) {
          score += 2
        }

        return { polity, score }
      })

      scores.sort((a, b) => b.score - a.score)
      regionScores.set(region.id, scores)
    }

    // Assign each region to highest-scoring polity
    for (const [regionId, scores] of regionScores) {
      if (scores.length > 0) {
        scores[0].polity.regionIds.push(regionId)
      }
    }

    // Ensure every active polity has at least 1 region
    for (const polity of activePolities) {
      if (polity.regionIds.length > 0) continue

      // Steal the lowest-scored region from the polity with the most regions
      const richest = [...activePolities]
        .filter(p => p.regionIds.length > 1)
        .sort((a, b) => b.regionIds.length - a.regionIds.length)[0]

      if (richest) {
        // Find the region where this polity scores best among richest's regions
        let bestRegionId = richest.regionIds[richest.regionIds.length - 1]
        let bestScore = -1

        for (const rid of richest.regionIds) {
          const scores = regionScores.get(rid)
          const myScore = scores?.find(s => s.polity === polity)?.score ?? 0
          if (myScore > bestScore) {
            bestScore = myScore
            bestRegionId = rid
          }
        }

        richest.regionIds = richest.regionIds.filter(id => id !== bestRegionId)
        polity.regionIds.push(bestRegionId)
      } else if (regions.length > 0) {
        // Last resort: share a region
        polity.regionIds.push(regions[Math.floor(rng() * regions.length)].id)
      }
    }

    // Set capital and collect resources
    for (const polity of activePolities) {
      if (polity.regionIds.length > 0) {
        // Capital = highest scoring region
        let bestId = polity.regionIds[0]
        let bestScore = -1
        for (const rid of polity.regionIds) {
          const scores = regionScores.get(rid)
          const score = scores?.find(s => s.polity === polity)?.score ?? 0
          if (score > bestScore) {
            bestScore = score
            bestId = rid
          }
        }
        polity.capitalRegionId = bestId
      }

      // Collect resources from controlled regions, capped at 8
      const MAX_POLITY_RESOURCES = 8
      const resourceCounts = new Map()
      for (const rid of polity.regionIds) {
        const region = regions.find(r => r.id === rid)
        if (region) {
          for (const res of region.resources) {
            resourceCounts.set(res, (resourceCounts.get(res) ?? 0) + 1)
          }
        }
      }
      polity.resources = [...resourceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_POLITY_RESOURCES)
        .map(([res]) => res)
    }
  }

  // 5. Generate ruins from fallen and declining polities
  /** @type {Ruin[]} */
  const ruins = []
  let ruinCounter = 0

  for (const polity of polities) {
    const shouldRuin = polity.state === 'fallen' ||
      (polity.state === 'declining' && rng() < shape.ruinChance)

    if (!shouldRuin) continue

    // Pick a region for the ruin
    let regionId = polity.regionIds[0] ?? polity.capitalRegionId
    if (!regionId && regions.length > 0) {
      regionId = regions[Math.floor(rng() * regions.length)].id
    }
    if (!regionId) continue

    // Derive whatRemains from concept walks
    const remains = new Set()
    for (const c of polity.concepts.slice(0, 3)) {
      if (remains.size >= 3) break
      const materials = query(graph).nearby(c, 1).where('is', 'material').get()
      for (const m of materials.slice(0, 1)) {
        remains.add(m)
      }
    }
    // Fallback: use concepts directly
    if (remains.size === 0) {
      for (const c of polity.concepts.slice(0, 2)) remains.add(c)
    }

    const ruinName = nameRegion(graph, polity.concepts.slice(0, 3), rng, { usedNames, entityType: 'place', morphemes: world.morphemes })

    ruins.push({
      id: `ruin-${ruinCounter++}`,
      name: ruinName,
      regionId,
      formerPolityId: polity.id,
      concepts: polity.concepts.slice(0, 4),
      whatRemains: [...remains].slice(0, 3),
    })
  }

  // 6. Generate conflicts between polity pairs
  /** @type {Conflict[]} */
  const conflicts = []
  let conflictCounter = 0
  const threshold = CONFLICT_THRESHOLDS[shape.conflictBias] ?? 5

  // Build heresy targets map: religionId → set of concepts denied
  const heresyTargets = new Map()
  for (const heresy of (world.hierogony?.heresies ?? [])) {
    if (!heresyTargets.has(heresy.religionId)) {
      heresyTargets.set(heresy.religionId, new Set())
    }
    for (const c of heresy.denies) {
      heresyTargets.get(heresy.religionId).add(c)
    }
  }

  for (let i = 0; i < activePolities.length; i++) {
    if (conflicts.length >= 4) break
    for (let j = i + 1; j < activePolities.length; j++) {
      if (conflicts.length >= 4) break
      const a = activePolities[i]
      const b = activePolities[j]

      let score = 0
      let topCause = 'border'

      // Different religions
      if (a.religionId && b.religionId && a.religionId !== b.religionId) {
        score += 3
        topCause = 'heresy'
      }

      // Heresy relationship
      if (a.religionId && heresyTargets.has(a.religionId) && b.religionId === a.religionId) {
        score += 4
        topCause = 'heresy'
      }

      // Shared border (overlapping region concepts)
      const aRegionConcepts = a.regionIds.flatMap(rid =>
        regions.find(r => r.id === rid)?.concepts ?? []
      )
      const bRegionConcepts = b.regionIds.flatMap(rid =>
        regions.find(r => r.id === rid)?.concepts ?? []
      )
      const sharedRegionConcepts = aRegionConcepts.filter(c => bRegionConcepts.includes(c))
      if (sharedRegionConcepts.length > 0) {
        score += 2
        if (topCause === 'border') topCause = 'border'
      }

      // Resource overlap
      const sharedResources = a.resources.filter(r => b.resources.includes(r))
      if (sharedResources.length > 0) {
        score += 2
        if (score <= 4) topCause = 'resource'
      }

      if (score < threshold) continue

      const conflictConcepts = [
        ...sharedRegionConcepts.slice(0, 2),
        ...sharedResources.slice(0, 1),
        ...a.concepts.slice(0, 1),
      ].slice(0, 4)

      /** @type {'cold'|'simmering'|'open'} */
      const intensity = score >= 8 ? 'open' : score >= 5 ? 'simmering' : 'cold'

      const conflictName = nameRegion(graph, conflictConcepts, rng, { usedNames, entityType: 'event', morphemes: world.morphemes })

      conflicts.push({
        id: `conflict-${conflictCounter++}`,
        name: conflictName,
        polityIds: [a.id, b.id],
        cause: topCause,
        concepts: conflictConcepts,
        intensity,
      })
    }
  }

  // 7. Generate alliances between non-conflicting polity pairs
  /** @type {Alliance[]} */
  const alliances = []
  let allianceCounter = 0
  const allianceThreshold = ALLIANCE_THRESHOLDS[shape.allianceBias] ?? 5

  // Build conflict set for quick lookup
  const conflictPairs = new Set(
    conflicts.map(c => `${c.polityIds[0]}:${c.polityIds[1]}`)
  )

  for (let i = 0; i < activePolities.length; i++) {
    if (alliances.length >= 3) break
    for (let j = i + 1; j < activePolities.length; j++) {
      if (alliances.length >= 3) break
      const a = activePolities[i]
      const b = activePolities[j]

      // Skip if in conflict
      if (conflictPairs.has(`${a.id}:${b.id}`) || conflictPairs.has(`${b.id}:${a.id}`)) {
        continue
      }

      let score = 0
      let topBasis = 'kinship'

      // Same religion
      if (a.religionId && b.religionId && a.religionId === b.religionId) {
        score += 4
        topBasis = 'religion'
      }

      // Shared patron agent
      if (a.patronAgentId && b.patronAgentId && a.patronAgentId === b.patronAgentId) {
        score += 3
        if (topBasis === 'kinship') topBasis = 'kinship'
      }

      // Common enemy (both in conflict with same third polity)
      for (const c of conflicts) {
        const involved = c.polityIds
        const aInvolved = involved.includes(a.id)
        const bInvolved = involved.includes(b.id)
        if ((aInvolved && !bInvolved) || (!aInvolved && bInvolved)) {
          // One is in conflict with a third party — check if the other is too
          const enemy = aInvolved
            ? involved.find(id => id !== a.id)
            : involved.find(id => id !== b.id)
          if (enemy) {
            const otherConflicts = conflicts.filter(c2 =>
              c2.polityIds.includes(enemy) &&
              (c2.polityIds.includes(a.id) || c2.polityIds.includes(b.id)) &&
              c2 !== c
            )
            if (otherConflicts.length > 0) {
              score += 3
              topBasis = 'common-enemy'
            }
          }
        }
      }

      // Shared resources (trade)
      const sharedResources = a.resources.filter(r => b.resources.includes(r))
      if (sharedResources.length > 0) {
        score += 2
        if (topBasis === 'kinship') topBasis = 'trade'
      }

      if (score < allianceThreshold) continue

      const allianceConcepts = [
        ...a.concepts.slice(0, 2),
        ...b.concepts.slice(0, 2),
      ].slice(0, 4)

      const allianceName = nameRegion(graph, allianceConcepts, rng, { usedNames, entityType: 'polity', morphemes: world.morphemes })

      alliances.push({
        id: `alliance-${allianceCounter++}`,
        name: allianceName,
        polityIds: [a.id, b.id],
        basis: topBasis,
        concepts: allianceConcepts,
      })
    }
  }

  // 8. Generate legends — each polity reinterprets 1-2 events
  /** @type {Legend[]} */
  const legends = []
  let legendCounter = 0

  for (const polity of activePolities) {
    if (world.events.length === 0) break

    // Score events by concept overlap + patron involvement
    const eventScores = world.events.map((event, idx) => {
      let score = conceptOverlap(graph, polity.concepts, [
        ...event.situation.concepts,
        ...event.action.concepts,
        ...event.consequence.concepts,
        ...event.legacy.concepts,
      ])

      // Patron involvement bonus
      if (polity.patronAgentId) {
        if (event.agentChanges.some(c => c.agentId === polity.patronAgentId)) score += 3
      }

      return { idx, score }
    })

    eventScores.sort((a, b) => b.score - a.score)
    const topEvents = eventScores.slice(0, 2).filter(e => e.score > 0)

    for (let k = 0; k < topEvents.length; k++) {
      const { idx } = topEvents[k]
      const event = world.events[idx]

      // Primary interpretation from archetype style; secondary varies
      const interpretation = k === 0
        ? shape.legendStyle
        : INTERPRETATION_POOL[Math.floor(rng() * INTERPRETATION_POOL.length)]

      // Emphasized concepts: event concepts that overlap with polity concepts
      const eventConcepts = [
        ...event.situation.concepts,
        ...event.action.concepts,
        ...event.consequence.concepts,
      ]
      const emphasized = eventConcepts.filter(c =>
        polity.concepts.includes(c) ||
        conceptOverlap(graph, [c], polity.concepts) > 0
      ).slice(0, 3)

      if (emphasized.length === 0) {
        emphasized.push(...eventConcepts.slice(0, 2))
      }

      legends.push({
        id: `legend-${legendCounter++}`,
        polityId: polity.id,
        eventIndex: idx,
        interpretation,
        concepts: emphasized,
      })
    }
  }

  // 9. Apply mutations to earlier entities

  // Regions get controlledBy
  for (const polity of activePolities) {
    for (const regionId of polity.regionIds) {
      const region = regions.find(r => r.id === regionId)
      if (region) {
        region.controlledBy = polity.id
      }
    }
  }

  // Agents get patronOf
  for (const polity of polities) {
    if (!polity.patronAgentId) continue
    const agent = findAgent(world, polity.patronAgentId)
    if (agent && !agent.patronOf.includes(polity.id)) {
      agent.patronOf.push(polity.id)
    }
  }

  // 10. Set world.politogony
  world.politogony = {
    recipe,
    polities,
    conflicts,
    alliances,
    ruins,
    legends,
  }
}
