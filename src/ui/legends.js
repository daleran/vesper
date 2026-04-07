/**
 * Legends Mode — two-pane designer tool with navigation tree and detail view.
 */

/**
 * @import { World } from '../world.js'
 */
import { findAgent } from '../world.js'
import { createBadge } from './components.js'
import { LAYER_RENDERERS, renderAgent } from './legendsDetail.js'
import { buildNavTree, navigateTo } from './legendsNav.js'

/**
 * Build an entity registry mapping every entity ID to its type and layer.
 * @param {World} world
 * @returns {Map<string, { type: string, layer: string }>}
 */
function buildEntityRegistry(world) {
  /** @type {Map<string, { type: string, layer: string }>} */
  const registry = new Map()

  for (const agent of world.agents) {
    registry.set(agent.id, { type: 'agent', layer: 'pantheon' })
  }
  for (let i = 0; i < world.events.length; i++) {
    registry.set(`event-${i}`, { type: 'event', layer: 'history' })
  }
  for (const region of (world.chorogony?.regions ?? [])) {
    registry.set(region.id, { type: 'region', layer: 'chorogony' })
  }
  for (const landmark of (world.geogony?.landmarks ?? [])) {
    registry.set(landmark.id, { type: 'landmark', layer: 'geogony' })
  }
  for (const artifact of (world.artifacts ?? [])) {
    registry.set(artifact.id, { type: 'artifact', layer: 'artifacts' })
  }
  for (const text of (world.texts ?? [])) {
    registry.set(text.id, { type: 'text', layer: 'texts' })
  }
  for (const religion of (world.hierogony?.religions ?? [])) {
    registry.set(religion.id, { type: 'religion', layer: 'hierogony' })
  }
  for (const polity of (world.politogony?.polities ?? [])) {
    registry.set(polity.id, { type: 'polity', layer: 'politogony' })
  }
  for (const ruin of (world.politogony?.ruins ?? [])) {
    registry.set(ruin.id, { type: 'ruin', layer: 'politogony' })
  }

  return registry
}

/**
 * Render detail content for a selected entity.
 * @param {World} world
 * @param {string} entityType
 * @param {string} entityId
 * @returns {HTMLElement|null}
 */
function renderEntityDetail(world, entityType, entityId) {
  switch (entityType) {
    case 'agent': {
      const agent = findAgent(world, entityId)
      if (!agent) return null
      return renderAgent(agent, world)
    }
    case 'region': {
      const region = (world.chorogony?.regions ?? []).find(r => r.id === entityId)
      if (!region) return null
      const el = document.createElement('div')
      el.className = 'region-card'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = region.name
      el.appendChild(name)
      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = region.concepts.join(', ')
      el.appendChild(concepts)
      // Prose if available
      const prose = world.renderedRegions?.get(region.id)
      if (prose) {
        const proseEl = document.createElement('div')
        proseEl.className = 'landmark-prose'
        for (const paragraph of prose.split('\n\n')) {
          const p = document.createElement('p')
          p.textContent = paragraph
          proseEl.appendChild(p)
        }
        el.appendChild(proseEl)
      }
      return el
    }
    case 'landmark': {
      const landmark = (world.geogony?.landmarks ?? []).find(l => l.id === entityId)
      if (!landmark) return null
      const el = document.createElement('div')
      el.className = 'region-card'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = landmark.name
      el.appendChild(name)
      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = landmark.concepts.join(', ')
      el.appendChild(concepts)
      const prose = world.renderedLandmarks?.get(landmark.id)
      if (prose) {
        const proseEl = document.createElement('div')
        proseEl.className = 'landmark-prose'
        for (const paragraph of prose.split('\n\n')) {
          const p = document.createElement('p')
          p.textContent = paragraph
          proseEl.appendChild(p)
        }
        el.appendChild(proseEl)
      }
      return el
    }
    case 'artifact': {
      const artifact = (world.artifacts ?? []).find(a => a.id === entityId)
      if (!artifact) return null
      const el = document.createElement('div')
      el.className = 'region-card'
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const nameEl = document.createElement('span')
      nameEl.className = 'region-name'
      nameEl.textContent = artifact.name
      nameLine.append(nameEl, createBadge(artifact.type, 'recipe'), createBadge(artifact.significance, 'seed'))
      el.appendChild(nameLine)
      const body = document.createElement('div')
      body.className = 'agent-details'
      body.textContent = `${artifact.material} \u00b7 ${artifact.condition} \u00b7 ${artifact.location.status}`
      el.appendChild(body)
      return el
    }
    case 'text': {
      const text = (world.texts ?? []).find(t => t.id === entityId)
      if (!text) return null
      const el = document.createElement('div')
      el.className = 'region-card'
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const nameEl = document.createElement('span')
      nameEl.className = 'region-name'
      nameEl.textContent = text.title
      nameLine.append(nameEl, createBadge(text.type, 'recipe'), createBadge(text.perspective, 'seed'))
      el.appendChild(nameLine)
      const bodyEl = document.createElement('p')
      bodyEl.className = 'text-body'
      bodyEl.textContent = text.body
      el.appendChild(bodyEl)
      return el
    }
    default:
      return null
  }
}

