/**
 * Scene graph and scene rendering for Game Mode.
 * Builds a navigation network from world data — regions and landmarks
 * become scenes connected by terrain, people, and concept overlap.
 */

/**
 * @import { World } from '../world.js'
 * @import { ConceptGraph } from '../concepts.js'
 */
import { findAgent } from '../world.js'
import { conceptOverlap } from '../utils.js'
import { TRIPLES, buildGraph } from '../concepts.js'

/**
 * @typedef {{
 *   id: string,
 *   type: 'region'|'landmark',
 *   name: string,
 *   regionId: string,
 *   connections: string[],
 *   prose: string,
 *   concepts: string[],
 * }} Scene
 */

/** @type {ConceptGraph|null} */
let _graphCache = null

/**
 * Get the concept graph (cached).
 * @returns {ConceptGraph}
 */
function getGraph() {
  if (!_graphCache) {
    _graphCache = buildGraph(TRIPLES)
  }
  return _graphCache
}

/**
 * Build a scene graph from world data.
 * @param {World} world
 * @returns {Map<string, Scene>}
 */
export function buildSceneGraph(world) {
  /** @type {Map<string, Scene>} */
  const scenes = new Map()
  const regions = world.chorogony?.regions ?? []
  const landmarks = world.geogony?.landmarks ?? []
  const renderedRegions = world.renderedRegions ?? new Map()
  const renderedLandmarks = world.renderedLandmarks ?? new Map()

  // Create region scenes
  for (const region of regions) {
    scenes.set(region.id, {
      id: region.id,
      type: 'region',
      name: region.name,
      regionId: region.id,
      connections: [],
      prose: renderedRegions.get(region.id) ?? '',
      concepts: region.concepts,
    })
  }

  // Create landmark scenes
  for (const landmark of landmarks) {
    scenes.set(landmark.id, {
      id: landmark.id,
      type: 'landmark',
      name: landmark.name,
      regionId: landmark.regionId ?? '',
      connections: [],
      prose: renderedLandmarks.get(landmark.id) ?? '',
      concepts: landmark.concepts,
    })
  }

  // Connect landmarks to their parent regions (bidirectional)
  for (const landmark of landmarks) {
    if (landmark.regionId && scenes.has(landmark.regionId)) {
      const regionScene = /** @type {Scene} */ (scenes.get(landmark.regionId))
      const landmarkScene = /** @type {Scene} */ (scenes.get(landmark.id))
      if (!regionScene.connections.includes(landmark.id)) {
        regionScene.connections.push(landmark.id)
      }
      if (!landmarkScene.connections.includes(landmark.regionId)) {
        landmarkScene.connections.push(landmark.regionId)
      }
    }
  }

  // Connect regions to each other by shared terrain, peoples, or concept overlap
  const regionIds = regions.map(r => r.id)
  for (let i = 0; i < regionIds.length; i++) {
    for (let j = i + 1; j < regionIds.length; j++) {
      const a = regions[i]
      const b = regions[j]

      // Shared terrain types
      const sharedTerrain = a.terrainTypes.filter(t => b.terrainTypes.includes(t))
      // Shared peoples
      const sharedPeoples = a.peoples.filter(p => b.peoples.includes(p))

      if (sharedTerrain.length > 0 || sharedPeoples.length > 0) {
        const sceneA = /** @type {Scene} */ (scenes.get(a.id))
        const sceneB = /** @type {Scene} */ (scenes.get(b.id))
        if (!sceneA.connections.includes(b.id)) sceneA.connections.push(b.id)
        if (!sceneB.connections.includes(a.id)) sceneB.connections.push(a.id)
      }
    }
  }

  // Ensure connectivity: connect any isolated regions to the nearest by concept overlap
  const graph = getGraph()
  for (const region of regions) {
    const scene = /** @type {Scene} */ (scenes.get(region.id))
    const regionConnections = scene.connections.filter(id => scenes.get(id)?.type === 'region')
    if (regionConnections.length === 0 && regionIds.length > 1) {
      let bestId = ''
      let bestScore = -1
      for (const other of regions) {
        if (other.id === region.id) continue
        const score = conceptOverlap(graph, region.concepts, other.concepts)
        if (score > bestScore) {
          bestScore = score
          bestId = other.id
        }
      }
      if (bestId) {
        scene.connections.push(bestId)
        const otherScene = /** @type {Scene} */ (scenes.get(bestId))
        if (!otherScene.connections.includes(region.id)) {
          otherScene.connections.push(region.id)
        }
      }
    }
  }

  return scenes
}

/**
 * Render a scene as a DOM fragment.
 * @param {Scene} scene
 * @param {World} world
 * @param {Map<string, Scene>} sceneGraph
 * @param {Set<string>} visitedScenes
 * @returns {DocumentFragment}
 */
