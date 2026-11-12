// Touch controls: floating movement joystick on one half of the screen and an
// attack stick on the attack button. Every finger is tracked by pointer id so
// moving, aiming and dodging work at the same time.
import { CONFIG } from '../config.js';
import { input } from './input.js';

export function initTouch(els) {
  const { layer, joyBase, joyKnob, btnAttack, attackKnob, btnDodge } = els;

  // ---- movement joystick --------------------------------------------------
  let moveId = -1, baseX = 0, baseY = 0, baseR = 1;

  function moveTo(x, y) {
    let dx = x - baseX, dy = y - baseY;
    const d = Math.hypot(dx, dy);
    if (d > baseR) { dx *= baseR / d; dy *= baseR / d; }
    joyKnob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    const nx = dx / baseR, nz = dy / baseR;
    if (Math.hypot(nx, nz) < CONFIG.input.moveDeadzone) {
      input.touchX = input.touchZ = 0;
    } else {
      input.touchX = nx;
      input.touchZ = nz;
    }
  }

  function endMove() {
    moveId = -1;
    input.touchX = input.touchZ = 0;
    joyBase.classList.remove('on');
  }

  layer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) {
        input.mouseDown = true;
        input.mouseX = e.clientX;
        input.mouseY = e.clientY;
      } else if (e.button === 2) {
        input.dodge = true;
      }
      return;
    }
    const leftHalf = e.clientX < window.innerWidth / 2;
    if (moveId !== -1 || leftHalf === input.swap) return;
    moveId = e.pointerId;
    try { layer.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    baseR = joyBase.offsetWidth / 2 || 60;
    // keep the whole stick on screen
    baseX = Math.min(Math.max(e.clientX, baseR + 4), window.innerWidth - baseR - 4);
    baseY = Math.min(Math.max(e.clientY, baseR + 4), window.innerHeight - baseR - 4);
    joyBase.style.left = baseX + 'px';
    joyBase.style.top = baseY + 'px';
    joyBase.classList.add('on');
    moveTo(e.clientX, e.clientY);
  });

  layer.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      input.mouseX = e.clientX;
      input.mouseY = e.clientY;
      return;
    }
    if (e.pointerId === moveId) moveTo(e.clientX, e.clientY);
  });

  function layerUp(e) {
    if (e.pointerType === 'mouse') {
      if (e.button === 0 && input.mouseDown) {
        input.mouseDown = false;
        input.mouseReleased = true;
      }
      return;
    }
    if (e.pointerId === moveId) endMove();
  }
  layer.addEventListener('pointerup', layerUp);
  layer.addEventListener('pointercancel', (e) => {
    if (e.pointerType === 'mouse') input.mouseDown = false;
    else if (e.pointerId === moveId) endMove();
  });

  // ---- attack stick -------------------------------------------------------
  let atkId = -1, atkX = 0, atkY = 0, atkR = 1, aimed = false;

  function aimTo(x, y) {
    let dx = x - atkX, dy = y - atkY;
    const d = Math.hypot(dx, dy);
    const max = atkR * 0.9;
    const k = d > max ? max / d : 1;
    attackKnob.style.transform = 'translate(' + (dx * k).toFixed(1) + 'px,' + (dy * k).toFixed(1) + 'px)';
    if (d / atkR >= CONFIG.input.aimDeadzone) {
      aimed = true;
      input.aiming = true;
      input.aimX = dx / d;
      input.aimZ = dy / d;
    } else {
      input.aiming = false;
    }
  }

  function endAim(fire) {
    if (fire) {
      if (input.aiming) {
        input.fire = true;
        input.fireAuto = false;
        input.fireX = input.aimX;
        input.fireZ = input.aimZ;
      } else if (!aimed) {
        // quick tap: auto aim at the nearest enemy
        input.fire = true;
        input.fireAuto = true;
      }
      // dragged out and back to the centre = cancelled
    }
    atkId = -1;
    input.aiming = false;
    attackKnob.style.transform = '';
    btnAttack.classList.remove('held');
  }

  btnAttack.addEventListener('pointerdown', (e) => {
    if (atkId !== -1) return;
    e.stopPropagation();
    atkId = e.pointerId;
    try { btnAttack.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    // The stick is centred where the finger lands, so touching anywhere on
    // the button is a tap and only a real drag starts aiming.
    atkX = e.clientX;
    atkY = e.clientY;
    atkR = btnAttack.offsetWidth / 2 || 60;
    aimed = false;
    btnAttack.classList.add('held');
  });
  btnAttack.addEventListener('pointermove', (e) => {
    if (e.pointerId === atkId) aimTo(e.clientX, e.clientY);
  });
  btnAttack.addEventListener('pointerup', (e) => {
    if (e.pointerId === atkId) endAim(true);
  });
  btnAttack.addEventListener('pointercancel', (e) => {
    if (e.pointerId === atkId) endAim(false);
  });

  // ---- dodge --------------------------------------------------------------
  btnDodge.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    input.dodge = true;
    btnDodge.classList.add('held');
  });
  const release = () => btnDodge.classList.remove('held');
  btnDodge.addEventListener('pointerup', release);
  btnDodge.addEventListener('pointercancel', release);
  btnDodge.addEventListener('pointerleave', release);

  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => {
    if (moveId !== -1) endMove();
    if (atkId !== -1) endAim(false);
  });
}
