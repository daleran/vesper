/**
 * WorldGenerationLog — post-hoc reconstruction of every generation step
 * from the timeline's WorldEvent sequence.
 *
 * Each entry captures the before/after state of affected entities,
 * any associated rendered prose, and a user-editable notes field.
 *
 * @import { World } from './world.js'
 * @import { Timeline, WorldEvent, EntitySpawn } from './timeline.js'
 */

// ── Typedefs ──

/**
 * @typedef {{
 *   id: string,
 *   type: string,
 *   data: object,
 * }} LogEntity
 */

/**
 * @typedef {{
 *   entities: LogEntity[],
 * }} LogStateSnapshot
 */

/**
 * @typedef {{
 *   type: 'mythText' | 'landmark' | 'region',
 *   id: string,
 *   title: string,
 *   body: string,
 * }} AssociatedProse
 */

/**
 * @typedef {{
 *   eventId: string,
 *   event: WorldEvent,
 *   stateBefore: LogStateSnapshot,
 *   stateAfter: LogStateSnapshot,
 *   prose: AssociatedProse[],
 *   notes: string,
 * }} GenerationLogEntry
 */

/**
 * @typedef {{
 *   entries: GenerationLogEntry[],
 *   seed: string,
 * }} WorldGenerationLog
 */

// ── Helpers ──

/**
 * Collect all entity IDs affected by an event (participants + mutation targets + spawn targets).
 * @param {WorldEvent} event
 * @returns {string[]}
 */
function collectAffectedIds(event) {
  const ids = new Set(event.participants)
  for (const m of event.mutations) ids.add(m.entityId)
  for (const s of event.spawns) {
    if (s.assignedId) ids.add(s.assignedId)
  }
  return [...ids]
}

/**
 * Snapshot entities from the rolling state map.
 * @param {Map<string, { type: string, data: object }>} entityMap
 * @param {string[]} ids
 * @returns {LogStateSnapshot}
 */
function snapshotEntities(entityMap, ids) {
  /** @type {LogEntity[]} */
  const entities = []
  for (const id of ids) {
    const entry = entityMap.get(id)
    if (entry) {
      entities.push({
        id,
        type: entry.type,
        data: structuredClone(entry.data),
      })
    }
  }
  return { entities }
}

/**
 * Load notes from localStorage.
 * @param {string} seed
 * @param {string} eventId
 * @returns {string}
 */
function loadNotes(seed, eventId) {
  try {
    return localStorage.getItem(`genlog:${seed}:${eventId}`) ?? ''
  } catch {
    return ''
  }
}

// ── Main builder ──

/**
 * Build a WorldGenerationLog from a completed world.
 * Reconstructs entity state evolution from timeline events.
 * @param {World} world
 * @returns {WorldGenerationLog}
 */
export function buildGenerationLog(world) {
  const timeline = /** @type {Timeline} */ (world.timeline)
  const seed = world.seed

  /** @type {GenerationLogEntry[]} */
  const entries = []

  // Rolling entity state: id → { type, data }
  /** @type {Map<string, { type: string, data: object }>} */
  const entityMap = new Map()

  for (const event of timeline.events) {
    const affectedIds = collectAffectedIds(event)

    // State before: current state of affected entities (before spawns/mutations)
    const stateBefore = snapshotEntities(entityMap, affectedIds)

    // Apply spawns
    for (const spawn of event.spawns) {
      if (spawn.assignedId) {
        entityMap.set(spawn.assignedId, {
          type: spawn.entityType,
          data: structuredClone(spawn.entityData),
        })
      }
    }

    // Apply mutations
    for (const m of event.mutations) {
      const entry = entityMap.get(m.entityId)
      if (entry) {
        /** @type {any} */ (entry.data)[m.field] = m.value
      }
    }

    // State after: updated state of affected entities
    const stateAfter = snapshotEntities(entityMap, affectedIds)

    entries.push({
      eventId: event.id,
      event,
      stateBefore,
      stateAfter,
      prose: [],
      notes: loadNotes(seed, event.id),
    })
  }

  // Associate prose with events, passing entity name map for titles
  associateProse(entries, world, entityMap)

  return { entries, seed }
}

/**
 * Associate rendered prose with the events where entities are created or mutated.
 *
 * Sources:
 * 1. `world.proseLog` — incremental prose snapshots keyed by eventId, generated
 *    at entity creation/mutation time in the age orchestrators.
 * 2. `world.texts` (MythTexts) — matched to events by agent/artifact overlap.
 *
 * @param {GenerationLogEntry[]} entries
 * @param {World} world
 * @param {Map<string, { type: string, data: object }>} entityMap
 */
function associateProse(entries, world, entityMap) {
  const texts = world.texts ?? []
  const proseLog = world.proseLog ?? []

  // Index proseLog by eventId for fast lookup
  /** @type {Map<string, Array<{ entityId: string, type: string, prose: string }>>} */
  const proseByEvent = new Map()
  for (const p of proseLog) {
    let arr = proseByEvent.get(p.eventId)
    if (!arr) {
      arr = []
      proseByEvent.set(p.eventId, arr)
    }
    arr.push(p)
  }

  for (const entry of entries) {
    const evt = entry.event
    const spawnIds = new Set(evt.spawns.map(s => s.assignedId).filter(Boolean))
    const participantIds = new Set(evt.participants)

    // Incremental prose from proseLog → keyed by eventId
    const proseEntries = proseByEvent.get(entry.eventId) ?? []
    for (const p of proseEntries) {
      // Get readable name from entity map (final state of all entities)
      const entityData = entityMap.get(p.entityId)
      const entityName = entityData
        ? /** @type {any} */ (entityData.data).name ?? p.entityId
        : p.entityId
      entry.prose.push({
        type: /** @type {'landmark' | 'region'} */ (p.type),
        id: p.entityId,
        title: entityName,
        body: p.prose,
      })
    }

    // MythTexts → events where their referenced agents/artifacts appear
    for (const text of texts) {
      const agentMatch = (text.referencedAgentIds ?? []).some(
        id => participantIds.has(id) || spawnIds.has(id)
      )
      const artifactMatch = (text.referencedArtifactIds ?? []).some(
        id => spawnIds.has(id)
      )
      if (agentMatch || artifactMatch) {
        entry.prose.push({
          type: 'mythText',
          id: text.id,
          title: text.title,
          body: text.body,
        })
      }
    }
  }
}

/**
 * Save a note to localStorage.
 * @param {string} seed
 * @param {string} eventId
 * @param {string} text
 */
export function saveNote(seed, eventId, text) {
  try {
    if (text) {
      localStorage.setItem(`genlog:${seed}:${eventId}`, text)
    } else {
      localStorage.removeItem(`genlog:${seed}:${eventId}`)
    }
  } catch {
    // localStorage unavailable
  }
}
