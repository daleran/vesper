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
 * @import { GlossState } from './gloss.js'
 */
import { pick, clamp, conceptOverlap } from '../utils.js'
import { nameRegion } from '../naming.js'
import { expandConceptCluster } from '../conceptResolvers.js'
import { glossConcept, createGlossState } from './gloss.js'
import { getSensoryEdges } from './sensory.js'
import { referAgent, getPronouns } from '../pronouns.js'

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
  const raw = getSensoryEdges(graph, concept)
  return {
    color: raw.color ?? 'dark',
    sound: raw.sound ?? 'silence',
    texture: raw.texture ?? 'rough',
    shape: raw.shape ?? 'formless',
  }
}

/**
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
 * @param {string} concept
 * @returns {string}
 */
function articleFor(concept) {
  return BARE_NOUNS.has(concept) ? concept : `the ${concept}`
}

/**
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

/**
 * Gloss convenience wrapper for use in templates.
 * @param {TextCtx} ctx
 * @param {string} concept
 * @returns {string}
 */
function g(ctx, concept) {
  return glossConcept(concept, ctx.graph, ctx.world, ctx.gloss)
}

/**
 * Agent reference convenience — name on first use, pronoun after.
 * @param {Agent} agent
 * @param {'subject'|'object'|'possessive'} role
 * @param {GlossState} state
 * @returns {string}
 */
function ref(agent, role, state) {
  return referAgent(agent, role, state)
}

/**
 * Capitalize the first letter of a string.
 * @param {string} s
 * @returns {string}
 */
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Body templates ──

/**
 * @typedef {{
 *   graph: ConceptGraph,
 *   rng: () => number,
 *   myth: CreationMyth,
 *   world: World,
 *   artifacts: Artifact[],
 *   gloss: GlossState,
 * }} TextCtx
 */

/**
 * Hymn templates — reverent, liturgical, 4-beat structure.
 * @type {Array<(ctx: TextCtx) => string>}
 */
const HYMN_TEMPLATES = [
  // Four-beat litany with glossed creation
  (ctx) => {
    const { graph, rng, myth, world } = ctx
    const before = myth.before.concepts[0] ?? 'the void'
    const sen = resolveSensory(graph, before)
    const costC = myth.cost.concepts[0] ?? 'what was lost'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const verb = mythVerb(myth, rng)
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the unnamed')
    const pro = creator ? getPronouns(creator) : null
    const sub = pro ? cap(pro.subject) : creatorName
    return `Before ${g(ctx, before)}, there was only ${sen.color} ${sen.sound}. ${creatorName} moved through it and did not rest until the ${verb} was done. ${sub} paid with ${g(ctx, costC)}, and the price holds still. We sing against ${g(ctx, flawC)}. We sing it back. We sing.`
  },
  // Invocation with repetition
  (ctx) => {
    const { graph, rng, myth, world } = ctx
    const creator = findCreatorAgent(world, graph)
    const name = creator ? creator.name : (myth.creators[0] ?? 'the first')
    if (creator) ctx.gloss.namedAgents.add(creator.id)
    const actC = myth.act.concepts[1] ?? myth.act.concepts[0] ?? 'the shaping'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const verb = mythVerb(myth, rng)
    const pro = creator ? getPronouns(creator) : null
    const poss = pro ? pro.possessive : 'their'
    return `${name}, ${name}, who ${verb} ${g(ctx, actC)} from ${poss} own hands: we name the world for you. We name the rivers and the stone for you. We name ${g(ctx, flawC)} for you, because it too is yours. Because you left it. Because it will not leave us.`
  },
  // Creation sequence — most narrative
  (ctx) => {
    const { graph, rng, myth, world } = ctx
    const before = myth.before.concepts[0] ?? 'the void'
    const sen = resolveSensory(graph, before)
    const substance = myth.worldAfter ?? myth.act.concepts[0] ?? 'the world'
    const costC = myth.cost.concepts[0] ?? 'what was given'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const verb = mythVerb(myth, rng)
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the first')
    const pro = creator ? getPronouns(creator) : null
    const sub = pro ? cap(pro.subject) : creatorName
    return `In the ${sen.shape} before ${sen.color}, in the ${sen.sound} before sound, there was ${creatorName}. ${sub} took ${g(ctx, before)} and from it ${verb} ${g(ctx, substance)}. ${cap(g(ctx, costC))} was the door through which the world passed. ${cap(g(ctx, flawC))} followed after. This is the oldest hymn. This is the only hymn.`
  },
]

/**
 * Folk account templates — simplified, emotional, personal.
 * @type {Array<(ctx: TextCtx, event?: MythicEvent) => string>}
 */
