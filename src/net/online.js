// Online features through Supabase (no extra library, plain fetch):
// - every device signs in anonymously once (no e-mail, no password)
// - Abyss leaderboard: the best floor of this player, everyone can read it
// - cloud saves: a copy of every save slot, only readable by its owner
// - transfer code: takes the saves and the leaderboard entry to a new device
// Everything fails quietly: without internet the game simply plays offline.
// The publishable key below is meant to be public; the database rules
// (row level security) decide what it may do.
const URL_BASE = 'https://ywecqnxbqivjnyjleyip.supabase.co';
const KEY = 'sb_publishable_p1JsJ_l07Lhd3m9FtRPJTA_j3TEUpZL';
const LS_SESSION = 'noctis.online.session';
const LS_SCORE = 'noctis.online.score'; // best entry not sent yet

function lsGet(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
function lsSet(k, v) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked */ }
}

let session = lsGet(LS_SESSION);
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

export function myId() {
  return session ? session.id : null;
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

// ---- hunter name ---------------------------------------------------------------------
export function cleanName(s) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

// ---- leaderboard -------------------------------------------------------------------
// Remembers the entry (the better one wins) and sends it when possible.
export function submitScore(entry, name) {
  const old = lsGet(LS_SCORE);
  const e = old && old.floor > entry.floor ? old : entry;
  lsSet(LS_SCORE, { ...e, name });
  flushScore();
}

let flushT = 0;
let flushing = false;
export async function flushScore() {
  const e = lsGet(LS_SCORE);
  if (!e || flushing || !navigator.onLine) return;
  if (!e.name || e.name.length < 2) return; // waits for a hunter name
  flushing = true;
  clearTimeout(flushT);
  try {
    const s = await ensureSession();
    if (!s) return;
    const row = { name: e.name, floor: e.floor, level: e.level, mastery: e.mastery, rank: e.rank, difficulty: e.difficulty };
    const up = await rest('abyss_scores?user_id=eq.' + s.id, { method: 'PATCH', body: row, prefer: 'return=representation' });
    if (!up.data || !up.data.length) await rest('abyss_scores', { method: 'POST', body: row, prefer: 'return=minimal' });
    const now = lsGet(LS_SCORE);
    if (now && now.floor === e.floor && now.name === e.name) lsSet(LS_SCORE, null);
  } catch (err) {
    // "too fast" or offline: try again a little later
    flushT = setTimeout(flushScore, err.status === 400 ? 7000 : 60000);
  } finally {
    flushing = false;
  }
}

// Top 50 and the own place. { rows, me: { place, row } | null }
export async function loadBoard() {
  const sel = 'user_id,name,floor,level,mastery,rank,difficulty';
  const top = await rest(`abyss_scores?select=${sel}&order=floor.desc,updated_at.asc&limit=50`, { auth: false });
  const rows = top.data || [];
  const id = myId();
  let me = null;
  if (id) {
    const i = rows.findIndex((r) => r.user_id === id);
    if (i >= 0) me = { place: i + 1, row: rows[i] };
    else {
      const mine = await rest(`abyss_scores?select=${sel}&user_id=eq.${id}`, { auth: false });
      const row = mine.data && mine.data[0];
      if (row) {
        const c = await rest(`abyss_scores?select=user_id&floor=gt.${row.floor}`, { auth: false, prefer: 'count=exact', method: 'HEAD' });
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
  return r.data && r.data[0] ? r.data[0].data : null;
}

export async function cloudPut(slot, data, summary) {
  const s = await ensureSession();
  if (!s) throw new Error('offline');
  await rest('cloud_saves?on_conflict=user_id,slot', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { user_id: s.id, slot, data, summary, saved_at: new Date(data.updated || Date.now()).toISOString() },
  });
}

// ---- transfer code ------------------------------------------------------------------
export async function transferCode() {
  const r = await rest('rpc/get_transfer_code', { method: 'POST', body: {} });
  return String(r.data || '');
}

// Returns the number of saves taken over; throws on a wrong code.
export async function claimCode(code) {
  const r = await rest('rpc/claim_transfer_code', { method: 'POST', body: { p_code: code } });
  return Number(r.data) || 0;
}

export function formatCode(c) {
  return String(c || '').replace(/(.{4})(?=.)/g, '$1-');
}

window.addEventListener('online', () => flushScore());
