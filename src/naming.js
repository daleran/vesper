/**
 * Phoneme-driven naming system.
 *
 * Concepts map to sound qualities via the graph's `sound` edges.
 * Sound qualities map to phoneme palettes (onset, vowel, coda arrays).
 * Agent domains blend palettes; the myth's concept signature provides
 * a world-level baseline so all names in a world share a language feel.
 *
 * Morpheme tables add world-consistent affixes (prefixes/suffixes) per
 * entity type, evoking a constructed language without a full conlang.
 *
 * @typedef {import('./concepts.js').ConceptGraph} ConceptGraph
 * @typedef {import('./pantheon.js').Agent} Agent
 * @typedef {import('./recipes/index.js').CreationMyth} CreationMyth
 */

/**
 * @typedef {{
 *   worldSignature: { palettes: string[], weights: number[] },
 *   place:    { suffix: string },
 *   terrain:  Record<string, string>,
 *   people:   { suffix: string },
 *   polity:   { prefix: string },
 *   sacred:   { prefix: string },
 *   artifact: { suffix: string },
 * }} MorphemeTable
 */

/**
 * Entity types that receive morphological markers.
 * @typedef {'place'|'terrain'|'people'|'polity'|'sacred'|'artifact'|'creature'|'event'|'text'} EntityType
 */

import { pick, weightedPick } from './utils.js'
import { TUNING } from './tuning.js'

// ── Phoneme palettes keyed by sound-edge targets ──

/**
 * @typedef {{ onsets: string[], vowels: string[], codas: string[] }} Palette
 */

/** @type {Record<string, Palette>} */
const PALETTES = {
  roar: {
    onsets: ['k', 'g', 'kr', 'dr', 'tr', 'gr', 'br'],
    vowels: ['a', 'ah', 'u', 'o', 'ar'],
    codas:  ['k', 'th', 'rk', 'r', 'g', ''],
  },
  whisper: {
    onsets: ['l', 'sh', 's', 'y', 'n', 'sl'],
    vowels: ['ee', 'ay', 'i', 'eh', 'ei'],
    codas:  ['n', 'l', 'sh', 's', ''],
  },
  crack: {
    onsets: ['k', 't', 'sk', 'p', 'st', 'kr'],
    vowels: ['a', 'eh', 'i', 'e'],
    codas:  ['k', 't', 'p', 'r', ''],
  },
  ring: {
    onsets: ['r', 'l', 'v', 'z', 'ri', 'li'],
    vowels: ['ee', 'i', 'ay', 'a', 'ey'],
    codas:  ['n', 'l', 'th', '', 'r'],
  },
  hush: {
    onsets: ['h', 'f', 'th', 'sh', 'ph'],
    vowels: ['a', 'ah', 'eh', 'ae', 'e'],
    codas:  ['sh', 'th', 's', '', 'f'],
  },
  moan: {
    onsets: ['m', 'n', 'v', 'w', 'mo', 'no'],
    vowels: ['oh', 'oo', 'aw', 'ou'],
    codas:  ['m', 'n', 'l', '', 'r'],
  },
  hum: {
    onsets: ['m', 'n', 'b', 'w', 'l', 'bu'],
    vowels: ['u', 'ah', 'o', 'eh', 'a'],
    codas:  ['m', 'n', 'ng', '', 'l'],
  },
  hollow: {
    onsets: ['h', 'v', 'th', '', 'wh'],
    vowels: ['oo', 'oh', 'o', 'ah', 'u'],
    codas:  ['m', 'n', '', 'th', 'l'],
  },
}

/** Rare sound targets aliased to the nearest main palette. */
const SOUND_ALIASES = /** @type {Record<string, string>} */ ({
  silence: 'hollow',
  echo:    'hollow',
  wail:    'moan',
  rasp:    'crack',
  drum:    'roar',
})

/** Texture-to-palette fallback for concepts lacking sound + evokes edges. */
const TEXTURE_MAP = /** @type {Record<string, string>} */ ({
  rough:    'crack',
  smooth:   'whisper',
  soft:     'hush',
  wet:      'moan',
  sharp:    'crack',
  cold:     'hush',
  warm:     'hum',
  sticky:   'hum',
  glossy:   'ring',
  crumbling: 'crack',
})

