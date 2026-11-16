// Army tab of the menu. Left: every shadow as a card, sorted by power, level
// or rank and filtered by rank group and role. Right: the selected shadow
// with its values, its rank (every rank has a limited number), its name
// (officers only) and Dismiss. With nothing selected the right side shows
// every rank and who holds it.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { fmt } from '../core/format.js';
import { RANKS, rankOf } from '../core/levels.js';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const SORTS = ['power', 'level', 'rank'];
const GROUPS = ['all', 'officers', 'knights', 'normal'];
const ROLES = ['all', 'tank', 'melee', 'ranged', 'healer'];
// colour of every shadow rank (the same as its aura in the field)
export const SRANK_CSS = CONFIG.shadows.ranks.map((R) => '#' + R.color.toString(16).padStart(6, '0'));

export class ArmyPanel {
  constructor(game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'ap-root';
    this.selected = -1;
    this.confirm = false;
    this.locked = false;
    this.hint = ''; // "army full" note while a soul waits to be raised
    this.sort = 'power';
    this.group = 'all';
    this.role = 'all';
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  reset() {
    this.selected = -1;
    this.confirm = false;
  }

  onClick(e) {
    const target = e.target.closest('[data-act],[data-slot]');
    if (!target || target.disabled) return;
    const army = this.game.army;
    const act = target.dataset.act;
    const sel = this.selected >= 0 ? army.units[this.selected] : null;
    if (!act) {
      const slot = Number(target.dataset.slot);
      this.selected = this.selected === slot ? -1 : slot;
      this.confirm = false;
    } else if (act === 'sort') {
      this.sort = target.dataset.v;
    } else if (act === 'group') {
      this.group = target.dataset.v;
    } else if (act === 'role') {
      this.role = target.dataset.v;
    } else if (this.locked) {
      return;
    } else if (act === 'rank' && sel) {
      if (army.setRank(sel, Number(target.dataset.r)) && sel.rank > 0) {
        this.game.hud.toast(t('army.promoted', { name: army.name(sel), rank: t('srank.' + army.rankDef(sel).id) }));
      }
    } else if (act === 'rename' && sel) {
      const input = this.el.querySelector('.ap-name input');
      if (input) army.rename(sel, input.value);
    } else if (act === 'dismiss') {
      this.confirm = true;
    } else if (act === 'no') {
      this.confirm = false;
    } else if (act === 'yes' && sel) {
      army.dismiss(this.selected);
      this.selected = -1;
      this.confirm = false;
      // a soul is waiting: back to the fight so it can be raised
      if (this.hint) { this.hint = ''; this.game.menu.close(); return; }
    }
    this.render();
  }

  // ---- the list -------------------------------------------------------------------
  shown() {
    const army = this.game.army;
    const list = army.units.filter((u) => {
      if (!u) return false;
      const r = u.rank || 0;
      if (this.group === 'officers' && r < 3) return false;
      if (this.group === 'knights' && (r < 1 || r > 2)) return false;
      if (this.group === 'normal' && r !== 0) return false;
      return this.role === 'all' || u.role === this.role;
    });
    const by = {
      power: (a, b) => army.power(b) - army.power(a),
      level: (a, b) => b.level - a.level || army.power(b) - army.power(a),
      rank: (a, b) => (b.rank || 0) - (a.rank || 0) || army.power(b) - army.power(a),
    }[this.sort];
    return list.sort(by);
  }

  card(u) {
    const army = this.game.army;
    const r = u.rank || 0, R = CONFIG.shadows.ranks[r];
    const state = u.alive ? t('role.' + u.role) : t('army.fallen');
    const xp = Math.round(army.xpShare(u) * 100);
    return `<div class="ap-card r${r}${u.slot === this.selected ? ' sel' : ''}${u.alive ? '' : ' dead'}" data-slot="${u.slot}" style="--sc:${SRANK_CSS[r]}">
      <em>${t('srankS.' + R.id)}</em><div><b>${esc(army.name(u))}</b>
      <small>${t('army.level', { level: army.shownLevel(u) })} · ${RANKS[rankOf(army.powerLevel(u))]} · ${state}</small>
      <span>${t('army.power', { n: fmt(army.power(u)) })}</span></div><i style="--p:${xp}%"></i></div>`;
  }

  seg(act, v, label, on) {
    return `<button class="seg${on ? ' on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`;
  }

  // ---- the right side ---------------------------------------------------------------
  overview() {
    const army = this.game.army, S = CONFIG.shadows;
    const rows = S.ranks.map((R, r) => {
      let holders = '';
      if (R.officer) {
        const names = army.deployed.filter((u) => u.rank === r).map((u) => esc(army.name(u)));
        while (names.length < R.max) names.push(`<i>${t('army.free')}</i>`);
        holders = `<small>${names.join(' · ')}</small>`;
      }
      return `<div class="ap-rk" style="--sc:${SRANK_CSS[r]}"><em>${t('srankS.' + R.id)}</em><div><b>${t('srank.' + R.id)}${R.max ? ` <u>${army.rankCount(r)}/${R.max}</u>` : ''}</b>
        <small>${t('army.mult', { v: R.mult })}${R.level ? ' · ' + t('army.level', { level: R.level }) : ''}</small>${holders}</div></div>`;
    }).join('');
    return `<h3>${t('army.overview')}</h3><div class="d-rows" data-scroll="apd"><p class="ap-hint">${t('army.overviewHint')}</p>${rows}
      <p class="ap-hint">${t('army.officerHint')}</p></div>`;
  }

  detail(u) {
    const army = this.game.army, S = CONFIG.shadows, P = this.game.player;
    const r = u.rank || 0, R = S.ranks[r];
    const xp = Math.round(army.xpShare(u) * 100);
    const officer = army.isOfficer(u);
    const row = (k, v) => `<div class="row"><span>${k}</span><b>${v}</b></div>`;
    const rows = [
      row(t('army.powerL'), fmt(army.power(u))),
      row(t('army.health'), fmt(u.maxHp)),
      row(t('army.damage'), fmt(u.dmg)),
      row(t('army.role'), t('role.' + u.role)),
      row(t('army.levelL'), `${army.shownLevel(u)} <small>${t('army.xp', { p: xp })}${officer ? ' · ' + t('army.noCap') : ''}</small>`),
      row(t('army.strength'), `${t('army.level', { level: army.powerLevel(u) })} · ${RANKS[rankOf(army.powerLevel(u))]}`),
    ];
    // rank: every rank with how many are given out; Normal takes a rank away
    const ranks = S.ranks.map((T, k) => {
      const block = army.rankBlock(u, k);
      const info = k === 0 ? t('army.mult', { v: T.mult }) : `${army.rankCount(k)}/${T.max}${block === 'level' ? ' · ' + t('army.level', { level: T.level }) : ''}`;
      return `<button class="seg ttl${k === r ? ' on' : ''}" style="--sc:${SRANK_CSS[k]}" data-act="rank" data-r="${k}"${(block && block !== 'has') || this.locked ? ' disabled' : ''}>
        ${t('srank.' + T.id)}<small>${info}</small></button>`;
    }).join('');
    const rank = `<h4>${t('army.rank')} <em>${t('army.mult', { v: R.mult })}</em></h4><div class="ap-titles">${ranks}</div>
      <p class="ap-hint">${t('army.officerHint')}</p>`;
    const name = officer ? `<div class="ap-name"><input type="text" maxlength="${S.nameMaxLength}" value="${esc(u.nick || '')}" placeholder="${esc(army.name(u))}" aria-label="${t('army.name')}">
      <button class="ap-btn small" data-act="rename"${this.locked ? ' disabled' : ''}>${t('army.rename')}</button></div>` : '';
    const sub = `${t('srank.' + R.id)}${u.nick ? ' · ' + esc(t('enemy.' + u.type)) : ''}`;
    const dismiss = this.confirm
      ? `<div class="ap-confirm"><span>${esc(t('army.confirmOne', { name: army.name(u) }))}</span>
          <button class="ap-btn danger" data-act="yes">${t('army.yes')}</button><button class="ap-btn ghost" data-act="no">${t('army.no')}</button></div>`
      : `<button class="ap-btn danger" data-act="dismiss"${this.locked ? ' disabled' : ''}>${t('army.dismiss')}</button>`;
    return `<h3 style="color:${SRANK_CSS[r]}">${esc(army.name(u))}</h3><small class="sub">${sub}</small>
      <div class="d-rows" data-scroll="apd">${name}${rows.join('')}<div class="ap-rank">${rank}</div></div>
      <div class="d-btns">${dismiss}</div>`;
  }

  render() {
    const army = this.game.army;
    const all = army.units.filter(Boolean);
    const list = this.shown();
    const sel = this.selected >= 0 ? army.units[this.selected] : null;
    if (this.selected >= 0 && !sel) this.selected = -1;
    const head = t('army.count', { n: all.length, max: army.maxDeployed() });
    const body = list.length ? list.map((u) => this.card(u)).join('')
      : `<div class="ap-empty">${all.length ? t('army.f.none') : t('army.none')}</div>`;
    const sorts = SORTS.map((s) => this.seg('sort', s, t('army.sort.' + s), this.sort === s)).join('');
    const groups = GROUPS.map((g) => this.seg('group', g, t('army.f.' + g), this.group === g)).join('');
    const roles = ROLES.map((r) => this.seg('role', r, r === 'all' ? t('army.f.all') : t('role.' + r), this.role === r)).join('');
    const note = this.locked ? t('army.campOnly') : this.hint ? esc(this.hint) : '';
    const scroll = this.el.querySelector('.ap-grid');
    const top = scroll ? scroll.scrollTop : 0;
    this.el.innerHTML = `<div class="ap-left">
        <div class="ap-head"><h3>${head}</h3>${note ? `<span class="ap-note">${note}</span>` : ''}</div>
        <div class="ap-tools"><div class="segs ap-segs">${sorts}</div><div class="segs ap-segs">${groups}</div><div class="segs ap-segs">${roles}</div></div>
        <div class="ap-grid" data-scroll="army">${body}</div></div>
      <div class="ap-right">${sel ? this.detail(sel) : this.overview()}</div>`;
    this.el.querySelector('.ap-grid').scrollTop = top;
  }
}
