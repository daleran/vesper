/**
 * @import { CreationMyth } from './recipes/index.js'
 * @import { Pantheon, Agent } from './pantheon.js'
 * @import { MythicHistory } from './history.js'
 */

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
 * @returns {{ getSeed: () => string }}
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

  return { getSeed: () => seedInput.value }
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

/**
 * Render a myth into the output container.
 * @param {HTMLElement} container
 * @param {string} prose
 * @param {CreationMyth} myth
 * @param {Pantheon} [pantheon]
 * @param {MythicHistory} [history]
 */
export function displayMyth(container, prose, myth, pantheon, history) {
  container.innerHTML = ''

  const section = document.createElement('section')
  section.className = 'myth-section'

  const properNouns = collectProperNouns(pantheon, history)

  const heading = document.createElement('h2')
  heading.className = 'section-heading'
  heading.textContent = 'creation myth'

  const headerLine = document.createElement('div')
  headerLine.className = 'event-header'

  const recipeBadge = document.createElement('span')
  recipeBadge.className = 'badge badge--recipe'
  recipeBadge.textContent = myth.recipe

  const copyBtn = document.createElement('button')
  copyBtn.className = 'small'
  copyBtn.textContent = 'copy'
  copyBtn.addEventListener('click', () => {
    const copyText = `[${myth.seed}]\n${prose}\n\n${formatStructure(myth, pantheon, history)}`
    navigator.clipboard.writeText(copyText).then(() => {
      copyBtn.textContent = 'copied!'
      setTimeout(() => { copyBtn.textContent = 'copy' }, 1500)
    })
  })

  headerLine.append(recipeBadge, copyBtn)

  const text = document.createElement('p')
  text.className = 'myth-text'
  text.innerHTML = highlightProperNouns(prose, properNouns)

  section.append(heading, headerLine, text)

  if (pantheon) {
    section.appendChild(renderPantheon(pantheon))
  }

  if (history && history.events.length > 0) {
    section.appendChild(renderHistory(history, properNouns))
    section.appendChild(renderRegions(history))
  }

  container.appendChild(section)

  // Collapsible structure panel
  const structureSection = document.createElement('div')
  structureSection.className = 'structure-section'

  const toggle = document.createElement('button')
  toggle.className = 'structure-toggle'
  toggle.textContent = '▶ show structure'

  const body = document.createElement('div')
  body.className = 'structure-body'
  body.textContent = formatStructure(myth, pantheon, history)

  toggle.addEventListener('click', () => {
    const open = body.classList.toggle('open')
    toggle.textContent = open ? '▼ hide structure' : '▶ show structure'
  })

  structureSection.append(toggle, body)
  container.appendChild(structureSection)
}

/**
 * Render a batch of myths into the output container.
 * @param {HTMLElement} container
 * @param {{ prose: string, myth: CreationMyth, pantheon?: Pantheon, history?: MythicHistory }[]} items
 */
export function displayMythBatch(container, items) {
  container.innerHTML = ''

  // Batch toolbar: expand/collapse all + copy all
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
  copyAllBtn.textContent = 'copy all'

  expandAllBtn.addEventListener('click', () => {
    for (const body of container.querySelectorAll('.structure-body')) {
      body.classList.add('open')
    }
    for (const tog of container.querySelectorAll('.structure-toggle')) {
      tog.textContent = '▼ hide structure'
    }
  })

  collapseAllBtn.addEventListener('click', () => {
    for (const body of container.querySelectorAll('.structure-body')) {
      body.classList.remove('open')
    }
    for (const tog of container.querySelectorAll('.structure-toggle')) {
      tog.textContent = '▶ show structure'
    }
  })

  copyAllBtn.addEventListener('click', () => {
    const parts = items.map(({ prose, myth, pantheon, history }) =>
      `[${myth.seed}]\n${prose}\n\n${formatStructure(myth, pantheon, history)}`
    )
    navigator.clipboard.writeText(parts.join('\n\n---\n\n')).then(() => {
      copyAllBtn.textContent = 'copied!'
      setTimeout(() => { copyAllBtn.textContent = 'copy all' }, 1500)
    })
  })

  toolbar.append(expandAllBtn, collapseAllBtn, copyAllBtn)
  container.appendChild(toolbar)

  for (const { prose, myth, pantheon, history } of items) {
    const card = document.createElement('section')
    card.className = 'myth-section myth-card'

    const seedTag = document.createElement('span')
    seedTag.className = 'badge badge--seed'
    seedTag.textContent = myth.seed

    const recipeBadge = document.createElement('span')
    recipeBadge.className = 'badge badge--recipe'
    recipeBadge.textContent = myth.recipe

    const properNouns = collectProperNouns(pantheon, history)

    const text = document.createElement('p')
    text.className = 'myth-text'
    text.innerHTML = highlightProperNouns(prose, properNouns)

    card.append(seedTag, recipeBadge, text)

    if (pantheon) {
      card.appendChild(renderPantheon(pantheon))
    }

    if (history && history.events.length > 0) {
      card.appendChild(renderHistory(history, properNouns))
      card.appendChild(renderRegions(history))
    }

    const structureSection = document.createElement('div')
    structureSection.className = 'structure-section'

    const toggle = document.createElement('button')
    toggle.className = 'structure-toggle'
    toggle.textContent = '▶ show structure'

    const body = document.createElement('div')
    body.className = 'structure-body'
    body.textContent = formatStructure(myth, pantheon, history)

    toggle.addEventListener('click', () => {
      const open = body.classList.toggle('open')
      toggle.textContent = open ? '▼ hide structure' : '▶ show structure'
    })

    structureSection.append(toggle, body)
    card.appendChild(structureSection)
    container.appendChild(card)
  }
}

