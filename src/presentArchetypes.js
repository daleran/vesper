/**
 * Present-layer archetype functions.
 * Each archetype determines what kind of crisis the world faces when
 * the player arrives — the inflection point where things are about to break.
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
 * }} PresentContext
 */

/**
 * @typedef {{
 *   baseConcept: string,
 *   flawConcepts: string[],
 *   severity: 'brewing'|'breaking'|'critical',
 * }} CrisisSeed
 */

/**
 * @typedef {{
 *   crisisSeed: CrisisSeed,
 *   factionApproaches: string[],
 *   recentEventType: 'death'|'discovery'|'breach'|'proclamation'|'omen'|'collapse',
 *   rumorTruthRatio: number,
 *   rumorCount: number,
 *   hiddenTruthDepth: number,
 * }} PresentShape
 */

// ── Helpers ──

/**
 * Count how many regions have flaw-overlapping dangers.
 * @param {World} world
 * @param {string[]} flawConcepts
 * @returns {number}
 */
function countFlawRegions(world, flawConcepts) {
  const regions = world.chorogony?.regions ?? []
  let count = 0
  for (const r of regions) {
    if (r.dangers.some(d => flawConcepts.includes(d))) count++
  }
  return count
}

/**
 * Derive severity from a 0+ score.
 * @param {number} score
 * @returns {'brewing'|'breaking'|'critical'}
 */
function deriveSeverity(score) {
  if (score >= 4) return 'critical'
  if (score >= 2) return 'breaking'
  return 'brewing'
}

// ── Archetypes ──

/**
 * Plague — the flaw manifests as spreading corruption.
 * @param {PresentContext} ctx
 * @returns {PresentShape}
 */
function plague(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts
  const flawLife = world.biogony?.flawLife ?? []

  // Root in flaw's first concept, or a flaw creature's concept
  const baseConcept = flawLife[0]?.concepts[0] ?? flawConcepts[0] ?? 'decay'

  // Severity scales with how many regions have flaw-linked dangers
  const flawRegionCount = countFlawRegions(world, flawConcepts)
  const severity = deriveSeverity(flawRegionCount)

  walkFrom(graph, rng, baseConcept, 1)

  return {
    crisisSeed: { baseConcept, flawConcepts, severity },
    factionApproaches: ['quarantine', 'purify', 'exploit', 'flee'],
    recentEventType: 'breach',
    rumorTruthRatio: 0.5,
    rumorCount: 7,
    hiddenTruthDepth: 5,
  }
}

/**
 * Schism — a religious or ideological split has turned violent.
 * @param {PresentContext} ctx
 * @returns {PresentShape}
 */
function schism(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts
  const heresies = world.hierogony?.heresies ?? []
  const conflicts = world.politogony?.conflicts ?? []

  // Root in the heresy concept most overlapping with the flaw, or flaw itself
  let baseConcept = flawConcepts[0] ?? 'division'
  for (const heresy of heresies) {
    for (const c of heresy.denies) {
      if (flawConcepts.includes(c)) { baseConcept = c; break }
    }
  }

  // Severity scales with conflict intensity between differently-religious polities
  let severityScore = heresies.length
  for (const conflict of conflicts) {
    if (conflict.cause === 'heresy') severityScore += 2
    if (conflict.intensity === 'open') severityScore += 1
  }
  const severity = deriveSeverity(severityScore)

  walkFrom(graph, rng, baseConcept, 1)

  return {
    crisisSeed: { baseConcept, flawConcepts, severity },
    factionApproaches: ['orthodoxy', 'reform', 'suppress', 'reconcile'],
    recentEventType: 'proclamation',
    rumorTruthRatio: 0.4,
    rumorCount: 8,
    hiddenTruthDepth: 4,
  }
}

/**
 * Succession — a power vacuum; a ruler/patron/god has fallen or gone silent.
 * @param {PresentContext} ctx
 * @returns {PresentShape}
 */
