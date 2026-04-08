/**
 * Settlement prose renderer. Read-only — never mutates world data.
 * Produces descriptions for landscape, architecture, structures,
 * NPCs, food, traditions, and the bar song.
 *
 * @import { ConceptGraph } from '../concepts.js'
 * @import { World } from '../world.js'
 * @import { Settlement, SettlementNPC, Crop, Livestock } from '../settlement.js'
 */
import { buildSensoryProfile, sensoryPhrase, moodPhrase } from './sensory.js'
import { findAgent, findRegion } from '../world.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   landscape: string,
 *   architecture: string,
 *   townCenter: string,
 *   worshipSite: string,
 *   npcDialogue: Record<string, string[]>,
 *   food: { dish: string, bread: string, meat: string, beverage: string },
 *   barSong: string,
 *   traditions: string[],
 *   cropDescriptions: Record<string, string>,
 *   livestockDescription: string,
 * }} RenderedSettlement
 */

// ── Landscape ──

/** @type {Record<string, string>} */
const CLIMATE_ATMOSPHERE = {
  arid: 'The dry air shimmers over the fields, heat rising from packed earth.',
  cold: 'A biting wind sweeps across the fields, frost edging the furrows.',
  wet: 'Moisture hangs in the air; everything drips and glistens.',
  temperate: 'The air is mild and carries the scent of turned soil.',
  tropical: 'Thick humid air wraps the village in green warmth.',
  volcanic: 'A faint sulfur tinge rides the breeze; the soil here is dark and rich.',
}

/**
 * Render the landscape description.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {Settlement} s
 * @returns {string}
 */
function renderLandscape(graph, rng, world, s) {
  const region = findRegion(world, s.regionId)
  if (!region) return ''

  const profile = buildSensoryProfile(graph, region.concepts)
  const parts = []

  // Opening with striking sense
  if (profile.strikingSense && profile[profile.strikingSense]) {
    const phrase = sensoryPhrase(profile.strikingSense, profile[profile.strikingSense] ?? '')
    parts.push(`The land around ${s.name} is ${phrase}.`)
  } else {
    parts.push(`The land around ${s.name} stretches quietly in every direction.`)
  }

  // Crop fields
  const grain = s.crops.find(c => c.type === 'grain')
  if (grain) {
    const grainProfile = buildSensoryProfile(graph, grain.concepts)
    const colorPhrase = grainProfile.color ? sensoryPhrase('color', grainProfile.color) : 'pale'
    parts.push(`Fields of ${grain.name} stand ${colorPhrase}, swaying in rows that run to the horizon.`)
  }

  // Vegetables
  const vegs = s.crops.filter(c => c.type !== 'grain')
  if (vegs.length > 0) {
    const vegNames = vegs.map(v => v.name).join(' and ')
    parts.push(`Between the rows, patches of ${vegNames} grow low and dense.`)
  }

  // Livestock
  if (s.livestock) {
    const sizeWord = s.livestock.size === 'large' ? 'large' : s.livestock.size === 'small' ? 'small' : 'sturdy'
    parts.push(`${sizeWord[0].toUpperCase() + sizeWord.slice(1)} ${s.livestock.name} graze at the edges of the fields, ${s.livestock.behavior} and unhurried.`)
  }

  // Climate
  const climateConcept = region.climate[0]
  if (climateConcept && CLIMATE_ATMOSPHERE[climateConcept]) {
    parts.push(CLIMATE_ATMOSPHERE[climateConcept])
  }

  // Mood
  if (region.mood.length > 0) {
    parts.push(moodPhrase(rng, region.mood))
  }

  return parts.join(' ')
}

// ── Architecture ──

/** @type {Record<string, string>} */
const STYLE_PHRASES = {
  'tall-narrow': 'rises in narrow columns',
  'sunken': 'sits half-buried in the ground',
  'low-sprawling': 'sprawls low across the earth',
  'winding': 'follows the curve of the land in winding paths',
}

/**
 * @param {Settlement} s
 * @returns {string}
 */
function renderArchitecture(s) {
  const material = s.architecture.material
  const style = STYLE_PHRASES[s.architecture.style] ?? 'stands against the sky'
  return `The village ${style}, built from ${material}. Every wall and roof carries the mark of local hands and local earth.`
}

// ── Town center ──

/** @type {Record<string, string>} */
const CENTER_DESCRIPTIONS = {
  'tavern': 'the sound of voices and the clink of vessels',
  'gathering-hall': 'the echo of many voices beneath a shared roof',
  'beer-hall': 'the thick smell of ferment and the warmth of bodies',
  'field': 'open ground where the village gathers under sky',
  'market-circle': 'the murmur of trade and the clatter of goods',
}

/**
 * @param {Settlement} s
 * @returns {string}
 */
