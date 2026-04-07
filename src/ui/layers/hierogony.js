/**
 * @import { HierogonyData } from '../../hierogony.js'
 * @import { World } from '../../world.js'
 */
import { findAgent } from '../../world.js'
import { renderTagRow } from '../components.js'

/**
 * Render hierogony data as a DOM element.
 * @param {HierogonyData} hierogony
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderHierogony(hierogony, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = hierogony.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Religions
  if (hierogony.religions.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'religions'
    container.appendChild(heading)

    for (const religion of hierogony.religions) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      // Name + origin
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = religion.name
      const originBadge = document.createElement('span')
      originBadge.className = 'badge badge--seed'
      originBadge.textContent = religion.originEvent
      nameLine.append(name, originBadge)
      card.appendChild(nameLine)

      // Worshipped agents
      if (religion.worshippedAgents.length > 0) {
        const agentNames = religion.worshippedAgents
          .map(id => findAgent(world, id)?.name ?? id)
          .join(', ')
        const row = renderTagRow('worships', [agentNames])
        if (row) card.appendChild(row)
      }

      // Peoples
      const peoplesRow = renderTagRow('peoples', religion.peoples)
      if (peoplesRow) card.appendChild(peoplesRow)

      // Rites and taboos
      const ritesRow = renderTagRow('rites', religion.rites)
      if (ritesRow) card.appendChild(ritesRow)
      const taboosRow = renderTagRow('taboos', religion.taboos)
      if (taboosRow) card.appendChild(taboosRow)

      // Concepts
      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = religion.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Heresies
  if (hierogony.heresies.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'heresies'
    container.appendChild(heading)

    for (const heresy of hierogony.heresies) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = heresy.name
      const originBadge = document.createElement('span')
      originBadge.className = 'badge badge--seed'
      originBadge.textContent = heresy.origin
      nameLine.append(name, originBadge)
      card.appendChild(nameLine)

      const deniesRow = renderTagRow('denies', heresy.denies)
      if (deniesRow) card.appendChild(deniesRow)
      const claimsRow = renderTagRow('claims', heresy.claims)
      if (claimsRow) card.appendChild(claimsRow)

      container.appendChild(card)
    }
  }

  // Sacred sites
  if (hierogony.sacredSites.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'sacred sites'
    container.appendChild(heading)

    for (const site of hierogony.sacredSites) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = site.name
      card.appendChild(name)

      const details = document.createElement('div')
      details.className = 'agent-details'
      details.textContent = `landmark: ${site.landmarkName}`
      card.appendChild(details)

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = site.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Practices
  if (hierogony.practices.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'practices'
    container.appendChild(heading)

    for (const practice of hierogony.practices) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = practice.name
      const typeBadge = document.createElement('span')
      typeBadge.className = 'badge badge--seed'
      typeBadge.textContent = practice.type
      nameLine.append(name, typeBadge)
      card.appendChild(nameLine)

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = practice.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  return container
}
