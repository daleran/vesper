/**
 * Hierogony archetype functions.
 * Each archetype determines how religions form from the creation myth:
 * what peoples believe, why they believe it, and how belief divides them.
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
 * }} HierogonyContext
 */

/**
 * @typedef {{
 *   baseConcept: string,
 *   focusBeat: 'before'|'act'|'cost'|'flaw',
 *   worshippedAgentId: string|null,
 *   originLabel: string,
 * }} ReligionSeed
 */

/**
 * @typedef {{
 *   denyConcepts: string[],
 *   claimConcepts: string[],
 *   origin: string,
 * }} HeresySeed
 */

/**
 * @typedef {{
 *   religionSeeds: ReligionSeed[],
 *   heresySeed: HeresySeed|null,
 *   practiceTypes: ('rite'|'taboo'|'observance')[],
 * }} HierogonyShape
 */

// ── Archetypes ──

/**
 * Revelation — a god spoke directly; literal interpretation of the myth's act.
 * @param {HierogonyContext} ctx
 * @returns {HierogonyShape}
 */
function revelation(ctx) {
  const { graph, rng, myth, world } = ctx

  // Find creator/patron gods as religion anchors
  const creators = world.agents.filter(
    a => (a.mythRole === 'creator' || a.type === 'god') && a.alive
  )
  const anchors = creators.length > 0
    ? creators.slice(0, 3)
    : world.agents.filter(a => a.type === 'god').slice(0, 2)

  /** @type {ReligionSeed[]} */
  const seeds = anchors.map(a => ({
    baseConcept: a.domains[0] ?? myth.act.concepts[0] ?? 'light',
    focusBeat: /** @type {const} */ ('act'),
    worshippedAgentId: a.id,
    originLabel: `revealed by ${a.name}`,
  }))

  // Ensure at least 1 seed
  if (seeds.length === 0) {
    seeds.push({
      baseConcept: myth.act.concepts[0] ?? 'light',
      focusBeat: 'act',
      worshippedAgentId: null,
      originLabel: 'revealed in the act of creation',
    })
  }

  // Heresy: denies the act's method, claims the flaw caused creation
  const denyConcepts = myth.act.concepts.slice(0, 2)
  const claimConcepts = myth.flaw.concepts.slice(0, 2)

  const heresySeed = denyConcepts.length > 0 && claimConcepts.length > 0
    ? { denyConcepts, claimConcepts, origin: 'denies the revelation' }
    : null

  // Walk to consume rng for determinism
  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    religionSeeds: seeds,
    heresySeed,
    practiceTypes: ['rite', 'rite', 'observance'],
  }
}

/**
 * Tradition — passed down from ancestors, emphasis on memory and continuity.
 * @param {HierogonyContext} ctx
 * @returns {HierogonyShape}
 */
function tradition(ctx) {
  const { graph, rng, myth, world } = ctx
  const peoples = world.anthropogony?.peoples ?? []

  // Group peoples by shared remembers concepts
  const remembersPool = [...new Set(peoples.flatMap(p => p.remembers))]
  const beforeConcepts = myth.before.concepts

  // Seeds from distinct memory clusters
  /** @type {ReligionSeed[]} */
  const seeds = []
  const usedConcepts = new Set()

  for (const concept of remembersPool) {
    if (seeds.length >= 3) break
    if (usedConcepts.has(concept)) continue
    usedConcepts.add(concept)

    // Find an ancestor agent if any
    const ancestor = world.agents.find(
      a => a.type === 'ancestor' && a.domains.includes(concept)
    ) ?? world.agents.find(a => a.type === 'ancestor')

    seeds.push({
      baseConcept: concept,
      focusBeat: /** @type {const} */ ('before'),
      worshippedAgentId: ancestor?.id ?? null,
      originLabel: `tradition of ${concept}`,
    })
  }

  // Fallback: use before-beat concepts
  if (seeds.length === 0) {
    const base = beforeConcepts[0] ?? myth.act.concepts[0] ?? 'memory'
    seeds.push({
      baseConcept: base,
      focusBeat: 'before',
      worshippedAgentId: world.agents.find(a => a.type === 'ancestor')?.id ?? null,
      originLabel: 'ancestral tradition',
    })
  }

  // Heresy: denies the before state, claims the world always existed
  const heresySeed = beforeConcepts.length > 0
    ? {
        denyConcepts: beforeConcepts.slice(0, 2),
        claimConcepts: myth.act.concepts.slice(0, 2),
        origin: 'denies the old world',
      }
    : null

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    religionSeeds: seeds,
    heresySeed,
    practiceTypes: ['rite', 'observance', 'observance'],
  }
}