const FOLK_TEMPLATES = [
  // Grandmother story
  (ctx, event) => {
    const { graph, rng, myth, world } = ctx
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? myth.act.concepts[0] ?? 'the old one')
    let actC = myth.act.concepts[0] ?? 'the shaping'
    const creatorConcept = myth.creators[0] ?? myth.act.concepts[0]
    if (creatorConcept === actC) {
      actC = myth.before.concepts[0] ?? myth.cost.concepts[0] ?? 'the shaping'
    }
    const flawC = myth.flaw.concepts[0] ?? 'the thing that came after'
    let eventC = event ? (event.consequence.concepts[0] ?? actC) : actC
    if (eventC === creatorConcept || eventC === actC) {
      eventC = event ? (event.action.concepts[0] ?? myth.cost.concepts[0] ?? 'the old trouble') : (myth.cost.concepts[0] ?? 'the old trouble')
    }
    const sen = resolveSensory(graph, flawC)
    const verb = mythVerb(myth, rng)
    return `They say when the sky was new, ${creatorName} found ${g(ctx, actC)} and ${verb} it open. That is why ${g(ctx, flawC)} still comes when the ${sen.color} fades. My grandmother said to never speak of ${g(ctx, eventC)} at dusk.`
  },
  // The old ones knew
  (ctx, event) => {
    const { graph, myth, world } = ctx
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the first')
    const costC = myth.cost.concepts[0] ?? 'something irretrievable'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const sen = resolveSensory(graph, flawC)
    const result = event ? event.consequence.concepts[0] : (myth.worldAfter ?? 'the world')
    const pro = creator ? getPronouns(creator) : null
    const sub = pro ? cap(pro.subject) : creatorName
    return `The old ones knew. ${creatorName} did not mean to leave ${g(ctx, costC)} behind. But ${g(ctx, flawC)} crept in while the ${sen.texture} was still warm. ${sub} could not take it back. You can still find it in ${g(ctx, result)}, if you know where to look.`
  },
  // Child-simple
  (ctx, event) => {
    const { myth, world, graph } = ctx
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the shaper')
    const costC = myth.cost.concepts[0] ?? 'something dear'
    const marker = event ? event.legacy.concepts[0] : (myth.flaw.concepts[0] ?? 'the trouble')
    const pro = creator ? getPronouns(creator) : null
    const sub = pro ? cap(pro.subject) : creatorName
    return `First there was nothing. Then ${creatorName} made everything. But ${sub} had to give up ${g(ctx, costC)} to do it. That is why we remember ${g(ctx, marker)} — because it cost something to be here.`
  },
]

/**
 * Heresy templates — forbidden reinterpretation.
 * @type {Array<(ctx: TextCtx, event?: MythicEvent) => string>}
 */
const HERESY_TEMPLATES = [
  // The priests are wrong
  (ctx, event) => {
    const { graph, myth, world } = ctx
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the one they name')
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const sen = resolveSensory(graph, flawC)
    const altC = event ? event.action.concepts[0] : (myth.important[0] ?? myth.act.concepts[1] ?? 'the other thing')
    return `The priests say ${creatorName} made the world from ${sen.texture}. This is not what ${g(ctx, flawC)} teaches. It was there first. It is older. What they call creation was only ${g(ctx, altC)}. Do not bow to the maker. ${cap(g(ctx, flawC))} remembers the truth.`
  },
  // What the makers kept
  (ctx, event) => {
    const { graph, myth, world } = ctx
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the shaper')
    const costC = myth.cost.concepts[0] ?? 'the price'
    const actC = myth.act.concepts[0] ?? 'the making'
    const sen = resolveSensory(graph, actC)
    const altC = event ? event.action.concepts[0] : (myth.bad[0] ?? sen.shape)
    return `We are taught the cost was ${g(ctx, costC)}. We are not taught what ${creatorName} kept. Ask what remains in the ${sen.color} places. Ask why ${g(ctx, altC)} and the maker share the same ${sen.texture}. The makers always keep the best parts.`
  },
  // The overflow reinterpretation
  (ctx, event) => {
    const { graph, rng, myth, world } = ctx
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the first')
    const actC = myth.act.concepts[0] ?? 'the shaping'
    const costC = myth.cost.concepts[0] ?? 'the sacrifice'
    const sen = resolveSensory(graph, costC)
    const verb = mythVerbBase(myth, rng)
    const altC = event ? event.situation.concepts[0] : (myth.worldBefore ?? actC)
    return `${creatorName} did not ${verb} from love. ${cap(g(ctx, actC))} was ${sen.texture} desperation. ${cap(g(ctx, altC))} was all that remained after ${g(ctx, costC)} was consumed. We are not the gift. We are what spilled.`
  },
]

