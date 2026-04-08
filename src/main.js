import { TRIPLES, buildGraph } from './concepts.js'
import { createWorld } from './world.js'
import { createTimeline } from './timeline.js'
import { simulateCreation } from './ages/creation.js'
import { simulateHeroAge } from './ages/heroes.js'
import { simulateCurrentAge } from './ages/current.js'
import { buildControls, showEmptyState, displayGenerationLog, displayGame } from './ui/index.js'
import { buildExplorer } from './explorer.js'
import { mulberry32, hashSeed, pick } from './utils.js'
import { query } from './query.js'
import { RECIPES } from './recipes/index.js'

const graph = buildGraph(TRIPLES)

// Expose query builder to console for testing
if (/** @type {any} */ (import.meta).env?.DEV) {
  // @ts-ignore
  window.query = () => query(graph)
}

const controls = /** @type {HTMLElement} */ (document.getElementById('controls'))
const tabsEl   = /** @type {HTMLElement} */ (document.getElementById('tabs'))
const output   = /** @type {HTMLElement} */ (document.getElementById('output'))
const explorer = /** @type {HTMLElement} */ (document.getElementById('explorer'))

// ── Tab switching ──

/** @type {import('./world.js').World|null} */
let currentWorld = null

/**
 * @param {'log'|'game'|'concepts'} tab
 */
function switchTab(tab) {
  controls.hidden = tab !== 'log'
  output.hidden = false
  explorer.hidden = tab !== 'concepts'
  if (tab === 'concepts') output.hidden = true
  for (const btn of tabsEl.querySelectorAll('.tab-btn')) {
    btn.classList.toggle('active', /** @type {HTMLElement} */ (btn).dataset['tab'] === tab)
  }
  if (tab === 'concepts') {
    buildExplorer(explorer, TRIPLES)
  } else if (tab === 'game') {
    if (currentWorld) {
      displayGame(output, currentWorld, graph)
    } else {
      showEmptyState(output)
    }
  } else if (tab === 'log') {
    if (currentWorld) {
      displayGenerationLog(output, currentWorld)
    } else {
      showEmptyState(output)
    }
  }
}

for (const [id, label] of /** @type {[string, string][]} */ ([
  ['log', 'log'],
  ['game', 'game'],
  ['concepts', 'concepts'],
])) {
  const btn = document.createElement('button')
  btn.className = 'tab-btn'
  btn.dataset['tab'] = id
  btn.textContent = label
  btn.addEventListener('click', () => switchTab(/** @type {'log'|'game'|'concepts'} */ (id)))
  tabsEl.appendChild(btn)
}

switchTab('log')

// ── Generate tab ──
/**
 * Build a complete world from a seed.
 * @param {string} seed
 * @param {string} [forceRecipe]
 * @returns {import('./world.js').World}
 */
function buildWorld(seed, forceRecipe) {
  const world = createWorld(seed)
  world.timeline = createTimeline()
  simulateCreation(graph, world, seed, forceRecipe)
  simulateHeroAge(graph, world, seed)
  simulateCurrentAge(graph, world, seed)
  return world
}

const ui = buildControls(controls, ({ seed }) => {
  const world = buildWorld(seed)
  currentWorld = world
  window.location.hash = `seed=${encodeURIComponent(seed)}`
  displayGenerationLog(output, world)
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

  /** @type {import('./world.js').World[]} */
  const worlds = []
  for (let i = 0; i < count; i++) {
    const seed = Math.random().toString(36).slice(2, 10)
    worlds.push(buildWorld(seed, schedule[i]))
  }
  // For batch mode, just show the first world's log
  if (worlds.length > 0) {
    currentWorld = worlds[0]
    displayGenerationLog(output, worlds[0])
  }
})

// ── Seed permalink: auto-generate from URL hash ──
const hashParams = new URLSearchParams(window.location.hash.slice(1))
const hashSeedValue = hashParams.get('seed')
if (hashSeedValue) {
  ui.setSeed(hashSeedValue)
  const world = buildWorld(hashSeedValue)
  currentWorld = world
  displayGenerationLog(output, world)
} else {
  showEmptyState(output)
}