/**
 * Mystery — belief centered on the unknowable flaw.
 * @param {HierogonyContext} ctx
 * @returns {HierogonyShape}
 */
function mystery(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts.length > 0 ? myth.flaw.concepts : myth.bad

  // Find absent gods (dead, sleeping, transformed) as objects of mystery
  const absentGod = world.agents.find(
    a => (a.type === 'god' || a.type === 'demi-god') &&
         (a.state === 'dead' || a.state === 'sleeping' || a.state === 'transformed')
  )

  /** @type {ReligionSeed[]} */
  const seeds = []

  // Primary: the flaw itself
  seeds.push({
    baseConcept: flawConcepts[0] ?? 'void',
    focusBeat: /** @type {const} */ ('flaw'),
    worshippedAgentId: absentGod?.id ?? null,
    originLabel: absentGod
      ? `mystery of ${absentGod.name}`
      : 'mystery of the wound',
  })

  // Secondary: if there's a second distinct flaw concept
  if (flawConcepts.length >= 2) {
    seeds.push({
      baseConcept: flawConcepts[1],
      focusBeat: 'flaw',
      worshippedAgentId: null,
      originLabel: `mystery of ${flawConcepts[1]}`,
    })
  }

  // Heresy: the flaw can be understood/reversed
  const chain = walkFrom(graph, rng, flawConcepts[0] ?? 'void', 2, {
    preferRelations: ['collides', 'transforms'],
  })
  const claimConcepts = chain.path.filter(c => !flawConcepts.includes(c)).slice(0, 2)

  const heresySeed = claimConcepts.length > 0
    ? {
        denyConcepts: flawConcepts.slice(0, 2),
        claimConcepts,
        origin: 'claims the wound can heal',
      }
    : null

  return {
    religionSeeds: seeds,
    heresySeed,
    practiceTypes: ['taboo', 'taboo', 'rite'],
  }
}

/**
 * Gratitude — worship of what provides (patron gods, gifts, resources).
 * @param {HierogonyContext} ctx
 * @returns {HierogonyShape}
 */
function gratitude(ctx) {
  const { graph, rng, myth, world } = ctx
  const peoples = world.anthropogony?.peoples ?? []

  // Find patron gods
  const patronIds = [...new Set(
    peoples.map(p => p.patronAgent).filter(/** @returns {id is string} */ id => id !== null)
  )]
  const patrons = patronIds
    .map(id => world.agents.find(a => a.id === id))
    .filter(/** @returns {a is import('./pantheon.js').Agent} */ a => a !== undefined)

  /** @type {ReligionSeed[]} */
  const seeds = []

  for (const patron of patrons.slice(0, 3)) {
    // Intersect patron domains with peoples' gifts
    const relevantPeople = peoples.find(p => p.patronAgent === patron.id)
    const base = relevantPeople
      ? patron.domains.find(d => d === relevantPeople.gift) ?? patron.domains[0]
      : patron.domains[0]

    seeds.push({
      baseConcept: base ?? 'light',
      focusBeat: /** @type {const} */ ('act'),
      worshippedAgentId: patron.id,
      originLabel: `gratitude to ${patron.name}`,
    })
  }

  // Fallback: use act concepts
  if (seeds.length === 0) {
    const god = world.agents.find(a => a.type === 'god' && a.alive)
    seeds.push({
      baseConcept: myth.act.concepts[0] ?? 'light',
      focusBeat: 'act',
      worshippedAgentId: god?.id ?? null,
      originLabel: 'gratitude for creation',
    })
  }

  // Heresy: the patron's gifts have a hidden cost
  const costConcepts = myth.cost.concepts.slice(0, 2)
  const heresySeed = costConcepts.length > 0
    ? {
        denyConcepts: [seeds[0].baseConcept],
        claimConcepts: costConcepts,
        origin: 'claims the gifts carry a price',
      }
    : null

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    religionSeeds: seeds,
    heresySeed,
    practiceTypes: ['rite', 'observance', 'rite'],
  }
}