/**
 * Render detail content for a layer-level node.
 * @param {World} world
 * @param {string} layerKey
 * @returns {HTMLElement|null}
 */
function renderLayerDetail(world, layerKey) {
  const layer = LAYER_RENDERERS.find(l => l.title === layerKey)
  if (!layer || !layer.show(world)) return null
  const container = document.createElement('div')
  for (const el of layer.render(world)) {
    container.appendChild(el)
  }
  return container
}

/**
 * Display Legends Mode — two-pane layout with nav tree and detail view.
 * @param {HTMLElement} container
 * @param {World} world
 */
export function displayLegends(container, world) {
  container.innerHTML = ''

  const layout = document.createElement('div')
  layout.className = 'legends-layout'

  // Left pane: search + nav tree
  const leftPane = document.createElement('div')
  leftPane.className = 'legends-nav'

  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.className = 'concept-search'
  searchInput.placeholder = 'search concepts...'
  searchInput.setAttribute('aria-label', 'concept search')
  leftPane.appendChild(searchInput)

  const navTree = buildNavTree(world)
  leftPane.appendChild(navTree)

  // Right pane: detail view
  const rightPane = document.createElement('div')
  rightPane.className = 'legends-detail'

  const entityRegistry = buildEntityRegistry(world)

  // Handle nav tree selection
  navTree.addEventListener('legends-select', (e) => {
    const ce = /** @type {CustomEvent} */ (e)
    const { entityType, entityId, layerKey } = ce.detail
    rightPane.innerHTML = ''

    /** @type {HTMLElement|null} */
    let detail = null
    if (entityId && entityType) {
      detail = renderEntityDetail(world, entityType, entityId)
    } else if (layerKey) {
      detail = renderLayerDetail(world, layerKey)
    }

    if (detail) {
      rightPane.appendChild(detail)
    }
  })

  // Entity link delegation: clicks on .entity-link navigate the tree
  rightPane.addEventListener('click', (e) => {
    const link = /** @type {HTMLElement} */ (e.target).closest('.entity-link')
    if (!link) return
    const entityId = /** @type {HTMLElement} */ (link).dataset['entityId']
    if (!entityId) return
    const entry = entityRegistry.get(entityId)
    if (entry) {
      navigateTo(navTree, entry.type, entityId)
    }
  })

  // Concept search: filter nav tree nodes
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase()
    const nodes = navTree.querySelectorAll('.nav-leaf')
    for (const node of nodes) {
      const el = /** @type {HTMLElement} */ (node)
      if (!query) {
        el.hidden = false
        continue
      }
      const concepts = el.dataset['concepts'] ?? ''
      el.hidden = !concepts.toLowerCase().includes(query)
    }
    // Show parent details if any child is visible
    const groups = navTree.querySelectorAll('details.nav-group')
    for (const group of groups) {
      const hasVisible = group.querySelector('.nav-leaf:not([hidden])') !== null
      const det = /** @type {HTMLDetailsElement} */ (group)
      det.open = hasVisible
    }
  })

  layout.append(leftPane, rightPane)
  container.appendChild(layout)

  // Auto-select first layer
  const firstLeaf = /** @type {HTMLElement|null} */ (navTree.querySelector('.nav-node'))
  if (firstLeaf) firstLeaf.click()
}
