// The Camp tab of the menu: the camp mechanics the classes of the Path unlock
// (Barracks, ...). Each one is a section; this file draws them and handles their buttons.
import { CONFIG } from '../config.js';
import { fmt } from '../core/format.js';
import { t } from '../strings.js';
import { runesOf } from '../core/runes.js';

// the unlocks that are a section of the Camp tab
const SECTIONS = ['barracks', 'duelArena', 'runeWorkshop', 'fortify'];

// the sections that are unlocked (and exist in the game)
export function campSections(game) {
  const have = game.path.unlockedList();
  return SECTIONS.filter((id) => have.includes(id));
}

// a badge for the tab: something waits
export function campNews(game) {
  return game.barracks && game.barracks.report ? '!' : '';
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
        return `<div class="cp-mis"><b>${t('barracks.exp.' + k)}</b><small>${dur(M.time)} · ${t('barracks.exp.need', { n: M.party })}</small><small>${parts.join(', ')}</small><small>${t('barracks.exp.risk', { n: Math.round(M.injury * 100) })}</small>
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
    const runes = runesOf(id).map((r) => {
      if (!R.has(id, r)) {
        const c = R.craftCost();
        return `<div class="cp-row"><div><b>${t('rune.' + r)}</b><small>${t('workshop.unknown')}</small></div><button class="ap-btn ghost" data-act="campCraft" data-skill="${id}" data-r="${r}"${P.essence >= c ? '' : ' disabled'}>${t('workshop.craft', { n: fmt(c) })}</button></div>`;
      }
      const lv = R.level(id, r), c = R.infuseCost(id, r);
      const pips = '◆'.repeat(lv) + '◇'.repeat(W.max - lv);
      return `<div class="cp-row"><div><b>${t('rune.' + r)} <span class="cp-pips">${pips}</span></b><small>${t('rune.' + r + '.desc')}</small></div>${c ? `<button class="ap-btn ghost" data-act="campInfuse" data-skill="${id}" data-r="${r}"${P.essence >= c ? '' : ' disabled'}>${t('workshop.infuse', { n: fmt(c) })}</button>` : `<small>${t('workshop.max')}</small>`}</div>`;
    }).join('');
    return `<div class="pa-sub">${t('skill.' + id)}</div>${runes}`;
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

export function campView(menu) {
  const secs = campSections(menu.game);
  if (!secs.length) return `<div class="camp"><p class="cp-none">${t('camp.none')}</p></div>`;
  const cur = secs.includes(menu.campTab) ? menu.campTab : secs[0];
  const tabs = secs.length > 1 ? `<div class="cp-tabs">${secs.map((id) => `<button class="ttl${id === cur ? ' on' : ''}" data-act="campTab" data-id="${id}"><b>${t('camp.' + id)}</b></button>`).join('')}</div>` : '';
  const views = { barracks: barracksView, duelArena: duelView, runeWorkshop: workshopView, fortify: fortView };
  return `<div class="camp">${tabs}${views[cur](menu)}</div>`;
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
  else if (act === 'campDuel') { if (g.duel.start()) menu.close(); }
  else return false;
  return true;
}
