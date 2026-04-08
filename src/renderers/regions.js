/**
 * Region prose renderer. Consumes a completed World and produces
 * 1–2 paragraph atmospheric descriptions per region. Read-only — never mutates World.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { World, GeogonyData } from '../world.js'
 * @import { ChorogonyRegion } from '../chorogony.js'
 * @import { TerrainType } from '../geogony.js'
 * @import { People } from '../anthropogony.js'
 * @import { Polity, Ruin } from '../politogony.js'
 * @import { Religion, SacredSite } from '../hierogony.js'
 * @import { Lifeform } from '../biogony.js'
 * @import { SensoryProfile } from './sensory.js'
 * @import { CreationMyth } from '../recipes/index.js'
 */
import { pick, conceptOverlap } from '../utils.js'
import { resolveSubstance } from '../conceptResolvers.js'
import { findPolity } from '../world.js'
import { buildSensoryProfile, sensoryPhrase, moodPhrase } from './sensory.js'

// ── Context gathering ──

/**
 * @typedef {{
 *   region: ChorogonyRegion,
 *   profile: SensoryProfile,
 *   substance: string,
 *   terrainTypes: TerrainType[],
 *   polity: Polity | undefined,
 *   ruins: Ruin[],
 *   peoples: People[],
 *   religions: Religion[],
 *   sacredSites: SacredSite[],
 *   lifeforms: Lifeform[],
 *   wrongnessScore: number,
 *   crisisImpact: string | undefined,
 * }} RegionContext
 */

/**
 * Collect all cross-references for a region.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {ChorogonyRegion} region
 * @returns {RegionContext}
 */
function gatherContext(graph, rng, world, region) {
  const profile = buildSensoryProfile(graph, region.concepts)

  const geogony = /** @type {GeogonyData} */ (world.geogony)
  const substance = resolveSubstance(graph, rng, region.concepts, geogony.groundSubstance)

  const terrainTypes = geogony.terrainTypes.filter(
    t => region.terrainTypes.includes(t.name)
  )

  const polity = region.controlledBy
    ? findPolity(world, region.controlledBy)
    : undefined

  const ruins = (world.politogony?.ruins ?? []).filter(
    r => r.regionId === region.id
  )

  const allPeoples = world.anthropogony?.peoples ?? []
  const peoples = allPeoples.filter(p => region.peoples.includes(p.name))

  const allReligions = world.hierogony?.religions ?? []
  const peopleNames = new Set(region.peoples)
  const religions = allReligions.filter(
    r => r.peoples.some(p => peopleNames.has(p))
  )

  const sacredSites = (world.hierogony?.sacredSites ?? []).filter(
    s => s.regionId === region.id
  )

  const allLifeforms = world.biogony?.lifeforms ?? []
  const lifeforms = allLifeforms.filter(l => region.lifeforms.includes(l.name))

  const myth = /** @type {CreationMyth} */ (world.myth)
  const wrongnessScore = computeWrongness(graph, region, myth)

  const crisisImpact = /** @type {*} */ (region).crisisImpact

  return {
    region, profile, substance, terrainTypes, polity, ruins,
    peoples, religions, sacredSites, lifeforms, wrongnessScore, crisisImpact,
  }
}

/**
 * Compute how flaw-shaped a region is.
 * @param {ConceptGraph} graph
 * @param {ChorogonyRegion} region
 * @param {CreationMyth} myth
 * @returns {number}
 */
function computeWrongness(graph, region, myth) {
  const flawConcepts = [...myth.flaw.concepts, ...myth.bad]
  const overlap = conceptOverlap(graph, region.concepts, flawConcepts)
  const dangerOverlap = conceptOverlap(graph, region.dangers, flawConcepts)
  return overlap + Math.floor(dangerOverlap * 0.5)
}

// ── Paragraph 1: The Land ──

