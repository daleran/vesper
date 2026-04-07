/**
 * Landmark prose renderer. Consumes a completed World and produces
 * 1–3 paragraph descriptions per landmark. Read-only — never mutates World.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { World } from '../world.js'
 * @import { Landmark } from '../geogony.js'
 * @import { GeogonyData } from '../world.js'
 * @import { ChorogonyRegion } from '../chorogony.js'
 * @import { SacredSite, Religion } from '../hierogony.js'
 * @import { Artifact } from '../artifacts.js'
 * @import { Agent } from '../pantheon.js'
 * @import { MythicEvent } from '../history.js'
 * @import { Lifeform } from '../biogony.js'
 * @import { SensoryProfile } from './sensory.js'
 */
import { pick, conceptOverlap } from '../utils.js'
import { resolveSubstance } from '../conceptResolvers.js'
import { findAgent, findRegion, findReligion } from '../world.js'
import { buildSensoryProfile, sensoryPhrase, moodPhrase } from './sensory.js'

// ── Context gathering ──

/**
 * @typedef {{
 *   landmark: Landmark,
 *   region: ChorogonyRegion | undefined,
 *   sacredSite: SacredSite | undefined,
 *   religion: Religion | undefined,
 *   artifacts: Artifact[],
 *   agent: Agent | undefined,
 *   lifeforms: Lifeform[],
 *   relevantEvents: MythicEvent[],
 *   nearbyLandmarks: Landmark[],
 *   profile: SensoryProfile,
 *   substance: string,
 * }} LandmarkContext
 */

/**
 * Collect all cross-references for a landmark.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {Landmark} landmark
 * @returns {LandmarkContext}
 */
function gatherContext(graph, rng, world, landmark) {
  const region = landmark.regionId ? findRegion(world, landmark.regionId) : undefined

  const sacredSite = (world.hierogony?.sacredSites ?? [])
    .find(s => s.landmarkName === landmark.name)
  const religion = sacredSite ? findReligion(world, sacredSite.religionId) : undefined

  const artifacts = (world.artifacts ?? [])
    .filter(a => a.location.landmarkName === landmark.name)

  const agent = landmark.agentId ? findAgent(world, landmark.agentId) : undefined

  // Lifeforms in same region
  const regionLifeformNames = region?.lifeforms ?? []
  const allLifeforms = world.biogony?.lifeforms ?? []
  const lifeforms = allLifeforms.filter(l => regionLifeformNames.includes(l.name))

  // Events scored by concept overlap with landmark
  const relevantEvents = findRelevantEvents(graph, world.events, landmark)

  // Other landmarks in same region
  const allLandmarks = world.geogony?.landmarks ?? []
  const nearbyLandmarks = landmark.regionId
    ? allLandmarks.filter(l => l.regionId === landmark.regionId && l.id !== landmark.id)
    : []

  const profile = buildSensoryProfile(graph, landmark.concepts)

  const geogony = /** @type {GeogonyData} */ (world.geogony)
  const substance = resolveSubstance(graph, rng, landmark.concepts, geogony.groundSubstance)

  return {
    landmark, region, sacredSite, religion, artifacts,
    agent, lifeforms, relevantEvents, nearbyLandmarks, profile, substance,
  }
}

/**
 * Find the top 2 events most relevant to a landmark by concept overlap.
 * @param {ConceptGraph} graph
 * @param {MythicEvent[]} events
 * @param {Landmark} landmark
 * @returns {MythicEvent[]}
 */
