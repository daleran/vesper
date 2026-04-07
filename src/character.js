/**
 * Character generator — produces a PlayerCharacter that ties the player
 * into the world's mythology. The character's creator god, purpose, arrival
 * location, appearance, and world reactions are all derived from the world's
 * existing generated state.
 *
 * Runs last in the generation pipeline, after all other layers.
 * Mutates the arrival region and landmark with playerArrival: true.
 *
 * @import { ConceptGraph } from './concepts.js'
 * @import { World } from './world.js'
 * @import { Agent } from './pantheon.js'
 * @import { ChorogonyRegion } from './chorogony.js'
 */
import { pick, pickN, weightedPick, conceptOverlap } from './utils.js'
import { expandConceptCluster } from './conceptResolvers.js'
import { buildSensoryProfile, sensoryPhrase, moodPhrase } from './renderers/sensory.js'

// ── Typedefs ──

/**
 * @typedef {{
 *   type: 'prevent'|'find'|'witness'|'heal'|'destroy'|'deliver'|'remember',
 *   target: string,
 *   hidden: true,
 * }} CharacterPurpose
 */

/**
 * @typedef {{
 *   regionId: string,
 *   landmarkId: string|null,
 *   description: string,
 * }} CharacterArrival
 */

/**
 * @typedef {{
 *   normalcy: 'indistinguishable'|'subtly-wrong'|'visibly-other',
 *   details: string[],
 * }} CharacterAppearance
 */

/**
 * @typedef {{
 *   priests: string,
 *   commoners: string,
 *   agents: string,
 *   artifacts: string,
 * }} CharacterReactions
 */

/**
 * @typedef {{
 *   creatorGod: string,
 *   purpose: CharacterPurpose,
 *   concepts: string[],
 *   arrival: CharacterArrival,
 *   appearance: CharacterAppearance,
 *   instincts: string[],
 *   reactions: CharacterReactions,
 * }} PlayerCharacter
 */

// ── Helpers ──

/**
 * Resolve concepts associated with a target entity id or concept string.
 * @param {World} world
 * @param {string} target
 * @returns {string[]}
 */
function resolveTargetConcepts(world, target) {
  const agent = world.agents.find(a => a.id === target)
  if (agent) return agent.domains

  const artifact = (world.artifacts ?? []).find(a => a.id === target)
  if (artifact) return artifact.concepts

  const region = (world.chorogony?.regions ?? []).find(r => r.id === target)
  if (region) return region.concepts

  const polity = (world.politogony?.polities ?? []).find(p => p.id === target)
  if (polity) return polity.concepts

  return [target]
}

/**
 * Select the creator god from world agents. Prefers gods with active
 * tensions, crisis relevance, and historical losses.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @returns {Agent}
 */
function selectCreatorGod(graph, rng, world) {
  const crisisConcepts = world.present?.crisis.concepts ?? []
  const candidates = world.agents.filter(a => a.type === 'god' || a.type === 'demi-god')

  if (candidates.length === 0) {
    return world.agents[0]
  }

  const scores = candidates.map(agent => {
    let score = 0

    // State score
    if (agent.state === 'active') score += 3
    else if (['sleeping', 'imprisoned', 'exiled'].includes(agent.state)) score += 2
    else score += 1

    // Tension score: each world tension touching this god's domains
    for (const t of world.tensions) {
      const parts = t.split(':')
      if (parts.some(p => agent.domains.includes(p))) score += 2
    }

    // Loss score: history events that changed this agent to a bad state
    for (const event of world.events) {
      for (const change of event.agentChanges) {
        if (change.agentId !== agent.id) continue
        if (['dead', 'sleeping', 'imprisoned', 'exiled'].includes(change.newState ?? '')) score += 3
        if (change.newRelationships?.some(r => r.kind === 'betrayed-by')) score += 3
      }
    }

    // Crisis relevance
    score += conceptOverlap(graph, agent.domains, crisisConcepts)

    // Worship and patron bonuses
    if (agent.worshippedBy.length > 0) score += 1
    if (agent.patronOf.length > 0) score += 1

    return Math.max(1, score)
  })

  return weightedPick(rng, candidates, scores)
}

