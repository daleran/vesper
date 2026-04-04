/**
 * Hover tooltip — shows per-cell generation data under the cursor.
 *
 * Over land:
 *   Position, Elevation, Dominant material (name + %), full composition,
 *   Hardness, Density, Stability, Local Weirdness, Surface type
 *
 * Over water:
 *   Position, Depth, Water type, Nearest shore distance,
 *   Seafloor composition
 *
 * The tooltip is a DOM element positioned near the cursor.
 * It is updated in real-time as the cursor moves.
 *
 * TODO: implement update(), show(), hide()
 */

/** @typedef {import('./worldgen.js').CellData} CellData */
/** @typedef {import('./naming.js').NameDict} NameDict */

export class Tooltip {
  /** @param {HTMLElement} container */
  constructor(container) {
    this._el = document.createElement('div')
    this._el.id = 'tooltip'
    this._el.style.display = 'none'
    container.appendChild(this._el)
  }

  /**
   * Update tooltip content and position.
   * @param {number} screenX
   * @param {number} screenY
   * @param {number} worldX
   * @param {number} worldY
   * @param {CellData | null} cell — null if out of bounds
   * @param {NameDict} _names
   */
  update(screenX, screenY, worldX, worldY, cell, _names) {
    if (!cell) { this.hide(); return }

    // TODO: populate with real data
    this._el.innerHTML = `
      <div class="tooltip-row"><span class="label">Position</span><span>(${worldX}, ${worldY})</span></div>
      <div class="tooltip-row"><span class="label">Elevation</span><span>${cell.elevation.toFixed(1)}m</span></div>
      <div class="tooltip-row"><span class="label">Water</span><span>${cell.isWater ? 'yes' : 'no'}</span></div>
    `

    const padding = 16
    const ex = screenX + padding
    const ey = screenY + padding
    this._el.style.left = `${ex}px`
    this._el.style.top = `${ey}px`
    this._el.style.display = 'block'
  }

  hide() {
    this._el.style.display = 'none'
  }
}
