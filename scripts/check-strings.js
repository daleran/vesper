/**
 * String reference consistency linter.
 * Checks that cross-file string references (recipe names, archetype keys,
 * agent enums, relation types, myth.extra keys) stay in sync.
 *
 * Run: node scripts/check-strings.js
 * Zero dependencies — uses only Node built-ins + project imports.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const SRC = resolve(ROOT, 'src')

// ── Helpers ──────────────────────────────────────────────────────────

/** @param {Set<string>} a @param {Set<string>} b @returns {string[]} */
function setDiff(a, b) {
  return [...a].filter(x => !b.has(x))
}

let failures = 0
let warnings = 0

/**
 * @param {boolean} ok
 * @param {string} label
 * @param {string[]} [errors]
 */
function report(ok, label, errors) {
  if (ok) {
    console.log(`  [PASS] ${label}`)
  } else {
    console.log(`  [FAIL] ${label}`)
    for (const e of errors ?? []) console.log(`         ${e}`)
    failures++
  }
}

/** @param {string} label @param {string[]} msgs */
function warn(label, msgs) {
  console.log(`  [WARN] ${label}`)
  for (const m of msgs) console.log(`         ${m}`)
  warnings++
}

/** @param {string} relPath @returns {string} */
function readSrc(relPath) {
  return readFileSync(resolve(SRC, relPath), 'utf8')
}

// ── Runtime imports ──────────────────────────────────────────────────

const { RECIPES } = await import(resolve(SRC, 'recipes/index.js'))
const { SHAPES } = await import(resolve(SRC, 'pantheonShapes.js'))
const {
  DELIBERATE_RECIPES, ORGANIC_RECIPES, CYCLIC_RECIPES,
  VIOLENT_RECIPES, SPREADING_RECIPES,
} = await import(resolve(SRC, 'archetypeSelection.js'))
const { RELATION_TYPES } = await import(resolve(SRC, 'concepts.js'))

const { GEOGONY_SHAPES, GEOGONY_NAMES } = await import(resolve(SRC, 'geogonyArchetypes.js'))
const { BIOGONY_SHAPES, BIOGONY_NAMES } = await import(resolve(SRC, 'biogonyArchetypes.js'))
const { ANTHROPOGONY_SHAPES, ANTHROPOGONY_NAMES } = await import(resolve(SRC, 'anthropogonyArchetypes.js'))
const { HIEROGONY_SHAPES, HIEROGONY_NAMES } = await import(resolve(SRC, 'hierogonyArchetypes.js'))
const { POLITOGONY_SHAPES, POLITOGONY_NAMES } = await import(resolve(SRC, 'politogonyArchetypes.js'))
const { PRESENT_SHAPES, PRESENT_NAMES } = await import(resolve(SRC, 'presentArchetypes.js'))
const { ARCHETYPES, ARCHETYPE_NAMES } = await import(resolve(SRC, 'historyArchetypes.js'))

// ── Check 1: Recipe names ↔ SHAPES keys ─────────────────────────────

function checkRecipeShapes() {
  console.log('\n1. Recipe names ↔ pantheon SHAPES keys')
  const recipeNames = new Set(RECIPES.map((/** @type {{ name: string }} */ r) => r.name))
  const shapeKeys = new Set(Object.keys(SHAPES))
  const missingInShapes = setDiff(recipeNames, shapeKeys)
  const extraInShapes = setDiff(shapeKeys, recipeNames)
  const errors = [
    ...missingInShapes.map(n => `recipe '${n}' has no SHAPES entry in pantheonShapes.js`),
    ...extraInShapes.map(n => `SHAPES key '${n}' has no matching recipe`),
  ]
  report(errors.length === 0, `${recipeNames.size} recipes, ${shapeKeys.size} SHAPES keys`, errors)
}

// ── Check 2: Recipe group Sets ───────────────────────────────────────

function checkRecipeGroups() {
  console.log('\n2. Recipe names in archetype selection group Sets')
  const recipeNames = new Set(RECIPES.map((/** @type {{ name: string }} */ r) => r.name))
  /** @type {Record<string, Set<string>>} */
  const groups = {
    DELIBERATE_RECIPES, ORGANIC_RECIPES, CYCLIC_RECIPES,
    VIOLENT_RECIPES, SPREADING_RECIPES,
  }
  const errors = []
  for (const [groupName, groupSet] of Object.entries(groups)) {
    for (const name of groupSet) {
      if (!recipeNames.has(name)) {
        errors.push(`'${name}' in ${groupName} is not a valid recipe name`)
      }
    }
  }
  report(errors.length === 0, `${Object.keys(groups).length} groups checked`, errors)
}

