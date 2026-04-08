/**
 * Hierogony generator — determines what peoples believe and how those
 * beliefs divide them. Writes religions, heresies, sacred sites, and
 * practices into the shared World object.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 * @import { Agent } from './pantheon.js'
 * @import { Landmark } from './geogony.js'
 * @import { People } from './anthropogony.js'
 */
import { weightedPick, conceptOverlap } from './utils.js'
import { walkFrom } from './walker.js'
import { nameRegion } from './naming.js'
import { findAgent } from './world.js'
import { DELIBERATE_RECIPES, CYCLIC_RECIPES, THREAT_RECIPES } from './archetypeSelection.js'
import { HIEROGONY_SHAPES, HIEROGONY_NAMES } from './hierogonyArchetypes.js'
import { TUNING, proportion } from './tuning.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   peoples: string[],
 *   worshippedAgents: string[],
 *   taboos: string[],
 *   rites: string[],
 *   concepts: string[],
 *   originEvent: string,
 * }} Religion
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   religionId: string,
 *   denies: string[],
 *   claims: string[],
 *   origin: string,
 *   concepts: string[],
 * }} Heresy
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   regionId: string,
 *   landmarkName: string,
 *   religionId: string,
 *   concepts: string[],
 * }} SacredSite
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   religionId: string,
 *   type: 'rite'|'taboo'|'observance',
 *   concepts: string[],
 * }} Practice
 */

/**
 * @typedef {{
 *   recipe: string,
 *   religions: Religion[],
 *   heresies: Heresy[],
 *   sacredSites: SacredSite[],
 *   practices: Practice[],
 * }} HierogonyData
 */

// ── Helpers ──

/**
 * Find myth concepts within 1 hop of a target concept cluster.
 * @param {ConceptGraph} graph
 * @param {string[]} mythConcepts
 * @param {string[]} targetConcepts
 * @param {number} max
 * @returns {string[]}
 */
function findNearby(graph, mythConcepts, targetConcepts, max) {
  const targetSet = new Set(targetConcepts)
  /** @type {string[]} */
  const found = []

  for (const mc of mythConcepts) {
    if (found.length >= max) break

    if (targetSet.has(mc)) {
      found.push(mc)
      continue
    }

    const edges = graph.get(mc)
    if (!edges) continue
    for (const e of edges) {
      if (targetSet.has(e.concept)) {
        found.push(mc)
        break
      }
    }
  }

  if (found.length === 0 && mythConcepts.length > 0) {
    found.push(mythConcepts[0])
  }

  return found.slice(0, max)
}

// ── Archetype selection ──

/**
 * Select a hierogony archetype using weighted signals.
 * @param {() => number} rng
 * @param {CreationMyth} myth
 * @param {World} world
 * @returns {string}
 */
export function selectArchetype(rng, myth, world) {
  // [revelation, tradition, mystery, gratitude, fear, schism]
  const weights = [1, 1, 1, 1, 1, 1]

  // Deliberate recipes -> revelation
  if (DELIBERATE_RECIPES.has(myth.recipe)) weights[0] += 3
  if (world.agents.some(a => a.mythRole === 'creator' && a.alive)) weights[0] += 2

  // Cycle/ancestral -> tradition
  if (CYCLIC_RECIPES.has(myth.recipe)) weights[1] += 3
  if (world.agents.some(a => a.type === 'ancestor')) weights[1] += 2
  const peoples = world.anthropogony?.peoples ?? []
  const sharedRemembers = new Set(peoples.flatMap(p => p.remembers))
  if (sharedRemembers.size >= 2) weights[1] += 2

  // Dream/taboo -> mystery
  if (myth.recipe === 'dream' || myth.recipe === 'taboo') weights[2] += 3
  if (myth.flaw.concepts.length >= 3) weights[2] += 2

  // Symbiosis/active patrons -> gratitude
  if (myth.recipe === 'symbiosis') weights[3] += 3
  const patronIds = new Set(peoples.map(p => p.patronAgent).filter(id => id !== null))
  if (patronIds.size >= 2) weights[3] += 2

  // Threat recipes -> fear
  if (THREAT_RECIPES.has(myth.recipe)) weights[4] += 3
  if ((world.biogony?.flawLife ?? []).length > 0) weights[4] += 2
  if (world.agents.some(a => a.type === 'demon')) weights[4] += 2

  // Splitting/rebellion + disputes -> schism
  if (myth.recipe === 'splitting' || myth.recipe === 'rebellion') weights[5] += 3
  if ((world.anthropogony?.disputes ?? []).length >= 2) weights[5] += 3

  return weightedPick(rng, HIEROGONY_NAMES, weights)
}

// ── Main entry ──

