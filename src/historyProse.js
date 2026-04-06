/**
 * Prose renderer for mythic history events.
 * Mirrors the pattern of prose.js: template pools + sensory maps + elaborators.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { MythicEvent } from './history.js'
 */
import { pick } from './utils.js'

// ── Sensory helpers (duplicated from prose.js to keep modules independent) ──

/**
 * @typedef {{ color?: string, sound?: string, texture?: string, shape?: string, evokes?: string }} Sensory
 * @typedef {Record<string, Sensory>} SensoryMap
 */

/**
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @returns {Sensory}
 */
function getSensory(graph, concept) {
  const edges = graph.get(concept) ?? []
  /** @type {Sensory} */
  const s = {}
  for (const e of edges) {
    if (e.direction !== 'fwd') continue
    if (e.relation === 'color' && !s.color) s.color = e.concept
    else if (e.relation === 'sound' && !s.sound) s.sound = e.concept
    else if (e.relation === 'texture' && !s.texture) s.texture = e.concept
    else if (e.relation === 'shape' && !s.shape) s.shape = e.concept
    else if (e.relation === 'evokes' && !s.evokes) s.evokes = e.concept
  }
  return s
}

/**
 * @param {ConceptGraph} graph
 * @param {Record<string, string>} roles
 * @returns {SensoryMap}
 */
function buildSensoryMap(graph, roles) {
  /** @type {SensoryMap} */
  const map = {}
  for (const concept of Object.values(roles)) {
    if (concept && !map[concept]) map[concept] = getSensory(graph, concept)
  }
  return map
}

/**
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @param {string} relation
 * @returns {string[]}
 */
function getEdgesOf(graph, concept, relation) {
  return (graph.get(concept) ?? [])
    .filter(e => e.direction === 'fwd' && e.relation === relation)
    .map(e => e.concept)
}

/**
 * Walk 1-2 hops from a concept following specific relation types.
 * @param {ConceptGraph} graph
 * @param {string} start
 * @param {string[]} relations
 * @param {number} [maxHops=2]
 * @returns {string[]}
 */
