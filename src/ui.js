/**
 * @import { CreationMyth } from './recipes/index.js'
 * @import { Agent } from './pantheon.js'
 * @import { World, GeogonyData, BiogonyData, AnthropogonyData, ChorogonyData } from './world.js'
 * @import { HierogonyData } from './hierogony.js'
 */
import { findAgent } from './world.js'

/**
 * @typedef {{ seed: string }} MythParams
 * @typedef {(params: MythParams) => void} GenerateCallback
 * @typedef {(count: number) => void} BatchCallback
 */

/**
 * Generate a random seed string.
 * @returns {string}
 */
function randomSeedString() {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Build the controls header and bind generation to the callback.
 * @param {HTMLElement} container
 * @param {GenerateCallback} onGenerate
 * @param {BatchCallback} [onBatch]
 * @returns {{ getSeed: () => string, setSeed: (v: string) => void }}
 */
export function buildControls(container, onGenerate, onBatch) {
  const title = document.createElement('span')
  title.className = 'controls-title'
  title.textContent = 'First Light'

  const seedGroup = document.createElement('div')
  seedGroup.className = 'control-group'

  const seedLabel = document.createElement('label')
  seedLabel.textContent = 'seed'

  const seedInput = document.createElement('input')
  seedInput.type = 'text'
  seedInput.value = randomSeedString()
  seedInput.placeholder = 'enter a seed'
  seedInput.setAttribute('aria-label', 'seed')

  const randomBtn = document.createElement('button')
  randomBtn.className = 'small'
  randomBtn.textContent = 'random'
  randomBtn.addEventListener('click', () => {
    seedInput.value = randomSeedString()
  })

  seedGroup.append(seedLabel, seedInput, randomBtn)

  const generateBtn = document.createElement('button')
  generateBtn.className = 'primary'
  generateBtn.textContent = 'generate'

  function generate() {
    onGenerate({ seed: seedInput.value || 'default' })
  }

  generateBtn.addEventListener('click', generate)
  seedInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') generate()
  })

  const batchBtn = document.createElement('button')
  batchBtn.textContent = 'batch 20'
  batchBtn.addEventListener('click', () => {
    if (onBatch) onBatch(20)
  })

  container.append(title, seedGroup, generateBtn, batchBtn)

  return {
    getSeed: () => seedInput.value,
    setSeed: (/** @type {string} */ v) => { seedInput.value = v },
  }
}

/**
 * Clear the output and show an empty state prompt.
 * @param {HTMLElement} container
 */
export function showEmptyState(container) {
  container.innerHTML = ''
  const empty = document.createElement('p')
  empty.className = 'empty-state'
  empty.textContent = 'Enter a seed and click generate.'
  container.appendChild(empty)
}

// ── Shared helpers ──

/**
 * Create a labeled meta row (label: value).
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
function createMetaRow(label, value) {
  const row = document.createElement('div')
  row.className = 'meta-row'
  const lbl = document.createElement('span')
  lbl.className = 'meta-label'
  lbl.textContent = label
  const val = document.createElement('span')
  val.className = 'meta-value'
  val.textContent = value
  row.append(lbl, val)
  return row
}

/**
 * Render a beat's roles as a definition list + concepts as badge row.
 * @param {string} beatName
 * @param {{ roles: Record<string, string>, concepts: string[] }} beat
 * @returns {HTMLElement}
 */
function renderBeat(beatName, beat) {
  const section = document.createElement('div')
  section.className = 'beat-section'

  const heading = document.createElement('h4')
  heading.className = 'beat-heading'
  heading.textContent = beatName

  const dl = document.createElement('dl')
  dl.className = 'beat-roles'
  for (const [key, val] of Object.entries(beat.roles)) {
    const dt = document.createElement('dt')
    dt.className = 'beat-role-key'
    dt.textContent = key

    const dd = document.createElement('dd')
    dd.className = 'beat-role-value'
    dd.textContent = val

    dl.append(dt, dd)
  }

  section.append(heading, dl)

  if (beat.concepts.length > 0) {
    const row = document.createElement('div')
    row.className = 'concept-row'
    for (const c of beat.concepts) {
      const tag = document.createElement('span')
      tag.className = 'concept-tag'
      tag.textContent = c
      row.appendChild(tag)
    }
    section.appendChild(row)
  }

  return section
}

