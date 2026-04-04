/**
 * Generation parameter system.
 *
 * GenParams is the single object passed to the generation pipeline.
 * All parameters have defaults. The tuning panel UI reads from and writes
 * to a live params object; pressing "Generate" passes it to worldgen.js.
 *
 * The TuningPanel class builds the sidebar DOM from PARAM_DEFS and manages
 * preset save/load from localStorage.
 *
 * TODO: implement TuningPanel DOM construction, event binding, preset system
 */

/**
 * @typedef {Object} GenParams
 * @property {string} seed
 * @property {number} gridSize
 * @property {number} islandSize
 * @property {number} islandCount
 * @property {number} coastNoiseScale
 * @property {number} coastNoiseAmplitude
 * @property {number} coastNoiseOctaves
 * @property {number} fragmentation
 * @property {number} globalWeirdness
 * @property {number} elevationScale
 * @property {number} seaLevel
 * @property {number} erosionIterations
 * @property {number} erosionStrength
 * @property {number} elevationNoiseBlend
 * @property {number} blendSharpness
 * @property {number} featureDensity
 * @property {Record<string, { frequency: number, amplitude: number, bias: number, weirdness: number }>} materialParams
 */

/**
 * @typedef {Object} DisplayOptions
 * @property {boolean} showElevationShading
 * @property {boolean} showFeatures
 * @property {boolean} showGrid
 * @property {boolean} showContours
 * @property {'composition' | 'elevation' | 'weirdness' | string} colorMode
 */

/** @type {GenParams} */
export const DEFAULT_PARAMS = {
  seed: 'vesper',
  gridSize: 512,
  islandSize: 200,
  islandCount: 1,
  coastNoiseScale: 0.5,
  coastNoiseAmplitude: 0.7,
  coastNoiseOctaves: 4,
  fragmentation: 0.2,
  globalWeirdness: 0.3,
  elevationScale: 100,
  seaLevel: 0.3,
  erosionIterations: 3,
  erosionStrength: 0.5,
  elevationNoiseBlend: 0.3,
  blendSharpness: 0.5,
  featureDensity: 0.5,
  materialParams: {
    hard_rock: { frequency: 0.5, amplitude: 0.6, bias: 0.5, weirdness: 0.3 },
    sand:      { frequency: 0.4, amplitude: 0.5, bias: 0.4, weirdness: 0.1 },
    clay:      { frequency: 0.4, amplitude: 0.4, bias: 0.4, weirdness: 0.1 },
    organic:   { frequency: 0.3, amplitude: 0.4, bias: 0.3, weirdness: 0.2 },
    limestone: { frequency: 0.5, amplitude: 0.4, bias: 0.3, weirdness: 0.3 },
    volcanic:  { frequency: 0.6, amplitude: 0.3, bias: 0.2, weirdness: 0.4 },
    crystal:   { frequency: 0.7, amplitude: 0.3, bias: 0.1, weirdness: 0.8 },
    ferric:    { frequency: 0.6, amplitude: 0.3, bias: 0.2, weirdness: 0.6 },
    ash:       { frequency: 0.5, amplitude: 0.2, bias: 0.1, weirdness: 0.7 },
    bone:      { frequency: 0.5, amplitude: 0.2, bias: 0.1, weirdness: 0.8 },
  },
}

/** @type {DisplayOptions} */
export const DEFAULT_DISPLAY = {
  showElevationShading: true,
  showFeatures: true,
  showGrid: false,
  showContours: false,
  colorMode: 'composition',
}

/** Built-in presets */
export const PRESETS = {
  earthlike: {
    ...DEFAULT_PARAMS,
    seed: 'earthlike',
    globalWeirdness: 0.1,
    fragmentation: 0.15,
  },
  alien: {
    ...DEFAULT_PARAMS,
    seed: 'alien',
    globalWeirdness: 0.9,
    fragmentation: 0.4,
  },
  archipelago: {
    ...DEFAULT_PARAMS,
    seed: 'archipelago',
    islandCount: 4,
    fragmentation: 0.7,
  },
  volcanic: {
    ...DEFAULT_PARAMS,
    seed: 'volcanic',
    globalWeirdness: 0.4,
    elevationScale: 160,
  },
  marshland: {
    ...DEFAULT_PARAMS,
    seed: 'marshland',
    globalWeirdness: 0.2,
    seaLevel: 0.5,
    fragmentation: 0.6,
  },
  crystalline: {
    ...DEFAULT_PARAMS,
    seed: 'crystalline',
    globalWeirdness: 0.8,
  },
}

export class TuningPanel {
  /**
   * @param {HTMLElement} container
   * @param {(params: GenParams) => void} onGenerate
   */
  constructor(container, onGenerate) {
    this._container = container
    this._onGenerate = onGenerate
    this.params = { ...DEFAULT_PARAMS }
    this.display = { ...DEFAULT_DISPLAY }
    // TODO: build DOM
  }

  /** @returns {GenParams} */
  getParams() { return this.params }

  /** @returns {DisplayOptions} */
  getDisplay() { return this.display }
}
