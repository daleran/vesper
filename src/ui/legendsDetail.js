/**
 * Layer render functions and display logic for the Legends Mode detail pane.
 * Migrated from the monolithic src/ui.js.
 */

/**
 * @import { CreationMyth } from '../recipes/index.js'
 * @import { Agent } from '../pantheon.js'
 * @import { World, GeogonyData, BiogonyData, AnthropogonyData, ChorogonyData } from '../world.js'
 * @import { HierogonyData } from '../hierogony.js'
 * @import { PolitogonyData } from '../politogony.js'
 * @import { PresentData } from '../present.js'
 * @import { Artifact } from '../artifacts.js'
 * @import { PlayerCharacter } from '../character.js'
 * @import { MythText } from '../renderers/mythTexts.js'
 */
import { findAgent, findPolity, findReligion, findRegion, findEntity } from '../world.js'
import { createMetaRow, renderBeat, createJsonToggle, createLayerPanel, renderTagRow } from './components.js'

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

// ── Layer 6: Hierogony ──

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

// ── Layer 7: Politogony ──

/**
 * Render politogony data as a DOM element.
 * @param {PolitogonyData} politogony
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderPolitogony(politogony, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = politogony.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Polities
  if (politogony.polities.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'polities'
    container.appendChild(heading)

    for (const polity of politogony.polities) {
      const card = document.createElement('div')
      card.className = 'region-card'

      // Name + state + governance badges
      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = polity.name
      const stateBadge = document.createElement('span')
      stateBadge.className = 'badge badge--seed'
      stateBadge.textContent = polity.state
      const govBadge = document.createElement('span')
      govBadge.className = 'badge badge--recipe'
      govBadge.textContent = polity.governanceType
      nameLine.append(name, stateBadge, govBadge)
      card.appendChild(nameLine)

      // People
      const peopleRow = renderTagRow('people', [polity.peopleId])
      if (peopleRow) card.appendChild(peopleRow)

      // Patron agent
      if (polity.patronAgentId) {
        const agent = findAgent(world, polity.patronAgentId)
        const patronRow = renderTagRow('patron', [agent?.name ?? polity.patronAgentId])
        if (patronRow) card.appendChild(patronRow)
      }

      // Religion
      if (polity.religionId) {
        const religion = findReligion(world, polity.religionId)
        const religionRow = renderTagRow('religion', [religion?.name ?? polity.religionId])
        if (religionRow) card.appendChild(religionRow)
      }

      // Regions
      if (polity.regionIds.length > 0) {
        const regionNames = polity.regionIds.map(rid => {
          const region = findRegion(world, rid)
          return region?.name ?? rid
        })
        const regionsRow = renderTagRow('regions', regionNames)
        if (regionsRow) card.appendChild(regionsRow)
      }

      // Resources
      const resourcesRow = renderTagRow('resources', polity.resources)
      if (resourcesRow) card.appendChild(resourcesRow)

      // Concepts
      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = polity.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Conflicts
  if (politogony.conflicts.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'conflicts'
    container.appendChild(heading)

    for (const conflict of politogony.conflicts) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = conflict.name
      const intensityBadge = document.createElement('span')
      intensityBadge.className = 'badge badge--seed'
      intensityBadge.textContent = conflict.intensity
      const causeBadge = document.createElement('span')
      causeBadge.className = 'badge badge--recipe'
      causeBadge.textContent = conflict.cause
      nameLine.append(name, intensityBadge, causeBadge)
      card.appendChild(nameLine)

      const polityNames = conflict.polityIds.map(id =>
        politogony.polities.find(p => p.id === id)?.name ?? id
      )
      const partiesRow = renderTagRow('between', polityNames)
      if (partiesRow) card.appendChild(partiesRow)

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = conflict.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Alliances
  if (politogony.alliances.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'alliances'
    container.appendChild(heading)

    for (const alliance of politogony.alliances) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = alliance.name
      const basisBadge = document.createElement('span')
      basisBadge.className = 'badge badge--seed'
      basisBadge.textContent = alliance.basis
      nameLine.append(name, basisBadge)
      card.appendChild(nameLine)

      const polityNames = alliance.polityIds.map(id =>
        politogony.polities.find(p => p.id === id)?.name ?? id
      )
      const membersRow = renderTagRow('members', polityNames)
      if (membersRow) card.appendChild(membersRow)

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = alliance.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Ruins
  if (politogony.ruins.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'ruins'
    container.appendChild(heading)

    for (const ruin of politogony.ruins) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = ruin.name
      const formerPolity = politogony.polities.find(p => p.id === ruin.formerPolityId)
      const formerBadge = document.createElement('span')
      formerBadge.className = 'badge badge--seed'
      formerBadge.textContent = `former: ${formerPolity?.name ?? ruin.formerPolityId}`
      nameLine.append(name, formerBadge)
      card.appendChild(nameLine)

      const regionObj = findRegion(world, ruin.regionId)
      if (regionObj) {
        const regionRow = renderTagRow('region', [regionObj.name])
        if (regionRow) card.appendChild(regionRow)
      }

      const remainsRow = renderTagRow('remains', ruin.whatRemains)
      if (remainsRow) card.appendChild(remainsRow)

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = ruin.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Legends
  if (politogony.legends.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'legends'
    container.appendChild(heading)

    for (const legend of politogony.legends) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const polity = politogony.polities.find(p => p.id === legend.polityId)
      const polityName = document.createElement('span')
      polityName.className = 'region-name'
      polityName.textContent = polity?.name ?? legend.polityId
      const interpBadge = document.createElement('span')
      interpBadge.className = 'badge badge--seed'
      interpBadge.textContent = legend.interpretation
      nameLine.append(polityName, interpBadge)
      card.appendChild(nameLine)

      const event = world.events[legend.eventIndex]
      if (event) {
        const eventRow = renderTagRow('event', [`#${legend.eventIndex}: ${event.archetype}`])
        if (eventRow) card.appendChild(eventRow)
      }

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = legend.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  return container
}

// ── Layer 8: The Present ──

/**
 * Render present-layer data as a DOM element.
 * @param {PresentData} present
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderPresent(present, world) {
  const container = document.createElement('div')

  // Recipe badge
  const badgeRow = document.createElement('div')
  badgeRow.className = 'seed-header'
  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = present.recipe
  badgeRow.appendChild(recipeBadge)
  container.appendChild(badgeRow)

  // Crisis
  {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'crisis'
    container.appendChild(heading)

    const card = document.createElement('div')
    card.className = 'region-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const name = document.createElement('span')
    name.className = 'region-name'
    name.textContent = present.crisis.name
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = present.crisis.type
    const sevBadge = document.createElement('span')
    sevBadge.className = 'badge badge--seed'
    sevBadge.textContent = present.crisis.severity
    nameLine.append(name, typeBadge, sevBadge)
    card.appendChild(nameLine)

    // Affected regions
    if (present.crisis.affectedRegionIds.length > 0) {
      const regionNames = present.crisis.affectedRegionIds.map(rid => {
        const region = findRegion(world, rid)
        return region?.name ?? rid
      })
      const regionsRow = renderTagRow('affected regions', regionNames)
      if (regionsRow) card.appendChild(regionsRow)
    }

    // Flaw connection
    const flawRow = renderTagRow('flaw connection', present.crisis.flawConnection)
    if (flawRow) card.appendChild(flawRow)

    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = present.crisis.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  // Factions
  if (present.factions.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'factions'
    container.appendChild(heading)

    for (const faction of present.factions) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = faction.name
      const approachBadge = document.createElement('span')
      approachBadge.className = 'badge badge--recipe'
      approachBadge.textContent = faction.approach
      const strengthBadge = document.createElement('span')
      strengthBadge.className = 'badge badge--seed'
      strengthBadge.textContent = faction.strength
      nameLine.append(name, approachBadge, strengthBadge)
      card.appendChild(nameLine)

      // Member polities
      if (faction.polityIds.length > 0) {
        const polityNames = faction.polityIds.map(id =>
          findPolity(world, id)?.name ?? id
        )
        const polityRow = renderTagRow('polities', polityNames)
        if (polityRow) card.appendChild(polityRow)
      }

      // Leader agent
      if (faction.leaderAgentId) {
        const agent = findAgent(world, faction.leaderAgentId)
        const leaderRow = renderTagRow('leader', [agent?.name ?? faction.leaderAgentId])
        if (leaderRow) card.appendChild(leaderRow)
      }

      // Religions
      if (faction.religionIds.length > 0) {
        const religionNames = faction.religionIds.map(id =>
          findReligion(world, id)?.name ?? id
        )
        const relRow = renderTagRow('religions', religionNames)
        if (relRow) card.appendChild(relRow)
      }

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = faction.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Recent Event
  {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'recent event'
    container.appendChild(heading)

    const card = document.createElement('div')
    card.className = 'region-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const name = document.createElement('span')
    name.className = 'region-name'
    name.textContent = present.recentEvent.name
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = present.recentEvent.type
    nameLine.append(name, typeBadge)
    card.appendChild(nameLine)

    // Involved entities
    if (present.recentEvent.involvedEntityIds.length > 0) {
      const entityNames = present.recentEvent.involvedEntityIds.map(id => {
        const result = findEntity(world, id)
        return result ? /** @type {*} */ (result.entity).name : id
      })
      const entRow = renderTagRow('involves', entityNames)
      if (entRow) card.appendChild(entRow)
    }

    // Region
    if (present.recentEvent.regionId) {
      const region = findRegion(world, present.recentEvent.regionId)
      const regRow = renderTagRow('location', [region?.name ?? present.recentEvent.regionId])
      if (regRow) card.appendChild(regRow)
    }

    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = present.recentEvent.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  // Active Powers
  if (present.activePowers.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'active powers'
    container.appendChild(heading)

    for (const power of present.activePowers) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const agent = findAgent(world, power.agentId)
      const name = document.createElement('span')
      name.className = 'region-name'
      name.textContent = agent?.name ?? power.agentId
      const actionBadge = document.createElement('span')
      actionBadge.className = 'badge badge--seed'
      actionBadge.textContent = power.currentAction
      nameLine.append(name, actionBadge)
      card.appendChild(nameLine)

      // Faction alignment
      if (power.factionAlignment) {
        const faction = present.factions.find(f => f.id === power.factionAlignment)
        const facRow = renderTagRow('faction', [faction?.name ?? power.factionAlignment])
        if (facRow) card.appendChild(facRow)
      }

      // Region
      if (power.regionId) {
        const region = findRegion(world, power.regionId)
        const regRow = renderTagRow('location', [region?.name ?? power.regionId])
        if (regRow) card.appendChild(regRow)
      }

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = power.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Rumors
  if (present.rumors.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'rumors'
    container.appendChild(heading)

    for (const rumor of present.rumors) {
      const card = document.createElement('div')
      card.className = 'region-card'

      const nameLine = document.createElement('div')
      nameLine.className = 'agent-name-line'
      const claim = document.createElement('span')
      claim.className = 'region-name'
      claim.textContent = rumor.claim
      const truthBadge = document.createElement('span')
      truthBadge.className = 'badge badge--seed'
      truthBadge.textContent = rumor.isTrue ? 'true' : 'false'
      nameLine.append(claim, truthBadge)
      if (rumor.distortion) {
        const distBadge = document.createElement('span')
        distBadge.className = 'badge badge--recipe'
        distBadge.textContent = rumor.distortion
        nameLine.appendChild(distBadge)
      }
      card.appendChild(nameLine)

      const refRow = renderTagRow('about', [`${rumor.referencedEntityType}: ${rumor.referencedEntityId}`])
      if (refRow) card.appendChild(refRow)

      const concepts = document.createElement('span')
      concepts.className = 'region-concepts'
      concepts.textContent = rumor.concepts.join(', ')
      card.appendChild(concepts)

      container.appendChild(card)
    }
  }

  // Hidden Truth
  if (present.hiddenTruth.length > 0) {
    const heading = document.createElement('h4')
    heading.className = 'beat-heading'
    heading.textContent = 'hidden truth'
    container.appendChild(heading)

    const card = document.createElement('div')
    card.className = 'region-card'
    const chain = document.createElement('span')
    chain.className = 'region-concepts'
    chain.textContent = present.hiddenTruth.join(' \u2192 ')
    card.appendChild(chain)
    container.appendChild(card)
  }

  return container
}

