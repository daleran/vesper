/**
 * Chorogony generator — synthesizes all previous layers into rich,
 * distinct regions. Each region merges history events, terrain, peoples,
 * lifeforms, resources, dangers, and mood into a single place.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 * @import { Region } from './history.js'
 * @import { People } from './anthropogony.js'
 * @import { Lifeform } from './biogony.js'
 */
import { pick, scoreEntityPlacement } from './utils.js'
import { query } from './query.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   concepts: string[],
 *   taggedBy: number[],
 *   primaryEvent: number,
 *   terrainTypes: string[],
 *   peoples: string[],
 *   resources: string[],
 *   dangers: string[],
 *   mood: string[],
 *   landmarks: string[],
 *   lifeforms: string[],
 *   climate: string[],
 *   controlledBy: string|null,
 * }} ChorogonyRegion
 */

// ── Helpers ──

/**
 * Place entities (peoples or lifeforms) into regions by concept + terrain scoring.
 * Each entity is assigned to its top 1-2 regions.
 * @param {ConceptGraph} graph
 * @param {{ concepts: string[], terrainAffinity: string[], name: string }[]} entities
 * @param {ChorogonyRegion[]} regions
 * @param {'peoples'|'lifeforms'} targetField
 */
function placeEntities(graph, entities, regions, targetField) {
  for (const entity of entities) {
    if (regions.length === 0) continue

    const top = scoreEntityPlacement(graph, entity, regions, 2)
    for (const { region, score } of top) {
      if (score <= 0 && region !== top[0].region) continue
      if (!region[targetField].includes(entity.name)) {
        region[targetField].push(entity.name)
      }
    }
  }
}

/**
 * Derive resource concepts for a region from its concept cluster.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {ChorogonyRegion} region
 * @param {string|undefined} dominantSubstance
 * @returns {string[]}
 */
function deriveResources(graph, rng, region, dominantSubstance) {
  const resourceSet = new Set()

  // Include dominant substance from geogony enrichment
  if (dominantSubstance) resourceSet.add(dominantSubstance)

  // Walk from top concepts to find materials and items
  const sourceConcepts = region.concepts.slice(0, 5)
  for (const c of sourceConcepts) {
    if (resourceSet.size >= 4) break
    const materials = query(graph).nearby(c, 1).where('is', 'material').get()
    for (const m of materials.slice(0, 2)) {
      resourceSet.add(m)
      if (resourceSet.size >= 4) break
    }
  }

  // If still thin, try items
  if (resourceSet.size < 2) {
    for (const c of sourceConcepts) {
      if (resourceSet.size >= 4) break
      const items = query(graph).nearby(c, 1).where('is', 'item').get()
      for (const item of items.slice(0, 1)) {
        resourceSet.add(item)
      }
    }
  }

  return [...resourceSet].slice(0, 4)
}

/**
 * Derive danger concepts for a region from myth flaw and event consequences.
 * @param {ConceptGraph} graph
 * @param {ChorogonyRegion} region
 * @param {CreationMyth} myth
 * @param {import('./history.js').MythicEvent[]} events
 * @param {string[]} flawLifeNames - names of flaw lifeforms placed in this region
 * @returns {string[]}
 */
function deriveDangers(graph, region, myth, events, flawLifeNames) {
  const dangerSet = new Set()

  // Flaw/bad concepts that overlap region concepts
  const flawConcepts = [...myth.flaw.concepts, ...myth.bad]
  const regionSet = new Set(region.concepts)

  for (const fc of flawConcepts) {
    if (dangerSet.size >= 3) break
    // Direct overlap
    if (regionSet.has(fc)) {
      dangerSet.add(fc)
      continue
    }
    // 1-hop check
    const edges = graph.get(fc)
    if (!edges) continue
    for (const e of edges) {
      if (regionSet.has(e.concept)) {
        dangerSet.add(fc)
        break
      }
    }
  }

  // Event consequence concepts with collides/consumes edges
  for (const eventIdx of region.taggedBy) {
    if (dangerSet.size >= 3) break
    const event = events[eventIdx]
    if (!event) continue
    for (const c of event.consequence.concepts) {
      if (dangerSet.size >= 3) break
      const edges = graph.get(c)
      if (!edges) continue
      for (const e of edges) {
        if (e.direction === 'fwd' && (e.relation === 'collides' || e.relation === 'consumes')) {
          dangerSet.add(c)
          break
        }
      }
    }
  }

  // Flaw lifeforms placed here
  for (const name of flawLifeNames) {
    if (dangerSet.size >= 3) break
    dangerSet.add(name)
  }

  return [...dangerSet].slice(0, 3)
}

/**
 * Derive mood concepts for a region via evokes edges.
 * @param {ConceptGraph} graph
 * @param {ChorogonyRegion} region
 * @returns {string[]}
 */
function deriveMood(graph, region) {
  const moodSet = new Set()
  const regionConceptSet = new Set(region.concepts)
  const dominant = region.concepts.slice(0, 3)

  for (const c of dominant) {
    if (moodSet.size >= 3) break
    const evoked = query(graph).nearby(c, 1).where('evokes').direction('fwd').get()
    for (const e of evoked) {
      if (!regionConceptSet.has(e)) {
        moodSet.add(e)
        break
      }
    }
  }

  return [...moodSet].slice(0, 3)
}

// ── Main entry ──

/**
 * Generate chorogony — synthesize all previous layers into rich regions.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateChorogony(graph, world, rng) {
  const myth = /** @type {CreationMyth} */ (world.myth)
  const enrichments = world.geogony?.regionEnrichments ?? []
  const enrichmentMap = new Map(enrichments.map(e => [e.regionId, e]))

  // 1. Copy base regions from history into ChorogonyRegions
  /** @type {ChorogonyRegion[]} */
  const regions = world.regions.map(r => {
    const enrichment = enrichmentMap.get(r.id)
    return {
      id: r.id,
      name: r.name,
      concepts: [...r.concepts],
      taggedBy: [...r.taggedBy],
      primaryEvent: r.primaryEvent,
      terrainTypes: enrichment ? [...enrichment.terrainTypes] : [],
      peoples: [],
      resources: [],
      dangers: [],
      mood: [],
      landmarks: enrichment ? [...enrichment.landmarks] : [],
      lifeforms: [],
      climate: enrichment ? [...enrichment.climate] : [],
      controlledBy: null,
    }
  })

  // 2. Place peoples in regions
  const peoples = world.anthropogony?.peoples ?? []
  placeEntities(graph, peoples, regions, 'peoples')

  // Ensure every people is placed somewhere
  for (const people of peoples) {
    const placed = regions.some(r => r.peoples.includes(people.name))
    if (!placed && regions.length > 0) {
      // Place in random region
      const r = pick(rng, regions)
      r.peoples.push(people.name)
    }
  }

  // 3. Place lifeforms in regions
  const lifeforms = world.biogony?.lifeforms ?? []
  placeEntities(graph, lifeforms, regions, 'lifeforms')

  // 4. Derive resources, dangers, mood per region
  const flawLifeNames = new Set((world.biogony?.flawLife ?? []).map(lf => lf.name))

  for (const region of regions) {
    const dominantSubstance = enrichmentMap.get(region.id)?.dominantSubstance
    region.resources = deriveResources(graph, rng, region, dominantSubstance)

    const regionFlawLife = region.lifeforms.filter(name => flawLifeNames.has(name))
    region.dangers = deriveDangers(graph, region, myth, world.events, regionFlawLife)

    region.mood = deriveMood(graph, region)
  }

  world.chorogony = { regions }
}
