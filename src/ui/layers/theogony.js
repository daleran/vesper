/**
 * @import { World } from '../../world.js'
 */
import { renderAgent } from './agent.js'

/**
 * Render a pantheon as a DOM element.
 * @param {World} world
 * @returns {HTMLElement}
 */
export function renderPantheon(world) {
  const container = document.createElement('div')
  const pantheonAgents = world.agents.filter(a => a.origin === 'pantheon')

  for (const agent of pantheonAgents) {
    container.appendChild(renderAgent(agent, world))
  }

  if (world.tensions.length > 0) {
    const tensionEl = document.createElement('p')
    tensionEl.className = 'pantheon-tensions'
    tensionEl.textContent = `tensions: ${world.tensions.map(t => t.replace(':', ' / ')).join(', ')}`
    container.appendChild(tensionEl)
  }

  return container
}
