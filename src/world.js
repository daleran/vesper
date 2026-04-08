/**
 * Shared World object — the single mutable state that all generation
 * layers write into. No layer is "done"; each enriches the world.
 *
 * @import { CreationMyth } from './recipes/index.js'
 * @import { Agent, AgentSeed } from './pantheon.js'
 * @import { MythicEvent, Region } from './history.js'
 * @import { TerrainType, Landmark, RegionEnrichment } from './geogony.js'
 * @import { Lifeform } from './biogony.js'
 * @import { People } from './anthropogony.js'
 * @import { ChorogonyRegion } from './chorogony.js'
 * @import { Religion, SacredSite, HierogonyData } from './hierogony.js'
 * @import { Polity, Ruin, PolitogonyData } from './politogony.js'
 * @import { Faction, PresentData } from './present.js'
 * @import { Artifact } from './artifacts.js'
 * @import { PlayerCharacter } from './character.js'
 * @import { MythText } from './renderers/mythTexts.js'
 * @import { MorphemeTable } from './naming.js'
 * @import { Timeline } from './timeline.js'
 * @import { Settlement } from './settlement.js'
 */

// ── Typedefs ──

/**
 * @typedef {{
 *   worldName: string,
 *   recipe: string,
 *   worldShape: string,
 *   groundSubstance: string,
 *   waterSubstance: string,
 *   skySubstance: string,
 *   terrainTypes: TerrainType[],
 *   landmarks: Landmark[],
 *   materials: string[],
 *   climate: string[],
 *   causingAgentId: string | null,
 *   regionEnrichments: RegionEnrichment[],
 * }} GeogonyData
 */

/**
 * @typedef {{
 *   recipe: string,
 *   lifeOriginAgent: string | null,
 *   lifeforms: Lifeform[],
 *   flawLife: Lifeform[],
 *   extinctions: string[],
 * }} BiogonyData
 */

/**
 * @typedef {{
 *   recipe: string,
 *   peoples: People[],
 *   commonMemory: string[],
 *   disputes: string[],
 * }} AnthropogonyData
 */

/**
 * @typedef {{
 *   regions: ChorogonyRegion[],
 * }} ChorogonyData
 */

/**
 * @typedef {{
 *   seed: string,
 *   _nextAgentId: number,
 *   myth: CreationMyth | null,
 *   agents: Agent[],
 *   tensions: string[],
 *   events: MythicEvent[],
 *   regions: Region[],
 *   geogony: GeogonyData | null,
 *   biogony: BiogonyData | null,
 *   anthropogony: AnthropogonyData | null,
 *   chorogony: ChorogonyData | null,
 *   hierogony: HierogonyData | null,
 *   politogony: PolitogonyData | null,
 *   present: PresentData | null,
 *   settlement: Settlement | null,
 *   artifacts: Artifact[] | null,
 *   character: PlayerCharacter | null,
 *   texts: MythText[] | null,
 *   morphemes: MorphemeTable | null,
 *   renderedLandmarks: Map<string, string> | null,
 *   renderedRegions: Map<string, string> | null,
 *   renderedSettlement: object | null,
 *   timeline: Timeline | null,
 *   proseLog: Array<{ eventId: string, entityId: string, type: string, prose: string }>,
 * }} World
 */

// ── Factory ──

/**
 * Create an empty World shell for a given seed.
 * @param {string} seed
 * @returns {World}
 */
export function createWorld(seed) {
  return {
    seed,
    _nextAgentId: 0,
    myth: null,
    agents: [],
    tensions: [],
    events: [],
    regions: [],
    geogony: null,
    biogony: null,
    anthropogony: null,
    chorogony: null,
    hierogony: null,
    politogony: null,
    present: null,
    settlement: null,
    artifacts: null,
    character: null,
    texts: null,
    morphemes: null,
    renderedLandmarks: null,
    renderedRegions: null,
    renderedSettlement: null,
    timeline: null,
    proseLog: [],
  }
}

// ── Agent helpers ──

