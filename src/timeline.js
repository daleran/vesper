/**
 * Timeline — chronological event log spanning three ages of world generation.
 * Pure data structure; no generation logic. Consumed by age simulation modules
 * and the timeline UI renderer.
 *
 * @import { BeatRoles } from './recipes/index.js'
 * @import { MythicEvent, AgentChange } from './history.js'
 */

// ── Typedefs ──

/**
 * @typedef {{
 *   entityId: string,
 *   entityType: string,
 *   field: string,
 *   value: any,
 *   previousValue: any,
 * }} EntityMutation
 */

/**
 * @typedef {{
 *   entityType: string,
 *   entityData: object,
 *   assignedId: string,
 * }} EntitySpawn
 */

/**
 * @typedef {{
 *   id: string,
 *   age: 'creation'|'heroes'|'current',
 *   epoch: number,
 *   archetype: string,
 *   beats: {
 *     situation:   { roles: BeatRoles, concepts: string[] },
 *     action:      { roles: BeatRoles, concepts: string[] },
 *     consequence: { roles: BeatRoles, concepts: string[] },
 *     legacy:      { roles: BeatRoles, concepts: string[] },
 *   },
 *   concepts: string[],
 *   participants: string[],
 *   mutations: EntityMutation[],
 *   spawns: EntitySpawn[],
 *   causedBy: string[],
 *   tags: string[],
 * }} WorldEvent
 */

/**
 * @typedef {{
 *   events: WorldEvent[],
 *   currentAge: 'creation'|'heroes'|'current',
 *   currentEpoch: number,
 * }} Timeline
 */

// ── Factory ──

/**
 * Create an empty Timeline.
 * @returns {Timeline}
 */
export function createTimeline() {
  return {
    events: [],
    currentAge: 'creation',
    currentEpoch: 0,
  }
}

// ── Mutation helpers ──

/**
 * Append an event to the timeline and advance the epoch counter.
 * @param {Timeline} timeline
 * @param {WorldEvent} event
 */
export function addEvent(timeline, event) {
  timeline.events.push(event)
  timeline.currentEpoch = event.epoch + 1
}

/**
 * Advance to a new age and reset the epoch counter.
 * @param {Timeline} timeline
 * @param {'creation'|'heroes'|'current'} age
 */
export function advanceAge(timeline, age) {
  timeline.currentAge = age
  timeline.currentEpoch = 0
}

// ── ID helpers ──

/**
 * Build a deterministic event ID.
 * Format: evt-{age-initial}-{epoch}-{subIndex}
 * Examples: evt-c-0-0, evt-h-3-1, evt-u-2-0
 * @param {'creation'|'heroes'|'current'} age
 * @param {number} epoch
 * @param {number} subIndex
 * @returns {string}
 */
export function makeEventId(age, epoch, subIndex) {
  const AGE_PREFIX = { creation: 'c', heroes: 'h', current: 'u' }
  const initial = AGE_PREFIX[age]
  return `evt-${initial}-${epoch}-${subIndex}`
}

// ── Query helpers ──

/**
 * Return all events for a given age.
 * @param {Timeline} timeline
 * @param {'creation'|'heroes'|'current'} age
 * @returns {WorldEvent[]}
 */
export function getEventsForAge(timeline, age) {
  return timeline.events.filter(e => e.age === age)
}

/**
 * Return all events whose causedBy includes the given event ID.
 * @param {Timeline} timeline
 * @param {string} eventId
 * @returns {WorldEvent[]}
 */
export function getEventsCausedBy(timeline, eventId) {
  return timeline.events.filter(e => e.causedBy.includes(eventId))
}

/**
 * Return all events that involve a given entity — as a participant,
 * a spawn target, or a mutation subject.
 * @param {Timeline} timeline
 * @param {string} entityId
 * @returns {WorldEvent[]}
 */
export function getEntityHistory(timeline, entityId) {
  return timeline.events.filter(e =>
    e.participants.includes(entityId) ||
    e.spawns.some(s => s.assignedId === entityId) ||
    e.mutations.some(m => m.entityId === entityId)
  )
}

// ── Beat helpers ──

/**
 * Return an empty beat object (for events that don't use all four beats).
 * @returns {{ roles: BeatRoles, concepts: string[] }}
 */
export function emptyBeat() {
  return { roles: {}, concepts: [] }
}

/**
 * Return an empty full-beats object.
 * @returns {WorldEvent['beats']}
 */
export function emptyBeats() {
  return {
    situation:   emptyBeat(),
    action:      emptyBeat(),
    consequence: emptyBeat(),
    legacy:      emptyBeat(),
  }
}

// ── Adapter ──

/**
 * Convert an existing MythicEvent (from history.js) to a WorldEvent.
 * Maps agentChanges → mutations, spawned seeds → spawns,
 * and extracts participants from beat roles.
 * @param {MythicEvent} event
 * @param {number} epoch
 * @param {string} causedById  — ID of the event that caused this one
 * @returns {WorldEvent}
 */
export function eventFromMythicEvent(event, epoch, causedById) {
  /** @type {EntityMutation[]} */
  const mutations = []
  /** @type {EntitySpawn[]} */
  const spawns = []

  for (const change of event.agentChanges) {
    if (change.spawned) {
      // Spawned agent — will get its ID assigned later; use placeholder
      spawns.push({
        entityType: 'agent',
        entityData: change.spawned,
        assignedId: '',  // filled in by creation.js after generateHistory runs
      })
    } else {
      if (change.newState !== undefined) {
        mutations.push({
          entityId: change.agentId,
          entityType: 'agent',
          field: 'state',
          value: change.newState,
          previousValue: null,
        })
      }
      if (change.newType !== undefined) {
        mutations.push({
          entityId: change.agentId,
          entityType: 'agent',
          field: 'type',
          value: change.newType,
          previousValue: null,
        })
      }
    }
  }

  // Extract agent IDs from beat roles as participants
  const participants = new Set(/** @type {string[]} */ ([]))
  for (const beat of [event.situation, event.action, event.consequence, event.legacy]) {
    for (const val of Object.values(beat.roles)) {
      if (typeof val === 'string' && val.startsWith('agent-')) {
        participants.add(val)
      }
    }
  }

  return {
    id: makeEventId('creation', epoch, 0),
    age: 'creation',
    epoch,
    archetype: event.archetype,
    beats: {
      situation:   event.situation,
      action:      event.action,
      consequence: event.consequence,
      legacy:      event.legacy,
    },
    concepts: event.concepts,
    participants: [...participants],
    mutations,
    spawns,
    causedBy: causedById ? [causedById] : [],
    tags: ['mythic'],
  }
}
