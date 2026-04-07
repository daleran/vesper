/**
 * @import { CreationMyth } from '../../recipes/index.js'
 */
import { createMetaRow, renderBeat } from '../components.js'

/**
 * Render Layer 0 cosmogony data.
 * @param {CreationMyth} myth
 * @returns {HTMLElement}
 */
export function renderCosmogony(myth) {
  const container = document.createElement('div')

  // World transition
  const transition = document.createElement('div')
  transition.className = 'world-transition'
  transition.textContent = `${myth.worldBefore} \u2192 ${myth.worldAfter}`
  container.appendChild(transition)

  // Four beats
  for (const [name, beat] of /** @type {[string, { roles: Record<string,string>, concepts: string[] }][]} */ ([
    ['before', myth.before],
    ['act', myth.act],
    ['cost', myth.cost],
    ['flaw', myth.flaw],
  ])) {
    container.appendChild(renderBeat(name, beat))
  }

  // Creators / important / bad
  const meta = document.createElement('div')
  meta.className = 'myth-meta'

  for (const [label, items] of /** @type {[string, string[]][]} */ ([
    ['creators', myth.creators],
    ['important', myth.important],
    ['bad', myth.bad],
    ['ingredients', myth.ingredients],
  ])) {
    if (items.length > 0) {
      meta.appendChild(createMetaRow(label, items.join(', ')))
    }
  }

  container.appendChild(meta)

  // Extra fields
  if (Object.keys(myth.extra).length > 0) {
    const extra = document.createElement('div')
    extra.className = 'myth-meta'
    for (const [k, v] of Object.entries(myth.extra)) {
      extra.appendChild(createMetaRow(k, Array.isArray(v) ? v.join(', ') : String(v)))
    }
    container.appendChild(extra)
  }

  return container
}
