/**
 * Myth-to-Text Renderer — generates in-world texts from world data.
 * Produces 10-30 MythText objects across 8 genre types (hymn, folk,
 * heresy, fragment, prayer, prophecy, lament, parable).
 *
 * Does not mutate world data. Returns MythText[] to be assigned by main.js.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { CreationMyth } from '../recipes/index.js'
 * @import { World } from '../world.js'
 * @import { Agent } from '../pantheon.js'
 * @import { MythicEvent } from '../history.js'
 * @import { Artifact } from '../artifacts.js'
 */
import { pick, clamp, conceptOverlap } from '../utils.js'
import { nameRegion } from '../naming.js'
import { expandConceptCluster } from '../conceptResolvers.js'

// ── Typedef ──

/**
 * @typedef {{
 *   id: string,
 *   type: 'hymn'|'folk'|'heresy'|'fragment'|'prayer'|'prophecy'|'lament'|'parable',
 *   title: string,
 *   body: string,
 *   perspective: 'devout'|'skeptical'|'fearful'|'grieving'|'defiant'|'pragmatic',
 *   referencedAgentIds: string[],
 *   referencedArtifactIds: string[],
 *   concepts: string[],
 * }} MythText
 */

// ── Helpers ──

/**
 * Resolve color/sound/texture/shape for a concept from graph edges.
 * Falls back through evokes neighbors, then uses hardcoded defaults.
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @returns {{ color: string, sound: string, texture: string, shape: string }}
 */
function resolveSensory(graph, concept) {
  const result = { color: '', sound: '', texture: '', shape: '' }
  const edges = graph.get(concept) ?? []

  for (const e of edges) {
    if (e.direction !== 'fwd') continue
    if (e.relation === 'color' && !result.color) result.color = e.concept
    if (e.relation === 'sound' && !result.sound) result.sound = e.concept
    if (e.relation === 'texture' && !result.texture) result.texture = e.concept
    if (e.relation === 'shape' && !result.shape) result.shape = e.concept
  }

  if (!result.color || !result.sound || !result.texture || !result.shape) {
    for (const e of edges) {
      if (e.direction !== 'fwd' || e.relation !== 'evokes') continue
      const nEdges = graph.get(e.concept) ?? []
      for (const ne of nEdges) {
        if (ne.direction !== 'fwd') continue
        if (ne.relation === 'color' && !result.color) result.color = ne.concept
        if (ne.relation === 'sound' && !result.sound) result.sound = ne.concept
        if (ne.relation === 'texture' && !result.texture) result.texture = ne.concept
        if (ne.relation === 'shape' && !result.shape) result.shape = ne.concept
      }
    }
  }

  if (!result.color) result.color = 'dark'
  if (!result.sound) result.sound = 'silence'
  if (!result.texture) result.texture = 'rough'
  if (!result.shape) result.shape = 'formless'
  return result
}

/**
 * Return up to n artifacts with the highest concept overlap against the given concepts.
 * @param {ConceptGraph} graph
 * @param {string[]} concepts
 * @param {Artifact[]} artifacts
 * @param {number} n
 * @returns {Artifact[]}
 */
function findTopArtifacts(graph, concepts, artifacts, n) {
  if (artifacts.length === 0) return []
  const scored = artifacts.map(a => ({ a, score: conceptOverlap(graph, concepts, a.concepts) }))
  scored.sort((x, y) => y.score - x.score)
  return scored.filter(x => x.score > 0).slice(0, n).map(x => x.a)
}

/**
 * Get the verb from myth.act.roles if present, else a fallback from the creator concept.
 * @param {CreationMyth} myth
 * @param {() => number} rng
 * @returns {string}
 */
function mythVerb(myth, rng) {
  if (myth.act.roles['verb']) return /** @type {string} */ (myth.act.roles['verb'])
  return pick(rng, ['shaped', 'struck', 'divided', 'wove', 'called forth', 'consumed', 'spoke'])
}

/** @type {Record<string, string>} */
const PAST_TO_BASE = {
  shaped: 'shape', struck: 'strike', divided: 'divide', wove: 'weave',
  'called forth': 'call forth', consumed: 'consume', spoke: 'speak',
  dreamed: 'dream', split: 'split', mourned: 'mourn', stole: 'steal',
  spread: 'spread', merged: 'merge', gave_birth: 'give birth',
  wandered: 'wander', named: 'name', collided: 'collide',
  corrupted: 'corrupt', overthrew: 'overthrow', slew: 'slay',
  transgressed: 'transgress', sacrificed: 'sacrifice',
}

