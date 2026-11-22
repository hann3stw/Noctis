// Online features through Supabase (no extra library, plain fetch):
// - every device signs in anonymously once (no e-mail, no password)
// - Abyss leaderboard: the best floor of this player, everyone can read it
// - cloud saves: a copy of every save slot, only readable by its owner
// - pairing: a device joins the account of another one (5-character code,
//   valid 10 minutes) and shares its worlds, hunter name and leaderboard
//   entry until it disconnects
// - play data: batches of anonymous events (core/track.js) go to the table `events` (insert only)
// Everything fails quietly: without internet the game simply plays offline.
// The publishable key below is meant to be public; the database rules
// (row level security) decide what it may do.
const URL_BASE = 'https://ywecqnxbqivjnyjleyip.supabase.co';
const KEY = 'sb_publishable_p1JsJ_l07Lhd3m9FtRPJTA_j3TEUpZL';
const LS_SESSION = 'noctis.online.session';
const LS_SCORE = 'noctis.online.score'; // best entry not sent yet
const LS_LINK = 'noctis.online.link'; // { me, account, role, devices } of the last check

function lsGet(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
function lsSet(k, v) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked */ }
}

// Season 2 of the leaderboards: only worlds created after SEASON_START are on the board (the table checks the
// season too). Season 1 stays readable as a hall of fame (table abyss_scores_s1).
export const SEASON = 2;
export const SEASON_START = Date.parse('2026-11-22T23:40:00Z');
export const inSeason = (created) => Number(created) >= SEASON_START;

let session = lsGet(LS_SESSION);
let link = lsGet(LS_LINK);
let signing = null;
export const net = { status: 'idle' }; // idle | ok | offline

// ---- session -----------------------------------------------------------------
async function authCall(path, body) {
  const r = await fetch(URL_BASE + '/auth/v1/' + path, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || !d.access_token) throw Object.assign(new Error('auth'), { status: r.status });
  return { access: d.access_token, refresh: d.refresh_token, exp: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), id: d.user && d.user.id };
}

async function signIn() {
  const now = Date.now() / 1000;
  if (session && session.exp - 60 > now) return session;
  if (session && session.refresh) {
    try {
      session = await authCall('token?grant_type=refresh_token', { refresh_token: session.refresh });
      lsSet(LS_SESSION, session);
      return session;
    } catch (e) {
      // only a refused token starts over; a network error keeps it for later
      if (!e.status || e.status >= 500) throw e;
    }
  }
  session = await authCall('signup', { data: {} });
  lsSet(LS_SESSION, session);
  return session;
}

export async function ensureSession() {
  if (!signing) signing = signIn().finally(() => { signing = null; });
  try {
    const s = await signing;
    net.status = 'ok';
    return s;
  } catch (_) {
    net.status = 'offline';
    return null;
  }
}

// The account whose worlds and leaderboard entry this device uses: its own,
// or the one of the device it is paired with.
export function accountId() {
  if (!session) return null;
  return link && link.me === session.id && link.account ? link.account : session.id;
}
export const myId = accountId;

// { account, role: 'solo' | 'owner' | 'member', devices }
export function linkInfo() {
  if (link && session && link.me === session.id) return link;
  return { account: session ? session.id : null, role: 'solo', devices: 1 };
}
export function isLinked() {
  return linkInfo().role !== 'solo';
}

