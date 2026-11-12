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

export function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ShiftLeft') {
      input.dodge = true;
      e.preventDefault();
      return;
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
