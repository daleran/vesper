/**
 * Navigation tree for Legends Mode.
 * Builds a collapsible tree from a World object using nested <details> elements.
 */

/**
 * @import { World } from '../world.js'
 */

/**
 * Create a nav leaf node (clickable, dispatches selection event).
 * @param {string} label
 * @param {{ entityType?: string, entityId?: string, layerKey?: string, concepts?: string[] }} opts
 * @returns {HTMLDivElement}
 */
function createNavLeaf(label, opts) {
  const node = document.createElement('div')
  node.className = 'nav-node nav-leaf'
  node.textContent = label
  if (opts.entityType) node.dataset['entityType'] = opts.entityType
  if (opts.entityId) node.dataset['entityId'] = opts.entityId
  if (opts.layerKey) node.dataset['layerKey'] = opts.layerKey
  if (opts.concepts) node.dataset['concepts'] = opts.concepts.join(',')
  node.setAttribute('role', 'treeitem')
  node.tabIndex = 0

  node.addEventListener('click', () => {
    // Deselect siblings
    const tree = node.closest('.legends-nav-tree')
    if (tree) {
      for (const sel of tree.querySelectorAll('.nav-node.selected')) {
        sel.classList.remove('selected')
      }
    }
    node.classList.add('selected')

    // Dispatch selection event
    node.dispatchEvent(new CustomEvent('legends-select', {
      bubbles: true,
      detail: {
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        layerKey: opts.layerKey ?? null,
      },
    }))
  })

  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      node.click()
    }
  })

  return node
}

/**
 * Create a nav group (collapsible details with children).
 * @param {string} label
 * @param {HTMLElement[]} children
 * @param {boolean} [open]
 * @returns {HTMLDetailsElement}
 */
function createNavGroup(label, children, open = false) {
  const details = document.createElement('details')
  details.className = 'nav-group'
  details.open = open

  const summary = document.createElement('summary')
  summary.className = 'nav-group-label'
  summary.textContent = label

  details.appendChild(summary)
  for (const child of children) {
    details.appendChild(child)
  }
  return details
}

/**
 * Build the navigation tree DOM from a World object.
 * @param {World} world
 * @returns {HTMLElement}
 */
export function buildNavTree(world) {
  const tree = document.createElement('div')
  tree.className = 'legends-nav-tree'
  tree.setAttribute('role', 'tree')

  // World header
  const worldName = world.geogony?.worldName ?? 'unnamed'
  const worldHeader = document.createElement('div')
  worldHeader.className = 'nav-world-header'
  worldHeader.textContent = `${worldName} \u2014 seed: ${world.seed}`
  tree.appendChild(worldHeader)

  // Cosmogony
  if (world.myth) {
    tree.appendChild(createNavLeaf('Cosmogony', {
      layerKey: 'Layer 0 \u2014 Cosmogony',
      concepts: [...world.myth.before.concepts, ...world.myth.act.concepts, ...world.myth.cost.concepts, ...world.myth.flaw.concepts],
    }))
  }

  // Pantheon
  const pantheonAgents = world.agents.filter(a => a.origin === 'pantheon')
  if (pantheonAgents.length > 0) {
    const children = pantheonAgents.map(a =>
      createNavLeaf(`${a.name} (${a.type})`, {
        entityType: 'agent',
        entityId: a.id,
        concepts: a.domains,
      })
    )
    tree.appendChild(createNavGroup('Pantheon', children, false))
  }

  // History events
  if (world.events.length > 0) {
    const children = world.events.map((e, i) =>
      createNavLeaf(`Event ${i}: ${e.archetype}`, {
        entityType: 'event',
        entityId: `event-${i}`,
        concepts: [...e.situation.concepts, ...e.consequence.concepts],
      })
    )
    tree.appendChild(createNavGroup('History', children, false))
  }

  // Geogony
  if (world.geogony) {
    /** @type {HTMLElement[]} */
    const geoChildren = []

    // Terrain types as leaves
    if (world.geogony.terrainTypes.length > 0) {
      geoChildren.push(createNavLeaf('Overview', {
        layerKey: 'Layer 2 \u2014 Geogony',
      }))
    }

    // Landmarks
    if (world.geogony.landmarks.length > 0) {
      const lmChildren = world.geogony.landmarks.map(l =>
        createNavLeaf(l.name, {
          entityType: 'landmark',
          entityId: l.id,
          concepts: l.concepts,
        })
      )
      geoChildren.push(createNavGroup('Landmarks', lmChildren, false))
    }

    tree.appendChild(createNavGroup('Geogony', geoChildren, false))
  }

  // Biogony
  if (world.biogony) {
    tree.appendChild(createNavLeaf('Biogony', {
      layerKey: 'Layer 3 \u2014 Biogony',
    }))
  }

  // Anthropogony
  if (world.anthropogony) {
    tree.appendChild(createNavLeaf('Anthropogony', {
      layerKey: 'Layer 4 \u2014 Anthropogony',
    }))
  }

  // Chorogony (regions)
  if (world.chorogony) {
    const children = world.chorogony.regions.map(r =>
      createNavLeaf(r.name, {
        entityType: 'region',
        entityId: r.id,
        concepts: r.concepts,
      })
    )
    tree.appendChild(createNavGroup('Regions', children, false))
  }

  // Hierogony
  if (world.hierogony) {
    tree.appendChild(createNavLeaf('Hierogony', {
      layerKey: 'Layer 6 \u2014 Hierogony',
    }))
  }

  // Politogony
  if (world.politogony) {
    tree.appendChild(createNavLeaf('Politogony', {
      layerKey: 'Layer 7 \u2014 Politogony',
    }))
  }

  // Present
  if (world.present) {
    tree.appendChild(createNavLeaf('The Present', {
      layerKey: 'Layer 8 \u2014 The Present',
    }))
  }

  // Artifacts
  if (world.artifacts && world.artifacts.length > 0) {
    const children = world.artifacts.map(a =>
      createNavLeaf(`${a.name} (${a.type})`, {
        entityType: 'artifact',
        entityId: a.id,
        concepts: a.concepts,
      })
    )
    tree.appendChild(createNavGroup('Artifacts', children, false))
  }

  // Texts
  if (world.texts && world.texts.length > 0) {
    const children = world.texts.map(t =>
      createNavLeaf(`${t.title} [${t.type}]`, {
        entityType: 'text',
        entityId: t.id,
        concepts: t.concepts,
      })
    )
    tree.appendChild(createNavGroup('Texts', children, false))
  }

  // Character
  if (world.character) {
    tree.appendChild(createNavLeaf('Character', {
      layerKey: 'Character',
    }))
  }

  return tree
}

/**
 * Programmatically navigate to an entity in the tree.
 * Opens parent groups, selects the node, scrolls into view.
 * @param {HTMLElement} navTree
 * @param {string} entityType
 * @param {string} entityId
 */
export function navigateTo(navTree, entityType, entityId) {
  const node = navTree.querySelector(
    `.nav-leaf[data-entity-type="${entityType}"][data-entity-id="${entityId}"]`
  )
  if (!node) return

  // Open parent details
  let parent = node.parentElement
  while (parent && parent !== navTree) {
    if (parent.tagName === 'DETAILS') {
      /** @type {HTMLDetailsElement} */ (parent).open = true
    }
    parent = parent.parentElement
  }

  // Scroll into view and click
  const el = /** @type {HTMLElement} */ (node)
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  el.click()
}