/**
 * Derive the character's hidden purpose from the creator god's situation.
 * @param {ConceptGraph} graph
 * @param {() => number} _rng
 * @param {World} world
 * @param {Agent} creatorGod
 * @returns {CharacterPurpose}
 */
function derivePurpose(graph, _rng, world, creatorGod) {
  const crisis = world.present?.crisis
  const activePowers = world.present?.activePowers ?? []

  // 1. Heal: god domains overlap crisis flaw connection
  if (crisis && conceptOverlap(graph, creatorGod.domains, crisis.flawConnection) > 0) {
    return {
      type: 'heal',
      target: crisis.flawConnection[0] ?? crisis.concepts[0],
      hidden: true,
    }
  }

  // 2. Prevent: rival agent actively stoking crisis, whose domains collide with creator's
  const rivalDomains = new Set()
  for (const d of creatorGod.domains) {
    for (const e of (graph.get(d) ?? [])) {
      if (e.relation === 'collides') rivalDomains.add(e.concept)
    }
  }
  const stokingPower = activePowers.find(ap => {
    if (ap.currentAction !== 'stoking') return false
    const rival = world.agents.find(a => a.id === ap.agentId)
    return rival && rival.id !== creatorGod.id && rival.domains.some(d => rivalDomains.has(d))
  })
  if (stokingPower) {
    return { type: 'prevent', target: stokingPower.agentId, hidden: true }
  }

  // 3. Find: god lost a war event (state changed to sleeping/imprisoned)
  for (const event of world.events) {
    if (event.archetype !== 'war') continue
    for (const change of event.agentChanges) {
      if (change.agentId === creatorGod.id &&
          (change.newState === 'sleeping' || change.newState === 'imprisoned')) {
        const godArtifact = (world.artifacts ?? []).find(a => a.origin.agentId === creatorGod.id)
        const target = godArtifact
          ? godArtifact.id
          : (crisis?.flawConnection[0] ?? crisis?.concepts[0] ?? creatorGod.domains[0] ?? 'unknown')
        return { type: 'find', target, hidden: true }
      }
    }
  }

  // 4. Destroy: betrayed-by relationship
  const betrayal = creatorGod.relationships.find(r => r.kind === 'betrayed-by')
  if (betrayal) {
    return { type: 'destroy', target: betrayal.target, hidden: true }
  }

  // 5. Remember: god has a ward or created agent who is dead/forgotten
  for (const rel of creatorGod.relationships) {
    if (rel.kind !== 'ward' && rel.kind !== 'creator') continue
    const ward = world.agents.find(a => a.id === rel.target)
    if (ward && (ward.state === 'dead' || ward.state === 'forgotten')) {
      return { type: 'remember', target: rel.target, hidden: true }
    }
  }

  // 6. Deliver: god is patron of a polity with a capital region
  if (creatorGod.patronOf.length > 0) {
    const polity = (world.politogony?.polities ?? []).find(
      p => creatorGod.patronOf.includes(p.id) && p.capitalRegionId
    )
    if (polity?.capitalRegionId) {
      return { type: 'deliver', target: polity.capitalRegionId, hidden: true }
    }
  }

  // Fallback: witness
  const fallbackTarget = crisis?.affectedRegionIds[0] ?? world.regions[0]?.id ?? 'unknown'
  return { type: 'witness', target: fallbackTarget, hidden: true }
}

/**
 * Pick 2-4 character concept tags from the creator god's domains.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {Agent} creatorGod
 * @returns {string[]}
 */