export function renderScene(scene, world, sceneGraph, visitedScenes) {
  const fragment = document.createDocumentFragment()

  // Scene name
  const heading = document.createElement('h2')
  heading.className = 'scene-heading'
  heading.textContent = scene.name
  if (scene.type === 'landmark') {
    const regionScene = sceneGraph.get(scene.regionId)
    if (regionScene) {
      const sub = document.createElement('span')
      sub.className = 'scene-region-label'
      sub.textContent = ` \u2014 ${regionScene.name}`
      heading.appendChild(sub)
    }
  }
  fragment.appendChild(heading)

  // Scene prose
  if (scene.prose) {
    const proseEl = document.createElement('div')
    proseEl.className = 'scene-text'
    for (const paragraph of scene.prose.split('\n\n')) {
      const p = document.createElement('p')
      p.textContent = paragraph
      proseEl.appendChild(p)
    }
    fragment.appendChild(proseEl)
  }

  // Encounters: active agents in this region
  const activePowers = (world.present?.activePowers ?? []).filter(p => p.regionId === scene.regionId)
  if (activePowers.length > 0) {
    const encounterSection = document.createElement('div')
    encounterSection.className = 'scene-encounters'
    for (const power of activePowers) {
      const agent = findAgent(world, power.agentId)
      if (!agent) continue
      const encounterEl = document.createElement('div')
      encounterEl.className = 'encounter'
      encounterEl.dataset['agentId'] = agent.id
      const nameEl = document.createElement('span')
      nameEl.className = 'encounter-name'
      nameEl.textContent = `${agent.name}, ${agent.title}`
      const stateEl = document.createElement('span')
      stateEl.className = 'encounter-state'
      stateEl.textContent = ` \u2014 ${power.currentAction}`
      encounterEl.append(nameEl, stateEl)
      encounterSection.appendChild(encounterEl)
    }
    fragment.appendChild(encounterSection)
  }

  // Available artifacts at this location
  const artifacts = (world.artifacts ?? []).filter(a => {
    if (scene.type === 'landmark') {
      return a.location.landmarkName === scene.name
    }
    return a.location.regionId === scene.regionId && !a.location.landmarkName
  })
  if (artifacts.length > 0) {
    const itemSection = document.createElement('div')
    itemSection.className = 'scene-items'
    for (const artifact of artifacts) {
      const itemEl = document.createElement('div')
      itemEl.className = 'scene-item'
      itemEl.dataset['artifactId'] = artifact.id
      itemEl.textContent = `${artifact.name} \u2014 ${artifact.type}, ${artifact.condition}`
      itemSection.appendChild(itemEl)
    }
    fragment.appendChild(itemSection)
  }

  // Found texts at sacred sites / with artifacts at this location
  const sacredSites = (world.hierogony?.sacredSites ?? []).filter(s => {
    if (scene.type === 'landmark') return s.landmarkName === scene.name
    return false
  })
  const sacredArtifactIds = new Set(sacredSites.flatMap(s => /** @type {*} */ (s).artifactIds ?? []))
  const localArtifactIds = new Set(artifacts.map(a => a.id))
  const relevantTexts = (world.texts ?? []).filter(t =>
    t.referencedArtifactIds.some(id => sacredArtifactIds.has(id) || localArtifactIds.has(id))
  )
  if (relevantTexts.length > 0) {
    const textSection = document.createElement('div')
    textSection.className = 'scene-texts'
    for (const text of relevantTexts) {
      const textEl = document.createElement('div')
      textEl.className = 'found-text'
      textEl.dataset['textId'] = text.id
      const titleEl = document.createElement('div')
      titleEl.className = 'found-text-title'
      titleEl.textContent = text.title
      const bodyEl = document.createElement('p')
      bodyEl.textContent = text.body
      textEl.append(titleEl, bodyEl)
      textSection.appendChild(textEl)
    }
    fragment.appendChild(textSection)
  }

  // Rumors in this region
  const rumors = (world.present?.rumors ?? []).filter(r => r.regionId === scene.regionId)
  if (rumors.length > 0) {
    const rumorSection = document.createElement('div')
    rumorSection.className = 'scene-rumors'
    const rumorHeading = document.createElement('div')
    rumorHeading.className = 'scene-section-label'
    rumorHeading.textContent = 'You hear whispers...'
    rumorSection.appendChild(rumorHeading)
    for (const rumor of rumors) {
      const rumorEl = document.createElement('p')
      rumorEl.className = 'rumor-text'
      rumorEl.textContent = rumor.claim
      rumorSection.appendChild(rumorEl)
    }
    fragment.appendChild(rumorSection)
  }

  // Navigation choices
  const choicesEl = document.createElement('div')
  choicesEl.className = 'choices'
  for (const connId of scene.connections) {
    const connScene = sceneGraph.get(connId)
    if (!connScene) continue
    const choice = document.createElement('div')
    choice.className = 'choice'
    choice.dataset['sceneId'] = connId
    const visited = visitedScenes.has(connId)
    const prefix = connScene.type === 'landmark' ? 'Approach' : 'Travel to'
    choice.textContent = `${prefix} ${connScene.name}${visited ? '' : ' \u2022'}`
    choicesEl.appendChild(choice)
  }
  fragment.appendChild(choicesEl)

  return fragment
}