/**
 * Return base-form verb for "did not X" constructions.
 * @param {CreationMyth} myth
 * @param {() => number} rng
 * @returns {string}
 */
function mythVerbBase(myth, rng) {
  const past = mythVerb(myth, rng)
  return PAST_TO_BASE[past] ?? past.replace(/ed$/, '')
}

/** @type {Record<string, string>} */
const SOUND_RITUAL = {
  roar: 'a roaring cry', whisper: 'whispered names', crack: 'sharp cracks',
  ring: 'ringing tones', hush: 'hushed breath', moan: 'low moans',
  hum: 'a droning hum', silence: 'silence',
}

/**
 * Map a raw sound concept to a ritual-appropriate noun phrase.
 * @param {string} sound
 * @returns {string}
 */
function soundAsRitual(sound) {
  return SOUND_RITUAL[sound] ?? sound
}

const BARE_NOUNS = new Set([
  'death', 'dust', 'silence', 'nothing', 'hunger', 'void', 'fire',
  'war', 'grief', 'ruin', 'time', 'decay', 'sleep', 'shadow',
])

/**
 * Return concept with or without "the" — abstract nouns go bare.
 * @param {string} concept
 * @returns {string}
 */
function articleFor(concept) {
  return BARE_NOUNS.has(concept) ? concept : `the ${concept}`
}

/**
 * Find the primary creator agent among pantheon agents — the one whose
 * domains most overlap with myth.creators.
 * @param {World} world
 * @param {ConceptGraph} graph
 * @returns {Agent|null}
 */
function findCreatorAgent(world, graph) {
  const pantheonGods = world.agents.filter(a => a.origin === 'pantheon' && a.type === 'god')
  if (pantheonGods.length === 0) return world.agents.find(a => a.origin === 'pantheon') ?? null
  const creators = world.myth?.creators ?? []
  let best = pantheonGods[0]
  let bestScore = conceptOverlap(graph, creators, best.domains)
  for (let i = 1; i < pantheonGods.length; i++) {
    const s = conceptOverlap(graph, creators, pantheonGods[i].domains)
    if (s > bestScore) { bestScore = s; best = pantheonGods[i] }
  }
  return best
}

// ── Body templates ──
// Each template function receives a full context object and returns body prose.

/**
 * @typedef {{
 *   graph: ConceptGraph,
 *   rng: () => number,
 *   myth: CreationMyth,
 *   world: World,
 *   artifacts: Artifact[],
 * }} TextCtx
 */

/**
 * Hymn templates — reverent, liturgical, 4-beat structure.
 * @type {Array<(ctx: TextCtx) => string>}
 */
const HYMN_TEMPLATES = [
  // Four-beat litany
  ({ graph, rng, myth }) => {
    const before = myth.before.concepts[0] ?? 'the void'
    const sen = resolveSensory(graph, before)
    const creator = myth.creators[0] ?? myth.act.concepts[0] ?? 'the unnamed'
    const costC = myth.cost.concepts[0] ?? 'what was lost'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const verb = mythVerb(myth, rng)
    return `Before ${before}, there was only ${sen.color} ${sen.sound}. ${creator} moved through it and did not rest until the ${verb} was done. The cost was ${costC}; the price was paid once and is paid still. We sing against the ${flawC}. We sing it back. We sing.`
  },
  // Invocation with repetition
  ({ graph, rng, myth }) => {
    const creator = myth.creators[0] ?? 'the first'
    const actC = myth.act.concepts[1] ?? myth.act.concepts[0] ?? 'the shaping'
    const sen = resolveSensory(graph, actC)
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const verb = mythVerb(myth, rng)
    return `${creator}, ${creator}, who ${verb} the ${actC} from ${sen.texture} and ${sen.color}: we name the world for you. We name the ${sen.sound} for you. We name the ${flawC} for you, because it too is yours. Because you left it. Because it will not leave us.`
  },
  // Creation sequence
  ({ graph, rng, myth }) => {
    const before = myth.before.concepts[0] ?? 'the void'
    const sen = resolveSensory(graph, before)
    const creator = myth.creators[0] ?? 'the first'
    const substance = myth.worldAfter ?? myth.act.concepts[0] ?? 'the world'
    const costC = myth.cost.concepts[0] ?? 'what was given'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const verb = mythVerb(myth, rng)
    return `In the ${sen.shape} before ${sen.color}, in the ${sen.sound} before sound: there was ${creator}. ${creator} took ${before} and from it ${verb} ${substance}. ${costC} was the door through which the world passed. ${flawC} followed after. This is the oldest hymn. This is the only hymn.`
  },
]