function pickConceptTags(graph, rng, creatorGod) {
  if (creatorGod.domains.length === 0) return []
  const expanded = expandConceptCluster(graph, rng, creatorGod.domains[0], 2, 4)
  return expanded.length >= 2 ? expanded : creatorGod.domains.slice(0, 4)
}

/**
 * Build a 2-3 sentence sensory arrival description.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {ChorogonyRegion} region
 * @param {string[]} characterConcepts
 * @returns {string}
 */
function buildArrivalDescription(graph, rng, region, characterConcepts) {
  const regionProfile = buildSensoryProfile(graph, region.concepts)
  const charProfile = buildSensoryProfile(graph, characterConcepts)
  const parts = /** @type {string[]} */ ([])

  // Sentence 1: region mood
  const moodSource = regionProfile.mood.length > 0 ? regionProfile.mood : charProfile.mood
  parts.push(moodPhrase(rng, moodSource))

  // Sense value lookups (avoids indexing issues)
  const regionSenses = {
    color: regionProfile.color,
    texture: regionProfile.texture,
    shape: regionProfile.shape,
    sound: regionProfile.sound,
  }
  const charSenses = {
    color: charProfile.color,
    texture: charProfile.texture,
    shape: charProfile.shape,
    sound: charProfile.sound,
  }

  // Sentence 2: dominant sensory impression of the region
  if (regionProfile.strikingSense) {
    const sense = regionProfile.strikingSense
    const value = regionSenses[sense]
    if (value) {
      const phrase = sensoryPhrase(sense, value)
      if (sense === 'sound') {
        parts.push(phrase.charAt(0).toUpperCase() + phrase.slice(1) + '.')
      } else if (sense === 'color') {
        parts.push(`The light catches something ${phrase}.`)
      } else if (sense === 'texture') {
        parts.push(`The ground beneath is ${phrase}.`)
      } else {
        parts.push(`The terrain stretches ${phrase}.`)
      }
    }
  }

  // Sentence 3 (optional): character's sensory mark, if distinct from region's
  if (charProfile.strikingSense && charProfile.strikingSense !== regionProfile.strikingSense) {
    const sense = charProfile.strikingSense
    const value = charSenses[sense]
    if (value) {
      const phrase = sensoryPhrase(sense, value)
      if (sense === 'sound') {
        parts.push(`You notice: ${phrase}.`)
      } else {
        parts.push(`Something in you is ${phrase}.`)
      }
    }
  }

  return parts.join(' ')
}

/**
 * Select the arrival region and landmark, building a sensory description.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {string[]} concepts
 * @param {CharacterPurpose} purpose
 * @returns {CharacterArrival}
 */
