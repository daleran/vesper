/**
 * Timeline renderer — displays WorldEvents grouped by age in Legends Mode.
 * Shows causal chain links, entity spawns, and mutations.
 *
 * @import { Timeline, WorldEvent } from '../../timeline.js'
 * @import { World } from '../../world.js'
 */
import { getEventsForAge, getEventsCausedBy, getEntityHistory } from '../../timeline.js'
import { findEntity } from '../../world.js'

// ── Helpers ──

/**
 * Build a clickable entity link chip using the delegation pattern in legends.js.
 * Data attributes are picked up by the rightPane click handler.
 * @param {string} label
 * @param {string} entityType
 * @param {string} entityId
 * @returns {HTMLElement}
 */
function entityLink(label, entityType, entityId) {
  const el = document.createElement('button')
  el.className = 'entity-link'
  el.textContent = label
  el.dataset['entityId'] = entityId
  el.dataset['entityType'] = entityType
  return el
}

/**
 * Build a clickable event link chip.
 * @param {string} eventId
 * @param {Timeline} timeline
 * @returns {HTMLElement}
 */
function eventLink(eventId, timeline) {
  const evt = timeline.events.find(e => e.id === eventId)
  const label = evt ? `${evt.archetype} (epoch ${evt.epoch})` : eventId
  return entityLink(label, 'timeline-event', eventId)
}

/**
 * Render concept tags as pill spans.
 * @param {string[]} concepts
 * @returns {HTMLElement}
 */
function conceptPills(concepts) {
  const el = document.createElement('div')
  el.className = 'concept-tags'
  for (const c of concepts.slice(0, 8)) {
    const pill = document.createElement('span')
    pill.className = 'concept-tag'
    pill.textContent = c
    el.appendChild(pill)
  }
  return el
}

// ── Single event card ──

/**
 * Render a single WorldEvent as an expandable card.
 * @param {WorldEvent} event
 * @param {Timeline} timeline
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderTimelineEvent(event, timeline, world) {
  const card = document.createElement('div')
  card.className = 'timeline-event-card'

  // Header row: archetype badge + epoch
  const header = document.createElement('div')
  header.className = 'timeline-event-header'

  const badge = document.createElement('span')
  badge.className = `badge badge--${event.tags[0] ?? 'default'}`
  badge.textContent = event.archetype

  const epochLabel = document.createElement('span')
  epochLabel.className = 'timeline-event-epoch'
  epochLabel.textContent = `epoch ${event.epoch}`

  header.append(badge, epochLabel)
  card.appendChild(header)

  // Concepts
  if (event.concepts.length > 0) {
    card.appendChild(conceptPills(event.concepts))
  }

  // Participants
  if (event.participants.length > 0) {
    const row = document.createElement('div')
    row.className = 'timeline-event-row'
    const label = document.createElement('span')
    label.className = 'timeline-event-label'
    label.textContent = 'participants'
    row.appendChild(label)
    for (const id of event.participants) {
      const found = findEntity(world, id)
      const name = found ? (/** @type {any} */ (found.entity).name ?? id) : id
      row.appendChild(entityLink(name, found?.type ?? 'agent', id))
    }
    card.appendChild(row)
  }

  // Caused by
  if (event.causedBy.length > 0) {
    const row = document.createElement('div')
    row.className = 'timeline-event-row'
    const label = document.createElement('span')
    label.className = 'timeline-event-label'
    label.textContent = 'caused by'
    row.appendChild(label)
    for (const id of event.causedBy) {
      row.appendChild(eventLink(id, timeline))
    }
    card.appendChild(row)
  }

  // Led to (downstream events)
  const downstream = getEventsCausedBy(timeline, event.id)
  if (downstream.length > 0) {
    const row = document.createElement('div')
    row.className = 'timeline-event-row'
    const label = document.createElement('span')
    label.className = 'timeline-event-label'
    label.textContent = 'led to'
    row.appendChild(label)
    for (const d of downstream.slice(0, 5)) {
      row.appendChild(eventLink(d.id, timeline))
    }
    card.appendChild(row)
  }

  // Spawns
  if (event.spawns.length > 0) {
    const row = document.createElement('div')
    row.className = 'timeline-event-row'
    const label = document.createElement('span')
    label.className = 'timeline-event-label'
    label.textContent = 'created'
    row.appendChild(label)
    for (const spawn of event.spawns) {
      const name = /** @type {any} */ (spawn.entityData)?.name ?? spawn.entityType
      if (spawn.assignedId) {
        row.appendChild(entityLink(name, spawn.entityType, spawn.assignedId))
      } else {
        const chip = document.createElement('span')
        chip.className = 'entity-link entity-link--unlinked'
        chip.textContent = name
        row.appendChild(chip)
      }
    }
    card.appendChild(row)
  }

  // Mutations
  if (event.mutations.length > 0) {
    const row = document.createElement('div')
    row.className = 'timeline-event-row'
    const label = document.createElement('span')
    label.className = 'timeline-event-label'
    label.textContent = 'changed'
    row.appendChild(label)
    for (const m of event.mutations.slice(0, 5)) {
      const found = findEntity(world, m.entityId)
      const name = found ? (/** @type {any} */ (found.entity).name ?? m.entityId) : m.entityId
      const chip = document.createElement('span')
      chip.className = 'timeline-mutation-chip'
      chip.textContent = `${name}.${m.field} → ${m.value}`
      row.appendChild(chip)
    }
    card.appendChild(row)
  }

  return card
}

