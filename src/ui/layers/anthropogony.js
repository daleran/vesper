/**
 * @import { AnthropogonyData } from '../../world.js'
 * @import { World } from '../../world.js'
 */
import { findAgent } from '../../world.js'
import { createMetaRow } from '../components.js'

/**
 * Render anthropogony data as a DOM element.
 * @param {AnthropogonyData} anthropogony
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderAnthropogony(anthropogony, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = anthropogony.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Common memory + disputes meta
  const meta = document.createElement('div')
  meta.className = 'myth-meta'

  if (anthropogony.commonMemory.length > 0) {
    meta.appendChild(createMetaRow('common memory', anthropogony.commonMemory.join(', ')))
  }

  if (anthropogony.disputes.length > 0) {
    meta.appendChild(createMetaRow('disputes', anthropogony.disputes.join(', ')))
  }

  container.appendChild(meta)

  // Peoples
  if (anthropogony.peoples.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'peoples'
    container.appendChild(heading)

    for (const people of anthropogony.peoples) {
      const card = document.createElement('div')
      card.className = 'entity-card'

      // Name + origin
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'

      const name = document.createElement('span')
      name.className = 'entity-name'
      name.textContent = people.name

      const originBadge = document.createElement('span')
      originBadge.className = 'badge badge--seed'
      originBadge.textContent = people.origin

      nameLine.append(name, originBadge)
      card.appendChild(nameLine)

      // Agents
      const agentMeta = document.createElement('div')
      agentMeta.className = 'agent-details'
      const agentParts = []
      if (people.creatorAgent) {
        const agent = findAgent(world, people.creatorAgent)
        if (agent) agentParts.push(`creator: ${agent.name}`)
      }
      if (people.patronAgent) {
        const agent = findAgent(world, people.patronAgent)
        if (agent) agentParts.push(`patron: ${agent.name}`)
      }
      if (agentParts.length > 0) {
        agentMeta.textContent = agentParts.join(' \u00b7 ')
        card.appendChild(agentMeta)
      }

      // Purpose, gift, flaw
      const traitMeta = document.createElement('div')
      traitMeta.className = 'agent-details'
      traitMeta.textContent = `purpose: ${people.purpose} \u00b7 gift: ${people.gift} \u00b7 flaw: ${people.flaw}`
      card.appendChild(traitMeta)

      // Terrain affinity
      if (people.terrainAffinity.length > 0) {
        const terrainEl = document.createElement('div')
        terrainEl.className = 'agent-details'
        terrainEl.textContent = `terrain: ${people.terrainAffinity.join(', ')}`
        card.appendChild(terrainEl)
      }

      // Remembers + fears
      const memEl = document.createElement('div')
      memEl.className = 'agent-details'
      const memParts = []
      if (people.remembers.length > 0) memParts.push(`remembers: ${people.remembers.join(', ')}`)
      if (people.fears.length > 0) memParts.push(`fears: ${people.fears.join(', ')}`)
      if (memParts.length > 0) {
        memEl.textContent = memParts.join(' \u00b7 ')
        card.appendChild(memEl)
      }

      // Physical traits
      const traits = people.physicalTraits
      const traitParts = []
      if (traits.texture) traitParts.push(traits.texture)
      if (traits.shape) traitParts.push(traits.shape)
      if (traits.color) traitParts.push(traits.color)
      if (traitParts.length > 0) {
        const traitEl = document.createElement('div')
        traitEl.className = 'agent-details'
        traitEl.textContent = `physical: ${traitParts.join(', ')}`
        card.appendChild(traitEl)
      }

      // Concept cluster
      const concepts = document.createElement('span')
      concepts.className = 'entity-concepts'
      concepts.textContent = people.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  return container
}
