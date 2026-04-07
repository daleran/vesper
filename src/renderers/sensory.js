/**
 * Shared sensory utilities for prose renderers.
 * Builds sensory profiles from concept graph edges and produces
 * prose fragments for color, texture, shape, sound, and mood.
 *
 * @import { ConceptGraph } from '../concepts.js'
 */
import { pick } from '../utils.js'

// ── Sensory profile ──

/**
 * @typedef {{
 *   color: string | null,
 *   texture: string | null,
 *   shape: string | null,
 *   sound: string | null,
 *   mood: string[],
 *   strikingSense: 'color' | 'texture' | 'shape' | 'sound' | null,
 * }} SensoryProfile
 */

/**
 * @typedef {{
 *   color: string | null,
 *   texture: string | null,
 *   sound: string | null,
 *   shape: string | null,
 *   evokes: string[],
 * }} SensoryEdges
 */

/**
 * Resolve color/sound/texture/shape/evokes for a single concept from graph edges.
 * Falls through evokes neighbors for missing senses. Returns nulls for unresolvable senses.
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @returns {SensoryEdges}
 */
export function getSensoryEdges(graph, concept) {
  /** @type {string | null} */
  let color = null
  /** @type {string | null} */
  let texture = null
  /** @type {string | null} */
  let sound = null
  /** @type {string | null} */
  let shape = null
  /** @type {string[]} */
  const evokes = []

  const edges = graph.get(concept)
  if (!edges) return { color, texture, sound, shape, evokes }

  for (const e of edges) {
    if (e.direction !== 'fwd') continue
    if (e.relation === 'color' && !color) color = e.concept
    else if (e.relation === 'texture' && !texture) texture = e.concept
    else if (e.relation === 'sound' && !sound) sound = e.concept
    else if (e.relation === 'shape' && !shape) shape = e.concept
    else if (e.relation === 'evokes' && !evokes.includes(e.concept)) evokes.push(e.concept)
  }

  // One-hop through evokes to find missing senses
  if (!color || !texture || !sound || !shape) {
    for (const e of edges) {
      if (e.direction !== 'fwd' || e.relation !== 'evokes') continue
      const nEdges = graph.get(e.concept)
      if (!nEdges) continue
      for (const ne of nEdges) {
        if (ne.direction !== 'fwd') continue
        if (ne.relation === 'color' && !color) color = ne.concept
        else if (ne.relation === 'texture' && !texture) texture = ne.concept
        else if (ne.relation === 'sound' && !sound) sound = ne.concept
        else if (ne.relation === 'shape' && !shape) shape = ne.concept
      }
    }
  }

  return { color, texture, sound, shape, evokes }
}

/**
 * Build a sensory profile from a set of concepts by walking their
 * color/texture/shape/sound/evokes edges.
 * @param {ConceptGraph} graph
 * @param {string[]} concepts
 * @returns {SensoryProfile}
 */
export function buildSensoryProfile(graph, concepts) {
  /** @type {string | null} */
  let color = null
  /** @type {string | null} */
  let texture = null
  /** @type {string | null} */
  let shape = null
  /** @type {string | null} */
  let sound = null
  /** @type {string[]} */
  const mood = []

  /** @type {Record<string, number>} */
  const senseCounts = { color: 0, texture: 0, shape: 0, sound: 0 }

  for (const c of concepts) {
    const edges = graph.get(c)
    if (!edges) continue
    for (const e of edges) {
      if (e.direction !== 'fwd') continue
      if (e.relation === 'color') {
        senseCounts.color++
        if (!color) color = e.concept
      } else if (e.relation === 'texture') {
        senseCounts.texture++
        if (!texture) texture = e.concept
      } else if (e.relation === 'shape') {
        senseCounts.shape++
        if (!shape) shape = e.concept
      } else if (e.relation === 'sound') {
        senseCounts.sound++
        if (!sound) sound = e.concept
      } else if (e.relation === 'evokes') {
        if (!mood.includes(e.concept)) mood.push(e.concept)
      }
    }
  }

  const strikingSense = rankStrikingness(senseCounts)

  return { color, texture, shape, sound, mood, strikingSense }
}

