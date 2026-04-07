/**
 * World view — unified single-scroll document with TOC sidebar.
 * Replaces separate generate (accordion) and legends (tree+detail) modes.
 */

/**
 * @import { CreationMyth } from '../recipes/index.js'
 * @import { World, GeogonyData, BiogonyData, AnthropogonyData, ChorogonyData } from '../world.js'
 * @import { HierogonyData } from '../hierogony.js'
 * @import { PolitogonyData } from '../politogony.js'
 * @import { PresentData } from '../present.js'
 * @import { Artifact } from '../artifacts.js'
 * @import { PlayerCharacter } from '../character.js'
 * @import { MythText } from '../renderers/mythTexts.js'
 */
import { createJsonToggle, createLayerPanel } from './components.js'
import { getEventsForAge } from '../timeline.js'
import {
  renderTimeline,
  renderCosmogony,
  renderAgent,
  renderPantheon,
  renderGeogony,
  renderBiogony,
  renderAnthropogony,
  renderChorogony,
  renderHierogony,
  renderPolitogony,
  renderPresent,
  renderArtifacts,
  renderCharacter,
  renderLandmarkDescriptions,
  renderMythTexts,
  renderRegionDescriptions,
  renderTimelineEvent,
} from './layers/index.js'

export { renderAgent }

// ── Layer Registry ──

/**
 * @typedef {{
 *   title: string,
 *   show: (w: World) => boolean,
 *   render: (w: World) => (HTMLElement|DocumentFragment)[],
 *   data: (w: World) => object,
 * }} LayerDef
 */

/** @type {LayerDef[]} */
export const LAYER_RENDERERS = [
  {
    title: 'Timeline',
    show: w => (w.timeline?.events.length ?? 0) > 0,
    render: w => [renderTimeline(/** @type {import('../timeline.js').Timeline} */ (w.timeline), w)],
    data: w => /** @type {object} */ (w.timeline),
  },
  {
    title: 'Layer 0 \u2014 Cosmogony',
    show: w => w.myth !== null,
    render: w => [renderCosmogony(/** @type {CreationMyth} */ (w.myth))],
    data: w => /** @type {object} */ (w.myth),
  },
  {
    title: 'Layer 1 \u2014 Theogony',
    show: w => w.agents.length > 0,
    render: w => [renderPantheon(w)],
    data: w => ({ agents: w.agents.filter(a => a.origin === 'pantheon'), tensions: w.tensions }),
  },
  {
    title: 'Layer 2 \u2014 Geogony',
    show: w => w.geogony !== null,
    render: w => [renderGeogony(/** @type {GeogonyData} */ (w.geogony), w)],
    data: w => /** @type {object} */ (w.geogony),
  },
  {
    title: 'Layer 3 \u2014 Biogony',
    show: w => w.biogony !== null,
    render: w => [renderBiogony(/** @type {BiogonyData} */ (w.biogony), w)],
    data: w => /** @type {object} */ (w.biogony),
  },
  {
    title: 'Layer 4 \u2014 Anthropogony',
    show: w => w.anthropogony !== null,
    render: w => [renderAnthropogony(/** @type {AnthropogonyData} */ (w.anthropogony), w)],
    data: w => /** @type {object} */ (w.anthropogony),
  },
  {
    title: 'Layer 5 \u2014 Chorogony',
    show: w => w.chorogony !== null,
    render: w => [renderChorogony(/** @type {ChorogonyData} */ (w.chorogony), w)],
    data: w => /** @type {object} */ (w.chorogony),
  },
  {
    title: 'Layer 6 \u2014 Hierogony',
    show: w => w.hierogony !== null,
    render: w => [renderHierogony(/** @type {HierogonyData} */ (w.hierogony), w)],
    data: w => /** @type {object} */ (w.hierogony),
  },
  {
    title: 'Layer 7 \u2014 Politogony',
    show: w => w.politogony !== null,
    render: w => [renderPolitogony(/** @type {PolitogonyData} */ (w.politogony), w)],
    data: w => /** @type {object} */ (w.politogony),
  },
  {
    title: 'Layer 8 \u2014 The Present',
    show: w => w.present !== null,
    render: w => [renderPresent(/** @type {PresentData} */ (w.present), w)],
    data: w => /** @type {object} */ (w.present),
  },
  {
    title: 'Artifacts',
    show: w => w.artifacts !== null && w.artifacts.length > 0,
    render: w => [renderArtifacts(/** @type {Artifact[]} */ (w.artifacts), w)],
    data: w => /** @type {object} */ (w.artifacts),
  },
  {
    title: 'Character',
    show: w => w.character !== null,
    render: w => [renderCharacter(/** @type {PlayerCharacter} */ (w.character), w)],
    data: w => /** @type {object} */ (w.character),
  },
  {
    title: 'Texts',
    show: w => w.texts !== null && w.texts.length > 0,
    render: w => [renderMythTexts(/** @type {MythText[]} */ (w.texts), w)],
    data: w => /** @type {object} */ (w.texts),
  },
  {
    title: 'Landmark Descriptions',
    show: w => w.renderedLandmarks !== null && w.renderedLandmarks.size > 0,
    render: w => [renderLandmarkDescriptions(w)],
    data: w => Object.fromEntries(/** @type {Map<string, string>} */ (w.renderedLandmarks)),
  },
  {
    title: 'Region Descriptions',
    show: w => w.renderedRegions !== null && w.renderedRegions.size > 0,
    render: w => [renderRegionDescriptions(w)],
    data: w => Object.fromEntries(/** @type {Map<string, string>} */ (w.renderedRegions)),
  },
]