/**
 * Create a collapsible JSON toggle for a data object.
 * @param {object} data
 * @returns {HTMLElement}
 */
function createJsonToggle(data) {
  const wrapper = document.createElement('div')
  wrapper.className = 'json-section'

  const toggle = document.createElement('button')
  toggle.className = 'json-toggle'
  toggle.textContent = '{ } json'

  const body = document.createElement('pre')
  body.className = 'json-body'

  let loaded = false
  toggle.addEventListener('click', () => {
    if (!loaded) {
      body.textContent = JSON.stringify(data, null, 2)
      loaded = true
    }
    const open = body.classList.toggle('open')
    toggle.classList.toggle('open', open)
  })

  wrapper.append(toggle, body)
  return wrapper
}

/**
 * Create a layer panel (collapsible details element).
 * @param {string} title
 * @param {boolean} [open]
 * @returns {{ panel: HTMLDetailsElement, body: HTMLDivElement }}
 */
function createLayerPanel(title, open = true) {
  const panel = document.createElement('details')
  panel.className = 'layer-panel'
  panel.open = open

  const summary = document.createElement('summary')
  summary.className = 'layer-heading'
  summary.textContent = title

  const body = document.createElement('div')
  body.className = 'layer-body'

  panel.append(summary, body)
  return { panel, body }
}

// ── Layer 0: Cosmogony ──

/**
 * Render Layer 0 cosmogony data.
 * @param {CreationMyth} myth
 * @returns {HTMLElement}
 */
function renderCosmogony(myth) {
  const container = document.createElement('div')

  // World transition
  const transition = document.createElement('div')
  transition.className = 'world-transition'
  transition.textContent = `${myth.worldBefore} \u2192 ${myth.worldAfter}`
  container.appendChild(transition)

  // Four beats
  for (const [name, beat] of /** @type {[string, { roles: Record<string,string>, concepts: string[] }][]} */ ([
    ['before', myth.before],
    ['act', myth.act],
    ['cost', myth.cost],
    ['flaw', myth.flaw],
  ])) {
    container.appendChild(renderBeat(name, beat))
  }

  // Creators / important / bad
  const meta = document.createElement('div')
  meta.className = 'myth-meta'

  for (const [label, items] of /** @type {[string, string[]][]} */ ([
    ['creators', myth.creators],
    ['important', myth.important],
    ['bad', myth.bad],
    ['ingredients', myth.ingredients],
  ])) {
    if (items.length > 0) {
      meta.appendChild(createMetaRow(label, items.join(', ')))
    }
  }

  container.appendChild(meta)

  // Extra fields
  if (Object.keys(myth.extra).length > 0) {
    const extra = document.createElement('div')
    extra.className = 'myth-meta'
    for (const [k, v] of Object.entries(myth.extra)) {
      extra.appendChild(createMetaRow(k, Array.isArray(v) ? v.join(', ') : String(v)))
    }
    container.appendChild(extra)
  }

  return container
}

// ── Layer 1: Theogony ──