/**
 * Render a pantheon as a DOM element displayed below the myth.
 * @param {Pantheon} pantheon
 * @returns {HTMLElement}
 */
function renderPantheon(pantheon) {
  const container = document.createElement('div')
  container.className = 'divider-section'

  const heading = document.createElement('h3')
  heading.className = 'section-heading'
  heading.textContent = 'pantheon'
  container.appendChild(heading)

  for (let i = 0; i < pantheon.agents.length; i++) {
    const agent = pantheon.agents[i]
    container.appendChild(renderAgent(agent, i, pantheon.agents))
  }

  if (pantheon.tensions.length > 0) {
    const tensionEl = document.createElement('p')
    tensionEl.className = 'pantheon-tensions'
    tensionEl.textContent = `tensions: ${pantheon.tensions.map(t => t.replace(':', ' / ')).join(', ')}`
    container.appendChild(tensionEl)
  }

  return container
}

/**
 * Render a single agent as a compact DOM element.
 * @param {Agent} agent
 * @param {number} index
 * @param {Agent[]} allAgents
 * @returns {HTMLElement}
 */
function renderAgent(agent, index, allAgents) {
  void index
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
      ? agent.relationships.map(r => `${r.kind} of ${allAgents[r.target]?.name ?? '?'}`).join(', ')
      : '',
  ].filter(Boolean).join(' · ')

  el.appendChild(details)
  return el
}

// ── Proper noun highlighting ──

/**
 * Collect all proper nouns (agent names, region names) from pantheon and history.
 * @param {Pantheon} [pantheon]
 * @param {MythicHistory} [history]
 * @returns {string[]}
 */
function collectProperNouns(pantheon, history) {
  /** @type {string[]} */
  const names = []
  if (pantheon) {
    for (const agent of pantheon.agents) {
      if (agent.name) names.push(agent.name)
    }
  }
  if (history) {
    for (const region of history.regions) {
      if (region.name) names.push(region.name)
    }
    for (const agent of history.spawnedAgents) {
      if (agent.name) names.push(agent.name)
    }
  }
  // Sort longest first so longer names match before shorter substrings
  names.sort((a, b) => b.length - a.length)
  return names
}

/**
 * Escape a string for use in a regex.
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replace proper nouns in text with styled HTML spans.
 * Returns HTML string safe for innerHTML (text is escaped first).
 * @param {string} text
 * @param {string[]} properNouns
 * @returns {string}
 */
function highlightProperNouns(text, properNouns) {
  if (properNouns.length === 0) return escapeHtml(text)
  const pattern = new RegExp(`(${properNouns.map(escapeRegex).join('|')})`, 'g')
  // Split on proper nouns, escape each segment, wrap matches in spans
  const parts = text.split(pattern)
  const nounSet = new Set(properNouns)
  return parts.map(part =>
    nounSet.has(part)
      ? `<span class="proper-noun">${escapeHtml(part)}</span>`
      : escapeHtml(part)
  ).join('')
}

/**
 * Escape HTML special characters.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── History and Region rendering ──

/**
 * Render mythic history as a timeline section.
 * @param {MythicHistory} history
 * @param {string[]} properNouns
 * @returns {HTMLElement}
 */
