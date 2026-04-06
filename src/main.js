import { TRIPLES, buildGraph } from './concepts.js'
import { generateMyth } from './myth.js'
import { renderProse } from './prose.js'
import { generatePantheon } from './pantheon.js'
import { buildControls, showEmptyState, displayMyth, displayMythBatch } from './ui.js'
import { buildExplorer } from './explorer.js'
import { mulberry32, hashSeed, pick } from './utils.js'
import { query } from './query.js'
import { RECIPES } from './recipes/index.js'

const graph = buildGraph(TRIPLES)

// Expose query builder to console for testing
// @ts-ignore
window.query = () => query(graph)

const controls = /** @type {HTMLElement} */ (document.getElementById('controls'))
const tabsEl   = /** @type {HTMLElement} */ (document.getElementById('tabs'))
const output   = /** @type {HTMLElement} */ (document.getElementById('output'))
const explorer = /** @type {HTMLElement} */ (document.getElementById('explorer'))

// ── Tab switching ──
/**
 * @param {'generate'|'concepts'} tab
 */
function switchTab(tab) {
  output.hidden = tab !== 'generate'
  explorer.hidden = tab !== 'concepts'
  for (const btn of tabsEl.querySelectorAll('.tab-btn')) {
    btn.classList.toggle('active', /** @type {HTMLElement} */ (btn).dataset['tab'] === tab)
  }
  if (tab === 'concepts') {
    buildExplorer(explorer, TRIPLES)
  }
}

for (const [id, label] of /** @type {[string, string][]} */ ([['generate', 'generate'], ['concepts', 'concepts']])) {
  const btn = document.createElement('button')
  btn.className = 'tab-btn'
  btn.dataset['tab'] = id
  btn.textContent = label
  btn.addEventListener('click', () => switchTab(/** @type {'generate'|'concepts'} */ (id)))
  tabsEl.appendChild(btn)
}

switchTab('generate')

// ── Generate tab ──
buildControls(controls, ({ seed }) => {
  const myth = generateMyth(graph, seed)
  const { prose } = renderProse(myth, graph)
  const pantheon = generatePantheon(graph, myth, mulberry32(hashSeed(seed + '-pantheon')))
  displayMyth(output, prose, myth, pantheon)
}, (count) => {
  // Build recipe schedule: one of each, then random fills for even distribution
  const recipeNames = RECIPES.map(r => r.name)
  /** @type {(string|undefined)[]} */
  const schedule = [...recipeNames]
  const batchRng = mulberry32(hashSeed(Math.random().toString(36)))
  while (schedule.length < count) {
    schedule.push(pick(batchRng, recipeNames))
  }
  // Shuffle so the order isn't always the same
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(batchRng() * (i + 1));
    [schedule[i], schedule[j]] = [schedule[j], schedule[i]]
  }

  const items = []
  for (let i = 0; i < count; i++) {
    const seed = Math.random().toString(36).slice(2, 10)
    const myth = generateMyth(graph, seed, schedule[i])
    const { prose } = renderProse(myth, graph)
    const pantheon = generatePantheon(graph, myth, mulberry32(hashSeed(seed + '-pantheon')))
    items.push({ prose, myth, pantheon })
  }
  displayMythBatch(output, items)
})

showEmptyState(output)