/**
 * Folk account templates — simplified, emotional, personal.
 * @type {Array<(ctx: TextCtx, event?: MythicEvent) => string>}
 */
const FOLK_TEMPLATES = [
  // Grandmother story
  ({ graph, rng, myth }, event) => {
    const creator = myth.creators[0] ?? myth.act.concepts[0] ?? 'the old one'
    let actC = myth.act.concepts[0] ?? 'the shaping'
    if (creator === actC) {
      actC = myth.before.concepts[0] ?? myth.cost.concepts[0] ?? 'the shaping'
    }
    const flawC = myth.flaw.concepts[0] ?? 'the thing that came after'
    const eventC = event ? (event.consequence.concepts[0] ?? actC) : actC
    const sen = resolveSensory(graph, flawC)
    const verb = mythVerb(myth, rng)
    return `They say when the sky was new, ${creator} found ${actC} and ${verb} it open. That is why the ${flawC} still comes when the ${sen.color} fades. My grandmother said to never say the name of ${eventC} at dusk.`
  },
  // The old ones knew
  ({ graph, myth }, event) => {
    const creator = myth.creators[0] ?? 'the first'
    const costC = myth.cost.concepts[0] ?? 'something irretrievable'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const sen = resolveSensory(graph, flawC)
    const result = event ? event.consequence.concepts[0] : (myth.worldAfter ?? 'the world')
    return `The old ones knew. ${creator} did not mean to leave the ${costC} behind. But ${flawC} crept in while the ${sen.texture} was still warm. You can still find it in ${result}, if you know where to look.`
  },
  // Child-simple
  ({ myth }, event) => {
    const creator = myth.creators[0] ?? 'the shaper'
    const costC = myth.cost.concepts[0] ?? 'something dear'
    const flawC = myth.flaw.concepts[0] ?? 'the trouble'
    const marker = event ? event.legacy.concepts[0] : flawC
    return `First there was nothing. Then ${creator} made everything. But ${creator} had to give up ${costC} to do it. That is why we remember ${marker} — because it cost something to be here.`
  },
]

/**
 * Heresy templates — forbidden reinterpretation.
 * @type {Array<(ctx: TextCtx, event?: MythicEvent) => string>}
 */
const HERESY_TEMPLATES = [
  // The priests are wrong
  ({ graph, myth }, event) => {
    const creator = myth.creators[0] ?? 'the one they name'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const sen = resolveSensory(graph, flawC)
    const altC = event ? event.action.concepts[0] : (myth.important[0] ?? myth.act.concepts[1] ?? 'the other thing')
    return `The priests say ${creator} made the world from ${sen.texture}. This is not what the ${flawC} teaches. The ${flawC} was there first. The ${flawC} is older. What they call creation was only ${altC}. Do not bow to the ${creator}. The ${flawC} remembers the truth.`
  },
  // What the makers kept
  ({ graph, myth }, event) => {
    const creator = myth.creators[0] ?? 'the shaper'
    const costC = myth.cost.concepts[0] ?? 'the price'
    const actC = myth.act.concepts[0] ?? 'the making'
    const sen = resolveSensory(graph, actC)
    const altC = event ? event.action.concepts[0] : (myth.bad[0] ?? sen.shape)
    return `We are taught the cost was ${costC}. We are not taught what ${creator} kept. Ask what remains in the ${sen.color} places. Ask why ${altC} and ${creator} share the same ${sen.texture}. The makers always keep the best parts.`
  },
  // The overflow reinterpretation
  ({ graph, rng, myth }, event) => {
    const creator = myth.creators[0] ?? 'the first'
    const actC = myth.act.concepts[0] ?? 'the shaping'
    const costC = myth.cost.concepts[0] ?? 'the sacrifice'
    const sen = resolveSensory(graph, costC)
    const verb = mythVerbBase(myth, rng)
    const altC = event ? event.situation.concepts[0] : (myth.worldBefore ?? actC)
    return `${creator} did not ${verb} from love. The ${actC} was ${sen.texture} desperation. The ${altC} was all that remained after ${costC} was consumed. We are not the gift. We are what spilled.`
  },
]

/**
 * Scholarly fragment templates — analytical, notes contradictions.
 * @type {Array<(ctx: TextCtx, event?: MythicEvent) => string>}
 */
