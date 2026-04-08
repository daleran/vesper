/**
 * Gloss layer — expands concept references into grounded descriptions.
 * On first use within a text, a concept gets a descriptive expansion that
 * ties it to the world's agents, substances, regions, terrain, myth roles,
 * artifacts, or sensory edges. Subsequent uses return the bare word.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { World } from '../world.js'
 * @import { Agent } from '../pantheon.js'
 * @import { SensoryEdges } from './sensory.js'
 */

// ── Typedefs ──

/**
 * @typedef {{
 *   glossed: Set<string>,
 *   namedAgents: Set<string>,
 * }} GlossState
 */

import { getSensoryEdges } from './sensory.js'

// ── Constants ──

const BARE_NOUNS = new Set([
  'death', 'dust', 'silence', 'nothing', 'hunger', 'void', 'fire',
  'war', 'grief', 'ruin', 'time', 'decay', 'sleep', 'shadow',
])

/** Myth-beat labels for gloss phrases. */
const BEAT_LABELS = /** @type {Record<string, string>} */ ({
  before: 'the void before all things',
  act: 'the act of making',
  cost: 'the cost of making',
  flaw: 'the wound that remains',
})

/** Substance role labels. */
const SUBSTANCE_LABELS = /** @type {Record<string, string>} */ ({
  groundSubstance: 'ground',
  waterSubstance: 'water',
  skySubstance: 'sky',
})

// ── Public API ──

/**
 * Create a fresh per-text gloss state.
 * @returns {GlossState}
 */
export function createGlossState() {
  return { glossed: new Set(), namedAgents: new Set() }
}


/**
 * Gloss a concept — expand it into a grounded description on first use,
 * or return the bare word if already glossed in this text.
 *
 * Resolution cascade:
 * 1. Already glossed → bare word
 * 2. God/agent domain match → "Name, Title, who was X itself"
 * 3. World substance → "the X, substance of the ground"
 * 4. Region match → "Region, where X lingers"
 * 5. Terrain match → "the terrain — shape of substance"
 * 6. Myth role → "X — the cost/flaw/void of making"
 * 7. Artifact match → "the Name, material type"
 * 8. Sensory fallback → "X — color and texture"
 * 9. Bare fallback → concept with article
 *
 * @param {string} concept
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {GlossState} state
 * @returns {string}
 */
export function glossConcept(concept, graph, world, state) {
  if (!concept) return ''

  // 1. Already glossed — return bare word
  if (state.glossed.has(concept)) {
    return articleFor(concept)
  }

  state.glossed.add(concept)

  // 2. Agent domain match — skip if agent already named in this text
  const agent = findAgentByDomain(world, concept)
  if (agent && !state.namedAgents.has(agent.id)) {
    state.namedAgents.add(agent.id)
    return `${agent.name}, ${agent.title}, who was ${concept} itself`
  }

  // 3. World substance
  const geo = world.geogony
  if (geo) {
    for (const [key, label] of Object.entries(SUBSTANCE_LABELS)) {
      const substance = /** @type {string | undefined} */ (/** @type {Record<string, unknown>} */ (geo)[key])
      if (substance === concept) {
        const worldName = geo.worldName ?? 'the world'
        const sen = getSensoryEdges(graph, concept)
        const desc = buildSensoryFragment(sen)
        return desc
          ? `the ${concept}${desc}, the substance of the ${label} in ${worldName}`
          : `the ${concept}, the substance of the ${label} in ${worldName}`
      }
    }
  }

  // 4. Region match
  const region = world.regions.find(r =>
    r.name === concept || r.concepts.includes(concept)
  )
  if (region) {
    const event = world.events[region.primaryEvent]
    if (event) {
      const archetype = event.archetype
      return region.name === concept
        ? `${region.name}, where the ${archetype} left its mark`
        : `${concept}, which haunts ${region.name}`
    }
    return region.name === concept
      ? `${region.name}, that scarred place`
      : `${concept}, which lingers in ${region.name}`
  }

  // 5. Terrain match
  if (geo) {
    const terrain = geo.terrainTypes.find(
      (/** @type {{ concepts: string[] }} */ t) => t.concepts.includes(concept)
    )
    if (terrain) {
      return `the ${terrain.name} — ${terrain.shape} of ${terrain.substance}`
    }
  }

  // 6. Myth role
  const myth = world.myth
  if (myth) {
    for (const [beat, label] of Object.entries(BEAT_LABELS)) {
      const beatData = /** @type {{ concepts: string[] }} */ (/** @type {Record<string, unknown>} */ (myth)[beat])
      if (beatData?.concepts?.includes(concept)) {
        return `${articleFor(concept)} — ${label}`
      }
    }
  }

  // 7. Artifact match
  const artifacts = world.artifacts ?? []
  const artifact = artifacts.find(a =>
    a.name === concept || a.concepts.includes(concept)
  )
  if (artifact) {
    return `the ${artifact.name}, a ${artifact.material} ${artifact.type}`
  }

  // 8. Sensory fallback
  const sen = getSensoryEdges(graph, concept)
  const desc = buildSensoryFragment(sen)
  if (desc) {
    return `${concept}${desc}`
  }

  // 9. Bare fallback
  return articleFor(concept)
}

/**
 * Find the agent whose domain or name matches a concept.
 * @param {World} world
 * @param {string} concept
 * @returns {Agent | undefined}
 */
function findAgentByDomain(world, concept) {
  return world.agents.find(a =>
    a.domains.includes(concept) || a.name.toLowerCase() === concept.toLowerCase()
  )
}

/**
 * Return concept with or without "the" — abstract nouns go bare.
 * @param {string} concept
 * @returns {string}
 */
export function articleFor(concept) {
  return BARE_NOUNS.has(concept) ? concept : `the ${concept}`
}

/**
 * Build a brief sensory descriptor fragment from edges.
 * Returns null if no sensory data.
 * @param {SensoryEdges} sen
 * @returns {string | null}
 */
function buildSensoryFragment(sen) {
  const parts = []
  if (sen.color) parts.push(sen.color)
  if (sen.texture) parts.push(sen.texture)
  if (parts.length === 0 && sen.evokes.length > 0) {
    parts.push(sen.evokes[0])
  }
  if (parts.length === 0) return null

  const joined = parts.length === 1 ? parts[0] : `${parts[0]} and ${parts[1]}`
  const suffix = sen.evokes.length > 0 && !parts.includes(sen.evokes[0])
    ? `, like ${sen.evokes[0]}`
    : ''
  return ` — ${joined}${suffix}`
}
