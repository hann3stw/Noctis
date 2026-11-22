// The Camp tab of the menu: the camp mechanics the classes of the Path unlock
// (Barracks, ...). Each one is a section; this file draws them and handles their buttons.
import { CONFIG } from '../config.js';
import { fmt } from '../core/format.js';
import { t } from '../strings.js';
import { runesOf } from '../core/runes.js';
import { TAB_ICONS } from './icons.js';

// the unlocks that are a section of the Camp tab
export const SECTIONS = ['barracks', 'duelArena', 'runeWorkshop', 'fortify', 'huntBoard', 'contracts'];

// the sections that are unlocked (and exist in the game)
export function campSections(game) {
  const have = game.path.unlockedList();
  return SECTIONS.filter((id) => have.includes(id));
}

// a badge for the tab: something waits
export function campNews(game) {
  return game.barracks && game.barracks.report ? '!' : ''; // for the Barracks tab
}

const dur = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};

function barracksView(menu) {
  const g = menu.game, B = g.barracks, A = g.army, P = g.player, C = CONFIG.barracks;
  B.collect();
  const inCamp = P.inCamp, full = B.garrison.length >= B.capacity(), cost = B.upgradeCost();
  const exp = g.path.has('expeditions');
  const head = `<div class="cp-head"><b>${t('barracks.title')}</b><span>${t('barracks.level', { n: B.level })}</span><span>${t('barracks.cap', { n: B.garrison.length, max: B.capacity() })}</span><span>${t('barracks.rate', { n: B.rate().toFixed(2) })}</span>
    ${B.level < C.maxLevel ? `<button class="ap-btn ghost" data-act="campUpgrade"${P.essence >= cost ? '' : ' disabled'}>${t('barracks.upgrade', { n: fmt(cost) })}</button>` : ''}</div>`;
  const inside = B.garrison.map((e) => {
    const away = B.away(e.id), sel = B.party.has(e.id);
    const state = away ? t('barracks.away') : t('barracks.ready', { n: (B.hours(e) * B.rate()).toFixed(1) });
    return `<div class="cp-row${away ? ' away' : ''}${sel ? ' sel' : ''}"><div><b>${A.name(e.u)}</b><small>${t('barracks.lv', { n: A.shownLevel(e.u) })}${e.u.alive ? '' : ' · ' + t('barracks.fallen')} · ${state}</small></div>
      ${exp && !away ? `<button class="ap-btn ghost" data-act="campParty" data-id="${e.id}">${sel ? '✓' : '+'}</button>` : ''}
      <button class="ap-btn ghost" data-act="campRecall" data-id="${e.id}"${away || !inCamp ? ' disabled' : ''}>${t('barracks.recall')}</button></div>`;
  }).join('') || `<p class="cp-none">${t('barracks.empty')}</p>`;
  const army = [...A.deployed].sort((a, b) => A.shownLevel(a) - A.shownLevel(b)).map((u) =>
    `<div class="cp-row"><div><b>${A.name(u)}</b><small>${t('barracks.lv', { n: A.shownLevel(u) })} · ${t('barracks.power', { n: fmt(A.power(u)) })}</small></div>
      <button class="ap-btn ghost" data-act="campStation" data-slot="${u.slot}"${full || !inCamp ? ' disabled' : ''}>${t('barracks.station')}</button></div>`).join('') || `<p class="cp-none">${t('barracks.noArmy')}</p>`;
  let missions = '';
  if (exp) {
    if (B.report) {
      const R = B.report;
      missions = `<div class="cp-exp"><p>${t('barracks.report', { e: fmt(R.essence), s: R.seals, i: R.items, f: R.fallen, n: R.size })}</p><button class="ap-btn gold" data-act="campClaim">${t('barracks.claim')}</button></div>`;
    } else if (B.mission) {
      const M = C.expeditions[B.mission.kind];
      missions = `<div class="cp-exp"><p>${t('barracks.exp.left', { name: t('barracks.exp.' + B.mission.kind), time: dur(Math.ceil(B.timeLeft() / 1000)), n: B.mission.ids.length })}</p></div>`;
      void M;
    } else {
      const cards = Object.keys(C.expeditions).map((k) => {
        const M = C.expeditions[k], R = B.rewardOf(k, M.party), ok = B.party.size >= M.party;
        const parts = [t('barracks.exp.essence', { n: fmt(R.essence) })];
        if (R.seals) parts.push(t('barracks.exp.seals', { n: R.seals }));
        if (R.items) parts.push(t('barracks.exp.items', { n: R.items, rarity: t('rarity.' + R.rarity) }));
        return `<div class="cp-mis"><b>${t('barracks.exp.' + k)}</b><small>${dur(M.time)} · ${t('barracks.exp.need', { n: M.party })} · ${t('barracks.exp.risk', { n: Math.round(M.injury * 100) })}</small><small>${parts.join(', ')}</small>
          <button class="ap-btn gold" data-act="campSend" data-kind="${k}"${ok ? '' : ' disabled'}>${t('barracks.exp.send', { n: B.party.size })}</button></div>`;
      }).join('');
      missions = `<div class="cp-exp"><b>${t('barracks.exp')}</b><small>${t('barracks.exp.hint')}</small><div class="cp-mis-row">${cards}</div></div>`;
    }
  }
  return `${head}${inCamp ? '' : `<small class="cp-note">${t('barracks.campOnly')}</small>`}${missions}
    <div class="cp-cols"><div class="cp-col"><div class="pa-sub">${t('barracks.inside')}</div><div class="cp-list" data-scroll="cpIn">${inside}</div></div>
    <div class="cp-col"><div class="pa-sub">${t('barracks.inArmy')}</div><div class="cp-list" data-scroll="cpArmy">${army}</div></div></div>`;
}

