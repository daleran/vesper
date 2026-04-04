import Input from './input.js'
import Camera from './camera.js'

const MAX_DT = 0.1

export default class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   update: (dt: number) => void,
   *   render: () => void
   * }} handler
   */
  constructor(canvas, handler) {
    this.canvas = canvas
    this.handler = handler

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2d context')
    /** @type {CanvasRenderingContext2D} */
    this.ctx = ctx

    this.input = new Input()
    this.camera = new Camera(canvas.width, canvas.height)

    /** @type {number | null} */
    this._rafId = null
    /** @type {number} */
    this._lastTime = 0

    this._resize()
    this._onResize = () => this._resize()
    window.addEventListener('resize', this._onResize)
  }

  start() {
    this._lastTime = performance.now()
    this._rafId = requestAnimationFrame((t) => this._loop(t))
  }

  stop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    this.input.destroy()
    window.removeEventListener('resize', this._onResize)
  }

  /** @param {number} timestamp */
  _loop(timestamp) {
    const dt = Math.min((timestamp - this._lastTime) / 1000, MAX_DT)
    this._lastTime = timestamp

    this.handler.update(dt)
    this.input.update()

    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    this.handler.render()

    this._rafId = requestAnimationFrame((t) => this._loop(t))
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight

    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.ctx.scale(dpr, dpr)

    this.camera.resize(width, height)
  }
}
