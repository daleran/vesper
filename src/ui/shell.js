/**
 * App shell: controls header, empty state, mode switching.
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
