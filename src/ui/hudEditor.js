// The editor for the buttons on the right of the screen (Settings > Button layout). The buttons
// are dragged with a finger or the mouse and made bigger or smaller; they cannot overlap and
// stay in the zone at the right of the screen (core/hudLayout.js). Save writes settings.layout,
// the HUD follows at once. It works from the title screen too: it draws its own picture of the buttons.
import { t } from '../strings.js';
import { play } from '../core/sfx.js';
import { settings, setSetting } from '../core/settings.js';
import { IDS, DEFAULT, SIZE_MIN, SIZE_MAX, layout, isDefault, overlap, zone, clampToZone } from '../core/hudLayout.js';

const COLORS = { attack: '#ff4a6a', dodge: '#4aa8ff', skill0: '#9a6bff', skill1: '#9a6bff', skill2: '#9a6bff', ult: '#ffc928', arise: '#b27cff' };
const LABELS = { attack: '⚔', dodge: '»', skill0: '1', skill1: '2', skill2: '3', ult: '★', arise: '☗' };

export class HudEditor {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.id = 'hud-editor';
    root.appendChild(this.el);
    this.isOpen = false;
    this.el.addEventListener('pointerdown', (e) => this.down(e));
    this.el.addEventListener('pointermove', (e) => this.move(e));
    this.el.addEventListener('pointerup', (e) => this.up(e));
    this.el.addEventListener('pointercancel', (e) => this.up(e));
    this.el.addEventListener('click', (e) => this.click(e));
  }

  u() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || parseFloat(getComputedStyle(this.el).getPropertyValue('--u')) || 4;
  }

  open() {
    this.draft = layout();
    this.sel = 'attack';
    this.drag = null;
    this.msg = '';
    this.isOpen = true;
    this.el.classList.add('on');
    this.render();
  }

  close() {
    this.isOpen = false;
    this.el.classList.remove('on');
  }

  // the global size of the buttons (Settings > Buttons) scales every position and size alike
  k() {
    return settings.buttonSize || 1;
  }

  place(id) {
    const c = this.draft[id], k = this.k(), sw = settings.swap;
    const side = sw ? 'left' : 'right';
    return `${side}:calc(var(--${sw ? 'sl' : 'sr'}) + var(--u) * ${(c.x - c.d / 2) * k});bottom:calc(var(--sb) + var(--u) * ${(c.y - c.d / 2) * k});width:calc(var(--u) * ${c.d * k});height:calc(var(--u) * ${c.d * k});`;
  }

  render() {
    const Z = zone(this.u());
    const btns = IDS.map((id) => `<div class="he-btn${id === this.sel ? ' sel' : ''}" data-id="${id}" style="${this.place(id)}--c:${COLORS[id]}"><b>${LABELS[id]}</b></div>`).join('');
    const sw = settings.swap;
    this.el.innerHTML = `<div class="he-zone" style="${sw ? 'left' : 'right'}:0;width:${(Z.maxX * this.u() * this.k()).toFixed(0)}px;height:${(Z.maxY * this.u() * this.k()).toFixed(0)}px"></div>
      ${btns}
      <div class="he-panel${sw ? ' right' : ''}">
        <h3>${t('set.layout')}</h3>
        <p>${t('he.hint')}</p>
        <div class="he-sel"></div>
        <div class="he-row"><button class="ap-btn" data-act="small">−</button><b class="he-size"></b><button class="ap-btn" data-act="big">+</button></div>
        <small class="he-msg"></small>
        <div class="he-row"><button class="ap-btn ghost" data-act="reset">${t('he.reset')}</button></div>
        <div class="he-row"><button class="ap-btn ghost" data-act="cancel">${t('he.cancel')}</button><button class="ap-btn gold" data-act="save">${t('he.save')}</button></div>
      </div>`;
    this.panel();
  }

  // the selected button's name and size
  panel() {
    const c = this.draft[this.sel], s = c.d / DEFAULT[this.sel].d;
    this.el.querySelector('.he-sel').textContent = t('he.b.' + this.sel);
    this.el.querySelector('.he-size').textContent = Math.round(s * 100) + '%';
    this.el.querySelector('.he-msg').textContent = this.msg;
    this.el.querySelector('[data-act="small"]').disabled = s <= SIZE_MIN + 0.001;
    this.el.querySelector('[data-act="big"]').disabled = s >= SIZE_MAX - 0.001;
    for (const b of this.el.querySelectorAll('.he-btn')) b.classList.toggle('sel', b.dataset.id === this.sel);
  }

  // pixels from the edge the buttons are on, as u (the safe area of a notch counts)
  toU(clientX, clientY) {
    const u = this.u(), k = this.k(), sw = settings.swap;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;left:0;bottom:0;width:var(--' + (sw ? 'sl' : 'sr') + ');height:var(--sb)';
    this.el.appendChild(probe);
    const sx = probe.offsetWidth, sy = probe.offsetHeight;
    probe.remove();
    const fromEdge = sw ? clientX - sx : innerWidth - clientX - sx;
    return { x: fromEdge / (u * k), y: (innerHeight - clientY - sy) / (u * k) };
  }

  down(e) {
    const b = e.target.closest('.he-btn');
    if (!b || !this.isOpen) return;
    e.preventDefault();
    this.sel = b.dataset.id;
    const c = this.draft[this.sel], p = this.toU(e.clientX, e.clientY);
    this.drag = { id: this.sel, el: b, dx: c.x - p.x, dy: c.y - p.y, pid: e.pointerId };
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* not everywhere */ }
    this.msg = '';
    this.panel();
  }

  move(e) {
    const D = this.drag;
    if (!D || e.pointerId !== D.pid) return;
    const c = this.draft[D.id], p = this.toU(e.clientX, e.clientY);
    const want = clampToZone(p.x + D.dx, p.y + D.dy, c.d, this.u());
    // blocked by another button: slide along it, else stay
    let x = want.x, y = want.y;
    if (overlap(this.draft, D.id, x, y, c.d)) {
      if (!overlap(this.draft, D.id, x, c.y, c.d)) y = c.y;
      else if (!overlap(this.draft, D.id, c.x, y, c.d)) x = c.x;
      else { x = c.x; y = c.y; }
    }
    c.x = x;
    c.y = y;
    D.el.style.cssText = this.place(D.id) + '--c:' + COLORS[D.id];
  }

  up(e) {
    if (this.drag && e.pointerId === this.drag.pid) this.drag = null;
  }

  // a size step, only when there is room
  resize(dir) {
    const id = this.sel, c = this.draft[id], base = DEFAULT[id].d;
    const s = Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round((c.d / base + dir * 0.05) * 100) / 100));
    const d = base * s;
    const pos = clampToZone(c.x, c.y, d, this.u());
    if (overlap(this.draft, id, pos.x, pos.y, d)) { this.msg = t('he.noRoom'); this.panel(); return; }
    c.d = d;
    c.x = pos.x;
    c.y = pos.y;
    this.msg = '';
    const el = this.el.querySelector(`.he-btn[data-id="${id}"]`);
    el.style.cssText = this.place(id) + '--c:' + COLORS[id];
    this.panel();
  }

  click(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    play('ui');
    const act = b.dataset.act;
    if (act === 'small') this.resize(-1);
    else if (act === 'big') this.resize(1);
    else if (act === 'reset') { this.draft = JSON.parse(JSON.stringify(DEFAULT)); this.msg = ''; this.render(); }
    else if (act === 'cancel') this.close();
    else if (act === 'save') {
      setSetting('layout', isDefault(this.draft) ? null : JSON.parse(JSON.stringify(this.draft)));
      this.close();
    }
  }
}
