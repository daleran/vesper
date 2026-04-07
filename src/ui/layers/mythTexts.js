/**
 * @import { MythText } from '../../renderers/mythTexts.js'
 * @import { World } from '../../world.js'
 */
import { findAgent } from '../../world.js'
import { renderTagRow } from '../components.js'

/**
 * Render myth texts as cards.
 * @param {MythText[]} texts
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderMythTexts(texts, world) {
  const container = document.createElement('div')

  for (const text of texts) {
    const card = document.createElement('div')
    card.className = 'entity-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'entity-name'
    nameEl.textContent = text.title
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = text.type
    const perspBadge = document.createElement('span')
    perspBadge.className = 'badge badge--seed'
    perspBadge.textContent = text.perspective
    nameLine.append(nameEl, typeBadge, perspBadge)
    card.appendChild(nameLine)

    const bodyEl = document.createElement('p')
    bodyEl.className = 'text-body'
    bodyEl.textContent = text.body
    card.appendChild(bodyEl)

    if (text.referencedAgentIds.length > 0) {
      const names = text.referencedAgentIds
        .map(id => findAgent(world, id)?.name ?? id)
      const row = renderTagRow('agents', names)
      if (row) card.appendChild(row)
    }

    if (text.referencedArtifactIds.length > 0) {
      const names = text.referencedArtifactIds
        .map(id => (world.artifacts ?? []).find(a => a.id === id)?.name ?? id)
      const row = renderTagRow('artifacts', names)
      if (row) card.appendChild(row)
    }

    const concepts = document.createElement('span')
    concepts.className = 'entity-concepts'
    concepts.textContent = text.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}