/**
 * Render a pantheon as a DOM element.
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderPantheon(world) {
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

/**
 * Render a single agent as a compact DOM element.
 * @param {Agent} agent
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderAgent(agent, world) {
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

// ── History and Region rendering ──

/**
 * Render mythic history as a timeline section.
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderHistory(world) {
  const container = document.createElement('div')

  for (const event of world.events) {
    const card = document.createElement('div')
    card.className = 'event-card'

    const headerLine = document.createElement('div')
    headerLine.className = 'event-header'

    const badge = document.createElement('span')
    badge.className = `badge badge--${event.archetype}`
    badge.textContent = `${event.index}: ${event.archetype}`

    headerLine.appendChild(badge)
    card.appendChild(headerLine)

    // Event beats
    for (const [name, beat] of /** @type {[string, { roles: Record<string,string>, concepts: string[] }][]} */ ([
      ['situation', event.situation],
      ['action', event.action],
      ['consequence', event.consequence],
      ['legacy', event.legacy],
    ])) {
      card.appendChild(renderBeat(name, beat))
    }

    // Agent state changes
    const changes = event.agentChanges.filter(c => c.newState || c.newType)
    if (changes.length > 0) {
      const changesEl = document.createElement('div')
      changesEl.className = 'event-changes'
      changesEl.textContent = changes.map(c => {
        const agent = findAgent(world, c.agentId)
        const name = agent?.name ?? '?'
        const parts = []
        if (c.newState) parts.push(c.newState)
        if (c.newType) parts.push(`became ${c.newType}`)
        return `${name}: ${parts.join(', ')}`
      }).join(' \u00b7 ')
      card.appendChild(changesEl)
    }

    // Spawned agents
    const spawns = event.agentChanges.filter(c => c.spawned)
    if (spawns.length > 0) {
      const spawnsEl = document.createElement('div')
      spawnsEl.className = 'event-changes'
      spawnsEl.textContent = spawns.map(c => {
        const domain = c.spawned?.domains[0] ?? '?'
        const type = c.spawned?.type ?? '?'
        return `spawned: ${domain} (${type})`
      }).join(' \u00b7 ')
      card.appendChild(spawnsEl)
    }

    // Region tags
    if (event.regionTags.length > 0) {
      const regionsEl = document.createElement('div')
      regionsEl.className = 'event-regions'
      const regionNames = event.regionTags.map(id => {
        const region = world.regions.find(r => r.id === id)
        return region?.name || id
      })
      regionsEl.textContent = `regions: ${regionNames.join(', ')}`
      card.appendChild(regionsEl)
    }

    container.appendChild(card)
  }

  return container
}

/**
 * Render regions as cards.
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderRegions(world) {
  const container = document.createElement('div')

  for (const region of world.regions) {
    const card = document.createElement('div')
    card.className = 'region-card'

    const name = document.createElement('span')
    name.className = 'region-name'
    name.textContent = region.name

    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = region.concepts.join(', ')

    const taggedBy = document.createElement('span')
    taggedBy.className = 'region-tagged-by'
    taggedBy.textContent = `tagged by event ${region.taggedBy.join(', ')}`

    card.append(name, concepts, taggedBy)
    container.appendChild(card)
  }

  return container
}

// ── Layer 2: Geogony ──

/**
 * Render geogony data as a DOM element.
 * @param {GeogonyData} geogony
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderGeogony(geogony, world) {
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
      card.className = 'region-card'

      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = terrain.name

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
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
      card.className = 'region-card'

      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = landmark.name

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
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

// ── Layer 3: Biogony ──

/**
 * Render biogony data as a DOM element.
 * @param {BiogonyData} biogony
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderBiogony(biogony, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = biogony.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Origin agent
  const meta = document.createElement('div')
  meta.className = 'myth-meta'

  if (biogony.lifeOriginAgent !== null) {
    const agent = findAgent(world, biogony.lifeOriginAgent)
    if (agent) {
      meta.appendChild(createMetaRow('life created by', agent.name))
    }
  }

  container.appendChild(meta)

  // Lifeforms
  if (biogony.lifeforms.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'lifeforms'
    container.appendChild(heading)

    for (const lf of biogony.lifeforms) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = lf.name

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = lf.concepts.join(', ')

      const detail = document.createElement('span')
      detail.className = 'region-tagged-by'
      const parts = [lf.behavior, lf.origin]
      if (lf.terrainAffinity.length > 0) {
        parts.push(lf.terrainAffinity.join(', '))
      }
      detail.textContent = parts.join(' \u00b7 ')

      card.append(name, concepts, detail)
      container.appendChild(card)
    }
  }

  // Flaw life
  if (biogony.flawLife.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'flaw life'
    container.appendChild(heading)

    const row = document.createElement('div')
    row.className = 'concept-row'
    for (const lf of biogony.flawLife) {
      const tag = document.createElement('span')
      tag.className = 'concept-tag'
      tag.textContent = `${lf.name} (${lf.behavior})`
      row.appendChild(tag)
    }
    container.appendChild(row)
  }

  // Extinctions
  if (biogony.extinctions.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'extinctions'
    container.appendChild(heading)

    const row = document.createElement('div')
    row.className = 'concept-row'
    for (const ext of biogony.extinctions) {
      const tag = document.createElement('span')
      tag.className = 'concept-tag'
      tag.textContent = ext
      row.appendChild(tag)
    }
    container.appendChild(row)
  }

  return container
}

// ── Layer 4: Anthropogony ──

/**
 * Render anthropogony data as a DOM element.
 * @param {AnthropogonyData} anthropogony
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderAnthropogony(anthropogony, world) {
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
      card.className = 'region-card'

      // Name + origin
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'

      const name = document.createElement('span')
      name.className = 'region-name'
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
      concepts.className = 'region-concepts'
      concepts.textContent = people.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  return container
}

// ── Layer 5: Chorogony ──

/**
 * Render a labeled tag row (label + concept badges).
 * @param {string} label
 * @param {string[]} items
 * @returns {HTMLElement|null}
 */
