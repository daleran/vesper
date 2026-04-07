/**
 * @import { PresentData } from '../../present.js'
 * @import { World } from '../../world.js'
 */
import { findAgent, findPolity, findReligion, findRegion, findEntity } from '../../world.js'
import { renderTagRow } from '../components.js'

/**
 * Render present-layer data as a DOM element.
 * @param {PresentData} present
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderPresent(present, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = present.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Crisis
  {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'crisis'
    container.appendChild(heading)

    const card = document.createElement('div')
    card.className = 'entity-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const name = document.createElement('span')
    name.className = 'entity-name'
    name.textContent = present.crisis.name
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = present.crisis.type
    const sevBadge = document.createElement('span')
    sevBadge.className = 'badge badge--seed'
    sevBadge.textContent = present.crisis.severity
    nameLine.append(name, typeBadge, sevBadge)
    card.appendChild(nameLine)

    // Affected regions
    if (present.crisis.affectedRegionIds.length > 0) {
      const regionNames = present.crisis.affectedRegionIds.map(rid => {
        const region = findRegion(world, rid)
        return region?.name ?? rid
      })
      const regionsRow = renderTagRow('affected regions', regionNames)
      if (regionsRow) card.appendChild(regionsRow)
    }

    // Flaw connection
    const flawRow = renderTagRow('flaw connection', present.crisis.flawConnection)
    if (flawRow) card.appendChild(flawRow)

    const concepts = document.createElement('span')
    concepts.className = 'entity-concepts'
    concepts.textContent = present.crisis.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  // Factions
  if (present.factions.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'factions'
    container.appendChild(heading)

    for (const faction of present.factions) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = faction.name
      const approachBadge = document.createElement('span')
      approachBadge.className = 'badge badge--recipe'
      approachBadge.textContent = faction.approach
      const strengthBadge = document.createElement('span')
      strengthBadge.className = 'badge badge--seed'
      strengthBadge.textContent = faction.strength
      nameLine.append(name, approachBadge, strengthBadge)
      card.appendChild(nameLine)

      // Member polities
      if (faction.polityIds.length > 0) {
        const polityNames = faction.polityIds.map(id =>
          findPolity(world, id)?.name ?? id
        )
        const polityRow = renderTagRow('polities', polityNames)
        if (polityRow) card.appendChild(polityRow)
      }

      // Leader agent
      if (faction.leaderAgentId) {
        const agent = findAgent(world, faction.leaderAgentId)
        const leaderRow = renderTagRow('leader', [agent?.name ?? faction.leaderAgentId])
        if (leaderRow) card.appendChild(leaderRow)
      }

      // Religions
      if (faction.religionIds.length > 0) {
        const religionNames = faction.religionIds.map(id =>
          findReligion(world, id)?.name ?? id
        )
        const relRow = renderTagRow('religions', religionNames)
        if (relRow) card.appendChild(relRow)
      }

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = faction.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Recent Event
  {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'recent event'
    container.appendChild(heading)

    const card = document.createElement('div')
    card.className = 'entity-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const name = document.createElement('span')
    name.className = 'entity-name'
    name.textContent = present.recentEvent.name
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = present.recentEvent.type
    nameLine.append(name, typeBadge)
    card.appendChild(nameLine)

    // Involved entities
    if (present.recentEvent.involvedEntityIds.length > 0) {
      const entityNames = present.recentEvent.involvedEntityIds.map(id => {
        const result = findEntity(world, id)
        return result ? /** @type {*} */ (result.entity).name : id
      })
      const entRow = renderTagRow('involves', entityNames)
      if (entRow) card.appendChild(entRow)
    }

    // Region
    if (present.recentEvent.regionId) {
      const region = findRegion(world, present.recentEvent.regionId)
      const regRow = renderTagRow('location', [region?.name ?? present.recentEvent.regionId])
      if (regRow) card.appendChild(regRow)
    }

    const concepts = document.createElement('span')
    concepts.className = 'entity-concepts'
    concepts.textContent = present.recentEvent.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  // Active Powers
  if (present.activePowers.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'active powers'
    container.appendChild(heading)

    for (const power of present.activePowers) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const agent = findAgent(world, power.agentId)
      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = agent?.name ?? power.agentId
      const actionBadge = document.createElement('span')
      actionBadge.className = 'badge badge--seed'
      actionBadge.textContent = power.currentAction
      nameLine.append(name, actionBadge)
      card.appendChild(nameLine)

      // Faction alignment
      if (power.factionAlignment) {
        const faction = present.factions.find(f => f.id === power.factionAlignment)
        const facRow = renderTagRow('faction', [faction?.name ?? power.factionAlignment])
        if (facRow) card.appendChild(facRow)
      }

      // Region
      if (power.regionId) {
        const region = findRegion(world, power.regionId)
        const regRow = renderTagRow('location', [region?.name ?? power.regionId])
        if (regRow) card.appendChild(regRow)
      }

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = power.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Rumors
  if (present.rumors.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'rumors'
    container.appendChild(heading)

    for (const rumor of present.rumors) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const claim = document.createElement('span')
      claim.className = 'entity-name'
      claim.textContent = rumor.claim
      const truthBadge = document.createElement('span')
      truthBadge.className = 'badge badge--seed'
      truthBadge.textContent = rumor.isTrue ? 'true' : 'false'
      nameLine.append(claim, truthBadge)
      if (rumor.distortion) {
        const distBadge = document.createElement('span')
        distBadge.className = 'badge badge--recipe'
        distBadge.textContent = rumor.distortion
        nameLine.appendChild(distBadge)
      }
      card.appendChild(nameLine)

      const refRow = renderTagRow('about', [`${rumor.referencedEntityType}: ${rumor.referencedEntityId}`])
      if (refRow) card.appendChild(refRow)

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = rumor.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Hidden Truth
  if (present.hiddenTruth.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'hidden truth'
    container.appendChild(heading)

    const card = document.createElement('div')
    card.className = 'entity-card'
    const chain = document.createElement('span')
    chain.className = 'entity-concepts'
    chain.textContent = present.hiddenTruth.join(' \u2192 ')
    card.appendChild(chain)
    container.appendChild(card)
  }

  return container
}