function renderTownCenter(s) {
  const desc = CENTER_DESCRIPTIONS[s.townCenter.type] ?? 'the center of village life'
  return `The ${s.townCenter.name} is the heart of ${s.name} — ${desc}. Here the ${s.brewedBeverage.name} flows freely, and the smell of ${s.specialtyDish.name} drifts from the cooking fires.`
}

// ── Worship site ──

/** @type {Record<string, string>} */
const WORSHIP_DESCRIPTIONS = {
  'ruin': 'What remains is broken, but the villagers still come. The stones remember what they do not.',
  'shrine': 'A small structure, carefully tended, where offerings are left and prayers are spoken.',
  'temple': 'Stone columns frame the entrance. Inside, the air is cool and still.',
  'artifact-altar': 'At its center sits something old — the thing the village was built to protect.',
  'outdoor-circle': 'An open ring of stones where the sky serves as ceiling and the wind carries the words.',
}

/**
 * @param {Settlement} s
 * @param {World} world
 * @returns {string}
 */
function renderWorshipSite(s, world) {
  const desc = WORSHIP_DESCRIPTIONS[s.worshipSite.type] ?? 'A place set apart for what cannot be spoken elsewhere.'
  const religion = s.religionId ? (world.hierogony?.religions ?? []).find(r => r.id === s.religionId) : null
  const religionPhrase = religion ? ` The people of ${s.name} follow ${religion.name}.` : ''
  return `The ${s.worshipSite.name} stands at the village edge. ${desc}${religionPhrase}`
}

// ── NPC dialogue ──

/**
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {Settlement} s
 * @returns {Record<string, string[]>}
 */
function renderNPCDialogue(graph, rng, world, s) {
  /** @type {Record<string, string[]>} */
  const dialogue = {}
  const founderAgent = s.origin.founderAgentId ? findAgent(world, s.origin.founderAgentId) : null

  for (const npc of s.npcs) {
    /** @type {string[]} */
    const lines = []

    switch (npc.role) {
      case 'farmer': {
        const grain = s.crops.find(c => c.type === 'grain')
        lines.push(`The ${grain?.name ?? 'crop'} came in well this season. Better than last.`)
        lines.push(`The ${s.livestock?.name ?? 'herd'} have been restless. Could mean rain, could mean trouble.`)
        if (s.crops.length > 1) {
          lines.push(`The ${s.crops[1].name} is stubborn ground-food. But it keeps.`)
        }
        lines.push('This land gives what it gives. You learn not to ask for more.')
        if (npc.stance) lines.push(npc.stance)
        break
      }
      case 'brewer': {
        lines.push(`Try the ${s.brewedBeverage.name}. Made from ${s.brewedBeverage.baseCrop}, same as always.`)
        lines.push(`${s.specialtyDish.name} goes well with the drink. ${s.specialtyDish.backstory}.`)
        lines.push('Travelers are rare here. You have the look of someone who has walked far.')
        lines.push(`The ${s.townCenter.name} fills up at dusk. Everyone comes eventually.`)
        if (npc.stance) lines.push(npc.stance)
        break
      }
      case 'elder': {
        if (founderAgent) {
          lines.push(`${founderAgent.name} ${s.origin.archetype === 'heros-rest' ? 'chose to rest here' : s.origin.archetype === 'heros-sacrifice' ? 'gave everything here' : s.origin.archetype === 'heros-discovery' ? 'found something here that changed everything' : 'was driven here, and we followed'}. That is why ${s.name} exists.`)
        } else {
          lines.push(`${s.name} has stood since before anyone can remember. The land itself called us here.`)
        }
        lines.push('The old days were different. Harder in some ways, clearer in others.')
        if (npc.stance) lines.push(npc.stance + '.')
        const crisis = world.present?.crisis
        if (crisis) {
          lines.push(`The ${crisis.type} weighs on us all. It is ${crisis.severity === 'critical' ? 'dire' : crisis.severity === 'breaking' ? 'getting worse' : 'a slow worry'}.`)
        }
        lines.push('Ask the priest about the sacred things. I only know the human ones.')
        break
      }
      case 'priest': {
        const religion = s.religionId ? (world.hierogony?.religions ?? []).find(r => r.id === s.religionId) : null
        if (religion) {
          lines.push(`We follow the way of ${religion.name}. It was not chosen — it was revealed.`)
        }
        if (npc.stance) lines.push(npc.stance + '.')
        lines.push(`The ${s.worshipSite.name} is not just stone and air. It listens.`)
        if (s.traditions.length > 0) {
          const t = s.traditions[0]
          lines.push(`The ${t.name} comes in ${t.season}. It is the most important time for ${s.name}.`)
        }
        lines.push('There are things that must not be done. If you stay, you will learn them.')
        break
      }
    }

    dialogue[npc.id] = lines
  }

  return dialogue
}

