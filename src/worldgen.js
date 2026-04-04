/**
 * Island generation pipeline.
 *
 * Steps:
 *   1. Island mask — radial falloff + noise for organic boundary
 *   2. Composition generation — per-cell material blend via noise fields
 *   3. Elevation derivation — from composition properties
 *   4. Surface feature placement — from composition + elevation
 *
 * All steps are driven by params (see tuning.js for defaults).
 * Returns a WorldData object consumed by renderer.js.
 */

import { createNoise2D, fbm } from './noise.js'
import { hashSeed, mulberry32, clamp, smoothstep } from './utils.js'
import { MATERIALS, MATERIAL_KEYS } from './materials.js'
import { deriveElevation, runErosion } from './elevation.js'

/** @typedef {import('./tuning.js').GenParams} GenParams */

/**
 * @typedef {Object} CellData
 * @property {Record<string, number>} composition — material weights, sum to 1
 * @property {number} elevation — meters, negative = below sea level
 * @property {number} weirdness — 0..1 local weirdness value
 * @property {number} mask — 0..1 island mask (0 = deep water, 1 = inland)
 * @property {boolean} isWater
 */

/**
 * @typedef {Object} WorldData
 * @property {number} width — grid cells
 * @property {number} height — grid cells
 * @property {CellData[]} cells — row-major, index = y * width + x
 * @property {GenParams} params — params used to generate this world
 */

/**
 * Place island centers for single or multi-island configurations.
 * @param {() => number} rng
 * @param {GenParams} params
 * @param {number} width
 * @param {number} height
 * @returns {Array<{x: number, y: number, radius: number}>}
 */
function placeIslands(rng, params, width, height) {
  const count = Math.max(1, params.islandCount ?? 1)
  const radius = params.islandSize / Math.sqrt(count)
  const margin = radius * 0.5

  if (count === 1) {
    return [{ x: width / 2, y: height / 2, radius }]
  }

  /** @type {Array<{x: number, y: number, radius: number}>} */
  const centers = []
  const minSep = radius * 1.2

  for (let i = 0; i < count; i++) {
    let attempts = 0
    let cx = width / 2
    let cy = height / 2

    do {
      cx = margin + rng() * (width - margin * 2)
      cy = margin + rng() * (height - margin * 2)
      attempts++
    } while (
      attempts < 50 &&
      centers.some(c => {
        const dx = c.x - cx
        const dy = c.y - cy
        return Math.sqrt(dx * dx + dy * dy) < minSep
      })
    )

    centers.push({ x: cx, y: cy, radius })
  }

  return centers
}

/**
 * Compute island mask for a cell — 0 = water, 1 = solid land.
 * @param {number} x
 * @param {number} y
 * @param {Array<{x: number, y: number, radius: number}>} centers
 * @param {GenParams} params
 * @param {(x: number, y: number) => number} coastNoiseFn
 * @param {number} gridSize
 * @returns {number}
 */
function computeIslandMask(x, y, centers, params, coastNoiseFn, gridSize) {
  // Radial falloff — union of all island circles
  let falloff = 0
  for (const c of centers) {
    const dx = x - c.x
    const dy = y - c.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const t = dist / c.radius
    if (t < 1) {
      falloff = Math.max(falloff, smoothstep(1 - t))
    }
  }

  // Coast noise — organic boundary
  const nx = x * params.coastNoiseScale / gridSize
  const ny = y * params.coastNoiseScale / gridSize
  const coastVal = fbm(coastNoiseFn, nx, ny, params.coastNoiseOctaves)
  falloff += coastVal * params.coastNoiseAmplitude * 0.5

  // Fragmentation — carve holes/channels inside the island body
  const fragVal = fbm(coastNoiseFn, x * 2.0 / gridSize, y * 2.0 / gridSize, 3)
  const fragNorm = (fragVal + 1) * 0.5
  const fragThreshold = params.fragmentation ?? 0
  if (fragNorm < fragThreshold) {
    falloff -= smoothstep(1 - fragNorm / (fragThreshold + 0.001)) * params.fragmentation
  }

  return clamp(falloff, 0, 1)
}

/**
 * Compute local weirdness for a land cell.
 * @param {number} x
 * @param {number} y
 * @param {GenParams} params
 * @param {(x: number, y: number) => number} weirdNoiseFn
 * @param {number} gridSize
 * @returns {number}
 */
function computeWeirdness(x, y, params, weirdNoiseFn, gridSize) {
  const raw = fbm(weirdNoiseFn, x * 1.5 / gridSize, y * 1.5 / gridSize, 4)
  const normalized = (raw + 1) * 0.5
  return clamp(normalized * (params.globalWeirdness ?? 0), 0, 1)
}