// ── Artifacts ──

/**
 * Render artifacts as a DOM element.
 * @param {Artifact[]} artifacts
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderArtifacts(artifacts, world) {
  const container = document.createElement('div')

  for (const artifact of artifacts) {
    const card = document.createElement('div')
    card.className = 'region-card'

    // Name line with type, significance, condition badges
    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'region-name'
    nameEl.textContent = artifact.name
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = artifact.type
    const sigBadge = document.createElement('span')
    sigBadge.className = 'badge badge--seed'
    sigBadge.textContent = artifact.significance
    const condBadge = document.createElement('span')
    condBadge.className = 'badge'
    condBadge.textContent = artifact.condition
    nameLine.append(nameEl, typeBadge, sigBadge, condBadge)
    card.appendChild(nameLine)

    // Material
    const matRow = renderTagRow('material', [artifact.material])
    if (matRow) card.appendChild(matRow)

    // Origin
    const originParts = /** @type {string[]} */ ([artifact.origin.source])
    if (artifact.origin.eventIndex !== null) {
      originParts.push(`event ${artifact.origin.eventIndex}`)
    }
    if (artifact.origin.agentId) {
      const agent = findAgent(world, artifact.origin.agentId)
      if (agent) originParts.push(agent.name)
    }
    const originRow = renderTagRow('origin', originParts)
    if (originRow) card.appendChild(originRow)

    // Location
    const locationParts = []
    const region = findRegion(world, artifact.location.regionId)
    if (region) locationParts.push(region.name)
    if (artifact.location.landmarkName) locationParts.push(artifact.location.landmarkName)
    locationParts.push(artifact.location.status)
    const locRow = renderTagRow('location', locationParts)
    if (locRow) card.appendChild(locRow)

    // Concepts
    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = artifact.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}

