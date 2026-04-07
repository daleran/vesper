/**
 * @import { Agent } from '../../pantheon.js'
 * @import { World } from '../../world.js'
 */
import { findAgent } from '../../world.js'

/**
 * Render a single agent as a compact DOM element.
 * @param {Agent} agent
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderAgent(agent, world) {
  const el = document.createElement('div')
  el.className = 'agent-card'

  const nameLine = document.createElement('div')
  nameLine.className = 'agent-name-line'

  const name = document.createElement('span')
  name.className = 'agent-name'
  name.textContent = agent.name

  const title = document.createElement('span')
  title.className = 'agent-title'
  title.textContent = agent.title

  const typeBadge = document.createElement('span')
  typeBadge.className = `badge badge--${agent.type}`
  typeBadge.textContent = agent.type

  nameLine.append(name, title, typeBadge)
  el.appendChild(nameLine)

  const details = document.createElement('div')
  details.className = 'agent-details'

  const stateText = agent.alive ? agent.state : `${agent.state} (dead)`
  details.textContent = [
    `${agent.disposition}`,
    `domains: ${agent.domains.join(', ')}`,
    `role: ${agent.mythRole}`,
    `state: ${stateText}`,
    agent.relationships.length > 0
      ? agent.relationships.map(r => `${r.kind} of ${findAgent(world, r.target)?.name ?? '?'}`).join(', ')
      : '',
  ].filter(Boolean).join(' \u00b7 ')

  el.appendChild(details)
  return el
}
