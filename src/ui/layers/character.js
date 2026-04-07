/**
 * @import { PlayerCharacter } from '../../character.js'
 * @import { World } from '../../world.js'
 */
import { findAgent, findRegion, findEntity } from '../../world.js'
import { renderTagRow } from '../components.js'

/**
 * Render the character panel.
 * @param {PlayerCharacter} character
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderCharacter(character, world) {
  const container = document.createElement('div')
  const card = document.createElement('div')
  card.className = 'entity-card'

  // Header: creator god name + title
  const nameLine = document.createElement('div')
  nameLine.className = 'agent-name-line'
  const creatorAgent = findAgent(world, character.creatorGod)
  const godName = document.createElement('span')
  godName.className = 'entity-name'
  godName.textContent = creatorAgent ? `${creatorAgent.name}, ${creatorAgent.title}` : character.creatorGod
  const godBadge = document.createElement('span')
  godBadge.className = 'badge badge--recipe'
  godBadge.textContent = creatorAgent?.type ?? 'creator'
  nameLine.append(godName, godBadge)
  card.appendChild(nameLine)

  // Arrival
  const arrivalHeader = document.createElement('h4')
  arrivalHeader.textContent = 'arrival'
  card.appendChild(arrivalHeader)

  const arrivalRegion = findRegion(world, character.arrival.regionId)
  const arrivalParts = /** @type {string[]} */ ([])
  if (arrivalRegion) arrivalParts.push(arrivalRegion.name)
  if (character.arrival.landmarkId) {
    const landmark = (world.geogony?.landmarks ?? []).find(l => l.id === character.arrival.landmarkId)
    if (landmark) arrivalParts.push(landmark.name)
  }
  const arrivalRow = renderTagRow('location', arrivalParts)
  if (arrivalRow) card.appendChild(arrivalRow)

  const descEl = document.createElement('p')
  descEl.className = 'landmark-prose'
  descEl.textContent = character.arrival.description
  card.appendChild(descEl)

  // Appearance
  const appearHeader = document.createElement('h4')
  appearHeader.textContent = 'appearance'
  card.appendChild(appearHeader)

  const normalcyBadge = document.createElement('span')
  normalcyBadge.className = 'badge badge--seed'
  normalcyBadge.textContent = character.appearance.normalcy
  card.appendChild(normalcyBadge)

  if (character.appearance.details.length > 0) {
    const detailsRow = renderTagRow('traits', character.appearance.details)
    if (detailsRow) card.appendChild(detailsRow)
  }

  // Instincts
  if (character.instincts.length > 0) {
    const instHeader = document.createElement('h4')
    instHeader.textContent = 'instincts'
    card.appendChild(instHeader)
    const instRow = renderTagRow('', character.instincts)
    if (instRow) {
      instRow.className = 'agent-details'
      instRow.textContent = character.instincts.join('; ')
      card.appendChild(instRow)
    }
  }

  // Reactions
  const reactHeader = document.createElement('h4')
  reactHeader.textContent = 'reactions'
  card.appendChild(reactHeader)
  for (const [label, text] of [
    ['priests', character.reactions.priests],
    ['commoners', character.reactions.commoners],
    ['agents', character.reactions.agents],
    ['artifacts', character.reactions.artifacts],
  ]) {
    const row = document.createElement('div')
    row.className = 'agent-details'
    row.textContent = `${label}: ${text}`
    card.appendChild(row)
  }

  // Concepts footer
  const concepts = document.createElement('span')
  concepts.className = 'entity-concepts'
  concepts.textContent = character.concepts.join(', ')
  card.appendChild(concepts)

  // Purpose (debug — hidden by default)
  const purposeDetails = document.createElement('details')
  const purposeSummary = document.createElement('summary')
  purposeSummary.textContent = 'purpose (debug)'
  purposeDetails.appendChild(purposeSummary)
  const purposeRow = document.createElement('div')
  purposeRow.className = 'agent-details'
  const purposeEntity = findEntity(world, character.purpose.target)
  const targetLabel = purposeEntity
    ? /** @type {*} */ (purposeEntity.entity).name ?? character.purpose.target
    : character.purpose.target
  purposeRow.textContent = `${character.purpose.type}: ${targetLabel}`
  const hiddenBadge = document.createElement('span')
  hiddenBadge.className = 'badge'
  hiddenBadge.textContent = 'hidden'
  purposeRow.appendChild(hiddenBadge)
  purposeDetails.appendChild(purposeRow)
  card.appendChild(purposeDetails)

  container.appendChild(card)
  return container
}