const FRAGMENT_TEMPLATES = [
  // Comparison of accounts
  ({ myth }, event) => {
    const creator = myth.creators[0] ?? 'the primary agent'
    const costC = myth.cost.concepts[0] ?? 'the cost'
    const altC = event ? event.action.concepts[0] : (myth.important[0] ?? myth.act.concepts[1] ?? 'a secondary role')
    const archetype = event ? event.archetype : myth.recipe
    return `Accounts differ on the role of ${altC}. Northern traditions hold that ${creator} acted alone; the ${archetype} record assigns ${altC} a shared part. Both accounts agree on ${costC}. This fragment predates the later schism, if the paper can be trusted.`
  },
  // Three contradictions
  ({ myth }, event) => {
    const flawC = myth.flaw.concepts[0] ?? 'the flaw'
    const costC = myth.cost.concepts[0] ?? 'the cost'
    const actC = myth.act.concepts[0] ?? 'the act'
    const archetype = event ? event.archetype : myth.recipe
    const interp1 = event ? event.consequence.concepts[0] : (myth.worldAfter ?? 'the result')
    const interp2 = flawC
    return `The ${archetype} account contradicts the creation record at two points: first, ${costC} is treated as instrument rather than casualty; second, ${actC} is presented as ${interp1} rather than ${interp2}. Margin note, added later: "They are both wrong about the ${flawC}."`
  },
]

/**
 * Prayer templates — short, addressed to a specific agent.
 * @type {Array<(ctx: TextCtx, agent: Agent) => string>}
 */
const PRAYER_TEMPLATES = [
  // Petition
  ({ graph }, agent) => {
    const d1 = agent.domains[0] ?? 'the unnamed'
    const d2 = agent.domains[1] ?? d1
    const sen = resolveSensory(graph, d1)
    const flawC = agent.disposition ?? 'the wound'
    return `${agent.name}, ${agent.title},\nyou who hold ${d1} and know ${d2}:\nkeep ${articleFor(flawC)} from the ${sen.texture} places.\nLet ${sen.color} be the color of your returning.`
  },
  // Gratitude offering
  ({ graph }, agent) => {
    const d1 = agent.domains[0] ?? 'the unnamed'
    const sen = resolveSensory(graph, d1)
    const flawC = agent.disposition ?? 'the wound'
    return `We give ${sen.texture} things to you, ${agent.name}.\nWe burn ${sen.color} offerings. We mark the threshold with ${soundAsRitual(sen.sound)}.\nBecause you remain. Because ${articleFor(flawC)} has not taken you yet.`
  },
  // Double-naming
  ({ graph }, agent) => {
    const d1 = agent.domains[0] ?? 'the unnamed'
    const d2 = agent.domains[1] ?? d1
    const sen = resolveSensory(graph, d1)
    const flawC = agent.disposition ?? 'the darkness'
    return `Your name in the old tongue is ${agent.name}. Your name in ours is ${agent.title}.\nWe name you ${d1}. We name you ${d2}.\nDo not let ${articleFor(flawC)} find our ${soundAsRitual(sen.sound)}.`
  },
]

/**
 * Prophecy templates — cryptic, present-tense, pulls from flaw and crisis.
 * @type {Array<(ctx: TextCtx) => string>}
 */
const PROPHECY_TEMPLATES = [
  // Imagistic signs
  ({ graph, myth, world }) => {
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const sen = resolveSensory(graph, flawC)
    const crisisC = world.present?.crisis.concepts[0] ?? flawC
    const terrain = world.geogony?.terrainTypes[0]?.name ?? 'the stone places'
    const creator = myth.creators[0] ?? 'the first'
    return `When the ${flawC} finds its ${sen.color} again,\nwhen ${crisisC} walks the ${terrain},\nwhen ${creator} speaks in ${sen.sound}:\ncount what remains. If fewer than before, do not wait.`
  },
  // Sequential already-happened
  ({ graph, rng, myth, world }) => {
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const crisisC = world.present?.crisis.concepts[0] ?? flawC
    const actC = myth.act.concepts[0] ?? 'the shaping'
    const verb = mythVerb(myth, rng)
    const sen = resolveSensory(graph, crisisC)
    return `First the ${actC} will ${verb} again.\nThen the ${flawC} will walk in ${sen.texture}.\nThen the ${crisisC} will find its voice.\nThis is not a warning. This already happened. This is happening now.`
  },
]

/**
 * Lament templates — mourning an absent god.
 * @type {Array<(ctx: TextCtx, agent: Agent) => string>}
 */
