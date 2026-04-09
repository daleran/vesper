/**
 * Region prose renderer. Consumes a completed World and produces
 * 1–3 paragraph atmospheric descriptions per region. Read-only — never mutates World.
 *
 * Voice: traversal. Regions describe what you notice while moving through.
 * Contrast with landmarks (arrival/inspection) — different vocabulary, different verbs.
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
 * @import { MythicEvent } from '../history.js'
 * @import { Crisis } from '../present.js'
 */
import { pick, conceptOverlap } from '../utils.js'
import { resolveSubstance } from '../conceptResolvers.js'
import { findPolity } from '../world.js'
import { buildSensoryProfile, sensoryPhrase, moodPhrase, getSensoryEdges } from './sensory.js'

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
 *   relevantEvents: MythicEvent[],
 *   crisis: Crisis | undefined,
 *   landmarkNames: string[],
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

  // Resolve events that shaped this region
  const events = world.events ?? []
  const relevantEvents = []
  if (region.primaryEvent !== undefined && region.primaryEvent !== null && events[region.primaryEvent]) {
    relevantEvents.push(events[region.primaryEvent])
  }
  for (const idx of region.taggedBy) {
    if (events[idx] && !relevantEvents.includes(events[idx])) {
      relevantEvents.push(events[idx])
      if (relevantEvents.length >= 2) break
    }
  }

  const crisis = world.present?.crisis

  // Resolve landmark names
  const allLandmarks = geogony.landmarks ?? []
  const landmarkNames = region.landmarks
    .map(id => allLandmarks.find(l => l.id === id)?.name)
    .filter(/** @returns {n is string} */ n => n !== undefined && n !== null)

  return {
    region, profile, substance, terrainTypes, polity, ruins,
    peoples, religions, sacredSites, lifeforms, wrongnessScore, crisisImpact,
    relevantEvents, crisis, landmarkNames,
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

// ── Paragraph 1: The Crossing ──

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

  // Atmosphere from climate
  const climateSentence = composeClimate(rng, region.climate, profile)
  if (climateSentence) {
    sentences.push(climateSentence)
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

/** @type {Record<string, string[]>} */
const CLIMATE = {
  ice: [
    'The cold is absolute.',
    'Ice clings to every surface. The air is still and bitter.',
    'Walking here, the cold enters through the soles of your feet first.',
    'Nothing thaws. The ice is not seasonal — it is permanent.',
  ],
  frost: [
    'Frost covers everything, even in what passes for daylight.',
    'The air bites. Breath hangs visible and slow.',
    'Frost forms on your clothing as you walk. The land takes the warmth from anything that moves.',
    'The ground crunches with every step. Nothing here is soft.',
  ],
  rain: [
    'Rain falls here often enough to stain the stone.',
    'The air is heavy with moisture. Everything drips.',
    'The rain is constant enough that the paths have become channels.',
    'Water runs across the ground in thin sheets. The land never quite dries.',
  ],
  mist: [
    'Mist clings low, blurring the edges of things.',
    'Visibility shifts with the fog. Distance is uncertain.',
    'The mist thickens as you walk, as if the land itself is breathing.',
    'Sound behaves strangely in the fog — close things seem far, far things seem beside you.',
  ],
  wind: [
    'The wind never stops.',
    'Wind scours the landscape, carrying grit and sound.',
    'The wind changes direction without warning. It comes from everywhere.',
    'Nothing grows tall here. The wind will not permit it.',
  ],
  dust: [
    'Dust hangs in the air, fine and inescapable.',
    'The air is thick with dust. It settles on everything.',
    'Your tracks fill in behind you as you walk. The dust reclaims every mark.',
    'The dust gets into everything — eyes, lungs, the folds of your clothing.',
  ],
  ash: [
    'Ash drifts down like grey snow.',
    'The air tastes of ash. It coats the tongue and the eyes.',
    'Ash has buried the older paths. You walk on a surface that did not exist a season ago.',
    'The ash muffles sound. Footsteps disappear the moment they are made.',
  ],
  fire: [
    'Heat radiates from the ground itself.',
    'The air shimmers with heat. Nothing here is cool.',
    'The heat is not from the sky. It rises from below, through the soles of your feet.',
    'Crossing this land means rationing every breath. The air itself is parched.',
  ],
  shadow: [
    'The light here is wrong — too dim, too angled.',
    'Shadows pool in places where they should not be.',
    'As you walk, the shadows move with you — not yours, but the land\'s.',
    'The dim light flattens everything. Depth is hard to judge.',
  ],
  light: [
    'The light is unnervingly clear.',
    'Brightness presses in from all directions, without warmth.',
    'The light here leaves nothing hidden. Every flaw in the ground is visible for miles.',
    'There are no shadows to rest in. The light is total.',
  ],
  silence: [
    'The silence is not peaceful. It is empty.',
    'Sound does not carry here. The air swallows it.',
    'Your own footsteps sound wrong — too loud, too isolated.',
    'The silence is a pressure. It pushes against the ears.',
  ],
  storm: [
    'The sky threatens constantly. Storms pass through without warning.',
    'The air crackles with the memory of lightning.',
    'The storms here leave marks — scorched earth, split stone, paths rerouted overnight.',
    'You learn to read the sky quickly. The weather does not negotiate.',
  ],
}

/** @type {Record<string, string>} */
const CLIMATE_COMBINATIONS = {
  'wind+dust': 'The wind drives the dust in sheets. Visibility drops to nothing, then clears, then drops again.',
  'rain+mist': 'Rain and mist merge into a single wet curtain. The boundary between sky and ground dissolves.',
  'ice+frost': 'Everything is locked in frost. The cold has layers — surface ice, deep cold, and something older beneath both.',
  'fire+ash': 'Ash falls through heat-shimmer. The ground is warm and the air is grey and the two together make breathing a negotiation.',
  'shadow+silence': 'The darkness is quiet. Not peaceful quiet — the kind where sound has been taken away.',
  'wind+storm': 'The wind carries the storm sideways. Lightning strikes horizontal. Nothing here grows straight.',
  'dust+fire': 'The dust is warm. Heat and grit combine into something that scours exposed skin.',
  'mist+shadow': 'The mist is dark. You walk through it without seeing what you are walking through.',
  'rain+wind': 'The rain comes sideways, driven by wind that has nothing to break against.',
  'ice+wind': 'The wind carries ice crystals that cut exposed skin. Movement here is a negotiation with the air.',
}

/**
 * Compose a climate-driven atmosphere sentence.
 * @param {() => number} rng
 * @param {string[]} climateConcepts
 * @param {SensoryProfile} profile
 * @returns {string | null}
 */
function composeClimate(rng, climateConcepts, profile) {
  if (climateConcepts.length === 0) return null

  // Try combination first for multi-climate regions
  if (climateConcepts.length >= 2) {
    const sorted = [climateConcepts[0], climateConcepts[1]].sort()
    const comboKey = sorted.join('+')
    const combo = CLIMATE_COMBINATIONS[comboKey]
    if (combo) return combo
  }

  const concept = pick(rng, climateConcepts)
  const pool = CLIMATE[concept]
  if (pool) {
    const sentence = pick(rng, pool)
    // Append sound if the sentence doesn't already fill the air
    if (profile.sound && rng() < 0.3) {
      return sentence + ' ' + sensoryPhrase('sound', profile.sound) + '.'
    }
    return sentence
  }

  return `The air carries the quality of ${concept}.`
}

// ── Paragraph 2: What Lives Here ──

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

/**
 * Compose danger as environmental texture — things noticed while traveling.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {RegionContext} ctx
 * @returns {string | null}
 */
function composeDanger(graph, rng, ctx) {
  const dangers = ctx.region.dangers
  if (dangers.length === 0) return null

  const sentences = []
  const used = Math.min(dangers.length, 2)

  for (let i = 0; i < used; i++) {
    const danger = dangers[i]
    const edges = getSensoryEdges(graph, danger)

    if (edges.color) {
      const phrase = sensoryPhrase('color', edges.color)
      sentences.push(pick(rng, [
        `The ${phrase} stains on the ground grow more frequent as you walk.`,
        `There is a ${phrase} discoloration here that does not belong to the stone.`,
      ]))
    } else if (edges.sound) {
      const phrase = sensoryPhrase('sound', edges.sound)
      sentences.push(pick(rng, [
        `${phrase} — faintly at first, then unmistakable.`,
        `You notice it after a while: ${phrase}, just beneath the threshold of attention.`,
      ]))
    } else if (edges.texture) {
      const phrase = sensoryPhrase('texture', edges.texture)
      sentences.push(pick(rng, [
        `The ground turns ${phrase} in patches. You learn to step around them.`,
        `Certain stretches of ground are ${phrase} — you avoid them without thinking.`,
      ]))
    } else {
      sentences.push(pick(rng, [
        `There is a quality of ${danger} in the air that does not fade with distance.`,
        `The sense of ${danger} builds as you cross this ground. It does not pass.`,
      ]))
    }

    if (sentences.length >= 1) break // One danger sentence is usually enough
  }

  return sentences.length > 0 ? sentences.join(' ') : null
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

/** @type {Record<string, string[]>} */
const CRISIS_SIGNS = {
  plague: [
    'The sickness is visible here — in the soil, in the water, in the faces of anyone you meet.',
    'The sickness has reached here — not yet consuming, but present in the water, in the worry.',
  ],
  schism: [
    'This is where the division began. Markings have been defaced. Paths have been blocked.',
    'The arguments have spread this far. Old neighbors pass each other without speaking.',
  ],
  succession: [
    'The old authority\'s symbols are being torn down. Nothing has replaced them yet.',
    'Word of the change has arrived. People here are waiting, uncertain.',
  ],
  invasion: [
    'The occupation is total here. Foreign marks cover every surface.',
    'Scouts have been seen. The people here are watchful and quiet.',
  ],
  depletion: [
    'The land is exhausted. What was taken from here has not been replaced.',
    'Resources are thinner than they should be. Something is drawing them away.',
  ],
  awakening: [
    'The ground trembles. Something beneath this region is no longer still.',
    'Tremors pass through occasionally. The animals are uneasy.',
  ],
}

/**
 * Compose crisis impact sentence if the region is affected.
 * @param {() => number} rng
 * @param {RegionContext} ctx
 * @returns {string | null}
 */
function composeCrisisImpact(rng, ctx) {
  const { crisisImpact, crisis } = ctx
  if (!crisisImpact || !crisis) return null

  const pool = CRISIS_SIGNS[crisis.type]
  if (!pool) return null

  // Index 0 = epicenter, index 1 = affected
  const idx = crisisImpact === 'epicenter' ? 0 : 1
  return pool[idx] ?? null
}

/**
 * Compose the cultural traces fragment.
 * @param {() => number} rng
 * @param {RegionContext} ctx
 * @returns {string | null}
 */
function composeCulture(rng, ctx) {
  const { peoples, polity, ruins, religions, sacredSites, lifeforms, landmarkNames } = ctx
  const sentences = []

  // Inhabited regions — modulated by polity state
  if (peoples.length > 0 && polity && polity.state !== 'fallen') {
    const people = pick(rng, peoples)
    if (polity.state === 'declining') {
      sentences.push(pick(rng, [
        `The ${people.name} hold this land, but their grip is loosening. Paths are overgrown, fences unmended.`,
        `Signs of the ${people.name} are everywhere, but many look abandoned. Their presence is thinning.`,
        `The ${people.name} claim this land. Fewer of them mean it every season.`,
      ]))
    } else if (polity.state === 'rising') {
      sentences.push(pick(rng, [
        `The ${people.name} are expanding into this territory. New paths are being cut, new markers set.`,
        `Signs of the ${people.name} are everywhere and fresh — foundations, trails, cleared ground.`,
        `The ${people.name} claim this land and are building on it. Their marks are deliberate and new.`,
      ]))
    } else {
      sentences.push(pick(rng, [
        `The ${people.name} have settled here. Their presence is visible in every cleared path and marked stone.`,
        `Signs of the ${people.name} are everywhere — foundations, trails, the remains of recent fires.`,
        `The ${people.name} claim this land. Their marks are deliberate.`,
        `The ${people.name} have made this place theirs. Boundaries are set, paths are maintained.`,
      ]))
    }
  } else if (peoples.length > 0) {
    const people = pick(rng, peoples)
    sentences.push(pick(rng, [
      `The ${people.name} pass through here, but have not stayed.`,
      `There are traces of the ${people.name} — old camps, faded markings — but no permanence.`,
      `The ${people.name} know this land but do not live in it. Their tracks lead through, not to.`,
    ]))
  }

  // Ruins
  if (ruins.length > 0) {
    const ruin = pick(rng, ruins)
    sentences.push(pick(rng, [
      `What ${ruin.name} built here has not lasted. Foundations remain, half-swallowed.`,
      `The ruins of ${ruin.name} still stand, barely. No one has repaired them.`,
      `${ruin.name} left structures behind. They are crumbling now.`,
      `You pass the remains of ${ruin.name} without stopping. There is nothing left to stop for.`,
    ]))
  }

  // Sacred presence
  if (sacredSites.length > 0 && religions.length > 0) {
    const religion = pick(rng, religions)
    sentences.push(pick(rng, [
      `Markings of the ${religion.name} are cut into the stone — observances, boundaries, warnings.`,
      `The ${religion.name} consider this ground sacred. Their signs are unmistakable.`,
      `You cross ground the ${religion.name} have claimed. Their markers line the path.`,
    ]))
  }

  // Landmark reference — distant awareness
  if (landmarkNames.length > 0 && rng() < 0.5) {
    const lm = pick(rng, landmarkNames)
    sentences.push(pick(rng, [
      `${lm} lies somewhere in this expanse — you sense its presence before you find it.`,
      `The land bends toward ${lm}. Even without seeing it, you know it is close.`,
      `Travelers speak of ${lm} ahead. The land seems to orient around it.`,
    ]))
  }

  // Lifeform presence (if no cultural content yet)
  if (sentences.length === 0 && lifeforms.length > 0) {
    const creature = pick(rng, lifeforms)
    const sign = BEHAVIOR_SIGNS[creature.behavior] ?? 'inhabit this place'
    sentences.push(`${creature.name} ${sign}. You see the evidence before you see them.`)
  }

  // Uninhabited emptiness (if still nothing)
  if (sentences.length === 0) {
    if (rng() < 0.4) {
      sentences.push(pick(rng, [
        'No one has settled here. The land does not invite it.',
        'There are no signs of habitation. The emptiness is complete.',
        'Nothing here suggests anyone has stayed. The land belongs to itself.',
      ]))
    }
  }

  return sentences.length > 0 ? sentences.join(' ') : null
}

// ── Paragraph 3: What Happened Here ──

/** @type {Record<string, string[]>} */
const REGION_RESIDUE = {
  war: [
    'The ground is uneven for miles — old trenches, old earthworks, filled in but never leveled.',
    'Trees do not grow in certain strips. The soil remembers formations.',
    'Stone walls run in broken lines across the terrain, marking borders that no longer matter.',
  ],
  hubris: [
    'The land was cleared here once, ambitiously. What grew back is not what was there before.',
    'Foundation lines are visible from high ground — a grid that stretches further than any settlement.',
    'Channels were cut into the earth, planned but never completed. Water pools in them still.',
  ],
  exodus: [
    'The trails here are wide and worn in one direction only.',
    'Campsites dot the route — cold firepits, flattened ground — each one further from the last.',
    'Belongings have been left at intervals, as if the weight became too much, mile by mile.',
  ],
  discovery: [
    'There are dig sites scattered across this region, long abandoned.',
    'The ground has been turned in places, methodically, by people looking for something specific.',
    'Cairns mark points of interest — someone was surveying this land, cataloguing it.',
  ],
  sacrifice: [
    'Certain clearings have an arranged quality — the stones set just so, the ground swept bare.',
    'The paths converge on a low point in the landscape where nothing grows.',
    'Offerings have been left at intervals along the trail — old ones, sun-bleached and forgotten.',
  ],
  corruption: [
    'The color of the soil changes as you walk — darker, richer, wrong.',
    'Vegetation thins in concentric patterns, as if something beneath is spreading.',
    'Streams here taste of metal. Animals drink from them but do not linger.',
  ],
  sundering: [
    'A rift cuts across the landscape, impossible to miss and difficult to cross.',
    'The terrain on either side of the fault line does not match — different soil, different growth.',
    'Bridges have been built and rebuilt across the gap. None have lasted.',
  ],
  return: [
    'The land is restless. Stones have shifted. Old surfaces are exposed.',
    'Something beneath the ground has pushed upward, tilting the terrain.',
    'What was buried is showing through — foundations, old roads, things that should still be deep.',
  ],
}

/**
 * Compose event residue — landscape-scale evidence of what shaped this region.
 * @param {() => number} rng
 * @param {RegionContext} ctx
 * @returns {string | null}
 */
function composeResidue(rng, ctx) {
  const { relevantEvents } = ctx
  if (relevantEvents.length === 0) return null

  const sentences = []
  const usedArchetypes = new Set()

  for (const event of relevantEvents) {
    const pool = REGION_RESIDUE[event.archetype]
    if (!pool || usedArchetypes.has(event.archetype)) continue
    usedArchetypes.add(event.archetype)
    sentences.push(pick(rng, pool))
    if (sentences.length >= 2) break
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

  // Paragraph 1: The Crossing (always present)
  const land = composeTerrain(graph, rng, ctx)

  // Paragraph 2: What Lives Here (conditional)
  const feelParts = []

  // Mood
  if (ctx.region.mood.length > 0) {
    feelParts.push(moodPhrase(rng, ctx.region.mood))
  }

  // Wrongness
  const wrongness = composeWrongness(rng, ctx)
  if (wrongness) feelParts.push(wrongness)

  // Danger texture
  const danger = composeDanger(graph, rng, ctx)
  if (danger) feelParts.push(danger)

  // Cultural traces
  const culture = composeCulture(rng, ctx)
  if (culture) feelParts.push(culture)

  // Crisis impact (closing observation)
  const crisisNote = composeCrisisImpact(rng, ctx)
  if (crisisNote) feelParts.push(crisisNote)

  const paragraphs = [land]
  if (feelParts.length > 0) {
    paragraphs.push(feelParts.join(' '))
  }

  // Paragraph 3: What Happened Here (conditional)
  const residue = composeResidue(rng, ctx)
  if (residue) {
    paragraphs.push(residue)
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
