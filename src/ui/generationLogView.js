/**
 * Generation Log View — renders a complete, scrollable log of every event
 * in world generation with before/after state, prose, and notes.
 *
 * @import { World } from '../world.js'
 * @import { ConceptGraph } from '../concepts.js'
 * @import { WorldGenerationLog, GenerationLogEntry } from '../generationLog.js'
 * @import { WorldEvent } from '../timeline.js'
 */
import { buildGenerationLog, saveNote } from '../generationLog.js'
import { createBadge, createJsonToggle, renderBeat, renderTagRow } from './components.js'

// ── Age labels ──

const AGE_LABELS = /** @type {Record<string, string>} */ ({
  creation: 'Age of Creation',
  heroes: 'Age of Heroes',
  current: 'Current Age',
})

// ── Main entry ──

/**
 * Display the generation log for a world.
 * @param {HTMLElement} container
 * @param {World} world
 */
export function displayGenerationLog(container, world) {
  container.innerHTML = ''

  const log = buildGenerationLog(world)

  // Header
  const header = document.createElement('div')
  header.id = 'log-header'
  header.className = 'log-header'

  const seedBadge = createBadge(world.seed, 'seed')
  const recipeBadge = createBadge(world.myth?.recipe ?? '', 'recipe')
  header.append(seedBadge, recipeBadge)

  const copyBtn = document.createElement('button')
  copyBtn.className = 'btn btn--small'
  copyBtn.textContent = 'copy world + notes'
  copyBtn.addEventListener('click', () => {
    const replacer = (/** @type {string} */ _key, /** @type {any} */ value) =>
      value instanceof Map ? Object.fromEntries(value) : value

    const notes = log.entries
      .filter(e => e.notes)
      .map(e => `[${e.event.archetype}] ${e.eventId}\n${e.notes}`)
      .join('\n\n')

    const parts = [
      `# World: ${world.seed} (${world.myth?.recipe ?? 'unknown'})`,
      '',
      '## World JSON',
      '```json',
      JSON.stringify(world, replacer, 2),
      '```',
    ]

    if (notes) {
      parts.push('', '## Notes', '', notes)
    }

    navigator.clipboard.writeText(parts.join('\n'))
    copyBtn.textContent = 'copied!'
    setTimeout(() => { copyBtn.textContent = 'copy world + notes' }, 1500)
  })
  header.appendChild(copyBtn)

  // Layout
  const layout = document.createElement('div')
  layout.className = 'world-layout'

  const tocWrapper = document.createElement('nav')
  tocWrapper.className = 'world-toc-wrapper'
  const toc = document.createElement('div')
  toc.className = 'world-toc'
  tocWrapper.appendChild(toc)

  const content = document.createElement('div')
  content.className = 'world-content'

  // Build TOC and content grouped by age
  let currentAge = ''
  for (const entry of log.entries) {
    const evt = entry.event

    // Age divider in TOC
    if (evt.age !== currentAge) {
      currentAge = evt.age
      const ageHeading = document.createElement('div')
      ageHeading.className = 'toc-age-heading'
      ageHeading.textContent = AGE_LABELS[evt.age] ?? evt.age
      toc.appendChild(ageHeading)

      // Age divider in content
      const ageDivider = document.createElement('div')
      ageDivider.className = 'log-age-divider'
      ageDivider.textContent = AGE_LABELS[evt.age] ?? evt.age
      content.appendChild(ageDivider)
    }

    // TOC link
    const tocLink = document.createElement('a')
    tocLink.className = 'toc-link'
    tocLink.href = `#log-${evt.id}`
    tocLink.textContent = tocLabel(evt)
    toc.appendChild(tocLink)

    // Content section
    const section = renderLogEntry(entry, log.seed)
    content.appendChild(section)
  }

  layout.append(tocWrapper, content)
  container.append(header, layout)
}

/**
 * Short label for TOC.
 * @param {WorldEvent} evt
 * @returns {string}
 */
function tocLabel(evt) {
  // For spawn events, try to include the entity name
  if (evt.spawns.length === 1) {
    const data = /** @type {any} */ (evt.spawns[0].entityData)
    if (data.name) return `${evt.archetype}: ${data.name}`
  }
  return evt.archetype
}

// ── Entry rendering ──

/**
 * Render a single log entry.
 * @param {GenerationLogEntry} entry
 * @param {string} seed
 * @returns {HTMLElement}
 */
