/**
 * Procedural name generation.
 *
 * Each seed produces a consistent naming dictionary:
 *   - Material names (e.g. "Veithite", "Duskite", "Thornite")
 *   - Surface feature names (e.g. "Kael-spire", "Vorn-ridge")
 *   - Island name (e.g. "Duskfall", "Thornmire")
 *
 * Syllable-based generation with phoneme rules.
 * The same material always has the same name within a seed.
 *
 * TODO: implement buildNameDict
 */

import { mulberry32 } from './utils.js'
import { MATERIAL_KEYS } from './materials.js'

/** @typedef {Record<string, string>} NameDict */

const ONSET = ['th', 'kr', 'vr', 'zn', 'gh', 'dr', 'sk', 'fl', 'k', 'v', 'd', 'r', 'm', 'n', 'l', 't']
const VOWEL = ['ei', 'oa', 'u', 'ae', 'i', 'ou', 'a', 'e', 'o']
const CODA = ['rn', 'lt', 'sk', 'th', 'k', 't', 'n', 'l', 's', '']
const MATERIAL_SUFFIXES = ['-ite', '-ite', '-ite', '-ore', '-ite', '-ite']
const FEATURE_SUFFIXES = ['-spire', '-ridge', '-arch', '-maw', '-tooth', '-pillar']
const ISLAND_SUFFIXES = ['-land', '-reach', '-fall', '-mire', '-waste']

/**
 * Generate a single alien syllable name.
 * @param {() => number} rng
 * @param {string[]} suffixes
 * @returns {string}
 */
function generateName(rng, suffixes) {
  const syllables = 1 + Math.floor(rng() * 2) // 1 or 2 syllables
  let name = ''
  for (let i = 0; i < syllables; i++) {
    name += ONSET[Math.floor(rng() * ONSET.length)]
    name += VOWEL[Math.floor(rng() * VOWEL.length)]
    if (i === syllables - 1) name += CODA[Math.floor(rng() * CODA.length)]
  }
  const suffix = suffixes[Math.floor(rng() * suffixes.length)]
  // Capitalize first letter, append suffix
  name = name.charAt(0).toUpperCase() + name.slice(1) + suffix
  return name
}

/**
 * Build the full naming dictionary for a given seed.
 * @param {number} seed
 * @returns {NameDict & { island: string }}
 */
export function buildNameDict(seed) {
  const rng = mulberry32(seed)
  /** @type {NameDict & { island: string }} */
  const dict = { island: '' }

  for (const key of MATERIAL_KEYS) {
    dict[key] = generateName(rng, MATERIAL_SUFFIXES)
  }

  dict['island'] = generateName(rng, ISLAND_SUFFIXES)
  dict['feature_spire'] = generateName(rng, FEATURE_SUFFIXES)
  dict['feature_ridge'] = generateName(rng, FEATURE_SUFFIXES)
  dict['feature_arch'] = generateName(rng, FEATURE_SUFFIXES)

  return dict
}
