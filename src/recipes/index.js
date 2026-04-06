/**
 * @import { ConceptGraph } from '../concepts.js'
 */

/**
 * Typed concept roles for a single beat of a myth.
 * Keys are semantic role names (actor, tool, target, etc.),
 * values are concept names from the graph.
 * @typedef {Record<string, string>} BeatRoles
 */

/**
 * @typedef {{
 *   seed: string,
 *   recipe: string,
 *   before: { roles: BeatRoles, concepts: string[] },
 *   act: { roles: BeatRoles, concepts: string[] },
 *   cost: { roles: BeatRoles, concepts: string[] },
 *   flaw: { roles: BeatRoles, concepts: string[] },
 *   creators: string[],
 *   important: string[],
 *   bad: string[],
 *   worldBefore: string,
 *   worldAfter: string,
 *   ingredients: string[],
 *   extra: Record<string, string|string[]>,
 * }} CreationMyth
 */

/**
 * @typedef {{
 *   name: string,
 *   weight: number,
 *   generate: (graph: ConceptGraph, rng: () => number) => CreationMyth
 * }} MythRecipe
 */

import { soloGod } from './soloGod.js'
import { pantheonWar } from './pantheonWar.js'
import { worldBirth } from './worldBirth.js'
import { sacrifice } from './sacrifice.js'
import { splitting } from './splitting.js'
import { accident } from './accident.js'
import { cycle } from './cycle.js'
import { rebellion } from './rebellion.js'
import { theft } from './theft.js'
import { dream } from './dream.js'
import { corruption } from './corruption.js'
import { symbiosis } from './symbiosis.js'
import { exile } from './exile.js'
import { utterance } from './utterance.js'
import { weaving } from './weaving.js'
import { contagion } from './contagion.js'
import { mourning } from './mourning.js'
import { taboo } from './taboo.js'

/** @type {MythRecipe[]} */
export const RECIPES = [
  soloGod, pantheonWar, worldBirth, sacrifice, splitting, accident,
  cycle, rebellion, theft, dream, corruption, symbiosis,
  exile, utterance, weaving, contagion, mourning, taboo,
]