function findRelevantEvents(graph, events, landmark) {
  /** @type {{ event: MythicEvent, score: number }[]} */
  const scored = []
  for (const event of events) {
    let score = conceptOverlap(graph, landmark.concepts, event.consequence.concepts)
    score += conceptOverlap(graph, landmark.concepts, event.legacy.concepts)
    if (landmark.agentId) {
      const touchesAgent = event.agentChanges.some(c => c.agentId === landmark.agentId)
      if (touchesAgent) score += 3
    }
    if (score > 0) scored.push({ event, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 2).map(s => s.event)
}

// ── Paragraph 1: The Arrival ──

/** @type {Record<string, ((name: string, phrase: string) => string)[]>} */
const OPENINGS = {
  color: [
    (name, phrase) => `The ${phrase} surface of ${name} catches the eye before anything else.`,
    (name, phrase) => `${name} stands ${phrase}, visible from a distance.`,
    (name, phrase) => `What strikes first about ${name} is the color \u2014 ${phrase}, unmistakable.`,
  ],
  sound: [
    (name, phrase) => `Near ${name}, ${phrase}.`,
    (name, phrase) => `Before you see ${name}, you hear it \u2014 ${phrase}.`,
    (name, phrase) => `${name} announces itself: ${phrase}.`,
  ],
  texture: [
    (name, phrase) => `The stone of ${name} is ${phrase}, even at a glance.`,
    (name, phrase) => `${name} feels ${phrase} long before you touch it.`,
    (name, phrase) => `Everything about ${name} is ${phrase}.`,
  ],
  shape: [
    (name, phrase) => `${name} is ${phrase}, unmistakable against the horizon.`,
    (name, phrase) => `The form of ${name} \u2014 ${phrase} \u2014 looks deliberate.`,
    (name, phrase) => `${name} rises ${phrase} from the surrounding land.`,
  ],
}

/** @type {((name: string, phrase: string) => string)[]} */
const MOOD_OPENINGS = [
  (name, phrase) => `${name} is a place that changes the air around it. ${phrase}`,
  (name, phrase) => `Something shifts near ${name}. ${phrase}`,
  (name, phrase) => `You feel ${name} before you understand it. ${phrase}`,
]

/**
 * Compose the arrival paragraph — always present.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {LandmarkContext} ctx
 * @returns {string}
 */
function composeArrival(graph, rng, ctx) {
  const { landmark, profile, substance, region } = ctx
  const name = landmark.name
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
    sentences.push(`${name} rises from the land, silent and unmarked.`)
  }

  // Physical description from remaining senses
  const details = []
  if (profile.strikingSense !== 'texture' && profile.texture) {
    details.push(sensoryPhrase('texture', profile.texture))
  }
  if (profile.strikingSense !== 'shape' && profile.shape) {
    details.push(sensoryPhrase('shape', profile.shape))
  }
  if (details.length > 0) {
    sentences.push(`Its surface is ${details.join(', ')} \u2014 ${substance} shaped by something older than memory.`)
  } else {
    sentences.push(`It is made of ${substance}, or something like it.`)
  }

  // Scale/context sentence
  if (region && region.terrainTypes.length > 0) {
    const terrain = pick(rng, region.terrainTypes)
    sentences.push(pick(rng, [
      `The ${terrain} around it seems to lean away.`,
      `It stands against the surrounding ${terrain} like a scar.`,
      `The ${terrain} stretches beyond it in every direction.`,
    ]))
  }

  return sentences.join(' ')
}

// ── Paragraph 2: The Presence ──

/** @type {Record<string, string>} */
const BEHAVIOR_VERBS = {
  predator: 'hunt near',
  grazer: 'feed among',
  burrower: 'tunnel beneath',
  drifter: 'pass through',
  rooted: 'cling to',
  parasite: 'feed on',
  sentinel: 'watch from',
  swarm: 'cluster around',
  mimic: 'blend into',
  decay: 'slowly consume',
}

/** @type {Record<string, ((type: string, material: string) => string)[]>} */
const ARTIFACT_PHRASES = {
  enshrined: [
    (type, material) => `A ${type} of ${material} rests here, undisturbed.`,
    (type, material) => `A ${material} ${type} stands in a place of honor.`,
  ],
  buried: [
    (_type, material) => `Something of ${material} lies half-buried in the ground.`,
    (type, _material) => `The edge of a ${type} protrudes from the earth.`,
  ],
  carried: [
    (type, material) => `A ${material} ${type} has been left here, perhaps temporarily.`,
  ],
  lost: [
    (type, material) => `A ${material} ${type} lies forgotten among the debris.`,
  ],
  scattered: [
    (_type, material) => `Fragments of ${material} litter the ground \u2014 something broken, something old.`,
  ],
}

/**
 * Compose the presence paragraph — sacred sites, artifacts, creatures.
 * Returns null if nothing notable is here.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {LandmarkContext} ctx
 * @returns {string | null}
 */
function composePresence(graph, rng, ctx) {
  const { sacredSite, religion, artifacts, lifeforms, region } = ctx
  const sentences = []

  // Sacred site
  if (sacredSite && religion) {
    sentences.push(pick(rng, [
      `Offerings mark this as sacred to the ${religion.name}.`,
      `The ${religion.name} claim this ground. Their marks are everywhere.`,
      `Signs of the ${religion.name} are etched into the surface \u2014 prayers, warnings, or both.`,
    ]))
  }

  // Artifacts (max 2)
  for (const artifact of artifacts.slice(0, 2)) {
    const status = artifact.location.status
    const pool = ARTIFACT_PHRASES[status] ?? ARTIFACT_PHRASES.lost
    const template = pick(rng, pool)
    sentences.push(template(artifact.type, artifact.material))
  }

  // Creature activity (max 1)
  if (lifeforms.length > 0) {
    const creature = pick(rng, lifeforms)
    const verb = BEHAVIOR_VERBS[creature.behavior] ?? 'inhabit'
    const where = region?.terrainTypes.length
      ? pick(rng, region.terrainTypes)
      : 'the surroundings'
    sentences.push(`${creature.name} ${verb} the ${where} nearby.`)
  }

  return sentences.length > 0 ? sentences.join(' ') : null
}

// ── Paragraph 3: The Echo ──

/** @type {Record<string, string[]>} */
const EVENT_EVIDENCE = {
  war: [
    'The ground is scarred. Something burned here and fused the earth.',
    'Gouges in the surface run deep \u2014 old violence, still legible.',
    'Broken things have been pushed to the margins. The center is cleared.',
  ],
  hubris: [
    'Something too large was built here once. Only the foundation remains.',
    'The proportions are wrong \u2014 too ambitious, too certain.',
    'There are marks of overreach: columns that fell outward, walls that burst.',
  ],
  exodus: [
    'The paths leading away are worn deeper than the paths arriving.',
    'Something was abandoned here. The leavings are methodical.',
    'There is a finality to the emptiness, as if departure was the point.',
  ],
  discovery: [
    'A seam in the stone has been pried open, long ago.',
    'Someone dug here with purpose. The excavation was never filled.',
    'What was buried has been uncovered. The earth around it still looks raw.',
  ],
  sacrifice: [
    'There is an altar here, or what was one. The stone is stained.',
    'Something was given up in this place. The hollow in the ground is shaped like offering.',
    'The center of this place is lower than the edges, worn down by ritual.',
  ],
  corruption: [
    'The stone here has darkened. It spreads outward from a center.',
    'Something has seeped into the ground and changed its color.',
    'There is a wrongness in the texture \u2014 soft where it should be hard, dark where it should not be.',
  ],
  sundering: [
    'A crack runs through everything, as though the land itself was split.',
    'Two halves of something that was once whole sit apart, misaligned.',
    'The break is clean and total. Nothing has grown across it.',
  ],
  return: [
    'Something old has surfaced. The ground around it looks new by comparison.',
    'There are signs of recent disturbance in a place that has been still for ages.',
    'What was sealed is open. What was forgotten is exposed.',
  ],
}

const DIRECTIONS = ['north', 'south', 'east', 'west', 'the horizon', 'the distance']

/**
 * Compose the echo paragraph — implied history, connections.
 * Returns null if no relevant events or connections.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {LandmarkContext} ctx
 * @returns {string | null}
 */
function composeEcho(graph, rng, ctx) {
  const { relevantEvents, nearbyLandmarks, region } = ctx
  const sentences = []

  // Event evidence (max 2)
  for (const event of relevantEvents.slice(0, 2)) {
    const pool = EVENT_EVIDENCE[event.archetype]
    if (pool) {
      sentences.push(pick(rng, pool))
    }
  }

  // Connection to nearby landmark
  if (nearbyLandmarks.length > 0) {
    const other = pick(rng, nearbyLandmarks)
    const dir = pick(rng, DIRECTIONS)
    sentences.push(`From here, ${other.name} is visible to ${dir}.`)
  } else if (region) {
    const terrain = region.terrainTypes.length > 0 ? pick(rng, region.terrainTypes) : 'land'
    sentences.push(`Beyond this, the ${terrain} of ${region.name} stretches in every direction.`)
  }

  if (sentences.length === 0) return null

  // If we only have a connection sentence and no event evidence, sometimes skip
  if (relevantEvents.length === 0 && rng() > 0.6) return null

  return sentences.join(' ')
}

// ── Main entry point ──

/**
 * Render prose descriptions for all landmarks in the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 * @returns {Map<string, string>}
 */
export function renderLandmarks(graph, world, rng) {
  /** @type {Map<string, string>} */
  const result = new Map()

  const landmarks = world.geogony?.landmarks ?? []
  for (const landmark of landmarks) {
    const ctx = gatherContext(graph, rng, world, landmark)

    const paragraphs = [composeArrival(graph, rng, ctx)]

    const presence = composePresence(graph, rng, ctx)
    if (presence) paragraphs.push(presence)

    const echo = composeEcho(graph, rng, ctx)
    if (echo) paragraphs.push(echo)

    result.set(landmark.id, paragraphs.join('\n\n'))
  }

  return result
}