/**
 * Scholarly fragment templates — analytical, notes contradictions.
 * @type {Array<(ctx: TextCtx, event?: MythicEvent) => string>}
 */
const FRAGMENT_TEMPLATES = [
  // Comparison of accounts
  (ctx, event) => {
    const { myth, world, graph } = ctx
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the primary agent')
    const costC = myth.cost.concepts[0] ?? 'the cost'
    const altC = event ? event.action.concepts[0] : (myth.important[0] ?? myth.act.concepts[1] ?? 'a secondary role')
    const archetype = event ? event.archetype : myth.recipe
    return `Accounts differ on the role of ${g(ctx, altC)}. Northern traditions hold that ${creatorName} acted alone; the ${archetype} record assigns ${g(ctx, altC)} a shared part. Both accounts agree on ${g(ctx, costC)}. This fragment predates the later schism, if the paper can be trusted.`
  },
  // Three contradictions
  (ctx, event) => {
    const { myth } = ctx
    const flawC = myth.flaw.concepts[0] ?? 'the flaw'
    const costC = myth.cost.concepts[0] ?? 'the cost'
    const actC = myth.act.concepts[0] ?? 'the act'
    const archetype = event ? event.archetype : myth.recipe
    const interp1 = event ? event.consequence.concepts[0] : (myth.worldAfter ?? 'the result')
    const interp2 = flawC
    return `The ${archetype} account contradicts the creation record at two points: first, ${g(ctx, costC)} is treated as instrument rather than casualty; second, ${g(ctx, actC)} is presented as ${g(ctx, interp1)} rather than ${interp2}. Margin note, added later: "They are both wrong about ${g(ctx, flawC)}."`
  },
]

/**
 * Prayer templates — short, addressed to a specific agent.
 * @type {Array<(ctx: TextCtx, agent: Agent) => string>}
 */
const PRAYER_TEMPLATES = [
  // Petition
  (ctx, agent) => {
    const { graph } = ctx
    const d1 = agent.domains[0] ?? 'the unnamed'
    const d2 = agent.domains[1] ?? d1
    const sen = resolveSensory(graph, d1)
    const flawC = agent.disposition ?? 'the wound'
    ctx.gloss.namedAgents.add(agent.id)
    return `${agent.name}, ${agent.title},\nyou who hold ${g(ctx, d1)} and know ${g(ctx, d2)}:\nkeep ${articleFor(flawC)} from the ${sen.texture} places.\nLet ${sen.color} be the color of your returning.`
  },
  // Gratitude offering
  (ctx, agent) => {
    const { graph } = ctx
    const d1 = agent.domains[0] ?? 'the unnamed'
    const sen = resolveSensory(graph, d1)
    const flawC = agent.disposition ?? 'the wound'
    ctx.gloss.namedAgents.add(agent.id)
    return `We give ${sen.texture} things to you, ${agent.name}, ${agent.title} — you who are ${g(ctx, d1)}.\nWe burn ${sen.color} offerings. We mark the threshold in ${soundAsRitual(sen.sound)}.\nBecause you remain. Because ${articleFor(flawC)} has not taken you yet.`
  },
  // Double-naming
  (ctx, agent) => {
    const { graph } = ctx
    const d1 = agent.domains[0] ?? 'the unnamed'
    const d2 = agent.domains[1] ?? d1
    const sen = resolveSensory(graph, d1)
    const flawC = agent.disposition ?? 'the darkness'
    ctx.gloss.namedAgents.add(agent.id)
    return `Your name in the old tongue is ${agent.name}. Your name in ours is ${agent.title}.\nWe name you ${g(ctx, d1)}. We name you ${g(ctx, d2)}.\nDo not let ${articleFor(flawC)} find our ${soundAsRitual(sen.sound)}.`
  },
]

/**
 * Prophecy templates — cryptic, present-tense, pulls from flaw and crisis.
 * @type {Array<(ctx: TextCtx) => string>}
 */