function duelView(menu) {
  const g = menu.game, D = g.duel, C = CONFIG.duel, why = D.block();
  const z = CONFIG.world.zones[D.zone()];
  return `<div class="cp-head"><b>${t('duel.title')}</b><span>${t('duel.record', { won: D.won, best: D.best })}</span></div>
    <div class="cp-exp"><p>${t('duel.text', { zone: t('zone.' + z.id), tier: C.tier, items: C.items, seals: C.seals })}</p>
    <button class="ap-btn gold" data-act="campDuel"${why ? ' disabled' : ''}>${t('duel.start', { n: fmt(D.cost()) })}</button>
    ${why ? `<small>${t('duel.no.' + why)}</small>` : ''}</div>`;
}

function workshopView(menu) {
  const g = menu.game, R = g.runes, P = g.player, W = CONFIG.runeWorkshop;
  const skills = P.known.filter((id) => (CONFIG.skills[id] || CONFIG.ultimates[id]) && runesOf(id).length);
  const rows = skills.map((id) => {
    const cards = runesOf(id).map((r) => {
      if (!R.has(id, r)) {
        const c = R.craftCost();
        return `<div class="cp-rune lock"><b>${t('rune.' + r)}</b><small>${t('workshop.unknown')}</small><button class="ap-btn ghost" data-act="campCraft" data-skill="${id}" data-r="${r}"${P.essence >= c ? '' : ' disabled'}>${t('workshop.craft', { n: fmt(c) })}</button></div>`;
      }
      const lv = R.level(id, r), c = R.infuseCost(id, r);
      const pips = '◆'.repeat(lv) + '◇'.repeat(W.max - lv);
      return `<div class="cp-rune"><b>${t('rune.' + r)} <span class="cp-pips">${pips}</span></b><small>${t('rune.' + r + '.desc')}</small>${c ? `<button class="ap-btn ghost" data-act="campInfuse" data-skill="${id}" data-r="${r}"${P.essence >= c ? '' : ' disabled'}>${t('workshop.infuse', { n: fmt(c) })}</button>` : `<small class="cp-max">${t('workshop.max')}</small>`}</div>`;
    }).join('');
    return `<div class="cp-skill"><div class="pa-sub">${t('skill.' + id)}</div><div class="cp-runes">${cards}</div></div>`;
  }).join('');
  return `<div class="cp-head"><b>${t('workshop.title')}</b><span>${t('workshop.hint', { b: Math.round(W.levelBonus * 100) })}</span></div>
    <div class="cp-list cp-wide" data-scroll="cpWork">${rows || `<p class="cp-none">${t('workshop.none')}</p>`}</div>`;
}

function fortView(menu) {
  const g = menu.game, F = g.fort, P = g.player, C = CONFIG.fortify;
  const rows = F.outposts().map((si) => {
    const lv = F.level(si), c = F.cost(si), pips = '◆'.repeat(lv) + '◇'.repeat(C.max - lv);
    return `<div class="cp-row"><div><b>${g.safeName(si)} <span class="cp-pips">${pips}</span></b><small>${lv ? t('fort.lv', { r: Math.round(C.reduction[lv - 1] * 100), h: Math.round(C.regen[lv - 1] * 100) }) : t('fort.none')}</small></div>
      ${c ? `<button class="ap-btn ghost" data-act="campFort" data-si="${si}"${P.essence >= c ? '' : ' disabled'}>${t('fort.upgrade', { n: fmt(c) })}</button>` : `<small>${t('fort.max')}</small>`}</div>`;
  }).join('');
  return `<div class="cp-head"><b>${t('fort.title')}</b><span>${t('fort.hint', { s: C.time })}</span></div>
    <div class="cp-list cp-wide" data-scroll="cpFort">${rows || `<p class="cp-none">${t('fort.empty')}</p>`}</div>`;
}

