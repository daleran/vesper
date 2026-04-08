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

// ── Settlement sub-views ──

/**
 * @typedef {'base'|'town-center'|'worship-site'|'fields'|'elder'} SettlementView
 */

/**
 * Render a settlement scene with sub-menu navigation.
 * @param {import('../world.js').World} world
 * @param {import('./gameScene.js').Scene} scene
 * @param {Map<string, import('./gameScene.js').Scene>} sceneGraph
 * @param {Set<string>} visitedScenes
 * @param {SettlementView} view
 * @param {GameState} state
 * @returns {DocumentFragment}
 */
function renderSettlementScene(world, scene, sceneGraph, visitedScenes, view, state) {
  const fragment = document.createDocumentFragment()
  const settlement = world.settlement
  const rendered = /** @type {any} */ (world.renderedSettlement)
  if (!settlement || !rendered) return fragment

  // Heading
  const heading = document.createElement('h2')
  heading.className = 'scene-heading'
  heading.textContent = settlement.name
  const sub = document.createElement('span')
  sub.className = 'scene-region-label'
  const regionScene = sceneGraph.get(scene.regionId)
  sub.textContent = ` \u2014 ${regionScene?.name ?? 'unknown region'}`
  heading.appendChild(sub)
  fragment.appendChild(heading)

  if (view === 'base') {
    // Landscape + architecture + teasers
    const proseEl = document.createElement('div')
    proseEl.className = 'scene-text'
    for (const paragraph of rendered.landscape.split('\n\n')) {
      const p = document.createElement('p')
      p.textContent = paragraph
      proseEl.appendChild(p)
    }
    const archP = document.createElement('p')
    archP.textContent = rendered.architecture
    proseEl.appendChild(archP)
    fragment.appendChild(proseEl)

    // Sub-menu choices
    const choicesEl = document.createElement('div')
    choicesEl.className = 'choices'

    const subViews = [
      { view: 'town-center', label: `Enter the ${settlement.townCenter.name}` },
      { view: 'worship-site', label: `Approach the ${settlement.worshipSite.name}` },
      { view: 'fields', label: 'Walk the fields' },
      { view: 'elder', label: `Speak with ${settlement.npcs.find(n => n.role === 'elder')?.name ?? 'the elder'}` },
    ]
    for (const sv of subViews) {
      const choice = document.createElement('div')
      choice.className = 'choice'
      choice.dataset['settlementView'] = sv.view
      choice.textContent = sv.label
      choicesEl.appendChild(choice)
    }

    // Return to region
    for (const connId of scene.connections) {
      const connScene = sceneGraph.get(connId)
      if (!connScene) continue
      const choice = document.createElement('div')
      choice.className = 'choice'
      choice.dataset['sceneId'] = connId
      const visited = visitedScenes.has(connId)
      choice.textContent = `Return to ${connScene.name}${visited ? '' : ' \u2022'}`
      choicesEl.appendChild(choice)
    }
    fragment.appendChild(choicesEl)
  } else if (view === 'town-center') {
    renderSubView(fragment, rendered.townCenter, settlement, rendered, state, 'town-center')
  } else if (view === 'worship-site') {
    renderSubView(fragment, rendered.worshipSite, settlement, rendered, state, 'worship-site')
  } else if (view === 'fields') {
    renderSubView(fragment, null, settlement, rendered, state, 'fields')
  } else if (view === 'elder') {
    renderSubView(fragment, null, settlement, rendered, state, 'elder')
  }

  return fragment
}

/**
 * Render a settlement sub-view.
 * @param {DocumentFragment} fragment
 * @param {string | null} mainProse
 * @param {import('../settlement.js').Settlement} settlement
 * @param {any} rendered
 * @param {GameState} state
 * @param {string} viewType
 */
