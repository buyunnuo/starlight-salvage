// Keyboard and pointer input. Held keys give a steering vector; one-shot presses
// (confirm, pause, mute, dash) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse
// aims in field coordinates: main tells this module the canvas transform each frame.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = FIELD.width / 2;
  let mouseY = FIELD.height / 2;
  let mouseDown = false;
  let actions = 0;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_CONFIRM;
    } else if (event.button === 2) {
      actions |= ACTION_DASH;
    }
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The renderer's scale and letterbox offset, so mouse coords map to the field. */
    setTransform(s, ox, oy) { scale = s; offsetX = ox; offsetY = oy; },
    /** Normalised steering vector from the held movement keys. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
        else if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
      }
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** The mouse aim point, in field coordinates. */
    aim() { return { x: mouseX, y: mouseY }; },
    /** Whether the left button (or touch) is held: autofire while held. */
    firing() { return mouseDown || keys.has('Space'); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Put flags back, so a caller that took them can hand some on. */
    requeue(flags) {
      actions |= flags;
    },
  };
}