/**
 * Pick the most striking sense — the rarest one with at least 1 hit.
 * Tiebreaker priority: sound > color > texture > shape.
 * @param {Record<string, number>} counts
 * @returns {'color' | 'texture' | 'shape' | 'sound' | null}
 */
function rankStrikingness(counts) {
  /** @type {('sound' | 'color' | 'texture' | 'shape')[]} */
  const priority = ['sound', 'color', 'texture', 'shape']
  const present = priority.filter(s => counts[s] > 0)
  if (present.length === 0) return null
  present.sort((a, b) => counts[a] - counts[b] || priority.indexOf(a) - priority.indexOf(b))
  return present[0]
}

// ── Sensory phrase tables ──

/** @type {Record<string, Record<string, string>>} */
const SENSE_PHRASES = {
  color: {
    red: 'stained red',
    gold: 'gilded',
    white: 'bleached white',
    grey: 'ashen',
    black: 'dark as void',
    blue: 'cold blue',
    silver: 'silver-bright',
    brown: 'earth-dark',
    clear: 'translucent',
    varied: 'mottled with shifting color',
  },
  texture: {
    rough: 'rough-hewn',
    smooth: 'worn smooth',
    wet: 'slick with moisture',
    soft: 'soft and yielding',
    sharp: 'razor-edged',
    cold: 'cold to the touch',
  },
  shape: {
    slab: 'flat and broad',
    hollow: 'hollowed out',
    pillar: 'rising like a pillar',
    shard: 'jagged and broken',
    spiral: 'coiled in spirals',
    coil: 'wound tight',
    circle: 'perfectly round',
    point: 'tapering to a point',
    branch: 'branching outward',
    web: 'threaded like a web',
    crescent: 'curved like a crescent',
  },
  sound: {
    roar: 'a low roar fills the air',
    whisper: 'the air carries a faint whisper',
    crack: 'something cracks underfoot',
    ring: 'a faint ringing hangs in the air',
    hush: 'silence presses close',
    moan: 'a low moan rises from the ground',
    hum: 'a hum resonates through the stone',
    hollow: 'sound falls away into nothing',
    silence: 'the silence here is absolute',
    drum: 'a dull pulse beats somewhere below',
    echo: 'every sound returns doubled',
  },
}

/**
 * Turn a sense type and value into a prose fragment.
 * @param {'color' | 'texture' | 'shape' | 'sound'} sense
 * @param {string} value
 * @returns {string}
 */
export function sensoryPhrase(sense, value) {
  return SENSE_PHRASES[sense]?.[value] ?? value
}

// ── Mood phrase tables ──