// ── Check 3: Archetype NAMES ↔ SHAPES key sync ──────────────────────

function checkArchetypeNames() {
  console.log('\n3. Archetype NAMES ↔ SHAPES keys')
  const registries = [
    { label: 'GEOGONY', shapes: GEOGONY_SHAPES, names: GEOGONY_NAMES },
    { label: 'BIOGONY', shapes: BIOGONY_SHAPES, names: BIOGONY_NAMES },
    { label: 'ANTHROPOGONY', shapes: ANTHROPOGONY_SHAPES, names: ANTHROPOGONY_NAMES },
    { label: 'HIEROGONY', shapes: HIEROGONY_SHAPES, names: HIEROGONY_NAMES },
    { label: 'POLITOGONY', shapes: POLITOGONY_SHAPES, names: POLITOGONY_NAMES },
    { label: 'PRESENT', shapes: PRESENT_SHAPES, names: PRESENT_NAMES },
    { label: 'HISTORY', shapes: ARCHETYPES, names: ARCHETYPE_NAMES },
  ]
  for (const { label, shapes, names } of registries) {
    const shapeKeys = new Set(Object.keys(shapes))
    const nameSet = new Set(names)
    const missingInNames = setDiff(shapeKeys, nameSet)
    const extraInNames = setDiff(nameSet, shapeKeys)
    const errors = [
      ...missingInNames.map(n => `SHAPES key '${n}' missing from ${label}_NAMES`),
      ...extraInNames.map(n => `'${n}' in ${label}_NAMES has no SHAPES entry`),
    ]
    report(errors.length === 0, `${label}: ${shapeKeys.size} shapes, ${nameSet.size} names`, errors)
  }
}

// ── Check 4: myth.extra key sync ─────────────────────────────────────

function checkMythExtraKeys() {
  console.log('\n4. myth.extra key sync (recipes ↔ pantheonShapes.js)')

  // Build recipe name → extra keys map from recipe files
  /** @type {Map<string, Set<string>>} */
  const recipeExtras = new Map()
  const recipeDir = resolve(SRC, 'recipes')
  const recipeFiles = readdirSync(recipeDir).filter(f => f.endsWith('.js') && f !== 'index.js')

  for (const file of recipeFiles) {
    const src = readFileSync(resolve(recipeDir, file), 'utf8')
    // Extract recipe name
    const nameMatch = src.match(/name:\s*'([^']+)'/)
    if (!nameMatch) continue
    const recipeName = nameMatch[1]

    // Extract extra block — find `extra:` then capture until matching `}`
    // Use balanced-brace matching to handle nested arrays/calls
    const extraStart = src.indexOf('extra:')
    if (extraStart === -1) continue
    const braceStart = src.indexOf('{', extraStart)
    if (braceStart === -1) continue
    let depth = 0
    let braceEnd = -1
    for (let j = braceStart; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') { depth--; if (depth === 0) { braceEnd = j; break } }
    }
    if (braceEnd === -1) continue
    const extraBlock = src.slice(braceStart + 1, braceEnd)

    // Extract top-level property keys from the extra block.
    // Properties are either `key: value` or shorthand `key` separated by commas/newlines.
    // Strip nested [...] and (...) to avoid parsing inner content.
    let stripped = extraBlock
    stripped = stripped.replace(/\[[^\]]*\]/g, '[]')  // collapse arrays
    stripped = stripped.replace(/\([^)]*\)/g, '()')    // collapse calls

    const keys = new Set()
    for (const part of stripped.split(/[,\n]/)) {
      const trimmed = part.trim()
      if (!trimmed) continue
      // `key: value` or shorthand `key`
      const idMatch = trimmed.match(/^(\w+)/)
      if (idMatch) keys.add(idMatch[1])
    }
    recipeExtras.set(recipeName, keys)
  }

  // Extract myth.extra['key'] accesses per recipe block in pantheonShapes.js
  const shapeSrc = readSrc('pantheonShapes.js')

  // Split into recipe blocks by finding `'recipe-name'(` patterns
  const blockPattern = /^\s+'([^']+)'\s*\(/gm
  /** @type {{ name: string, start: number }[]} */
  const blocks = []
  let match
  while ((match = blockPattern.exec(shapeSrc)) !== null) {
    blocks.push({ name: match[1], start: match.index })
  }

  /** @type {Map<string, Set<string>>} */
  const shapeAccesses = new Map()
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const end = i + 1 < blocks.length ? blocks[i + 1].start : shapeSrc.length
    const blockText = shapeSrc.slice(block.start, end)
    const keys = new Set()
    const accessPattern = /myth\.extra\['(\w+)'\]/g
    let accessMatch
    while ((accessMatch = accessPattern.exec(blockText)) !== null) {
      keys.add(accessMatch[1])
    }
    shapeAccesses.set(block.name, keys)
  }

  // Also scan other archetype files for myth.extra accesses (not recipe-scoped)
  const otherExtraConsumers = [
    'geogonyArchetypes.js', 'biogonyArchetypes.js', 'anthropogonyArchetypes.js',
    'hierogonyArchetypes.js', 'politogonyArchetypes.js', 'presentArchetypes.js',
  ]
  /** @type {Set<string>} */
  const otherAccessed = new Set()
  for (const file of otherExtraConsumers) {
    let fileSrc
    try { fileSrc = readSrc(file) } catch { continue }
    const accessPattern = /myth\.extra\['(\w+)'\]/g
    let accessMatch
    while ((accessMatch = accessPattern.exec(fileSrc)) !== null) {
      otherAccessed.add(accessMatch[1])
    }
  }

  // Compare: errors for keys read but not defined, warnings for defined but never read
  const errors = []
  const warnMsgs = []
  for (const [recipeName, definedKeys] of recipeExtras) {
    const accessedKeys = shapeAccesses.get(recipeName)
    if (!accessedKeys) continue // covered by check 1
    const allAccessed = new Set([...accessedKeys, ...otherAccessed])
    const notDefined = setDiff(accessedKeys, definedKeys)
    const notAccessed = setDiff(definedKeys, allAccessed)
    for (const k of notDefined) {
      errors.push(`'${recipeName}' shape reads extra['${k}'] but recipe doesn't define it`)
    }
    for (const k of notAccessed) {
      warnMsgs.push(`'${recipeName}' defines extra.${k} but no archetype file reads it`)
    }
  }
  report(errors.length === 0, `${recipeExtras.size} recipes checked`, errors)
  if (warnMsgs.length > 0) warn('Unused extra keys (may be intentional)', warnMsgs)
}