/** @type {Record<string, ((name: string, phrase: string) => string)[]>} */
const OPENINGS = {
  color: [
    (name, phrase) => `The ${phrase} land of ${name} stretches out in every direction.`,
    (name, phrase) => `${name} is ${phrase} — the ground, the horizon, everything between.`,
    (name, phrase) => `What defines ${name} is the color: ${phrase}, as far as the eye can see.`,
  ],
  sound: [
    (name, phrase) => `In ${name}, ${phrase}.`,
    (name, phrase) => `You hear ${name} before you see it — ${phrase}.`,
    (name, phrase) => `The land called ${name} carries a sound: ${phrase}.`,
  ],
  texture: [
    (name, phrase) => `The ground in ${name} is ${phrase}, mile after mile.`,
    (name, phrase) => `${name} is a place of surfaces — everything here is ${phrase}.`,
    (name, phrase) => `Underfoot, ${name} is ${phrase}. The land insists on being touched.`,
  ],
  shape: [
    (name, phrase) => `The terrain of ${name} is ${phrase}, repeating endlessly.`,
    (name, phrase) => `${name} — ${phrase} landforms, stretching to the horizon.`,
    (name, phrase) => `In ${name}, the ground itself is ${phrase}, as if shaped by design.`,
  ],
}

/** @type {((name: string, phrase: string) => string)[]} */
const MOOD_OPENINGS = [
  (name, phrase) => `${name} changes the air around you. ${phrase}`,
  (name, phrase) => `There is a quality to ${name} that resists description. ${phrase}`,
  (name, phrase) => `You feel ${name} before you understand it. ${phrase}`,
]

/**
 * Compose the terrain paragraph — always present.
 * @param {ConceptGraph} _graph
 * @param {() => number} rng
 * @param {RegionContext} ctx
 * @returns {string}
 */
function composeTerrain(_graph, rng, ctx) {
  const { region, profile, substance, terrainTypes } = ctx
  const name = region.name
  const sentences = []

  // Opening sentence: lead with most striking sense
  if (profile.strikingSense) {
    const sense = profile.strikingSense
    const value = profile[sense]
    if (value) {
      const phrase = sensoryPhrase(sense, value)
      const pool = OPENINGS[sense]
      sentences.push(pick(rng, pool)(name, phrase))
    }
  } else if (profile.mood.length > 0) {
    const phrase = moodPhrase(rng, profile.mood)
    sentences.push(pick(rng, MOOD_OPENINGS)(name, phrase))
  } else {
    sentences.push(`${name} stretches before you, silent and featureless.`)
  }

  // Terrain detail from shape + substance
  if (terrainTypes.length > 0) {
    const terrain = terrainTypes[0]
    const shapePhrase = sensoryPhrase('shape', terrain.shape)
    sentences.push(pick(rng, [
      `The ground is ${substance} — ${shapePhrase}, worn by time.`,
      `Underfoot, ${terrain.substance} forms ${SHAPE_LANDSCAPE[terrain.shape] ?? 'an uneven surface'}.`,
      `The land is ${shapePhrase}: ${terrain.substance} shaped into ${SHAPE_LANDSCAPE[terrain.shape] ?? 'strange forms'}.`,
    ]))
  } else {
    sentences.push(`The ground is ${substance}, unbroken and unremarkable.`)
  }

  // Atmosphere from climate + sound
  if (region.climate.length > 0) {
    const climateConcept = pick(rng, region.climate)
    const climateSentence = composeClimate(rng, climateConcept, profile)
    if (climateSentence) sentences.push(climateSentence)
  } else if (profile.sound) {
    sentences.push(sensoryPhrase('sound', profile.sound) + '.')
  }

  return sentences.join(' ')
}

/** @type {Record<string, string>} */
const SHAPE_LANDSCAPE = {
  slab: 'broad flat plates',
  hollow: 'shallow basins and depressions',
  pillar: 'columns and standing formations',
  shard: 'jagged shards and broken ridges',
  spiral: 'winding coils and spiraling outcrops',
  coil: 'tight whorls and tangled ridges',
  circle: 'rings and circular formations',
  point: 'sharp peaks and tapering spires',
  branch: 'branching channels and spread formations',
  web: 'threaded veins and latticed stone',
  crescent: 'curved ridges and crescent-shaped rises',
}