// REST call; auth = false reads as the public role
async function rest(path, { method = 'GET', body, prefer, auth = true } = {}) {
  const headers = { apikey: KEY };
  if (auth) {
    const s = await ensureSession();
    if (!s) throw new Error('offline');
    headers.Authorization = 'Bearer ' + s.access;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(URL_BASE + '/rest/v1/' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!r.ok) throw Object.assign(new Error((data && data.message) || 'request failed'), { status: r.status });
  return { data, range: r.headers.get('content-range') };
}

// ---- play data (core/track.js) ------------------------------------------------------
// the access token while it is still valid, without waiting for anything (for a send while the app closes)
export function cachedToken() {
  return session && session.exp - 30 > Date.now() / 1000 ? session.access : null;
}

// rows = [{ cid, cts, sid, name, props, ctx }]; quick = fetch that may outlive the page
export async function sendEvents(rows, quick) {
  const body = rows.map((r) => ({ cid: r.cid, cts: r.cts, sid: r.sid, name: r.name, props: r.props, ctx: r.ctx }));
  if (quick) {
    const tok = cachedToken();
    if (!tok) return false;
    const r = await fetch(URL_BASE + '/rest/v1/events', {
      method: 'POST', keepalive: true,
      headers: { apikey: KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    return r.ok;
  }
  await rest('events', { method: 'POST', body, prefer: 'return=minimal' });
  return true;
}

// ---- hunter name ---------------------------------------------------------------------
export function cleanName(s) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

// ---- leaderboard -------------------------------------------------------------------
// What the leaderboard shows of a hunter: the look (appearance) and the worn
// gear, without item ids or anything else of the save.
export const LOOK_COLORS = ['skin', 'hair', 'eyes', 'clothes', 'capeColor', 'aura', 'accent', 'leather', 'pants'];
const LOOK_KEYS = [...LOOK_COLORS, 'cape', 'hairStyle', 'build', 'height', 'facialHair', 'eyeShape', 'mark', 'accessory', 'outfit', 'capeStyle', 'auraStyle'];
export function publicLook(app) {
  const out = {};
  for (const k of LOOK_KEYS) if (app && app[k] !== undefined) out[k] = app[k];
  return out;
}
// stat points and the values they lead to (the derived ones only while playing)
export function publicStats(P, army) {
  const out = {};
  for (const k of ['str', 'agi', 'vit', 'int', 'per']) out[k] = Math.max(0, Math.round((P.stats && P.stats[k]) || 0));
  if (P.maxHp !== undefined && army) {
    out.hp = Math.round(P.maxHp);
    out.dmg = Math.round(P.power());
    out.def = Math.round(P.defense);
    out.crit = Math.round(P.crit * 1000) / 1000;
    out.slots = army.maxDeployed();
  }
  return out;
}
export function publicGear(equip) {
  const out = {};
  for (const slot of ['weapon', 'helmet', 'chest', 'gloves', 'boots']) {
    const it = equip && equip[slot];
    if (!it) continue;
    const g = { kind: it.kind, type: it.type, rarity: it.rarity, level: it.level, up: it.up || 0 };
    if (it.set) g.set = it.set;
    if (it.uq) g.uq = it.uq;
    out[slot] = g;
  }
  return out;
}

// Remembers the entry (the better one wins) and sends it when possible.
// floor and level are separate records: each keeps the better one
export function submitScore(entry, name) {
  const old = lsGet(LS_SCORE);
  const e = { ...entry, name, s: SEASON };
  if (old) {
    if ((old.floor || 0) > (e.floor || 0)) { e.floor = old.floor; e.difficulty = old.difficulty; }
    if (old.level > e.level || (old.level === e.level && old.mastery > e.mastery)) {
      e.level = old.level; e.mastery = old.mastery; e.rank = old.rank;
      // the stronger hunter keeps its look and gear on the board
      if (old.look) e.look = old.look;
      if (old.gear) e.gear = old.gear;
      if (old.stats) e.stats = old.stats;
      if (old.title) e.title = old.title;
    }
  }
  lsSet(LS_SCORE, e);
  flushScore();
}
const sameScore = (a, b) => a && b && a.floor === b.floor && a.level === b.level && a.mastery === b.mastery && a.name === b.name
  && JSON.stringify(a.look || null) === JSON.stringify(b.look || null) && JSON.stringify(a.gear || null) === JSON.stringify(b.gear || null) && JSON.stringify(a.stats || null) === JSON.stringify(b.stats || null) && (a.title || '') === (b.title || '');

let flushT = 0;
let flushing = false;
export async function flushScore() {
  const e = lsGet(LS_SCORE);
  if (e && e.s !== SEASON) { lsSet(LS_SCORE, null); return; } // an entry of Season 1 that was waiting: dropped
  if (!e || flushing || !navigator.onLine) return;
  if (!e.name || e.name.length < 2) return; // waits for a hunter name
  flushing = true;
  clearTimeout(flushT);
  try {
    const s = await ensureSession();
    if (!s) return;
    const row = { name: e.name, floor: e.floor, level: e.level, mastery: e.mastery, rank: e.rank, difficulty: e.difficulty };
    if (e.look) row.look = e.look;
    if (e.gear) row.gear = e.gear;
    if (e.stats) row.stats = e.stats;
    if (e.title !== undefined) row.title = e.title || null; // null takes the title off
    const up = await rest('abyss_scores?season=eq.' + SEASON + '&user_id=eq.' + accountId(), { method: 'PATCH', body: row, prefer: 'return=representation' });
    if (!up.data || !up.data.length) await rest('abyss_scores', { method: 'POST', body: { ...row, season: SEASON }, prefer: 'return=minimal' });
    const now = lsGet(LS_SCORE);
    if (sameScore(now, e)) lsSet(LS_SCORE, null);
    else if (now) flushT = setTimeout(flushScore, 6000); // changed meanwhile (the server takes one every 5 s)
  } catch (err) {
    // "too fast" or offline: try again a little later
    flushT = setTimeout(flushScore, err.status === 400 ? 7000 : 60000);
  } finally {
    flushing = false;
  }
}

// Top 50 and the own place of the 'abyss' board (deepest floor) or the
// 'level' board (highest level, then mastery). { rows, me: { place, row } | null }
export async function loadBoard(kind = 'abyss') {
  const sel = 'user_id,name,floor,level,mastery,rank,difficulty,look,gear,stats,title';
  if (kind === 's1') {
    const old = await rest(`abyss_scores_s1?select=${sel}&order=level.desc,mastery.desc,updated_at.asc&limit=50`, { auth: false });
    return { rows: old.data || [], me: null };
  }
  const lv = kind === 'level';
  const order = lv ? 'level.desc,mastery.desc,updated_at.asc' : 'floor.desc,updated_at.asc';
  const top = await rest(`abyss_scores?select=${sel}&season=eq.${SEASON}${lv ? '' : '&floor=gt.0'}&order=${order}&limit=50`, { auth: false });
  const rows = top.data || [];
  const id = myId();
  let me = null;
  if (id) {
    const i = rows.findIndex((r) => r.user_id === id);
    if (i >= 0) me = { place: i + 1, row: rows[i] };
    else {
      const mine = await rest(`abyss_scores?select=${sel}&season=eq.${SEASON}&user_id=eq.${id}`, { auth: false });
      const row = mine.data && mine.data[0];
      if (row && (lv || row.floor > 0)) {
        const better = lv ? `or=(level.gt.${row.level},and(level.eq.${row.level},mastery.gt.${row.mastery}))` : `floor=gt.${row.floor}`;
        const c = await rest(`abyss_scores?select=user_id&season=eq.${SEASON}&${better}`, { auth: false, prefer: 'count=exact', method: 'HEAD' });
        const n = Number(String(c.range || '').split('/')[1]) || 0;
        me = { place: n + 1, row };
      }
    }
  }
  return { rows, me };
}

// ---- cloud saves ------------------------------------------------------------------
export async function cloudList() {
  const r = await rest('cloud_saves?select=slot,saved_at,summary');
  return r.data || [];
}

export async function cloudGet(slot) {
  const r = await rest(`cloud_saves?select=data&slot=eq.${slot}`);
  const d = r.data && r.data[0] ? r.data[0].data : null;
  return d && !d.deleted ? d : null;
}

export async function cloudPut(slot, data, summary) {
  const s = await ensureSession();
  if (!s) throw new Error('offline');
  await rest('cloud_saves?on_conflict=user_id,slot', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { user_id: accountId(), slot, data, summary, saved_at: new Date(data.updated || Date.now()).toISOString() },
  });
}

// A world deleted on a paired device: the other devices remove it too.
export async function cloudDelete(slot, seed) {
  const now = Date.now();
  await cloudPut(slot, { deleted: true, seed, updated: now }, { deleted: true, seed });
}

// ---- pairing ------------------------------------------------------------------------
async function rpc(name, body = {}) {
  const r = await rest('rpc/' + name, { method: 'POST', body });
  return r.data;
}

export async function refreshLink() {
  const s = await ensureSession();
  if (!s) return linkInfo();
  const d = await rpc('my_account');
  link = { me: s.id, account: d.account, role: d.role, devices: d.devices };
  lsSet(LS_LINK, link);
  return link;
}

// a new code for this account: { code, expires_at }
export async function newPairCode() {
  return rpc('create_pair_code');
}

// joins the account of the code; need = worlds this device brings along.
// Throws an error whose message is the reason ('invalid', 'full', ...).
export async function pairWith(code, need) {
  const d = await rpc('claim_pair_code', { p_code: code, p_need: need });
  if (!d || d.error) throw Object.assign(new Error((d && d.error) || 'failed'), { free: d && d.free });
  return refreshLink();
}

export async function unlinkSelf() {
  await rpc('unlink_device');
  return refreshLink();
}

export async function unlinkOthers() {
  await rpc('unlink_devices');
  return refreshLink();
}

// the hunter name of the shared account (from its leaderboard entry)
export async function accountName() {
  const r = await rest(`abyss_scores?select=name&user_id=eq.${accountId()}`, { auth: false });
  return r.data && r.data[0] ? r.data[0].name : '';
}

window.addEventListener('online', () => flushScore());
