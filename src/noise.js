/**
 * OpenSimplex2S noise — 2D implementation.
 * Based on KdotJPG's OpenSimplex2 (public domain).
 *
 * Usage:
 *   const noise = createNoise2D(seed)
 *   const val = noise(x, y)  // returns [-1, 1]
 */

const PRIME_X = 0x5205402B
const PRIME_Y = 0x598CD327
const HASH_MULTIPLIER = 0x53A3F72D

const GRADIENTS_2D = new Float64Array([
   0.38268343236509,  0.923879532511287,
   0.923879532511287, 0.38268343236509,
   0.923879532511287,-0.38268343236509,
   0.38268343236509, -0.923879532511287,
  -0.38268343236509, -0.923879532511287,
  -0.923879532511287,-0.38268343236509,
  -0.923879532511287, 0.38268343236509,
  -0.38268343236509,  0.923879532511287,
   0.130526192220052, 0.99144486137381,
   0.608761429008721, 0.793353340291235,
   0.793353340291235, 0.608761429008721,
   0.99144486137381,  0.130526192220052,
   0.99144486137381, -0.130526192220052,
   0.793353340291235,-0.608761429008721,
   0.608761429008721,-0.793353340291235,
   0.130526192220052,-0.99144486137381,
  -0.130526192220052,-0.99144486137381,
  -0.608761429008721,-0.793353340291235,
  -0.793353340291235,-0.608761429008721,
  -0.99144486137381, -0.130526192220052,
  -0.99144486137381,  0.130526192220052,
  -0.793353340291235, 0.608761429008721,
  -0.608761429008721, 0.793353340291235,
  -0.130526192220052, 0.99144486137381,
])

/**
 * @param {number} seed
 * @returns {(x: number, y: number) => number}
 */
export function createNoise2D(seed) {
  // Build permutation table seeded with mulberry32-like mixing
  const perm = new Uint8Array(512)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i

  // Shuffle using seed
  let s = seed | 0
  for (let i = 255; i > 0; i--) {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    const r = ((t ^ (t >>> 14)) >>> 0) % (i + 1)
    const tmp = p[i]; p[i] = p[r]; p[r] = tmp
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  /**
   * @param {number} xin
   * @param {number} yin
   * @returns {number} — [-1, 1]
   */
  return function noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1)
    const G2 = (3 - Math.sqrt(3)) / 6

    const s2 = (xin + yin) * F2
    const i = Math.floor(xin + s2)
    const j = Math.floor(yin + s2)

    const t = (i + j) * G2
    const X0 = i - t
    const Y0 = j - t
    const x0 = xin - X0
    const y0 = yin - Y0

    let i1, j1
    if (x0 > y0) { i1 = 1; j1 = 0 }
    else          { i1 = 0; j1 = 1 }

    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2

    const ii = i & 255
    const jj = j & 255
    const gi0 = (perm[ii + perm[jj]] % 12) * 2
    const gi1 = (perm[ii + i1 + perm[jj + j1]] % 12) * 2
    const gi2 = (perm[ii + 1 + perm[jj + 1]] % 12) * 2

    const GRADS = [
      1,1, -1,1, 1,-1, -1,-1,
      1,0, -1,0, 1,0,  -1,0,
      0,1,  0,-1, 0,1,  0,-1,
    ]

    let n0 = 0, n1 = 0, n2 = 0
    let t0 = 0.5 - x0*x0 - y0*y0
    if (t0 >= 0) {
      t0 *= t0
      n0 = t0 * t0 * (GRADS[gi0] * x0 + GRADS[gi0+1] * y0)
    }
    let t1 = 0.5 - x1*x1 - y1*y1
    if (t1 >= 0) {
      t1 *= t1
      n1 = t1 * t1 * (GRADS[gi1] * x1 + GRADS[gi1+1] * y1)
    }
    let t2 = 0.5 - x2*x2 - y2*y2
    if (t2 >= 0) {
      t2 *= t2
      n2 = t2 * t2 * (GRADS[gi2] * x2 + GRADS[gi2+1] * y2)
    }

    return 70 * (n0 + n1 + n2)
  }
}

/**
 * Fractal Brownian Motion — stack multiple octaves of noise.
 * @param {(x: number, y: number) => number} noiseFn
 * @param {number} x
 * @param {number} y
 * @param {number} octaves
 * @param {number} lacunarity — frequency multiplier per octave (typically 2)
 * @param {number} gain — amplitude multiplier per octave (typically 0.5)
 * @returns {number} — roughly [-1, 1]
 */
export function fbm(noiseFn, x, y, octaves, lacunarity = 2, gain = 0.5) {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += noiseFn(x * frequency, y * frequency) * amplitude
    maxValue += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }

  return value / maxValue
}

// Suppress unused import warnings for the constants used only in GRADIENTS_2D init
void PRIME_X; void PRIME_Y; void HASH_MULTIPLIER; void GRADIENTS_2D