/** Syllable count ranges by agent type: [min, max]. */
const SYLLABLE_RANGE = /** @type {Record<string, [number, number]>} */ ({
  'god':      [1, 2],
  'demi-god': [2, 2],
  'spirit':   [2, 3],
  'demon':    [2, 3],
  'ancestor': [2, 2],
  'herald':   [2, 2],
})

const DEFAULT_PALETTE = 'whisper'

// ── Sound resolution ──

/**
 * Resolve a concept to a palette key via: sound edge → evokes neighbor → texture → default.
 * @param {ConceptGraph} graph
 * @param {string} concept
 * @returns {string}
 */
function resolveSoundQuality(graph, concept) {
  const edges = graph.get(concept)
  if (!edges) return DEFAULT_PALETTE

  // 1. Direct sound edge
  for (const e of edges) {
    if (e.relation === 'sound' && e.direction === 'fwd') {
      const key = SOUND_ALIASES[e.concept] ?? e.concept
      if (PALETTES[key]) return key
    }
  }

  // 2. Walk evokes neighbors for one with a sound edge
  for (const e of edges) {
    if (e.relation === 'evokes' && e.direction === 'fwd') {
      const neighborEdges = graph.get(e.concept)
      if (!neighborEdges) continue
      for (const ne of neighborEdges) {
        if (ne.relation === 'sound' && ne.direction === 'fwd') {
          const key = SOUND_ALIASES[ne.concept] ?? ne.concept
          if (PALETTES[key]) return key
        }
      }
    }
  }

  // 3. Texture fallback
  for (const e of edges) {
    if (e.relation === 'texture' && e.direction === 'fwd') {
      const mapped = TEXTURE_MAP[e.concept]
      if (mapped) return mapped
    }
  }

  return DEFAULT_PALETTE
}

// ── World signature ──

/**
 * Build a world-level phoneme signature from the myth's concepts.
 * Returns the top 2–3 palette keys weighted by frequency.
 * @param {ConceptGraph} graph
 * @param {CreationMyth} myth
 * @returns {{ palettes: string[], weights: number[] }}
 */
export function buildWorldSignature(graph, myth) {
  const allConcepts = [
    ...myth.before.concepts,
    ...myth.act.concepts,
    ...myth.cost.concepts,
    ...myth.flaw.concepts,
  ]

  /** @type {Record<string, number>} */
  const counts = {}
  for (const c of allConcepts) {
    const key = resolveSoundQuality(graph, c)
    counts[key] = (counts[key] ?? 0) + 1
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, TUNING.topPalettes)

  return {
    palettes: top.map(([k]) => k),
    weights: top.map(([, v]) => v),
  }
}

// ── Morpheme table ──

/** Terrain shape keys that need generated morphemes. */
const TERRAIN_SHAPES = [
  'slab', 'hollow', 'pillar', 'shard', 'spiral',
  'coil', 'circle', 'point', 'branch', 'web', 'crescent',
]

/**
 * Generate a single morpheme (1 syllable, 2–4 chars) from a palette.
 * @param {() => number} rng
 * @param {Palette} palette
 * @param {boolean} wantCoda - true for suffixes (closed syllable), false for open
 * @param {Set<string>} used - morphemes already generated (avoid duplicates)
 * @returns {string}
 */
function generateMorpheme(rng, palette, wantCoda, used) {
  for (let i = 0; i < TUNING.maxMorphemeAttempts; i++) {
    const onset = pick(rng, palette.onsets)
    const vowel = pick(rng, palette.vowels)
    const coda = wantCoda ? pick(rng, palette.codas) : ''
    const m = (onset + vowel + coda).replace(/([^aeiou])\1/g, '$1')
    if (m.length >= 2 && m.length <= 4 && !used.has(m)) {
      used.add(m)
      return m
    }
  }
  // fallback
  const m = pick(rng, palette.onsets) + pick(rng, palette.vowels)
  used.add(m)
  return m
}

/**
 * Build a world-consistent morpheme table from the myth's phoneme signature.
 * Call once per world, before any nameRegion calls.
 * @param {ConceptGraph} graph
 * @param {CreationMyth} myth
 * @param {() => number} rng - dedicated RNG fork (seed + '-language')
 * @returns {MorphemeTable}
 */
