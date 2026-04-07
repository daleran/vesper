/**
 * @import { BiogonyData } from '../../world.js'
 * @import { World } from '../../world.js'
 */
import { findAgent } from '../../world.js'
import { createMetaRow } from '../components.js'

/**
 * Render biogony data as a DOM element.
 * @param {BiogonyData} biogony
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderBiogony(biogony, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = biogony.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Origin agent
  const meta = document.createElement('div')
  meta.className = 'myth-meta'

  if (biogony.lifeOriginAgent !== null) {
    const agent = findAgent(world, biogony.lifeOriginAgent)
    if (agent) {
      meta.appendChild(createMetaRow('life created by', agent.name))
    }
  }

  container.appendChild(meta)

  // Lifeforms
  if (biogony.lifeforms.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'lifeforms'
    container.appendChild(heading)

    for (const lf of biogony.lifeforms) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = lf.name

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = lf.concepts.join(', ')

      const detail = document.createElement('span')
      detail.className = 'region-tagged-by'
      const parts = [lf.behavior, lf.origin]
      if (lf.terrainAffinity.length > 0) {
        parts.push(lf.terrainAffinity.join(', '))
      }
      detail.textContent = parts.join(' \u00b7 ')

      card.append(name, concepts, detail)
      container.appendChild(card)
    }
  }

  // Flaw life
  if (biogony.flawLife.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'flaw life'
    container.appendChild(heading)

    const row = document.createElement('div')
    row.className = 'concept-row'
    for (const lf of biogony.flawLife) {
      const tag = document.createElement('span')
      tag.className = 'concept-tag'
      tag.textContent = `${lf.name} (${lf.behavior})`
      row.appendChild(tag)
    }
    container.appendChild(row)
  }

  // Extinctions
  if (biogony.extinctions.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'extinctions'
    container.appendChild(heading)

    const row = document.createElement('div')
    row.className = 'concept-row'
    for (const ext of biogony.extinctions) {
      const tag = document.createElement('span')
      tag.className = 'concept-tag'
      tag.textContent = ext
      row.appendChild(tag)
    }
    container.appendChild(row)
  }

  return container
}
