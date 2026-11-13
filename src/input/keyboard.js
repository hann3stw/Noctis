// Keyboard controls for testing on a PC: WASD / arrows to move, Space to dodge.
// The mouse (aim + click to attack) is handled in touch.js via pointer events.
import { input } from './input.js';

const down = new Set();

function refresh() {
  let x = 0, z = 0;
  if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
  if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
  if (down.has('KeyW') || down.has('ArrowUp')) z -= 1;
  if (down.has('KeyS') || down.has('ArrowDown')) z += 1;
  if (x !== 0 && z !== 0) { x *= 0.7071; z *= 0.7071; }
  input.keyX = x;
  input.keyZ = z;
}

let onEscape = null;
export function setEscapeHandler(fn) {
  onEscape = fn;
}

function typing(e) {
  const tag = e.target && e.target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

// called once when the app starts
export function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (onEscape) onEscape();
      return;
    }
    if (e.repeat || typing(e)) return;
    if (e.code === 'Space' || e.code === 'ShiftLeft') {
      input.dodge = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyE') input.arise = true;
    else if (e.code === 'KeyG') input.enterGate = true;
    else if (e.code === 'KeyM') input.toggleMap = true;
    else if (e.code === 'KeyQ') input.keyCast = 1;
    else if (e.code === 'KeyR') input.keyCast = 2;
    else if (e.code === 'KeyF') input.keyCast = 3;
    else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      const k = Number(e.code.slice(5)) - 1;
      if (e.shiftKey) input.reviveSquad = k;
      else input.squadCycle = k;
    }
    down.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => {
    down.delete(e.code);
    refresh();
  });
  window.addEventListener('blur', () => {
    down.clear();
    refresh();
  });
}
