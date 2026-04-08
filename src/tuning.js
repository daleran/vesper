/**
 * Centralized tuning constants for world generation.
 *
 * WORLD_SCALE is the primary debug lever:
 *   0.5 → half-size world (fast iteration)
 *   1.0 → normal
 *   2.0 → dense world (stress test)
 *
 * All min/max entity counts flow through scaled() so a single
 * constant controls overall world density.
 *
 * Ratio-based caps use proportion() — they compute limits relative
 * to actual entity counts so the world stays internally consistent
 * regardless of WORLD_SCALE.
 */

// ── World Scale ──

export const WORLD_SCALE = 1.0

/**
 * Scale a {min, max} range by WORLD_SCALE, enforcing integer min ≥ floor.
 * @param {number} min
 * @param {number} max
 * @param {number} [floor=1]
 * @returns {{ min: number, max: number }}
 */
export function scaled(min, max, floor = 1) {
  const sMin = Math.max(floor, Math.round(min * WORLD_SCALE))
  const sMax = Math.max(sMin, Math.round(max * WORLD_SCALE))
  return { min: sMin, max: sMax }
}

/**
 * Compute a proportional count from a parent entity count.
 * Returns an integer between floor and ceiling.
 * @param {number} parentCount - the count of the parent entities
 * @param {number} ratio - fraction of parent count (e.g., 0.5 = half)
 * @param {number} [floor=1] - minimum result
 * @param {number} [ceiling=Infinity] - maximum result
 * @returns {number}
 */
export function proportion(parentCount, ratio, floor = 1, ceiling = Infinity) {
  return Math.max(floor, Math.min(ceiling, Math.round(parentCount * ratio)))
}

export const TUNING = {
  // ── Pantheon ──
  pantheon: scaled(3, 7),
  secondaryAgentHops: 2,

  // ── History ──
  historyEvents: scaled(5, 8),
  historyConceptsPerEvent: 3,

  // ── Geogony ──
  terrains: scaled(6, 10),
  landmarks: scaled(4, 8),
  climateHops: 3,
  climateConcepts: { min: 2, max: 3 },
  maxMaterials: 12,
  landscapeAgentChance: 0.4,
  maxLandscapeAgents: 3,
  maxTerrainsPerRegion: 3,

  // ── Biogony ──
  lifeforms: scaled(8, 12),
  extinctionRatio: 0.25, // fraction of lifeforms that go extinct, floor 1

  // ── Anthropogony ──
  peoples: scaled(3, 6),
  peopleConcepts: { hops: 3, size: 6 },
  maxMemoryFearConcepts: 2,           // per people — structural
  commonMemoryRatio: 0.5,             // fraction of peoples → shared memory concepts, floor 1
  disputeRatio: 0.5,                  // fraction of peoples → disputes, floor 1

  // ── Hierogony ──
  maxWorshippedAgents: 3,             // per religion — structural
  heresyRatio: 0.6,                   // fraction of religions that spawn a heresy, floor 1

  // ── Politogony ──
  maxPolityResources: 8,              // per polity — structural
  conflictPairRatio: 0.3,             // fraction of polity pairs → conflicts, floor 1
  alliancePairRatio: 0.2,             // fraction of polity pairs → alliances, floor 1
  conflictThresholds: { high: 3, medium: 5, low: 7 },
  allianceThresholds: { high: 3, medium: 5, low: 7 },

  // ── Present ──
  crisisRegionRatio: 0.3,             // fraction of regions affected by crisis, floor 1

  // ── Artifacts ──
  artifactCount: scaled(8, 20),
  artifactScaleFormula: { base: 6, eventFactor: 0.5, regionFactor: 0.5 },

  // ── Character ──
  characterConcepts: { hops: 2, size: 4 },

  // ── Graph Walk ──
  edgeWeights: {
    narrative: 3,
    descriptive: 1,
    preferred: 5,
  },

  // ── Concept Resolvers ──
  defaultCluster: { hops: 2, size: 4 },

  // ── Naming ──
  maxMorphemeAttempts: 10,
  topPalettes: 3,
}
