// Save games: IndexedDB, with localStorage as a fallback when IndexedDB is
// not available (some private browser modes). One record per slot.
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
  if (db) {
    try { return (await request(db, 'readonly', (s) => s.get(slot))) || null; } catch (_) { /* fall back */ }
  }
  return lsGet(slot);
}

export async function saveSlot(slot, data) {
  const db = await openDb();
  if (db) {
    try { await request(db, 'readwrite', (s) => s.put(data, slot)); return true; } catch (_) { /* fall back */ }
  }
  try { localStorage.setItem(LS_KEY + slot, JSON.stringify(data)); return true; } catch (_) { return false; }
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
