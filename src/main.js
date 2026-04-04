import Game from './game.js'
import { generateWorld } from './worldgen.js'
import { buildTerrainTexture, renderFrame } from './renderer.js'
import { Tooltip } from './tooltip.js'
import { TuningPanel, DEFAULT_PARAMS, DEFAULT_DISPLAY } from './tuning.js'
import { buildNameDict } from './naming.js'
import { generateFeatures } from './features.js'
import { hashSeed } from './utils.js'

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('main-canvas'))
const uiLayer = /** @type {HTMLElement} */ (document.getElementById('ui-layer'))
const tuningContainer = /** @type {HTMLElement} */ (document.getElementById('tuning-panel'))

// World size in pixels (each grid cell = 10 world units)
const CELL_SIZE = 10

let world = generateWorld(DEFAULT_PARAMS)
let names = buildNameDict(hashSeed(DEFAULT_PARAMS.seed))
let features = generateFeatures(world.cells, world.width, world.height, DEFAULT_PARAMS)
let terrainTexture = buildTerrainTexture(world, DEFAULT_DISPLAY)
const display = { ...DEFAULT_DISPLAY }

const tooltip = new Tooltip(uiLayer)

const panel = new TuningPanel(tuningContainer, (params) => {
  world = generateWorld(params)
  names = buildNameDict(hashSeed(params.seed))
  features = generateFeatures(world.cells, world.width, world.height, params)
  terrainTexture = buildTerrainTexture(world, display)
})

const game = new Game(canvas, {
  update(dt) {
    const { input, camera } = game

    // WASD / arrow key pan
    const PAN_SPEED = 400 / camera.scale
    if (input.isDown('KeyW') || input.isDown('ArrowUp'))    camera.y -= PAN_SPEED * dt
    if (input.isDown('KeyS') || input.isDown('ArrowDown'))  camera.y += PAN_SPEED * dt
    if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  camera.x -= PAN_SPEED * dt
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) camera.x += PAN_SPEED * dt

    // Mouse drag pan
    if (input.dragging) {
      camera.pan(input.mouseDeltaX, input.mouseDeltaY)
    }

    // Scroll wheel or Q/E zoom toward cursor (or screen center for keys)
    if (input.wheelDelta !== 0) {
      camera.zoom(input.wheelDelta, input.mouseX, input.mouseY)
    }
    const KEY_ZOOM_SPEED = 80
    if (input.isDown('KeyQ')) camera.zoom( KEY_ZOOM_SPEED, camera.width / 2, camera.height / 2)
    if (input.isDown('KeyE')) camera.zoom(-KEY_ZOOM_SPEED, camera.width / 2, camera.height / 2)

    // Home key — reset to island center at fit zoom
    if (input.isPressed('Home') || input.isPressed('Digit0')) {
      camera.fitToWorld(world.width * CELL_SIZE, world.height * CELL_SIZE)
    }

    // Clamp camera to world bounds
    camera.clampToBounds(world.width * CELL_SIZE, world.height * CELL_SIZE)

    // Tooltip — convert mouse screen pos to world cell
    const worldPos = camera.screenToWorld(input.mouseX, input.mouseY)
    const cx = Math.floor(worldPos.x / CELL_SIZE)
    const cy = Math.floor(worldPos.y / CELL_SIZE)
    const inBounds = cx >= 0 && cx < world.width && cy >= 0 && cy < world.height
    const cell = inBounds ? world.cells[cy * world.width + cx] : null
    tooltip.update(input.mouseX, input.mouseY, cx, cy, cell, names)
  },

  render() {
    renderFrame(game.ctx, game.camera, terrainTexture, features, display, null)
  },
})

// Center camera on island at start
game.camera.fitToWorld(world.width * CELL_SIZE, world.height * CELL_SIZE)
game.start()

// Suppress unused variable warnings
void panel