// ── ID mappings ──

/** Short section IDs for each layer title. */
const LAYER_SHORT_IDS = /** @type {Record<string, string>} */ ({
  'Timeline': 'timeline',
  'Layer 0 \u2014 Cosmogony': 'cosmogony',
  'Layer 1 \u2014 Theogony': 'theogony',
  'Layer 2 \u2014 Geogony': 'geogony',
  'Layer 3 \u2014 Biogony': 'biogony',
  'Layer 4 \u2014 Anthropogony': 'anthropogony',
  'Layer 5 \u2014 Chorogony': 'chorogony',
  'Layer 6 \u2014 Hierogony': 'hierogony',
  'Layer 7 \u2014 Politogony': 'politogony',
  'Layer 8 \u2014 The Present': 'present',
  'Artifacts': 'artifacts',
  'Character': 'character',
  'Texts': 'texts',
  'Landmark Descriptions': 'landmark-descriptions',
  'Region Descriptions': 'region-descriptions',
})

/** Maps entity type to the layer section id (without the 'layer-' prefix) that contains it. */
const ENTITY_TYPE_TO_SECTION = /** @type {Record<string, string>} */ ({
  agent: 'layer-theogony',
  region: 'layer-chorogony',
  landmark: 'layer-geogony',
  religion: 'layer-hierogony',
  polity: 'layer-politogony',
  ruin: 'layer-politogony',
  artifact: 'layer-artifacts',
  text: 'layer-texts',
  'timeline-event': 'layer-timeline',
  event: 'layer-timeline',
})

// ── Entity registry ──

/**
 * Build an entity registry mapping every entity ID to its type and layer.
 * @param {World} world
 * @returns {Map<string, { type: string, layer: string }>}
 */