function renderSubView(fragment, mainProse, settlement, rendered, state, viewType) {
  const proseEl = document.createElement('div')
  proseEl.className = 'scene-text'

  if (viewType === 'town-center') {
    const p = document.createElement('p')
    p.textContent = mainProse ?? ''
    proseEl.appendChild(p)

    // Food and drink items
    const itemSection = document.createElement('div')
    itemSection.className = 'scene-items'
    const foods = [
      { id: 'food-dish', label: `${settlement.specialtyDish.name} (specialty dish)`, desc: rendered.food.dish },
      { id: 'food-bread', label: `Bread of ${settlement.crops[0]?.name ?? 'grain'}`, desc: rendered.food.bread },
      { id: 'food-meat', label: `${settlement.livestock?.name ?? 'Meat'} dish`, desc: rendered.food.meat },
      { id: 'food-bev', label: `${settlement.brewedBeverage.name} (local brew)`, desc: rendered.food.beverage },
    ]
    for (const food of foods) {
      const itemEl = document.createElement('div')
      itemEl.className = 'scene-item'
      itemEl.dataset['foodId'] = food.id
      itemEl.dataset['foodDesc'] = food.desc
      itemEl.textContent = food.label
      itemSection.appendChild(itemEl)
    }
    proseEl.appendChild(itemSection)

    // Brewer NPC
    const brewer = settlement.npcs.find(n => n.role === 'brewer')
    if (brewer) {
      appendNPC(proseEl, brewer, rendered.npcDialogue[brewer.id] ?? [])
    }

    // Bar song
    const songSection = document.createElement('div')
    songSection.className = 'scene-texts'
    const songLabel = document.createElement('div')
    songLabel.className = 'scene-section-label'
    songLabel.textContent = 'A song drifts through the room...'
    const songBody = document.createElement('div')
    songBody.className = 'found-text'
    songBody.style.whiteSpace = 'pre-line'
    songBody.textContent = rendered.barSong
    songSection.append(songLabel, songBody)
    proseEl.appendChild(songSection)
  } else if (viewType === 'worship-site') {
    const p = document.createElement('p')
    p.textContent = mainProse ?? ''
    proseEl.appendChild(p)

    // Priest NPC
    const priest = settlement.npcs.find(n => n.role === 'priest')
    if (priest) {
      appendNPC(proseEl, priest, rendered.npcDialogue[priest.id] ?? [])
    }

    // Traditions
    if (rendered.traditions.length > 0) {
      const tradSection = document.createElement('div')
      tradSection.className = 'scene-rumors'
      const tradLabel = document.createElement('div')
      tradLabel.className = 'scene-section-label'
      tradLabel.textContent = 'Local traditions'
      tradSection.appendChild(tradLabel)
      for (const trad of rendered.traditions) {
        const tradP = document.createElement('p')
        tradP.className = 'rumor-text'
        tradP.textContent = trad
        tradSection.appendChild(tradP)
      }
      proseEl.appendChild(tradSection)
    }
  } else if (viewType === 'fields') {
    // Crop descriptions
    for (const crop of settlement.crops) {
      const desc = rendered.cropDescriptions[crop.id]
      if (desc) {
        const p = document.createElement('p')
        p.textContent = desc
        proseEl.appendChild(p)
      }
    }
    // Livestock
    if (rendered.livestockDescription) {
      const p = document.createElement('p')
      p.textContent = rendered.livestockDescription
      proseEl.appendChild(p)
    }
    // Farmer NPC
    const farmer = settlement.npcs.find(n => n.role === 'farmer')
    if (farmer) {
      appendNPC(proseEl, farmer, rendered.npcDialogue[farmer.id] ?? [])
    }
  } else if (viewType === 'elder') {
    const elder = settlement.npcs.find(n => n.role === 'elder')
    if (elder) {
      appendNPC(proseEl, elder, rendered.npcDialogue[elder.id] ?? [])
    }
  }

  fragment.appendChild(proseEl)

  // Back to village base
  const choicesEl = document.createElement('div')
  choicesEl.className = 'choices'
  const back = document.createElement('div')
  back.className = 'choice'
  back.dataset['settlementView'] = 'base'
  back.textContent = `Return to ${settlement.name}`
  choicesEl.appendChild(back)
  fragment.appendChild(choicesEl)
}

/**
 * Append an NPC encounter block.
 * @param {HTMLElement} container
 * @param {import('../settlement.js').SettlementNPC} npc
 * @param {string[]} dialogueLines
 */