// ── Check 5: Agent enum values ───────────────────────────────────────

function checkAgentEnums() {
  console.log('\n5. Agent enum values')

  // Agent-specific fields with their canonical values.
  // `type` and `state` are too generic (polities, practices, rumors all have them),
  // so we only check mythRole in the broad scan and use tighter patterns for type/state.
  const AGENT_TYPES = new Set(['god', 'demi-god', 'spirit', 'demon', 'ancestor', 'herald'])
  const AGENT_STATES = new Set(['active', 'dead', 'sleeping', 'imprisoned', 'exiled', 'transformed', 'forgotten'])
  const MYTH_ROLES = new Set([
    'creator', 'sacrifice', 'witness', 'echo', 'flaw-bearer',
    'derived', 'splinter', 'returned-flaw', 'landscape-guardian',
  ])

  // Files that create or manipulate agent objects directly
  const agentFiles = [
    'pantheon.js', 'pantheonShapes.js',
    'history.js', 'historyArchetypes.js',
  ]

  const errors = []

  for (const file of agentFiles) {
    let src
    try { src = readSrc(file) } catch { continue }
    const lines = src.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Agent type: `type: 'value'` in agent-creation files
      const typeMatch = line.match(/\btype:\s*'([^']+)'/)
      if (typeMatch && !AGENT_TYPES.has(typeMatch[1])) {
        errors.push(`${file}:${i + 1} — type: '${typeMatch[1]}' is not a valid agent type`)
      }

      // Agent state: `state: 'value'` in agent-creation files
      const stateMatch = line.match(/\bstate:\s*'([^']+)'/)
      if (stateMatch && !AGENT_STATES.has(stateMatch[1])) {
        errors.push(`${file}:${i + 1} — state: '${stateMatch[1]}' is not a valid agent state`)
      }

      // mythRole is agent-specific everywhere it appears
      const roleAssign = line.match(/\bmythRole:\s*'([^']+)'/)
      if (roleAssign && !MYTH_ROLES.has(roleAssign[1])) {
        errors.push(`${file}:${i + 1} — mythRole: '${roleAssign[1]}' is not valid (expected: ${[...MYTH_ROLES].join(', ')})`)
      }
    }
  }

  // Scan all files for mythRole and agent.state/agent.type comparisons
  const allFiles = [
    ...agentFiles,
    'geogony.js', 'biogony.js', 'anthropogony.js',
    'hierogony.js', 'politogony.js', 'present.js',
  ]
  const scanned = new Set(agentFiles)
  for (const file of allFiles) {
    if (scanned.has(file)) continue
    scanned.add(file)
    let src
    try { src = readSrc(file) } catch { continue }
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // mythRole assignments in any file
      const roleAssign = line.match(/\bmythRole:\s*'([^']+)'/)
      if (roleAssign && !MYTH_ROLES.has(roleAssign[1])) {
        errors.push(`${file}:${i + 1} — mythRole: '${roleAssign[1]}' is not valid`)
      }
      // .mythRole === comparisons
      const roleCmp = line.match(/\.mythRole\s*[!=]==?\s*'([^']+)'/)
      if (roleCmp && !MYTH_ROLES.has(roleCmp[1])) {
        errors.push(`${file}:${i + 1} — .mythRole compared to '${roleCmp[1]}' which is not valid`)
      }
      // agent.type === comparisons (must have `agent` or `a` prefix)
      const agentTypeCmp = line.match(/(?:agent|\.agents\b[^.]*?)\.type\s*[!=]==?\s*'([^']+)'/)
      if (agentTypeCmp && !AGENT_TYPES.has(agentTypeCmp[1])) {
        errors.push(`${file}:${i + 1} — agent.type compared to '${agentTypeCmp[1]}' which is not valid`)
      }
      // agent.state === comparisons
      const agentStateCmp = line.match(/(?:agent|\.agents\b[^.]*?)\.state\s*[!=]==?\s*'([^']+)'/)
      if (agentStateCmp && !AGENT_STATES.has(agentStateCmp[1])) {
        errors.push(`${file}:${i + 1} — agent.state compared to '${agentStateCmp[1]}' which is not valid`)
      }
    }
  }

  report(errors.length === 0, `${scanned.size} files scanned`, errors)
}