function selectArrival(graph, rng, world, concepts, purpose) {
  const regions = world.chorogony?.regions ?? []
  const allLandmarks = world.geogony?.landmarks ?? []

  if (regions.length === 0) {
    return {
      regionId: world.regions[0]?.id ?? 'unknown',
      landmarkId: null,
      description: moodPhrase(rng, ['time']),
    }
  }

  /** @type {{ region: ChorogonyRegion, score: number }[]} */
  let scored

  if (purpose.type === 'find' || purpose.type === 'deliver') {
    // Far from target — inverse overlap + mild character resonance
    const targetConcepts = resolveTargetConcepts(world, purpose.target)
    scored = regions.map(r => ({
      region: r,
      score: -conceptOverlap(graph, targetConcepts, r.concepts) +
             conceptOverlap(graph, concepts, r.concepts) * 0.5,
    }))
  } else if (purpose.type === 'prevent') {
    // Near the threat
    const rival = world.agents.find(a => a.id === purpose.target)
    const rivalConcepts = rival?.domains ?? []
    const activePower = world.present?.activePowers.find(ap => ap.agentId === purpose.target)
    scored = regions.map(r => ({
      region: r,
      score: (activePower?.regionId === r.id ? 10 : 0) +
             conceptOverlap(graph, rivalConcepts, r.concepts),
    }))
  } else if (purpose.type === 'witness') {
    // Neutral crossroads — diverse + thematic overlap
    scored = regions.map(r => ({
      region: r,
      score: (r.peoples?.length ?? 0) + (r.landmarks?.length ?? 0) +
             conceptOverlap(graph, concepts, r.concepts) * 0.5,
    }))
  } else if (purpose.type === 'heal') {
    // Near the wound — crisis flaw connection concepts
    const flawConcepts = world.present?.crisis.flawConnection ?? []
    scored = regions.map(r => ({
      region: r,
      score: conceptOverlap(graph, flawConcepts, r.concepts),
    }))
  } else if (purpose.type === 'destroy') {
    // Near but not at target — we'll pick second-best below
    const targetConcepts = resolveTargetConcepts(world, purpose.target)
    scored = regions.map(r => ({
      region: r,
      score: conceptOverlap(graph, targetConcepts, r.concepts),
    }))
  } else if (purpose.type === 'remember') {
    // Where the remembered entity last appeared
    const relevantEventIndices = world.events
      .filter(e => e.agentChanges.some(c => c.agentId === purpose.target))
      .map(e => e.index)
    scored = regions.map(r => ({
      region: r,
      score: (r.taggedBy.some(idx => relevantEventIndices.includes(idx)) ? 3 : 0) +
             conceptOverlap(graph, concepts, r.concepts),
    }))
  } else {
    // Fallback: thematic overlap with character concepts
    scored = regions.map(r => ({
      region: r,
      score: conceptOverlap(graph, concepts, r.concepts),
    }))
  }

  scored.sort((a, b) => b.score - a.score)

  // For 'destroy', arrive near but not at the target — take second-best
  const pickIdx = purpose.type === 'destroy' && scored.length > 1 ? 1 : 0
  const chosenRegion = scored[pickIdx]?.region ?? regions[0]

  // Pick best landmark in chosen region by concept overlap
  const regionLandmarks = allLandmarks.filter(l => l.regionId === chosenRegion.id)
  let landmarkId = null
  if (regionLandmarks.length > 0) {
    let best = regionLandmarks[0]
    let bestScore = conceptOverlap(graph, concepts, best.concepts)
    for (const l of regionLandmarks) {
      const s = conceptOverlap(graph, concepts, l.concepts)
      if (s > bestScore) { bestScore = s; best = l }
    }
    landmarkId = best.id
  }

  const description = buildArrivalDescription(graph, rng, chosenRegion, concepts)

  return { regionId: chosenRegion.id, landmarkId, description }
}

/**
 * Generate the character's physical appearance from concept tags.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} concepts
 * @returns {CharacterAppearance}
 */
function buildAppearance(graph, rng, concepts) {
  const profile = buildSensoryProfile(graph, concepts)
  const senseCount = [profile.color, profile.texture, profile.shape, profile.sound]
    .filter(Boolean).length

  // Normalcy weighted by how many sensory attributes are present
  const normalcyOptions = /** @type {('indistinguishable'|'subtly-wrong'|'visibly-other')[]} */ (
    ['indistinguishable', 'subtly-wrong', 'visibly-other']
  )
  const weights = senseCount === 0 ? [5, 2, 1] : senseCount <= 2 ? [2, 5, 2] : [1, 3, 5]
  const normalcy = weightedPick(rng, normalcyOptions, weights)

  /** @type {Record<'color'|'texture'|'shape'|'sound', string[]>} */
  const templates = {
    color: ['eyes $', 'hair $', 'skin faintly $'],
    texture: ['hands $', 'skin $'],
    shape: ['build $', 'stance $'],
    sound: ['$ follows them when they move', '$ in their breathing'],
  }

  const details = /** @type {string[]} */ ([])
  /** @type {['color'|'texture'|'shape'|'sound', string|null][]} */
  const senses = [
    ['color', profile.color],
    ['texture', profile.texture],
    ['shape', profile.shape],
    ['sound', profile.sound],
  ]
  for (const [sense, value] of senses) {
    if (!value || details.length >= 4) continue
    const tmpl = pick(rng, templates[sense])
    details.push(tmpl.replace('$', sensoryPhrase(sense, value)))
  }

  return { normalcy, details }
}

