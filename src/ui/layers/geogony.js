/**
 * @import { GeogonyData } from '../../world.js'
 * @import { World } from '../../world.js'
 */
import { findAgent } from '../../world.js'
import { createMetaRow } from '../components.js'
import { renderAgent } from './agent.js'

/**
 * Render geogony data as a DOM element.
 * @param {GeogonyData} geogony
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderGeogony(geogony, world) {
  const container = document.createElement('div')

  // World name
  const worldNameEl = document.createElement('div')
  worldNameEl.className = 'world-name'
  worldNameEl.textContent = geogony.worldName
  container.appendChild(worldNameEl)

  // Recipe + shape badges
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = geogony.recipe
  const shapeBadge = document.createElement('span')
  shapeBadge.className = 'badge badge--seed'
  shapeBadge.textContent = geogony.worldShape
  badgeRow.append(recipeBadge, shapeBadge)
  container.appendChild(badgeRow)

  // Substances row
  const substMeta = document.createElement('div')
  substMeta.className = 'myth-meta'
  for (const [label, val] of /** @type {[string, string][]} */ ([
    ['ground', geogony.groundSubstance],
    ['water', geogony.waterSubstance],
    ['sky', geogony.skySubstance],
  ])) {
    substMeta.appendChild(createMetaRow(label, val))
  }

  // Causing agent
  if (geogony.causingAgentId !== null) {
    const agent = findAgent(world, geogony.causingAgentId)
    if (agent) {
      substMeta.appendChild(createMetaRow('shaped by', agent.name))
    }
  }

  // Materials + climate
  if (geogony.materials.length > 0) {
    substMeta.appendChild(createMetaRow('materials', geogony.materials.join(', ')))
  }

  if (geogony.climate.length > 0) {
    substMeta.appendChild(createMetaRow('climate', geogony.climate.join(', ')))
  }

  container.appendChild(substMeta)

  // Terrain types
  if (geogony.terrainTypes.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'terrain types'
    container.appendChild(heading)

    for (const terrain of geogony.terrainTypes) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = terrain.name

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = terrain.concepts.join(', ')

      const detail = document.createElement('span')
      detail.className = 'region-tagged-by'
      detail.textContent = `${terrain.shape} \u00b7 ${terrain.substance} \u00b7 ${terrain.causedBy}`

      card.append(name, concepts, detail)
      container.appendChild(card)
    }
  }

  // Landmarks
  if (geogony.landmarks.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'landmarks'
    container.appendChild(heading)

    for (const landmark of geogony.landmarks) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = landmark.name

      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = landmark.concepts.join(', ')

      const detail = document.createElement('span')
      detail.className = 'region-tagged-by'
      const agentName = landmark.agentId !== null ? findAgent(world, landmark.agentId)?.name : null
      const parts = [landmark.origin]
      if (agentName) parts.push(agentName)
      if (landmark.regionId) parts.push(landmark.regionId)
      detail.textContent = parts.join(' \u00b7 ')

      card.append(name, concepts, detail)
      container.appendChild(card)
    }
  }

  // Landscape agents
  const landscapeAgents = world.agents.filter(a => a.origin === 'landscape')
  if (landscapeAgents.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'landscape spirits'
    container.appendChild(heading)

    for (const agent of landscapeAgents) {
      container.appendChild(renderAgent(agent, world))
    }
  }

  return container
}
