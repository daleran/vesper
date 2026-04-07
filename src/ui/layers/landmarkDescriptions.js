/**
 * @import { World } from '../../world.js'
 */

/**
 * Render landmark prose descriptions as cards.
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderLandmarkDescriptions(world) {
  const container = document.createElement('div')
  const landmarks = world.geogony?.landmarks ?? []
  const descriptions = /** @type {Map<string, string>} */ (world.renderedLandmarks)

  for (const landmark of landmarks) {
    const prose = descriptions.get(landmark.id)
    if (!prose) continue

    const card = document.createElement('div')
    card.className = 'entity-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'entity-name'
    nameEl.textContent = landmark.name
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
    concepts.textContent = landmark.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}