export function buildMorphemeTable(graph, myth, rng) {
  const sig = buildWorldSignature(graph, myth)
  const primary = PALETTES[sig.palettes[0]] ?? PALETTES[DEFAULT_PALETTE]
  const secondary = PALETTES[sig.palettes[1]] ?? primary

  /** @type {Set<string>} */
  const used = new Set()

  // Terrain: one suffix per shape, from primary palette
  /** @type {Record<string, string>} */
  const terrain = {}
  for (const shape of TERRAIN_SHAPES) {
    terrain[shape] = generateMorpheme(rng, primary, true, used)
  }

  return {
    worldSignature: sig,
    place:    { suffix: generateMorpheme(rng, primary, true, used) },
    terrain,
    people:   { suffix: generateMorpheme(rng, primary, false, used) }, // open syllable (-eni, -aki)
    polity:   { prefix: generateMorpheme(rng, secondary, false, used) },
    sacred:   { prefix: generateMorpheme(rng, secondary, true, used) },
    artifact: { suffix: generateMorpheme(rng, primary, true, used) },
  }
}

/**
 * Attach a morpheme (prefix or suffix) to a bare stem.
 * Inserts a joining vowel when the junction would create 3+ consonants.
 * @param {string} stem - bare name (already capitalized)
 * @param {EntityType} entityType
 * @param {MorphemeTable} morphemes
 * @param {() => number} rng
 * @returns {string}
 */
function applyMorpheme(stem, entityType, morphemes, rng) {
  /** @type {string | undefined} */
  let prefix
  /** @type {string | undefined} */
  let suffix

  switch (entityType) {
    case 'place':    suffix = morphemes.place.suffix; break
    case 'people':   suffix = morphemes.people.suffix; break
    case 'artifact': suffix = morphemes.artifact.suffix; break
    case 'polity':   prefix = morphemes.polity.prefix; break
    case 'sacred':   prefix = morphemes.sacred.prefix; break
    default: return stem // creature, event, text — no affix
  }

  const joiningVowels = morphemes.worldSignature.palettes
    .map(k => PALETTES[k]?.vowels ?? [])
    .flat()
  const joinVowel = joiningVowels.length > 0
    ? pick(rng, joiningVowels).charAt(0) // single char from a vowel grapheme
    : 'a'

  if (suffix) {
    const lower = stem.toLowerCase()
    const lastChar = lower[lower.length - 1]
    const firstSuffix = suffix[0]
    const needsJoin = !VOWEL_CHARS.has(lastChar) && !VOWEL_CHARS.has(firstSuffix)
    const joined = needsJoin ? stem + joinVowel + suffix : stem + suffix
    return joined.charAt(0).toUpperCase() + joined.slice(1)
  }

  if (prefix) {
    const lower = stem.toLowerCase()
    const firstStem = lower[0]
    const lastPrefix = prefix[prefix.length - 1]
    const needsJoin = !VOWEL_CHARS.has(lastPrefix) && !VOWEL_CHARS.has(firstStem)
    const joined = needsJoin ? prefix + joinVowel + lower : prefix + lower
    return joined.charAt(0).toUpperCase() + joined.slice(1)
  }

  return stem
}

// ── Syllable generation ──

/** Vowel graphemes that should be treated as vowel characters for phonotactics. */
const VOWEL_CHARS = new Set(['a', 'e', 'i', 'o', 'u'])

/**
 * Count consecutive consonant characters at position in a string.
 * @param {string} s
 * @param {number} start
 * @returns {number}
 */
function consonantRunAt(s, start) {
  let n = 0
  for (let i = start; i < s.length; i++) {
    if (VOWEL_CHARS.has(s[i])) break
    n++
  }
  return n
}

/** Short words to reject as names — common English articles/prepositions. */
const BANNED_NAMES = new Set([
  'the', 'a', 'an', 'he', 'she', 'we', 'me', 'be', 'no', 'so', 'go', 'do',
  'ha', 'hi', 'oh', 'ah', 'uh', 'boo', 'moo', 'poo', 'goo', 'woo', 'hah',
])