/**
 * Compose a climate-driven atmosphere sentence.
 * @param {() => number} rng
 * @param {string} concept
 * @param {SensoryProfile} profile
 * @returns {string | null}
 */
function composeClimate(rng, concept, profile) {
  const soundBit = profile.sound
    ? ` ${sensoryPhrase('sound', profile.sound)}.`
    : ''

  /** @type {Record<string, string[]>} */
  const CLIMATE = {
    ice: [
      `The cold is absolute.${soundBit}`,
      `Ice clings to every surface. The air is still and bitter.`,
    ],
    frost: [
      `Frost covers everything, even in what passes for daylight.${soundBit}`,
      `The air bites. Breath hangs visible and slow.`,
    ],
    rain: [
      `Rain falls here often enough to stain the stone.${soundBit}`,
      `The air is heavy with moisture. Everything drips.`,
    ],
    mist: [
      `Mist clings low, blurring the edges of things.${soundBit}`,
      `Visibility shifts with the fog. Distance is uncertain.`,
    ],
    wind: [
      `The wind never stops.${soundBit}`,
      `Wind scours the landscape, carrying grit and sound.`,
    ],
    dust: [
      `Dust hangs in the air, fine and inescapable.${soundBit}`,
      `The air is thick with dust. It settles on everything.`,
    ],
    ash: [
      `Ash drifts down like grey snow.${soundBit}`,
      `The air tastes of ash. It coats the tongue and the eyes.`,
    ],
    fire: [
      `Heat radiates from the ground itself.${soundBit}`,
      `The air shimmers with heat. Nothing here is cool.`,
    ],
    shadow: [
      `The light here is wrong — too dim, too angled.${soundBit}`,
      `Shadows pool in places where they should not be.`,
    ],
    light: [
      `The light is unnervingly clear.${soundBit}`,
      `Brightness presses in from all directions, without warmth.`,
    ],
    silence: [
      `The silence is not peaceful. It is empty.`,
      `Sound does not carry here. The air swallows it.`,
    ],
    storm: [
      `The sky threatens constantly. Storms pass through without warning.${soundBit}`,
      `The air crackles with the memory of lightning.`,
    ],
  }

  const pool = CLIMATE[concept]
  if (pool) return pick(rng, pool)

  // Fallback: use the concept name itself
  if (soundBit) return `The air carries the quality of ${concept}.${soundBit}`
  return `The air carries the quality of ${concept}.`
}

// ── Paragraph 2: The Feel ──

/** @type {string[]} */
const WRONGNESS_MILD = [
  'Something about this place resists trust.',
  'The proportions feel slightly off, in ways that are hard to name.',
  'There is a quality here that the mind wants to slide past.',
  'An unease settles in without explanation.',
]

/** @type {string[]} */
const WRONGNESS_INTENSE = [
  'The wrongness here is not subtle. The land itself seems to flinch.',
  'Something fundamental has gone wrong in this place, and it has not healed.',
  'The ground remembers a wound. You can feel it through your feet.',
  'Every surface carries the mark of something that should not have happened.',
]

/**
 * Compose the wrongness fragment if the region is flaw-shaped.
 * @param {() => number} rng
 * @param {RegionContext} ctx
 * @returns {string | null}
 */
function composeWrongness(rng, ctx) {
  const score = ctx.wrongnessScore
  if (score <= 2) return null
  if (score <= 4 && rng() > 0.5) return null
  const pool = score >= 5 ? WRONGNESS_INTENSE : WRONGNESS_MILD
  return pick(rng, pool)
}

/** @type {Record<string, string>} */
const BEHAVIOR_SIGNS = {
  predator: 'move through the terrain with intent',
  grazer: 'drift across the open ground',
  burrower: 'have marked the earth with their tunnels',
  drifter: 'pass through without settling',
  rooted: 'cling to the ground in clusters',
  parasite: 'feed on what grows here',
  sentinel: 'watch from elevated ground',
  swarm: 'move in shifting clouds',
  mimic: 'are difficult to distinguish from the terrain',
  decay: 'break down what the land produces',
}

