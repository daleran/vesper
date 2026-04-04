/**
 * Canvas rendering pipeline.
 *
 * Render layers (bottom to top):
 *   1. Water      — base ocean fill with subtle noise texture
 *   2. Terrain    — land colored by composition, shaded by elevation
 *   3. Features   — crystal spires, rock pillars, bone arches, etc.
 *   4. Grid       — optional composition sampling grid (debug)
 *   5. Cursor     — crosshair / highlight at mouse position
 *
 * The terrain layer is pre-rendered to an offscreen canvas at generation
 * time. Camera pan/zoom operates on this cached texture — no per-frame
 * regeneration of terrain pixels.
 */

import { MATERIALS, MATERIAL_KEYS } from './materials.js'
import { clamp, lerp } from './utils.js'

/** @typedef {import('./worldgen.js').WorldData} WorldData */
/** @typedef {import('./features.js').SurfaceFeature} SurfaceFeature */
/** @typedef {import('./camera.js').default} Camera */
/** @typedef {import('./tuning.js').DisplayOptions} DisplayOptions */

const CELL_SIZE = 10

// --- Color constants ---

const SHALLOW = { r: 70, g: 130, b: 180 }
const DEEP    = { r: 15, g: 30,  b: 60  }

/** @type {{ t: number, r: number, g: number, b: number }[]} */
const WEIRD_RAMP = [
  { t: 0.0,  r: 15,  g: 30,  b: 120 },
  { t: 0.25, r: 0,   g: 180, b: 200 },
  { t: 0.5,  r: 0,   g: 200, b: 50  },
  { t: 0.75, r: 240, g: 220, b: 0   },
  { t: 1.0,  r: 220, g: 30,  b: 80  },
]

// Pre-parse all material hex colors to {r,g,b} at module load
/** @type {Record<string, {r:number,g:number,b:number}>} */
const MAT_COLORS = {}
for (const key of MATERIAL_KEYS) {
  MAT_COLORS[key] = parseHex(MATERIALS[key].baseColor)
}

// --- Private helpers ---

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function parseHex(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

/**
 * @param {import('./worldgen.js').CellData} cell
 * @returns {{ r: number, g: number, b: number }}
 */
function compositionColor(cell) {
  let r = 0, g = 0, b = 0
  for (const key of MATERIAL_KEYS) {
    const w = cell.composition[key] ?? 0
    if (w < 0.001) continue
    const c = MAT_COLORS[key]
    r += c.r * w
    g += c.g * w
    b += c.b * w
  }
  return { r, g, b }
}

/**
 * @param {import('./worldgen.js').CellData} cell
 * @param {number} maxDepth
 * @returns {{ r: number, g: number, b: number }}
 */
function waterColor(cell, maxDepth) {
  const t = maxDepth > 0 ? clamp(Math.abs(cell.elevation) / maxDepth, 0, 1) : 0
  return {
    r: lerp(SHALLOW.r, DEEP.r, t),
    g: lerp(SHALLOW.g, DEEP.g, t),
    b: lerp(SHALLOW.b, DEEP.b, t),
  }
}

/**
 * @param {import('./worldgen.js').CellData} cell
 * @param {number} maxElev
 * @returns {{ r: number, g: number, b: number }}
 */
function elevationColor(cell, maxElev) {
  if (cell.isWater) {
    const v = Math.round(clamp(1 - Math.abs(cell.elevation) / (maxElev || 1), 0, 1) * 76)
    return { r: v, g: v, b: v }
  }
  const brightness = Math.round(clamp(cell.elevation / (maxElev || 1), 0, 1) * 255)
  return { r: brightness, g: brightness, b: brightness }
}

/**
 * @param {import('./worldgen.js').CellData} cell
 * @returns {{ r: number, g: number, b: number }}
 */
function weirdnessColor(cell) {
  if (cell.isWater) return { r: 20, g: 20, b: 40 }
  const w = clamp(cell.weirdness, 0, 1)
  let i = 0
  while (i < WEIRD_RAMP.length - 2 && WEIRD_RAMP[i + 1].t <= w) i++
  const a = WEIRD_RAMP[i]
  const b = WEIRD_RAMP[i + 1]
  const span = b.t - a.t
  const t = span > 0 ? (w - a.t) / span : 0
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  }
}

/**
 * @param {{ r: number, g: number, b: number }} color
 * @param {import('./worldgen.js').CellData} cell
 * @param {number} maxElev
 * @returns {{ r: number, g: number, b: number }}
 */
function applyElevationShading(color, cell, maxElev) {
  if (cell.isWater) return color
  const normalized = clamp(cell.elevation / (maxElev || 1), 0, 1)
  const factor = lerp(0.65, 1.2, normalized)
  return {
    r: clamp(color.r * factor, 0, 255),
    g: clamp(color.g * factor, 0, 255),
    b: clamp(color.b * factor, 0, 255),
  }
}

// --- Exports ---

/**
 * Pre-render terrain to an offscreen canvas.
 * Call this after generation, not per-frame.
 * @param {WorldData} world
 * @param {DisplayOptions} display
 * @returns {HTMLCanvasElement}
 */
export function buildTerrainTexture(world, display) {
  const { width, height, cells } = world

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  // Pre-scan for normalization ranges
  let maxElev = 0
  let maxDepth = 0
  for (const cell of cells) {
    if (!cell.isWater && cell.elevation > maxElev) maxElev = cell.elevation
    if (cell.isWater && Math.abs(cell.elevation) > maxDepth) maxDepth = Math.abs(cell.elevation)
  }

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    /** @type {{ r: number, g: number, b: number }} */
    let color

    switch (display.colorMode) {
      case 'elevation':
        color = elevationColor(cell, maxElev)
        break
      case 'weirdness':
        color = weirdnessColor(cell)
        break
      default: // 'composition'
        color = cell.isWater
          ? waterColor(cell, maxDepth)
          : compositionColor(cell)
        if (display.showElevationShading) {
          color = applyElevationShading(color, cell, maxElev)
        }
    }

    const px = i * 4
    data[px]     = color.r
    data[px + 1] = color.g
    data[px + 2] = color.b
    data[px + 3] = 255
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Render a full frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Camera} camera
 * @param {HTMLCanvasElement} terrainTexture
 * @param {SurfaceFeature[]} _features
 * @param {DisplayOptions} _display
 * @param {{ x: number, y: number } | null} _cursorWorld — world-space cursor position
 */
export function renderFrame(ctx, camera, terrainTexture, _features, _display, _cursorWorld) {
  const { width, height } = camera

  // Deep ocean background (visible beyond world edges when zoomed in)
  ctx.fillStyle = '#0a1a2e'
  ctx.fillRect(0, 0, width, height)

  // Terrain texture via camera transform
  ctx.save()
  camera.applyTransform(ctx)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    terrainTexture,
    0, 0,
    terrainTexture.width * CELL_SIZE,
    terrainTexture.height * CELL_SIZE,
  )
  ctx.restore()

  // TODO: features, grid overlay, cursor highlight
}
