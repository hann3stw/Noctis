// How buttons feel: a short vibration on phones when a menu button goes down (not for the
// fighting buttons, they are pressed all the time), and a quick pop when it is released.
const UI = '.ap-btn, .sbtn, .mn-tab, .mn-x, .seg, .btn.pill, [data-act]';

export function initFeel() {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest(UI);
    if (!el || el.disabled || el.closest('#touch-layer')) return;
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* not everywhere */ }
  }, { passive: true });
  document.addEventListener('pointerup', (e) => {
    const el = e.target.closest && e.target.closest(UI);
    if (!el || el.disabled) return;
    el.classList.remove('pop');
    void el.offsetWidth; // restart the animation
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 260);
  }, { passive: true });
}