/**
 * Fallback material params if a material is missing from params.materialParams.
 * @type {{ frequency: number, amplitude: number, bias: number, weirdness: number }}
 */
const FALLBACK_MAT_PARAMS = { frequency: 0.5, amplitude: 0.3, bias: 0.1, weirdness: 0 }

/**
 * Compute normalized material composition for a land cell.
 * @param {number} x
 * @param {number} y
 * @param {number} cellWeirdness
 * @param {GenParams} params
 * @param {Record<string, (x: number, y: number) => number>} matNoiseFns
 * @param {number} gridSize
 * @returns {Record<string, number>}
 */
function computeComposition(x, y, cellWeirdness, params, matNoiseFns, gridSize) {
  const exponent = 1 + (params.blendSharpness ?? 0.5) * 7

  /** @type {Record<string, number>} */
  const weights = {}

  for (const mat of MATERIAL_KEYS) {
    const mp = (params.materialParams && params.materialParams[mat]) ?? FALLBACK_MAT_PARAMS

    const raw = fbm(matNoiseFns[mat], x * mp.frequency / gridSize, y * mp.frequency / gridSize, 4)
    let w = (raw + 1) * 0.5  // remap [-1,1] → [0,1]
    w *= mp.amplitude
    w += mp.bias
    w += cellWeirdness * MATERIALS[mat].weirdnessAffinity * mp.weirdness
    w = Math.max(w, 0)

    // Blend sharpness: raise to exponent to sharpen material boundaries
    weights[mat] = Math.pow(w, exponent)
  }

  // Normalize
  let total = 0
  for (const mat of MATERIAL_KEYS) total += weights[mat]

  if (total < 1e-10) return { hard_rock: 1 }

  for (const mat of MATERIAL_KEYS) weights[mat] /= total
  return weights
}

/**
 * Generate a full world from the given parameters.
 * This is the main entry point called by main.js.
 * @param {GenParams} params
 * @param {((progress: number) => void) | null} [onProgress] 0..1 progress callback
 * @returns {WorldData}
 */
export function generateWorld(params, onProgress) {
  const width = params.gridSize ?? 512
  const height = params.gridSize ?? 512

  // Seed derivation — independent noise fields per role
  const rng = mulberry32(hashSeed(params.seed))
  const coastNoise = createNoise2D(hashSeed(params.seed + ':coast'))
  const weirdNoise  = createNoise2D(hashSeed(params.seed + ':weird'))

  /** @type {Record<string, (x: number, y: number) => number>} */
  const matNoise = {}
  for (const mat of MATERIAL_KEYS) {
    matNoise[mat] = createNoise2D(hashSeed(params.seed + ':mat:' + mat))
  }

  const centers = placeIslands(rng, params, width, height)

  const cells = new Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const mask = computeIslandMask(x, y, centers, params, coastNoise, width)
      const isWater = mask < 0.01

      if (isWater) {
        cells[idx] = { composition: { hard_rock: 1 }, elevation: 0, weirdness: 0, mask, isWater: true }
      } else {
        const weirdness = computeWeirdness(x, y, params, weirdNoise, width)
        const composition = computeComposition(x, y, weirdness, params, matNoise, width)
        cells[idx] = { composition, elevation: 0, weirdness, mask, isWater: false }
      }
    }

    if (onProgress && (y & 15) === 0) onProgress(y / height)
  }

  if (onProgress) onProgress(1)

  deriveElevation(cells, width, height, params)
  runErosion(cells, width, height, params)

  // Verification logging (tasks 2.6 + 3.4)
  const landCount = cells.filter(c => !c.isWater).length
  const waterCount = cells.length - landCount
  console.log(
    `[vesper] Generated ${width}×${height} world: ` +
    `${landCount} land, ${waterCount} water (${(100 * landCount / cells.length).toFixed(1)}% land)`
  )
  const sampleLand = cells.find(c => !c.isWater)
  if (sampleLand) {
    const top = Object.entries(sampleLand.composition)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
      .join(', ')
    console.log(`[vesper] Sample composition: ${top}`)
    console.log(`[vesper] Sample weirdness: ${sampleLand.weirdness.toFixed(3)}`)
  }
  const landCells = cells.filter(c => !c.isWater)
  if (landCells.length > 0) {
    const elevations = landCells.map(c => c.elevation)
    const maxElev = Math.max(...elevations)
    const avgElev = elevations.reduce((a, b) => a + b, 0) / elevations.length
    console.log(`[vesper] Elevation range: 0 — ${maxElev.toFixed(1)}m, avg ${avgElev.toFixed(1)}m`)
  }

  return { width, height, cells, params }
}