// ── Check 6: Relation type literals ──────────────────────────────────

function checkRelationTypes() {
  console.log('\n6. Relation type literals')

  const validRelations = new Set(RELATION_TYPES)
  const errors = []

  // Scan all src/*.js files
  const srcFiles = readdirSync(SRC).filter(f => f.endsWith('.js'))
  const recipeDir = resolve(SRC, 'recipes')
  const recipeFiles = readdirSync(recipeDir).filter(f => f.endsWith('.js'))

  /** @param {string} filePath @param {string} label */
  function scanFile(filePath, label) {
    const src = readFileSync(filePath, 'utf8')
    const lines = src.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // .where('relation' ...) or .or('relation' ...)
      const queryPattern = /\.(?:where|or|pluck)\(\s*'([^']+)'/g
      let m
      while ((m = queryPattern.exec(line)) !== null) {
        const rel = m[1]
        if (!validRelations.has(rel)) {
          errors.push(`${label}:${i + 1} — .${m[0].slice(1, m[0].indexOf('('))}('${rel}') is not a valid relation type`)
        }
      }

      // preferRelations: ['rel1', 'rel2']
      const prefMatch = line.match(/preferRelations\s*:\s*\[([^\]]+)\]/)
      if (prefMatch) {
        const relPattern = /'([^']+)'/g
        let relMatch
        while ((relMatch = relPattern.exec(prefMatch[1])) !== null) {
          const rel = relMatch[1]
          if (!validRelations.has(rel)) {
            errors.push(`${label}:${i + 1} — preferRelations '${rel}' is not a valid relation type`)
          }
        }
      }

      // e.relation === 'rel' or edge.relation === 'rel'
      const edgeRelPattern = /\.relation\s*[!=]==?\s*'([^']+)'/g
      while ((m = edgeRelPattern.exec(line)) !== null) {
        const rel = m[1]
        if (!validRelations.has(rel)) {
          errors.push(`${label}:${i + 1} — .relation compared to '${rel}' which is not a valid relation type`)
        }
      }
    }
  }

  for (const file of srcFiles) {
    scanFile(resolve(SRC, file), file)
  }
  for (const file of recipeFiles) {
    scanFile(resolve(recipeDir, file), `recipes/${file}`)
  }

  report(errors.length === 0, `${srcFiles.length + recipeFiles.length} files scanned`, errors)
}

// ── Main ─────────────────────────────────────────────────────────────

console.log('String reference consistency check')
console.log('==================================')

checkRecipeShapes()
checkRecipeGroups()
checkArchetypeNames()
checkMythExtraKeys()
checkAgentEnums()
checkRelationTypes()

console.log('')
if (failures > 0) {
  console.log(`FAILED: ${failures} check(s) failed`)
  process.exit(1)
} else if (warnings > 0) {
  console.log(`PASSED with ${warnings} warning(s)`)
} else {
  console.log('All checks passed')
}
