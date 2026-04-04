/**
 * Material definitions for the composition system.
 *
 * Each material has physical properties that drive terrain emergence:
 * hardness, density, stability, and weirdnessAffinity.
 * Values are 0.0 - 1.0 unless otherwise noted.
 *
 * Material names shown here are internal keys. Display names are
 * procedurally generated per-seed in naming.js.
 */

/** @typedef {{ hardness: number, density: number, stability: number, weirdnessAffinity: number, baseColor: string }} MaterialDef */

/** @type {Record<string, MaterialDef>} */
export const MATERIALS = {
  hard_rock: {
    hardness: 0.9,
    density: 0.85,
    stability: 0.9,
    weirdnessAffinity: 0.1,
    baseColor: '#6b6b6b',
  },
  sand: {
    hardness: 0.15,
    density: 0.25,
    stability: 0.15,
    weirdnessAffinity: 0.1,
    baseColor: '#c8a96e',
  },
  clay: {
    hardness: 0.4,
    density: 0.5,
    stability: 0.45,
    weirdnessAffinity: 0.1,
    baseColor: '#a0622a',
  },
  organic: {
    hardness: 0.1,
    density: 0.2,
    stability: 0.1,
    weirdnessAffinity: 0.15,
    baseColor: '#2d4a1e',
  },
  limestone: {
    hardness: 0.5,
    density: 0.45,
    stability: 0.3,
    weirdnessAffinity: 0.4,
    baseColor: '#e8e0cc',
  },
  volcanic: {
    hardness: 0.95,
    density: 0.95,
    stability: 0.95,
    weirdnessAffinity: 0.5,
    baseColor: '#1a1a2e',
  },
  crystal: {
    hardness: 0.9,
    density: 0.55,
    stability: 0.2,
    weirdnessAffinity: 0.95,
    baseColor: '#b8e0ff',
  },
  ferric: {
    hardness: 0.8,
    density: 0.9,
    stability: 0.75,
    weirdnessAffinity: 0.7,
    baseColor: '#8b3a1a',
  },
  ash: {
    hardness: 0.05,
    density: 0.1,
    stability: 0.05,
    weirdnessAffinity: 0.85,
    baseColor: '#c8cdd6',
  },
  bone: {
    hardness: 0.5,
    density: 0.35,
    stability: 0.45,
    weirdnessAffinity: 0.9,
    baseColor: '#f0e8d0',
  },
}

export const MATERIAL_KEYS = /** @type {(keyof typeof MATERIALS)[]} */ (Object.keys(MATERIALS))

/**
 * Compute the weighted average of a property across a composition vector.
 * @param {Record<string, number>} composition — must sum to 1
 * @param {keyof MaterialDef} property
 * @returns {number}
 */
export function compositionProperty(composition, property) {
  let value = 0
  for (const key of MATERIAL_KEYS) {
    const prop = MATERIALS[key][property]
    value += (composition[key] ?? 0) * /** @type {number} */ (prop)
  }
  return value
}

/**
 * Return the dominant material key (highest weight in composition).
 * @param {Record<string, number>} composition
 * @returns {string}
 */
export function dominantMaterial(composition) {
  let best = MATERIAL_KEYS[0]
  for (const key of MATERIAL_KEYS) {
    if ((composition[key] ?? 0) > (composition[best] ?? 0)) best = key
  }
  return best
}