/**
 * Fear — worship driven by threats (flaw creatures, demons, dangers).
 * @param {HierogonyContext} ctx
 * @returns {HierogonyShape}
 */
function fear(ctx) {
  const { graph, rng, myth, world } = ctx
  const flawConcepts = myth.flaw.concepts.length > 0 ? myth.flaw.concepts : myth.bad
  const costConcepts = myth.cost.concepts

  // Find demons/threats to appease
  const demons = world.agents.filter(a => a.type === 'demon' && a.alive)
  const threat = demons[0] ?? world.agents.find(a => a.type === 'demon')

  /** @type {ReligionSeed[]} */
  const seeds = []

  // Primary: appeasement of the threat
  seeds.push({
    baseConcept: costConcepts[0] ?? flawConcepts[0] ?? 'hunger',
    focusBeat: /** @type {const} */ ('cost'),
    worshippedAgentId: threat?.id ?? null,
    originLabel: threat
      ? `fear of ${threat.name}`
      : 'fear of the cost',
  })

  // Secondary: if flaw creatures exist
  const flawLife = world.biogony?.flawLife ?? []
  if (flawLife.length > 0) {
    seeds.push({
      baseConcept: flawLife[0].concepts[0] ?? flawConcepts[0] ?? 'wound',
      focusBeat: 'flaw',
      worshippedAgentId: null,
      originLabel: `fear of ${flawLife[0].name}`,
    })
  }

  // Heresy: the threat is fabricated by the gods
  const godConcepts = world.agents
    .filter(a => a.type === 'god' && a.alive)
    .flatMap(a => a.domains)
    .slice(0, 2)

  const heresySeed = godConcepts.length > 0
    ? {
        denyConcepts: flawConcepts.slice(0, 2),
        claimConcepts: godConcepts,
        origin: 'claims the threat was fabricated',
      }
    : null

  walkFrom(graph, rng, seeds[0].baseConcept, 1)

  return {
    religionSeeds: seeds,
    heresySeed,
    practiceTypes: ['taboo', 'taboo', 'observance'],
  }
}

/**
 * Schism — religion born from rejecting another interpretation.
 * @param {HierogonyContext} ctx
 * @returns {HierogonyShape}
 */
function schism(ctx) {
  const { graph, rng, myth, world } = ctx
  const disputes = world.anthropogony?.disputes ?? []
  const flawConcepts = myth.flaw.concepts.length > 0 ? myth.flaw.concepts : myth.bad

  // Base concept from disputes or flaw
  const base = disputes[0] ?? flawConcepts[0] ?? 'shadow'

  // Walk to find an inverted interpretation
  const chain = walkFrom(graph, rng, base, 3, {
    preferRelations: ['collides', 'transforms'],
  })
  const inverted = chain.path.filter(c => c !== base)

  // Two seeds: the orthodox and the schismatic
  const orthodoxGod = world.agents.find(
    a => (a.type === 'god' || a.type === 'demi-god') && a.alive
  )
  const rebelAgent = world.agents.find(
    a => a.state === 'exiled' || a.state === 'transformed'
  )

  /** @type {ReligionSeed[]} */
  const seeds = [
    {
      baseConcept: myth.act.concepts[0] ?? 'light',
      focusBeat: /** @type {const} */ ('act'),
      worshippedAgentId: orthodoxGod?.id ?? null,
      originLabel: 'the old teaching',
    },
    {
      baseConcept: inverted[0] ?? base,
      focusBeat: /** @type {const} */ ('flaw'),
      worshippedAgentId: rebelAgent?.id ?? null,
      originLabel: `schism over ${base}`,
    },
  ]

  // Schism IS the heresy made institutional — no separate heresy
  return {
    religionSeeds: seeds,
    heresySeed: null,
    practiceTypes: ['rite', 'taboo', 'observance'],
  }
}

// ── Registry ──

/** @type {Record<string, (ctx: HierogonyContext) => HierogonyShape>} */
export const HIEROGONY_SHAPES = {
  revelation,
  tradition,
  mystery,
  gratitude,
  fear,
  schism,
}

/** @type {string[]} */
export const HIEROGONY_NAMES = Object.keys(HIEROGONY_SHAPES)
