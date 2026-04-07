/**
 * @import { World } from '../../world.js'
 */

/**
 * Render region prose descriptions as cards.
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderRegionDescriptions(world) {
  const container = document.createElement('div')
  const regions = world.chorogony?.regions ?? []
  const descriptions = /** @type {Map<string, string>} */ (world.renderedRegions)

  for (const region of regions) {
    const prose = descriptions.get(region.id)
    if (!prose) continue

    const card = document.createElement('div')
    card.className = 'entity-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'entity-name'
    nameEl.textContent = region.name
    nameLine.appendChild(nameEl)
    card.appendChild(nameLine)

    const proseEl = document.createElement('div')
    proseEl.className = 'landmark-prose'
    for (const paragraph of prose.split('\n\n')) {
      const p = document.createElement('p')
      p.textContent = paragraph
      proseEl.appendChild(p)
    }
    card.appendChild(proseEl)

    const concepts = document.createElement('span')
    concepts.className = 'entity-concepts'
    concepts.textContent = region.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}
