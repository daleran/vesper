/**
 * @import { Artifact } from '../../artifacts.js'
 * @import { World } from '../../world.js'
 */
import { findAgent, findRegion } from '../../world.js'
import { renderTagRow } from '../components.js'

/**
 * Render artifacts as a DOM element.
 * @param {Artifact[]} artifacts
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderArtifacts(artifacts, world) {
  const container = document.createElement('div')

  for (const artifact of artifacts) {
    const card = document.createElement('div')
    card.className = 'entity-card'

    // Name line with type, significance, condition badges
    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'entity-name'
    nameEl.textContent = artifact.name
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = artifact.type
    const sigBadge = document.createElement('span')
    sigBadge.className = 'badge badge--seed'
    sigBadge.textContent = artifact.significance
    const condBadge = document.createElement('span')
    condBadge.className = 'badge'
    condBadge.textContent = artifact.condition
    nameLine.append(nameEl, typeBadge, sigBadge, condBadge)
    card.appendChild(nameLine)

    // Material
    const matRow = renderTagRow('material', [artifact.material])
    if (matRow) card.appendChild(matRow)

    // Origin
    const originParts = /** @type {string[]} */ ([artifact.origin.source])
    if (artifact.origin.eventIndex !== null) {
      originParts.push(`event ${artifact.origin.eventIndex}`)
    }
    if (artifact.origin.agentId) {
      const agent = findAgent(world, artifact.origin.agentId)
      if (agent) originParts.push(agent.name)
    }
    const originRow = renderTagRow('origin', originParts)
    if (originRow) card.appendChild(originRow)

    // Location
    const locationParts = []
    const region = findRegion(world, artifact.location.regionId)
    if (region) locationParts.push(region.name)
    if (artifact.location.landmarkName) locationParts.push(artifact.location.landmarkName)
    locationParts.push(artifact.location.status)
    const locRow = renderTagRow('location', locationParts)
    if (locRow) card.appendChild(locRow)

    // Concepts
    const concepts = document.createElement('span')
    concepts.className = 'entity-concepts'
    concepts.textContent = artifact.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}