/** Bad onset clusters that are unpronounceable in English-like phonotactics. */
const BAD_ONSETS = new Set(['ng', 'sr', 'nr', 'nl', 'ml', 'tl', 'dl', 'nw', 'bw', 'pw', 'fw'])

/**
 * Check if a generated name is pronounceable.
 * @param {string} name
 * @returns {boolean}
 */
function isPronounceable(name) {
  if (name.length < 2) return false
  if (name.length > 9) return false

  // No 3+ consecutive consonants anywhere
  for (let i = 0; i < name.length; i++) {
    if (!VOWEL_CHARS.has(name[i]) && consonantRunAt(name, i) >= 3) return false
  }

  // No 3+ consecutive vowel characters (catches digraph collisions like "ooo")
  let vowelRun = 0
  for (const ch of name) {
    vowelRun = VOWEL_CHARS.has(ch) ? vowelRun + 1 : 0
    if (vowelRun >= 3) return false
  }

  // No bad word-initial clusters
  const first2 = name.slice(0, 2)
  if (BAD_ONSETS.has(first2)) return false

  // Must contain at least one vowel
  if (vowelRun === 0) {
    let hasVowel = false
    for (const ch of name) {
      if (VOWEL_CHARS.has(ch)) { hasVowel = true; break }
    }
    if (!hasVowel) return false
  }

  // Reject common English words
  if (BANNED_NAMES.has(name)) return false

  return true
}

/**
 * Generate a single syllable from a palette.
 * @param {() => number} rng
 * @param {Palette} palette
 * @param {boolean} isFinal — final syllables get codas more often
 * @returns {string}
 */
function makeSyllable(rng, palette, isFinal) {
  const onset = pick(rng, palette.onsets)
  const vowel = pick(rng, palette.vowels)
  // Final syllables: 60% coda. Non-final: 30% coda (prevents cluster buildup).
  const codaChance = isFinal ? 0.6 : 0.3
  const coda = rng() < codaChance ? pick(rng, palette.codas) : ''
  return onset + vowel + coda
}

/**
 * Generate a name from blended palettes.
 * @param {() => number} rng
 * @param {string[]} paletteKeys
 * @param {number[]} weights
 * @param {number} syllableCount
 * @returns {string}
 */
function generateName(rng, paletteKeys, weights, syllableCount) {
  const palettes = paletteKeys.map(k => PALETTES[k]).filter(Boolean)
  if (palettes.length === 0) palettes.push(PALETTES[DEFAULT_PALETTE])
  const w = weights.length === palettes.length ? weights : palettes.map(() => 1)

  for (let attempt = 0; attempt < 8; attempt++) {
    let raw = ''
    for (let s = 0; s < syllableCount; s++) {
      const pal = weightedPick(rng, palettes, w)
      raw += makeSyllable(rng, pal, s === syllableCount - 1)
    }

    // Collapse adjacent identical consonants (syllable-boundary artifacts)
    raw = raw.replace(/([^aeiou])\1/g, '$1')

    // Capitalize
    const name = raw.charAt(0).toUpperCase() + raw.slice(1)

    if (isPronounceable(name.toLowerCase())) return name
  }

  // Last resort: single-syllable fallback with check
  for (let i = 0; i < 5; i++) {
    const pal = palettes[0]
    let fb = pick(rng, pal.onsets) + pick(rng, pal.vowels) + pick(rng, pal.codas)
    fb = fb.replace(/([^aeiou])\1/g, '$1')
    if (isPronounceable(fb)) return fb.charAt(0).toUpperCase() + fb.slice(1)
  }
  // Absolute fallback — onset + vowel only
  const pal = palettes[0]
  const ab = pick(rng, pal.onsets) + pick(rng, pal.vowels)
  return ab.charAt(0).toUpperCase() + ab.slice(1)
}

// ── Public API ──

/**
 * Assign phoneme-driven names to all agents.
 * Mutates `agent.name` in place.
 * @param {ConceptGraph} graph
 * @param {CreationMyth} myth
 * @param {Agent[]} agents
 * @param {() => number} rng
 */