// ── Character ──

/**
 * Render the character panel.
 * @param {PlayerCharacter} character
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderCharacter(character, world) {
  const container = document.createElement('div')
  const card = document.createElement('div')
  card.className = 'region-card'

  // Header: creator god name + title
  const nameLine = document.createElement('div')
  nameLine.className = 'agent-name-line'
  const creatorAgent = findAgent(world, character.creatorGod)
  const godName = document.createElement('span')
  godName.className = 'region-name'
  godName.textContent = creatorAgent ? `${creatorAgent.name}, ${creatorAgent.title}` : character.creatorGod
  const godBadge = document.createElement('span')
  godBadge.className = 'badge badge--recipe'
  godBadge.textContent = creatorAgent?.type ?? 'creator'
  nameLine.append(godName, godBadge)
  card.appendChild(nameLine)

  // Arrival
  const arrivalHeader = document.createElement('h4')
  arrivalHeader.textContent = 'arrival'
  card.appendChild(arrivalHeader)

  const arrivalRegion = findRegion(world, character.arrival.regionId)
  const arrivalParts = /** @type {string[]} */ ([])
  if (arrivalRegion) arrivalParts.push(arrivalRegion.name)
  if (character.arrival.landmarkId) {
    const landmark = (world.geogony?.landmarks ?? []).find(l => l.id === character.arrival.landmarkId)
    if (landmark) arrivalParts.push(landmark.name)
  }
  const arrivalRow = renderTagRow('location', arrivalParts)
  if (arrivalRow) card.appendChild(arrivalRow)

  const descEl = document.createElement('p')
  descEl.className = 'landmark-prose'
  descEl.textContent = character.arrival.description
  card.appendChild(descEl)

  // Appearance
  const appearHeader = document.createElement('h4')
  appearHeader.textContent = 'appearance'
  card.appendChild(appearHeader)

  const normalcyBadge = document.createElement('span')
  normalcyBadge.className = 'badge badge--seed'
  normalcyBadge.textContent = character.appearance.normalcy
  card.appendChild(normalcyBadge)

  if (character.appearance.details.length > 0) {
    const detailsRow = renderTagRow('traits', character.appearance.details)
    if (detailsRow) card.appendChild(detailsRow)
  }

  // Instincts
  if (character.instincts.length > 0) {
    const instHeader = document.createElement('h4')
    instHeader.textContent = 'instincts'
    card.appendChild(instHeader)
    const instRow = renderTagRow('', character.instincts)
    if (instRow) {
      instRow.className = 'agent-details'
      instRow.textContent = character.instincts.join('; ')
      card.appendChild(instRow)
    }
  }

  // Reactions
  const reactHeader = document.createElement('h4')
  reactHeader.textContent = 'reactions'
  card.appendChild(reactHeader)
  for (const [label, text] of [
    ['priests', character.reactions.priests],
    ['commoners', character.reactions.commoners],
    ['agents', character.reactions.agents],
    ['artifacts', character.reactions.artifacts],
  ]) {
    const row = document.createElement('div')
    row.className = 'agent-details'
    row.textContent = `${label}: ${text}`
    card.appendChild(row)
  }

  // Concepts footer
  const concepts = document.createElement('span')
  concepts.className = 'region-concepts'
  concepts.textContent = character.concepts.join(', ')
  card.appendChild(concepts)

  // Purpose (debug — hidden by default)
  const purposeDetails = document.createElement('details')
  const purposeSummary = document.createElement('summary')
  purposeSummary.textContent = 'purpose (debug)'
  purposeDetails.appendChild(purposeSummary)
  const purposeRow = document.createElement('div')
  purposeRow.className = 'agent-details'
  const purposeEntity = findEntity(world, character.purpose.target)
  const targetLabel = purposeEntity
    ? /** @type {*} */ (purposeEntity.entity).name ?? character.purpose.target
    : character.purpose.target
  purposeRow.textContent = `${character.purpose.type}: ${targetLabel}`
  const hiddenBadge = document.createElement('span')
  hiddenBadge.className = 'badge'
  hiddenBadge.textContent = 'hidden'
  purposeRow.appendChild(hiddenBadge)
  purposeDetails.appendChild(purposeRow)
  card.appendChild(purposeDetails)

  container.appendChild(card)
  return container
}