function renderTagRow(label, items) {
  if (items.length === 0) return null
  const row = document.createElement('div')
  row.className = 'agent-details'
  row.textContent = `${label}: ${items.join(', ')}`
  return row
}

/**
 * Render chorogony data as a DOM element.
 * @param {ChorogonyData} chorogony
 * @param {World} _world
 * @returns {HTMLElement}
 */
function renderChorogony(chorogony, _world) {
  const container = document.createElement('div')

  for (const region of chorogony.regions) {
    const card = document.createElement('div')
    card.className = 'region-card'

    // Name
    const name = document.createElement('span')
    name.className = 'region-name'
    name.textContent = region.name
    card.appendChild(name)

    // Concepts
    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = region.concepts.join(', ')
    card.appendChild(concepts)

    // Terrain, peoples, lifeforms, landmarks, resources, dangers, mood, climate
    for (const [label, items] of /** @type {[string, string[]][]} */ ([
      ['terrain', region.terrainTypes],
      ['peoples', region.peoples],
      ['lifeforms', region.lifeforms],
      ['landmarks', region.landmarks],
      ['resources', region.resources],
      ['dangers', region.dangers],
      ['mood', region.mood],
      ['climate', region.climate],
    ])) {
      const row = renderTagRow(label, items)
      if (row) card.appendChild(row)
    }

    // Tagged by events
    if (region.taggedBy.length > 0) {
      const taggedEl = document.createElement('span')
      taggedEl.className = 'region-tagged-by'
      taggedEl.textContent = `events: ${region.taggedBy.join(', ')}`
      card.appendChild(taggedEl)
    }

    container.appendChild(card)
  }

  return container
}

