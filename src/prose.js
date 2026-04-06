/**
 * @import { CreationMyth, BeatRoles } from './recipes/index.js'
 * @import { ConceptGraph, Edge } from './concepts.js'
 */
import { mulberry32, hashSeed, pick } from './utils.js'

// ── Sensory helpers ─────────────────────────────────────────────────────────

/**
 * @typedef {{ color?: string, sound?: string, texture?: string, shape?: string, evokes?: string }} Sensory
 * @typedef {Record<string, Sensory>} SensoryMap
 */

/**
 * Gather sensory edges for a concept from the graph.
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
 * Build a sensory map for all concepts mentioned in a beat's roles.
 * @param {ConceptGraph} graph
 * @param {BeatRoles} roles
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

// ── Graph walking for elaboration ───────────────────────────────────────────

/**
 * Walk 1-2 hops from a concept following specific relation types.
 * Returns unique neighbor concepts (not the start).
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string} start
 * @param {string[]} relations — relation types to follow
 * @param {number} [maxHops=2]
 * @returns {string[]}
 */
function gatherNeighbors(graph, rng, start, relations, maxHops = 2) {
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

/**
 * Get all forward edges of a specific relation for a concept.
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

// ── Elaboration pools ──────────────────────────────────────────────────────
// Each elaborator takes a primary concept, graph, rng, and returns a sentence
// or null if no useful associations found. Every sentence must reference a
// specific graph concept — no generic filler.

/**
 * @typedef {(concept: string, graph: ConceptGraph, rng: () => number) => string|null} Elaborator
 */

/** @type {Elaborator[]} */
const VOID_ELABORATORS = [
  // Evokes chain: "within X there was Y, and within that, Z"
  (concept, graph) => {
    const chain = gatherNeighbors(graph, () => 0, concept, ['evokes'], 2)
    if (chain.length < 2) return null
    return `Within ${concept} there was ${chain[0]}, and within that, ${chain[1]}.`
  },
  // Rhymes: "not unlike X — the same weight, the same silence"
  (concept, graph, rng) => {
    const rhymes = getEdgesOf(graph, concept, 'rhymes')
    if (rhymes.length === 0) return null
    const r = pick(rng, rhymes)
    const s = getSensory(graph, r)
    return s.texture
      ? `It was not unlike ${r} — the same ${s.texture} stillness, the same waiting.`
      : `It was not unlike ${r} — the same weight, the same waiting.`
  },
  // Sensory: describe the void's color/texture/sound
  (concept, graph) => {
    const s = getSensory(graph, concept)
    if (s.color && s.texture) return `It was ${s.color} and ${s.texture}, and it went on forever.`
    if (s.sound) return `There was no silence — only the ${s.sound} of ${concept}, constant and unbroken.`
    return null
  },
]

/** @type {Record<string, string>} */
const SPILL_BY_TEXTURE = {
  rough: 'erupted', smooth: 'flowed', wet: 'poured', soft: 'seeped',
  sharp: 'fractured outward', cold: 'crept forth', crumbling: 'crumbled free',
  glossy: 'slid forth',
}
/** @type {Record<string, string>} */
const SPILL_BY_SHAPE = {
  hollow: 'echoed outward', spiral: 'unwound', shard: 'shattered forth',
  pillar: 'rose', coil: 'uncoiled', circle: 'rippled outward',
  point: 'pierced through', slab: 'spread', web: 'threaded outward',
}

/** @type {Elaborator[]} */
const ACT_ELABORATORS = [
  // Sound of the act
  (concept, graph) => {
    const sounds = getEdgesOf(graph, concept, 'sound')
    if (sounds.length === 0) return null
    return `The sound was ${sounds[0]} — the first sound anything had ever made.`
  },
  // What was produced — verb shaped by sensory properties
  (concept, graph, rng) => {
    const produced = getEdgesOf(graph, concept, 'produces')
    if (produced.length === 0) return null
    const p = pick(rng, produced)
    const s = getSensory(graph, p)
    const verb = (s.texture && SPILL_BY_TEXTURE[s.texture])
      || (s.shape && SPILL_BY_SHAPE[s.shape])
      || pick(rng, ['spilled outward', 'poured forth', 'emerged', 'came into being'])
    if (s.evokes) return `And from the act, ${p} ${verb}, carrying ${s.evokes} with it.`
    return `And from the act, ${p} ${verb}.`
  },
  // Color/texture of the moment
  (concept, graph) => {
    const s = getSensory(graph, concept)
    if (s.color && s.texture) return `Everything was ${s.color} and ${s.texture} in that moment.`
    if (s.color) return `The light was ${s.color} when it happened.`
    return null
  },
]

/** @type {Elaborator[]} */
const COST_ELABORATORS = [
  // What the sacrificed thing evokes
  (concept, graph) => {
    const chain = gatherNeighbors(graph, () => 0, concept, ['evokes'], 2)
    if (chain.length === 0) return null
    return `All its ${chain[0]} went with it.`
  },
  // What the sacrifice transforms into
  (concept, graph, rng) => {
    const transforms = getEdgesOf(graph, concept, 'transforms')
    if (transforms.length === 0) return null
    const t = pick(rng, transforms)
    return `What remained of ${concept} became ${t} — unrecognizable, repurposed.`
  },
  // Sensory detail of loss
  (concept, graph) => {
    const s = getSensory(graph, concept)
    if (s.color) return `The last of its ${s.color} faded, and the world dimmed by that much.`
    if (s.sound) return `The ${s.sound} of ${concept} faded. That silence has never been filled.`
    return null
  },
]

/** @type {Elaborator[]} */
const FLAW_ELABORATORS = [
  // What the wound evokes
  (concept, graph) => {
    const chain = gatherNeighbors(graph, () => 0, concept, ['evokes'], 2)
    if (chain.length === 0) return null
    return `It carries ${chain[0]} with it wherever it goes.`
  },
  // What rhymes with the wound — what it echoes in
  (concept, graph, rng) => {
    const rhymes = getEdgesOf(graph, concept, 'rhymes')
    if (rhymes.length === 0) return null
    const r = pick(rng, rhymes)
    return pick(rng, [
      `You can see it in ${r} — the same mark, the same ache.`,
      `It echoes in ${r}, unmistakable, unrepairable.`,
      `Look at ${r} long enough and you will recognize ${concept} hiding inside it.`,
      `${r} carries the shape of ${concept} — not by accident, but by inheritance.`,
      `They say ${r} rhymes with ${concept}. That is not poetry. That is diagnosis.`,
      `Even ${r} is touched by it — the same wound, worn differently.`,
    ])
  },
  // Sensory persistence
  (concept, graph) => {
    const s = getSensory(graph, concept)
    if (s.texture) return `It is ${s.texture} to the touch, even now.`
    if (s.sound) return `Listen carefully and you will hear it — the ${s.sound} of ${concept}, threaded through everything.`
    return null
  },
]

/**
 * Run elaborators on a concept and return 1-3 additional sentences.
 * Shuffles the pool so different elaborators fire for different seeds.
 * @param {Elaborator[]} pool
 * @param {string} concept
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} discovered — mutated: concepts found during elaboration are pushed here
 * @returns {string}
 */
function elaborate(pool, concept, graph, rng, discovered) {
  // Shuffle pool using rng for determinism
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const sentences = /** @type {string[]} */ ([])
  for (const elab of shuffled) {
    if (sentences.length >= 2) break
    const result = elab(concept, graph, rng)
    if (result) {
      sentences.push(result)
      // Track the primary concept + its immediate evokes/rhymes neighbors
      if (!discovered.includes(concept)) discovered.push(concept)
      const nearby = gatherNeighbors(graph, rng, concept, ['evokes', 'rhymes'], 1)
      for (const n of nearby) {
        if (!discovered.includes(n)) discovered.push(n)
      }
    }
  }
  return sentences.join(' ')
}

// ── Descriptive helpers ─────────────────────────────────────────────────────

/**
 * Describe a concept with an optional sensory modifier.
 * @param {string} concept
 * @param {Sensory} s
 * @returns {string}
 */
function desc(concept, s) {
  if (s.texture) return `${s.texture} ${concept}`
  if (s.color) return `${s.color} ${concept}`
  return concept
}

/**
 * Describe a tool with its shape if available.
 * @param {string} concept
 * @param {Sensory} s
 * @returns {string}
 */
function toolDesc(concept, s) {
  if (s.shape) return `the ${s.shape} ${concept}`
  return `the ${concept}`
}

// ── Template pools ──────────────────────────────────────────────────────────
// Each pool is an array of (roles, sensoryMap) => string functions.

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const VOID_TEMPLATES = [
  (r, s) => `Before the world had a name, there was only ${desc(r.void, s[r.void] ?? {})}.`,
  (r, s) => {
    const v = s[r.void] ?? {}
    return v.evokes
      ? `In the beginning: ${r.void}, heavy with ${v.evokes}. Nothing else had yet been permitted.`
      : `In the beginning: ${r.void}. Nothing else had yet been permitted.`
  },
  (r, s) => {
    const v = s[r.void] ?? {}
    return v.sound
      ? `The world was ${r.void} — nothing but ${v.sound} and the weight of what had not yet begun.`
      : `The world was ${r.void} — nothing more, nothing less, nothing else.`
  },
  (r) => `Once, before consequence, there was ${r.void} and the silence around it.`,
  (r, s) => {
    const v = s[r.void] ?? {}
    return v.texture
      ? `At the origin there was ${r.void}, ${v.texture} and unwitnessed, stretching in every direction.`
      : `At the origin there was ${r.void}, vast and unwitnessed.`
  },
  (r) => `Before anything was made or named, there was ${r.void}.`,
  (r, s) => {
    const v = s[r.void] ?? {}
    return v.color
      ? `There was a time before time — only ${r.void}, ${v.color} and absolute, filling the space where the world would be.`
      : `There was a time before time — only ${r.void}, filling the space where the world would be.`
  },
  (r) => `${r.void} was all there was. Not empty — full, but full of nothing that had learned to be something yet.`,
  (r, s) => {
    const v = s[r.void] ?? {}
    const q = r.quality ?? v.evokes
    return q
      ? `Before the first breath, there was ${r.void} — and within it, ${q}, waiting.`
      : `Before the first breath, there was ${r.void}, and nothing waited.`
  },
  (r) => `The oldest stories begin here: ${r.void}, alone, before the wound that made everything else.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_STRUCK = [
  (r, s) => `Then ${r.actor} took up ${toolDesc(r.tool, s[r.tool] ?? {})} and struck ${r.target}, and from that strike came ${r.product}.`,
  (r, s) => {
    const ts = s[r.tool] ?? {}
    return ts.sound
      ? `${r.actor} raised ${toolDesc(r.tool, ts)} — it rang like ${ts.sound} — and drove it into ${r.target}. What poured out was ${r.product}.`
      : `${r.actor} raised ${toolDesc(r.tool, ts)} and drove it into ${r.target}. What poured out was ${r.product}.`
  },
  (r) => `Something moved in the stillness. ${r.actor} found ${r.tool} and broke ${r.target} open, and the break became ${r.product}.`,
  (r) => `At some point — no one can say when — ${r.actor} struck ${r.target} with ${r.tool}. ${r.product} spilled out like a wound that would not close.`,
  (r, s) => {
    const ps = s[r.product] ?? {}
    return ps.color
      ? `${r.actor} brought ${r.tool} down upon ${r.target}, and ${r.product} bloomed from the wound, ${ps.color} and new.`
      : `${r.actor} brought ${r.tool} down upon ${r.target}, and ${r.product} bloomed from the wound.`
  },
  (r) => `It happened like this: ${r.actor}, ${r.tool}, ${r.target}. After the blow, there was ${r.product}. After that, there was no going back.`,
  (r) => `The moment came without warning. ${r.actor} split ${r.target} with ${r.tool}, and from the crack ${r.product} crawled into being.`,
  (r) => `What changed everything: ${r.actor} used ${r.tool} to open ${r.target}. And ${r.product} came through.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_SLEW = [
  (r) => `${r.actor} raised ${r.weapon} against ${r.slain} at ${r.place}, and ${r.slain} fell.`,
  (r, s) => {
    const ws = s[r.weapon] ?? {}
    return ws.sound
      ? `At ${r.place}, ${r.actor} turned on ${r.slain}. The ${r.weapon} sang — a ${ws.sound} — and when it finished, ${r.slain} was gone.`
      : `At ${r.place}, ${r.actor} turned on ${r.slain}. When ${r.weapon} finished its work, ${r.slain} was gone.`
  },
  (r) => `They gathered at ${r.place}, and ${r.actor} killed ${r.slain} with ${r.weapon}. It was the first murder, and it made everything else possible.`,
  (r) => `At some point — no one can say when — ${r.actor} struck ${r.slain} down with ${r.weapon}. It happened at ${r.place}. There were no witnesses but the world.`,
  (r) => `${r.slain} did not see it coming. ${r.actor} brought ${r.weapon} to ${r.place} and ended what ${r.slain} was. The world began in that silence.`,
  (r, s) => {
    const ss = s[r.slain] ?? {}
    return ss.color
      ? `${r.actor} destroyed ${r.slain} at ${r.place} — the last of its ${ss.color} light bled into the ground where ${r.weapon} struck.`
      : `${r.actor} destroyed ${r.slain} at ${r.place}. What was left after ${r.weapon} struck became the floor of the world.`
  },
  (r) => `What changed everything: ${r.actor} and ${r.weapon} at ${r.place}. ${r.slain} fell. The world grew from what was left.`,
  (r) => `${r.actor} wielded ${r.weapon} and ended ${r.slain} at ${r.place}. No one asked whether it was just. It was the beginning.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_BIRTH = [
  (r) => `${r.parent} gave birth, and the child was ${r.child} itself — the whole world poured out as a living thing.`,
  (r, s) => {
    const cs = s[r.child] ?? {}
    return cs.texture
      ? `From the body of ${r.parent} came ${r.child}, ${cs.texture} and alive. The world was born the way all things are born — in pain and wonder.`
      : `From the body of ${r.parent} came ${r.child}. The world was born the way all things are born — in pain and wonder.`
  },
  (r) => `Something stirred inside ${r.parent}, and when it emerged, it was ${r.child}. Not a piece of the world — the world entire.`,
  (r, s) => {
    const cs = s[r.child] ?? {}
    return cs.evokes
      ? `${r.parent} brought ${r.child} into being — all ${cs.evokes} and need, a newborn world already restless.`
      : `${r.parent} brought ${r.child} into being — fragile, restless, already pulling away.`
  },
  (r) => `At some point — no one can say when — ${r.parent} opened and the world fell out. It was ${r.child}, and it was alive.`,
  (r) => `The world did not begin with an act of will. ${r.parent} could not hold ${r.child} any longer. So the world began.`,
  (r, s) => {
    const cs = s[r.child] ?? {}
    return cs.sound
      ? `${r.parent} cried out, and ${r.child} answered — the first ${cs.sound} the world had ever heard.`
      : `${r.parent} cried out, and ${r.child} answered. It was the first sound.`
  },
  (r) => `What changed everything: ${r.parent}, heavy with the world, finally let go. ${r.child} spilled into being, and nothing could take it back.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_SACRIFICE = [
  (r) => `${r.actor} tore itself apart. Its body became ${r.product}, and there was no one left to see what it had made.`,
  (r, s) => {
    const as = s[r.actor] ?? {}
    return as.color
      ? `${r.actor} unmade itself — ${as.color} light pouring out, becoming ${r.product} as it faded.`
      : `${r.actor} unmade itself — pouring out, becoming ${r.product} as it faded.`
  },
  (r) => `There was no tool, no weapon. ${r.actor} simply gave everything it was, and what remained was ${r.product}.`,
  (r) => `Something moved in the stillness. ${r.actor} reached into its own center and pulled the world out. What emerged was ${r.product}. What was left of the maker was nothing.`,
  (r, s) => {
    const ps = s[r.product] ?? {}
    return ps.texture
      ? `${r.actor} broke itself open. ${r.product} grew from the wound — ${ps.texture}, alive, made of what the maker used to be.`
      : `${r.actor} broke itself open. ${r.product} grew from the wound, alive, made of what the maker used to be.`
  },
  (r) => `It happened like this: ${r.actor} decided the world was worth more than itself. So it became ${r.product}. The choice was the last thing it ever did.`,
  (r) => `No one asked ${r.actor} to die. It chose to become ${r.product}, and the world began as a kind of grief.`,
  (r, s) => {
    const as = s[r.actor] ?? {}
    return as.evokes
      ? `${r.actor} dissolved — all its ${as.evokes} unraveling into ${r.product}. The world was made of what the maker felt.`
      : `${r.actor} dissolved into ${r.product}. The world was made of what the maker was.`
  },
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_SPLIT = [
  (r) => `${r.unity} broke. ${r.fragment1} and ${r.fragment2} fell apart, and neither could remember being whole.`,
  (r, s) => {
    const us = s[r.unity] ?? {}
    return us.sound
      ? `${r.unity} split with a sound like ${us.sound}. Where there had been one, now there was ${r.fragment1} and ${r.fragment2}, each incomplete.`
      : `${r.unity} split without warning. Where there had been one, now there was ${r.fragment1} and ${r.fragment2}, each incomplete.`
  },
  (r) => `Something drove ${r.unity} apart — ${r.splitter}, maybe, or something older. ${r.fragment1} went one way. ${r.fragment2} went another. The world filled the gap between them.`,
  (r) => `At some point — no one can say when — ${r.unity} could not hold itself together. ${r.fragment1} and ${r.fragment2} were born in the breaking, and neither was whole.`,
  (r, s) => {
    const f1s = s[r.fragment1] ?? {}
    const f2s = s[r.fragment2] ?? {}
    const d1 = f1s.color ? `${f1s.color}` : 'bright'
    const d2 = f2s.color ? `${f2s.color}` : 'dark'
    return `${r.unity} shattered into halves — ${r.fragment1}, ${d1} and yearning, and ${r.fragment2}, ${d2} and still. The world was the space between.`
  },
  (r) => `It happened like this: ${r.unity}, whole and perfect, broke. ${r.fragment1}. ${r.fragment2}. Two where there had been one. The world grew in the wound.`,
  (r) => `${r.splitter} found the seam in ${r.unity} and pulled. ${r.fragment1} and ${r.fragment2} tumbled apart, and neither could close the gap.`,
  (r) => `What changed everything: ${r.unity} divided. Not cleanly — ${r.fragment1} carries pieces of ${r.fragment2}, and both remember what wholeness felt like.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_COLLISION = [
  (r) => `${r.agent1} and ${r.agent2} collided. Neither meant to — but when they touched, ${r.product} fell out of the impact.`,
  (r, s) => {
    const ps = s[r.product] ?? {}
    return ps.color
      ? `${r.agent1} drifted into ${r.agent2}, and where they met, ${r.product} flared — ${ps.color}, unexpected, alive.`
      : `${r.agent1} drifted into ${r.agent2}, and where they met, ${r.product} flared into being — unexpected, alive.`
  },
  (r) => `No one chose this. ${r.agent1} and ${r.agent2} existed separately until they didn't. The collision produced ${r.product}, and that was the world.`,
  (r) => `It was an accident. ${r.agent1} met ${r.agent2}, and the meeting produced ${r.product}. There was no plan. There is still no plan.`,
  (r) => `Something moved in the stillness. ${r.agent1} brushed against ${r.agent2}, and ${r.product} spilled from the contact like an afterthought.`,
  (r, s) => {
    const ps = s[r.product] ?? {}
    return ps.sound
      ? `${r.agent1} and ${r.agent2} touched — and the ${ps.sound} of it became ${r.product}. The world began as noise.`
      : `${r.agent1} and ${r.agent2} touched, and ${r.product} was the residue. The world began as an accident.`
  },
  (r) => `At some point — no one can say when — ${r.agent1} and ${r.agent2} met. ${r.product} erupted from between them. Neither claimed responsibility.`,
  (r) => `What changed everything: ${r.agent1} and ${r.agent2}, not meaning to, made ${r.product}. The world is what happens when things collide without purpose.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_STOLE = [
  (r) => `${r.actor} crept into the place where ${r.owner} kept ${r.treasure}, and took it. The world began with a theft.`,
  (r, s) => {
    const ts = s[r.treasure] ?? {}
    return ts.color
      ? `${r.actor} stole ${r.treasure} from ${r.owner} — ${ts.color} and radiant, it burned in the thief's hands. But ${r.actor} did not let go.`
      : `${r.actor} stole ${r.treasure} from ${r.owner}. It burned in the thief's hands, but ${r.actor} did not let go.`
  },
  (r) => `While ${r.owner} slept, ${r.actor} reached in and pulled ${r.treasure} free. The world was made from something that was never given.`,
  (r) => `It happened like this: ${r.actor} wanted ${r.treasure}, and ${r.owner} would not share. So ${r.actor} took it. The world began as a crime.`,
  (r, s) => {
    const ts = s[r.treasure] ?? {}
    return ts.evokes
      ? `${r.actor} stole ${r.treasure} — all its ${ts.evokes} — from the grip of ${r.owner}. Where the theft occurred, the world grew like a bruise.`
      : `${r.actor} stole ${r.treasure} from the grip of ${r.owner}. Where the theft occurred, the world grew like a bruise.`
  },
  (r) => `No one gave ${r.actor} permission. ${r.treasure} was taken from ${r.owner} in the dark, and the world is built on that taking.`,
  (r) => `${r.actor} found where ${r.owner} hid ${r.treasure} and pried it loose. The empty space left behind is the shape of the world.`,
  (r) => `What changed everything: ${r.actor}, quick and quiet, carrying ${r.treasure} away from ${r.owner}. The world is stolen goods.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_DREAMED = [
  (r) => `${r.actor} slept, and in its sleep it dreamed ${r.product}. The world is what the dreamer saw behind closed eyes.`,
  (r, s) => {
    const ps = s[r.product] ?? {}
    return ps.color
      ? `${r.actor} dreamed, and ${r.product} flickered into being — ${ps.color}, half-formed, trembling like a thing seen through water.`
      : `${r.actor} dreamed, and ${r.product} flickered into being — half-formed, trembling like a thing seen through water.`
  },
  (r) => `No one chose to create the world. ${r.actor} simply fell asleep, and ${r.product} poured out of the dream like breath.`,
  (r) => `It happened like this: ${r.actor} closed its eyes, and behind them, ${r.product} assembled itself. The world is a hallucination that has not yet ended.`,
  (r, s) => {
    const ps = s[r.product] ?? {}
    return ps.evokes
      ? `${r.actor} dreamed of ${r.product} — all ${ps.evokes} and longing — and the dream did not stay inside the dreamer.`
      : `${r.actor} dreamed of ${r.product}, and the dream did not stay inside the dreamer.`
  },
  (r) => `The world is ${r.actor}'s dream. Not a vision, not a plan — a dream: irrational, vivid, uncontrolled. ${r.product} is what it looked like.`,
  (r) => `Something stirred in the deepest sleep of ${r.actor}. ${r.product} appeared — not made, not born, but imagined into being.`,
  (r) => `${r.actor} slept. And in that sleep, ${r.product} grew the way dreams do — without permission, without shape, until suddenly it had both.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_CORRUPTED = [
  (r) => `${r.actor} reached into ${r.target} and ruined it. What had been perfect became ${r.product} — changed, diminished, irreversible.`,
  (r, s) => {
    const ts = s[r.target] ?? {}
    return ts.color
      ? `${r.target} was ${ts.color} and whole. Then ${r.actor} touched it, and the color curdled. What remained was ${r.product}.`
      : `${r.target} was whole. Then ${r.actor} touched it, and something curdled. What remained was ${r.product}.`
  },
  (r) => `It was not sudden. ${r.actor} crept into ${r.target} slowly, and by the time anyone noticed, ${r.target} had become ${r.product}. The damage was already done.`,
  (r) => `${r.actor} found the flaw in ${r.target} and widened it. The perfection split, and ${r.product} grew in the crack.`,
  (r, s) => {
    const as = s[r.actor] ?? {}
    return as.evokes
      ? `${r.actor} — all ${as.evokes} — pressed itself into ${r.target}. The world is what happens when something beautiful is stained beyond repair: ${r.product}.`
      : `${r.actor} pressed itself into ${r.target}. The world is what happens when something beautiful is stained: ${r.product}.`
  },
  (r) => `No one remembers the moment ${r.target} began to fail. Only that ${r.actor} was there, and afterward, there was only ${r.product}.`,
  (r) => `${r.target} did not break — it rotted. ${r.actor} was the rot. And ${r.product} is what rot leaves behind.`,
  (r) => `What changed everything: ${r.actor}, patient and quiet, turning ${r.target} into ${r.product}. The world is damaged goods.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_MERGED = [
  (r) => `${r.actor} and ${r.partner} reached for each other and could not let go. Where they joined, ${r.product} grew — the world as marriage, the world as knot.`,
  (r, s) => {
    const ps = s[r.product] ?? {}
    return ps.texture
      ? `${r.actor} and ${r.partner} fused into one — ${r.product}, ${ps.texture} and inseparable. Neither could tell where one ended and the other began.`
      : `${r.actor} and ${r.partner} fused into one — ${r.product}. Neither could tell where one ended and the other began.`
  },
  (r) => `It was not a collision. ${r.actor} and ${r.partner} chose each other, and ${r.product} was what they became together. The world is both at once.`,
  (r) => `${r.actor} wrapped itself around ${r.partner}, or ${r.partner} around ${r.actor} — no one can say which came first. ${r.product} was the result.`,
  (r, s) => {
    const as = s[r.actor] ?? {}
    return as.evokes
      ? `${r.actor}, carrying ${as.evokes}, merged with ${r.partner}. The world — ${r.product} — was born from the tension of two things trying to be one.`
      : `${r.actor} merged with ${r.partner}. The world — ${r.product} — was born from the tension of two things trying to be one.`
  },
  (r) => `Two became one. ${r.actor} and ${r.partner} dissolved into ${r.product}, and the world is the place where they still argue about who they used to be.`,
  (r) => `Something in ${r.actor} recognized something in ${r.partner}. They merged, and ${r.product} was the scar of their joining — permanent, alive, unresolved.`,
  (r) => `What changed everything: ${r.actor} and ${r.partner}, becoming ${r.product}. The world is a fusion that cannot be undone.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const ACT_OVERTHREW = [
  (r) => `${r.actor} — made by ${r.slain}, ruled by ${r.slain} — rose up at ${r.place} and tore ${r.slain} from the throne of the world.`,
  (r, s) => {
    const ws = s[r.weapon] ?? {}
    return ws.sound
      ? `At ${r.place}, ${r.actor} turned ${r.weapon} — the sound was ${ws.sound} — against the one who made it. ${r.slain} fell, not to an enemy, but to its own creation.`
      : `At ${r.place}, ${r.actor} turned ${r.weapon} against the one who made it. ${r.slain} fell, not to an enemy, but to its own creation.`
  },
  (r) => `${r.slain} had built everything, including ${r.actor}. That was the mistake. ${r.actor} used ${r.weapon} at ${r.place}, and the maker was unmade by what it made.`,
  (r) => `The world changed when ${r.actor} refused to obey. At ${r.place}, with ${r.weapon}, the created overthrew the creator. ${r.slain} did not fall in battle — ${r.slain} fell from relevance.`,
  (r, s) => {
    const ss = s[r.slain] ?? {}
    return ss.color
      ? `${r.slain}'s ${ss.color} authority shattered at ${r.place}. ${r.actor} stood over the ruins, holding ${r.weapon}, and the world belonged to the children now.`
      : `${r.slain}'s authority shattered at ${r.place}. ${r.actor} stood over the ruins, holding ${r.weapon}, and the world belonged to the children now.`
  },
  (r) => `It was not murder — it was emancipation. ${r.actor} broke ${r.slain}'s hold at ${r.place}, and the world was orphaned, and the orphan world was free.`,
  (r) => `No one expected ${r.actor} to rise. But at ${r.place}, with ${r.weapon}, ${r.actor} overthrew ${r.slain}. The first act of the new world was disobedience.`,
  (r) => `${r.slain} had ruled since before memory. ${r.actor} remembered, and did not forgive. At ${r.place}, the created destroyed the creator, and the world is what grew from the wreckage.`,
]

/** @type {Record<string, Array<(r: BeatRoles, s: SensoryMap) => string>>} */
const ACT_POOLS = {
  struck: ACT_STRUCK,
  slew: ACT_SLEW,
  gave_birth: ACT_BIRTH,
  sacrificed: ACT_SACRIFICE,
  split: ACT_SPLIT,
  collided: ACT_COLLISION,
  stole: ACT_STOLE,
  dreamed: ACT_DREAMED,
  corrupted: ACT_CORRUPTED,
  merged: ACT_MERGED,
  overthrew: ACT_OVERTHREW,
}

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const COST_TEMPLATES = [
  (r) => `But ${r.sacrificed} was consumed in the making. Creation is never free.`,
  (r) => `The price was this: ${r.sacrificed}, spent entirely. It could not have been otherwise.`,
  (r, s) => {
    const ss = s[r.sacrificed] ?? {}
    return ss.evokes
      ? `And for this, ${r.sacrificed} was lost — all its ${ss.evokes} burned away so the world could hold its shape.`
      : `And for this, ${r.sacrificed} was lost. The world was bought with that.`
  },
  (r) => `Nothing is made from nothing. ${r.sacrificed} was the price, and it was paid in full.`,
  (r) => `${r.sacrificed} was the cost. Gone now — not destroyed, but spent, poured into the foundation of everything.`,
  (r, s) => {
    const ss = s[r.sacrificed] ?? {}
    return ss.color
      ? `The last trace of ${r.sacrificed} was a fading ${ss.color} light. Then that was gone too. That was the price.`
      : `The last trace of ${r.sacrificed} faded. Then that was gone too. That was the price.`
  },
  (r) => `What was given up: ${r.sacrificed}. Not willingly. Not unwillingly. It was simply what creation demanded.`,
  (r) => `${r.sacrificed} did not survive the making. The world remembers it only as an absence, a hollow where something used to be.`,
  (r) => `The cost was ${r.sacrificed} — unmade so that everything else could exist. Some say it was worth it. Some say nothing is.`,
  (r) => `And ${r.sacrificed} was the fuel. Burned through, used up, traded for a world that doesn't remember the transaction.`,
]

/** @type {Array<(r: BeatRoles, s: SensoryMap) => string>} */
const FLAW_TEMPLATES = [
  (r) => `And so ${r.wound} persists. This is why things are the way they are.`,
  (r, s) => {
    const ws = s[r.wound] ?? {}
    return ws.evokes
      ? `${r.wound} remains — it carries ${ws.evokes} with it, and the world carries that mark still.`
      : `${r.wound} remains. The world carries that mark still.`
  },
  (r) => `What lingers: ${r.wound}. Not as damage, but as nature. The world was born with it.`,
  (r) => `Ever since, ${r.wound} has threaded through everything. Those who look closely can see it in all things.`,
  (r, s) => {
    const ws = s[r.wound] ?? {}
    return ws.texture
      ? `The wound that will not close: ${r.wound}, ${ws.texture} and permanent.`
      : `The wound that will not close: ${r.wound}.`
  },
  (r) => `${r.wound} was never driven out. It was there from the beginning — not an intruder, but a twin.`,
  (r) => `Some say ${r.wound} is a punishment. Others say it was always part of the design. Either way, it remains.`,
  (r, s) => {
    const ws = s[r.wound] ?? {}
    return ws.sound
      ? `If you are quiet enough, you can hear ${r.wound} — a faint ${ws.sound} beneath everything, the world's oldest scar.`
      : `If you are quiet enough, you can feel ${r.wound} beneath everything, the world's oldest scar.`
  },
  (r) => `The flaw is ${r.wound}. It cannot be removed because the world is built around it. Pull it out, and everything collapses.`,
  (r) => `And ${r.wound} crept in through the crack creation left. It has never been driven out. Perhaps it never will be.`,
]

// ── Prose rendering ──────────────────────────────────────────────────────────

/**
 * Render a creation myth as a single narrative prose paragraph.
 * Deterministic: same seed always produces the same text.
 *
 * @param {CreationMyth} myth
 * @param {ConceptGraph} graph
 * @returns {{ prose: string, concepts: string[] }}
 */
export function renderProse(myth, graph) {
  const rng = mulberry32(hashSeed(myth.seed))

  const beforeSensory = buildSensoryMap(graph, myth.before.roles)
  const actSensory = buildSensoryMap(graph, myth.act.roles)
  const costSensory = buildSensoryMap(graph, myth.cost.roles)
  const flawSensory = buildSensoryMap(graph, myth.flaw.roles)

  const verb = myth.act.roles.verb ?? 'struck'
  const actPool = ACT_POOLS[verb] ?? ACT_STRUCK

  // Collect concepts discovered during elaboration
  const discovered = /** @type {string[]} */ ([])

  // Primary concept for each beat (used for elaboration)
  const voidConcept = myth.before.roles.void ?? myth.before.concepts[0] ?? ''
  const actConcept = myth.act.roles.product ?? myth.act.roles.actor ?? myth.act.concepts[0] ?? ''
  const costConcept = myth.cost.roles.sacrificed ?? myth.cost.concepts[0] ?? ''
  const flawConcept = myth.flaw.roles.wound ?? myth.flaw.concepts[0] ?? ''

  const parts = [
    pick(rng, VOID_TEMPLATES)(myth.before.roles, beforeSensory)
      + ' ' + elaborate(VOID_ELABORATORS, voidConcept, graph, rng, discovered),
    pick(rng, actPool)(myth.act.roles, actSensory)
      + ' ' + elaborate(ACT_ELABORATORS, actConcept, graph, rng, discovered),
    pick(rng, COST_TEMPLATES)(myth.cost.roles, costSensory)
      + ' ' + elaborate(COST_ELABORATORS, costConcept, graph, rng, discovered),
    pick(rng, FLAW_TEMPLATES)(myth.flaw.roles, flawSensory)
      + ' ' + elaborate(FLAW_ELABORATORS, flawConcept, graph, rng, discovered),
  ]

  // Clean up: trim each part and remove double spaces
  const prose = parts.map(p => p.trim()).filter(p => p.length > 0).join(' ')

  // Merge all concepts: from myth beats + discovered during elaboration
  const allConcepts = new Set([
    ...myth.before.concepts,
    ...myth.act.concepts,
    ...myth.cost.concepts,
    ...myth.flaw.concepts,
    ...discovered,
  ])

  return { prose, concepts: [...allConcepts] }
}