export function nameAgents(graph, myth, agents, rng) {
  const world = buildWorldSignature(graph, myth)

  /** @type {Set<string>} */
  const usedNames = new Set()

  for (const agent of agents) {
    // Resolve each domain to a palette key
    const domainKeys = agent.domains.map(d => resolveSoundQuality(graph, d))
    // Deduplicate while preserving order
    const uniqueKeys = [...new Set(domainKeys)]

    // Blend: 70% agent domains, 30% world signature
    const blendedKeys = [...uniqueKeys, ...world.palettes]
    const blendedWeights = [
      ...uniqueKeys.map((_, i) => i === 0 ? 3 : 1.5), // primary domain weighted higher
      ...world.weights.map(w => w * 0.3),
    ]

    // Syllable count from agent type
    const [min, max] = SYLLABLE_RANGE[agent.type] ?? [2, 2]
    const syllableCount = min === max ? min : (rng() < 0.5 ? min : max)

    // Generate unique name
    let name = ''
    for (let tries = 0; tries < 5; tries++) {
      name = generateName(rng, blendedKeys, blendedWeights, syllableCount)
      if (!usedNames.has(name.toLowerCase())) break
    }

    usedNames.add(name.toLowerCase())
    agent.name = name
  }
}

/**
 * Generate a phoneme-driven name for the world itself.
 * Uses 100% world signature palette (no agent blending).
 * @param {ConceptGraph} graph
 * @param {CreationMyth} myth
 * @param {() => number} rng
 * @returns {string}
 */
export function nameWorld(graph, myth, rng) {
  const world = buildWorldSignature(graph, myth)
  const syllableCount = rng() < 0.4 ? 2 : 3
  return generateName(rng, world.palettes, world.weights, syllableCount)
}

/**
 * @typedef {{
 *   usedNames?: Set<string>,
 *   syllableRange?: [number, number],
 *   entityType?: EntityType,
 *   morphemes?: MorphemeTable | null,
 * }} NameRegionOpts
 */

/**
 * Generate a phoneme-driven name for an entity based on its concept cluster.
 * No world-signature blending -- entities should sound distinct from each other.
 * When entityType and morphemes are provided, applies morphological markers
 * (prefixes/suffixes) and reduces stem syllables to keep total length stable.
 * @param {ConceptGraph} graph
 * @param {string[]} concepts - the entity's concept cluster
 * @param {() => number} rng
 * @param {NameRegionOpts} [opts]
 * @returns {string}
 */
export function nameRegion(graph, concepts, rng, opts = {}) {
  const {
    usedNames = new Set(),
    syllableRange = [2, 3],
    entityType,
    morphemes,
  } = opts

  // Resolve each concept to a sound palette key
  const keys = concepts.map(c => resolveSoundQuality(graph, c))
  const uniqueKeys = [...new Set(keys)]

  // Weight by frequency (primary concept weighted higher)
  const weights = uniqueKeys.map((k, i) => {
    const count = keys.filter(x => x === k).length
    return count * (i === 0 ? 2 : 1)
  })

  // Reduce stem syllables by 1 when an affix will be applied
  const hasAffix = morphemes && entityType &&
    entityType !== 'creature' && entityType !== 'event' && entityType !== 'text'
  const [minSyl, maxSyl] = hasAffix
    ? [Math.max(1, syllableRange[0] - 1), Math.max(1, syllableRange[1] - 1)]
    : syllableRange
  const syllableCount = minSyl === maxSyl ? minSyl : minSyl + Math.floor(rng() * (maxSyl - minSyl + 1))

  let name = ''
  for (let tries = 0; tries < 5; tries++) {
    let candidate = generateName(rng, uniqueKeys, weights, syllableCount)

    // Apply morpheme if available
    if (morphemes && entityType && hasAffix) {
      candidate = applyMorpheme(candidate, entityType, morphemes, rng)
    }

    // Check pronounceability of the final affixed name
    if (!isPronounceable(candidate.toLowerCase())) continue

    name = candidate
    if (!usedNames.has(name.toLowerCase())) break
  }

  // Fallback: if all attempts failed pronounceability, use last candidate
  if (!name) {
    name = generateName(rng, uniqueKeys, weights, syllableCount)
    if (morphemes && entityType && hasAffix) {
      name = applyMorpheme(name, entityType, morphemes, rng)
    }
  }

  usedNames.add(name.toLowerCase())
  return name
}
