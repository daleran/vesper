/**
 * Elevation derivation and erosion simulation.
 *
 * Elevation emerges from material composition:
 * - High hardness + high density = resistant material, forms peaks
 * - Low hardness + low density = soft material, settles into plains/basins
 *
 * The island mask shapes the overall profile: central cells are tallest,
 * coastal cells are low. An fbm noise layer adds topographic variety.
 *
 * Hydraulic erosion carves channels through soft material (sand, ash, organic)
 * while leaving hard rock ridges intact.
 */

import { createNoise2D, fbm } from './noise.js'
import { compositionProperty } from './materials.js'
import { hashSeed, mulberry32, clamp, lerp } from './utils.js'

/** @typedef {import('./worldgen.js').CellData} CellData */
/** @typedef {import('./tuning.js').GenParams} GenParams */

/**
 * Derive elevation for every cell from its composition.
 * Also refines per-cell weirdness to blend spatial noise with composition-derived weirdness.
 * Converts low-lying land cells to shallow water based on seaLevel threshold.
 * @param {CellData[]} cells
 * @param {number} width
 * @param {number} height
 * @param {GenParams} params
 */
export function deriveElevation(cells, width, height, params) {
  const elevNoiseFn = createNoise2D(hashSeed(params.seed + ':elev'))
  const noiseBlend = params.elevationNoiseBlend ?? 0.3
  const seaLevelMeters = params.seaLevel * params.elevationScale

  for (let idx = 0; idx < cells.length; idx++) {
    const cell = cells[idx]
    const x = idx % width
    const y = Math.floor(idx / width)

    if (cell.isWater) {
      // Seafloor depth: cells far from land are deeper
      cell.elevation = -(1 - cell.mask) * params.elevationScale * 0.3
      continue
    }

    // Base elevation from material resistance (hardness + density)
    const baseElev =
      compositionProperty(cell.composition, 'hardness') * 0.6 +
      compositionProperty(cell.composition, 'density') * 0.4

    // Shape by mask squared — natural concave profile (peaks inland, low coasts)
    const maskSq = cell.mask * cell.mask

    // Add noise for topographic variety; multiply by mask to suppress coast noise
    const nx = x * 0.8 / width
    const ny = y * 0.8 / height
    const noiseVal = fbm(elevNoiseFn, nx, ny, 4)

    const raw = baseElev * maskSq + noiseVal * noiseBlend * cell.mask
    cell.elevation = clamp(raw, 0, 1) * params.elevationScale

    // Refine weirdness: blend spatial noise with composition-derived weirdness (task 3.3)
    const compositionWeirdness = compositionProperty(cell.composition, 'weirdnessAffinity')
    cell.weirdness = lerp(cell.weirdness, compositionWeirdness, 0.5)
  }

  // Sea level pass: convert low-lying land to shallow water
  for (let idx = 0; idx < cells.length; idx++) {
    const cell = cells[idx]
    if (!cell.isWater && cell.elevation < seaLevelMeters) {
      cell.isWater = true
      cell.elevation = cell.elevation - seaLevelMeters // slightly negative
    }
  }
}

/**
 * Run hydraulic erosion simulation passes.
 * Low-stability materials erode faster, carving rivers and valleys.
 * @param {CellData[]} cells
 * @param {number} width
 * @param {number} height
 * @param {GenParams} params
 */
export function runErosion(cells, width, height, params) {
  if (params.erosionIterations <= 0 || params.erosionStrength <= 0) return

  const rng = mulberry32(hashSeed(params.seed + ':erosion'))
  const dropCount = Math.floor(width * height * 0.1)
  const maxSteps = 30

  /**
   * Returns the index of the lowest non-water neighbor, or -1 if current is lowest.
   * @param {number} idx
   * @returns {number}
   */
  function lowestNeighbor(idx) {
    const cx = idx % width
    const cy = Math.floor(idx / width)
    let lowestIdx = -1
    let lowestElev = cells[idx].elevation

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const nIdx = ny * width + nx
        const neighbor = cells[nIdx]
        if (neighbor.elevation < lowestElev) {
          lowestElev = neighbor.elevation
          lowestIdx = nIdx
        }
      }
    }
    return lowestIdx
  }

  for (let iter = 0; iter < params.erosionIterations; iter++) {
    for (let d = 0; d < dropCount; d++) {
      let idx = Math.floor(rng() * cells.length)
      if (cells[idx].isWater) continue

      let sediment = 0
      let speed = 1

      for (let step = 0; step < maxSteps; step++) {
        const nextIdx = lowestNeighbor(idx)

        if (nextIdx === -1 || cells[nextIdx].isWater) {
          // Deposit carried sediment here
          cells[idx].elevation += sediment * 0.5
          break
        }

        const stability = compositionProperty(cells[idx].composition, 'stability')
        const erodeAmount = params.erosionStrength * (1 - stability) * speed * 0.1

        cells[idx].elevation = Math.max(0, cells[idx].elevation - erodeAmount)
        sediment += erodeAmount

        idx = nextIdx
        speed *= 0.95
      }
    }
  }

  // Smoothing pass: average each land cell with cardinal neighbors
  const smoothed = new Float32Array(cells.length)
  for (let idx = 0; idx < cells.length; idx++) {
    smoothed[idx] = cells[idx].elevation
  }

  for (let idx = 0; idx < cells.length; idx++) {
    if (cells[idx].isWater) continue
    const cx = idx % width
    const cy = Math.floor(idx / width)
    let total = cells[idx].elevation * 0.6
    let weight = 0.6

    const cardinals = [
      [cx,     cy - 1],
      [cx,     cy + 1],
      [cx - 1, cy    ],
      [cx + 1, cy    ],
    ]
    for (const [nx, ny] of cardinals) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nIdx = ny * width + nx
      if (!cells[nIdx].isWater) {
        total += cells[nIdx].elevation * 0.1
        weight += 0.1
      }
    }

    smoothed[idx] = total / weight
  }

  for (let idx = 0; idx < cells.length; idx++) {
    if (!cells[idx].isWater) {
      cells[idx].elevation = Math.max(0, smoothed[idx])
    }
  }
}
