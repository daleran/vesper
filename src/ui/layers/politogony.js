/**
 * @import { PolitogonyData } from '../../politogony.js'
 * @import { World } from '../../world.js'
 */
import { findAgent, findReligion, findRegion } from '../../world.js'
import { renderTagRow } from '../components.js'

/**
 * Render politogony data as a DOM element.
 * @param {PolitogonyData} politogony
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderPolitogony(politogony, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = politogony.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Polities
  if (politogony.polities.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'polities'
    container.appendChild(heading)

    for (const polity of politogony.polities) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      // Name + state + governance badges
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = polity.name
      const stateBadge = document.createElement('span')
      stateBadge.className = 'badge badge--seed'
      stateBadge.textContent = polity.state
      const govBadge = document.createElement('span')
      govBadge.className = 'badge badge--recipe'
      govBadge.textContent = polity.governanceType
      nameLine.append(name, stateBadge, govBadge)
      card.appendChild(nameLine)

      // People
      const peopleRow = renderTagRow('people', [polity.peopleId])
      if (peopleRow) card.appendChild(peopleRow)

      // Patron agent
      if (polity.patronAgentId) {
        const agent = findAgent(world, polity.patronAgentId)
        const patronRow = renderTagRow('patron', [agent?.name ?? polity.patronAgentId])
        if (patronRow) card.appendChild(patronRow)
      }

      // Religion
      if (polity.religionId) {
        const religion = findReligion(world, polity.religionId)
        const religionRow = renderTagRow('religion', [religion?.name ?? polity.religionId])
        if (religionRow) card.appendChild(religionRow)
      }

      // Regions
      if (polity.regionIds.length > 0) {
        const regionNames = polity.regionIds.map(rid => {
          const region = findRegion(world, rid)
          return region?.name ?? rid
        })
        const regionsRow = renderTagRow('regions', regionNames)
        if (regionsRow) card.appendChild(regionsRow)
      }

      // Resources
      const resourcesRow = renderTagRow('resources', polity.resources)
      if (resourcesRow) card.appendChild(resourcesRow)

      // Concepts
      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = polity.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Conflicts
  if (politogony.conflicts.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'conflicts'
    container.appendChild(heading)

    for (const conflict of politogony.conflicts) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = conflict.name
      const intensityBadge = document.createElement('span')
      intensityBadge.className = 'badge badge--seed'
      intensityBadge.textContent = conflict.intensity
      const causeBadge = document.createElement('span')
      causeBadge.className = 'badge badge--recipe'
      causeBadge.textContent = conflict.cause
      nameLine.append(name, intensityBadge, causeBadge)
      card.appendChild(nameLine)

      const polityNames = conflict.polityIds.map(id =>
        politogony.polities.find(p => p.id === id)?.name ?? id
      )
      const partiesRow = renderTagRow('between', polityNames)
      if (partiesRow) card.appendChild(partiesRow)

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = conflict.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Alliances
  if (politogony.alliances.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'alliances'
    container.appendChild(heading)

    for (const alliance of politogony.alliances) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = alliance.name
      const basisBadge = document.createElement('span')
      basisBadge.className = 'badge badge--seed'
      basisBadge.textContent = alliance.basis
      nameLine.append(name, basisBadge)
      card.appendChild(nameLine)

      const polityNames = alliance.polityIds.map(id =>
        politogony.polities.find(p => p.id === id)?.name ?? id
      )
      const membersRow = renderTagRow('members', polityNames)
      if (membersRow) card.appendChild(membersRow)

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = alliance.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Ruins
  if (politogony.ruins.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'ruins'
    container.appendChild(heading)

    for (const ruin of politogony.ruins) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = ruin.name
      const formerPolity = politogony.polities.find(p => p.id === ruin.formerPolityId)
      const formerBadge = document.createElement('span')
      formerBadge.className = 'badge badge--seed'
      formerBadge.textContent = `former: ${formerPolity?.name ?? ruin.formerPolityId}`
      nameLine.append(name, formerBadge)
      card.appendChild(nameLine)

      const regionObj = findRegion(world, ruin.regionId)
      if (regionObj) {
        const regionRow = renderTagRow('region', [regionObj.name])
        if (regionRow) card.appendChild(regionRow)
      }

      const remainsRow = renderTagRow('remains', ruin.whatRemains)
      if (remainsRow) card.appendChild(remainsRow)

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = ruin.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Legends
  if (politogony.legends.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'legends'
    container.appendChild(heading)

    for (const legend of politogony.legends) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const polity = politogony.polities.find(p => p.id === legend.polityId)
      const polityName = document.createElement('span')
      polityName.className = 'entity-name'
      polityName.textContent = polity?.name ?? legend.polityId
      const interpBadge = document.createElement('span')
      interpBadge.className = 'badge badge--seed'
      interpBadge.textContent = legend.interpretation
      nameLine.append(polityName, interpBadge)
      card.appendChild(nameLine)

      const event = world.events[legend.eventIndex]
      if (event) {
        const eventRow = renderTagRow('event', [`#${legend.eventIndex}: ${event.archetype}`])
        if (eventRow) card.appendChild(eventRow)
      }

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = legend.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  return container
}
