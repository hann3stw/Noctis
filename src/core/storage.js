// Save games: one record per slot, written to IndexedDB and, as a second
// copy, to localStorage. Loading takes the newer of the two, so a world
// survives when one of the stores is lost. Saves from older versions of the
// game are brought up to date by migrateSave when they are loaded; they are
// never thrown away.
import { migrateSave } from './levels.js';
import { CONFIG } from '../config.js';

const DB_NAME = 'noctis';
const STORE = 'saves';
const LS_KEY = 'noctis.save.';
export const SLOT_COUNT = 3;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        if (!window.indexedDB) { resolve(null); return; }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function request(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function lsGet(slot) {
  try {
    const raw = localStorage.getItem(LS_KEY + slot);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function loadSlot(slot) {
  const db = await openDb();
  let a = null;
  if (db) {
    try { a = (await request(db, 'readonly', (s) => s.get(slot))) || null; } catch (_) { /* use the copy */ }
  }
  const b = lsGet(slot);
  const pick = a && b ? ((b.updated || 0) > (a.updated || 0) ? b : a) : a || b;
  try { return migrateSave(pick); } catch (_) { return null; }
}

export async function saveSlot(slot, data) {
  const db = await openDb();
  let ok = false;
  if (db) {
    try { await request(db, 'readwrite', (s) => s.put(data, slot)); ok = true; } catch (_) { /* the copy below may still work */ }
  }
  try { localStorage.setItem(LS_KEY + slot, JSON.stringify(data)); ok = true; } catch (_) { /* storage full or blocked */ }
  if (ok) backupSlot(slot, data).catch(() => {});
  return ok;
}

// ---- automatic backups ------------------------------------------------------------
// Every slot keeps a few copies of its worlds in IndexedDB (key "backup:<slot>"):
// one a day while playing, and one right before a world is deleted, replaced
// by a new one or restored over. Each copy is the save as text, so it is
// taken at once and can never change afterwards.
const BK_KEY = (slot) => 'backup:' + slot;

async function readBackups(db, slot) {
  try { return (await request(db, 'readonly', (s) => s.get(BK_KEY(slot)))) || []; } catch (_) { return []; }
}

// force: copy now, even when today's copy exists
export async function backupSlot(slot, data, force = false) {
  if (!data || typeof data.seed !== 'number') return;
  const text = JSON.stringify(data);
  const at = Date.now();
  const db = await openDb();
  if (!db) return;
  const C = CONFIG.backups;
  let list = await readBackups(db, slot);
  const last = list.find((b) => b.seed === data.seed);
  if (!force && last && at - last.at < C.every) return;
  list.unshift({ at, seed: data.seed, name: String(data.name || ''), level: (data.player && data.player.level) || 1, text });
  // the newest copies of each world, the newest worlds first
  const per = {};
  list = list.filter((b) => (per[b.seed] = (per[b.seed] || 0) + 1) <= C.perWorld).slice(0, C.max);
  try { await request(db, 'readwrite', (s) => s.put(list, BK_KEY(slot))); } catch (_) { /* full: keep the old ones */ }
}

// the copies of a slot, newest first: { at, seed, name, level }
export async function listBackups(slot) {
  const db = await openDb();
  if (!db) return [];
  return (await readBackups(db, slot)).map(({ at, seed, name, level }) => ({ at, seed, name, level }));
}

// one copy as a save (checked and brought up to date), null if unreadable
export async function readBackup(slot, at) {
  const db = await openDb();
  if (!db) return null;
  const b = (await readBackups(db, slot)).find((x) => x.at === at);
  return b ? readSaveText(b.text) : null;
}

// Asks the browser not to clear the saves when storage runs low.
export function keepStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (_) { /* not supported */ }
}

// A save from a file: checked and brought up to date. Null when it is not one.
export function readSaveText(text) {
  try {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object' || typeof s.seed !== 'number' || !s.player || typeof s.player !== 'object') return null;
    return migrateSave(s);
  } catch (_) {
    return null;
  }
}

export async function deleteSlot(slot) {
  const db = await openDb();
  if (db) {
    try { await request(db, 'readwrite', (s) => s.delete(slot)); } catch (_) { /* ignore */ }
  }
  try { localStorage.removeItem(LS_KEY + slot); } catch (_) { /* ignore */ }
}

// All slots, null for empty ones.
export async function listSlots() {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) out.push(await loadSlot(i));
  return out;
}