/**
 * Add an agent to the world, assigning a stable id.
 * This is the only way agents should enter world.agents.
 * @param {World} world
 * @param {Agent} agent
 * @param {'pantheon'|'history'|'landscape'} origin
 * @returns {string} the assigned id
 */
export function addAgent(world, agent, origin) {
  const id = `agent-${world._nextAgentId++}`
  agent.id = id
  agent.origin = origin
  world.agents.push(agent)
  return id
}

/**
 * Find an agent by id.
 * @param {World} world
 * @param {string} id
 * @returns {Agent | undefined}
 */
export function findAgent(world, id) {
  return world.agents.find(a => a.id === id)
}

// ── Cross-reference helpers ──

/**
 * Find a polity by id.
 * @param {World} world
 * @param {string} id
 * @returns {Polity | undefined}
 */
export function findPolity(world, id) {
  return (world.politogony?.polities ?? []).find(p => p.id === id)
}

/**
 * Find a religion by id.
 * @param {World} world
 * @param {string} id
 * @returns {Religion | undefined}
 */
export function findReligion(world, id) {
  return (world.hierogony?.religions ?? []).find(r => r.id === id)
}

/**
 * Find a ruin by id.
 * @param {World} world
 * @param {string} id
 * @returns {Ruin | undefined}
 */
export function findRuin(world, id) {
  return (world.politogony?.ruins ?? []).find(r => r.id === id)
}

/**
 * Find a chorogony region by id.
 * @param {World} world
 * @param {string} id
 * @returns {ChorogonyRegion | undefined}
 */
export function findRegion(world, id) {
  return (world.chorogony?.regions ?? []).find(r => r.id === id)
}

/**
 * Find a sacred site by id.
 * @param {World} world
 * @param {string} id
 * @returns {SacredSite | undefined}
 */
export function findSacredSite(world, id) {
  return (world.hierogony?.sacredSites ?? []).find(s => s.id === id)
}

/**
 * Find a faction by id.
 * @param {World} world
 * @param {string} id
 * @returns {Faction | undefined}
 */
export function findFaction(world, id) {
  return (world.present?.factions ?? []).find(f => f.id === id)
}

/**
 * Find a landmark by id.
 * @param {World} world
 * @param {string} id
 * @returns {Landmark | undefined}
 */
export function findLandmark(world, id) {
  return (world.geogony?.landmarks ?? []).find(l => l.id === id)
}


/**
 * Find an artifact by id.
 * @param {World} world
 * @param {string} id
 * @returns {Artifact | undefined}
 */
export function findArtifact(world, id) {
  return (world.artifacts ?? []).find(a => a.id === id)
}

/**
 * Find a myth text by id.
 * @param {World} world
 * @param {string} id
 * @returns {MythText | undefined}
 */
export function findText(world, id) {
  return (world.texts ?? []).find(t => t.id === id)
}

/**
 * Find any entity by id across all layers. Returns the entity and its type,
 * or undefined if not found.
 * @param {World} world
 * @param {string} id
 * @returns {{ entity: object, type: string } | undefined}
 */
export function findEntity(world, id) {
  const agent = findAgent(world, id)
  if (agent) return { entity: agent, type: 'agent' }
  const polity = findPolity(world, id)
  if (polity) return { entity: polity, type: 'polity' }
  const ruin = findRuin(world, id)
  if (ruin) return { entity: ruin, type: 'ruin' }
  const religion = findReligion(world, id)
  if (religion) return { entity: religion, type: 'religion' }
  const site = findSacredSite(world, id)
  if (site) return { entity: site, type: 'sacredSite' }
  const region = findRegion(world, id)
  if (region) return { entity: region, type: 'region' }
  const landmark = findLandmark(world, id)
  if (landmark) return { entity: landmark, type: 'landmark' }
  const artifact = findArtifact(world, id)
  if (artifact) return { entity: artifact, type: 'artifact' }
  const text = findText(world, id)
  if (text) return { entity: text, type: 'text' }
  return undefined
}