const PROPHECY_TEMPLATES = [
  // Imagistic signs with physical grounding
  (ctx) => {
    const { graph, myth, world } = ctx
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const sen = resolveSensory(graph, flawC)
    const crisisC = world.present?.crisis.concepts[0] ?? flawC
    const terrain = world.geogony?.terrainTypes[0]?.name ?? 'the stone places'
    const landmark = world.geogony?.landmarks[0]?.name ?? 'the old place'
    const creator = findCreatorAgent(world, graph)
    const creatorName = creator ? ref(creator, 'subject', ctx.gloss) : (myth.creators[0] ?? 'the first')
    return `When ${g(ctx, flawC)} finds its ${sen.color} again,\nwhen ${g(ctx, crisisC)} walks the ${terrain} near ${landmark},\nwhen ${creatorName} speaks in ${sen.sound}:\ncount what remains. If fewer than before, do not wait.`
  },
  // Sequential already-happened
  (ctx) => {
    const { graph, rng, myth, world } = ctx
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const crisisC = world.present?.crisis.concepts[0] ?? flawC
    const actC = myth.act.concepts[0] ?? 'the shaping'
    const verb = mythVerb(myth, rng)
    const sen = resolveSensory(graph, crisisC)
    const terrain = world.geogony?.terrainTypes[1]?.name ?? world.geogony?.terrainTypes[0]?.name ?? 'the deep places'
    return `First ${g(ctx, actC)} will ${verb} again.\nThen ${g(ctx, flawC)} will walk in ${sen.texture} across the ${terrain}.\nThen ${g(ctx, crisisC)} will find its voice.\nThis is not a warning. This already happened. This is happening now.`
  },
]

/**
 * Lament templates — mourning an absent god.
 * @type {Array<(ctx: TextCtx, agent: Agent) => string>}
 */
const LAMENT_TEMPLATES = [
  // Direct address
  (ctx, agent) => {
    const { graph, myth } = ctx
    const d1 = agent.domains[0] ?? 'the unnamed'
    const d2 = agent.domains[1] ?? d1
    const sen = resolveSensory(graph, d1)
    const costC = myth.cost.concepts[0] ?? 'the offering'
    const flawC = myth.flaw.concepts[0] ?? 'the wound'
    const pro = getPronouns(agent)
    const landmark = agent.state === 'exiled' ? 'the edge of things' : 'the old place'
    ctx.gloss.namedAgents.add(agent.id)
    return `O ${agent.name}, ${agent.title}, you who were ${g(ctx, d1)} and ${g(ctx, d2)}:\nwhere is the ${sen.color} of ${pro.possessive} passing?\nWe left ${g(ctx, costC)} at ${landmark} but ${pro.subject} did not return.\n${cap(g(ctx, flawC))} fills the shape where ${pro.subject} ${pro.subject === 'they' ? 'were' : 'was'}.`
  },
  // The world was different
  (ctx, agent) => {
    const { graph } = ctx
    const d1 = agent.domains[0] ?? 'the unnamed'
    const sen = resolveSensory(graph, d1)
    const d2 = agent.domains[1] ?? d1
    const pro = getPronouns(agent)
    ctx.gloss.namedAgents.add(agent.id)
    return `The world was ${sen.texture} when ${agent.name} was in it.\nNow the ${sen.color} has gone out.\nWe have ${g(ctx, d1)}. We have ${sen.sound}.\nWe do not have ${agent.name}.\nWe do not have ${g(ctx, d2)}.\n${cap(pro.subject)} left, and ${pro.possessive} absence is a ${sen.shape} we cannot fill.`
  },
]

/**
 * Parable templates — moral stories derived from events.
 * Four distinct scaffolds, each producing a different narrative voice.
 * @type {Array<(ctx: TextCtx, event: MythicEvent) => string>}
 */
