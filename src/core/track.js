// Anonymous play data, so the game can be balanced and improved from facts (where players leave, how long a rank
// takes, what kills them). Each event is a name and a few numbers; it never holds the hunter name, the world name,
// chat or anything typed. It belongs to the anonymous account number of the device only (net/online.js).
//
// How it works: track() writes an event to a queue kept in localStorage (so nothing is lost offline or when the app is
// closed) and the queue is sent in batches to the table `events` every 30 s and when the app goes to the background.
// An event is removed from the queue only after the server accepted it. Switch it off: Settings > Share play data.
// Own test sessions are marked (ctx.dev) and the dev server sends nothing unless the address has ?track.
import { settings } from './settings.js';
import { sendEvents, cachedToken } from '../net/online.js';
import { usageDelta } from './usage.js';

const QK = 'noctis.track.q';
const FK = 'noctis.track.first';
const MAX_Q = 500;
const BATCH = 80;
const dev = !!(import.meta.env && import.meta.env.DEV);

let queue = [];
let seq = 0;
let sending = false;
let errors = 0;
let ctxFn = null;
let shownAt = Date.now();
const sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const base = {};

const on = () => settings.analytics !== false && (!dev || location.search.includes('track'));

function lsGet(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked or full */ }
}

// what the game knows right now (level, rank, class ...); set by the running world
export function setTrackCtx(fn) {
  ctxFn = fn;
}

export function track(name, props = {}) {
  if (!on()) return;
  let c = {};
  try { c = ctxFn ? ctxFn() || {} : {}; } catch (_) { /* a broken context must never break the game */ }
  const ctx = { ...base, ...c };
  if (dev) ctx.dev = 1;
  if (settings.devDevice) ctx.dev = 1;
  queue.push({ cid: sid + '-' + seq++, cts: new Date().toISOString(), sid, name, props, ctx });
  if (queue.length > MAX_Q) queue.splice(0, queue.length - MAX_Q);
  lsSet(QK, queue);
  if (queue.length >= BATCH) flush();
}

// sends the oldest events; quick = the app is going away (a fetch that may finish after the page is gone)
export async function flush(quick) {
  if (sending || !queue.length || !navigator.onLine || !on()) return;
  if (quick && !cachedToken()) return; // no valid sign-in right now: the next start sends them
  sending = true;
  const rows = queue.slice(0, BATCH);
  try {
    const ok = await sendEvents(rows, quick);
    if (ok) {
      const sent = new Set(rows.map((r) => r.cid));
      queue = queue.filter((r) => !sent.has(r.cid));
      lsSet(QK, queue);
    }
  } catch (_) { /* offline or refused: they stay in the queue */ }
  sending = false;
  if (queue.length >= BATCH && !quick) setTimeout(flush, 2000);
}

function scriptVersion() {
  const s = document.querySelector('script[src*="index-"]');
  const m = s && s.src.match(/index-([\w-]+)\.js/);
  return m ? m[1].slice(0, 8) : 'dev';
}

export function initTrack() {
  queue = Array.isArray(lsGet(QK)) ? lsGet(QK) : [];
  // the number of days since this device first played: lets the data show day 1 / 7 / 30 without joining anything
  let first = lsGet(FK);
  const isNew = !first;
  if (isNew) { first = Date.now(); lsSet(FK, first); }
  base.v = scriptVersion();
  base.in = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 't' : 'p';
  base.pwa = window.matchMedia && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ? 1 : 0;
  Object.defineProperty(base, 'dy', { enumerable: true, get: () => Math.floor((Date.now() - first) / 86400000) });
  track('session', { first: isNew ? 1 : 0, w: Math.round(window.innerWidth), h: Math.round(window.innerHeight), lang: (navigator.language || '').slice(0, 5) });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      track('hide', { sec: Math.round((Date.now() - shownAt) / 1000) });
      const u = usageDelta();
      if (u.sec > 5) track('usage', u);
      flush(true);
    } else {
      shownAt = Date.now();
      flush();
    }
  });
  window.addEventListener('pagehide', () => flush(true));
  window.addEventListener('error', (e) => {
    if (errors++ >= 5) return;
    track('error', { m: String(e.message || '').slice(0, 120), s: String(e.filename || '').split('/').pop().slice(0, 30) + ':' + (e.lineno || 0) });
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (errors++ >= 5) return;
    track('error', { m: String((e.reason && e.reason.message) || e.reason || '').slice(0, 120), s: 'promise' });
  });
  setInterval(() => flush(), 30000);
  setTimeout(() => flush(), 4000);
}
