/**
 * Game Mode — single-pane, text-focused player interface.
 * Scene navigation, inventory, journal, and encounters.
 */

/**
 * @import { World } from '../world.js'
 * @import { ConceptGraph } from '../concepts.js'
 */
import { findAgent } from '../world.js'
import { buildSceneGraph, renderScene } from './gameScene.js'

/**
 * @typedef {{
 *   currentSceneId: string,
 *   visitedScenes: Set<string>,
 *   inventory: string[],
 *   journal: string[],
 *   encounteredAgents: Set<string>,
 * }} GameState
 */

/**
 * Display Game Mode — immersive text interface with scene navigation.
 * @param {HTMLElement} container
 * @param {World} world
 * @param {ConceptGraph} graph
 */
export function displayGame(container, world, graph) {
  container.innerHTML = ''

  const sceneGraph = buildSceneGraph(world, graph)

  // Determine start scene from character arrival
  const startId = world.character?.arrival?.regionId ?? (world.chorogony?.regions?.[0]?.id ?? '')
  if (!sceneGraph.has(startId)) {
    const fallback = document.createElement('p')
    fallback.className = 'empty-state'
    fallback.textContent = 'No scenes available.'
    container.appendChild(fallback)
    return
  }

  /** @type {GameState} */
  const state = {
    currentSceneId: startId,
    visitedScenes: new Set([startId]),
    inventory: [],
    journal: [],
    encounteredAgents: new Set(),
  }

  const layout = document.createElement('div')
  layout.className = 'game-layout'

  // Main content area
  const sceneContainer = document.createElement('div')
  sceneContainer.className = 'game-scene'

  // Bottom bar: inventory + journal toggles
  const sidebar = document.createElement('div')
  sidebar.className = 'game-sidebar'

  const invToggle = document.createElement('button')
  invToggle.className = 'game-sidebar-toggle'
  invToggle.textContent = 'inventory'

  const journalToggle = document.createElement('button')
  journalToggle.className = 'game-sidebar-toggle'
  journalToggle.textContent = 'journal'

  const sidebarContent = document.createElement('div')
  sidebarContent.className = 'game-sidebar-content'

  invToggle.addEventListener('click', () => {
    sidebarContent.innerHTML = ''
    if (state.inventory.length === 0) {
      sidebarContent.textContent = 'Nothing carried.'
    } else {
      for (const artifactId of state.inventory) {
        const artifact = (world.artifacts ?? []).find(a => a.id === artifactId)
        if (!artifact) continue
        const itemEl = document.createElement('div')
        itemEl.className = 'inventory-item'
        itemEl.textContent = `${artifact.name} \u2014 ${artifact.type}, ${artifact.material}, ${artifact.condition}`
        sidebarContent.appendChild(itemEl)
      }
    }
    sidebarContent.hidden = !sidebarContent.hidden
  })

  journalToggle.addEventListener('click', () => {
    sidebarContent.innerHTML = ''
    if (state.journal.length === 0) {
      sidebarContent.textContent = 'Nothing recorded.'
    } else {
      for (const entry of state.journal) {
        const entryEl = document.createElement('div')
        entryEl.className = 'journal-entry'
        entryEl.textContent = entry
        sidebarContent.appendChild(entryEl)
      }
    }
    sidebarContent.hidden = !sidebarContent.hidden
  })

  sidebar.append(invToggle, journalToggle, sidebarContent)
  sidebarContent.hidden = true

  /**
   * Render the current scene and wire up interactions.
   */
  function showScene() {
    sceneContainer.innerHTML = ''
    const scene = sceneGraph.get(state.currentSceneId)
    if (!scene) return

    const fragment = renderScene(scene, world, sceneGraph, state.visitedScenes)
    sceneContainer.appendChild(fragment)

    // Record encounters in journal
    const activePowers = (world.present?.activePowers ?? []).filter(p => p.regionId === scene.regionId)
    for (const power of activePowers) {
      const agent = findAgent(world, power.agentId)
      if (agent && !state.encounteredAgents.has(agent.id)) {
        state.encounteredAgents.add(agent.id)
        state.journal.push(`Encountered: ${agent.name}, ${agent.title}`)
      }
    }

    // Record landmark visit in journal
    if (scene.type === 'landmark' && scene.prose) {
      const firstParagraph = scene.prose.split('\n\n')[0] ?? ''
      const entry = `Visited ${scene.name}: ${firstParagraph.slice(0, 100)}...`
      if (!state.journal.includes(entry)) {
        state.journal.push(entry)
      }
    }
  }

  // Event delegation for interactions
  sceneContainer.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target)

    // Navigation choice
    const choice = target.closest('.choice')
    if (choice) {
      const sceneId = /** @type {HTMLElement} */ (choice).dataset['sceneId']
      if (sceneId && sceneGraph.has(sceneId)) {
        state.currentSceneId = sceneId
        state.visitedScenes.add(sceneId)
        showScene()
        sceneContainer.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }

    // Pick up artifact
    const item = target.closest('.scene-item')
    if (item) {
      const itemEl = /** @type {HTMLElement} */ (item)
      const artifactId = itemEl.dataset['artifactId']
      if (artifactId && !state.inventory.includes(artifactId)) {
        state.inventory.push(artifactId)
        const artifact = (world.artifacts ?? []).find(a => a.id === artifactId)
        if (artifact) {
          state.journal.push(`Found: ${artifact.name} (${artifact.type})`)
        }
        itemEl.classList.add('picked-up')
        itemEl.textContent += ' [taken]'
      }
      return
    }

    // Read found text
    const foundText = target.closest('.found-text')
    if (foundText) {
      const foundEl = /** @type {HTMLElement} */ (foundText)
      const textId = foundEl.dataset['textId']
      if (textId) {
        const text = (world.texts ?? []).find(t => t.id === textId)
        if (text && !state.journal.includes(`Read: ${text.title}`)) {
          state.journal.push(`Read: ${text.title}`)
        }
        foundEl.classList.add('text-read')
      }
      return
    }

    // Talk to agent
    const encounter = target.closest('.encounter')
    if (encounter) {
      const encEl = /** @type {HTMLElement} */ (encounter)
      const agentId = encEl.dataset['agentId']
      if (!agentId) return
      const agent = findAgent(world, agentId)
      if (!agent) return

      // Simple dialogue based on disposition and domains
      const dialogue = document.createElement('div')
      dialogue.className = 'encounter-dialogue'
      const domainText = agent.domains.slice(0, 2).join(' and ')
      const lines = [
        `${agent.name} regards you with an air of ${agent.disposition}.`,
        `"I am of ${domainText}. You would do well to remember that."`,
      ]
      if (agent.state === 'exiled') {
        lines.push('"I was cast out. This place is not my home."')
      } else if (agent.state === 'sleeping') {
        lines.push('"Do not disturb what sleeps. Or do. It matters little now."')
      }
      for (const line of lines) {
        const p = document.createElement('p')
        p.textContent = line
        dialogue.appendChild(p)
      }
      encounter.after(dialogue)
      return
    }
  })

  layout.append(sceneContainer, sidebar)
  container.appendChild(layout)

  // Show initial scene
  showScene()
}
