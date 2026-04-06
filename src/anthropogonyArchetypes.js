/**
 * Anthropogony archetype functions.
 * Each archetype determines how peoples arose from the creation myth:
 * what peoples exist, what they emerged from, and who made them.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { CreationMyth } from './recipes/index.js'
 * @import { World } from './world.js'
 */
import { query } from './query.js'
import { walkFrom } from './walker.js'
import { pick, pickN } from './utils.js'

// ── Context and shape types ──

/**
 * @typedef {{
 *   graph: ConceptGraph,
 *   rng: () => number,
 *   myth: CreationMyth,
 *   world: World,
 * }} AnthropogonyContext
 */

/**
 * @typedef {{
 *   baseConcept: string,
 *   origin: string,
 *   creatorAgentId: string|null,
 *   patronAgentId: string|null,
 * }} PeopleSeed
 */

/**
 * @typedef {{
 *   peopleSeeds: PeopleSeed[],
 *   originAgentId: string|null,
 * }} AnthropogonyShape
 */

// ── Archetypes ──

/**
 * Fashioned — a god deliberately made peoples from materials.
 * @param {AnthropogonyContext} ctx
 * @returns {AnthropogonyShape}
 */
function fashioned(ctx) {
  const { graph, rng, world } = ctx
  const creator = world.agents.find(a => a.mythRole === 'creator' && a.alive)
    ?? world.agents.find(a => a.type === 'god' && a.alive)
    ?? world.agents[0]

  const materials = world.geogony?.materials ?? []
  const sources = materials.length >= 2
    ? pickN(rng, materials, Math.min(4, materials.length))
    : query(graph).where('is', 'material').random(rng, 4)

  const otherGods = world.agents.filter(
    a => a.id !== creator.id && (a.type === 'god' || a.type === 'demi-god') && a.alive
  )

  /** @type {PeopleSeed[]} */
  const seeds = sources.map((mat, i) => ({
    baseConcept: mat,
    origin: `fashioned from ${mat}`,
    creatorAgentId: creator.id,
    patronAgentId: i > 0 && otherGods.length > 0
      ? pick(rng, otherGods).id
      : creator.id,
  }))

  return { peopleSeeds: seeds, originAgentId: creator.id }
}

/**
 * Awakened — existing lifeforms gained sentience.
 * @param {AnthropogonyContext} ctx
 * @returns {AnthropogonyShape}
 */
function awakened(ctx) {
  const { rng, world } = ctx
  const lifeforms = world.biogony?.lifeforms ?? []

  // Prefer non-parasitic lifeforms
  const candidates = lifeforms.filter(
    lf => lf.behavior !== 'parasite' && lf.behavior !== 'decay'
  )
  const pool = candidates.length >= 3 ? candidates : lifeforms

  const count = Math.min(pool.length, 3 + Math.floor(rng() * 3))
  const chosen = pool.length > count ? pickN(rng, pool, count) : pool.slice(0, count)

  // Find nearest god for patronage
  const gods = world.agents.filter(a => a.type === 'god' || a.type === 'demi-god')

  /** @type {PeopleSeed[]} */
  const seeds = chosen.map(lf => ({
    baseConcept: lf.concepts[0],
    origin: `awakened from ${lf.name}`,
    creatorAgentId: null,
    patronAgentId: gods.length > 0 ? pick(rng, gods).id : null,
  }))

  return { peopleSeeds: seeds, originAgentId: null }
}

/**
 * Fallen — diminished gods' descendants.
 * @param {AnthropogonyContext} ctx
 * @returns {AnthropogonyShape}
 */
function fallen(ctx) {
  const { rng, world } = ctx

  const diminished = world.agents.filter(
    a => !a.alive || a.state === 'transformed' || a.state === 'sleeping' || a.state === 'imprisoned'
  )
  const sources = diminished.length >= 2
    ? diminished.slice(0, 3)
    : world.agents.filter(a => a.type === 'god' || a.type === 'demi-god').slice(0, 3)

  // If still empty, fall back to oldest agent
  if (sources.length === 0 && world.agents.length > 0) {
    sources.push(world.agents[0])
  }

  /** @type {PeopleSeed[]} */
  const seeds = sources.map(agent => ({
    baseConcept: agent.domains[0] ?? 'memory',
    origin: `descendants of ${agent.name}`,
    creatorAgentId: agent.id,
    patronAgentId: null,
  }))

  // If we got only 1, try adding a second via a different domain
  if (seeds.length === 1 && sources[0].domains.length >= 2) {
    seeds.push({
      baseConcept: sources[0].domains[1],
      origin: `scattered lineage of ${sources[0].name}`,
      creatorAgentId: sources[0].id,
      patronAgentId: null,
    })
  }

  void rng // consume for determinism

  return { peopleSeeds: seeds, originAgentId: sources[0]?.id ?? null }
}

/**
 * Exiled — peoples arrived from elsewhere carrying foreign memory.
 * @param {AnthropogonyContext} ctx
 * @returns {AnthropogonyShape}
 */
