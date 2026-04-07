/**
 * @import { ChorogonyData } from '../../world.js'
 * @import { World } from '../../world.js'
 */
import { renderTagRow } from '../components.js'

/**
 * Render chorogony data as a DOM element.
 * @param {ChorogonyData} chorogony
 * @param {World} _world
 * @returns {HTMLElement}
 */
export function renderChorogony(chorogony, _world) {
  const container = document.createElement('div')

  for (const region of chorogony.regions) {
    const card = document.createElement('div')
    card.className = 'entity-card'

    // Name
    const name = document.createElement('span')
    name.className = 'entity-name'
    name.textContent = region.name
    card.appendChild(name)

    // Concepts
    const concepts = document.createElement('span')
    concepts.className = 'entity-concepts'
    concepts.textContent = region.concepts.join(', ')
    card.appendChild(concepts)

    // Terrain, peoples, lifeforms, landmarks, resources, dangers, mood, climate
    for (const [label, items] of /** @type {[string, string[]][]} */ ([
      ['terrain', region.terrainTypes],
      ['peoples', region.peoples],
      ['lifeforms', region.lifeforms],
      ['landmarks', region.landmarks],
      ['resources', region.resources],
      ['dangers', region.dangers],
      ['mood', region.mood],
      ['climate', region.climate],
    ])) {
      const row = renderTagRow(label, items)
      if (row) card.appendChild(row)
    }

    // Tagged by events
    if (region.taggedBy.length > 0) {
      const taggedEl = document.createElement('span')
      taggedEl.className = 'region-tagged-by'
      taggedEl.textContent = `events: ${region.taggedBy.join(', ')}`
      card.appendChild(taggedEl)
    }

    container.appendChild(card)
  }

  return container
}