/**
 * Derive instincts: what the character is drawn to and uneasy around.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {string[]} concepts
 * @returns {string[]}
 */
function buildInstincts(graph, rng, concepts) {
  const conceptSet = new Set(concepts)
  const drawnConcepts = new Set()
  const uneasyConcepts = new Set()

  for (const c of concepts) {
    for (const e of (graph.get(c) ?? [])) {
      if (conceptSet.has(e.concept)) continue
      if (e.relation === 'evokes' || e.relation === 'rhymes' || e.relation === 'is') {
        drawnConcepts.add(e.concept)
      } else if (e.relation === 'collides') {
        uneasyConcepts.add(e.concept)
      }
    }
  }

  const drawnPhrases = ['drawn to $', 'restless near $', 'feels kinship with $', 'lingers around $']
  const uneasyPhrases = ['uneasy around $', 'recoils from $', 'avoids $', 'flinches at $']

  const instincts = /** @type {string[]} */ ([])
  for (const c of pickN(rng, [...drawnConcepts], 3)) {
    instincts.push(pick(rng, drawnPhrases).replace('$', c))
  }
  for (const c of pickN(rng, [...uneasyConcepts], 2)) {
    instincts.push(pick(rng, uneasyPhrases).replace('$', c))
  }

  return instincts
}

/**
 * Derive how the world reacts to the character based on creator god alignment.
 * @param {ConceptGraph} graph
 * @param {() => number} rng
 * @param {World} world
 * @param {Agent} creatorGod
 * @param {CharacterAppearance} appearance
 * @returns {CharacterReactions}
 */
