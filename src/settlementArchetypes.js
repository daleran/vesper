/**
 * Settlement archetype functions.
 * Each archetype determines how a settlement's founding myth shapes its
 * mood, structures, traditions, and culture.
 *
 * The system supports many founding-myth patterns (hero, divine, migration,
 * spirit guidance, sacred discovery). This prototype implements the
 * hero-founding group only.
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
 * }} SettlementContext
 */

/**
 * @typedef {{
 *   mood: string[],
 *   townCenterBias: string[],
 *   worshipSiteBias: string[],
 *   traditionType: string,
 *   songSubjectBias: string,
 * }} SettlementShape
 */

// ── Archetypes ──

/**
 * Hero's Rest — a hero settled here after a great deed.
 * Mood: pride, endurance. Favors tavern/gathering-hall, shrine.
 * @param {SettlementContext} ctx
 * @returns {SettlementShape}
 */
function herosRest(ctx) {
  walkFrom(ctx.graph, ctx.rng, 'endurance', 1)
  return {
    mood: ['pride', 'endurance'],
    townCenterBias: ['tavern', 'gathering-hall'],
    worshipSiteBias: ['shrine', 'outdoor-circle'],
    traditionType: 'festival',
    songSubjectBias: 'hero',
  }
}

/**
 * Hero's Sacrifice — the village grew from the aftermath of sacrifice.
 * Mood: sacrifice, memory. Favors gathering-hall, ruin.
 * @param {SettlementContext} ctx
 * @returns {SettlementShape}
 */
function herosSacrifice(ctx) {
  walkFrom(ctx.graph, ctx.rng, 'sacrifice', 1)
  return {
    mood: ['sacrifice', 'memory'],
    townCenterBias: ['gathering-hall', 'field'],
    worshipSiteBias: ['ruin', 'artifact-altar'],
    traditionType: 'ritual',
    songSubjectBias: 'hero',
  }
}

/**
 * Hero's Discovery — a hero found something divine here.
 * Mood: hope, truth. Favors market-circle, temple.
 * @param {SettlementContext} ctx
 * @returns {SettlementShape}
 */
function herosDiscovery(ctx) {
  walkFrom(ctx.graph, ctx.rng, 'truth', 1)
  return {
    mood: ['hope', 'truth'],
    townCenterBias: ['market-circle', 'tavern'],
    worshipSiteBias: ['temple', 'artifact-altar'],
    traditionType: 'festival',
    songSubjectBias: 'god',
  }
}

/**
 * Hero's Exile — a hero was cast out, followers settled here.
 * Mood: longing, will. Favors beer-hall, outdoor-circle.
 * @param {SettlementContext} ctx
 * @returns {SettlementShape}
 */
function herosExile(ctx) {
  walkFrom(ctx.graph, ctx.rng, 'longing', 1)
  return {
    mood: ['longing', 'will'],
    townCenterBias: ['beer-hall', 'gathering-hall'],
    worshipSiteBias: ['outdoor-circle', 'shrine'],
    traditionType: 'observance',
    songSubjectBias: 'hero',
  }
}

// ── Registry ──

/** @type {Record<string, (ctx: SettlementContext) => SettlementShape>} */
export const SETTLEMENT_SHAPES = {
  'heros-rest': herosRest,
  'heros-sacrifice': herosSacrifice,
  'heros-discovery': herosDiscovery,
  'heros-exile': herosExile,
}

/** @type {string[]} */
export const SETTLEMENT_NAMES = Object.keys(SETTLEMENT_SHAPES)