/**
 * Render hierogony data as a DOM element.
 * @param {HierogonyData} hierogony
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderHierogony(hierogony, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = hierogony.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Religions
  if (hierogony.religions.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'religions'
    container.appendChild(heading)

    for (const religion of hierogony.religions) {
      const card = document.createElement('div')
      card.className = 'region-card'

      // Name + origin
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = religion.name
      const originBadge = document.createElement('span')
      originBadge.className = 'badge badge--seed'
      originBadge.textContent = religion.originEvent
      nameLine.append(name, originBadge)
      card.appendChild(nameLine)

      // Worshipped agents
      if (religion.worshippedAgents.length > 0) {
        const agentNames = religion.worshippedAgents
          .map(id => findAgent(world, id)?.name ?? id)
          .join(', ')
        const row = renderTagRow('worships', [agentNames])
        if (row) card.appendChild(row)
      }

      // Peoples
      const peoplesRow = renderTagRow('peoples', religion.peoples)
      if (peoplesRow) card.appendChild(peoplesRow)

      // Rites and taboos
      const ritesRow = renderTagRow('rites', religion.rites)
      if (ritesRow) card.appendChild(ritesRow)
      const taboosRow = renderTagRow('taboos', religion.taboos)
      if (taboosRow) card.appendChild(taboosRow)

      // Concepts
      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = religion.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Heresies
  if (hierogony.heresies.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'heresies'
    container.appendChild(heading)

    for (const heresy of hierogony.heresies) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = heresy.name
      const originBadge = document.createElement('span')
      originBadge.className = 'badge badge--seed'
      originBadge.textContent = heresy.origin
      nameLine.append(name, originBadge)
      card.appendChild(nameLine)

      const deniesRow = renderTagRow('denies', heresy.denies)
      if (deniesRow) card.appendChild(deniesRow)
      const claimsRow = renderTagRow('claims', heresy.claims)
      if (claimsRow) card.appendChild(claimsRow)

      container.appendChild(card)
    }
  }

  // Sacred sites
  if (hierogony.sacredSites.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'sacred sites'
    container.appendChild(heading)

    for (const site of hierogony.sacredSites) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = site.name
      card.appendChild(name)

      const details = document.createElement('div')
      details.className = 'agent-details'
      details.textContent = `landmark: ${site.landmarkName}`
      card.appendChild(details)

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = site.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Practices
  if (hierogony.practices.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'practices'
    container.appendChild(heading)

    for (const practice of hierogony.practices) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = practice.name
      const typeBadge = document.createElement('span')
      typeBadge.className = 'badge badge--seed'
      typeBadge.textContent = practice.type
      nameLine.append(name, typeBadge)
      card.appendChild(nameLine)

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = practice.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  return container
}

// ── Layer registry ──

/**
 * @typedef {{
 *   title: string,
 *   show: (w: World) => boolean,
 *   render: (w: World) => (HTMLElement|DocumentFragment)[],
 *   data: (w: World) => object,
 * }} LayerDef
 */

/** @type {LayerDef[]} */
const LAYER_RENDERERS = [
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
    title: 'History',
    show: w => w.events.length > 0,
    render: w => [renderHistory(w), renderRegions(w)],
    data: w => ({ events: w.events, regions: w.regions }),
  },
]

/**
 * Render all layer panels for a world into a DocumentFragment.
 * @param {World} world
 * @param {boolean} [defaultOpen=true]
 * @returns {DocumentFragment}
 */
function renderLayerPanels(world, defaultOpen = true) {
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

// ── Main display functions ──

/**
 * Render a world into the output container with layer accordion.
 * @param {HTMLElement} container
 * @param {World} world
 */
export function displayMyth(container, world) {
  container.innerHTML = ''
  const myth = /** @type {CreationMyth} */ (world.myth)

  const section = document.createElement('section')
  section.className = 'myth-section'

  // Seed header
  const header = document.createElement('div')
  header.className = 'seed-header'

  const seedTag = document.createElement('span')
  seedTag.className = 'badge badge--seed'
  seedTag.textContent = myth.seed

  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = myth.recipe

  const copyBtn = document.createElement('button')
  copyBtn.className = 'small'
  copyBtn.textContent = 'copy json'
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(JSON.stringify(world, null, 2)).then(() => {
      copyBtn.textContent = 'copied!'
      setTimeout(() => { copyBtn.textContent = 'copy json' }, 1500)
    })
  })

  header.append(seedTag, recipeBadge, copyBtn)
  section.appendChild(header)

  section.appendChild(renderLayerPanels(world))

  container.appendChild(section)
}

/**
 * Render a batch of worlds into the output container.
 * @param {HTMLElement} container
 * @param {World[]} worlds
 */
export function displayMythBatch(container, worlds) {
  container.innerHTML = ''

  // Batch toolbar
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

    // Seed header
    const header = document.createElement('div')
    header.className = 'seed-header'

    const seedTag = document.createElement('span')
    seedTag.className = 'badge badge--seed'
    seedTag.textContent = myth.seed

    const recipeBadge = document.createElement('span')
    recipeBadge.className = 'badge badge--recipe'
    recipeBadge.textContent = myth.recipe

    header.append(seedTag, recipeBadge)
    card.appendChild(header)

    card.appendChild(renderLayerPanels(world, false))

    fragment.appendChild(card)
  }

  container.appendChild(fragment)
}