function renderLogEntry(entry, seed) {
  const evt = entry.event
  const section = document.createElement('section')
  section.className = 'log-entry'
  section.id = `log-${evt.id}`

  // Header row: archetype + age + epoch + tags
  const headerRow = document.createElement('div')
  headerRow.className = 'log-entry__header'
  headerRow.append(
    createBadge(evt.archetype, 'archetype'),
    createBadge(evt.age, 'age'),
    createBadge(`epoch ${evt.epoch}`, 'epoch'),
  )
  section.appendChild(headerRow)

  // Tags
  if (evt.tags.length > 0) {
    const tagRow = document.createElement('div')
    tagRow.className = 'log-tags'
    for (const tag of evt.tags) {
      tagRow.appendChild(createBadge(tag, 'tag'))
    }
    section.appendChild(tagRow)
  }

  // Concepts
  if (evt.concepts.length > 0) {
    const conceptRow = document.createElement('div')
    conceptRow.className = 'log-concepts'
    for (const c of evt.concepts) {
      const tag = document.createElement('span')
      tag.className = 'concept-tag'
      tag.textContent = c
      conceptRow.appendChild(tag)
    }
    section.appendChild(conceptRow)
  }

  // Beats (if any non-empty)
  const hasBeats = Object.entries(evt.beats).some(
    ([, b]) => Object.keys(b.roles).length > 0 || b.concepts.length > 0
  )
  if (hasBeats) {
    const beatsSection = document.createElement('details')
    beatsSection.className = 'log-collapsible'
    beatsSection.open = true
    const beatsSummary = document.createElement('summary')
    beatsSummary.className = 'log-collapsible__label'
    beatsSummary.textContent = 'Beats'
    beatsSection.appendChild(beatsSummary)
    for (const [name, beat] of Object.entries(evt.beats)) {
      if (Object.keys(beat.roles).length > 0 || beat.concepts.length > 0) {
        beatsSection.appendChild(renderBeat(name, beat))
      }
    }
    section.appendChild(beatsSection)
  }

  // Participants
  if (evt.participants.length > 0) {
    const pRow = renderTagRow('participants', evt.participants)
    if (pRow) section.appendChild(pRow)
  }

  // Caused by
  if (evt.causedBy.length > 0) {
    const cRow = renderTagRow('caused by', evt.causedBy)
    if (cRow) section.appendChild(cRow)
  }

  // State Before
  if (entry.stateBefore.entities.length > 0) {
    section.appendChild(renderStateSection('State Before', entry.stateBefore, false))
  }

  // Spawns + Mutations in State After
  section.appendChild(renderStateAfterSection(entry))

  // Prose
  if (entry.prose.length > 0) {
    const proseSection = document.createElement('details')
    proseSection.className = 'log-collapsible'
    proseSection.open = true
    const proseSummary = document.createElement('summary')
    proseSummary.className = 'log-collapsible__label'
    proseSummary.textContent = `Prose (${entry.prose.length})`
    proseSection.appendChild(proseSummary)

    for (const p of entry.prose) {
      const block = document.createElement('blockquote')
      block.className = 'log-prose'
      const title = document.createElement('div')
      title.className = 'log-prose__title'
      title.append(createBadge(p.type, 'tag'), document.createTextNode(` ${p.title}`))
      const body = document.createElement('div')
      body.className = 'log-prose__body'
      body.textContent = p.body
      block.append(title, body)
      proseSection.appendChild(block)
    }
    section.appendChild(proseSection)
  }

  // Notes
  const notesRow = document.createElement('div')
  notesRow.className = 'log-notes'
  const textarea = document.createElement('textarea')
  textarea.className = 'log-notes__input'
  textarea.placeholder = 'Notes...'
  textarea.value = entry.notes
  textarea.rows = 2

  /** @type {ReturnType<typeof setTimeout>|null} */
  let debounce = null
  textarea.addEventListener('input', () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      entry.notes = textarea.value
      saveNote(seed, entry.eventId, textarea.value)
    }, 300)
  })

  const noteCopyBtn = document.createElement('button')
  noteCopyBtn.className = 'btn btn--small'
  noteCopyBtn.textContent = 'copy'
  noteCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(textarea.value)
    noteCopyBtn.textContent = 'copied!'
    setTimeout(() => { noteCopyBtn.textContent = 'copy' }, 1000)
  })

  notesRow.append(textarea, noteCopyBtn)
  section.appendChild(notesRow)

  // Back to top
  const backToTop = document.createElement('a')
  backToTop.className = 'log-back-to-top'
  backToTop.href = '#log-header'
  backToTop.textContent = '\u2191 back to top'
  section.appendChild(backToTop)

  // Raw event JSON
  section.appendChild(createJsonToggle(evt))

  return section
}