function succession(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts
  const polities = world.politogony?.polities ?? []

  // Find declining/fallen polities or dead/sleeping patron agents
  const fallenPolity = polities.find(p => p.state === 'fallen' || p.state === 'declining')
  const fallenAgent = fallenPolity?.patronAgentId
    ? world.agents.find(a => a.id === fallenPolity.patronAgentId)
    : world.agents.find(a =>
      (a.state === 'dead' || a.state === 'sleeping') &&
      (a.type === 'god' || a.type === 'demi-god')
    )

  const baseConcept = fallenAgent?.domains[0] ?? myth.cost.concepts[0] ?? 'throne'

  // Severity based on how many polities are affected
  const affectedCount = polities.filter(p => p.state === 'fallen' || p.state === 'declining').length
  const severity = deriveSeverity(affectedCount)

  walkFrom(graph, rng, baseConcept, 1)

  return {
    crisisSeed: { baseConcept, flawConcepts, severity },
    factionApproaches: ['legitimist', 'usurper', 'separatist', 'restorer'],
    recentEventType: 'death',
    rumorTruthRatio: 0.5,
    rumorCount: 8,
    hiddenTruthDepth: 4,
  }
}

/**
 * Invasion — an external or resurgent force threatens the established order.
 * @param {PresentContext} ctx
 * @returns {PresentShape}
 */
function invasion(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts
  const conflicts = world.politogony?.conflicts ?? []

  // Pick the highest-intensity conflict, or root in flaw
  const openConflict = conflicts.find(c => c.intensity === 'open')
    ?? conflicts.find(c => c.intensity === 'simmering')
  const baseConcept = openConflict?.concepts[0] ?? flawConcepts[0] ?? 'iron'

  // Severity based on conflict count and intensity
  let severityScore = 0
  for (const c of conflicts) {
    if (c.intensity === 'open') severityScore += 2
    else if (c.intensity === 'simmering') severityScore += 1
  }
  const severity = deriveSeverity(severityScore)

  walkFrom(graph, rng, baseConcept, 1)

  return {
    crisisSeed: { baseConcept, flawConcepts, severity },
    factionApproaches: ['resist', 'submit', 'ally', 'evacuate'],
    recentEventType: 'breach',
    rumorTruthRatio: 0.6,
    rumorCount: 6,
    hiddenTruthDepth: 4,
  }
}

/**
 * Depletion — a critical resource, binding, or sacred site is failing.
 * @param {PresentContext} ctx
 * @returns {PresentShape}
 */
function depletion(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts
  const ruins = world.politogony?.ruins ?? []
  const polities = world.politogony?.polities ?? []

  // Find the most resource-dependent polity or a failing sacred site
  const richest = [...polities]
    .filter(p => p.state !== 'fallen')
    .sort((a, b) => b.resources.length - a.resources.length)[0]

  const baseConcept = richest?.resources[0]
    ?? ruins[0]?.concepts[0]
    ?? myth.cost.concepts[0]
    ?? 'dust'

  // Severity based on declining polities and ruins
  const severity = deriveSeverity(
    ruins.length + polities.filter(p => p.state === 'declining').length
  )

  walkFrom(graph, rng, baseConcept, 1)

  return {
    crisisSeed: { baseConcept, flawConcepts, severity },
    factionApproaches: ['conserve', 'substitute', 'raid', 'migrate'],
    recentEventType: 'collapse',
    rumorTruthRatio: 0.5,
    rumorCount: 7,
    hiddenTruthDepth: 5,
  }
}

/**
 * Awakening — something sealed, sleeping, or forgotten is stirring.
 * @param {PresentContext} ctx
 * @returns {PresentShape}
 */
function awakening(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts

  // Find sleeping/imprisoned/forgotten agents
  const dormantAgent = world.agents.find(
    a => a.state === 'sleeping' || a.state === 'imprisoned' || a.state === 'forgotten'
  )

  const baseConcept = dormantAgent?.domains[0] ?? flawConcepts[0] ?? 'shadow'

  // Severity based on agent power level
  let severityScore = 1
  if (dormantAgent) {
    if (dormantAgent.type === 'god') severityScore += 3
    else if (dormantAgent.type === 'demi-god') severityScore += 2
    else severityScore += 1
  }
  const severity = deriveSeverity(severityScore)

  walkFrom(graph, rng, baseConcept, 1)

  return {
    crisisSeed: { baseConcept, flawConcepts, severity },
    factionApproaches: ['worship', 'contain', 'destroy', 'harness'],
    recentEventType: 'omen',
    rumorTruthRatio: 0.4,
    rumorCount: 9,
    hiddenTruthDepth: 6,
  }
}

// ── Registry ──

/** @type {string[]} */
export const PRESENT_NAMES = [
  'plague', 'schism', 'succession', 'invasion', 'depletion', 'awakening',
]

/** @type {Record<string, (ctx: PresentContext) => PresentShape>} */
export const PRESENT_SHAPES = {
  plague,
  schism,
  succession,
  invasion,
  depletion,
  awakening,
}
