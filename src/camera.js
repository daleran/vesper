import { clamp } from './utils.js'

const MIN_SCALE = 0.25
const MAX_SCALE = 8.0
const ZOOM_SPEED = 0.001

export default class Camera {
  /**
   * @param {number} width  — viewport width in CSS pixels
   * @param {number} height — viewport height in CSS pixels
   */
  constructor(width, height) {
    /** World X of camera center */
    this.x = 0
    /** World Y of camera center */
    this.y = 0
    /** Zoom scale (1.0 = 1:1, >1 = zoomed in) */
    this.scale = 1.0
    this.width = width
    this.height = height
  }

  /**
   * Apply camera transform to canvas context.
   * Call ctx.save() before and ctx.restore() after drawing world content.
   * @param {CanvasRenderingContext2D} ctx
   */
  applyTransform(ctx) {
    ctx.translate(this.width / 2, this.height / 2)
    ctx.scale(this.scale, this.scale)
    ctx.translate(-this.x, -this.y)
  }

  /**
   * Convert world coordinates to screen coordinates.
   * @param {number} wx
   * @param {number} wy
   * @returns {{ x: number, y: number }}
   */
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.scale + this.width / 2,
      y: (wy - this.y) * this.scale + this.height / 2,
    }
  }

  /**
   * Convert screen coordinates to world coordinates.
   * @param {number} sx
   * @param {number} sy
   * @returns {{ x: number, y: number }}
   */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.width / 2) / this.scale + this.x,
      y: (sy - this.height / 2) / this.scale + this.y,
    }
  }

  /**
   * Pan the camera by a screen-space delta (e.g. mouse drag).
   * Converts to world space so panning feels 1:1 at any zoom level.
   * @param {number} dx — screen pixels
   * @param {number} dy — screen pixels
   */
  pan(dx, dy) {
    this.x -= dx / this.scale
    this.y -= dy / this.scale
  }

  /**
   * Zoom toward a screen-space pivot point.
   * @param {number} wheelDelta — positive = zoom out, negative = zoom in
   * @param {number} pivotX — screen X of zoom pivot (e.g. mouse position)
   * @param {number} pivotY — screen Y of zoom pivot
   */
  zoom(wheelDelta, pivotX, pivotY) {
    const worldBefore = this.screenToWorld(pivotX, pivotY)
    this.scale = clamp(this.scale * (1 - wheelDelta * ZOOM_SPEED), MIN_SCALE, MAX_SCALE)
    const worldAfter = this.screenToWorld(pivotX, pivotY)
    // Compensate so the point under the cursor stays fixed
    this.x += worldBefore.x - worldAfter.x
    this.y += worldBefore.y - worldAfter.y
  }

  /**
   * Clamp camera position so the view cannot drift outside the world.
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  clampToBounds(worldWidth, worldHeight) {
    const halfW = (this.width / 2) / this.scale
    const halfH = (this.height / 2) / this.scale
    this.x = clamp(this.x, halfW, worldWidth - halfW)
    this.y = clamp(this.y, halfH, worldHeight - halfH)
  }

  /**
   * Reset zoom to fit the entire world in the viewport.
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  fitToWorld(worldWidth, worldHeight) {
    this.x = worldWidth / 2
    this.y = worldHeight / 2
    this.scale = Math.min(this.width / worldWidth, this.height / worldHeight)
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.width = width
    this.height = height
  }
}