const PARABLE_TEMPLATES = [
  // Travelers scaffold — two people, physical objects, physical consequence
  (ctx, event) => {
    const { graph, world } = ctx
    const actC = event.action.concepts[0] ?? 'the act'
    const conseqC = event.consequence.concepts[0] ?? 'the consequence'
    const legacyC = event.legacy.concepts[0] ?? actC
    const region = world.regions.find(r => r.taggedBy.includes(event.index))
    const regionName = region?.name ?? 'that place'
    const senAct = resolveSensory(graph, actC)
    const senConseq = resolveSensory(graph, conseqC)
    const people = world.anthropogony?.peoples[0]?.name ?? 'travelers'
    return `Two ${people} came to ${g(ctx, regionName)}. One carried a ${senAct.texture} bundle. The other carried a ${senConseq.color} stone. They argued through the night. By morning, only ${g(ctx, legacyC)} remained, and the ground itself was changed — ${senConseq.texture} where it had been ${senAct.texture}. This is why ${regionName} is the way it is.`
  },
  // Bargain scaffold — exchange, unexpected consequence, origin story
  (ctx, event) => {
    const { graph, world } = ctx
    const actC = event.action.concepts[0] ?? 'the act'
    const conseqC = event.consequence.concepts[0] ?? 'the consequence'
    const legacyC = event.legacy.concepts[0] ?? actC
    const senAct = resolveSensory(graph, actC)
    const agent = world.agents.find(a => event.agentChanges.some(c => c.agentId === a.id))
    const agentName = agent ? ref(agent, 'subject', ctx.gloss) : 'a figure from the old days'
    const pro = agent ? getPronouns(agent) : { subject: 'they', possessive: 'their' }
    return `${cap(agentName)} offered ${g(ctx, actC)} in exchange for ${g(ctx, conseqC)}. The bargain was struck. A season later, ${pro.subject} returned to find the ${senAct.texture} had turned ${senAct.color} and would not change back. Now we call that kind of bargain ${g(ctx, legacyC)}, and we do not make it twice.`
  },
  // Witness scaffold — old person recounts, cryptic quote, physical evidence
  (ctx, event) => {
    const { graph, world } = ctx
    const actC = event.action.concepts[0] ?? 'the act'
    const conseqC = event.consequence.concepts[0] ?? 'the consequence'
    const senConseq = resolveSensory(graph, conseqC)
    const agent = world.agents.find(a => event.agentChanges.some(c => c.agentId === a.id))
    const agentName = agent ? ref(agent, 'subject', ctx.gloss) : 'a stranger'
    const landmark = world.geogony?.landmarks.find(l => l.regionId && world.regions.some(r => r.id === l.regionId && r.taggedBy.includes(event.index)))
    const landmarkName = landmark?.name ?? 'the crossroads'
    const people = world.anthropogony?.peoples[0]?.name ?? 'the old people'
    return `An old one of ${people} tells of seeing ${agentName} at ${landmarkName}. ${cap(agentName)} was gathering ${g(ctx, actC)} in ${senConseq.texture} handfuls. When asked what for, the answer was: "${cap(g(ctx, conseqC))} must be fed, or it feeds on us." The old one does not speak of it now, but the ${senConseq.color} stain at ${landmarkName} has not faded.`
  },
  // Forbidden act scaffold — taboo, mythic origin, physical consequence
  (ctx, event) => {
    const { graph, world } = ctx
    const actC = event.action.concepts[0] ?? 'the act'
    const conseqC = event.consequence.concepts[0] ?? 'the consequence'
    const legacyC = event.legacy.concepts[0] ?? conseqC
    const senAct = resolveSensory(graph, actC)
    const region = world.regions.find(r => r.taggedBy.includes(event.index))
    const regionName = region?.name ?? 'that region'
    const agent = world.agents.find(a => event.agentChanges.some(c => c.agentId === a.id))
    const agentName = agent ? ref(agent, 'subject', ctx.gloss) : 'a being from the first days'
    return `It is forbidden to speak of ${g(ctx, actC)} in ${regionName}. The people say it is because ${agentName} once ${event.archetype === 'war' ? 'fought' : 'acted'} there, and ${g(ctx, conseqC)} has not left the ${senAct.texture} ground since. Those who break the rule find ${g(ctx, legacyC)} waiting for them in the ${senAct.color} hours before dawn.`
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
  const phonName = nameRegion(graph, concepts, rng, { usedNames, entityType: 'text' })

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

// ── Artifact scoring ──

/**
 * Find the top N artifacts by concept overlap with a concept list.
 * @param {ConceptGraph} graph
 * @param {string[]} concepts
 * @param {Artifact[]} artifacts
 * @param {number} n
 * @returns {Artifact[]}
 */
function findTopArtifacts(graph, concepts, artifacts, n) {
  if (artifacts.length === 0) return []
  return artifacts
    .map(a => ({ artifact: a, score: conceptOverlap(graph, concepts, a.concepts) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.artifact)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, HYMN_TEMPLATES)
  const body = template(localCtx)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, FOLK_TEMPLATES)
  const body = template(localCtx, event)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, HERESY_TEMPLATES)
  const body = template(localCtx, event)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, FRAGMENT_TEMPLATES)
  const body = template(localCtx, event)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, PRAYER_TEMPLATES)
  const body = template(localCtx, agent)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, PROPHECY_TEMPLATES)
  const body = template(localCtx)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, LAMENT_TEMPLATES)
  const body = template(localCtx, agent)
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
  const gloss = createGlossState()
  const localCtx = /** @type {TextCtx} */ ({ ...ctx, gloss })
  const template = pick(rng, PARABLE_TEMPLATES)
  const body = template(localCtx, event)
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
  const ctx = { graph, rng, myth, world, artifacts, gloss: createGlossState() }

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