/**
 * Compose the cultural traces fragment.
 * @param {() => number} rng
 * @param {RegionContext} ctx
 * @returns {string | null}
 */
function composeCulture(rng, ctx) {
  const { peoples, polity, ruins, religions, sacredSites, lifeforms } = ctx
  const sentences = []

  // Inhabited regions
  if (peoples.length > 0 && polity && polity.state !== 'fallen') {
    const people = pick(rng, peoples)
    sentences.push(pick(rng, [
      `The ${people.name} have settled here. Their presence is visible in every cleared path and marked stone.`,
      `Signs of the ${people.name} are everywhere — foundations, trails, the remains of recent fires.`,
      `The ${people.name} claim this land. Their marks are deliberate.`,
    ]))
  } else if (peoples.length > 0) {
    const people = pick(rng, peoples)
    sentences.push(pick(rng, [
      `The ${people.name} pass through here, but have not stayed.`,
      `There are traces of the ${people.name} — old camps, faded markings — but no permanence.`,
    ]))
  }

  // Ruins
  if (ruins.length > 0) {
    const ruin = pick(rng, ruins)
    sentences.push(pick(rng, [
      `What ${ruin.name} built here has not lasted. Foundations remain, half-swallowed.`,
      `The ruins of ${ruin.name} still stand, barely. No one has repaired them.`,
      `${ruin.name} left structures behind. They are crumbling now.`,
    ]))
  }

  // Sacred presence
  if (sacredSites.length > 0 && religions.length > 0) {
    const religion = pick(rng, religions)
    sentences.push(pick(rng, [
      `Markings of the ${religion.name} are cut into the stone — observances, boundaries, warnings.`,
      `The ${religion.name} consider this ground sacred. Their signs are unmistakable.`,
    ]))
  }

  // Lifeform presence (if no cultural content yet)
  if (sentences.length === 0 && lifeforms.length > 0) {
    const creature = pick(rng, lifeforms)
    const sign = BEHAVIOR_SIGNS[creature.behavior] ?? 'inhabit this place'
    sentences.push(`${creature.name} ${sign}.`)
  }

  // Uninhabited emptiness (if still nothing)
  if (sentences.length === 0) {
    if (rng() < 0.4) {
      sentences.push(pick(rng, [
        'No one has settled here. The land does not invite it.',
        'There are no signs of habitation. The emptiness is complete.',
      ]))
    }
  }

  return sentences.length > 0 ? sentences.join(' ') : null
}

// ── Main entry point ──

/**
 * Render prose description for a single region.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {ChorogonyRegion} region
 * @returns {string}
 */
export function renderOneRegion(graph, rng, world, region) {
  const ctx = gatherContext(graph, rng, world, region)

  // Paragraph 1: The Land (always present)
  const land = composeTerrain(graph, rng, ctx)

  // Paragraph 2: The Feel (conditional)
  const feelParts = []

  // Mood
  if (ctx.region.mood.length > 0) {
    feelParts.push(moodPhrase(rng, ctx.region.mood))
  }

  // Wrongness
  const wrongness = composeWrongness(rng, ctx)
  if (wrongness) feelParts.push(wrongness)

  // Cultural traces
  const culture = composeCulture(rng, ctx)
  if (culture) feelParts.push(culture)

  const paragraphs = [land]
  if (feelParts.length > 0) {
    paragraphs.push(feelParts.join(' '))
  }

  return paragraphs.join('\n\n')
}

/**
 * Render prose descriptions for all regions in the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 * @returns {Map<string, string>}
 */
export function renderRegions(graph, world, rng) {
  /** @type {Map<string, string>} */
  const result = new Map()

  const regions = world.chorogony?.regions ?? []
  for (const region of regions) {
    result.set(region.id, renderOneRegion(graph, rng, world, region))
  }

  return result
}
