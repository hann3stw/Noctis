// The co-op lobby (Pause > Co-op): host a game (a 5 character code), or join one with a code. The hunters that
// are in the lobby come along when the host enters a gate. See net/coop.js.
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class CoopPanel {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'coop-panel';
    root.appendChild(this.el);
    this.isOpen = false;
    this.redraw = () => { if (this.isOpen) this.render(); };
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  open() {
    this.isOpen = true;
    this.game.coop.listeners.add(this.redraw);
    this.el.classList.add('on');
    this.render();
  }

  close() {
    this.isOpen = false;
    this.game.coop.listeners.delete(this.redraw);
    this.el.classList.remove('on');
  }

  async onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    play('ui');
    const C = this.game.coop;
    const act = b.dataset.act;
    if (act === 'host') await C.host();
    else if (act === 'join') await C.join((this.el.querySelector('input') || {}).value);
    else if (act === 'quit') C.quit();
    else if (act === 'close') { this.close(); return; }
    this.render();
  }

  render() {
    const C = this.game.coop, mc = this.game.mainClass;
    const me = `<div class="cls-card" data-id="${mc || 'necromancer'}"><i class="emb" data-c="${mc || 'necromancer'}"></i><em>${t('coop.you')}</em><b>${esc(C.name || t('coop.guestName'))}</b><small class="mech">${t('hud.level', { level: this.game.player.level })}</small></div>`;
    const others = [...C.peers.values()].map((p) => `<div class="cls-card" data-id="${p.cls || 'necromancer'}"><i class="emb" data-c="${p.cls || 'necromancer'}"></i><em>${p.role === 'host' ? t('coop.host') : t('coop.hunter')}</em><b>${esc(p.name || '?')}</b><small class="mech">${t('hud.level', { level: p.level || 1 })}</small></div>`).join('');
    let body;
    if (C.phase === 'off') {
      body = `<p>${t('coop.intro')}</p>
        <div class="co-row"><button class="ap-btn go" data-act="host">${t('coop.hostBtn')}</button>
        <span class="co-or">${t('coop.or')}</span>
        <input type="text" maxlength="5" placeholder="${t('coop.codeHint')}" autocomplete="off" autocapitalize="characters">
        <button class="ap-btn" data-act="join">${t('coop.joinBtn')}</button></div>`;
    } else {
      const where = C.phase === 'run' ? t('coop.inGate') : C.role === 'host' ? t('coop.hostHint') : t('coop.guestHint');
      body = `<div class="co-code"><small>${t('coop.code')}</small><b>${C.code}</b></div>
        <div class="cls-grid">${me}${others}</div><p>${where}</p>
        <div class="co-row"><button class="ap-btn danger" data-act="quit">${t('coop.leave')}</button></div>`;
    }
    this.el.innerHTML = `<div class="ab-box mods"><div class="ab-head"><h2>${t('coop.title')}</h2><small>${C.status || t('coop.sub')}</small></div>
      ${body}
      <div class="ab-btns"><button class="ap-btn ghost" data-act="close">${t('menu.close')}</button></div></div>`;
  }
}
