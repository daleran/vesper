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
 * @import { HierogonyData } from './hierogony.js'
 * @import { PolitogonyData } from './politogony.js'
 * @import { PresentData } from './present.js'
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
