// Army tab of the menu. Left: every shadow as a card, sorted by power, level
// or rank and filtered by rank group and role. Right: the selected shadow
// with its values, its rank (buy Knight / Elite Knight, give or take a title),
// its name (officers only) and Dismiss. With nothing selected the right side
// shows the titles and who holds them.
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
// colour of every shadow rank
export const SRANK_CSS = ['#b8b8c8', '#7fb8ff', '#5cf0c8', '#ffd870', '#ffa040', '#ff6a8a', '#e8a0ff'];

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
    } else if (act === 'promote' && sel) {
      if (army.promote(sel)) this.game.hud.toast(t('army.promoted', { name: army.name(sel), rank: t('srank.' + army.rankDef(sel).id) }));
    } else if (act === 'title' && sel) {
      if (army.setTitle(sel, Number(target.dataset.r))) this.game.hud.toast(t('army.promoted', { name: army.name(sel), rank: t('srank.' + army.rankDef(sel).id) }));
    } else if (act === 'untitle' && sel) {
      army.removeTitle(sel);
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
    const xp = u.level >= CONFIG.shadows.maxLevel ? 100 : Math.round((u.xp / army.xpNeed(u.level, u)) * 100);
    return `<div class="ap-card r${r}${u.slot === this.selected ? ' sel' : ''}${u.alive ? '' : ' dead'}" data-slot="${u.slot}" style="--sc:${SRANK_CSS[r]}">
      <em>${t('srankS.' + R.id)}</em><div><b>${esc(army.name(u))}</b>
      <small>${t('army.level', { level: u.level })} · ${RANKS[rankOf(army.powerLevel(u))]} · ${state}</small>
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
      if (R.max) {
        const names = army.deployed.filter((u) => u.rank === r).map((u) => esc(army.name(u)));
        while (names.length < R.max) names.push(`<i>${t('army.free')}</i>`);
        holders = `<small>${names.join(' · ')}</small>`;
      }
      return `<div class="ap-rk" style="--sc:${SRANK_CSS[r]}"><em>${t('srankS.' + R.id)}</em><div><b>${t('srank.' + R.id)}${R.max ? ` <u>${army.titleCount(r)}/${R.max}</u>` : ''}</b>
        <small>${t('army.mult', { v: R.mult })}${R.level ? ' · ' + t('army.level', { level: R.level }) : ''}</small>${holders}</div></div>`;
    }).join('');
    return `<h3>${t('army.overview')}</h3><div class="d-rows" data-scroll="apd"><p class="ap-hint">${t('army.overviewHint')}</p>${rows}
      <p class="ap-hint">${t('army.officerHint')}</p></div>`;
  }

  detail(u) {
    const army = this.game.army, S = CONFIG.shadows, P = this.game.player;
    const r = u.rank || 0, R = S.ranks[r];
    const xp = u.level >= S.maxLevel ? 100 : Math.round((u.xp / army.xpNeed(u.level, u)) * 100);
    const row = (k, v) => `<div class="row"><span>${k}</span><b>${v}</b></div>`;
    const rows = [
      row(t('army.powerL'), fmt(army.power(u))),
      row(t('army.health'), fmt(u.maxHp)),
      row(t('army.damage'), fmt(u.dmg)),
      row(t('army.role'), t('role.' + u.role)),
      row(t('army.levelL'), `${u.level} <small>${t('army.xp', { p: xp })}</small>`),
      row(t('army.strength'), `${t('army.level', { level: army.powerLevel(u) })} · ${RANKS[rankOf(army.powerLevel(u))]}`),
    ];
    // rank: buy the next one, or titles for Elite Knights and officers
    const next = S.ranks[r + 1];
    let rank = '';
    if (next && !next.max) {
      const block = army.promoteBlock(u), cost = army.promoteCost(u);
      const why = block === 'level' ? t('army.needLevel', { level: next.level })
        : block === 'essence' ? t('army.needEss', { cost: fmt(cost), have: fmt(P.essence) }) : t('army.cost', { cost: fmt(cost) });
      rank = `<button class="ap-btn wide" data-act="promote"${block || this.locked ? ' disabled' : ''}>${t('army.promote', { rank: t('srank.' + next.id) })}<small>${why}</small></button>
        <p class="ap-hint">${t('army.titleNeedsElite')}</p>`;
    } else {
      const titles = S.ranks.map((T, k) => {
        if (!T.max) return '';
        const block = army.titleBlock(u, k);
        const lv = block === 'level' ? ` · ${t('army.level', { level: T.level })}` : '';
        return `<button class="seg ttl${k === r ? ' on' : ''}" style="--sc:${SRANK_CSS[k]}" data-act="title" data-r="${k}"${block && block !== 'has' || this.locked ? ' disabled' : ''}>
          ${t('srank.' + T.id)}<small>${army.titleCount(k)}/${T.max}${lv}</small></button>`;
      }).join('');
      rank = `<h4>${t('army.titles')}</h4><div class="ap-titles">${titles}</div>
        ${R.max ? `<button class="ap-btn ghost small" data-act="untitle"${this.locked ? ' disabled' : ''}>${t('army.removeTitle')}</button>` : ''}
        <p class="ap-hint">${t('army.officerHint')}</p>`;
    }
    const name = R.max ? `<div class="ap-name"><input type="text" maxlength="${S.nameMaxLength}" value="${esc(u.nick || '')}" placeholder="${esc(army.name(u))}" aria-label="${t('army.name')}">
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