// ── State sections ──

/**
 * Render a state snapshot section.
 * @param {string} label
 * @param {import('../generationLog.js').LogStateSnapshot} snapshot
 * @param {boolean} highlightNew
 * @returns {HTMLElement}
 */
function renderStateSection(label, snapshot, highlightNew) {
  const details = document.createElement('details')
  details.className = 'log-collapsible'
  details.open = true
  const summary = document.createElement('summary')
  summary.className = 'log-collapsible__label'
  summary.textContent = `${label} (${snapshot.entities.length} entities)`
  details.appendChild(summary)

  for (const entity of snapshot.entities) {
    details.appendChild(renderEntityCard(entity, highlightNew))
  }

  return details
}

/**
 * Render the State After section with spawn/mutation annotations.
 * @param {GenerationLogEntry} entry
 * @returns {HTMLElement}
 */
function renderStateAfterSection(entry) {
  const evt = entry.event
  const details = document.createElement('details')
  details.className = 'log-collapsible'
  details.open = true
  const summary = document.createElement('summary')
  summary.className = 'log-collapsible__label'

  const spawnCount = evt.spawns.length
  const mutationCount = evt.mutations.length
  const parts = []
  if (entry.stateAfter.entities.length > 0) parts.push(`${entry.stateAfter.entities.length} entities`)
  if (spawnCount > 0) parts.push(`${spawnCount} new`)
  if (mutationCount > 0) parts.push(`${mutationCount} mutations`)
  summary.textContent = `State After (${parts.join(', ') || 'no changes'})`
  details.appendChild(summary)

  // Show mutations as diffs
  if (mutationCount > 0) {
    const diffBlock = document.createElement('div')
    diffBlock.className = 'log-mutations'
    for (const m of evt.mutations) {
      const line = document.createElement('div')
      line.className = 'log-mutation'
      line.innerHTML = `<span class="log-mutation__entity">${m.entityId}</span>` +
        `<span class="log-mutation__field">.${m.field}</span>: ` +
        `<span class="log-mutation__old">${formatValue(m.previousValue)}</span>` +
        ` \u2192 ` +
        `<span class="log-mutation__new">${formatValue(m.value)}</span>`
      diffBlock.appendChild(line)
    }
    details.appendChild(diffBlock)
  }

  // Show entities
  const spawnIds = new Set(evt.spawns.map(s => s.assignedId))
  for (const entity of entry.stateAfter.entities) {
    const isNew = spawnIds.has(entity.id)
    details.appendChild(renderEntityCard(entity, isNew))
  }

  return details
}

/**
 * Render an entity as a card with key-value pairs + JSON toggle.
 * @param {import('../generationLog.js').LogEntity} entity
 * @param {boolean} isNew
 * @returns {HTMLElement}
 */
function renderEntityCard(entity, isNew) {
  const card = document.createElement('div')
  card.className = isNew ? 'log-entity-card log-entity-card--new' : 'log-entity-card'

  const header = document.createElement('div')
  header.className = 'log-entity-card__header'
  header.append(createBadge(entity.type, 'tag'))
  if (isNew) header.append(createBadge('NEW', 'new'))

  const idSpan = document.createElement('span')
  idSpan.className = 'log-entity-card__id'
  idSpan.textContent = entity.id
  header.appendChild(idSpan)

  // Name if available
  const data = /** @type {any} */ (entity.data)
  if (data.name) {
    const nameSpan = document.createElement('span')
    nameSpan.className = 'log-entity-card__name'
    nameSpan.textContent = data.name
    header.appendChild(nameSpan)
  }

  card.appendChild(header)

  // Key-value pairs (readable format)
  const kvList = document.createElement('dl')
  kvList.className = 'log-entity-kv'
  for (const [key, val] of Object.entries(entity.data)) {
    if (val === null || val === undefined) continue
    const dt = document.createElement('dt')
    dt.textContent = key
    const dd = document.createElement('dd')
    if (Array.isArray(val)) {
      dd.textContent = val.length > 0 ? val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ') : '[]'
    } else if (typeof val === 'object') {
      dd.textContent = JSON.stringify(val)
    } else {
      dd.textContent = String(val)
    }
    kvList.append(dt, dd)
  }
  card.appendChild(kvList)

  // JSON toggle for full raw view
  card.appendChild(createJsonToggle(entity.data))

  return card
}

/**
 * Format a mutation value for display.
 * @param {any} val
 * @returns {string}
 */
function formatValue(val) {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'string') return val
  return JSON.stringify(val)
}