const LAMENT_TEMPLATES = [
  // Direct address
  ({ graph, myth }, agent) => {
    const d1 = agent.domains[0] ?? 'the unnamed'
    const d2 = agent.domains[1] ?? d1
    const sen = resolveSensory(graph, d1)
    const costC = myth.cost.concepts[0] ?? 'the offering'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const landmark = agent.state === 'exiled' ? 'the edge of things' : 'the old place'
    return `O ${agent.name}, you who were ${d1} and ${d2}:\nwhere is the ${sen.color} of your passing?\nWe left ${costC} at ${landmark} but you did not return.\nThe ${flawC} fills the shape where you were.`
  },
  // The world was different
  ({ graph }, agent) => {
    const d1 = agent.domains[0] ?? 'the unnamed'
    const sen = resolveSensory(graph, d1)
    const d2 = agent.domains[1] ?? d1
    return `The world was ${sen.texture} when ${agent.name} was in it.\nNow the ${sen.color} has gone out.\nWe have ${d1}. We have ${sen.sound}.\nWe do not have ${agent.name}.\nWe do not have ${d2}.`
  },
]

/**
 * Parable templates — moral story derived from event.
 * @type {Array<(ctx: TextCtx, event: MythicEvent) => string>}
 */
const PARABLE_TEMPLATES = [
  // Hubris/cautionary
  ({ graph, world }, event) => {
    const actC = event.action.concepts[0] ?? 'the act'
    const conseqC = event.consequence.concepts[0] ?? 'the consequence'
    const sen = resolveSensory(graph, conseqC)
    const region = world.regions.find(r => r.taggedBy.includes(event.index))
    const regionName = region?.name ?? 'that place'
    const legacyC = event.legacy.concepts[0] ?? actC
    return `There was once one who held ${actC} and wanted more. They reached for ${conseqC} until the ${sen.texture} broke. Now we call that place ${regionName}. When you want more than your ${legacyC} allows, remember what the ${sen.sound} said.`
  },
  // Sacrifice/duty
  ({ graph }, event) => {
    const costC = event.consequence.concepts[0] ?? 'the cost'
    const sen = resolveSensory(graph, costC)
    const actC = event.action.concepts[0] ?? 'the act'
    const legacyC = event.legacy.concepts[0] ?? costC
    return `A time came when ${costC} had to be given. The one who gave it did not hesitate. The ${actC} that followed was ${sen.color} and ${sen.texture}. Do not call it a tragedy. Call it ${legacyC}. Call it what was owed.`
  },
  // Warning from war/conflict
  ({ graph, world }, event) => {
    const situC = event.situation.concepts[0] ?? 'conflict'
    const conseqC = event.consequence.concepts[0] ?? 'the result'
    const legacyC = event.legacy.concepts[0] ?? conseqC
    const sen = resolveSensory(graph, situC)
    const region = world.regions.find(r => r.taggedBy.includes(event.index))
    const regionName = region?.name ?? 'that ground'
    return `${situC} and ${conseqC} met at ${regionName}. One carried ${sen.texture} purpose. One carried ${sen.color} ambition. What remained was ${legacyC}. This is not a parable. This is a reminder of what ${sen.sound} sounds like when it ends.`
  },
  // Fool's bargain
  ({ graph }, event) => {
    const actC = event.action.concepts[0] ?? 'the act'
    const conseqC = event.consequence.concepts[0] ?? 'the consequence'
    const legacyC = event.legacy.concepts[0] ?? actC
    const sen = resolveSensory(graph, actC)
    return `A fool once traded ${actC} for ${conseqC}, believing the ${sen.texture} would hold. It did not. The ${sen.color} faded. The ${conseqC} grew teeth. Now we call that kind of bargain ${legacyC}, and we do not make it twice.`
  },
  // Two paths
  ({ graph }, event) => {
    const situC = event.situation.concepts[0] ?? 'the crossroads'
    const actC = event.action.concepts[0] ?? 'the choice'
    const conseqC = event.consequence.concepts[0] ?? 'what followed'
    const sen = resolveSensory(graph, conseqC)
    return `Before ${situC}, there were two paths. One led through ${actC}. One led around it. The wise chose the longer road. The brave chose ${actC}. Neither arrived where they intended. Both found ${conseqC}, ${sen.texture} and ${sen.color}, waiting at the end.`
  },
]

// ── Title generators ──

/**
 * @param {string} type
 * @param {ConceptGraph} graph
 * @param {string[]} concepts
 * @param {() => number} rng
 * @param {Set<string>} usedNames
 * @param {Agent|null} [agent]
 * @param {number} [fragmentIndex]
 * @returns {string}
 */
