/**
 * @import { CreationMyth } from './recipes/index.js'
 * @import { Pantheon, Agent } from './pantheon.js'
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
 */
export function displayMyth(container, prose, myth, pantheon) {
  container.innerHTML = ''

  const section = document.createElement('section')
  section.className = 'myth-section'

  const text = document.createElement('p')
  text.className = 'myth-text'
  text.textContent = prose

  section.appendChild(text)

  if (pantheon) {
    section.appendChild(renderPantheon(pantheon))
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
  body.textContent = formatStructure(myth, pantheon)

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
 * @param {{ prose: string, myth: CreationMyth, pantheon?: Pantheon }[]} items
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
    const parts = items.map(({ prose, myth, pantheon }) =>
      `[${myth.seed}]\n${prose}\n\n${formatStructure(myth, pantheon)}`
    )
    navigator.clipboard.writeText(parts.join('\n\n---\n\n')).then(() => {
      copyAllBtn.textContent = 'copied!'
      setTimeout(() => { copyAllBtn.textContent = 'copy all' }, 1500)
    })
  })

  toolbar.append(expandAllBtn, collapseAllBtn, copyAllBtn)
  container.appendChild(toolbar)

  for (const { prose, myth, pantheon } of items) {
    const card = document.createElement('section')
    card.className = 'myth-section myth-card'

    const seedTag = document.createElement('span')
    seedTag.className = 'myth-seed-tag'
    seedTag.textContent = myth.seed

    const text = document.createElement('p')
    text.className = 'myth-text'
    text.textContent = prose

    card.append(seedTag, text)

    if (pantheon) {
      card.appendChild(renderPantheon(pantheon))
    }

    const structureSection = document.createElement('div')
    structureSection.className = 'structure-section'

    const toggle = document.createElement('button')
    toggle.className = 'structure-toggle'
    toggle.textContent = '▶ show structure'

    const body = document.createElement('div')
    body.className = 'structure-body'
    body.textContent = formatStructure(myth, pantheon)

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
  container.className = 'pantheon-section'

  const heading = document.createElement('h3')
  heading.className = 'pantheon-heading'
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
  typeBadge.className = `agent-type agent-type--${agent.type}`
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

/**
 * Format a creation myth as readable debug text.
 * @param {CreationMyth} myth
 * @param {Pantheon} [pantheon]
 * @returns {string}
 */
function formatStructure(myth, pantheon) {
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
  return lines.join('\n')
}