// ── Food descriptions ──

/**
 * @param {ConceptGraph} graph
 * @param {Settlement} s
 * @returns {{ dish: string, bread: string, meat: string, beverage: string }}
 */
function renderFood(graph, s) {
  const grain = s.crops.find(c => c.type === 'grain')
  const grainProfile = grain ? buildSensoryProfile(graph, grain.concepts) : null
  const dishProfile = buildSensoryProfile(graph, s.specialtyDish.concepts)
  const bevProfile = buildSensoryProfile(graph, s.brewedBeverage.concepts)

  const breadColor = grainProfile?.color ? sensoryPhrase('color', grainProfile.color) : 'golden'
  const dishColor = dishProfile.color ? sensoryPhrase('color', dishProfile.color) : 'rich'
  const bevColor = bevProfile.color ? sensoryPhrase('color', bevProfile.color) : 'amber'

  return {
    dish: `${s.specialtyDish.name} — a ${dishColor} stew of ${s.specialtyDish.ingredients.join(', ')}. ${s.specialtyDish.backstory}.`,
    bread: `Bread made from ${grain?.name ?? 'local grain'}, ${breadColor} and dense. It holds together a meal.`,
    meat: s.livestock ? `Slow-cooked ${s.livestock.name} — ${s.livestock.size === 'small' ? 'tender and mild' : 'rich and heavy'}. A rare indulgence.` : 'No meat is served here. The animals are too valuable alive.',
    beverage: `${s.brewedBeverage.name} — ${bevColor}, brewed from ${s.brewedBeverage.baseCrop}. It warms going down.`,
  }
}

// ── Bar song ──

/**
 * @param {Settlement} s
 * @returns {string}
 */
function renderBarSong(s) {
  const parts = []
  for (let i = 0; i < s.barSong.verses.length; i++) {
    parts.push(s.barSong.verses[i])
    if (i < s.barSong.verses.length - 1) parts.push(s.barSong.refrain)
  }
  parts.push(s.barSong.refrain)
  return parts.join('\n\n')
}

// ── Traditions ──

/** @type {Record<string, string>} */
const TRADITION_VERBS = {
  festival: 'celebrates',
  ritual: 'observes',
  competition: 'holds',
  observance: 'remembers',
}

/**
 * @param {Settlement} s
 * @returns {string[]}
 */
function renderTraditions(s) {
  return s.traditions.map(t => {
    const verb = TRADITION_VERBS[t.type] ?? 'marks'
    return `Each ${t.season}, ${s.name} ${verb} the ${t.name} — a ${t.type} rooted in ${t.concepts[0] ?? 'old custom'}.`
  })
}

// ── Crop & livestock descriptions ──

/**
 * @param {ConceptGraph} graph
 * @param {Settlement} s
 * @returns {Record<string, string>}
 */
function renderCropDescriptions(graph, s) {
  /** @type {Record<string, string>} */
  const descs = {}
  for (const crop of s.crops) {
    const profile = buildSensoryProfile(graph, crop.concepts)
    const color = profile.color ? sensoryPhrase('color', profile.color) : 'unremarkable in color'
    const texture = profile.texture ? sensoryPhrase('texture', profile.texture) : ''
    const typeLabel = crop.type === 'grain' ? 'A staple grain' : `A ${crop.type}`
    descs[crop.id] = `${crop.name} — ${typeLabel}, ${color}${texture ? ', ' + texture : ''}. It grows in the fields around ${s.name}.`
  }
  return descs
}

/**
 * @param {ConceptGraph} graph
 * @param {Settlement} s
 * @returns {string}
 */
function renderLivestockDescription(graph, s) {
  if (!s.livestock) return ''
  const profile = buildSensoryProfile(graph, s.livestock.concepts)
  const color = profile.color ? sensoryPhrase('color', profile.color) : 'dun-colored'
  return `The ${s.livestock.name} are ${s.livestock.size} ${s.livestock.behavior} creatures, ${color}. They produce ${s.livestock.produces} and are central to village life.`
}

// ── Main entry ──

/**
 * Render settlement prose and write to world.renderedSettlement.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function renderSettlement(graph, world, rng) {
  const s = world.settlement
  if (!s) return

  /** @type {RenderedSettlement} */
  const rendered = {
    landscape: renderLandscape(graph, rng, world, s),
    architecture: renderArchitecture(s),
    townCenter: renderTownCenter(s),
    worshipSite: renderWorshipSite(s, world),
    npcDialogue: renderNPCDialogue(graph, rng, world, s),
    food: renderFood(graph, s),
    barSong: renderBarSong(s),
    traditions: renderTraditions(s),
    cropDescriptions: renderCropDescriptions(graph, s),
    livestockDescription: renderLivestockDescription(graph, s),
  }

  world.renderedSettlement = rendered
}
