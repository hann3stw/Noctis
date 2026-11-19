// Short vibrations on hits, kills and ultimates. Only Android browsers can
// vibrate (iPhones ignore it); it can be turned off in the settings.
import { settings } from './settings.js';

let last = 0;
// browsers allow vibration only after the screen was touched (not on a PC)
let touched = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') touched = true; }, true);
}

// ms: one pulse, or a pattern [on, off, on, ...]
export function buzz(ms) {
  if (!settings.vibrate || !touched || !navigator.vibrate) return;
  const now = performance.now();
  if (now - last < 70) return; // never a constant buzz
  last = now;
  try { navigator.vibrate(ms); } catch (_) { /* not allowed here */ }
}
