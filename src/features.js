/**
 * Surface feature generation.
 *
 * Surface features are derived from dominant material + elevation + weirdness:
 *   hard_rock + high elevation              → mountain ridges
 *   sand + low elevation                    → dunes, beaches
 *   organic + water proximity               → marshes, bogs
 *   crystal + any elevation                 → spires, geometric formations
 *   volcanic + high density                 → basalt columns, lava fields
 *   bone + any                              → fossil ridges, skeletal arches
 *   crystal + volcanic (mixed)              → obsidian glass fields
 *   organic + crystal (mixed)               → living crystal growths
 *
 * At high weirdness additional rules activate (spirals, honeycombs, inverted valleys).
 *
 * TODO: implement feature placement
 */

/** @typedef {import('./worldgen.js').CellData} CellData */
/** @typedef {import('./tuning.js').GenParams} GenParams */

/**
 * @typedef {Object} SurfaceFeature
 * @property {string} type — e.g. 'mountain_ridge', 'crystal_spire', 'bog'
 * @property {number} x — world cell X
 * @property {number} y — world cell Y
 * @property {number} scale — relative size
 * @property {number} rotation — radians
 */

/**
 * Generate surface features for the world.
 * @param {CellData[]} _cells
 * @param {number} _width
 * @param {number} _height
 * @param {GenParams} _params
 * @returns {SurfaceFeature[]}
 */
export function generateFeatures(_cells, _width, _height, _params) {
  // TODO
  return []
}