function buildReactions(graph, rng, world, creatorGod, appearance) {
  const religions = world.hierogony?.religions ?? []

  // Find concepts and agents that collide with the creator
  const rivalDomains = new Set()
  for (const d of creatorGod.domains) {
    for (const e of (graph.get(d) ?? [])) {
      if (e.relation === 'collides') rivalDomains.add(e.concept)
    }
  }
  const rivalAgentIds = world.agents
    .filter(a => a.id !== creatorGod.id && a.domains.some(d => rivalDomains.has(d)))
    .map(a => a.id)

  // Priests
  const creatorReligions = religions.filter(r => r.worshippedAgents.includes(creatorGod.id))
  const rivalReligions = religions.filter(r =>
    r.worshippedAgents.some(id => rivalAgentIds.includes(id))
  )
  let priests
  if (creatorReligions.length > 0 && rivalReligions.length > 0) {
    const welcome = pick(rng, ['welcome with reverence', 'subject to ancient tests', 'guard with suspicion then serve'])
    priests = `${creatorReligions[0].name} ${welcome}; ${rivalReligions[0].name} are hostile, sensing wrongness`
  } else if (creatorReligions.length > 0) {
    priests = pick(rng, ['welcome with reverence', 'subject to ancient tests', 'treat as holy'])
  } else if (rivalReligions.length > 0) {
    priests = pick(rng, ['are openly hostile', 'sense wrongness and recoil', 'watch with suspicion'])
  } else {
    priests = pick(rng, ['are indifferent, seeing nothing unusual', 'show professional courtesy'])
  }

  // Commoners — based on how unusual the character appears
  let commoners
  if (appearance.normalcy === 'indistinguishable') {
    commoners = pick(rng, ['pass unremarked, just another traveler', 'attract no unusual attention', 'blend easily into crowds'])
  } else if (appearance.normalcy === 'subtly-wrong') {
    commoners = pick(rng, ['watched from doorways', 'children stare, adults look away', "offered help at arm's length", 'given slightly too much space'])
  } else {
    commoners = pick(rng, ['feared and avoided', 'crowds part in silence', 'met with warding signs and hasty retreats'])
  }

  // Agents — allied (related to creator) vs hostile (rival domains)
  const alliedAgents = world.agents.filter(a => {
    if (a.id === creatorGod.id) return false
    return a.relationships.some(r => r.target === creatorGod.id) ||
           creatorGod.relationships.some(r => r.target === a.id && r.kind !== 'rival')
  })
  const hostileAgents = world.agents.filter(a => rivalAgentIds.includes(a.id))
  let agents
  if (alliedAgents.length > 0 && hostileAgents.length > 0) {
    agents = pick(rng, [
      'those who serve your creator obey without question; those who oppose them recoil',
      'kin-gods bow slightly; rival powers grow watchful',
    ])
  } else if (alliedAgents.length > 0) {
    agents = pick(rng, ['serve without question', 'recognize and are compelled to aid', 'sense kinship and defer'])
  } else if (hostileAgents.length > 0) {
    agents = pick(rng, ['oppose instinctively', 'seek to obstruct or destroy', 'sense the wrongness of your presence'])
  } else {
    agents = pick(rng, ['observe with caution', 'are watchful but do not intervene'])
  }

  // Artifacts — creator's relics react warmly, rival artifacts resist
  const creatorArtifacts = (world.artifacts ?? []).filter(a => a.origin.agentId === creatorGod.id)
  const rivalArtifacts = (world.artifacts ?? []).filter(a =>
    a.origin.agentId !== null && rivalAgentIds.includes(/** @type {string} */ (a.origin.agentId))
  )
  let artifacts
  if (creatorArtifacts.length > 0 && rivalArtifacts.length > 0) {
    const friendly = pick(rng, ['glow faintly', 'grow warm', 'resonate'])
    const hostile = pick(rng, ['grow cold', 'resist handling', 'vibrate with warning'])
    artifacts = `${creatorGod.name}'s relics ${friendly}; rival objects ${hostile}`
  } else if (creatorArtifacts.length > 0) {
    artifacts = pick(rng, ['glow faintly when nearby', 'grow warm to the touch', 'resonate with your presence'])
  } else {
    artifacts = pick(rng, ['do not react', 'remain inert and indifferent'])
  }

  return { priests, commoners, agents, artifacts }
}

/**
 * Apply character-layer mutations to earlier entities.
 * @param {World} world
 * @param {PlayerCharacter} character
 */
function applyMutations(world, character) {
  const region = (world.chorogony?.regions ?? []).find(r => r.id === character.arrival.regionId)
  if (region) {
    /** @type {*} */ (region).playerArrival = true
  }

  if (character.arrival.landmarkId) {
    const landmark = (world.geogony?.landmarks ?? []).find(l => l.id === character.arrival.landmarkId)
    if (landmark) {
      /** @type {*} */ (landmark).playerArrival = true
    }
  }
}

// ── Main entry ──

/**
 * Generate a character and write it into the world.
 * @param {ConceptGraph} graph
 * @param {World} world
 * @param {() => number} rng
 */
export function generateCharacter(graph, world, rng) {
  if (!world.present || world.agents.length === 0) return

  const creatorGod = selectCreatorGod(graph, rng, world)
  const purpose = derivePurpose(graph, rng, world, creatorGod)
  const concepts = pickConceptTags(graph, rng, creatorGod)
  const arrival = selectArrival(graph, rng, world, concepts, purpose)
  const appearance = buildAppearance(graph, rng, concepts)
  const instincts = buildInstincts(graph, rng, concepts)
  const reactions = buildReactions(graph, rng, world, creatorGod, appearance)

  /** @type {PlayerCharacter} */
  const character = {
    creatorGod: creatorGod.id,
    purpose,
    concepts,
    arrival,
    appearance,
    instincts,
    reactions,
  }

  applyMutations(world, character)
  world.character = character
}