function buildTitle(type, graph, concepts, rng, usedNames, agent, fragmentIndex) {
  const phonName = nameRegion(graph, concepts, rng, usedNames)

  switch (type) {
    case 'hymn':
      return rng() < 0.5 ? `The ${phonName} Hymn` : `Hymn of ${phonName}`
    case 'folk':
      return rng() < 0.5 ? `The Tale of ${phonName}` : `The ${phonName} Account`
    case 'heresy':
      return rng() < 0.5 ? `The ${phonName} Teaching` : `The ${phonName} Denial`
    case 'fragment':
      return `Fragment ${fragmentIndex ?? 1}: On ${phonName}`
    case 'prayer':
      return agent ? `Prayer to ${agent.name}` : `Prayer of ${phonName}`
    case 'prophecy':
      return rng() < 0.5 ? `The ${phonName} Prophecy` : `The ${phonName} Warning`
    case 'lament':
      return agent ? `Lament for ${agent.name}` : `The ${phonName} Lament`
    case 'parable':
      return rng() < 0.5 ? `The Parable of ${phonName}` : `The ${phonName} Story`
    default:
      return phonName
  }
}

// ── Builders ──

let textCounter = 0

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @returns {MythText}
 */
function buildHymn(ctx, usedNames) {
  const { graph, rng, myth, artifacts } = ctx
  const template = pick(rng, HYMN_TEMPLATES)
  const body = template(ctx)
  const concepts = [
    ...(myth.before.concepts.slice(0, 2)),
    ...(myth.act.concepts.slice(0, 2)),
    ...(myth.flaw.concepts.slice(0, 1)),
  ]
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 1)
  const title = buildTitle('hymn', graph, concepts, rng, usedNames)
  const creatorAgent = findCreatorAgent(ctx.world, graph)

  return {
    id: `text-${textCounter++}`,
    type: 'hymn',
    title,
    body: topArtifacts.length > 0
      ? body + ` The ${topArtifacts[0].name} was there at the beginning.`
      : body,
    perspective: 'devout',
    referencedAgentIds: creatorAgent ? [creatorAgent.id] : [],
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @param {MythicEvent|undefined} event
 * @param {'devout'|'fearful'} perspective
 * @returns {MythText}
 */
function buildFolk(ctx, usedNames, event, perspective) {
  const { graph, rng, myth, artifacts } = ctx
  const template = pick(rng, FOLK_TEMPLATES)
  const body = template(ctx, event)
  const concepts = [
    myth.act.concepts[0],
    myth.flaw.concepts[0],
    myth.cost.concepts[0],
  ].filter(Boolean)
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 1)
  const title = buildTitle('folk', graph, concepts, rng, usedNames)

  const creatorAgent = findCreatorAgent(ctx.world, graph)
  const agentIds = creatorAgent ? [creatorAgent.id] : []

  return {
    id: `text-${textCounter++}`,
    type: 'folk',
    title,
    body: topArtifacts.length > 0
      ? body + ` Even now, the ${topArtifacts[0].name} carries the mark of it.`
      : body,
    perspective,
    referencedAgentIds: agentIds,
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @param {MythicEvent|undefined} event
 * @returns {MythText}
 */
function buildHeresy(ctx, usedNames, event) {
  const { graph, rng, myth, artifacts } = ctx
  const template = pick(rng, HERESY_TEMPLATES)
  const body = template(ctx, event)
  const concepts = event
    ? expandConceptCluster(graph, rng, event.action.concepts[0] ?? myth.flaw.concepts[0] ?? 'void', 2, 4)
    : [myth.flaw.concepts[0], myth.bad[0]].filter(Boolean)
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 1)
  const title = buildTitle('heresy', graph, concepts, rng, usedNames)

  const agentIds = event
    ? event.agentChanges.map(c => c.agentId).filter(id => ctx.world.agents.some(a => a.id === id))
    : []

  return {
    id: `text-${textCounter++}`,
    type: 'heresy',
    title,
    body: topArtifacts.length > 0
      ? body + ` They say the ${topArtifacts[0].name} proves it.`
      : body,
    perspective: 'defiant',
    referencedAgentIds: agentIds,
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @param {MythicEvent|undefined} event
 * @param {number} fragmentIndex
 * @returns {MythText}
 */
function buildFragment(ctx, usedNames, event, fragmentIndex) {
  const { graph, rng, myth, artifacts } = ctx
  const template = pick(rng, FRAGMENT_TEMPLATES)
  const body = template(ctx, event)
  const concepts = event
    ? [event.action.concepts[0], event.consequence.concepts[0]].filter(Boolean)
    : [myth.act.concepts[0], myth.cost.concepts[0]].filter(Boolean)
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 2)
  const title = buildTitle('fragment', graph, concepts, rng, usedNames, undefined, fragmentIndex)

  const artifactMention = topArtifacts.length > 0
    ? ` The ${topArtifacts[0].name} is cited in three of the conflicting accounts.`
    : ''

  return {
    id: `text-${textCounter++}`,
    type: 'fragment',
    title,
    body: body + artifactMention,
    perspective: 'skeptical',
    referencedAgentIds: [],
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @param {Agent} agent
 * @returns {MythText}
 */
function buildPrayer(ctx, usedNames, agent) {
  const { graph, rng, artifacts } = ctx
  const template = pick(rng, PRAYER_TEMPLATES)
  const body = template(ctx, agent)
  const concepts = expandConceptCluster(graph, rng, agent.domains[0] ?? 'void', 2, 4)
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 1)
  const title = buildTitle('prayer', graph, concepts, rng, usedNames, agent)

  return {
    id: `text-${textCounter++}`,
    type: 'prayer',
    title,
    body: topArtifacts.length > 0
      ? body + `\nHear us through the ${topArtifacts[0].name}, if you still can.`
      : body,
    perspective: 'devout',
    referencedAgentIds: [agent.id],
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @returns {MythText}
 */
function buildProphecy(ctx, usedNames) {
  const { graph, rng, myth, artifacts } = ctx
  const template = pick(rng, PROPHECY_TEMPLATES)
  const body = template(ctx)
  const concepts = expandConceptCluster(graph, rng, myth.flaw.concepts[0] ?? 'void', 2, 5)
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 1)
  const title = buildTitle('prophecy', graph, concepts, rng, usedNames)

  return {
    id: `text-${textCounter++}`,
    type: 'prophecy',
    title,
    body: topArtifacts.length > 0
      ? body + `\nThe ${topArtifacts[0].name} will be the last sign.`
      : body,
    perspective: 'fearful',
    referencedAgentIds: [],
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @param {Agent} agent
 * @returns {MythText}
 */
function buildLament(ctx, usedNames, agent) {
  const { graph, rng, artifacts } = ctx
  const template = pick(rng, LAMENT_TEMPLATES)
  const body = template(ctx, agent)
  const concepts = [
    ...agent.domains.slice(0, 2),
    ctx.myth.cost.concepts[0],
    ctx.myth.flaw.concepts[0],
  ].filter(Boolean)
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 1)
  const title = buildTitle('lament', graph, concepts, rng, usedNames, agent)

  return {
    id: `text-${textCounter++}`,
    type: 'lament',
    title,
    body: topArtifacts.length > 0
      ? body + `\nOnly the ${topArtifacts[0].name} remembers.`
      : body,
    perspective: 'grieving',
    referencedAgentIds: [agent.id],
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

/**
 * @param {TextCtx} ctx
 * @param {Set<string>} usedNames
 * @param {MythicEvent} event
 * @returns {MythText}
 */
function buildParable(ctx, usedNames, event) {
  const { graph, rng, artifacts } = ctx
  const template = pick(rng, PARABLE_TEMPLATES)
  const body = template(ctx, event)
  const concepts = expandConceptCluster(graph, rng, event.legacy.concepts[0] ?? event.concepts[0] ?? 'void', 2, 4)
  const topArtifacts = findTopArtifacts(graph, concepts, artifacts, 1)
  const title = buildTitle('parable', graph, concepts, rng, usedNames)

  const agentIds = event.agentChanges.map(c => c.agentId).filter(id => ctx.world.agents.some(a => a.id === id))

  return {
    id: `text-${textCounter++}`,
    type: 'parable',
    title,
    body: topArtifacts.length > 0
      ? body + ` The ${topArtifacts[0].name} was found there afterward.`
      : body,
    perspective: 'pragmatic',
    referencedAgentIds: agentIds,
    referencedArtifactIds: topArtifacts.map(a => a.id),
    concepts,
  }
}

// ── Main entry ──

/**
 * Generate in-world texts from world data.
 * Returns MythText[]; does not mutate world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 * @returns {MythText[]}
 */
export function generateMythTexts(graph, world, rng) {
  textCounter = 0

  const myth = /** @type {CreationMyth} */ (world.myth)
  const pantheonAgents = world.agents.filter(a => a.origin === 'pantheon')
  const livingAgents = pantheonAgents.filter(a => a.alive && a.state === 'active')
  const goneAgents = pantheonAgents.filter(a => !a.alive || a.state === 'dead' || a.state === 'exiled' || a.state === 'forgotten')
  const majorEvents = world.events.filter(e => e.agentChanges.length > 0)
  const artifacts = world.artifacts ?? []

  /** @type {TextCtx} */
  const ctx = { graph, rng, myth, world, artifacts }

  /** @type {Set<string>} */
  const usedNames = new Set()
  /** @type {MythText[]} */
  const texts = []

  // ── Budget ──
  const base = 1 + pantheonAgents.length + Math.ceil(world.events.length * 0.4)
  const total = clamp(base, 10, 30)

  // ── Guarantee phase ──

  // 1. One creation hymn
  texts.push(buildHymn(ctx, usedNames))

  // 2. One prayer per living/active pantheon agent
  for (const agent of livingAgents) {
    texts.push(buildPrayer(ctx, usedNames, agent))
  }

  // 3. One lament per dead/exiled/forgotten pantheon agent
  for (const agent of goneAgents) {
    texts.push(buildLament(ctx, usedNames, agent))
  }

  // 4. Two contradictory texts per major event (folk + heresy, or parable + fragment)
  let fragmentIndex = 1
  for (const event of majorEvents) {
    if (rng() < 0.5) {
      texts.push(buildFolk(ctx, usedNames, event, 'devout'))
      texts.push(buildHeresy(ctx, usedNames, event))
    } else {
      texts.push(buildParable(ctx, usedNames, event))
      texts.push(buildFragment(ctx, usedNames, event, fragmentIndex++))
    }
  }

  // 5. One prophecy
  texts.push(buildProphecy(ctx, usedNames))

  // ── Fill phase ──
  const FILL_TYPES = ['folk', 'parable', 'folk', 'parable', 'fragment', 'heresy', 'hymn', 'prophecy', 'prayer', 'lament']
  while (texts.length < total) {
    const type = pick(rng, FILL_TYPES)
    switch (type) {
      case 'hymn':
        texts.push(buildHymn(ctx, usedNames))
        break
      case 'folk': {
        const event = majorEvents.length > 0 ? pick(rng, majorEvents) : undefined
        texts.push(buildFolk(ctx, usedNames, event, rng() < 0.6 ? 'devout' : 'fearful'))
        break
      }
      case 'heresy': {
        const event = majorEvents.length > 0 ? pick(rng, majorEvents) : undefined
        texts.push(buildHeresy(ctx, usedNames, event))
        break
      }
      case 'fragment': {
        const event = majorEvents.length > 0 ? pick(rng, majorEvents) : undefined
        texts.push(buildFragment(ctx, usedNames, event, fragmentIndex++))
        break
      }
      case 'prayer': {
        const agent = pantheonAgents.length > 0 ? pick(rng, pantheonAgents) : null
        if (agent) texts.push(buildPrayer(ctx, usedNames, agent))
        break
      }
      case 'prophecy':
        texts.push(buildProphecy(ctx, usedNames))
        break
      case 'lament': {
        const pool = goneAgents.length > 0 ? goneAgents : pantheonAgents
        if (pool.length > 0) texts.push(buildLament(ctx, usedNames, pick(rng, pool)))
        break
      }
      case 'parable': {
        const event = majorEvents.length > 0 ? pick(rng, majorEvents) : undefined
        if (event) texts.push(buildParable(ctx, usedNames, event))
        break
      }
    }
  }

  // ── Validation sweep ──

  // Every pantheon agent referenced by at least 1 text
  for (const agent of pantheonAgents) {
    const referenced = texts.some(t => t.referencedAgentIds.includes(agent.id))
    if (!referenced) {
      if (!agent.alive || agent.state !== 'active') {
        texts.push(buildLament(ctx, usedNames, agent))
      } else {
        texts.push(buildPrayer(ctx, usedNames, agent))
      }
    }
  }

  // Every major event has at least 2 texts
  for (const event of majorEvents) {
    const covering = texts.filter(t =>
      t.referencedAgentIds.some(id => event.agentChanges.some(c => c.agentId === id))
    )
    if (covering.length < 2) {
      texts.push(buildHeresy(ctx, usedNames, event))
    }
  }

  // At least 1 text references an artifact
  if (artifacts.length > 0 && texts.every(t => t.referencedArtifactIds.length === 0)) {
    texts.push(buildFragment(ctx, usedNames, undefined, fragmentIndex++))
  }

  return texts
}
