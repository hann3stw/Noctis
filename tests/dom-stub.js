// Minimal browser globals so modules that touch the DOM at load (game.js and what it imports) can be loaded by
// node --test. Nothing is drawn; tests only call the class logic. Must be imported before those modules.
const noop = () => {};
const el = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'style' || k === 'dataset' || k === 'classList' ? new Proxy({}, { get: () => noop, set: () => true }) : el()),
  apply: () => el(),
  set: () => true,
});
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
  globalThis.document = el();
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0, storage: {} }, configurable: true });
  globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  globalThis.location = { search: '', href: '' };
  globalThis.addEventListener = noop;
  globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
  globalThis.requestAnimationFrame = noop;
}
