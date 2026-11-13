// Touch controls: floating movement joystick on one half of the screen and
// aim sticks on the attack, skill and ultimate buttons. Every finger is tracked
// by pointer id so moving, aiming and dodging work at the same time.
import { CONFIG } from '../config.js';
import { input } from './input.js';

export function initTouch(els) {
  const { layer, joyBase, joyKnob, btnDodge } = els;

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
  const onWinMove = (e) => {
    if (e.pointerType === 'mouse') { input.mouseX = e.clientX; input.mouseY = e.clientY; }
  };
  window.addEventListener('pointermove', onWinMove);

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

  // ---- aim sticks (attack, skills, ultimate) --------------------------------
  const cancels = [];

  function makeStick(btn, knob, index) {
    const st = input.sticks[index];
    let id = -1, ox = 0, oy = 0, radius = 1, aimed = false;

    function aimTo(x, y) {
      const dx = x - ox, dy = y - oy;
      const d = Math.hypot(dx, dy);
      const max = radius * 0.9;
      const k = d > max ? max / d : 1;
      knob.style.transform = 'translate(' + (dx * k).toFixed(1) + 'px,' + (dy * k).toFixed(1) + 'px)';
      if (d / radius >= CONFIG.input.aimDeadzone) {
        aimed = true;
        st.aiming = true;
        st.x = dx / d;
        st.z = dy / d;
        st.power = Math.min(1, d / max);
      } else {
        st.aiming = false;
      }
    }

    function end(fire) {
      if (fire) {
        if (st.aiming) {
          st.fire = true;
          st.auto = false;
          st.fx = st.x;
          st.fz = st.z;
          st.fp = st.power;
        } else if (!aimed) {
          // quick tap: auto aim at the nearest enemy
          st.fire = true;
          st.auto = true;
        }
        // dragged out and back to the centre = cancelled
      }
      id = -1;
      st.aiming = false;
      knob.style.transform = '';
      btn.classList.remove('held');
    }

    btn.addEventListener('pointerdown', (e) => {
      if (id !== -1) return;
      e.stopPropagation();
      id = e.pointerId;
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      // The stick is centred where the finger lands, so touching anywhere on
      // the button is a tap and only a real drag starts aiming.
      ox = e.clientX;
      oy = e.clientY;
      radius = Math.max(btn.offsetWidth / 2, 40);
      aimed = false;
      btn.classList.add('held');
    });
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) aimTo(e.clientX, e.clientY);
    });
    btn.addEventListener('pointerup', (e) => {
      if (e.pointerId === id) end(true);
    });
    btn.addEventListener('pointercancel', (e) => {
      if (e.pointerId === id) end(false);
    });
    cancels.push(() => { if (id !== -1) end(false); });
  }

  els.sticks.forEach((s, i) => makeStick(s.btn, s.knob, i));

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

  const onBlur = () => {
    if (moveId !== -1) endMove();
    for (const c of cancels) c();
  };
  window.addEventListener('blur', onBlur);

  // removes the listeners on the window when the world is left
  return () => {
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('blur', onBlur);
  };
}