function boardView(menu) {
  const g = menu.game, H = g.hunts, P = g.player, B = CONFIG.huntBoard, busy = H.on || H.pending >= 0;
  const T = B.trophy, n = H.trophyCount();
  const cards = B.contracts.map((C, ci) => {
    const c = H.callCost(ci), parts = [t('board.c.tough', { hp: Math.round((C.hp - 1) * 100), dmg: Math.round((C.damage - 1) * 100) })];
    const rew = [t('board.c.essence', { n: Math.round(C.essence * 100) })];
    if (C.items) rew.push(t('board.c.items', { n: C.items }));
    if (C.rarity) rew.push(t('board.c.rarity'));
    if (C.seals) rew.push(t('board.c.seals', { n: C.seals }));
    return `<div class="cp-mis"><b>${t('board.c.' + C.id)}</b><small>${C.hp > 1 ? parts[0] : t('board.c.plain')}</small><small>${rew.join(', ')}</small>
      <button class="ap-btn gold" data-act="campHunt" data-ci="${ci}"${busy || P.essence < c ? ' disabled' : ''}>${t('board.call', { n: fmt(c) })}</button></div>`;
  }).join('');
  const chips = Object.keys(H.trophies).map((id) => `<li>${t('enemy.' + id)}${H.trophies[id] > 1 ? ' ×' + H.trophies[id] : ''}</li>`).join('');
  const state = H.pending >= 0 ? t('board.pending') : H.on ? t('board.on', { name: H.name }) : '';
  return `<div class="cp-head"><b>${t('board.title')}</b><span>${t('board.trophies', { n, d: (T.damage * n * 100).toFixed(1), h: (T.hp * n * 100).toFixed(1) })}</span></div>
    <div class="cp-exp"><small>${t('board.hint')}</small>${state ? `<p>${state}</p>` : ''}<div class="cp-mis-row">${cards}</div></div>
    <div class="pa-sub">${t('board.trophyList')}</div><div class="cp-list cp-wide" data-scroll="cpTro">${chips ? `<ul class="pa-tot">${chips}</ul>` : `<p class="cp-none">${t('board.noTrophy')}</p>`}</div>`;
}

function contractsView(menu) {
  const g = menu.game, C = CONFIG.contracts, M = CONFIG.modifiers;
  return `<div class="cp-head"><b>${t('contracts.title')}</b></div>
    <div class="cp-exp"><p>${t('contracts.text', { max: M.max + C.extra, luck: Math.round(C.luck * 100), per: Math.round(1 / C.seals) })}</p>
    <small>${t('contracts.how')}</small>
    <button class="ap-btn gold" data-act="campMods">${t('contracts.open', { n: g.mods.length, max: g.modsMax() })}</button></div>`;
}

// a line about the state of a mechanic, for its card in the Camp page
function summary(g, id) {
  if (id === 'barracks') return t('barracks.cap', { n: g.barracks.garrison.length, max: g.barracks.capacity() });
  if (id === 'duelArena') return t('duel.record', { won: g.duel.won, best: g.duel.best });
  if (id === 'runeWorkshop') return t('camp.sum.runes', { n: g.runes.owned.length });
  if (id === 'fortify') { const all = g.fort.outposts(); return t('camp.sum.fort', { n: all.filter((si) => g.fort.level(si) > 0).length, max: all.length }); }
  if (id === 'huntBoard') return t('camp.sum.hunt', { n: g.hunts.trophyCount() });
  if (id === 'contracts') return t('camp.sum.contracts', { n: g.mods.length, max: g.modsMax() });
  return '';
}

// the Camp page when several mechanics are unlocked: a big card for each
export function campHub(menu) {
  const g = menu.game;
  const cards = campSections(g).map((id) => `<button class="cp-hub" data-act="tab" data-tab="${id}">${TAB_ICONS[id]}<b>${t('menu.' + id)}</b><small>${summary(g, id)}</small></button>`).join('');
  return `<div class="camp"><div class="cp-hubs">${cards}</div></div>`;
}

// one section of the camp (its own page in the menu, or one card of the Camp page)
export function campView(menu, sec) {
  const views = { barracks: barracksView, duelArena: duelView, runeWorkshop: workshopView, fortify: fortView, huntBoard: boardView, contracts: contractsView };
  if (!views[sec]) return `<div class="camp"><p class="cp-none">${t('camp.none')}</p></div>`;
  return `<div class="camp">${views[sec](menu)}</div>`;
}

// the buttons of the Camp tab; true = it was one of ours
export function campAct(menu, act, target) {
  const g = menu.game, B = g.barracks;
  if (act === 'campTab') menu.campTab = target.dataset.id;
  else if (act === 'campUpgrade') B.upgrade();
  else if (act === 'campStation') B.station(Number(target.dataset.slot));
  else if (act === 'campRecall') B.recall(Number(target.dataset.id));
  else if (act === 'campParty') { const id = Number(target.dataset.id); if (B.party.has(id)) B.party.delete(id); else B.party.add(id); }
  else if (act === 'campSend') B.startMission(target.dataset.kind);
  else if (act === 'campClaim') B.claim();
  else if (act === 'campInfuse') g.runes.infuse(target.dataset.skill, target.dataset.r);
  else if (act === 'campCraft') g.runes.craft(target.dataset.skill, target.dataset.r);
  else if (act === 'campFort') g.fort.upgrade(Number(target.dataset.si));
  else if (act === 'campHunt') g.hunts.call(Number(target.dataset.ci));
  else if (act === 'campMods') { menu.close(); g.abyssPanel.open('mods'); }
  else if (act === 'campDuel') { if (g.duel.start()) menu.close(); }
  else return false;
  return true;
}