function renderHistory(history, properNouns) {
  const container = document.createElement('div')
  container.className = 'divider-section'

  const heading = document.createElement('h3')
  heading.className = 'section-heading'
  heading.textContent = 'mythic history'
  container.appendChild(heading)

  for (const event of history.events) {
    const card = document.createElement('div')
    card.className = 'event-card'

    const headerLine = document.createElement('div')
    headerLine.className = 'event-header'

    const badge = document.createElement('span')
    badge.className = `badge badge--${event.archetype}`
    badge.textContent = event.archetype

    headerLine.appendChild(badge)
    card.appendChild(headerLine)

    if (event.prose) {
      const prose = document.createElement('p')
      prose.className = 'event-prose'
      prose.innerHTML = highlightProperNouns(event.prose, properNouns)
      card.appendChild(prose)
    }

    // Agent state changes
    const changes = event.agentChanges.filter(c => c.newState || c.newType)
    if (changes.length > 0) {
      const changesEl = document.createElement('div')
      changesEl.className = 'event-changes'
      const allAgents = [...history.agents, ...history.spawnedAgents]
      changesEl.textContent = changes.map(c => {
        const agent = allAgents[c.agentIndex]
        const name = agent?.name ?? '?'
        const parts = []
        if (c.newState) parts.push(c.newState)
        if (c.newType) parts.push(`became ${c.newType}`)
        return `${name}: ${parts.join(', ')}`
      }).join(' · ')
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
      }).join(' · ')
      card.appendChild(spawnsEl)
    }

    // Region tags
    if (event.regionTags.length > 0) {
      const regionsEl = document.createElement('div')
      regionsEl.className = 'event-regions'
      const regionNames = event.regionTags.map(id => {
        const region = history.regions.find(r => r.id === id)
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
 * @param {MythicHistory} history
 * @returns {HTMLElement}
 */
function renderRegions(history) {
  const container = document.createElement('div')
  container.className = 'divider-section'

  const heading = document.createElement('h3')
  heading.className = 'section-heading'
  heading.textContent = 'regions'
  container.appendChild(heading)

  for (const region of history.regions) {
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

// ── Structure formatting ──

/**
 * Format a creation myth as readable debug text.
 * @param {CreationMyth} myth
 * @param {Pantheon} [pantheon]
 * @param {MythicHistory} [history]
 * @returns {string}
 */
function formatStructure(myth, pantheon, history) {
  const lines = []
  lines.push(`seed: ${myth.seed}`)
  lines.push(`recipe: ${myth.recipe}`)
  lines.push('')
  const fmtRoles = (/** @type {Record<string, string>} */ r) =>
    Object.entries(r).map(([k, v]) => `${k}=${v}`).join(', ')
  lines.push(`before: ${fmtRoles(myth.before.roles)}`)
  lines.push(`act: ${fmtRoles(myth.act.roles)}`)
  lines.push(`cost: ${fmtRoles(myth.cost.roles)}`)
  lines.push(`flaw: ${fmtRoles(myth.flaw.roles)}`)
  lines.push('')
  lines.push(`creators: ${myth.creators.join(', ')}`)
  lines.push(`important: ${myth.important.join(', ')}`)
  lines.push(`bad: ${myth.bad.join(', ')}`)
  lines.push(`before: ${myth.worldBefore}`)
  lines.push(`after: ${myth.worldAfter}`)
  lines.push(`ingredients: ${myth.ingredients.join(', ')}`)
  if (Object.keys(myth.extra).length > 0) {
    lines.push('')
    for (const [k, v] of Object.entries(myth.extra)) {
      lines.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    }
  }
  if (pantheon) {
    lines.push('')
    lines.push('── pantheon ──')
    for (const agent of pantheon.agents) {
      const rels = agent.relationships.map(r => `${r.kind}→${pantheon.agents[r.target]?.name ?? '?'}`).join(', ')
      lines.push(`${agent.name} "${agent.title}" [${agent.type}] ${agent.state} — ${agent.disposition} — ${agent.domains.join(', ')}${rels ? ` — ${rels}` : ''}`)
    }
    if (pantheon.tensions.length > 0) {
      lines.push(`tensions: ${pantheon.tensions.join(', ')}`)
    }
  }
  if (history && history.events.length > 0) {
    lines.push('')
    lines.push('── mythic history ──')
    for (const event of history.events) {
      lines.push(`event ${event.index}: ${event.archetype}`)
      lines.push(`  situation: ${fmtRoles(event.situation.roles)}`)
      lines.push(`  action: ${fmtRoles(event.action.roles)}`)
      lines.push(`  consequence: ${fmtRoles(event.consequence.roles)}`)
      lines.push(`  legacy: ${fmtRoles(event.legacy.roles)}`)
      if (event.regionTags.length > 0) {
        lines.push(`  regions: ${event.regionTags.join(', ')}`)
      }
    }
    lines.push('')
    lines.push('── regions ──')
    for (const region of history.regions) {
      lines.push(`${region.name} [${region.id}]: ${region.concepts.join(', ')}`)
    }
    if (history.spawnedAgents.length > 0) {
      lines.push('')
      lines.push('── spawned agents ──')
      for (const agent of history.spawnedAgents) {
        lines.push(`${agent.name} [${agent.type}] ${agent.state} — ${agent.domains.join(', ')}`)
      }
    }
  }
  return lines.join('\n')
}
