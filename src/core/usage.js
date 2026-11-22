// How often the player uses what, kept on this device only (nothing is sent anywhere). Every press of a
// button in the game is counted under a short name (attack, dodge, skill0, arise, menu, tab:stats ...) and the
// seconds played are added up, so the settings can show presses per hour. It tells which buttons are used the
// most, to put those where the thumb is (see core/hudLayout.js, the order of the menu bar in ui/menu.js).
const KEY = 'noctis.usage';
let data = { sec: 0, n: {} };
let dirty = false;
let saveT = 0;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && typeof d.sec === 'number' && d.n && typeof d.n === 'object') data = d;
  } catch (e) { /* no storage */ }
}

function save() {
  if (!dirty) return;
  dirty = false;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* full or blocked */ }
}

// the name of what was pressed ('' = not counted)
function nameOf(target) {
  if (!target || !target.closest) return '';
  const menu = target.closest('#menu');
  if (menu) {
    const tab = target.closest('.mn-tab');
    if (tab) return 'tab:' + tab.dataset.tab;
    const a = target.closest('[data-act]');
    return a && a.dataset.act !== 'tab' ? 'menu:' + a.dataset.act : '';
  }
  const hud = target.closest('#hud, #touch-layer');
  if (!hud) return '';
  const b = target.closest('[id^="btn-"]');
  if (b) return b.id.slice(4);
  if (target.closest('.sq-summon')) return 'armySummon';
  if (target.closest('.sq-chip')) return 'armyOrder';
  if (target.closest('.qtrack')) return 'questTrack';
  if (target.closest('.minimap')) return 'minimap';
  if (target.closest('#touch-layer')) return 'move';
  return '';
}

export function initUsage() {
  load();
  document.addEventListener('pointerdown', (e) => {
    const id = nameOf(e.target);
    if (!id) return;
    data.n[id] = (data.n[id] || 0) + 1;
    dirty = true;
  }, true);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}

// called every frame of the game: the seconds played
export function usageTick(dt) {
  data.sec += dt;
  dirty = true;
  if ((saveT -= dt) <= 0) { saveT = 20; save(); }
}

// { hours, rows: [{ id, n, perHour }] } most used first
export function usageReport() {
  const hours = data.sec / 3600;
  const rows = Object.keys(data.n).map((id) => ({ id, n: data.n[id], perHour: hours > 0.01 ? data.n[id] / hours : 0 }));
  rows.sort((a, b) => b.n - a.n);
  return { hours, rows };
}

export function usageReset() {
  data = { sec: 0, n: {} };
  dirty = true;
  save();
}