/** @type {Record<string, string[]>} */
const MOOD_PHRASES = {
  grief: [
    'There is a heaviness here, old and settled.',
    'The weight of something lost presses down on everything.',
    'Sorrow clings to this place like damp.',
  ],
  hunger: [
    'Something here feels unfinished, wanting.',
    'The air has a hollow quality, as if the place itself is starving.',
    'There is an ache here, faint but persistent.',
  ],
  fear: [
    'The air carries a warning the body understands before the mind.',
    'Something about this place makes the skin prickle.',
    'An instinct to leave rises unbidden.',
  ],
  rage: [
    'The ground remembers violence.',
    'There is a tension here, like a held breath before a scream.',
    'Something furious was done in this place.',
  ],
  wrath: [
    'The ground remembers violence.',
    'Anger left its mark here — in the stone, in the air.',
    'This place was shaped by fury.',
  ],
  longing: [
    'This place aches with distance.',
    'Something here reaches toward what it cannot have.',
    'There is a pull in the air, a yearning that has no source.',
  ],
  hope: [
    'Something persists here, against all odds.',
    'There is a stubbornness to this place, a refusal to be consumed.',
    'Light finds its way here, somehow.',
  ],
  death: [
    'This is a place where things end.',
    'The stillness here is final.',
    'Nothing grows. Nothing moves. It is done.',
  ],
  pride: [
    'Everything here was built to last.',
    'There is an arrogance to this place, a defiance of time.',
    'Whoever made this meant it to be remembered.',
  ],
  memory: [
    'The stones remember what the living have forgotten.',
    'This place holds something that refuses to fade.',
    'Echoes linger here longer than they should.',
  ],
  endurance: [
    'Whatever was here endured.',
    'This place has outlasted everything around it.',
    'Time has tried to wear this down and failed.',
  ],
  silence: [
    'Nothing has spoken here in a long time.',
    'The quiet here is not peaceful. It is empty.',
    'Sound does not carry. The air swallows it.',
  ],
  truth: [
    'There is a clarity here that is almost painful.',
    'This place strips away pretense.',
    'Something here insists on being seen.',
  ],
  wound: [
    'This place has not healed.',
    'There is damage here that time has not touched.',
    'Something was broken here and never mended.',
  ],
  life: [
    'There is a vitality here, stubborn and insistent.',
    'Things grow in this place, relentlessly.',
    'The air hums with the effort of living things.',
  ],
  sacrifice: [
    'Something was given up here. The absence is palpable.',
    'There is a hollowness where something important used to be.',
    'The cost of something lingers in this place.',
  ],
  corruption: [
    'Something has gone wrong here, quietly.',
    'There is a wrongness that is easy to miss at first.',
    'What was once sound has begun to turn.',
  ],
  decay: [
    'Things fall apart here faster than they should.',
    'Entropy has a foothold in this place.',
    'The edges of everything are softening, dissolving.',
  ],
  time: [
    'Time moves differently here.',
    'The age of this place is difficult to reckon.',
    'Something about the light suggests a different era.',
  ],
  forgetting: [
    'The details of this place resist the mind.',
    'Something here slips away the moment you stop looking.',
    'This is a place made for forgetting.',
  ],
  will: [
    'There is a stubbornness embedded in the ground itself.',
    'This place was held together by intent.',
    'Something here refuses to yield.',
  ],
  lie: [
    'Nothing here is quite what it seems.',
    'There is a wrongness that resists examination.',
    'The surface of this place conceals something.',
  ],
  neglect: [
    'No one has tended this place in a very long time.',
    'Abandonment has its own texture here.',
    'What was once cared for has been left to ruin.',
  ],
  preservation: [
    'Something here has been kept, carefully and deliberately.',
    'Time has been held at bay in this place.',
    'There is an uncanny freshness to everything.',
  ],
  fragility: [
    'Everything here feels like it could shatter.',
    'There is a delicacy to this place that makes movement feel reckless.',
    'One wrong step and something irreplaceable breaks.',
  ],
  patience: [
    'This place waits.',
    'There is no urgency here, only a slow certainty.',
    'Whatever is happening here has been happening for a very long time.',
  ],
  creation: [
    'Something was made here.',
    'The marks of making are everywhere.',
    'This place still carries the heat of its own forging.',
  ],
  power: [
    'There is a charge in the air, like the moment before lightning.',
    'Something immense was wielded here.',
    'The ground itself seems to hum with residual force.',
  ],
  fate: [
    'There is a gravity to this place that has nothing to do with the ground.',
    'Something inevitable happened here, or will.',
    'The air is thick with consequence.',
  ],
}

/**
 * Pick a mood phrase from the mood array. Returns a fallback if no moods match.
 * @param {() => number} rng
 * @param {string[]} moods
 * @returns {string}
 */
export function moodPhrase(rng, moods) {
  for (const m of moods) {
    const phrases = MOOD_PHRASES[m]
    if (phrases) return pick(rng, phrases)
  }
  return 'The air is heavy with something unnamed.'
}