// ── Entity history ──

/**
 * Render a "History" section listing all events involving a given entity.
 * Appended to entity detail views.
 * @param {string} entityId
 * @param {Timeline} timeline
 * @param {World} _world
 * @returns {HTMLElement | null}
 */
export function renderEntityTimeline(entityId, timeline, _world) {
  const events = getEntityHistory(timeline, entityId)
  if (events.length === 0) return null

  const section = document.createElement('div')
  section.className = 'entity-timeline-section'

  const heading = document.createElement('h4')
  heading.className = 'entity-timeline-heading'
  heading.textContent = 'History'
  section.appendChild(heading)

  for (const evt of events) {
    const row = document.createElement('div')
    row.className = 'entity-timeline-row'

    const ageLabel = document.createElement('span')
    ageLabel.className = `timeline-age-label timeline-age-label--${evt.age}`
    ageLabel.textContent = evt.age

    const link = entityLink(`${evt.archetype} (epoch ${evt.epoch})`, 'timeline-event', evt.id)
    link.className = 'entity-link entity-link--event'

    row.append(ageLabel, link)
    section.appendChild(row)
  }

  return section
}

// ── Full timeline panel ──

/**
 * Render the full timeline panel grouped by age.
 * @param {Timeline} timeline
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderTimeline(timeline, world) {
  const container = document.createElement('div')
  container.className = 'timeline-panel'

  const ages = /** @type {const} */ (['creation', 'heroes', 'current'])
  const ageLabels = {
    creation: 'Age of Creation',
    heroes: 'Age of Heroes',
    current: 'Current Age',
  }

  for (const age of ages) {
    const events = getEventsForAge(timeline, age)
    if (events.length === 0) continue

    const section = document.createElement('details')
    section.className = 'timeline-age-section'
    section.open = age === 'creation'

    const summary = document.createElement('summary')
    summary.className = 'timeline-age-summary'
    summary.textContent = `${ageLabels[age]} (${events.length} events)`
    section.appendChild(summary)

    const list = document.createElement('div')
    list.className = 'timeline-event-list'

    for (const evt of events) {
      // Each event is a collapsible <details> so the list stays scannable
      const evtDetails = document.createElement('details')
      evtDetails.className = 'timeline-event-details'

      const evtSummary = document.createElement('summary')
      evtSummary.className = 'timeline-event-summary'

      const archBadge = document.createElement('span')
      archBadge.className = `badge badge--${evt.tags[0] ?? 'default'}`
      archBadge.textContent = evt.archetype

      const epochSpan = document.createElement('span')
      epochSpan.className = 'timeline-event-epoch'
      epochSpan.textContent = `epoch ${evt.epoch}`

      // Navigate when summary is clicked without opening details
      evtSummary.addEventListener('click', e => {
        e.preventDefault()
        evtDetails.open = !evtDetails.open
      })

      evtSummary.append(archBadge, epochSpan)
      if (evt.concepts.length > 0) {
        evtSummary.appendChild(conceptPills(evt.concepts.slice(0, 4)))
      }
      evtDetails.appendChild(evtSummary)
      evtDetails.appendChild(renderTimelineEvent(evt, timeline, world))
      list.appendChild(evtDetails)
    }

    section.appendChild(list)
    container.appendChild(section)
  }

  return container
}
