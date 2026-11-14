// Short numbers for the HUD: 950, 12.4K, 3.1M, 2.0B ...
const UNITS = ['', 'K', 'M', 'B', 'T'];

export function fmt(n) {
  n = Math.round(n);
  if (Math.abs(n) < 10000) return String(n);
  let u = 0;
  let v = n;
  while (Math.abs(v) >= 1000 && u < UNITS.length - 1) { v /= 1000; u++; }
  return (Math.abs(v) < 100 ? v.toFixed(1) : Math.round(v)) + UNITS[u];
}

// Sets a class for a moment (used for the fade-in when something opens).
export function flashClass(el, cls, ms = 320) {
  clearTimeout(el['_t' + cls]);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el['_t' + cls] = setTimeout(() => el.classList.remove(cls), ms);
}