function gatherNeighbors(graph, start, relations, maxHops = 2) {
  const relSet = new Set(relations)
  const found = /** @type {string[]} */ ([])
  const visited = new Set([start])
  let frontier = [start]

  for (let hop = 0; hop < maxHops; hop++) {
    const next = /** @type {string[]} */ ([])
    for (const concept of frontier) {
      const edges = graph.get(concept) ?? []
      const matches = edges.filter(e => relSet.has(e.relation) && !visited.has(e.concept))
      for (const e of matches) {
        visited.add(e.concept)
        found.push(e.concept)
        next.push(e.concept)
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return found
}

// ── Sensory description helpers ──

/**
 * @param {string} concept
 * @param {SensoryMap} s
 * @returns {string}
 */
function desc(concept, s) {
  const sen = s[concept]
  if (!sen) return concept
  if (sen.texture) return `the ${sen.texture} ${concept}`
  if (sen.color) return `the ${sen.color} ${concept}`
  return concept
}

// ── Elaborators ──

/**
 * @typedef {(concept: string, graph: ConceptGraph, rng: () => number) => string|null} Elaborator
 */

/** @type {Elaborator[]} */
const SITUATION_ELABORATORS = [
  (concept, graph) => {
    const evoked = getEdgesOf(graph, concept, 'evokes')
    if (evoked.length === 0) return null
    return `The ${concept} bred ${evoked[0]}, and that ${evoked[0]} could not be contained.`
  },
  (concept, graph) => {
    const s = getSensory(graph, concept)
    if (s.sound) return `One could hear the ${s.sound} of ${concept} growing louder with each passing age.`
    if (s.color) return `The ${s.color} of ${concept} stained everything it touched.`
    return null
  },
]

/** @type {Elaborator[]} */
const ACTION_ELABORATORS = [
  (concept, graph) => {
    const produced = getEdgesOf(graph, concept, 'produces')
    if (produced.length === 0) return null
    return `From the act came ${produced[0]}, unbidden and impossible to undo.`
  },
  (concept, graph) => {
    const s = getSensory(graph, concept)
    if (s.sound && s.color) return `It was ${s.color} and it sounded like ${s.sound}.`
    if (s.texture) return `Those who touched it said it was ${s.texture}, and they did not touch it again.`
    return null
  },
  (concept, graph) => {
    const transforms = getEdgesOf(graph, concept, 'transforms')
    if (transforms.length === 0) return null
    return `Where ${concept} had been, now there was only ${transforms[0]}.`
  },
]

/** @type {Elaborator[]} */
const CONSEQUENCE_ELABORATORS = [
  (concept, graph) => {
    const evoked = getEdgesOf(graph, concept, 'evokes')
    if (evoked.length === 0) return null
    return `The land remembered it as ${evoked[0]}.`
  },
  (concept, graph) => {
    const s = getSensory(graph, concept)
    if (s.color && s.texture) return `The ground there is still ${s.color} and ${s.texture} to this day.`
    if (s.sound) return `Even now, the ${s.sound} of ${concept} can be heard when the wind is right.`
    return null
  },
]

/** @type {Elaborator[]} */
const LEGACY_ELABORATORS = [
  (concept, graph) => {
    const rhymes = getEdgesOf(graph, concept, 'rhymes')
    if (rhymes.length === 0) return null
    return `Some say it was not ${concept} at all but ${rhymes[0]} — the stories disagree.`
  },
  (concept, graph) => {
    const evoked = getEdgesOf(graph, concept, 'evokes')
    if (evoked.length < 2) return null
    return `In one telling it brought ${evoked[0]}. In another, ${evoked[1]}.`
  },
]

/**
 * Run elaborators and collect 1-2 sentences.
 * @param {Elaborator[]} pool
 * @param {string} concept
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} discovered
 * @returns {string}
 */
function elaborate(pool, concept, graph, rng, discovered) {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const sentences = /** @type {string[]} */ ([])
  for (const elab of shuffled) {
    if (sentences.length >= 1) break
    const result = elab(concept, graph, rng)
    if (result) {
      sentences.push(result)
      if (!discovered.includes(concept)) discovered.push(concept)
      const nearby = gatherNeighbors(graph, concept, ['evokes', 'rhymes'], 1)
      for (const n of nearby) {
        if (!discovered.includes(n)) discovered.push(n)
      }
    }
  }
  return sentences.join(' ')
}

// ── Situation templates ──

/** @type {((r: Record<string,string>, s: SensoryMap) => string)[]} */
const SITUATION_TEMPLATES = [
  (r) => `In time, the tension between ${r.tension ?? 'old wounds'} and ${r.rival ?? r.where ?? 'the world'} grew beyond bearing.`,
  (r) => `${r.who ?? r.actor ?? 'Something'} had watched ${r.tension ?? 'the wound'} fester, and could endure no more.`,
  (r, s) => `The age of ${desc(r.tension ?? r.domain ?? 'ruin', s)} was ending. Everyone felt it.`,
  (r) => `Where ${r.where ?? r.origin ?? 'the old lands'} had once been quiet, ${r.tension ?? r.threat ?? 'unrest'} now stirred.`,
  (r) => `It began, as these things do, with ${r.tension ?? r.hidden ?? r.source ?? 'what could not be ignored'}.`,
  (r, s) => `The memory of ${desc(r.flaw ?? r.tension ?? 'what came before', s)} had grown teeth.`,
  (r) => `There was a crack in the world where ${r.tension ?? r.unity ?? 'certainty'} had been, and through it came ${r.threat ?? r.ambition ?? 'change'}.`,
  (r) => `Long after the first age, ${r.who ?? r.seeker ?? r.actor ?? 'the restless ones'} turned their eyes to ${r.where ?? r.hidden ?? 'what was forbidden'}.`,
]

// ── Action template pools, keyed by archetype ──

/** @type {Record<string, ((r: Record<string,string>, s: SensoryMap) => string)[]>} */
const ACTION_POOLS = {
  war: [
    (r) => `${r.attacker ?? 'The aggressor'} struck at ${r.defender ?? 'the other'}, and the ground of ${r.arena ?? 'the battlefield'} drank deep.`,
    (r, s) => `They clashed at ${desc(r.arena ?? 'the contested ground', s)}, and neither would yield until ${r.weapon ?? 'ruin'} decided it.`,
    (r) => `The war between ${r.attacker ?? 'the rival powers'} and ${r.defender ?? 'their enemies'} scarred ${r.arena ?? 'the land'} beyond recognition.`,
    (r) => `${r.defender ?? 'The defeated'} fell where ${r.arena ?? 'the earth'} split, and ${r.attacker ?? 'the victor'} stood alone.`,
    (r, s) => `It was not a battle but an ending. ${desc(r.weapon ?? 'The weapon', s)} sang once, and the world was different.`,
    (r) => `${r.attacker ?? 'One'} brought ${r.weapon ?? 'fury'} to ${r.arena ?? 'the field'}, and ${r.defender ?? 'the other'} brought everything else, and it was not enough.`,
  ],
  hubris: [
    (r) => `${r.actor ?? 'The ambitious one'} reached for ${r.target ?? 'what was not theirs'}, believing the cost would fall on someone else.`,
    (r, s) => `When ${r.actor ?? 'they'} seized ${desc(r.target ?? 'the forbidden thing', s)}, the world flinched.`,
    (r) => `${r.actor ?? 'The overreacher'} consumed ${r.target ?? 'more than any being should'}, and for a moment held the shape of something greater.`,
    (r) => `${r.actor ?? 'The fool'} climbed to ${r.where ?? 'the highest place'} and demanded ${r.target ?? 'what the world would not give'}.`,
    (r) => `None could say why ${r.actor ?? 'they'} needed ${r.target ?? 'it'} so badly. But need it they did, and take it they did.`,
    (r) => `${r.actor ?? 'They'} tore ${r.target ?? 'it'} from where it grew, and the roots went deeper than anyone knew.`,
  ],
  exodus: [
    (r) => `${r.migrant ?? 'The exiles'} left ${r.from ?? 'the dying land'} with nothing but ${r.to ?? 'a direction'} and the memory of what was lost.`,
    (r, s) => `The journey from ${desc(r.from ?? 'the ruined place', s)} was long, and ${r.migrant ?? 'those who walked it'} were changed by it.`,
    (r) => `They fled ${r.from ?? 'what was uninhabitable'} and found ${r.to ?? 'something barely livable'}. But it was theirs.`,
    (r) => `${r.migrant ?? 'The wanderers'} carried ${r.from ?? 'the old world'} in their songs and planted ${r.to ?? 'the new one'} with their hands.`,
    (r) => `No one agreed on why they left ${r.from ?? 'their home'}. Everyone agreed they could not go back.`,
    (r, s) => `When ${r.migrant ?? 'the displaced'} reached ${desc(r.to ?? 'the far shore', s)}, they wept — not from joy, but from the certainty that ${r.from ?? 'what they left'} was truly gone.`,
  ],
  discovery: [
    (r) => `${r.finder ?? 'The seeker'} found ${r.discovery ?? 'it'} buried beneath ${r.where ?? 'the forgotten place'}, and nothing was the same after.`,
    (r, s) => `It had been hidden since the beginning — ${desc(r.discovery ?? 'the secret', s)}, waiting for ${r.finder ?? 'someone foolish enough'} to unearth it.`,
    (r) => `When ${r.finder ?? 'the one who searched'} uncovered ${r.discovery ?? 'what lay beneath'}, the balance of the world shifted like water finding a new level.`,
    (r) => `${r.discovery ?? 'The found thing'} was not a gift. It was a debt the world had forgotten it owed.`,
    (r) => `${r.finder ?? 'They'} dug at ${r.where ?? 'the old ground'} and pulled free ${r.discovery ?? 'something that should have stayed buried'}.`,
    (r, s) => `Beneath ${desc(r.where ?? 'the surface', s)}, ${r.finder ?? 'the searcher'} found ${r.discovery ?? 'a truth'} that rewrote every story told since the beginning.`,
  ],
  sacrifice: [
    (r) => `${r.martyr ?? 'The willing one'} gave up ${r.sacrificed ?? 'everything'} so that ${r.threat ?? 'the unraveling'} would stop.`,
    (r, s) => `There was no other way. ${r.martyr ?? 'They'} walked into ${desc(r.threat ?? 'the wound', s)} and did not walk out.`,
    (r) => `${r.martyr ?? 'The sacrificed'} burned away ${r.sacrificed ?? 'their own nature'} to seal what ${r.threat ?? 'the danger'} had opened.`,
    (r) => `What ${r.martyr ?? 'the lost one'} gave cannot be named, only felt — in the ${r.remnant ?? 'silence'} where their voice once was.`,
    (r) => `They chose it. That is what the faithful say. ${r.martyr ?? 'The martyr'} chose ${r.threat ?? 'the wound'} over the world's end.`,
    (r, s) => `${r.martyr ?? 'The one who gave'} poured ${desc(r.sacrificed ?? 'their essence', s)} into the breach, and it held.`,
  ],
  corruption: [
    (r) => `${r.corruption ?? 'The taint'} found ${r.victim ?? 'its host'} slowly, the way ${r.taint ?? 'rot'} finds the heartwood.`,
    (r, s) => `What was once ${desc(r.purity ?? 'pure', s)} became ${r.taint ?? 'something else entirely'}, and ${r.victim ?? 'the changed one'} did not notice until it was too late.`,
    (r) => `${r.victim ?? 'They'} did not fall. They were rewritten, word by word, by ${r.corruption ?? 'what crept in'}.`,
    (r) => `The ${r.purity ?? 'old nature'} of ${r.victim ?? 'the corrupted'} is still there, buried beneath ${r.taint ?? 'what it became'}. Some say it screams.`,
    (r) => `${r.corruption ?? 'The blight'} spoke in the voice of ${r.victim ?? 'the one it consumed'}, and everyone believed it.`,
    (r, s) => `By the time they noticed ${desc(r.taint ?? 'the change', s)}, ${r.victim ?? 'the lost one'} was already someone else.`,
  ],
  sundering: [
    (r) => `${r.broken ?? 'What was whole'} split, and neither half could remember being part of the other.`,
    (r) => `The sundering of ${r.unity ?? r.broken ?? 'the united'} was not violent. It was quiet — the way a river divides around a stone.`,
    (r, s) => `One became two, and the two looked at each other across ${desc(r.scar ?? 'the divide', s)} and did not recognize what they saw.`,
    (r) => `${r.broken ?? 'They'} could not hold together. The ${r.fragment ?? 'piece'} that broke away took half the memory with it.`,
    (r) => `After the split, ${r.broken ?? 'one side'} told a story of loss and ${r.fragment ?? 'the other'} told a story of freedom. Both were true.`,
    (r, s) => `The divide between ${r.broken ?? 'the halves'} was not a wall but a forgetting — ${desc(r.scar ?? 'a gap', s)} where understanding once was.`,
  ],
  return: [
    (r) => `${r.returned ?? 'The old wound'} came back, as the wise always said it would, wearing the face of ${r.manifestation ?? 'something new'}.`,
    (r, s) => `From beneath ${desc(r.where ?? 'the scarred ground', s)}, ${r.returned ?? 'the buried thing'} stirred and rose.`,
    (r) => `What the creation myth promised — that ${r.flaw ?? 'the flaw'} would echo — came true at ${r.where ?? 'the worst possible place'}.`,
    (r) => `${r.manifestation ?? 'The sign'} appeared first. Then the ${r.returned ?? 'old thing'} itself, unchanged and hungry.`,
    (r) => `The prophecy was not a warning. It was a schedule. ${r.returned ?? 'The inevitable'} arrived on time.`,
    (r, s) => `They called it ${desc(r.manifestation ?? 'the omen', s)}, but it was not new. It was the oldest thing in the world, finally awake.`,
  ],
}

// ── Consequence templates ──

/** @type {((r: Record<string,string>, s: SensoryMap) => string)[]} */
const CONSEQUENCE_TEMPLATES = [
  (r, s) => `Where it happened, the land became ${desc(r.scar ?? r.taint ?? 'scarred', s)}. Nothing grows the same way there.`,
  (r) => `${r.victor ?? r.corrupted ?? r.holder ?? 'The survivor'} inherited a world that was ${r.scar ?? r.taint ?? 'broken'} in a new way.`,
  (r) => `${r.fallen ?? r.loss ?? r.desolation ?? 'What was lost'} left a shape in the world — a hollow where it had been.`,
  (r, s) => `The ${desc(r.scar ?? r.settlement ?? r.remains ?? 'aftermath', s)} marked a border between what came before and what came after.`,
  (r) => `Afterward, the world had ${r.scar ?? r.taint ?? r.settlement ?? 'a new scar'} and one fewer certainty.`,
  (r) => `They say you can still find ${r.remains ?? r.relic ?? r.scar ?? 'traces'} if you know where to look. Most people do not want to look.`,
  (r) => `The ${r.fallen ?? r.loss ?? r.corrupted ?? 'defeated'} did not vanish entirely. Something of them soaked into the earth.`,
  (r, s) => `It left a mark on ${desc(r.scar ?? r.settlement ?? 'the land', s)} that no season could wash away.`,
]

// ── Legacy templates ──

/** @type {((r: Record<string,string>, s: SensoryMap) => string)[]} */
const LEGACY_TEMPLATES = [
  (r) => `Those who survived tell it differently. The ${r.remembered ?? r.venerated ?? r.guardian ?? 'victors'} say one thing. The ${r.mourned ?? r.memory ?? r.other ?? 'others'} say another.`,
  (r) => `Some call it justice. Some call it catastrophe. The ${r.remembered ?? r.guardian ?? r.venerated ?? 'inheritors'} do not call it anything — they simply live with it.`,
  (r) => `The story of ${r.mourned ?? r.relic ?? r.memory ?? r.treasure ?? 'what happened'} is still told, though each generation changes it a little more.`,
  (r) => `In time, ${r.remembered ?? r.venerated ?? r.prophecy ?? 'the event'} became less a memory and more a warning.`,
  (r) => `Children are still named after ${r.venerated ?? r.guardian ?? r.remembered ?? 'the heroes of that age'}. Or warned against becoming them. Depending on who is telling it.`,
  (r) => `The ${r.mourned ?? r.loss ?? r.distrust ?? 'wound'} never fully healed. It became part of the way things are.`,
  (r) => `What ${r.treasure ?? r.relic ?? r.sign ?? r.prophecy ?? 'was found'} changed the world less than the arguments about what it meant.`,
  (r) => `Even now, the name of ${r.mourned ?? r.venerated ?? r.remembered ?? 'the lost'} is spoken differently depending on which side of the ${r.schism ?? r.scar ?? 'divide'} you stand.`,
]

// ── Main render function ──

/**
 * Render prose for a single mythic event.
 * @param {MythicEvent} event
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @returns {{ prose: string, concepts: string[] }}
 */
export function renderEventProse(event, graph, rng) {
  const sitSensory = buildSensoryMap(graph, event.situation.roles)
  const actSensory = buildSensoryMap(graph, event.action.roles)
  const conSensory = buildSensoryMap(graph, event.consequence.roles)
  const legSensory = buildSensoryMap(graph, event.legacy.roles)

  const actionPool = ACTION_POOLS[event.archetype] ?? ACTION_POOLS['war']

  const discovered = /** @type {string[]} */ ([])

  // Primary concepts for elaboration
  const sitConcept = event.situation.roles.tension ?? event.situation.concepts[0] ?? ''
  const actConcept = event.action.roles.weapon ?? event.action.roles.target ?? event.action.concepts[0] ?? ''
  const conConcept = event.consequence.roles.scar ?? event.consequence.roles.taint ?? event.consequence.concepts[0] ?? ''
  const legConcept = event.legacy.roles.mourned ?? event.legacy.roles.memory ?? event.legacy.concepts[0] ?? ''

  const parts = [
    pick(rng, SITUATION_TEMPLATES)(event.situation.roles, sitSensory)
      + ' ' + elaborate(SITUATION_ELABORATORS, sitConcept, graph, rng, discovered),
    pick(rng, actionPool)(event.action.roles, actSensory)
      + ' ' + elaborate(ACTION_ELABORATORS, actConcept, graph, rng, discovered),
    pick(rng, CONSEQUENCE_TEMPLATES)(event.consequence.roles, conSensory)
      + ' ' + elaborate(CONSEQUENCE_ELABORATORS, conConcept, graph, rng, discovered),
    pick(rng, LEGACY_TEMPLATES)(event.legacy.roles, legSensory)
      + ' ' + elaborate(LEGACY_ELABORATORS, legConcept, graph, rng, discovered),
  ]

  const prose = parts.map(p => p.trim()).filter(p => p.length > 0).join(' ')

  const allConcepts = new Set([
    ...event.concepts,
    ...discovered,
  ])

  return { prose, concepts: [...allConcepts] }
}
