export default class Input {
  constructor() {
    /** @type {Set<string>} Keys currently held down */
    this._held = new Set()
    /** @type {Set<string>} Keys pressed this frame (consumed on read) */
    this._pressed = new Set()

    /** Current mouse position in screen pixels */
    this.mouseX = 0
    this.mouseY = 0

    /** True while left mouse button is held */
    this.mouseDown = false

    /** True on the frame a drag begins (button just pressed + moved) */
    this.dragging = false

    /** Screen position where the current drag started */
    this.dragStartX = 0
    this.dragStartY = 0

    /** Delta mouse movement since last frame */
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0

    /** Scroll wheel delta this frame (positive = scroll down) */
    this.wheelDelta = 0

    /** True on the frame a single click occurs (mousedown + mouseup without drag) */
    this._clickPending = false
    this._dragThreshold = 4
    this._hasDragged = false
    this._prevMouseX = 0
    this._prevMouseY = 0

    this._onKeyDown = /** @param {KeyboardEvent} e */ (e) => {
      if (!this._held.has(e.code)) this._pressed.add(e.code)
      this._held.add(e.code)
    }
    this._onKeyUp = /** @param {KeyboardEvent} e */ (e) => {
      this._held.delete(e.code)
    }
    this._onMouseMove = /** @param {MouseEvent} e */ (e) => {
      this.mouseX = e.clientX
      this.mouseY = e.clientY
      if (this.mouseDown) {
        const dx = e.clientX - this.dragStartX
        const dy = e.clientY - this.dragStartY
        if (!this._hasDragged && Math.sqrt(dx * dx + dy * dy) > this._dragThreshold) {
          this._hasDragged = true
          this.dragging = true
        }
      }
    }
    this._onMouseDown = /** @param {MouseEvent} e */ (e) => {
      if (e.button !== 0) return
      this.mouseDown = true
      this._hasDragged = false
      this.dragging = false
      this.dragStartX = e.clientX
      this.dragStartY = e.clientY
    }
    this._onMouseUp = /** @param {MouseEvent} e */ (e) => {
      if (e.button !== 0) return
      if (!this._hasDragged) this._clickPending = true
      this.mouseDown = false
      this.dragging = false
    }
    this._onWheel = /** @param {WheelEvent} e */ (e) => {
      e.preventDefault()
      this.wheelDelta += e.deltaY
    }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('mousemove', this._onMouseMove)
    window.addEventListener('mousedown', this._onMouseDown)
    window.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('wheel', this._onWheel, { passive: false })
  }

  /**
   * True while the key is held down.
   * @param {string} code — KeyboardEvent.code e.g. 'KeyW', 'ArrowUp'
   */
  isDown(code) { return this._held.has(code) }

  /**
   * True only on the first frame the key is pressed. Consumed after read.
   * @param {string} code
   */
  isPressed(code) { return this._pressed.has(code) }

  /** True on the frame a click (non-drag mouseup) occurred. */
  wasClicked() { return this._clickPending }

  /** Call once per frame at the end of update to clear one-shot state. */
  update() {
    this._pressed.clear()
    this._clickPending = false
    this.mouseDeltaX = this.mouseX - this._prevMouseX
    this.mouseDeltaY = this.mouseY - this._prevMouseY
    this._prevMouseX = this.mouseX
    this._prevMouseY = this.mouseY
    this.wheelDelta = 0
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('mousemove', this._onMouseMove)
    window.removeEventListener('mousedown', this._onMouseDown)
    window.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('wheel', this._onWheel)
  }
}
