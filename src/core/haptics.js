// Short vibrations on hits, kills and ultimates. Only Android browsers can
// vibrate (iPhones ignore it); it can be turned off in the settings.
import { settings } from './settings.js';

let last = 0;

// ms: one pulse, or a pattern [on, off, on, ...]
export function buzz(ms) {
  if (!settings.vibrate || typeof navigator === 'undefined' || !navigator.vibrate) return;
  // only after the first tap (browsers refuse it before and log an error)
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const now = performance.now();
  if (now - last < 70) return; // never a constant buzz
  last = now;
  try { navigator.vibrate(ms); } catch (_) { /* not allowed yet */ }
}