function appendNPC(container, npc, dialogueLines) {
  const npcSection = document.createElement('div')
  npcSection.className = 'scene-encounters'
  const npcEl = document.createElement('div')
  npcEl.className = 'encounter'
  npcEl.dataset['npcId'] = npc.id
  npcEl.dataset['npcLineIndex'] = '0'
  const nameEl = document.createElement('span')
  nameEl.className = 'encounter-name'
  nameEl.textContent = `${npc.name}, the ${npc.role}`
  const stateEl = document.createElement('span')
  stateEl.className = 'encounter-state'
  stateEl.textContent = ` \u2014 ${npc.disposition}`
  npcEl.append(nameEl, stateEl)
  npcSection.appendChild(npcEl)

  // Show first dialogue line
  if (dialogueLines.length > 0) {
    const dialogueEl = document.createElement('div')
    dialogueEl.className = 'encounter-dialogue'
    dialogueEl.dataset['npcId'] = npc.id
    const p = document.createElement('p')
    p.textContent = `"${dialogueLines[0]}"`
    dialogueEl.appendChild(p)
    npcSection.appendChild(dialogueEl)
  }

  container.appendChild(npcSection)
}

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

  /** @type {SettlementView} */
  let currentSettlementView = 'base'

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

    // Settlement scenes use their own renderer with sub-views
    if (scene.type === 'settlement') {
      const fragment = renderSettlementScene(world, scene, sceneGraph, state.visitedScenes, currentSettlementView, state)
      sceneContainer.appendChild(fragment)
      return
    }

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
      const choiceEl = /** @type {HTMLElement} */ (choice)

      // Settlement sub-view navigation
      const settlementView = choiceEl.dataset['settlementView']
      if (settlementView) {
        currentSettlementView = /** @type {SettlementView} */ (settlementView)
        showScene()
        sceneContainer.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const sceneId = choiceEl.dataset['sceneId']
      if (sceneId && sceneGraph.has(sceneId)) {
        state.currentSceneId = sceneId
        state.visitedScenes.add(sceneId)
        currentSettlementView = 'base' // reset settlement view when leaving
        showScene()
        sceneContainer.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }

    // Food/drink interaction in settlement
    const foodItem = target.closest('.scene-item[data-food-id]')
    if (foodItem) {
      const foodEl = /** @type {HTMLElement} */ (foodItem)
      const foodDesc = foodEl.dataset['foodDesc']
      const foodId = foodEl.dataset['foodId']
      if (foodDesc && foodId) {
        // Show description inline
        const existing = foodEl.nextElementSibling
        if (existing?.classList.contains('encounter-dialogue')) {
          existing.remove()
        } else {
          const descEl = document.createElement('div')
          descEl.className = 'encounter-dialogue'
          const p = document.createElement('p')
          p.textContent = foodDesc
          descEl.appendChild(p)
          foodEl.after(descEl)
          // Journal entry
          const journalEntry = `Tasted: ${foodEl.textContent}`
          if (!state.journal.includes(journalEntry)) {
            state.journal.push(journalEntry)
          }
        }
      }
      return
    }

    // NPC dialogue cycling in settlement
    const npcEncounter = target.closest('.encounter[data-npc-id]')
    if (npcEncounter) {
      const npcEl = /** @type {HTMLElement} */ (npcEncounter)
      const npcId = npcEl.dataset['npcId']
      if (npcId && world.settlement) {
        const dialogueLines = /** @type {any} */ (world.renderedSettlement)?.npcDialogue?.[npcId] ?? []
        const currentIndex = parseInt(npcEl.dataset['npcLineIndex'] ?? '0', 10)
        const nextIndex = (currentIndex + 1) % dialogueLines.length
        npcEl.dataset['npcLineIndex'] = String(nextIndex)

        // Update dialogue display
        const dialogueEl = npcEl.parentElement?.querySelector(`.encounter-dialogue[data-npc-id="${npcId}"]`)
        if (dialogueEl && dialogueLines[nextIndex]) {
          dialogueEl.innerHTML = ''
          const p = document.createElement('p')
          p.textContent = `"${dialogueLines[nextIndex]}"`
          dialogueEl.appendChild(p)
        }
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