// ── Landmark Descriptions ──

/**
 * Render landmark prose descriptions as cards.
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderLandmarkDescriptions(world) {
  const container = document.createElement('div')
  const landmarks = world.geogony?.landmarks ?? []
  const descriptions = /** @type {Map<string, string>} */ (world.renderedLandmarks)

  for (const landmark of landmarks) {
    const prose = descriptions.get(landmark.id)
    if (!prose) continue

    const card = document.createElement('div')
    card.className = 'region-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'region-name'
    nameEl.textContent = landmark.name
    nameLine.appendChild(nameEl)
    card.appendChild(nameLine)

    const proseEl = document.createElement('div')
    proseEl.className = 'landmark-prose'
    for (const paragraph of prose.split('\n\n')) {
      const p = document.createElement('p')
      p.textContent = paragraph
      proseEl.appendChild(p)
    }
    card.appendChild(proseEl)

    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = landmark.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}

// ── Myth Texts ──

/**
 * Render myth texts as cards.
 * @param {MythText[]} texts
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderMythTexts(texts, world) {
  const container = document.createElement('div')

  for (const text of texts) {
    const card = document.createElement('div')
    card.className = 'region-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'region-name'
    nameEl.textContent = text.title
    const typeBadge = document.createElement('span')
    typeBadge.className = 'badge badge--recipe'
    typeBadge.textContent = text.type
    const perspBadge = document.createElement('span')
    perspBadge.className = 'badge badge--seed'
    perspBadge.textContent = text.perspective
    nameLine.append(nameEl, typeBadge, perspBadge)
    card.appendChild(nameLine)

    const bodyEl = document.createElement('p')
    bodyEl.className = 'text-body'
    bodyEl.textContent = text.body
    card.appendChild(bodyEl)

    if (text.referencedAgentIds.length > 0) {
      const names = text.referencedAgentIds
        .map(id => findAgent(world, id)?.name ?? id)
      const row = renderTagRow('agents', names)
      if (row) card.appendChild(row)
    }

    if (text.referencedArtifactIds.length > 0) {
      const names = text.referencedArtifactIds
        .map(id => (world.artifacts ?? []).find(a => a.id === id)?.name ?? id)
      const row = renderTagRow('artifacts', names)
      if (row) card.appendChild(row)
    }

    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = text.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}

// ── Region Descriptions ──

/**
 * Render region prose descriptions as cards.
 * @param {World} world
 * @returns {HTMLElement}
 */
function renderRegionDescriptions(world) {
  const container = document.createElement('div')
  const regions = world.chorogony?.regions ?? []
  const descriptions = /** @type {Map<string, string>} */ (world.renderedRegions)

  for (const region of regions) {
    const prose = descriptions.get(region.id)
    if (!prose) continue

    const card = document.createElement('div')
    card.className = 'region-card'

    const nameLine = document.createElement('div')
    nameLine.className = 'agent-name-line'
    const nameEl = document.createElement('span')
    nameEl.className = 'region-name'
    nameEl.textContent = region.name
    nameLine.appendChild(nameEl)
    card.appendChild(nameLine)

    const proseEl = document.createElement('div')
    proseEl.className = 'landmark-prose'
    for (const paragraph of prose.split('\n\n')) {
      const p = document.createElement('p')
      p.textContent = paragraph
      proseEl.appendChild(p)
    }
    card.appendChild(proseEl)

    const concepts = document.createElement('span')
    concepts.className = 'region-concepts'
    concepts.textContent = region.concepts.join(', ')
    card.appendChild(concepts)

    container.appendChild(card)
  }

  return container
}

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

/**
 * Render all layer panels for a world into a DocumentFragment.
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