function exiled(ctx) {
  const { graph, rng, myth, world } = ctx

  const exiledAgents = world.agents.filter(a => a.state === 'exiled')
  const beforeConcepts = myth.before.concepts

  /** @type {PeopleSeed[]} */
  const seeds = []

  // One people per exiled agent
  for (const agent of exiledAgents.slice(0, 2)) {
    seeds.push({
      baseConcept: agent.domains[0] ?? myth.worldBefore,
      origin: `exiled with ${agent.name}`,
      creatorAgentId: null,
      patronAgentId: agent.id,
    })
  }

  // Additional peoples from "before" concepts
  const beforePool = beforeConcepts.filter(
    c => !seeds.some(s => s.baseConcept === c)
  )
  const extras = beforePool.length > 0
    ? pickN(rng, beforePool, Math.min(2, beforePool.length))
    : [myth.worldBefore]

  for (const concept of extras) {
    if (seeds.length >= 4) break
    seeds.push({
      baseConcept: concept,
      origin: `arrived from ${concept}`,
      creatorAgentId: null,
      patronAgentId: exiledAgents.length > 0 ? exiledAgents[0].id : null,
    })
  }

  // Walk to find more if short
  if (seeds.length < 2) {
    const chain = walkFrom(graph, rng, myth.worldBefore, 3, {
      preferRelations: ['evokes', 'rhymes'],
    })
    for (const c of chain.path) {
      if (seeds.length >= 3) break
      if (!seeds.some(s => s.baseConcept === c)) {
        seeds.push({
          baseConcept: c,
          origin: `arrived from ${c}`,
          creatorAgentId: null,
          patronAgentId: null,
        })
      }
    }
  }

  return { peopleSeeds: seeds, originAgentId: null }
}

/**
 * Split — one original people divided.
 * @param {AnthropogonyContext} ctx
 * @returns {AnthropogonyShape}
 */
function split(ctx) {
  const { graph, rng, myth, world } = ctx

  // Find sundering events
  const sunderingEvents = world.events.filter(e => e.archetype === 'sundering')
  const sourceEvent = sunderingEvents.length > 0
    ? sunderingEvents[0]
    : world.events.length > 0 ? world.events[world.events.length - 1] : null

  // Build proto-people concept pool
  const conceptPool = sourceEvent
    ? [...sourceEvent.consequence.concepts, ...sourceEvent.legacy.concepts]
    : [...myth.flaw.concepts, ...myth.act.concepts]

  const unique = [...new Set(conceptPool)]

  // Split into 2-3 divergent groups
  const groupCount = Math.min(3, Math.max(2, Math.ceil(unique.length / 3)))

  // Find a patron for the original unity
  const involvedAgent = sourceEvent?.agentChanges[0]?.agentId
    ? world.agents.find(a => a.id === sourceEvent.agentChanges[0].agentId)
    : null

  /** @type {PeopleSeed[]} */
  const seeds = []

  for (let i = 0; i < groupCount; i++) {
    // Each group takes a different slice of concepts
    const start = Math.floor((i / groupCount) * unique.length)
    const base = unique[start] ?? myth.worldAfter

    // Walk from the divergence point to create distinctness
    const chain = walkFrom(graph, rng, base, 2, {
      preferRelations: ['evokes', 'collides'],
    })
    const divergentConcept = chain.path.find(c => c !== base) ?? base

    seeds.push({
      baseConcept: divergentConcept,
      origin: `split by ${sourceEvent?.archetype ?? 'the flaw'}`,
      creatorAgentId: null,
      patronAgentId: involvedAgent?.id ?? null,
    })
  }

  return { peopleSeeds: seeds, originAgentId: null }
}

/**
 * Unintended — peoples arose as a side effect.
 * @param {AnthropogonyContext} ctx
 * @returns {AnthropogonyShape}
 */
function unintended(ctx) {
  const { graph, rng, myth } = ctx

  const flawConcepts = myth.flaw.concepts
  const costConcepts = myth.cost.concepts
  const pool = [...new Set([...flawConcepts, ...costConcepts])]

  /** @type {PeopleSeed[]} */
  const seeds = []

  for (const concept of pool.slice(0, 4)) {
    if (seeds.length >= 4) break
    const chain = walkFrom(graph, rng, concept, 2, {
      preferRelations: ['produces', 'transforms'],
    })
    const derived = chain.path.find(c => c !== concept) ?? concept

    seeds.push({
      baseConcept: derived,
      origin: `byproduct of ${concept}`,
      creatorAgentId: null,
      patronAgentId: null,
    })
  }

  // Ensure minimum
  if (seeds.length < 2) {
    const extra = query(graph).where('is', 'force')
      .exclude(...seeds.map(s => s.baseConcept))
      .random(rng, 2)
    for (const c of extra) {
      seeds.push({
        baseConcept: c,
        origin: 'accidental emergence',
        creatorAgentId: null,
        patronAgentId: null,
      })
    }
  }

  return { peopleSeeds: seeds, originAgentId: null }
}

// ── Registry ──

/** @type {Record<string, (ctx: AnthropogonyContext) => AnthropogonyShape>} */
export const ANTHROPOGONY_SHAPES = {
  fashioned,
  awakened,
  fallen,
  exiled,
  split,
  unintended,
}

export const ANTHROPOGONY_NAMES = /** @type {string[]} */ (Object.keys(ANTHROPOGONY_SHAPES))
