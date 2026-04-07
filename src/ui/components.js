/**
 * Shared UI component helpers used by both Legends and Game modes.
 */

/**
 * Create a labeled meta row (label: value).
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
export function createMetaRow(label, value) {
  const row = document.createElement('div')
  row.className = 'meta-row'
  const lbl = document.createElement('span')
  lbl.className = 'meta-label'
  lbl.textContent = label
  const val = document.createElement('span')
  val.className = 'meta-value'
  val.textContent = value
  row.append(lbl, val)
  return row
}

/**
 * Render a beat's roles as a definition list + concepts as badge row.
 * @param {string} beatName
 * @param {{ roles: Record<string, string>, concepts: string[] }} beat
 * @returns {HTMLElement}
 */
export function renderBeat(beatName, beat) {
  const section = document.createElement('div')
  section.className = 'beat-section'

  const heading = document.createElement('h4')
  heading.className = 'beat-heading'
  heading.textContent = beatName

  const dl = document.createElement('dl')
  dl.className = 'beat-roles'
  for (const [key, val] of Object.entries(beat.roles)) {
    const dt = document.createElement('dt')
    dt.className = 'beat-role-key'
    dt.textContent = key

    const dd = document.createElement('dd')
    dd.className = 'beat-role-value'
    dd.textContent = val

    dl.append(dt, dd)
  }

  section.append(heading, dl)

  if (beat.concepts.length > 0) {
    const row = document.createElement('div')
    row.className = 'concept-row'
    for (const c of beat.concepts) {
      const tag = document.createElement('span')
      tag.className = 'concept-tag'
      tag.textContent = c
      row.appendChild(tag)
    }
    section.appendChild(row)
  }

  return section
}

/**
 * Create a collapsible JSON toggle for a data object.
 * @param {object} data
 * @returns {HTMLElement}
 */
export function createJsonToggle(data) {
  const wrapper = document.createElement('div')
  wrapper.className = 'json-section'

  const toggle = document.createElement('button')
  toggle.className = 'json-toggle'
  toggle.textContent = '{ } json'

  const body = document.createElement('pre')
  body.className = 'json-body'

  let loaded = false
  toggle.addEventListener('click', () => {
    if (!loaded) {
      body.textContent = JSON.stringify(data, null, 2)
      loaded = true
    }
    const open = body.classList.toggle('open')
    toggle.classList.toggle('open', open)
  })

  wrapper.append(toggle, body)
  return wrapper
}

/**
 * Create a layer panel (collapsible details element).
 * @param {string} title
 * @param {boolean} [open]
 * @returns {{ panel: HTMLDetailsElement, body: HTMLDivElement }}
 */
export function createLayerPanel(title, open = true) {
  const panel = document.createElement('details')
  panel.className = 'layer-panel'
  panel.open = open

  const summary = document.createElement('summary')
  summary.className = 'layer-heading'
  summary.textContent = title

  const body = document.createElement('div')
  body.className = 'layer-body'

  panel.append(summary, body)
  return { panel, body }
}

/**
 * Render a labeled tag row (label + values as text).
 * @param {string} label
 * @param {string[]} items
 * @returns {HTMLElement|null}
 */
export function renderTagRow(label, items) {
  if (items.length === 0) return null
  const row = document.createElement('div')
  row.className = 'agent-details'
  row.textContent = `${label}: ${items.join(', ')}`
  return row
}

/**
 * Create a badge element.
 * @param {string} text
 * @param {string} [variant] - CSS modifier (e.g. 'recipe', 'seed', 'god')
 * @returns {HTMLSpanElement}
 */
export function createBadge(text, variant) {
  const badge = document.createElement('span')
  badge.className = variant ? `badge badge--${variant}` : 'badge'
  badge.textContent = text
  return badge
}