/**
 * Generate hierogony and write religion data into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateHierogony(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)
  const peoples = world.anthropogony?.peoples ?? []
  const landmarks = world.geogony?.landmarks ?? []

  // 1. Select archetype
  const recipe = selectArchetype(rng, myth, world)
  const shapeFn = HIEROGONY_SHAPES[recipe]

  // 2. Run archetype shape function
  const shape = shapeFn({ graph, rng, myth, world })

  // 3. Expand religion seeds into full Religion objects
  /** @type {Religion[]} */
  const religions = []
  const usedNames = new Set()
  let religionCounter = 0

  for (const seed of shape.religionSeeds) {
    const chain = walkFrom(graph, rng, seed.baseConcept, 3, {
      preferRelations: ['evokes', 'rhymes'],
    })
    const conceptCluster = [...new Set(chain.path)].slice(0, 6)

    const name = nameRegion(graph, conceptCluster, rng, { usedNames, entityType: 'sacred', morphemes: world.morphemes })

    // Find worshipped agents: start with seed's agent, add others with domain overlap
    /** @type {string[]} */
    const worshippedAgents = []
    if (seed.worshippedAgentId) {
      worshippedAgents.push(seed.worshippedAgentId)
    }

    for (const agent of world.agents) {
      if (worshippedAgents.includes(agent.id)) continue
      if (worshippedAgents.length >= TUNING.maxWorshippedAgents) break
      const overlap = conceptOverlap(graph, agent.domains, conceptCluster)
      if (overlap >= 2) {
        worshippedAgents.push(agent.id)
      }
    }

    religions.push({
      id: `religion-${religionCounter++}`,
      name,
      peoples: [],
      worshippedAgents,
      taboos: [],
      rites: [],
      concepts: conceptCluster,
      originEvent: seed.originLabel,
    })
  }

  // 4. Assign peoples to religions
  for (const people of peoples) {
    let bestReligion = religions[0]
    let bestScore = -1

    for (const religion of religions) {
      let score = conceptOverlap(graph, people.concepts, religion.concepts)

      // Patron/creator bonus
      if (people.patronAgent && religion.worshippedAgents.includes(people.patronAgent)) {
        score += 3
      }
      if (people.creatorAgent && religion.worshippedAgents.includes(people.creatorAgent)) {
        score += 2
      }

      // Shared remembers/fears
      for (const r of people.remembers) {
        if (religion.concepts.includes(r)) score += 1
      }
      for (const f of people.fears) {
        if (religion.concepts.includes(f)) score += 1
      }

      if (score > bestScore) {
        bestScore = score
        bestReligion = religion
      }
    }

    if (bestReligion) {
      bestReligion.peoples.push(people.name)
    }
  }

  // 5. Consolidate: merge empty religions, force-split if all in one
  const populatedReligions = religions.filter(r => r.peoples.length > 0)
  const emptyReligions = religions.filter(r => r.peoples.length === 0)

  if (populatedReligions.length === 1 && religions.length >= 2 && peoples.length >= 2) {
    // Force-split: move the lowest-scoring people to the second religion
    const onlyReligion = populatedReligions[0]
    const target = emptyReligions[0]
    if (target && onlyReligion.peoples.length >= 2) {
      // Move the last person (lowest priority since they were added last)
      const moved = /** @type {string} */ (onlyReligion.peoples.pop())
      target.peoples.push(moved)
      populatedReligions.push(target)
    }
  }

  const finalReligions = populatedReligions

  // 6. Generate heresies
  /** @type {Heresy[]} */
  const heresies = []
  let heresyCounter = 0
  const disputes = world.anthropogony?.disputes ?? []

  if (shape.heresySeed) {
    const largest = [...finalReligions].sort((a, b) => b.peoples.length - a.peoples.length)[0]
    if (largest) {
      const heresyConcepts = [...shape.heresySeed.denyConcepts, ...shape.heresySeed.claimConcepts]
      const heresyName = nameRegion(graph, heresyConcepts, rng, { usedNames, entityType: 'sacred', morphemes: world.morphemes })

      heresies.push({
        id: `heresy-${heresyCounter++}`,
        name: heresyName,
        religionId: largest.id,
        denies: shape.heresySeed.denyConcepts,
        claims: shape.heresySeed.claimConcepts,
        origin: shape.heresySeed.origin,
        concepts: heresyConcepts,
      })
    }
  }

  // Additional heresies from disputes — scaled to religion count
  const maxHeresies = proportion(finalReligions.length, TUNING.heresyRatio)
  for (const dispute of disputes) {
    if (heresies.length >= maxHeresies) break
    if (heresies.some(h => h.denies.includes(dispute))) continue

    const chain = walkFrom(graph, rng, dispute, 2, {
      preferRelations: ['collides', 'transforms'],
    })
    const claims = chain.path.filter(c => c !== dispute).slice(0, 2)
    if (claims.length === 0) continue

    const targetReligion = finalReligions.find(r =>
      r.concepts.some(c => c === dispute) ||
      conceptOverlap(graph, r.concepts, [dispute]) > 0
    ) ?? finalReligions[0]

    if (!targetReligion) continue

    const heresyConcepts = [dispute, ...claims]
    const heresyName = nameRegion(graph, heresyConcepts, rng, { usedNames, entityType: 'sacred', morphemes: world.morphemes })

    heresies.push({
      id: `heresy-${heresyCounter++}`,
      name: heresyName,
      religionId: targetReligion.id,
      denies: [dispute],
      claims,
      origin: `rejects ${dispute}`,
      concepts: heresyConcepts,
    })
  }

  // 7. Place sacred sites
  /** @type {SacredSite[]} */
  const sacredSites = []
  const usedLandmarks = new Set()
  let siteCounter = 0

  for (const religion of finalReligions) {
    let bestLandmark = /** @type {Landmark|null} */ (null)
    let bestScore = 0

    for (const landmark of landmarks) {
      if (usedLandmarks.has(landmark.name)) continue

      let score = conceptOverlap(graph, religion.concepts, landmark.concepts)
      if (landmark.agentId && religion.worshippedAgents.includes(landmark.agentId)) {
        score += 2
      }

      if (score > bestScore) {
        bestScore = score
        bestLandmark = landmark
      }
    }

    if (bestLandmark && bestScore > 0) {
      usedLandmarks.add(bestLandmark.name)
      const siteConcepts = [
        ...religion.concepts.slice(0, 2),
        ...bestLandmark.concepts.slice(0, 2),
      ]
      const siteName = nameRegion(graph, siteConcepts, rng, { usedNames, entityType: 'place', morphemes: world.morphemes })

      sacredSites.push({
        id: `sacred-site-${siteCounter++}`,
        name: siteName,
        regionId: bestLandmark.regionId ?? '',
        landmarkName: bestLandmark.name,
        religionId: religion.id,
        concepts: [...new Set(siteConcepts)],
      })
    }
  }

  // 8. Derive practices
  /** @type {Practice[]} */
  const practices = []
  let practiceCounter = 0

  for (const religion of finalReligions) {
    for (const type of shape.practiceTypes) {
      /** @type {string[]} */
      let sourceConcepts

      if (type === 'rite') {
        sourceConcepts = myth.act.concepts
      } else if (type === 'taboo') {
        sourceConcepts = [...myth.cost.concepts, ...myth.flaw.concepts]
      } else {
        // observance — before beat or peoples' remembers
        const religionPeoples = peoples.filter(p => religion.peoples.includes(p.name))
        const remembers = religionPeoples.flatMap(p => p.remembers)
        sourceConcepts = remembers.length > 0
          ? remembers
          : myth.before.concepts
      }

      const nearby = findNearby(graph, sourceConcepts, religion.concepts, 2)
      if (nearby.length === 0) continue

      // Check for duplicate practices within same religion
      const existing = practices.filter(p => p.religionId === religion.id && p.type === type)
      if (existing.some(p => p.concepts[0] === nearby[0])) continue

      const practiceName = nameRegion(graph, nearby, rng, { usedNames, entityType: 'sacred', morphemes: world.morphemes })

      practices.push({
        id: `practice-${practiceCounter++}`,
        name: practiceName,
        religionId: religion.id,
        type,
        concepts: nearby,
      })

      // Copy into religion's rites/taboos arrays
      if (type === 'rite') {
        religion.rites.push(...nearby)
      } else if (type === 'taboo') {
        religion.taboos.push(...nearby)
      }
    }
  }

  // 9. Apply mutations to earlier entities

  // Peoples get religion field
  for (const religion of finalReligions) {
    for (const peopleName of religion.peoples) {
      const people = peoples.find(p => p.name === peopleName)
      if (people) {
        people.religion = religion.id
      }
    }
  }

  // Landmarks get sacredTo
  for (const site of sacredSites) {
    const landmark = landmarks.find(l => l.name === site.landmarkName)
    if (landmark) {
      landmark.sacredTo.push(site.religionId)
    }
  }

  // Agents get worshippedBy
  for (const religion of finalReligions) {
    for (const agentId of religion.worshippedAgents) {
      const agent = findAgent(world, agentId)
      if (agent) {
        agent.worshippedBy.push(religion.id)
      }
    }
  }

  // 10. Set world.hierogony
  world.hierogony = {
    recipe,
    religions: finalReligions,
    heresies,
    sacredSites,
    practices,
  }
}
