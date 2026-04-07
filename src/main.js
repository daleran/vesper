import { TRIPLES, buildGraph } from './concepts.js'
import { generateMyth } from './myth.js'
import { generatePantheon } from './pantheon.js'
import { generateHistory } from './history.js'
import { generateGeogony } from './geogony.js'
import { generateBiogony } from './biogony.js'
import { generateAnthropogony } from './anthropogony.js'
import { generateChorogony } from './chorogony.js'
import { generateHierogony } from './hierogony.js'
import { generatePolitogony } from './politogony.js'
import { generatePresent } from './present.js'
import { generateArtifacts } from './artifacts.js'
import { generateCharacter } from './character.js'
import { renderLandmarks } from './renderers/landmarks.js'
import { renderRegions } from './renderers/regions.js'
import { generateMythTexts } from './renderers/mythTexts.js'
import { createWorld } from './world.js'
import { buildControls, showEmptyState, displayMyth, displayMythBatch, displayLegends, displayGame } from './ui/index.js'
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

/** @type {import('./world.js').World|null} */
let currentWorld = null

/**
 * @param {'generate'|'legends'|'game'|'concepts'} tab
 */
function switchTab(tab) {
  controls.hidden = tab !== 'generate'
  output.hidden = false
  explorer.hidden = tab !== 'concepts'
  if (tab === 'concepts') output.hidden = true
  for (const btn of tabsEl.querySelectorAll('.tab-btn')) {
    btn.classList.toggle('active', /** @type {HTMLElement} */ (btn).dataset['tab'] === tab)
  }
  if (tab === 'concepts') {
    buildExplorer(explorer, TRIPLES)
  } else if (tab === 'legends') {
    if (currentWorld) {
      displayLegends(output, currentWorld)
    } else {
      showEmptyState(output)
    }
  } else if (tab === 'game') {
    if (currentWorld) {
      displayGame(output, currentWorld)
    } else {
      showEmptyState(output)
    }
  }
}

for (const [id, label] of /** @type {[string, string][]} */ ([
  ['generate', 'generate'],
  ['legends', 'legends'],
  ['game', 'game'],
  ['concepts', 'concepts'],
])) {
  const btn = document.createElement('button')
  btn.className = 'tab-btn'
  btn.dataset['tab'] = id
  btn.textContent = label
  btn.addEventListener('click', () => switchTab(/** @type {'generate'|'legends'|'game'|'concepts'} */ (id)))
  tabsEl.appendChild(btn)
}

switchTab('generate')

// ── Generate tab ──
/**
 * Build a complete world from a seed.
 * @param {string} seed
 * @param {string} [forceRecipe]
 * @returns {import('./world.js').World}
 */
function buildWorld(seed, forceRecipe) {
  const world = createWorld(seed)
  world.myth = generateMyth(graph, seed, forceRecipe)
  generatePantheon(graph, world, mulberry32(hashSeed(seed + '-pantheon')))
  generateHistory(graph, world, mulberry32(hashSeed(seed + '-history')))
  generateGeogony(graph, world, mulberry32(hashSeed(seed + '-geogony')))
  generateBiogony(graph, world, mulberry32(hashSeed(seed + '-biogony')))
  generateAnthropogony(graph, world, mulberry32(hashSeed(seed + '-anthropogony')))
  generateChorogony(graph, world, mulberry32(hashSeed(seed + '-chorogony')))
  generateHierogony(graph, world, mulberry32(hashSeed(seed + '-hierogony')))
  generatePolitogony(graph, world, mulberry32(hashSeed(seed + '-politogony')))
  generatePresent(graph, world, mulberry32(hashSeed(seed + '-present')))
  generateArtifacts(graph, world, mulberry32(hashSeed(seed + '-artifacts')))
  generateCharacter(graph, world, mulberry32(hashSeed(seed + '-character')))
  world.texts = generateMythTexts(graph, world, mulberry32(hashSeed(seed + '-texts')))
  world.renderedLandmarks = renderLandmarks(graph, world, mulberry32(hashSeed(seed + '-landmarks')))
  world.renderedRegions = renderRegions(graph, world, mulberry32(hashSeed(seed + '-regions')))
  return world
}

const ui = buildControls(controls, ({ seed }) => {
  const world = buildWorld(seed)
  currentWorld = world
  window.location.hash = `seed=${encodeURIComponent(seed)}`
  displayMyth(output, world)
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
  displayMythBatch(output, worlds)
})

// ── Seed permalink: auto-generate from URL hash ──
const hashParams = new URLSearchParams(window.location.hash.slice(1))
const hashSeedValue = hashParams.get('seed')
if (hashSeedValue) {
  ui.setSeed(hashSeedValue)
  const world = buildWorld(hashSeedValue)
  currentWorld = world
  displayMyth(output, world)
} else {
  showEmptyState(output)
}
