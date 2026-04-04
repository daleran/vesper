/**
 * Seeded PRNG — mulberry32. Returns a function that produces
 * deterministic floats in [0, 1) from a 32-bit seed.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hash a string seed to a 32-bit integer.
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h >>> 0
}

/**
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t — 0..1
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Smooth step interpolation (ease in/out).
 * @param {number} t — 0..1
 * @returns {number}
 */
export function smoothstep(t) {
  return t * t * (3 - 2 * t)
}
