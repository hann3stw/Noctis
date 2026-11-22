// Keyboard controls for testing on a PC: WASD / arrows to move, Space to dodge.
// The mouse (aim + click to attack) is handled in touch.js via pointer events.
import { input } from './input.js';
import { actionOf, keyState } from '../core/keys.js';

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
    if (e.repeat || typing(e) || keyState.capturing) return;
    // the keys can be changed in Settings (core/keys.js); Shift also dodges while no other action has it
    const act = actionOf(e.code);
    if (act === 'dodge' || (e.code === 'ShiftLeft' && !act)) {
      input.dodge = true;
      e.preventDefault();
      return;
    }
    if (act === 'arise') input.arise = true;
    else if (act === 'gate') input.enterGate = true;
    else if (act === 'map') input.toggleMap = true;
    else if (act === 'cast1') input.keyCast = 1;
    else if (act === 'cast2') input.keyCast = 2;
    else if (act === 'cast3') input.keyCast = 3;
    else if (act === 'cast4') input.keyCast = 4;
    else if (act === 'summon') input.armySummon = true;
    else if (act === 'behavior') input.armyBehavior = true;
    else if (act === 'revive') input.armyRevive = true;
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