function buildEntityRegistry(world) {
  /** @type {Map<string, { type: string, layer: string }>} */
  const registry = new Map()
  for (const agent of world.agents) {
    registry.set(agent.id, { type: 'agent', layer: 'theogony' })
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
  for (const evt of (world.timeline?.events ?? [])) {
    registry.set(evt.id, { type: 'timeline-event', layer: 'timeline' })
  }
  return registry
}

// ── Layer panels (used by batch mode) ──

/**
 * Render all layer panels for a world into a DocumentFragment (accordion style).
 * @param {World} world
 * @param {boolean} [defaultOpen=true]
 * @returns {DocumentFragment}
 */
export function renderLayerPanels(world, defaultOpen = true) {
  const fragment = document.createDocumentFragment()
  for (const layer of LAYER_RENDERERS) {
    if (!layer.show(world)) continue
    const { panel, body } = createLayerPanel(layer.title, defaultOpen)
    for (const el of layer.render(world)) {
      body.appendChild(el)
    }
    body.appendChild(createJsonToggle(layer.data(world)))
    fragment.appendChild(panel)
  }
  return fragment
}

// ── Render modes ──

/**
 * Render all layers as visible sections (Type mode).
 * @param {World} world
 * @returns {DocumentFragment}
 */
function renderTypeMode(world) {
  const frag = document.createDocumentFragment()
  for (const layer of LAYER_RENDERERS) {
    if (!layer.show(world)) continue
    const shortId = LAYER_SHORT_IDS[layer.title] ?? layer.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const section = document.createElement('section')
    section.id = 'layer-' + shortId
    section.className = 'world-section'
    const heading = document.createElement('h2')
    heading.className = 'world-section-heading'
    heading.textContent = layer.title
    const body = document.createElement('div')
    body.className = 'layer-body'
    for (const el of layer.render(world)) body.appendChild(el)
    body.appendChild(createJsonToggle(layer.data(world)))
    section.append(heading, body)
    frag.appendChild(section)
  }
  return frag
}

/**
 * Render world events grouped by age (Timeline mode).
 * @param {World} world
 * @returns {DocumentFragment}
 */
function renderTimelineMode(world) {
  const frag = document.createDocumentFragment()
  if (!world.timeline) return frag

  // World Foundation: cosmogony before the event timeline
  if (world.myth) {
    const section = document.createElement('section')
    section.id = 'age-foundation'
    section.className = 'world-section'
    const h2 = document.createElement('h2')
    h2.className = 'world-section-heading'
    h2.textContent = 'World Foundation'
    const body = document.createElement('div')
    body.className = 'layer-body'
    body.appendChild(renderCosmogony(world.myth))
    section.append(h2, body)
    frag.appendChild(section)
  }

  const ageConfigs = /** @type {const} */ ([
    { key: 'creation', label: 'Age of Creation' },
    { key: 'heroes', label: 'Age of Heroes' },
    { key: 'current', label: 'Current Age' },
  ])

  for (const { key, label } of ageConfigs) {
    const events = getEventsForAge(world.timeline, key)
    if (events.length === 0) continue
    const section = document.createElement('section')
    section.id = 'age-' + key
    section.className = 'world-section'
    const h2 = document.createElement('h2')
    h2.className = 'world-section-heading'
    h2.textContent = `${label} (${events.length} events)`
    section.appendChild(h2)
    for (const evt of events) {
      const card = renderTimelineEvent(evt, world.timeline, world)
      card.id = 'event-' + evt.id
      card.classList.add('timeline-event-card--inline')
      section.appendChild(card)
    }
    frag.appendChild(section)
  }

  return frag
}

// ── TOC ──

/**
 * Build a table-of-contents nav for the given sort mode.
 * @param {World} world
 * @param {'type'|'timeline'} sort
 * @returns {HTMLElement}
 */
function buildWorldToc(world, sort) {
  const nav = document.createElement('nav')
  nav.className = 'world-toc'

  /**
   * @param {string} label
   * @param {string} targetId
   */
  function tocLink(label, targetId) {
    const a = document.createElement('a')
    a.className = 'toc-link'
    a.href = '#' + targetId
    a.textContent = label
    a.addEventListener('click', (e) => {
      e.preventDefault()
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return a
  }

  if (sort === 'type') {
    for (const layer of LAYER_RENDERERS) {
      if (!layer.show(world)) continue
      const shortId = LAYER_SHORT_IDS[layer.title] ?? layer.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      nav.appendChild(tocLink(layer.title, 'layer-' + shortId))
    }
  } else {
    if (world.myth) {
      nav.appendChild(tocLink('World Foundation', 'age-foundation'))
    }
    if (world.timeline) {
      const ageDefs = /** @type {const} */ ([
        { key: 'creation', label: 'Age of Creation' },
        { key: 'heroes', label: 'Age of Heroes' },
        { key: 'current', label: 'Current Age' },
      ])
      for (const { key, label } of ageDefs) {
        const events = getEventsForAge(world.timeline, key)
        if (events.length === 0) continue
        nav.appendChild(tocLink(`${label} (${events.length})`, 'age-' + key))
      }
    }
  }

  return nav
}

// ── Main display functions ──

/**
 * Render a world as a unified scrollable document with TOC sidebar.
 * @param {HTMLElement} container
 * @param {World} world
 */
export function displayWorld(container, world) {
  container.innerHTML = ''

  /** @type {'type'|'timeline'} */
  let activeSort = 'type'

  const entityRegistry = buildEntityRegistry(world)

  // ── Header ──
  const header = document.createElement('div')
  header.className = 'world-header'

  const seedTag = document.createElement('span')
  seedTag.className = 'badge badge--seed'
  seedTag.textContent = world.myth?.seed ?? world.seed

  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = world.myth?.recipe ?? ''

  const sortGroup = document.createElement('div')
  sortGroup.className = 'sort-toggle'

  const typeBtn = document.createElement('button')
  typeBtn.className = 'sort-btn active small'
  typeBtn.textContent = 'type'

  const timelineBtn = document.createElement('button')
  timelineBtn.className = 'sort-btn small'
  timelineBtn.textContent = 'timeline'

  sortGroup.append(typeBtn, timelineBtn)

  const copyBtn = document.createElement('button')
  copyBtn.className = 'small'
  copyBtn.textContent = 'copy json'
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(JSON.stringify(world, null, 2)).then(() => {
      copyBtn.textContent = 'copied!'
      setTimeout(() => { copyBtn.textContent = 'copy json' }, 1500)
    })
  })

  header.append(seedTag, recipeBadge, sortGroup, copyBtn)

  // ── Two-pane layout ──
  const layout = document.createElement('div')
  layout.className = 'world-layout'

  const tocWrapper = document.createElement('div')
  tocWrapper.className = 'world-toc-wrapper'

  const contentPane = document.createElement('div')
  contentPane.className = 'world-content'

  // Entity cross-link handler: click on any .entity-link scrolls to its section
  contentPane.addEventListener('click', (e) => {
    const link = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('.entity-link'))
    if (!link) return
    const entityId = link.dataset['entityId']
    if (!entityId) return

    // Try direct event element (works in timeline mode)
    const directEl = document.getElementById('event-' + entityId)
    if (directEl) {
      directEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // Fall back to containing layer section (works in type mode)
    const entry = entityRegistry.get(entityId)
    if (entry) {
      const sectionId = ENTITY_TYPE_TO_SECTION[entry.type]
      if (sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  })

  function render() {
    contentPane.innerHTML = ''
    tocWrapper.innerHTML = ''
    tocWrapper.appendChild(buildWorldToc(world, activeSort))
    contentPane.appendChild(activeSort === 'type' ? renderTypeMode(world) : renderTimelineMode(world))
  }

  typeBtn.addEventListener('click', () => {
    if (activeSort === 'type') return
    activeSort = 'type'
    typeBtn.classList.add('active')
    timelineBtn.classList.remove('active')
    render()
  })

  timelineBtn.addEventListener('click', () => {
    if (activeSort === 'timeline') return
    activeSort = 'timeline'
    timelineBtn.classList.add('active')
    typeBtn.classList.remove('active')
    render()
  })

  render()

  layout.append(tocWrapper, contentPane)
  container.append(header, layout)
}

/**
 * Render a batch of worlds into the output container (accordion style).
 * @param {HTMLElement} container
 * @param {World[]} worlds
 */
export function displayMythBatch(container, worlds) {
  container.innerHTML = ''

  const toolbar = document.createElement('div')
  toolbar.className = 'batch-toolbar'

  const expandAllBtn = document.createElement('button')
  expandAllBtn.className = 'small'
  expandAllBtn.textContent = 'expand all'

  const collapseAllBtn = document.createElement('button')
  collapseAllBtn.className = 'small'
  collapseAllBtn.textContent = 'collapse all'

  const copyAllBtn = document.createElement('button')
  copyAllBtn.className = 'small'
  copyAllBtn.textContent = 'copy all json'

  expandAllBtn.addEventListener('click', () => {
    for (const d of container.querySelectorAll('details.layer-panel')) {
      /** @type {HTMLDetailsElement} */ (d).open = true
    }
  })

  collapseAllBtn.addEventListener('click', () => {
    for (const d of container.querySelectorAll('details.layer-panel')) {
      /** @type {HTMLDetailsElement} */ (d).open = false
    }
  })

  copyAllBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(JSON.stringify(worlds, null, 2)).then(() => {
      copyAllBtn.textContent = 'copied!'
      setTimeout(() => { copyAllBtn.textContent = 'copy all json' }, 1500)
    })
  })

  toolbar.append(expandAllBtn, collapseAllBtn, copyAllBtn)
  container.appendChild(toolbar)

  const fragment = document.createDocumentFragment()

  for (const world of worlds) {
    const myth = /** @type {CreationMyth} */ (world.myth)
    const card = document.createElement('section')
    card.className = 'myth-section myth-card'

    const cardHeader = document.createElement('div')
    cardHeader.className = 'seed-header'

    const seedTag = document.createElement('span')
    seedTag.className = 'badge badge--seed'
    seedTag.textContent = myth.seed

    const recipeBadge = document.createElement('span')
    recipeBadge.className = 'badge badge--recipe'
    recipeBadge.textContent = myth.recipe

    cardHeader.append(seedTag, recipeBadge)
    card.appendChild(cardHeader)
    card.appendChild(renderLayerPanels(world, false))
    fragment.appendChild(card)
  }

  container.appendChild(fragment)
}
